import { Request, Response } from "express";
import logger from "../utils/logger";
import * as FinancePaymentConfigService from "../services/FinanceService/FinancePaymentConfigService";
import * as MercadoPagoGatewayService from "../services/FinanceService/MercadoPagoGatewayService";
import * as AsaasGatewayService from "../services/FinanceService/AsaasGatewayService";
import * as FinanceReceivablePaymentService from "../services/FinanceService/FinanceReceivablePaymentService";

// Webhook do Mercado Pago, um por empresa (`/webhook/mercadopago/:companyId`
// — mesmo padrão de MetaWebhookController, URL própria configurada no
// painel de cada empresa em vez de resolver a empresa a partir do corpo da
// notificação, que não traz esse dado). Responde 200 rápido (igual
// MetaWebhookController) e processa depois — o Mercado Pago reenvia a
// notificação se não receber 200 a tempo. NUNCA confia no corpo da
// notificação pra marcar como pago: `handleMercadoPagoWebhook` sempre
// rebusca o status na API deles antes de mudar qualquer coisa. Ver
// docs/MANUAL_TECNICO.md.
export const mercadoPago = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.params;
  res.status(200).json({ received: true });

  try {
    const dataId = String(req.body?.data?.id || req.query["data.id"] || req.query.id || "");
    if (!dataId) {
      return res;
    }

    const config = await FinancePaymentConfigService.show(Number(companyId));
    const signatureValid = MercadoPagoGatewayService.verifyWebhookSignature(
      req.headers["x-signature"] as string | undefined,
      req.headers["x-request-id"] as string | undefined,
      dataId,
      config.mercadoPagoWebhookSecret
    );

    if (!signatureValid) {
      logger.warn(
        `[MERCADOPAGO_WEBHOOK] assinatura inválida | companyId=${companyId} | dataId=${dataId}`
      );
      return res;
    }

    await FinanceReceivablePaymentService.handleMercadoPagoWebhook(Number(companyId), dataId);
    logger.info(`[MERCADOPAGO_WEBHOOK] processado | companyId=${companyId} | dataId=${dataId}`);
  } catch (error) {
    logger.error("[MERCADOPAGO_WEBHOOK] erro ao processar notificação", error);
  }

  return res;
};

// Webhook do Asaas, um por empresa (`/webhook/asaas/:companyId`). Formato
// bem diferente do Mercado Pago: o Asaas não assina o corpo (sem HMAC) —
// valida por um token fixo reenviado no header `asaas-access-token`,
// configurado igual nos dois lados (painel deles + Configuração de
// Pagamento aqui). Mesmo princípio de segurança do Mercado Pago: NUNCA usa
// o `payment.status` que já vem no corpo pra marcar como pago, sempre
// rebusca na API deles antes (ver FinanceReceivablePaymentService.handleAsaasWebhook).
export const asaas = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.params;
  res.status(200).json({ received: true });

  try {
    const paymentId = String(req.body?.payment?.id || "");
    if (!paymentId) {
      return res;
    }

    const config = await FinancePaymentConfigService.show(Number(companyId));
    const tokenValid = AsaasGatewayService.verifyWebhookToken(
      req.headers["asaas-access-token"] as string | undefined,
      config.asaasWebhookToken
    );

    if (!tokenValid) {
      logger.warn(`[ASAAS_WEBHOOK] token inválido | companyId=${companyId} | paymentId=${paymentId}`);
      return res;
    }

    await FinanceReceivablePaymentService.handleAsaasWebhook(Number(companyId), paymentId);
    logger.info(`[ASAAS_WEBHOOK] processado | companyId=${companyId} | paymentId=${paymentId}`);
  } catch (error) {
    logger.error("[ASAAS_WEBHOOK] erro ao processar notificação", error);
  }

  return res;
};
