import { Request, Response } from "express";
import * as Yup from "yup";
import * as dotenv from "dotenv";
import axios from "axios";
import { Op } from "sequelize";
import AppError from "../errors/AppError";
import Company from "../models/Company";
import Invoices from "../models/Invoices";
import { getIO } from "../libs/socket";
import GetGlobalConfig from "../helpers/GetGlobalConfig";
import parseCurrencyValue from "../helpers/parseCurrencyValue";
import {
  buildEfiHttpsAgent,
  getEfiAccessToken,
  getEfiBaseUrl,
  extractEfiErrorMessage
} from "../helpers/EfiPayClient";

dotenv.config();

const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL || "https://api.asaas.com/v3";
const PUSHINPAY_BASE_URL = process.env.PUSHINPAY_BASE_URL || "https://api.pushinpay.com.br";
const PAID_ASAAS_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
const PAID_ASAAS_EVENTS = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED_IN_CASH"
]);

const sanitizeCpfCnpj = (value?: string): string => {
  if (!value) return "";
  return String(value).replace(/\D/g, "");
};

const isValidCpfCnpj = (value?: string): boolean => {
  const normalized = sanitizeCpfCnpj(value);
  return normalized.length === 11 || normalized.length === 14;
};

const extractAsaasErrorMessage = (error: any): string => {
  const fallback = String(error?.response?.data?.message || error?.message || "Erro no Asaas");
  const errors = error?.response?.data?.errors;

  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0];
    const desc = String(first?.description || "").trim();
    const code = String(first?.code || "").trim();
    if (desc && code) return `${desc} (${code})`;
    if (desc) return desc;
  }

  return fallback;
};

const isPaidInvoice = (invoice?: Invoices | null): boolean => {
  if (!invoice) return false;
  return String(invoice.status || "").toLowerCase() === "paid";
};

const extractNumericInvoiceId = (externalReference: string): number | null => {
  const normalized = String(externalReference || "").trim();
  if (!normalized) return null;

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  const candidateMatch = normalized.match(
    /(?:invoiceid|invoice|fatura|id)[:=](\d+)/i
  );

  if (candidateMatch?.[1]) {
    return Number(candidateMatch[1]);
  }

  return null;
};

const resolveInvoiceByAsaasReference = async (
  externalReference: string
): Promise<Invoices | null> => {
  const numericInvoiceId = extractNumericInvoiceId(externalReference);

  if (numericInvoiceId) {
    const invoiceById = await Invoices.findByPk(numericInvoiceId);
    if (invoiceById) {
      return invoiceById;
    }
  }

  const companyRefMatch = String(externalReference || "").match(/client:(\d+)/i);
  const monthRefMatch = String(externalReference || "").match(/ref:(\d{4}-\d{2})/i);

  if (!companyRefMatch?.[1]) {
    return null;
  }

  const companyId = Number(companyRefMatch[1]);
  const monthPrefix = monthRefMatch?.[1] || "";

  const whereClause: any = {
    companyId,
    status: {
      [Op.ne]: "paid"
    }
  };

  if (monthPrefix) {
    whereClause.dueDate = {
      [Op.like]: `${monthPrefix}%`
    };
  }

  const invoiceByCompanyAndMonth = await Invoices.findOne({
    where: whereClause,
    order: [["id", "DESC"]]
  });

  return invoiceByCompanyAndMonth;
};

const applyPaidInvoiceEffects = async (
  invoice: Invoices,
  action: string
): Promise<void> => {
  const companyId = invoice.companyId;
  const company = await Company.findByPk(companyId);

  if (!company) return;

  const baseDueDate = company.dueDate ? new Date(company.dueDate) : new Date();
  const expiresAt = Number.isNaN(baseDueDate.getTime()) ? new Date() : baseDueDate;

  expiresAt.setDate(expiresAt.getDate() + 30);

  const newDueDate = expiresAt.toISOString().split("T")[0];
  await company.update({ dueDate: newDueDate });
  await invoice.update({ status: "paid" });

  const io = getIO();
  const companyUpdate = await Company.findOne({ where: { id: companyId } });

  io.emit(`company-${companyId}-payment`, {
    action,
    company: companyUpdate
  });
};

const resolveAsaasCustomerId = async (
  company: Company,
  asaasApiKey: string
): Promise<string> => {
  const externalReference = `wtk-company-${company.id}`;
  const document = sanitizeCpfCnpj((company as any)?.document);

  if (!isValidCpfCnpj(document)) {
    throw new AppError(
      "CPF/CNPJ da empresa inválido ou não preenchido. Atualize o cadastro da empresa antes de gerar a cobrança.",
      400
    );
  }

  const listCustomersResponse = await axios.get(`${ASAAS_BASE_URL}/customers`, {
    headers: {
      "Content-Type": "application/json",
      access_token: asaasApiKey
    },
    params: {
      externalReference,
      limit: 1
    }
  });

  const existingCustomer = listCustomersResponse?.data?.data?.[0];
  const existingCustomerId = existingCustomer?.id;
  if (existingCustomerId) {
    const asaasDoc = sanitizeCpfCnpj(
      existingCustomer?.cpfCnpj ||
        existingCustomer?.cnpjCpf ||
        existingCustomer?.document
    );

    if (asaasDoc !== document) {
      try {
        await axios.post(
          `${ASAAS_BASE_URL}/customers/${existingCustomerId}`,
          {
            name: company.name || `Empresa ${company.id}`,
            email: company.email || undefined,
            cpfCnpj: document,
            externalReference
          },
          {
            headers: {
              "Content-Type": "application/json",
              access_token: asaasApiKey
            }
          }
        );
      } catch (error: any) {
        throw new AppError(
          `Não foi possível atualizar o CPF/CNPJ do cliente no Asaas: ${extractAsaasErrorMessage(
            error
          )}`,
          400
        );
      }
    }

    return String(existingCustomerId);
  }

  const customerPayload: Record<string, any> = {
    name: company.name || `Empresa ${company.id}`,
    email: company.email || undefined,
    externalReference,
    cpfCnpj: document
  };

  let customerResponse: any;
  try {
    customerResponse = await axios.post(
      `${ASAAS_BASE_URL}/customers`,
      customerPayload,
      {
        headers: {
          "Content-Type": "application/json",
          access_token: asaasApiKey
        }
      }
    );
  } catch (error: any) {
    throw new AppError(
      `Não foi possível criar cliente no Asaas: ${extractAsaasErrorMessage(error)}`,
      400
    );
  }

  const customerId = customerResponse?.data?.id;
  if (!customerId) {
    throw new AppError("Não foi possível criar cliente no Asaas.", 400);
  }

  return String(customerId);
};

// txid da EFI precisa ser alfanumérico, entre 26 e 35 caracteres.
const buildEfiTxid = (invoiceId: number): string => {
  const random = Math.random().toString(36).replace(/[^a-z0-9]/g, "");
  const raw = `wtkinv${invoiceId}${Date.now().toString(36)}${random}`;
  return raw.replace(/[^a-zA-Z0-9]/g, "").slice(0, 35).padEnd(26, "0");
};

const createEfiCharge = async (
  invoice: Invoices,
  invoiceId: string,
  unitPrice: number,
  companyId: number,
  globalConfig: Awaited<ReturnType<typeof GetGlobalConfig>>,
  res: Response
): Promise<Response> => {
  const {
    efiClientId,
    efiClientSecret,
    efiCertificate,
    efiCertificatePassphrase,
    efiPixKey,
    efiSandbox
  } = globalConfig;

  if (!efiClientId || !efiClientSecret || !efiCertificate || !efiPixKey) {
    throw new AppError(
      "EFI Bank não configurado. Preencha Client ID, Client Secret, Certificado e Chave Pix.",
      400
    );
  }

  const company = await Company.findByPk(companyId);
  if (!company) {
    throw new AppError("Empresa não encontrada.", 404);
  }

  const document = sanitizeCpfCnpj((company as any)?.document);
  if (!isValidCpfCnpj(document)) {
    throw new AppError(
      "CPF/CNPJ da empresa inválido ou não preenchido. Atualize o cadastro da empresa antes de gerar a cobrança.",
      400
    );
  }

  try {
    const httpsAgent = buildEfiHttpsAgent(efiCertificate, efiCertificatePassphrase);
    const accessToken = await getEfiAccessToken({
      clientId: efiClientId,
      clientSecret: efiClientSecret,
      certificateBase64: efiCertificate,
      passphrase: efiCertificatePassphrase,
      sandbox: efiSandbox
    });
    const baseUrl = getEfiBaseUrl(efiSandbox);
    const txid = buildEfiTxid(Number(invoiceId));

    const devedorField =
      document.length === 11
        ? { cpf: document, nome: company.name || `Empresa ${company.id}` }
        : { cnpj: document, nome: company.name || `Empresa ${company.id}` };

    const expiracaoSegundos = 3600;

    const cobPayload = {
      calendario: { expiracao: expiracaoSegundos },
      devedor: devedorField,
      valor: { original: unitPrice.toFixed(2) },
      chave: efiPixKey,
      solicitacaoPagador: `Fatura #${invoiceId}`
    };

    const cobResponse = await axios.put(`${baseUrl}/v2/cob/${txid}`, cobPayload, {
      httpsAgent,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    const pixCopiaECola = String(cobResponse?.data?.pixCopiaECola || "");
    if (!pixCopiaECola) {
      throw new AppError("Não foi possível gerar o QR Code Pix na EFI.", 400);
    }

    await invoice.update({ externalPaymentId: txid, pixPayload: pixCopiaECola });

    return res.json({
      gateway: "efi",
      pix: {
        copiaECola: pixCopiaECola,
        qrcodeBase64: null,
        value: unitPrice,
        expiresAt: new Date(Date.now() + expiracaoSegundos * 1000).toISOString(),
        txid
      }
    });
  } catch (error: any) {
    console.error(error?.response?.data || error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      `Problema ao gerar cobrança PIX na EFI: ${extractEfiErrorMessage(error)}`,
      400
    );
  }
};

const createPushinPayCharge = async (
  invoice: Invoices,
  invoiceId: string,
  unitPrice: number,
  globalConfig: Awaited<ReturnType<typeof GetGlobalConfig>>,
  res: Response
): Promise<Response> => {
  const pushinPayToken = String(globalConfig.pushinPayToken || "").trim();
  if (!pushinPayToken) {
    throw new AppError("Pushin Pay não configurado. Informe o Token no Global Config.", 400);
  }

  try {
    const valueInCents = Math.round(unitPrice * 100);
    const webhookUrl = `${process.env.BACKEND_URL}/subscription/webhook/pushinpay`;

    const chargeResponse = await axios.post(
      `${PUSHINPAY_BASE_URL}/api/pix/cashIn`,
      { value: valueInCents, webhook_url: webhookUrl },
      {
        headers: {
          Authorization: `Bearer ${pushinPayToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    const charge = chargeResponse?.data || {};
    const qrCode = String(charge?.qr_code || "");
    const externalId = charge?.id ? String(charge.id) : "";

    if (!qrCode || !externalId) {
      throw new AppError("Não foi possível gerar o QR Code Pix na Pushin Pay.", 400);
    }

    await invoice.update({ externalPaymentId: externalId, pixPayload: qrCode });

    return res.json({
      gateway: "pushinpay",
      pix: {
        copiaECola: qrCode,
        qrcodeBase64: charge?.qr_code_base64 || null,
        value: unitPrice,
        expiresAt: null,
        txid: externalId
      }
    });
  } catch (error: any) {
    console.error(error?.response?.data || error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      `Problema ao gerar cobrança PIX na Pushin Pay: ${String(
        error?.response?.data?.message || error?.message || "erro desconhecido"
      )}`,
      400
    );
  }
};

// Endpoint para criar uma nova assinatura
export const createSubscription = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;

  const schema = Yup.object().shape({
    price: Yup.string().required(),
    users: Yup.string().required(),
    connections: Yup.string().required(),
    cpfCnpj: Yup.string().nullable()
  });

  if (!(await schema.isValid(req.body))) {
    throw new AppError("Validation fails", 400);
  }

  const { price, invoiceId, cpfCnpj } = req.body;
  const unitPrice = parseCurrencyValue(price);
  if (unitPrice === null) {
    throw new AppError("Valor inválido para pagamento.", 400);
  }

  const invoice = await Invoices.findByPk(invoiceId);
  if (!invoice || Number(invoice.companyId) !== Number(companyId)) {
    throw new AppError("Fatura não encontrada para esta empresa.", 404);
  }

  const globalConfig = await GetGlobalConfig();
  const paymentGateway = String(globalConfig.paymentGateway || "mercadopago").toLowerCase();

  if (paymentGateway === "asaas") {
    const asaasApiKey = String(globalConfig.asaasApiKey || "").trim();
    const asaasWebhookSecret = String(globalConfig.asaasWebhookSecret || "").trim();

    if (!asaasApiKey) {
      throw new AppError("Asaas não configurado. Informe a API Key no Global Config.", 400);
    }
    if (!asaasWebhookSecret) {
      throw new AppError("Asaas não configurado. Informe o Token de Webhook no Global Config.", 400);
    }

    const company = await Company.findByPk(companyId);
    if (!company) {
      throw new AppError("Empresa não encontrada.", 404);
    }

    try {
      const requestDocument = sanitizeCpfCnpj(cpfCnpj);
      if (requestDocument && !isValidCpfCnpj(requestDocument)) {
        throw new AppError("CPF/CNPJ informado é inválido.", 400);
      }

      if (requestDocument && requestDocument !== sanitizeCpfCnpj((company as any)?.document)) {
        await company.update({ document: requestDocument });
      }

      const customerId = await resolveAsaasCustomerId(company, asaasApiKey);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);

      const asaasPayload = {
        customer: customerId,
        // UNDEFINED deixa o checkout escolher entre os meios habilitados na conta Asaas
        // (ex.: PIX, BOLETO e CARTAO), sem aprovar assinatura antes da confirmação.
        billingType: "UNDEFINED",
        value: unitPrice,
        dueDate: dueDate.toISOString().split("T")[0],
        description: `#Fatura:${invoiceId}`,
        externalReference: String(invoiceId)
      };

      const paymentResponse = await axios.post(
        `${ASAAS_BASE_URL}/payments`,
        asaasPayload,
        {
          headers: {
            "Content-Type": "application/json",
            access_token: asaasApiKey
          }
        }
      );

      const payment = paymentResponse?.data || {};
      const urlPayment =
        payment.invoiceUrl ||
        payment.bankSlipUrl ||
        payment.transactionReceiptUrl ||
        "";

      if (!urlPayment) {
        throw new AppError("Não foi possível gerar link de pagamento no Asaas.", 400);
      }

      await invoice.update({ linkInvoice: urlPayment });

      return res.json({
        gateway: "asaas",
        urlPayment,
        urlMcPg: urlPayment,
        paymentId: payment.id || null
      });
    } catch (error: any) {
      console.error(error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        `Problema ao gerar cobrança no Asaas: ${extractAsaasErrorMessage(error)}`,
        400
      );
    }
  }

  if (paymentGateway === "efi") {
    return createEfiCharge(invoice, String(invoiceId), unitPrice, companyId, globalConfig, res);
  }

  if (paymentGateway === "pushinpay") {
    return createPushinPayCharge(invoice, String(invoiceId), unitPrice, globalConfig, res);
  }

  const mpAccessToken = String(globalConfig.mpAccessToken || "").trim();
  if (!mpAccessToken) {
    throw new AppError("Mercado Pago não configurado. Informe o Access Token.", 400);
  }

  const data = {
    back_urls: {
      success: `${process.env.FRONTEND_URL}/financeiro`,
      failure: `${process.env.FRONTEND_URL}/financeiro`
    },
    notification_url: `${process.env.BACKEND_URL}/subscription/webhook`,
    auto_return: "approved",
    external_reference: String(invoiceId),
    metadata: {
      invoiceId: String(invoiceId)
    },
    items: [
      {
        title: `#Fatura:${invoiceId}`,
        quantity: 1,
        currency_id: "BRL",
        unit_price: unitPrice
      }
    ]
  };

  try {
    const response = await axios.post(
      "https://api.mercadopago.com/checkout/preferences",
      data,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mpAccessToken}`
        }
      }
    );

    const urlMcPg = response.data.init_point;

    return res.json({
      gateway: "mercadopago",
      urlMcPg,
      urlPayment: urlMcPg
    });
  } catch (error) {
    console.error(error);
    throw new AppError(
      "Problema encontrado, entre em contato com o suporte!",
      400
    );
  }
};

const processMercadoPagoWebhook = async (req: Request): Promise<void> => {
  const { evento, data: bodyData, type: bodyType, action: bodyAction } = req.body || {};
  const query = req.query || {};
  const params = req.params || {};

  const fallbackTopic = typeof params.type === "string" ? params.type : undefined;
  const topic = String(
    bodyType ||
      bodyAction ||
      query.type ||
      query.topic ||
      fallbackTopic ||
      ""
  ).toLowerCase();

  const rawNotificationId =
    bodyData?.id ||
    (query as any).id ||
    (query as any)["data.id"] ||
    (query as any)["data[id]"];

  const paymentId = rawNotificationId ? String(rawNotificationId) : "";

  if (evento === "teste_webhook") {
    return;
  }

  if (!paymentId || (topic && !topic.includes("payment"))) {
    return;
  }

  const { mpAccessToken } = await GetGlobalConfig();
  if (!mpAccessToken) {
    return;
  }

  const paymentResponse = await axios.get(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mpAccessToken}`
      }
    }
  );

  const paymentDetails = paymentResponse.data;

  if (paymentDetails.status !== "approved") {
    return;
  }

  const invoiceIDRaw =
    paymentDetails?.metadata?.invoiceId ||
    paymentDetails?.external_reference ||
    paymentDetails?.additional_info?.items?.[0]?.title
      ?.replace("#Fatura:", "")
      ?.trim();

  const invoiceID = invoiceIDRaw ? String(invoiceIDRaw) : "";
  if (!invoiceID) {
    return;
  }

  const invoice = await Invoices.findByPk(invoiceID);
  if (!invoice || isPaidInvoice(invoice)) {
    return;
  }

  await applyPaidInvoiceEffects(invoice, paymentDetails.status);
};

const processAsaasWebhook = async (req: Request): Promise<void> => {
  const config = await GetGlobalConfig();
  const asaasApiKey = String(config.asaasApiKey || "").trim();
  const asaasWebhookSecret = String(config.asaasWebhookSecret || "").trim();

  if (!asaasApiKey) {
    return;
  }

  if (asaasWebhookSecret) {
    const requestToken = String(
      req.headers["asaas-access-token"] ||
        req.headers["x-asaas-token"] ||
        req.query.token ||
        ""
    ).trim();

    if (!requestToken || requestToken !== asaasWebhookSecret) {
      throw new AppError("Webhook Asaas sem autorização.", 401);
    }
  }

  const body = req.body || {};
  const event = String(body?.event || "").toUpperCase();
  const bodyPayment = body?.payment || {};

  let paymentId = bodyPayment?.id ? String(bodyPayment.id) : "";
  let externalReference = bodyPayment?.externalReference
    ? String(bodyPayment.externalReference)
    : "";
  let paymentStatus = String(bodyPayment?.status || "").toUpperCase();

  if (paymentId && (!externalReference || !paymentStatus)) {
    const detailsResponse = await axios.get(
      `${ASAAS_BASE_URL}/payments/${paymentId}`,
      {
        headers: {
          "Content-Type": "application/json",
          access_token: asaasApiKey
        }
      }
    );

    const details = detailsResponse?.data || {};
    externalReference = externalReference || String(details?.externalReference || "");
    paymentStatus = paymentStatus || String(details?.status || "").toUpperCase();
  }

  const isPaidEvent = PAID_ASAAS_EVENTS.has(event);
  const isPaidStatus = PAID_ASAAS_STATUSES.has(paymentStatus);

  if (!isPaidEvent && !isPaidStatus) {
    return;
  }

  const normalizedReference = externalReference
    .replace("#Fatura:", "")
    .trim();

  if (!normalizedReference) {
    return;
  }

  const invoice = await resolveInvoiceByAsaasReference(normalizedReference);
  if (!invoice || isPaidInvoice(invoice)) {
    return;
  }

  await applyPaidInvoiceEffects(invoice, paymentStatus || event || "RECEIVED");
};

const processEfiWebhook = async (req: Request): Promise<void> => {
  const config = await GetGlobalConfig();
  const {
    efiClientId,
    efiClientSecret,
    efiCertificate,
    efiCertificatePassphrase,
    efiSandbox
  } = config;

  if (!efiClientId || !efiClientSecret || !efiCertificate) {
    return;
  }

  const pixList = req.body?.pix;
  if (!Array.isArray(pixList) || pixList.length === 0) {
    return;
  }

  const httpsAgent = buildEfiHttpsAgent(efiCertificate, efiCertificatePassphrase);
  const accessToken = await getEfiAccessToken({
    clientId: efiClientId,
    clientSecret: efiClientSecret,
    certificateBase64: efiCertificate,
    passphrase: efiCertificatePassphrase,
    sandbox: efiSandbox
  });
  const baseUrl = getEfiBaseUrl(efiSandbox);

  for (const pixItem of pixList) {
    const txid = String(pixItem?.txid || "");
    if (!txid) continue;

    // Nunca confia cegamente no payload — reconsulta o status oficial,
    // no mesmo padrão já usado pelo Mercado Pago.
    const cobDetailsResponse = await axios.get(`${baseUrl}/v2/cob/${txid}`, {
      httpsAgent,
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (String(cobDetailsResponse?.data?.status || "").toUpperCase() !== "CONCLUIDA") {
      continue;
    }

    const invoice = await Invoices.findOne({ where: { externalPaymentId: txid } });
    if (!invoice || isPaidInvoice(invoice)) {
      console.warn(`[EFI webhook] fatura não encontrada para txid ${txid}`);
      continue;
    }

    await applyPaidInvoiceEffects(invoice, "CONCLUIDA");
  }
};

const processPushinPayWebhook = async (req: Request): Promise<void> => {
  const config = await GetGlobalConfig();
  const pushinPayToken = String(config.pushinPayToken || "").trim();
  if (!pushinPayToken) {
    return;
  }

  const externalId = String(req.body?.id || "");
  if (!externalId) {
    return;
  }

  // Reconsulta obrigatória — não confia no status vindo do payload do webhook.
  const detailsResponse = await axios.get(
    `${PUSHINPAY_BASE_URL}/api/transactions/${externalId}`,
    { headers: { Authorization: `Bearer ${pushinPayToken}` } }
  );

  const status = String(detailsResponse?.data?.status || "").toLowerCase();
  if (status !== "paid") {
    return;
  }

  const invoice = await Invoices.findOne({ where: { externalPaymentId: externalId } });
  if (!invoice || isPaidInvoice(invoice)) {
    console.warn(`[PushinPay webhook] fatura não encontrada para id ${externalId}`);
    return;
  }

  await applyPaidInvoiceEffects(invoice, "CONCLUIDA");
};

// Webhook de pagamento (Mercado Pago, Asaas, EFI e Pushin Pay)
export const webhook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const params = req.params || {};
    const type = String(params.type || "").toLowerCase();
    const hasAsaasSignature = Boolean(req.headers["asaas-access-token"]);
    const hasAsaasEvent = Boolean(req.body?.event || req.body?.payment?.id);
    const hasEfiPixArray = Array.isArray(req.body?.pix);

    if (type === "asaas" || hasAsaasSignature || hasAsaasEvent) {
      await processAsaasWebhook(req);
    } else if (type === "efi" || hasEfiPixArray) {
      await processEfiWebhook(req);
    } else if (type === "pushinpay") {
      await processPushinPayWebhook(req);
    } else {
      await processMercadoPagoWebhook(req);
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Erro ao processar pagamento.", 400);
  }
};

export const createWebhook = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  const baseUrl = `${process.env.BACKEND_URL}/subscription/webhook`;

  return res.json({
    ok: true,
    webhookUrl: baseUrl,
    webhookUrls: {
      mercadoPago: baseUrl,
      asaas: `${baseUrl}/asaas`,
      efi: `${baseUrl}/efi`,
      pushinPay: `${baseUrl}/pushinpay`
    }
  });
};
