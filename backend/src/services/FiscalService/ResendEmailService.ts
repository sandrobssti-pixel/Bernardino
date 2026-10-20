import axios from "axios";
import FiscalConfig from "../../models/FiscalConfig";

const DOC_TYPE_LABEL: Record<string, string> = {
  nfe: "NF-e",
  nfce: "NFC-e",
  nfse: "NFS-e"
};

// Envio de nota por e-mail via Resend (resend.com), v2.3.173 — pedido do
// cliente. Diferente do envio já existente (`FocusNFeService.sendByEmail`,
// que pede pra PRÓPRIA Focus NFe mandar o e-mail): aqui o AtendeFlow baixa
// o DANFE (PDF já resolvido em `document.pdfUrl`, ver
// FiscalDocumentService.resolveDocumentUrls) e manda ele mesmo, anexado,
// pela API da Resend — dá mais controle sobre o texto do e-mail e não
// depende da Focus NFe ter essa funcionalidade habilitada/funcionando pra
// conta do cliente.
//
// ⚠️ Nunca testado contra uma conta Resend de verdade nesta sessão (sem
// chave de API disponível aqui) — a chamada HTTP segue a documentação
// pública da Resend (POST https://api.resend.com/emails, Bearer token,
// anexos em base64 no campo `attachments[].content`). Testar com um envio
// real antes de confiar em produção.
export const sendDocumentEmail = async (
  config: FiscalConfig,
  document: { type: string; number: string; pdfUrl: string },
  companyName: string,
  emails: string[]
): Promise<{ ok: boolean; errorMessage: string }> => {
  if (!config.resendApiKey) {
    return { ok: false, errorMessage: "ERR_RESEND_API_KEY_NOT_CONFIGURED" };
  }
  if (!config.resendFromEmail) {
    return { ok: false, errorMessage: "ERR_RESEND_FROM_EMAIL_NOT_CONFIGURED" };
  }
  if (!document.pdfUrl) {
    return { ok: false, errorMessage: "ERR_FISCAL_DOCUMENT_PDF_NOT_AVAILABLE" };
  }

  let pdfBase64: string;
  try {
    const { data } = await axios.get(document.pdfUrl, { responseType: "arraybuffer" });
    pdfBase64 = Buffer.from(data).toString("base64");
  } catch (err: any) {
    return {
      ok: false,
      errorMessage: `Falha ao baixar o PDF da nota pra anexar no e-mail: ${err?.message || "erro desconhecido"}`
    };
  }

  const docLabel = DOC_TYPE_LABEL[document.type] || document.type.toUpperCase();
  const fromName = config.resendFromName || companyName;

  try {
    await axios.post(
      "https://api.resend.com/emails",
      {
        from: `${fromName} <${config.resendFromEmail}>`,
        to: emails,
        subject: `${docLabel} nº ${document.number} — ${companyName}`,
        html: `<p>Segue em anexo a ${docLabel} nº ${document.number}, emitida por ${companyName}.</p>`,
        attachments: [
          {
            filename: `${document.type}-${document.number || "documento"}.pdf`,
            content: pdfBase64
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );
    return { ok: true, errorMessage: "" };
  } catch (err: any) {
    const responseData = err?.response?.data;
    return {
      ok: false,
      errorMessage: String(responseData?.message || err?.message || "Falha ao enviar e-mail pela Resend.")
    };
  }
};
