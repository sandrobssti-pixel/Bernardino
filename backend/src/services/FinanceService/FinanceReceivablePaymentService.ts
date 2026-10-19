import AppError from "../../errors/AppError";
import FinanceReceivable from "../../models/FinanceReceivable";
import FinanceCustomer from "../../models/FinanceCustomer";
import FinancePaymentConfig from "../../models/FinancePaymentConfig";
import * as FinancePaymentConfigService from "./FinancePaymentConfigService";
import * as MercadoPagoGatewayService from "./MercadoPagoGatewayService";
import * as AsaasGatewayService from "./AsaasGatewayService";
import type { MercadoPagoChargeResult } from "./MercadoPagoGatewayService";
import type { AsaasChargeResult } from "./AsaasGatewayService";

// Orquestra "gerar cobrança" numa Conta a Receber via gateway configurado —
// Mercado Pago (Fase 1) e Asaas (Fase 2) ligam/desligam DE FORMA
// INDEPENDENTE (`mercadoPagoEnabled`/`asaasEnabled`, v2.3.158 — pedido do
// cliente: "cada painel fica exclusivo para cada banco", sem um seletor só
// decidindo "o ativo" pro sistema inteiro). Os dois podem estar ligados ao
// mesmo tempo — quem gera a cobrança escolhe qual usar nessa hora
// (`provider`, vindo do botão clicado no frontend); se só um estiver
// ligado, usa esse direto sem precisar escolher. Cada cobrança grava o
// `paymentProvider` usado NA HORA — trocar a configuração depois não muda
// cobranças já geradas (o webhook de cada gateway só processa quem casa o
// próprio nome). Ver docs/MANUAL_TECNICO.md.
const loadReceivableWithCustomer = async (
  id: string | number,
  companyId: number
): Promise<{ receivable: FinanceReceivable; customer: FinanceCustomer }> => {
  const receivable = await FinanceReceivable.findOne({ where: { id, companyId } });
  if (!receivable) {
    throw new AppError("ERR_FINANCE_RECEIVABLE_NOT_FOUND", 404);
  }
  if (!receivable.customerId) {
    throw new AppError("ERR_FINANCE_PAYMENT_NO_CUSTOMER", 400);
  }
  const customer = await FinanceCustomer.findOne({
    where: { id: receivable.customerId, companyId }
  });
  if (!customer) {
    throw new AppError("ERR_FINANCE_PAYMENT_NO_CUSTOMER", 400);
  }
  if (Number(receivable.value) <= 0) {
    throw new AppError("ERR_FINANCE_PAYMENT_INVALID_VALUE", 400);
  }
  return { receivable, customer };
};

// Decide qual gateway usar nesta cobrança: respeita o que o frontend pediu
// (`requestedProvider`, do botão clicado), desde que esse gateway esteja
// ligado; sem pedido explícito, só resolve sozinho quando exatamente UM
// gateway está ligado (não adivinha entre dois ligados — exige escolha
// explícita do frontend nesse caso, ver ERR_FINANCE_PAYMENT_PROVIDER_REQUIRED).
const resolveProvider = (config: FinancePaymentConfig, requestedProvider?: string): string => {
  const mercadoPagoEnabled = !!config.mercadoPagoEnabled;
  const asaasEnabled = !!config.asaasEnabled;

  if (requestedProvider === "mercadopago" || requestedProvider === "asaas") {
    const enabled = requestedProvider === "mercadopago" ? mercadoPagoEnabled : asaasEnabled;
    if (!enabled) {
      throw new AppError("ERR_FINANCE_PAYMENT_GATEWAY_NOT_CONFIGURED", 400);
    }
    return requestedProvider;
  }

  if (mercadoPagoEnabled && !asaasEnabled) return "mercadopago";
  if (asaasEnabled && !mercadoPagoEnabled) return "asaas";
  if (mercadoPagoEnabled && asaasEnabled) {
    throw new AppError("ERR_FINANCE_PAYMENT_PROVIDER_REQUIRED", 400);
  }
  throw new AppError("ERR_FINANCE_PAYMENT_GATEWAY_NOT_CONFIGURED", 400);
};

const applyChargeResult = async (
  receivable: FinanceReceivable,
  provider: string,
  result: MercadoPagoChargeResult | AsaasChargeResult
): Promise<FinanceReceivable> => {
  await receivable.update({
    paymentProvider: provider,
    paymentExternalId: result.externalId,
    paymentStatus: result.status,
    pixQrCode: result.pixQrCode,
    pixQrCodeBase64: result.pixQrCodeBase64,
    pixExpiresAt: result.pixExpiresAt,
    boletoUrl: result.boletoUrl
  });
  return receivable;
};

export const generatePixCharge = async (
  id: string | number,
  companyId: number,
  requestedProvider?: string
): Promise<FinanceReceivable> => {
  const { receivable, customer } = await loadReceivableWithCustomer(id, companyId);
  const config = await FinancePaymentConfigService.show(companyId);
  const provider = resolveProvider(config, requestedProvider);

  if (provider === "asaas") {
    if (!AsaasGatewayService.isConfigured(config)) {
      throw new AppError("ERR_FINANCE_PAYMENT_GATEWAY_NOT_CONFIGURED", 400);
    }
    const result = await AsaasGatewayService.createPixCharge(receivable, customer, config);
    return applyChargeResult(receivable, "asaas", result);
  }

  if (!MercadoPagoGatewayService.isConfigured(config)) {
    throw new AppError("ERR_FINANCE_PAYMENT_GATEWAY_NOT_CONFIGURED", 400);
  }
  const result = await MercadoPagoGatewayService.createPixCharge(receivable, customer, config);
  return applyChargeResult(receivable, "mercadopago", result);
};

export const generateBoletoCharge = async (
  id: string | number,
  companyId: number,
  requestedProvider?: string
): Promise<FinanceReceivable> => {
  const { receivable, customer } = await loadReceivableWithCustomer(id, companyId);
  const config = await FinancePaymentConfigService.show(companyId);
  const provider = resolveProvider(config, requestedProvider);

  if (provider === "asaas") {
    if (!AsaasGatewayService.isConfigured(config)) {
      throw new AppError("ERR_FINANCE_PAYMENT_GATEWAY_NOT_CONFIGURED", 400);
    }
    const result = await AsaasGatewayService.createBoletoCharge(receivable, customer, config);
    return applyChargeResult(receivable, "asaas", result);
  }

  if (!MercadoPagoGatewayService.isConfigured(config)) {
    throw new AppError("ERR_FINANCE_PAYMENT_GATEWAY_NOT_CONFIGURED", 400);
  }
  const result = await MercadoPagoGatewayService.createBoletoCharge(receivable, customer, config);
  return applyChargeResult(receivable, "mercadopago", result);
};

// Chamado pelo webhook do Mercado Pago (PaymentWebhookController.mercadoPago)
// — NUNCA confia no corpo da notificação pra decidir se foi pago: usa só o
// `data.id` pra buscar o status de verdade na API do Mercado Pago
// (`getPayment`), com o token desta empresa, e casa pelo
// `paymentExternalId` já gravado (não pelo id da notificação sozinho, que
// pode não bater com nenhuma conta nossa — webhook de outra cobrança da
// mesma conta Mercado Pago, por exemplo).
export const handleMercadoPagoWebhook = async (
  companyId: number,
  dataId: string
): Promise<void> => {
  const config = await FinancePaymentConfigService.show(companyId);
  if (!MercadoPagoGatewayService.isConfigured(config)) return;

  const receivable = await FinanceReceivable.findOne({
    where: { companyId, paymentProvider: "mercadopago", paymentExternalId: String(dataId) }
  });
  if (!receivable) return;

  const result = await MercadoPagoGatewayService.getPayment(dataId, config);

  const updates: Record<string, unknown> = { paymentStatus: result.status };
  if (result.status === "approved" && receivable.status !== "received") {
    updates.status = "received";
    updates.receivedDate = new Date();
  }
  await receivable.update(updates);
};

// Mesma lógica do Mercado Pago acima, mas pro Asaas: rebusca o pagamento
// de verdade (`getPayment`) em vez de confiar no `payment.status` que já
// vem no corpo do webhook — mesmo princípio de segurança, dois gateways
// diferentes.
export const handleAsaasWebhook = async (
  companyId: number,
  paymentId: string
): Promise<void> => {
  const config = await FinancePaymentConfigService.show(companyId);
  if (!AsaasGatewayService.isConfigured(config)) return;

  const receivable = await FinanceReceivable.findOne({
    where: { companyId, paymentProvider: "asaas", paymentExternalId: String(paymentId) }
  });
  if (!receivable) return;

  const result = await AsaasGatewayService.getPayment(paymentId, config);

  const updates: Record<string, unknown> = { paymentStatus: result.status };
  if (AsaasGatewayService.isPaidStatus(result.status) && receivable.status !== "received") {
    updates.status = "received";
    updates.receivedDate = new Date();
  }
  await receivable.update(updates);
};
