import AppError from "../../errors/AppError";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import { dynamicImport } from "../../utils/dynamicImport";
import logger from "../../utils/logger";

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

const addBrVariants = (n: string): string[] => {
  const variants = new Set<string>();
  variants.add(n);

  if (!n.startsWith("55")) {
    return Array.from(variants);
  }

  // BR mobile transition: tenta com e sem 9o digito
  if (n.length === 13) {
    const ddi = n.substring(0, 2);
    const ddd = n.substring(2, 4);
    const firstLocalDigit = n.substring(4, 5);
    const local8 = n.slice(-8);
    if (firstLocalDigit === "9") {
      variants.add(`${ddi}${ddd}${local8}`);
    }
  } else if (n.length === 12) {
    const ddi = n.substring(0, 2);
    const ddd = n.substring(2, 4);
    const local8 = n.slice(-8);
    variants.add(`${ddi}${ddd}9${local8}`);
  }

  return Array.from(variants);
};

const buildCandidates = (raw: string, isGroup: boolean): string[] => {
  const cleaned = sanitize(raw);
  const candidates = new Set<string>();

  if (!cleaned) {
    return [];
  }

  if (isGroup || cleaned.includes("-")) {
    candidates.add(cleaned);
    return Array.from(candidates);
  }

  const digits = cleaned.replace(/\D/g, "");
  if (!digits) {
    return [];
  }

  candidates.add(digits);
  addBrVariants(digits).forEach(v => candidates.add(v));

  if (!digits.startsWith("55")) {
    const withDdi = `55${digits}`;
    candidates.add(withDdi);
    addBrVariants(withDdi).forEach(v => candidates.add(v));
  }

  return Array.from(candidates);
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
