import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";
import archiver from "archiver";
import { Op } from "sequelize";
import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import AppError from "../../errors/AppError";
import FiscalDocument from "../../models/FiscalDocument";
import FiscalDocumentEmailLog from "../../models/FiscalDocumentEmailLog";
import Company from "../../models/Company";
import Sale from "../../models/Sale";
import FinanceCustomer from "../../models/FinanceCustomer";
import User from "../../models/User";
import * as SaleService from "./SaleService";
import * as FiscalConfigService from "./FiscalConfigService";
import * as FiscalGatewayService from "./FiscalGatewayService";
import * as ResendEmailService from "./ResendEmailService";
import { BASE_URL_SANDBOX, BASE_URL_PRODUCTION } from "./FocusNFeService";

const VALID_TYPES = ["nfe", "nfce", "nfse"];

// `pdfUrl`/`xmlUrl` são salvos como CAMINHO relativo (o jeito que a Focus
// devolve, ver FocusNFeService.ts) — resolvidos pra URL absoluta só aqui,
// na hora de servir pro frontend (não no momento de salvar), porque assim
// conserta também documentos já emitidos ANTES dessa correção existir
// (v2.3.131), sem precisar de migração/backfill: usa o `environment`
// ("sandbox"/"production") que já é gravado em todo FiscalDocument desde a
// v2.3.125. Idempotente — se já vier URL completa (gateway diferente no
// futuro, ou já resolvido antes), devolve sem mexer.
const resolveDocumentUrls = (document: FiscalDocument): FiscalDocument => {
  const baseURL = document.environment === "production" ? BASE_URL_PRODUCTION : BASE_URL_SANDBOX;
  const resolve = (path: string): string => {
    if (!path || /^https?:\/\//i.test(path)) return path;
    return `${baseURL}${path.startsWith("/") ? "" : "/"}${path}`;
  };

  document.pdfUrl = resolve(document.pdfUrl);
  document.xmlUrl = resolve(document.xmlUrl);
  return document;
};

export const list = async (saleId: string | number, companyId: number): Promise<FiscalDocument[]> => {
  // Garante que a venda pertence à empresa antes de listar os documentos
  // dela (reaproveita o `show` do SaleService, que já filtra por companyId).
  await SaleService.show(saleId, companyId);

  const documents = await FiscalDocument.findAll({
    where: { saleId, companyId },
    order: [["id", "DESC"]]
  });

  return documents.map(resolveDocumentUrls);
};

export const show = async (id: string | number, companyId: number): Promise<FiscalDocument> => {
  const document = await FiscalDocument.findOne({ where: { id, companyId } });

  if (!document) {
    throw new AppError("ERR_FISCAL_DOCUMENT_NOT_FOUND", 404);
  }

  return resolveDocumentUrls(document);
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

  // Trava emissão duplicada (v2.3.215) — bug real em produção: nada aqui
  // impedia clicar "Emitir nota" de novo (reabrindo a tela/duplo clique)
  // depois que a venda já tinha uma nota real saída, e o gateway não tem
  // ideia nenhuma de "essa venda já tem nota" — ele só emite o que
  // mandamos. Resultado: duas NF-e's de verdade, autorizadas pela Sefaz,
  // pra uma venda de arma com só 1 unidade em estoque (notas 505/506,
  // mesmo item, mesmo destinatário). Mesma checagem/mesmo erro que
  // `SaleService.assertSaleEditable` já usa pra bloquear EDITAR a venda
  // com nota real — aqui bloqueia EMITIR outra nota, pelo mesmo motivo.
  const hasRealFiscalDocument = (sale.fiscalDocuments || []).some(doc =>
    ["authorized", "processing"].includes(doc.status)
  );
  if (hasRealFiscalDocument) {
    throw new AppError("ERR_SALE_HAS_FISCAL_DOCUMENT");
  }

  const config = await FiscalConfigService.show(companyId);

  if (!FiscalConfigService.getActiveGatewayToken(config)) {
    throw new AppError("ERR_FISCAL_GATEWAY_NOT_CONFIGURED");
  }

  const company = await Company.findByPk(companyId);
  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const gateway = FiscalGatewayService.getGateway(config.gatewayProvider);
  const { externalRef, result } = await gateway.emit(type, sale, company, config);

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
    raw: result.raw,
    issuedAt: result.status === "authorized" ? new Date() : null,
    environment: FiscalConfigService.isProductionActive(config) ? "production" : "sandbox",
    saleId: sale.id,
    companyId
  } as any);

  // Pedido do cliente (Etapa 2, v2.3.207): a arma só sai de verdade do
  // estoque disponível quando a nota é REALMENTE autorizada pelo
  // gateway — não antes (ver SaleService.markWeaponUnitsSold e seção
  // 186 do manual técnico). Gateway síncrono (já volta "authorized"
  // aqui) cai nesse caminho; gateway assíncrono ("processing") só marca
  // depois, em `refreshStatus`.
  if (document.status === "authorized") {
    await SaleService.markWeaponUnitsSold(sale.id, companyId);
    await SaleService.markAmmoVolumesSold(sale.id, companyId);
  }

  return document;
};

// Exclui de verdade um documento de Homologação (teste) sempre; em Produção,
// só quando a tentativa NUNCA chegou a virar uma nota fiscal de verdade
// ("error"/"pending_correction" — nunca ganharam chave de acesso real na
// Sefaz). Uma nota "authorized"/"processing"/"cancelled" em Produção tem
// (ou pode vir a ter) existência legal — cancelar, não excluir, é o caminho
// pra essas (ver `cancel` acima). Bug corrigido aqui (v2.3.183): antes
// bloqueava qualquer documento de Produção, mesmo um que falhou ("nota sem
// valor fiscal") e nunca teve chave de acesso gerada — o aviso de "não vai
// poder excluir" saía igual pra uma tentativa falha e pra uma nota de
// verdade, confundindo o usuário.
const BLOCKS_DELETE_IN_PRODUCTION = new Set(["authorized", "processing", "cancelled"]);

export const remove = async (id: string | number, companyId: number): Promise<void> => {
  const document = await show(id, companyId);

  if (document.environment === "production" && BLOCKS_DELETE_IN_PRODUCTION.has(document.status)) {
    throw new AppError("ERR_FISCAL_DOCUMENT_CANNOT_DELETE_PRODUCTION");
  }

  await document.destroy();
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
  const gateway = FiscalGatewayService.getGateway(config.gatewayProvider);
  const result = await gateway.getStatus(document.type, document.externalRef, config);

  await document.update({
    status: result.status,
    number: result.number || document.number,
    series: result.series || document.series,
    accessKey: result.accessKey || document.accessKey,
    xmlUrl: result.xmlUrl || document.xmlUrl,
    pdfUrl: result.pdfUrl || document.pdfUrl,
    errorMessage: result.errorMessage,
    raw: result.raw || document.raw,
    issuedAt: result.status === "authorized" ? new Date() : document.issuedAt
  });

  // Mesmo gancho de `emit` acima, pro caminho assíncrono (nota ficou
  // "processing" na emissão e só agora, reconsultada, vira "authorized"
  // de verdade).
  if (result.status === "authorized") {
    await SaleService.markWeaponUnitsSold(document.saleId, companyId);
    await SaleService.markAmmoVolumesSold(document.saleId, companyId);
  }

  return document;
};

// Marca/desmarca uma nota com erro como "pendente de correção" (v2.3.166)
// — pedido do cliente pra ter um terceiro estado visual (amarelo) além de
// autorizada (verde) e erro (vermelho): depois de ver o erro, o usuário
// marca a nota como "vou corrigir a venda antes de tentar de novo", pra
// distinguir visualmente das notas com erro ainda não olhadas. É só uma
// anotação manual — reemitir de verdade (`emit`, acima) sempre cria um
// FiscalDocument NOVO (nunca reaproveita este registro), então marcar/
// desmarcar aqui não desfaz nem repete nenhuma chamada ao gateway.
export const togglePendingCorrection = async (
  id: string | number,
  companyId: number
): Promise<FiscalDocument> => {
  const document = await show(id, companyId);

  if (document.status === "error") {
    await document.update({ status: "pending_correction" });
  } else if (document.status === "pending_correction") {
    await document.update({ status: "error" });
  } else {
    throw new AppError("ERR_FISCAL_DOCUMENT_NOT_FLAGGABLE");
  }

  return document;
};

// v2.3.189 — pedido do cliente: cancelar a nota fiscal autorizada (ex.:
// cliente desistiu da compra, dentro do prazo que a Sefaz permite) agora
// também cancela a VENDA ligada por baixo — devolve estoque e cancela a
// conta a receber (ver `SaleService.cancel`). Antes só cancelava o
// documento fiscal, deixando a venda "confirmada" com uma nota cancelada
// por trás, exigindo cancelar a venda manualmente depois.
export const cancel = async (
  id: string | number,
  justification: string,
  companyId: number
): Promise<FiscalDocument> => {
  const document = await show(id, companyId);

  if (document.status !== "authorized") {
    throw new AppError("ERR_FISCAL_DOCUMENT_NOT_CANCELLABLE");
  }

  // Prazo de 24h pra cancelamento de NF-e (v2.3.218, pedido do cliente:
  // "cancelar venda fica disponível até 24 horas depois que gerou a
  // venda") — mesma regra geral da Sefaz pra NF-e modelo 55 (evento de
  // Cancelamento). Checado aqui ANTES de chamar o gateway (resposta mais
  // rápida, mensagem em português clara) — o gateway/Sefaz continua
  // sendo quem decide de verdade (se algum estado tiver prazo diferente
  // do padrão nacional, a chamada abaixo não seria alcançada mesmo assim
  // por causa deste bloqueio; ajustar aqui se um cliente de outro estado
  // confirmar prazo diferente). Depois do prazo, a correção vai por
  // Carta de Correção Eletrônica (quando não muda valor/imposto) — já
  // suportado por `emitCorrectionLetter` abaixo.
  if (document.issuedAt) {
    const hoursSinceIssued = (Date.now() - new Date(document.issuedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceIssued > 24) {
      throw new AppError("ERR_FISCAL_DOCUMENT_CANCEL_DEADLINE_PASSED");
    }
  }

  if (!justification || justification.trim().length < 15) {
    throw new AppError("ERR_FISCAL_DOCUMENT_JUSTIFICATION_TOO_SHORT");
  }

  const config = await FiscalConfigService.show(companyId);
  const gateway = FiscalGatewayService.getGateway(config.gatewayProvider);
  const result = await gateway.cancel(document.type, document.externalRef, justification, config);

  if (!result.ok) {
    throw new AppError(result.errorMessage || "ERR_FISCAL_DOCUMENT_CANCEL_FAILED");
  }

  await document.update({ status: "cancelled" });
  await SaleService.cancel(document.saleId, companyId, true);
  return document;
};

// Carta de Correção — só pra documento já autorizado, e só NF-e (a Focus
// NFe não tem CC-e pra NFC-e/NFS-e).
export const emitCorrectionLetter = async (
  id: string | number,
  correctionText: string,
  companyId: number
): Promise<{ ok: boolean; errorMessage: string }> => {
  const document = await show(id, companyId);

  if (document.status !== "authorized") {
    throw new AppError("ERR_FISCAL_DOCUMENT_NOT_AUTHORIZED");
  }
  if (!correctionText || correctionText.trim().length < 15) {
    throw new AppError("ERR_FISCAL_CORRECTION_TEXT_TOO_SHORT");
  }

  const config = await FiscalConfigService.show(companyId);
  const gateway = FiscalGatewayService.getGateway(config.gatewayProvider);
  const fn = FiscalGatewayService.requireFeature(gateway, "emitCorrectionLetter");
  return fn(document.type, document.externalRef, correctionText, config);
};

// E-mail "razoável" — não precisa validar domínio/MX de verdade, só
// barrar erro de digitação óbvio antes de gastar uma tentativa de envio
// (e um registro de auditoria) com algo que claramente não é e-mail.
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// v2.3.190 — pedido do cliente: toda tentativa de (re)envio de nota por
// e-mail fica registrada em FiscalDocumentEmailLog (quem pediu, quando,
// pra qual(is) e-mail(s), se deu certo) — antes não ficava rastro
// nenhum. `requestedByUserId` vem do controller (`req.user.id`) — opcional
// porque pode não existir um usuário humano por trás no futuro (ex.: um
// reenvio automático), mas hoje sempre vem de um clique na tela.
export const sendByEmail = async (
  id: string | number,
  emails: string[],
  companyId: number,
  requestedByUserId?: number
): Promise<{ ok: boolean; errorMessage: string }> => {
  const document = await show(id, companyId);

  if (document.status !== "authorized") {
    throw new AppError("ERR_FISCAL_DOCUMENT_NOT_AUTHORIZED");
  }
  if (!emails || emails.length === 0) {
    throw new AppError("ERR_FISCAL_DOCUMENT_EMAIL_REQUIRED");
  }
  const invalidEmails = emails.filter(email => !EMAIL_FORMAT.test(email.trim()));
  if (invalidEmails.length > 0) {
    throw new AppError("ERR_FISCAL_DOCUMENT_EMAIL_INVALID");
  }

  const config = await FiscalConfigService.show(companyId);

  // Resend (v2.3.173) — quando habilitado, o AtendeFlow manda o e-mail
  // ele mesmo (baixa o PDF e anexa), em vez de pedir pro gateway fiscal
  // (Focus NFe) mandar. Ver ResendEmailService.ts.
  const result = config.resendEnabled
    ? await (async () => {
        const company = await Company.findByPk(companyId);
        return ResendEmailService.sendDocumentEmail(
          config,
          { type: document.type, number: document.number, pdfUrl: document.pdfUrl },
          company?.name || "",
          emails
        );
      })()
    : await (async () => {
        const gateway = FiscalGatewayService.getGateway(config.gatewayProvider);
        const fn = FiscalGatewayService.requireFeature(gateway, "sendByEmail");
        return fn(document.type, document.externalRef, emails, config);
      })();

  await FiscalDocumentEmailLog.create({
    emails: emails.join(", "),
    success: result.ok,
    errorMessage: result.ok ? "" : result.errorMessage || "",
    fiscalDocumentId: document.id,
    requestedByUserId: requestedByUserId || null,
    companyId
  } as any);

  return result;
};

export const listEmailLogs = async (
  id: string | number,
  companyId: number
): Promise<FiscalDocumentEmailLog[]> => {
  await show(id, companyId);

  return FiscalDocumentEmailLog.findAll({
    where: { fiscalDocumentId: id, companyId },
    include: [{ model: User, as: "requestedByUser", attributes: ["id", "name"] }],
    order: [["id", "DESC"]]
  });
};

// Pré-visualização do DANFe (PDF) antes de confirmar a venda/emitir de
// verdade — não cria FiscalDocument nenhum, só devolve o binário. Funciona
// com a venda ainda em rascunho (é justamente pra conferir antes de
// confirmar), diferente de `emit` que exige venda confirmada.
// ⚠️ Em Produção continua DESATIVADO (v2.3.185) — o cliente confirmou,
// com uma nota real, que clicar SÓ em "Pré-visualizar DANFe" (nunca em
// "Emitir") resultou numa nota de verdade autorizada pela Sefaz (nota
// 498). Dois problemas de código foram corrigidos na v2.3.186 (header
// `Accept: application/pdf` faltando e `tipo_documento` como string em
// vez de número — ver FocusNFeService.previewDanfe), mas NENHUM dos dois
// explica, sozinho, como um endpoint que a própria Focus NFe documenta
// como "não possui valor fiscal" causou uma autenticação real — por
// isso a função só é religada aqui para Homologação (sandbox), onde uma
// autenticação real não tem consequência nenhuma pro cliente. Em
// Produção continua bloqueado no backend (não só escondido no frontend)
// até o cliente confirmar um teste limpo em Homologação.
export const previewDanfe = async (
  saleId: string | number,
  companyId: number
): Promise<{ ok: boolean; pdf: Buffer | null; errorMessage: string }> => {
  const config = await FiscalConfigService.show(companyId);

  if (FiscalConfigService.isProductionActive(config)) {
    throw new AppError("ERR_FISCAL_PREVIEW_DISABLED", 410);
  }

  if (!FiscalConfigService.getActiveGatewayToken(config)) {
    throw new AppError("ERR_FISCAL_GATEWAY_NOT_CONFIGURED");
  }

  const sale = await SaleService.show(saleId, companyId);
  const company = await Company.findByPk(companyId);
  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const gateway = FiscalGatewayService.getGateway(config.gatewayProvider);
  const fn = FiscalGatewayService.requireFeature(gateway, "previewDanfe");
  return fn(sale, company, config);
};

// Carimbo diagonal "CANCELADA" (v2.3.220, pedido do cliente) — o PDF que
// a Focus NFe devolve (`pdfUrl`) é sempre o DANFE "original", igual pra
// uma nota autorizada ou já cancelada; nada no documento em si avisa
// visualmente que foi cancelada (só o `status` que este sistema guarda).
// Carimbado aqui, no nosso próprio PDF servido pro download — não muda o
// documento na Focus NFe nem o XML autorizado, só o PDF que a gente
// entrega pro operador baixar/imprimir, pra não confundir com uma nota
// válida. `pdf-lib` escolhido por não ter dependência nativa (roda igual
// dentro do container Docker, sem precisar instalar nada a mais no
// Dockerfile).
const stampCancelled = async (pdfBytes: Buffer): Promise<Buffer> => {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const text = "CANCELADA";
  const size = 70;

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: width / 2 - textWidth / 2,
      y: height / 2,
      size,
      font,
      color: rgb(0.8, 0.1, 0.1),
      opacity: 0.35,
      rotate: degrees(45)
    });
  }

  return Buffer.from(await pdfDoc.save());
};

// Baixa o PDF de verdade (proxy pelo próprio backend, não um redirect pra
// Focus NFe) — necessário pra poder carimbar "CANCELADA" antes de
// entregar, quando for o caso. Documento sem `pdfUrl` ainda (processando/
// erro) não tem o que baixar.
export const getPdf = async (id: string | number, companyId: number): Promise<Buffer> => {
  const document = await show(id, companyId);

  if (!document.pdfUrl) {
    throw new AppError("ERR_FISCAL_DOCUMENT_PDF_NOT_AVAILABLE");
  }

  const response = await axios.get(document.pdfUrl, { responseType: "arraybuffer" });
  const pdfBytes = Buffer.from(response.data);

  return document.status === "cancelled" ? stampCancelled(pdfBytes) : pdfBytes;
};

// Nome de arquivo seguro — troca qualquer caractere que não seja
// letra/número/espaço/hífen por "_" (evita barra, acento mal-codificado
// etc. quebrando o zip em algum SO).
const safeFileName = (value: string): string =>
  (value || "").replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "-").slice(0, 60) || "nota";

// Exporta em ZIP todas as notas AUTORIZADAS de um período (v2.3.220,
// pedido do cliente: "preciso de um filtro pra baixar PDF e XML por
// período, pois no final do mês tem que mandar pra contabilidade gerar
// o DARF do Simples Nacional"). Filtra por `issuedAt` (quando a nota foi
// autorizada de verdade pela Sefaz), não por `saleDate` — é a data que
// importa pra apuração de imposto, pode divergir da data da venda em si.
// Só nota AUTORIZADA entra (cancelada não é receita, não deveria entrar
// no DARF) — mesmo padrão de zip+tempdir já usado em
// `FlowExportController.ts`.
export const exportPeriodZip = async (
  startDate: string,
  endDate: string,
  format: "pdf" | "xml" | "both",
  companyId: number
): Promise<{ zipPath: string; fileName: string }> => {
  const documents = await FiscalDocument.findAll({
    where: {
      companyId,
      status: "authorized",
      issuedAt: {
        [Op.gte]: new Date(`${startDate}T00:00:00`),
        [Op.lte]: new Date(`${endDate}T23:59:59`)
      }
    },
    include: [{ model: Sale, as: "sale", include: [{ model: FinanceCustomer, as: "customer" }] }],
    order: [["issuedAt", "ASC"]]
  });

  if (documents.length === 0) {
    throw new AppError("ERR_FISCAL_NO_DOCUMENTS_IN_PERIOD");
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fiscal-export-"));

  try {
    for (const rawDoc of documents) {
      const doc = resolveDocumentUrls(rawDoc);
      const customerName = (doc as any).sale?.customer?.name || "consumidor";
      const baseName = `NFe-${doc.number || doc.id}-${safeFileName(customerName)}`;

      if ((format === "pdf" || format === "both") && doc.pdfUrl) {
        const response = await axios.get(doc.pdfUrl, { responseType: "arraybuffer" });
        fs.writeFileSync(path.join(tempDir, `${baseName}.pdf`), Buffer.from(response.data));
      }
      if ((format === "xml" || format === "both") && doc.xmlUrl) {
        const response = await axios.get(doc.xmlUrl, { responseType: "arraybuffer" });
        fs.writeFileSync(path.join(tempDir, `${baseName}.xml`), Buffer.from(response.data));
      }
    }

    const zipFileName = `notas-fiscais-${startDate}-a-${endDate}.zip`;
    const zipPath = path.join(os.tmpdir(), `fiscal-export-${companyId}-${Date.now()}.zip`);

    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });
      output.on("close", () => resolve());
      archive.on("error", (err) => reject(err));
      archive.pipe(output);
      archive.directory(tempDir, false);
      archive.finalize();
    });

    return { zipPath, fileName: zipFileName };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};
