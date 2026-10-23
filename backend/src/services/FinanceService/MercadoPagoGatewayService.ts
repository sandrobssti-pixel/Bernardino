import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import FinancePaymentConfig from "../../models/FinancePaymentConfig";
import FinanceReceivable from "../../models/FinanceReceivable";
import FinanceCustomer from "../../models/FinanceCustomer";
import {
  getActiveMercadoPagoToken,
  isMercadoPagoProductionActive
} from "./FinancePaymentConfigService";

// Adapter pro Mercado Pago (Checkout API, `/v1/payments`) — gateway de
// COBRANÇA (Pix/boleto), Fase 1 da integração de pagamento pedida pelo
// cliente (diferente de FocusNFeService, que é gateway de EMISSÃO de nota
// fiscal). Ver docs/MANUAL_TECNICO.md.
//
// ⚠️ IMPORTANTE — sem teste end-to-end contra o gateway de verdade, mesma
// ressalva já registrada em FocusNFeService: implementado a partir do
// formato documentado publicamente da API do Mercado Pago (Checkout API /
// Pagamentos — `POST /v1/payments`, `payment_method_id: "pix"`/
// `"bolbradesco"`), mas nunca validado contra uma chave de teste real desta
// conta (o sandbox deste ambiente de desenvolvimento não tem saída de rede
// pra `api.mercadopago.com`). Antes de confiar em produção: gerar uma
// cobrança de teste de verdade (token de teste, "TEST-...") e comparar a
// resposta real com o parsing abaixo (`parsePaymentResponse`), ajustando se
// o formato vier diferente do esperado.
const BASE_URL = "https://api.mercadopago.com";

export interface MercadoPagoChargeResult {
  externalId: string;
  status: string;
  pixQrCode: string;
  pixQrCodeBase64: string;
  pixExpiresAt: Date | null;
  boletoUrl: string;
  raw: unknown;
}

const buildClient = (config: FinancePaymentConfig): AxiosInstance => {
  const token = getActiveMercadoPagoToken(config);
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    timeout: 30000
  });
};

// Mercado Pago exige e-mail do pagador; cadastro de cliente do Financeiro
// não obriga esse campo (nem todo cliente de loja física tem e-mail
// cadastrado) — usa um e-mail sintético nesse caso, igual outras
// integrações fazem quando o gateway exige um campo que o cadastro local
// não garante. Sinalizado no retorno pro chamador decidir se quer avisar o
// usuário (ver FinanceReceivablePaymentService).
const resolvePayerEmail = (customer: FinanceCustomer): string =>
  customer.email && customer.email.trim() ? customer.email.trim() : `cliente${customer.id}@sememail.atendeflow`;

const splitName = (fullName: string): { firstName: string; lastName: string } => {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] || "Cliente", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
};

const buildPayerPayload = (customer: FinanceCustomer) => {
  const { firstName, lastName } = splitName(customer.name);
  const docType = (customer.documentType || "cpf").toUpperCase();
  const payer: Record<string, unknown> = {
    email: resolvePayerEmail(customer),
    first_name: firstName,
    last_name: lastName
  };
  if (customer.document) {
    payer.identification = { type: docType, number: customer.document.replace(/\D/g, "") };
  }
  return payer;
};

const parsePaymentResponse = (data: any): MercadoPagoChargeResult => {
  const transactionData = data?.point_of_interaction?.transaction_data || {};
  const expiresAt = data?.date_of_expiration ? new Date(data.date_of_expiration) : null;
  return {
    externalId: String(data?.id ?? ""),
    status: String(data?.status ?? "pending"),
    pixQrCode: String(transactionData.qr_code ?? ""),
    pixQrCodeBase64: String(transactionData.qr_code_base64 ?? ""),
    pixExpiresAt: expiresAt,
    boletoUrl: String(data?.transaction_details?.external_resource_url ?? ""),
    raw: data
  };
};

export const createPixCharge = async (
  receivable: FinanceReceivable,
  customer: FinanceCustomer,
  config: FinancePaymentConfig
): Promise<MercadoPagoChargeResult> => {
  const client = buildClient(config);
  const expirationMinutes = config.pixExpirationMinutes || 60;
  const dateOfExpiration = new Date(Date.now() + expirationMinutes * 60000).toISOString();

  const { data } = await client.post(
    "/v1/payments",
    {
      transaction_amount: Number(receivable.value),
      description: receivable.description,
      payment_method_id: "pix",
      date_of_expiration: dateOfExpiration,
      payer: buildPayerPayload(customer)
    },
    { headers: { "X-Idempotency-Key": uuidv4() } }
  );

  return parsePaymentResponse(data);
};

// "bolbradesco" é o `payment_method_id` de boleto bancário do Mercado Pago
// (emitido via Banco Bradesco, independente de qual banco o cliente final
// usa pra pagar) — não existe um "boleto genérico" na API deles.
export const createBoletoCharge = async (
  receivable: FinanceReceivable,
  customer: FinanceCustomer,
  config: FinancePaymentConfig
): Promise<MercadoPagoChargeResult> => {
  const client = buildClient(config);
  const payer = buildPayerPayload(customer) as Record<string, unknown>;

  if (customer.zipCode) {
    payer.address = {
      zip_code: customer.zipCode.replace(/\D/g, ""),
      street_name: customer.street || "",
      street_number: customer.number || "s/n"
    };
  }

  const { data } = await client.post(
    "/v1/payments",
    {
      transaction_amount: Number(receivable.value),
      description: receivable.description,
      payment_method_id: "bolbradesco",
      payer
    },
    { headers: { "X-Idempotency-Key": uuidv4() } }
  );

  return parsePaymentResponse(data);
};

export const getPayment = async (
  paymentId: string,
  config: FinancePaymentConfig
): Promise<MercadoPagoChargeResult> => {
  const client = buildClient(config);
  const { data } = await client.get(`/v1/payments/${paymentId}`);
  return parsePaymentResponse(data);
};

// Valida a assinatura do webhook (header `x-signature`) seguindo o
// algoritmo documentado do Mercado Pago: HMAC-SHA256 sobre o "manifest"
// `id:{data.id};request-id:{x-request-id};ts:{ts};`, comparado ao `v1` do
// header. Sem o secret configurado em FinancePaymentConfig, a validação é
// pulada (loga aviso) — o handler ainda assim NUNCA confia no corpo da
// notificação pra marcar como pago, sempre busca o status de verdade via
// `getPayment` (ver FinanceReceivablePaymentService.handleWebhook).
export const verifyWebhookSignature = (
  signatureHeader: string | undefined,
  requestIdHeader: string | undefined,
  dataId: string,
  webhookSecret: string
): boolean => {
  if (!webhookSecret) return true;
  if (!signatureHeader || !requestIdHeader || !dataId) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim(), value?.trim()];
    })
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestIdHeader};ts:${ts};`;
  const expected = crypto.createHmac("sha256", webhookSecret).update(manifest).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
  } catch {
    return false;
  }
};

export const isConfigured = (config: FinancePaymentConfig): boolean =>
  !!getActiveMercadoPagoToken(config);

export { isMercadoPagoProductionActive };
