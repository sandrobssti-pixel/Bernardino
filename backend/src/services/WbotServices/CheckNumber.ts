import AppError from "../../errors/AppError";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import { dynamicImport } from "../../utils/dynamicImport";
import logger from "../../utils/logger";
import { normalizeCampaignContactNumber } from "../../utils/normalizeCampaignContactNumber";

let baileysMod: typeof import("baileys") | null = null;
async function getBaileys() {
  if (!baileysMod) baileysMod = await dynamicImport("baileys");
  return baileysMod;
}

type OnWhatsAppResult = { jid?: string; exists?: boolean } | undefined;

const sanitize = (value: string): string =>
  String(value || "")
    .split("@")[0]
    .replace(/[^\d-]/g, "")
    .trim();

// BR: DDI(2) + DDD(2) + local(8, sem o 9) = 12 digitos; com o 9 = 13.
// Um número de 12 dígitos é ambíguo (podia ser fixo — sem WhatsApp — ou um
// celular digitado/exportado sem o 9º dígito). O WhatsApp às vezes "aceita"
// essa forma incompleta por tolerância do próprio servidor (onWhatsApp
// retorna exists=true), mas a entrega real nem sempre chega no aparelho —
// bug real relatado pelo cliente: campanha "entregue" só pra parte dos
// contatos, sem padrão aparente. Por isso a forma completa (com 9) SEMPRE
// é testada antes da incompleta, nunca o contrário — ver
// docs/MANUAL_TECNICO.md.
const addBrVariant = (n: string): string | null => {
  if (!n.startsWith("55")) return null;

  if (n.length === 12) {
    const ddi = n.substring(0, 2);
    const ddd = n.substring(2, 4);
    const local8 = n.slice(-8);
    return `${ddi}${ddd}9${local8}`;
  }

  if (n.length === 13) {
    const ddi = n.substring(0, 2);
    const ddd = n.substring(2, 4);
    const firstLocalDigit = n.substring(4, 5);
    const local8 = n.slice(-8);
    if (firstLocalDigit === "9") {
      return `${ddi}${ddd}${local8}`;
    }
  }

  return null;
};

// Só aplica a lógica do 9º dígito quando o número é (ou vira, por padrão)
// brasileiro — números com DDI de outro país (ex.: Paraguai 595, Argentina
// 54, EUA 1...) não têm esse dígito extra e são testados como vieram, sem
// tentar "converter" pra formato brasileiro (bug real: um contato do
// Paraguai — 595986283937 — não pode virar 55595986283937).
const buildCandidates = (raw: string, isGroup: boolean): string[] => {
  const cleaned = sanitize(raw);
  const candidates: string[] = [];
  const seen = new Set<string>();
  const push = (v: string | null | undefined) => {
    if (v && !seen.has(v)) {
      seen.add(v);
      candidates.push(v);
    }
  };

  if (!cleaned) {
    return [];
  }

  if (isGroup || cleaned.includes("-")) {
    push(cleaned);
    return candidates;
  }

  const digits = cleaned.replace(/\D/g, "");
  if (!digits) {
    return [];
  }

  if (digits.startsWith("55") && digits.length === 12) {
    // 12 dígitos com DDI 55 = forma incompleta (sem o 9º dígito do
    // celular). Tenta primeiro a forma completa/correta (13 dígitos);
    // a incompleta só entra depois, como último recurso.
    //
    // ATENÇÃO: `normalizeCampaignContactNumber` (libphonenumber-js) NUNCA
    // pode ser chamada como primeiro candidato aqui — passada sem "+", a
    // lib não reconhece esse formato e cai no fallback que devolve o
    // MESMO número de 12 dígitos (sem adicionar o 9º dígito). Isso fazia
    // o candidato errado ser testado (e aceito, por tolerância do
    // próprio WhatsApp) antes do certo — bug real: 89 de 96 contatos de
    // uma lista importada ficaram marcados como válidos com número
    // incompleto. Ver docs/MANUAL_TECNICO.md.
    push(addBrVariant(digits)); // -> 13 dígitos (com o 9)
    push(digits);
  } else if (digits.startsWith("55") && digits.length === 13) {
    // Já está completo (com o 9) — é a forma certa, testa como veio
    // primeiro; a forma antiga (sem o 9) só entra depois, de propósito
    // pra não sobrescrever um número certo por uma variante duvidosa.
    push(digits);
    push(addBrVariant(digits)); // -> 12 dígitos (sem o 9), só como fallback
  } else if (digits.length === 10 || digits.length === 11) {
    // Sem DDI nenhum (só DDD + número): mantém o padrão já existente no
    // resto do sistema (normalizeCampaignContactNumber) de assumir Brasil.
    const withDdi = `55${digits}`;
    push(addBrVariant(withDdi));
    push(withDdi);
  } else {
    // DDI de outro país (ou formato não reconhecido): usa a
    // libphonenumber-js (sabe as regras de numeração de qualquer país),
    // com o valor cru como fallback — sem nenhuma tentativa de
    // "converter" pra Brasil.
    push(normalizeCampaignContactNumber(digits) || null);
    push(digits);
  }

  return candidates;
};

const CheckContactNumber = async (
  number: string,
  companyId: number,
  isGroup: boolean = false,
  whatsappId?: number
): Promise<string> => {
  const candidates = buildCandidates(number, isGroup);
  if (!candidates.length) {
    throw new AppError("ERR_WAPP_INVALID_CONTACT");
  }

  const suffix = isGroup ? "@g.us" : "@s.whatsapp.net";
  const defaultWhatsapp = await GetDefaultWhatsApp(companyId, whatsappId);
  const wbot = getWbot(defaultWhatsapp.id);
  const { jidNormalizedUser } = await getBaileys();

  try {
    for (const candidate of candidates) {
      const jid = jidNormalizedUser(`${candidate}${suffix}`);
      const [result] = (await (wbot as any).onWhatsApp(jid)) as OnWhatsAppResult[];
      logger.info(
        `[CheckContactNumber] companyId=${companyId} whatsappId=${defaultWhatsapp.id} candidate=${candidate} exists=${String(
          result?.exists
        )} resolvedJid=${String(result?.jid || jid)}`
      );
      if (result?.exists) {
        const resolved = String(result.jid || jid).split("@")[0];
        return sanitize(resolved);
      }
    }
  } catch (err: any) {
    if (err.message === "ERR_WAPP_INVALID_CONTACT") {
      throw err;
    }
    throw new AppError("ERR_WAPP_CHECK_CONTACT");
  }

  throw new AppError("ERR_WAPP_INVALID_CONTACT");
};

export default CheckContactNumber;
