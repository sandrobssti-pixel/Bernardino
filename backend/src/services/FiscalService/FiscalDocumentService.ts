import AppError from "../../errors/AppError";
import FiscalDocument from "../../models/FiscalDocument";
import Company from "../../models/Company";
import * as SaleService from "./SaleService";
import * as FiscalConfigService from "./FiscalConfigService";
import * as FocusNFeService from "./FocusNFeService";

const VALID_TYPES = ["nfe", "nfce", "nfse"];

export const list = async (saleId: string | number, companyId: number): Promise<FiscalDocument[]> => {
  // Garante que a venda pertence à empresa antes de listar os documentos
  // dela (reaproveita o `show` do SaleService, que já filtra por companyId).
  await SaleService.show(saleId, companyId);

  return FiscalDocument.findAll({
    where: { saleId, companyId },
    order: [["id", "DESC"]]
  });
};

export const show = async (id: string | number, companyId: number): Promise<FiscalDocument> => {
  const document = await FiscalDocument.findOne({ where: { id, companyId } });

  if (!document) {
    throw new AppError("ERR_FISCAL_DOCUMENT_NOT_FOUND", 404);
  }

  return document;
};

// Emite um documento fiscal pra uma venda confirmada. A venda precisa estar
// "confirmed" (não "draft") — nota fiscal reflete uma venda fechada, não um
// rascunho que ainda pode mudar.
export const emit = async (
  saleId: string | number,
  type: string,
  companyId: number
): Promise<FiscalDocument> => {
  if (!VALID_TYPES.includes(type)) {
    throw new AppError("ERR_FISCAL_DOCUMENT_INVALID_TYPE");
  }

  const sale = await SaleService.show(saleId, companyId);

  if (sale.status !== "confirmed") {
    throw new AppError("ERR_SALE_NOT_CONFIRMED");
  }

  const config = await FiscalConfigService.show(companyId);

  if (!config.gatewayToken) {
    throw new AppError("ERR_FISCAL_GATEWAY_NOT_CONFIGURED");
  }

  const company = await Company.findByPk(companyId);
  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const { externalRef, result } = await FocusNFeService.emit(type, sale, company, config);

  const document = await FiscalDocument.create({
    type,
    status: result.status,
    externalRef,
    number: result.number,
    series: result.series,
    accessKey: result.accessKey,
    xmlUrl: result.xmlUrl,
    pdfUrl: result.pdfUrl,
    errorMessage: result.errorMessage,
    issuedAt: result.status === "authorized" ? new Date() : null,
    saleId: sale.id,
    companyId
  } as any);

  return document;
};

// Reconsulta o status de um documento que ficou "processing" — a emissão na
// Focus NFe é assíncrona, então uma nota pode levar alguns segundos pra sair
// desse estado.
export const refreshStatus = async (
  id: string | number,
  companyId: number
): Promise<FiscalDocument> => {
  const document = await show(id, companyId);

  if (document.status !== "processing") {
    return document;
  }

  const config = await FiscalConfigService.show(companyId);
  const result = await FocusNFeService.getStatus(document.type, document.externalRef, config);

  await document.update({
    status: result.status,
    number: result.number || document.number,
    series: result.series || document.series,
    accessKey: result.accessKey || document.accessKey,
    xmlUrl: result.xmlUrl || document.xmlUrl,
    pdfUrl: result.pdfUrl || document.pdfUrl,
    errorMessage: result.errorMessage,
    issuedAt: result.status === "authorized" ? new Date() : document.issuedAt
  });

  return document;
};

export const cancel = async (
  id: string | number,
  justification: string,
  companyId: number
): Promise<FiscalDocument> => {
  const document = await show(id, companyId);

  if (document.status !== "authorized") {
    throw new AppError("ERR_FISCAL_DOCUMENT_NOT_CANCELLABLE");
  }

  if (!justification || justification.trim().length < 15) {
    throw new AppError("ERR_FISCAL_DOCUMENT_JUSTIFICATION_TOO_SHORT");
  }

  const config = await FiscalConfigService.show(companyId);
  const result = await FocusNFeService.cancel(document.type, document.externalRef, justification, config);

  if (!result.ok) {
    throw new AppError(result.errorMessage || "ERR_FISCAL_DOCUMENT_CANCEL_FAILED");
  }

  await document.update({ status: "cancelled" });
  return document;
};
