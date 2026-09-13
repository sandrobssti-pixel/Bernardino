import { Op } from "sequelize";
import { getIO } from "../../libs/socket";
import CompaniesSettings from "../../models/CompaniesSettings";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import fs from "fs";
import path, { join } from "path";
import logger from "../../utils/logger";
import { isNil } from "lodash";
import Whatsapp from "../../models/Whatsapp";
import * as Sentry from "@sentry/node";

const axios = require('axios');

// Throttle em memória para não martelar a API do WhatsApp/WuzAPI: mesmo
// contato só tem a foto re-verificada após esse intervalo, mesmo que já
// tenha uma foto válida salva (evita foto desatualizada presa para sempre).
const PROFILE_PIC_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h após sucesso
// Depois de uma falha (ex: rate-limit do WhatsApp), tenta de novo bem antes
// das 6h — senão uma única falha pontual deixa o contato sem foto por horas.
const PROFILE_PIC_RETRY_AFTER_FAILURE_MS = 15 * 60 * 1000; // 15min
const profilePicLastCheckedAt = new Map<number, { at: number; ok: boolean }>();

// URLs de foto de perfil do WhatsApp (pps.whatsapp.net) carregam a validade
// no parâmetro "oe" (epoch em hex). Sem checar isso, uma URL já expirada
// fica marcada como "válida" pelo código e nunca é re-buscada antes das 6h.
const isExpiredWhatsappCdnUrl = (url?: string | null): boolean => {
  if (!url || typeof url !== "string") return false;
  try {
    const { searchParams } = new URL(url);
    const oe = searchParams.get("oe");
    if (!oe) return false;
    const expiresAtMs = parseInt(oe, 16) * 1000;
    if (!Number.isFinite(expiresAtMs)) return false;
    return Date.now() >= expiresAtMs;
  } catch {
    return false;
  }
};

const buildNoPictureUrl = (): string => {
  const frontendUrl = (process.env.FRONTEND_URL || "").trim().replace(/\/+$/, "");
  if (!frontendUrl) return "/nopicture.png";
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(frontendUrl)) {
    return "/nopicture.png";
  }
  return `${frontendUrl}/nopicture.png`;
};

interface ExtraInfo extends ContactCustomField {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  isGroup: boolean;
  email?: string;
  profilePicUrl?: string;
  companyId: number;
  channel?: string;
  extraInfo?: ExtraInfo[];
  remoteJid?: string;
  whatsappId?: number;
  wbot?: any;
  lid?: string | null;
  jid?: string | null;
}

const downloadProfileImage = async ({
  profilePicUrl,
  companyId,
  contact
}) => {
  const isValidHttpUrl = (value?: string): boolean => {
    if (!value || typeof value !== "string") return false;
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  if (!isValidHttpUrl(profilePicUrl)) {
    return null;
  }

  const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
  let filename;


  const folder = path.resolve(publicFolder, `company${companyId}`, "contacts");

  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
    fs.chmodSync(folder, 0o777);
  }

  try {

    const response = await axios.get(profilePicUrl, {
      responseType: 'arraybuffer',
      timeout: 5000
    });

    filename = `${new Date().getTime()}.jpeg`;
    fs.writeFileSync(join(folder, filename), response.data);

  } catch (error) {
    console.error(error)
  }

  return filename
}

// Busca a foto de perfil (Baileys), baixa localmente e atualiza o contato —
// tudo fora do fluxo síncrono de processamento de mensagem (ver chamada em
// CreateOrUpdateContactService). Erros aqui nunca devem propagar.
const refreshBaileysProfilePicInBackground = ({
  contactId,
  companyId,
  wbot,
  jidForPic
}: {
  contactId: number;
  companyId: number;
  wbot: any;
  jidForPic: string;
}): void => {
  (async () => {
    try {
      // "preview" (thumbnail) em vez de "image" (full-res): o WhatsApp
      // aplica rate-limit muito mais agressivo em consultas de imagem cheia,
      // o que fazia a maioria das buscas falharem (rate-overlimit) e o
      // contato nunca ganhar foto. Preview também é o suficiente para o
      // avatar pequeno da lista de tickets.
      const profilePicPromise = wbot.profilePictureUrl(jidForPic, "preview");
      const timeoutPromise = new Promise<string>(resolve =>
        setTimeout(() => resolve("__timeout__"), 15000)
      );
      const refreshedPic = (await Promise.race([
        profilePicPromise,
        timeoutPromise
      ])) as string;

      if (refreshedPic === "__timeout__") {
        profilePicLastCheckedAt.set(contactId, { at: Date.now(), ok: false });
        logger.warn(
          `CreateOrUpdateContactService: timeout ao buscar foto de perfil (Baileys) para contato ${contactId} (jid=${jidForPic})`
        );
        return;
      }

      if (typeof refreshedPic !== "string" || !refreshedPic.trim()) {
        profilePicLastCheckedAt.set(contactId, { at: Date.now(), ok: false });
        return;
      }

      profilePicLastCheckedAt.set(contactId, { at: Date.now(), ok: true });

      // Baixa e guarda localmente para não depender da validade da URL
      // assinada do WhatsApp (que expira em dias/semanas) — mesma estratégia
      // já usada para WuzAPI/Facebook/Instagram.
      const localFilename = await downloadProfileImage({
        profilePicUrl: refreshedPic,
        companyId,
        contact: null
      });

      const updateData: Record<string, unknown> = { profilePicUrl: refreshedPic };
      if (localFilename) {
        updateData.urlPicture = localFilename;
        updateData.pictureUpdated = true;
      }

      await Contact.update(updateData, { where: { id: contactId } });

      const updatedContact = await Contact.findByPk(contactId);
      if (updatedContact) {
        getIO()
          .of(String(companyId))
          .emit(`company-${companyId}-contact`, {
            action: "update",
            contact: updatedContact
          });
      }
    } catch (picErr: any) {
      profilePicLastCheckedAt.set(contactId, { at: Date.now(), ok: false });
      logger.warn(
        `CreateOrUpdateContactService: falha ao buscar foto de perfil (Baileys) para contato ${contactId}: ${picErr?.message || picErr}`
      );
      Sentry.captureException(picErr);
    }
  })();
};

const CreateOrUpdateContactService = async ({
  name,
  number: rawNumber,
  profilePicUrl,
  isGroup,
  email = "",
  channel = "whatsapp",
  companyId,
  extraInfo = [],
  remoteJid = "",
  whatsappId,
  wbot,
  lid = null,
  jid = null
}: Request): Promise<Contact> => {
  try {
    let createContact = false;
    const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
    // Contatos de webchat usam um identificador sintético ("webchat-<uuid>"),
    // não um telefone — não pode passar pelo strip de dígitos abaixo, senão
    // o identificador vira uma sequência numérica sem sentido e a busca por
    // esse contato em requisições futuras do widget deixa de bater.
    const number =
      isGroup || channel === "webchat"
        ? rawNumber
        : rawNumber.replace(/[^0-9]/g, "");
    const io = getIO();
    let contact: Contact | null;

    contact = await Contact.findOne({
      where: { number, companyId }
    });

    // Sessoes com identidade LID (ex: importadas via extensao) podem entregar
    // eventos cujo remoteJid nao resolve para o numero real (sem
    // remoteJidAlt/senderPn) — "number" fica com os digitos do @lid, que nao
    // bate com o contato ja existente. Antes de criar um contato duplicado,
    // tenta casar pelo lid/jid ja conhecido desse mesmo contato.
    if (!contact && (lid || jid)) {
      const chatKeyOr: any[] = [];
      if (lid) chatKeyOr.push({ lid });
      if (jid) chatKeyOr.push({ jid });
      contact = await Contact.findOne({
        where: { companyId, [Op.or]: chatKeyOr }
      });
    }

    // Se o contato achado por "number" NÃO é o dono do lid/jid deste evento,
    // outro contato já é o canônico desse chat (situação típica quando um
    // número foi extraído errado antes e criou um contato "órfão"). Troca
    // para o contato canônico em vez de tentar gravar o mesmo lid/jid em
    // dois registros — isso violaria a constraint única
    // (companyId, whatsappId, COALESCE(lid, jid)) e derrubaria a mensagem.
    if (contact && (lid || jid)) {
      const chatKeyOr: any[] = [];
      if (lid) chatKeyOr.push({ lid });
      if (jid) chatKeyOr.push({ jid });
      const owner = await Contact.findOne({
        where: { companyId, [Op.or]: chatKeyOr }
      });
      if (owner && owner.id !== contact.id) {
        contact = owner;
      }
    }

    const hasIncomingProfilePic =
      typeof profilePicUrl === "string" && profilePicUrl.trim() !== "";
    let updateImage =
      Boolean((!contact || contact?.profilePicUrl !== profilePicUrl) && hasIncomingProfilePic && channel !== "whatsapp");

    if (contact) {
      contact.remoteJid = remoteJid;
      // Acumula lid/jid conhecidos sem apagar um valor ja aprendido antes —
      // o mesmo contato pode aparecer ora com @lid, ora com @s.whatsapp.net
      // dependendo do evento (ver FindOrCreateTicketService, que usa lid/jid
      // como chave canonica de ticket).
      if (lid) (contact as any).lid = lid;
      if (jid) (contact as any).jid = jid;
      // Só sobrescreve a foto já salva quando a busca realmente trouxe uma
      // URL válida. Uma falha/rate limit no fetch (ex: WuzAPI) retorna string
      // vazia e não deve apagar uma foto existente do contato.
      if (hasIncomingProfilePic) {
        contact.profilePicUrl = profilePicUrl;
      }
      if (channel === "whatsapp" && hasIncomingProfilePic) {
        const storedUrlPicture = String((contact as any).getDataValue("urlPicture") || "").trim();
        if (storedUrlPicture) {
          contact.setDataValue("urlPicture", "");
          contact.setDataValue("pictureUpdated", false);
        }
      }
      const storedUrlPicture = String((contact as any).getDataValue("urlPicture") || "").trim();
      const hasLocalPicture =
        Boolean(storedUrlPicture) && storedUrlPicture.toLowerCase() !== "nopicture.png";
      const hasMissingRemotePic =
        !contact.profilePicUrl ||
        String(contact.profilePicUrl).includes("nopicture") ||
        isExpiredWhatsappCdnUrl(contact.profilePicUrl);
      const lastCheck = profilePicLastCheckedAt.get(contact.id);
      const refreshIntervalMs =
        lastCheck && !lastCheck.ok
          ? PROFILE_PIC_RETRY_AFTER_FAILURE_MS
          : PROFILE_PIC_REFRESH_INTERVAL_MS;
      const isStaleForRefresh =
        !hasMissingRemotePic &&
        Date.now() - (lastCheck?.at || 0) >= refreshIntervalMs;
      if (
        channel === "whatsapp" &&
        wbot &&
        (hasMissingRemotePic || isStaleForRefresh) &&
        !hasLocalPicture
      ) {
        // Não aguarda: buscar/baixar a foto de perfil não pode travar o fluxo
        // de mensagem (era exatamente isso que causava o delay/travamento —
        // essa busca ficava no caminho síncrono de toda mensagem recebida).
        // Roda em segundo plano e atualiza o contato + avisa o front via
        // socket quando terminar.
        const remoteCandidate = String(remoteJid || contact.remoteJid || "").toLowerCase();
        const jidForPic = remoteCandidate.endsWith("@lid")
          ? `${number}@s.whatsapp.net`
          : (remoteJid || contact.remoteJid || `${number}@s.whatsapp.net`);
        refreshBaileysProfilePicInBackground({
          contactId: contact.id,
          companyId,
          wbot,
          jidForPic
        });
      }
      contact.isGroup = isGroup;
      if (isNil(contact.whatsappId)) {
        const whatsapp = await Whatsapp.findOne({
          where: { id: whatsappId, companyId }
        });

        if (whatsapp) {
          contact.whatsappId = whatsappId;
        }
      }
      const folder = path.resolve(publicFolder, `company${companyId}`, "contacts");

      let fileName, oldPath = "";
      if (contact.urlPicture) {
        oldPath = path.resolve(contact.urlPicture.replace(/\\/g, '/'));
        fileName = path.join(folder, path.basename(oldPath));
      }
      // Não bloquear o fluxo de mensagem por busca de avatar.
      if (!fileName || !fs.existsSync(fileName) || contact.profilePicUrl === "") {
        if (!contact.profilePicUrl) {
          contact.profilePicUrl = buildNoPictureUrl();
        }
      }

      if (contact.name === number) {
        contact.name = name;
      }

      try {
        await contact.save(); // Ensure save() is called to trigger updatedAt
      } catch (saveErr: any) {
        const isChatKeyConflict =
          saveErr?.name === "SequelizeUniqueConstraintError" &&
          (saveErr?.parent?.constraint === "contacts_company_whats_chatkey_uq" ||
            String(saveErr?.parent?.detail || "").includes("COALESCE(lid, jid)"));

        if (!isChatKeyConflict) {
          throw saveErr;
        }

        // Corrida rara: outro processo gravou esse lid/jid em outro contato
        // entre a checagem acima e este save(). Reaproveita o dono atual em
        // vez de derrubar a mensagem.
        logger.warn(
          `CreateOrUpdateContactService: conflito de lid/jid ao salvar contato ${contact.id} (companyId=${companyId}), reaproveitando contato canônico.`
        );
        const chatKeyOr: any[] = [];
        if (lid) chatKeyOr.push({ lid });
        if (jid) chatKeyOr.push({ jid });
        const owner = await Contact.findOne({
          where: { companyId, [Op.or]: chatKeyOr }
        });
        if (!owner) {
          throw saveErr;
        }
        contact = owner;
      }
      await contact.reload();

    } else if (wbot && ['whatsapp'].includes(channel)) {
      const settings = await CompaniesSettings.findOne({ where: { companyId } });
      const acceptAudioMessageContact = settings?.acceptAudioMessageContact;
      let newRemoteJid = remoteJid;

      if (!remoteJid) {
        newRemoteJid = isGroup ? `${rawNumber}@g.us` : `${rawNumber}@s.whatsapp.net`;
      }

      let newContactLocalPicture = "";
      try {
        // "preview" em vez de "image": reduz o rate-limit do WhatsApp em
        // consultas de foto (ver nota equivalente no bloco de refresh acima).
        const profilePicPromise = wbot.profilePictureUrl(newRemoteJid, "preview");
        const timeoutPromise = new Promise<string>(resolve =>
          setTimeout(() => resolve(""), 15000)
        );
        profilePicUrl =
          ((await Promise.race([profilePicPromise, timeoutPromise])) as string) ||
          buildNoPictureUrl();
        if (!profilePicUrl || profilePicUrl === buildNoPictureUrl()) {
          logger.warn(
            `CreateOrUpdateContactService: sem foto de perfil (Baileys) ao criar contato ${number} (jid=${newRemoteJid}) - timeout ou indisponível`
          );
        } else {
          newContactLocalPicture =
            (await downloadProfileImage({
              profilePicUrl,
              companyId,
              contact: null
            })) || "";
        }
      } catch (e) {
        Sentry.captureException(e);
        logger.warn(
          `CreateOrUpdateContactService: falha ao buscar foto de perfil (Baileys) ao criar contato ${number}: ${(e as any)?.message || e}`
        );
        profilePicUrl = buildNoPictureUrl();
      }

      try {
        contact = await Contact.create({
          name,
          number,
          email,
          isGroup,
          companyId,
          channel,
          acceptAudioMessage: acceptAudioMessageContact === 'enabled' ? true : false,
          remoteJid: newRemoteJid,
          profilePicUrl,
          urlPicture: newContactLocalPicture,
          pictureUpdated: Boolean(newContactLocalPicture),
          whatsappId,
          lid: lid || null,
          jid: jid || null
        } as any);

        createContact = true;
      } catch (createErr: any) {
        const isChatKeyConflict =
          createErr?.name === "SequelizeUniqueConstraintError" &&
          (createErr?.parent?.constraint === "contacts_company_whats_chatkey_uq" ||
            String(createErr?.parent?.detail || "").includes("COALESCE(lid, jid)"));

        if (!isChatKeyConflict) {
          throw createErr;
        }

        // Corrida rara: outro processo criou um contato com esse lid/jid entre
        // a checagem e este create(). Reaproveita o dono atual em vez de
        // derrubar a mensagem.
        const chatKeyOr: any[] = [];
        if (lid) chatKeyOr.push({ lid });
        if (jid) chatKeyOr.push({ jid });
        const owner = await Contact.findOne({
          where: { companyId, [Op.or]: chatKeyOr }
        });
        if (!owner) {
          throw createErr;
        }
        contact = owner;
      }
    } else if (['facebook', 'instagram', 'webchat'].includes(channel)) {
      contact = await Contact.create({
        name,
        number,
        email,
        isGroup,
        companyId,
        channel,
        profilePicUrl,
        urlPicture: "",
        whatsappId
      });
    }



    if (updateImage) {


      let filename;

      filename = await downloadProfileImage({
        profilePicUrl,
        companyId,
        contact
      })

      if (filename) {
        await contact.update({
          urlPicture: filename,
          pictureUpdated: true
        });

        await contact.reload();
      }
    } else {
      if (['facebook', 'instagram'].includes(channel)) {
        let filename;

        filename = await downloadProfileImage({
          profilePicUrl,
          companyId,
          contact
        })

        if (filename) {
          await contact.update({
            urlPicture: filename,
            pictureUpdated: true
          });

          await contact.reload();
        }
      }
    }

    if (createContact) {
      io.of(String(companyId))
        .emit(`company-${companyId}-contact`, {
          action: "create",
          contact
        });
    } else {
      
      io.of(String(companyId))
        .emit(`company-${companyId}-contact`, {
          action: "update",
          contact
        });
        
    }

    return contact;
  } catch (err) {
    logger.error("Error to find or create a contact:", err);
    throw err;
  }
};

export default CreateOrUpdateContactService;
