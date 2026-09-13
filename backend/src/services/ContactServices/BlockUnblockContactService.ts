import AppError from "../../errors/AppError";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import Contact from "../../models/Contact";
import { dynamicImport } from "../../utils/dynamicImport";

interface Request {
  contactId: string;
  companyId: string | number;
  active: boolean;
}

const sanitizeNumber = (value?: string): string =>
  String(value || "")
    .split("@")[0]
    .replace(/[^\d]/g, "")
    .trim();

const addNumberVariants = (set: Set<string>, raw?: string) => {
  const number = sanitizeNumber(raw);
  if (!number) return;

  set.add(number);

  // Variações com/sem DDI BR para robustez do onWhatsApp.
  if (number.startsWith("55")) {
    set.add(number.slice(2));
  } else {
    set.add(`55${number}`);
  }

  // Variações com/sem o "9" adicional de celular BR.
  const withCountry = number.startsWith("55") ? number : `55${number}`;
  const withNine = /^55(\d{2})9(\d{8})$/.exec(withCountry);
  if (withNine) {
    set.add(`55${withNine[1]}${withNine[2]}`);
    set.add(`${withNine[1]}${withNine[2]}`);
  }

  const withoutNine = /^55(\d{2})(\d{8})$/.exec(withCountry);
  if (withoutNine) {
    set.add(`55${withoutNine[1]}9${withoutNine[2]}`);
    set.add(`${withoutNine[1]}9${withoutNine[2]}`);
  }
};

const buildCandidates = (contact: Contact): string[] => {
  const candidates = new Set<string>();

  addNumberVariants(candidates, contact.number);
  addNumberVariants(candidates, contact.remoteJid);
  addNumberVariants(candidates, contact.jid);
  addNumberVariants(candidates, contact.lid || "");

  return Array.from(candidates);
};

const resolveValidJids = async (wbot: any, contact: Contact): Promise<string[]> => {
  const baileys = await dynamicImport("baileys");
  const jidNormalizedUser = (baileys as any)?.jidNormalizedUser;

  const normalizeJid = (jid: string): string => {
    if (typeof jidNormalizedUser === "function") {
      return jidNormalizedUser(jid);
    }
    return jid;
  };
  const candidates = new Set<string>();
  const verifiedCandidates = new Set<string>();
  const pushCandidate = (jid?: string) => {
    const normalized = normalizeJid(String(jid || "").trim());
    if (!normalized) return;
    if (normalized.endsWith("@g.us") || normalized.endsWith("@broadcast")) return;
    if (!normalized.includes("@")) return;
    candidates.add(normalized);
  };
  const normalizeBlockableUserJid = (value: string): string => {
    const digits = sanitizeNumber(normalizeJid(String(value || "").trim()));
    return digits ? `${digits}@s.whatsapp.net` : "";
  };

  // Inclui contact.lid diretamente como JID @lid (necessário para Baileys v7 que exige LID)
  const knownJidCandidates = [contact.remoteJid, contact.jid, contact.lid]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((jid) => !jid.endsWith("@g.us"));

  // Prioriza JIDs conhecidos do contato.
  if (knownJidCandidates.length > 0) {
    knownJidCandidates.forEach((jid) => pushCandidate(jid));
    const knownAsUser = normalizeBlockableUserJid(knownJidCandidates[0]);
    pushCandidate(knownAsUser);
  }

  const numbers = buildCandidates(contact);
  for (const candidate of numbers) {
    const jid = normalizeBlockableUserJid(`${sanitizeNumber(candidate)}@s.whatsapp.net`);
    if (!jid || !jid.endsWith("@s.whatsapp.net")) continue;

    try {
      const [result] = await (wbot as any).onWhatsApp(jid);
      if (result?.exists) {
        const candidateA = normalizeJid(jid);
        const candidateB = normalizeJid(String(result.jid || ""));
        if (candidateA && candidateA.includes("@")) verifiedCandidates.add(candidateA);
        if (candidateB && candidateB.includes("@")) verifiedCandidates.add(candidateB);
      }
    } catch {
      // Ignora erro pontual desta variação e tenta as próximas.
    }
  }

  const jidList =
    verifiedCandidates.size > 0
      ? Array.from(verifiedCandidates)
      : Array.from(candidates);
  if (jidList.length === 0) {
    throw new AppError("ERR_WAPP_INVALID_CONTACT_FOR_BLOCK", 400);
  }
  return jidList;
};

const BlockUnblockContactService = async ({
  contactId,
  companyId,
  active
}: Request): Promise<Contact> => {
  // Validação do companyId
  if (!companyId) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 400);
  }

  const contact = await Contact.findOne({
    where: {
      id: contactId,
      companyId: Number(companyId)
    }
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  if (contact.isGroup || (contact.remoteJid && contact.remoteJid.endsWith("@g.us"))) {
    throw new AppError("ERR_WAPP_BLOCK_GROUP_NOT_SUPPORTED", 400);
  }

  // Busca a conexão padrão do WhatsApp
  const whatsappCompany = await GetDefaultWhatsApp(
    Number(companyId),
    contact.whatsappId || undefined
  );

  if (!whatsappCompany) {
    throw new AppError("ERR_NO_DEFAULT_WHATSAPP", 404);
  }

  // Verifica se o WhatsApp está conectado via model/status
  if (whatsappCompany.status !== "CONNECTED") {
    throw new AppError("ERR_WHATSAPP_NOT_CONNECTED", 400);
  }
  const isWuzapiProvider =
    String((whatsappCompany as any)?.provider || "").toLowerCase() === "wuzapi";

  const wbot = getWbot(whatsappCompany.id, Number(companyId));

  // Checagem opcional do WebSocket do Baileys, sem conflitar com o type Session
  // readyState === 1 -> OPEN
  const wsReady = (wbot as any)?.ws?.readyState;
  if (wsReady !== undefined && wsReady !== 1) {
    throw new AppError("ERR_WHATSAPP_SESSION_NOT_ACTIVE", 400);
  }

  const jids = await resolveValidJids(wbot, contact);
  const myJid = sanitizeNumber((wbot as any)?.user?.id || "");
  const validJids = jids.filter((jid) => !(myJid && sanitizeNumber(jid) === myJid));
  if (validJids.length === 0) {
    throw new AppError("ERR_WAPP_CANNOT_BLOCK_OWN_NUMBER", 400);
  }

  // Detecta erros que indicam JID inválido/rejeitável e permitem tentar o próximo candidato.
  // Inclui: mensagens "bad-request", error.data === 400, Boom 400 (Baileys v7 LID errors),
  // e erros específicos de resolução de LID do Baileys v7.
  const isBadRequestError = (error: any): boolean => {
    if (error?.message?.includes("bad-request")) return true;
    if (error?.data === 400) return true;
    if (error?.output?.statusCode === 400) return true;
    if (error?.isBoom && error?.output?.statusCode === 400) return true;
    if (
      typeof error?.message === "string" &&
      (error.message.includes("Unable to resolve LID") ||
        error.message.includes("Unable to resolve PN JID") ||
        error.message.includes("Invalid jid"))
    )
      return true;
    return false;
  };

  // Wuzapi currently lacks working blocklist support (protocol requires LID stanzas).
  if (isWuzapiProvider) {
    throw new AppError("ERR_WUZAPI_BLOCK_NOT_SUPPORTED", 501);
  }

  try {
    const action = active ? "unblock" : "block";
    let lastError: any = null;
    const attemptJids = validJids;

    for (const jid of attemptJids) {
      try {
        await (wbot as any).updateBlockStatus(jid, action);
        await contact.update({ active: action === "unblock" });
        await contact.reload();
        return contact;
      } catch (error: any) {
        lastError = error;
        // Em alguns cenários o WA rejeita um formato de JID e aceita outro.
        // Continuamos tentando os próximos candidatos apenas para erros de JID inválido.
        if (!isBadRequestError(error)) {
          throw error;
        }
      }
    }

    throw lastError || new Error("bad-request");
  } catch (error: any) {
    console.error("Erro ao bloquear/desbloquear contato:", error);

    // Tratamento específico para diferentes tipos de erro
    if (error?.message?.includes("not found")) {
      throw new AppError("ERR_CONTACT_NOT_FOUND_ON_WHATSAPP", 404);
    }

    if (error?.message?.includes("blocked")) {
      // Se já está bloqueado/desbloqueado, apenas atualiza o status local
      await contact.update({ active });
      await contact.reload();
      return contact;
    }

    if (isBadRequestError(error)) {
      // Fallback resiliente para Baileys — inclui falhas de resolução de LID (v7).
      await contact.update({ active });
      await contact.reload();
      return contact;
    }

    if (error?.message?.includes("connection")) {
      throw new AppError("ERR_WHATSAPP_CONNECTION_FAILED", 500);
    }

    // Erro genérico do WhatsApp
    throw new AppError(
      active ? "ERR_WPP_UNBLOCK_CONTACT" : "ERR_WPP_BLOCK_CONTACT",
      500
    );
  }
};

export default BlockUnblockContactService;
