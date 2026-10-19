import axios, { AxiosInstance } from "axios";
import FinancePaymentConfig from "../../models/FinancePaymentConfig";
import FinanceReceivable from "../../models/FinanceReceivable";
import FinanceCustomer from "../../models/FinanceCustomer";
import { getActiveAsaasApiKey, isAsaasProductionActive } from "./FinancePaymentConfigService";

// Adapter pro Asaas (`/v3/customers`, `/v3/payments`) — gateway de
// COBRANÇA, Fase 2 (ao lado do Mercado Pago, Fase 1 — ver
// MercadoPagoGatewayService.ts). Diferente do Mercado Pago, o Asaas exige
// um CADASTRO de cliente no sistema deles antes de gerar a cobrança (não
// dá pra mandar os dados do pagador direto no payload do pagamento) — por
// isso `ensureAsaasCustomer` busca por CPF/CNPJ antes de criar, pra não
// duplicar cliente a cada cobrança gerada pro mesmo `FinanceCustomer`.
//
// ⚠️ IMPORTANTE — mesma ressalva já registrada em FocusNFeService e
// MercadoPagoGatewayService: implementado a partir da documentação pública
// do Asaas, nunca testado ponta a ponta contra uma chave de teste real
// (sandbox deste ambiente de desenvolvimento sem saída de rede pra
// `*.asaas.com`). Validar com uma cobrança de teste de verdade antes de
// confiar em produção, ajustando o parsing se o formato vier diferente.
const BASE_URL_SANDBOX = "https://sandbox.asaas.com/api/v3";
const BASE_URL_PRODUCTION = "https://api.asaas.com/v3";

export interface AsaasChargeResult {
  externalId: string;
  status: string;
  pixQrCode: string;
  pixQrCodeBase64: string;
  pixExpiresAt: Date | null;
  boletoUrl: string;
  raw: unknown;
}

const buildClient = (config: FinancePaymentConfig): AxiosInstance => {
  const isProduction = isAsaasProductionActive(config);
  const baseURL = isProduction ? BASE_URL_PRODUCTION : BASE_URL_SANDBOX;
  const apiKey = getActiveAsaasApiKey(config);
  return axios.create({
    baseURL,
    headers: {
      access_token: apiKey,
      "Content-Type": "application/json"
    },
    timeout: 30000
  });
};

// YYYY-MM-DD — formato exigido pelo Asaas em `dueDate`. Usa o vencimento já
// cadastrado na Conta a Receber quando existe (campo `dueDate`, que já
// existia antes dessa integração); sem isso, amanhã (não dá pra cobrar com
// vencimento no passado).
const resolveDueDate = (receivable: FinanceReceivable): string => {
  const due = receivable.dueDate ? new Date(receivable.dueDate) : null;
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const date = due && due.getTime() > Date.now() ? due : tomorrow;
  return date.toISOString().slice(0, 10);
};

const ensureAsaasCustomer = async (
  client: AxiosInstance,
  customer: FinanceCustomer
): Promise<string> => {
  const cpfCnpj = (customer.document || "").replace(/\D/g, "");
  if (cpfCnpj) {
    const { data } = await client.get("/customers", { params: { cpfCnpj } });
    const existing = data?.data?.[0];
    if (existing?.id) return existing.id;
  }

  const { data } = await client.post("/customers", {
    name: customer.name,
    cpfCnpj: cpfCnpj || undefined,
    email: customer.email || undefined,
    postalCode: customer.zipCode ? customer.zipCode.replace(/\D/g, "") : undefined,
    address: customer.street || undefined,
    addressNumber: customer.number || undefined
  });
  return data.id;
};

const parsePaymentResponse = (data: any): AsaasChargeResult => ({
  externalId: String(data?.id ?? ""),
  status: String(data?.status ?? "PENDING"),
  pixQrCode: "",
  pixQrCodeBase64: "",
  pixExpiresAt: null,
  boletoUrl: String(data?.bankSlipUrl ?? ""),
  raw: data
});

export const createPixCharge = async (
  receivable: FinanceReceivable,
  customer: FinanceCustomer,
  config: FinancePaymentConfig
): Promise<AsaasChargeResult> => {
  const client = buildClient(config);
  const asaasCustomerId = await ensureAsaasCustomer(client, customer);

  const { data: payment } = await client.post("/payments", {
    customer: asaasCustomerId,
    billingType: "PIX",
    value: Number(receivable.value),
    dueDate: resolveDueDate(receivable),
    description: receivable.description
  });

  // O QR Code do Pix não vem na criação do pagamento — é uma segunda
  // chamada específica (`/payments/{id}/pixQrCode`), formato documentado
  // do Asaas.
  const { data: qrCode } = await client.get(`/payments/${payment.id}/pixQrCode`);

  const result = parsePaymentResponse(payment);
  result.pixQrCode = String(qrCode?.payload ?? "");
  result.pixQrCodeBase64 = String(qrCode?.encodedImage ?? "");
  result.pixExpiresAt = qrCode?.expirationDate ? new Date(qrCode.expirationDate) : null;
  return result;
};

export const createBoletoCharge = async (
  receivable: FinanceReceivable,
  customer: FinanceCustomer,
  config: FinancePaymentConfig
): Promise<AsaasChargeResult> => {
  const client = buildClient(config);
  const asaasCustomerId = await ensureAsaasCustomer(client, customer);

  const { data: payment } = await client.post("/payments", {
    customer: asaasCustomerId,
    billingType: "BOLETO",
    value: Number(receivable.value),
    dueDate: resolveDueDate(receivable),
    description: receivable.description
  });

  return parsePaymentResponse(payment);
};

export const getPayment = async (
  paymentId: string,
  config: FinancePaymentConfig
): Promise<AsaasChargeResult> => {
  const client = buildClient(config);
  const { data } = await client.get(`/payments/${paymentId}`);
  return parsePaymentResponse(data);
};

// Asaas não assina o corpo (sem HMAC como o Mercado Pago) — a validação
// deles é um token fixo configurado no painel ("Webhooks" > "Token de
// autenticação"), reenviado em todo POST no header `asaas-access-token`.
// Comparação simples, não timing-safe (não é um HMAC, não tem o mesmo
// risco de side-channel que uma assinatura criptográfica real).
export const verifyWebhookToken = (
  headerToken: string | undefined,
  webhookToken: string
): boolean => {
  if (!webhookToken) return true;
  return !!headerToken && headerToken === webhookToken;
};

// Status que o Asaas considera "pago de verdade" — PIX/boleto/cartão
// caem em RECEIVED (saldo já creditado) ou CONFIRMED (confirmado, ainda
// compensando — tratado como pago aqui pra não deixar a conta "pendente"
// por dias depois do cliente já ter pago).
export const isPaidStatus = (status: string): boolean =>
  status === "RECEIVED" || status === "CONFIRMED" || status === "RECEIVED_IN_CASH";

export const isConfigured = (config: FinancePaymentConfig): boolean =>
  !!getActiveAsaasApiKey(config);
