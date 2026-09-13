import { randomBytes } from "crypto";
import AppError from "../../errors/AppError";
import cacheLayer from "../../libs/cache";
import { clearSessionRuntimeState, removeWbot, tryGetWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import { dynamicImport } from "../../utils/dynamicImport";
import { StartWhatsAppSession } from "../WbotServices/StartWhatsAppSession";

const IMPORT_TOKEN_TTL_SECONDS = 15 * 60;
const IMPORT_TOKEN_PREFIX = "whatsapp:cred-import";

type ImportTokenPayload = {
  whatsappId: number;
  companyId: number;
  userId: number;
  issuedAt: string;
};

type ImportDump = {
  creds?: Record<string, any> | null;
  keys?: Record<string, Record<string, any>> | null;
  device?: {
    registrationId?: number | null;
    noiseKey?: {
      pubKey?: any;
      privKey?: any;
    } | null;
    identityKey?: {
      pubKey?: any;
      privKey?: any;
    } | null;
    signedPreKey?: {
      keyId?: number;
      keyPair?: {
        pubKey?: any;
        privKey?: any;
      } | null;
      signature?: any;
    } | null;
    advSecretKey?: any;
    account?: any;
    meJid?: string | null;
    meLid?: string | null;
    meDisplayName?: string | null;
    platform?: string | null;
  } | null;
  appStateSyncKeys?: any[];
  appStateVersions?: any[];
  preKeys?: Array<{
    keyId?: number;
    pubKey?: any;
    privKey?: any;
  }>;
};

const KEY_BUCKET_ALIASES: Array<[string, string[]]> = [
  ["preKeys", ["preKeys", "pre-key"]],
  ["identityKeys", ["identityKeys", "identity-key"]],
  ["sessions", ["sessions", "session"]],
  ["senderKeys", ["senderKeys", "sender-key"]],
  ["senderKeyMemory", ["senderKeyMemory", "sender-key-memory"]],
  ["appStateSyncKeys", ["appStateSyncKeys", "app-state-sync-key"]],
  ["appStateVersions", ["appStateVersions", "app-state-sync-version"]],
  ["lidMappings", ["lidMappings", "lidMapping", "lid-mapping"]],
  ["deviceList", ["deviceList", "device-list"]],
  ["tcTokens", ["tcTokens", "tctoken"]]
];

let baileysMod: typeof import("baileys") | null = null;
async function getBaileys() {
  if (!baileysMod) baileysMod = await dynamicImport("baileys");
  return baileysMod;
}

const normalizeProvider = (value?: string | null): string =>
  String(value || "beta").trim().toLowerCase();

const extractDigitsFromJid = (jid?: string | null): string => {
  const raw = String(jid || "").trim();
  if (!raw) return "";
  return raw.split("@")[0].split(":")[0].replace(/\D/g, "");
};

const buildImportTokenKey = (token: string): string =>
  `${IMPORT_TOKEN_PREFIX}:${token}`;

const ensureImportEligible = (whatsapp: Whatsapp): void => {
  if (String(whatsapp.channel || "").toLowerCase() !== "whatsapp") {
    throw new AppError("A importação de credenciais só está disponível para conexões WhatsApp.", 400);
  }

  if (normalizeProvider((whatsapp as any).provider) === "wuzapi") {
    throw new AppError("A importação por credenciais ainda não está disponível para WuzAPI.", 400);
  }

  if (String(whatsapp.status || "").toUpperCase() !== "DISCONNECTED") {
    throw new AppError("A conexão precisa estar desconectada para importar credenciais.", 409);
  }

  if (tryGetWbot(whatsapp.id, whatsapp.companyId)) {
    throw new AppError("Existe uma sessão ativa em memória para esta conexão. Desconecte antes de importar.", 409);
  }
};

const parseJsonIfNeeded = (value: string | object): any => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      throw new AppError("JSON de credenciais inválido.", 400);
    }
  }

  if (!value || typeof value !== "object") {
    throw new AppError("Payload de credenciais inválido.", 400);
  }

  return value;
};

const decodeWrappedBuffer = (value: any): any => {
  if (value == null) return value;

  if (
    typeof value === "object" &&
    value.type === "Buffer" &&
    typeof value.data === "string"
  ) {
    return Buffer.from(value.data, "base64");
  }

  if (Array.isArray(value)) {
    return value.map(item => decodeWrappedBuffer(item));
  }

  if (typeof value === "object") {
    const decoded: Record<string, any> = {};
    Object.entries(value).forEach(([key, item]) => {
      decoded[key] = decodeWrappedBuffer(item);
    });
    return decoded;
  }

  return value;
};

const toBufferOrNull = (value: any): Buffer | null => {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return null;
};

const isPlainRecord = (value: any): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const normalizeBase64Value = (value: any, fallback = ""): string => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  const buffer = toBufferOrNull(value);
  if (buffer?.length) {
    return buffer.toString("base64");
  }

  return fallback;
};

const encodeAppStateKeyId = (value: Buffer | null): string => {
  if (!value || !value.length) {
    return randomBytes(12).toString("hex");
  }

  return value.toString("base64");
};

export const createCredentialImportToken = async (
  whatsapp: Whatsapp,
  userId: number
): Promise<{ token: string; expiresInSeconds: number }> => {
  ensureImportEligible(whatsapp);

  const token = randomBytes(24).toString("hex");
  const payload: ImportTokenPayload = {
    whatsappId: whatsapp.id,
    companyId: whatsapp.companyId,
    userId,
    issuedAt: new Date().toISOString()
  };

  await cacheLayer.set(
    buildImportTokenKey(token),
    JSON.stringify(payload),
    "EX",
    IMPORT_TOKEN_TTL_SECONDS
  );

  return {
    token,
    expiresInSeconds: IMPORT_TOKEN_TTL_SECONDS
  };
};

export const consumeCredentialImportToken = async (
  token: string
): Promise<ImportTokenPayload> => {
  const normalized = String(token || "").trim();
  if (!normalized) {
    throw new AppError("Token de importação ausente.", 401);
  }

  const key = buildImportTokenKey(normalized);
  const raw = await cacheLayer.get(key);
  await cacheLayer.del(key);

  if (!raw) {
    throw new AppError("Token de importação inválido ou expirado.", 401);
  }

  try {
    return JSON.parse(raw) as ImportTokenPayload;
  } catch {
    throw new AppError("Token de importação corrompido.", 401);
  }
};

export const importBaileysCredentials = async (
  whatsapp: Whatsapp,
  rawDump: string | object
): Promise<{ meJid: string | null }> => {
  ensureImportEligible(whatsapp);

  const parsed = parseJsonIfNeeded(rawDump) as ImportDump;
  const decoded = decodeWrappedBuffer(parsed) as ImportDump;
  const device = decoded.device || {};
  const meJid = String(decoded?.creds?.me?.id || device.meJid || "").trim() || null;

  const noisePub = toBufferOrNull(device?.noiseKey?.pubKey);
  const noisePriv = toBufferOrNull(device?.noiseKey?.privKey);
  const identityPub = toBufferOrNull(device?.identityKey?.pubKey);
  const identityPriv = toBufferOrNull(device?.identityKey?.privKey);
  const signedPreKeyPub = toBufferOrNull(device?.signedPreKey?.keyPair?.pubKey);
  const signedPreKeyPriv = toBufferOrNull(device?.signedPreKey?.keyPair?.privKey);
  const signedPreKeySignature = toBufferOrNull(device?.signedPreKey?.signature);
  const advSecretKey = normalizeBase64Value(
    decoded?.creds?.advSecretKey ?? device?.advSecretKey
  );

  // Pool de one-time prekeys ja publicadas no servidor pela sessao de origem.
  // Sem elas, a primeira mensagem de cada contato apos a migracao pode falhar
  // com "Invalid PreKey ID" ate o WhatsApp reenviar.
  const importedPreKeys = (Array.isArray(decoded.preKeys) ? decoded.preKeys : [])
    .map(entry => {
      const keyId = Number(entry?.keyId);
      const pub = toBufferOrNull(entry?.pubKey);
      const priv = toBufferOrNull(entry?.privKey);
      if (!Number.isFinite(keyId) || !pub || !priv) return null;
      return { keyId, pub, priv };
    })
    .filter((entry): entry is { keyId: number; pub: Buffer; priv: Buffer } => !!entry);
  const maxImportedPreKeyId = importedPreKeys.reduce(
    (max, entry) => Math.max(max, entry.keyId),
    0
  );

  if (!device?.registrationId || !Number(device.registrationId)) {
    throw new AppError("Credenciais inválidas: registrationId ausente.", 400);
  }

  if (!noisePub || !noisePriv) {
    throw new AppError("Credenciais inválidas: noiseKey ausente.", 400);
  }

  if (!identityPub || !identityPriv) {
    throw new AppError("Credenciais inválidas: identityKey ausente.", 400);
  }

  if (!signedPreKeyPub || !signedPreKeyPriv || !signedPreKeySignature) {
    throw new AppError("Credenciais inválidas: signedPreKey ausente.", 400);
  }

  if (!device?.account || typeof device.account !== "object") {
    throw new AppError("Credenciais inválidas: account ausente.", 400);
  }

  if (!meJid) {
    throw new AppError("Credenciais inválidas: meJid ausente.", 400);
  }

  const { BufferJSON, initAuthCreds } = await getBaileys();
  const creds: any = initAuthCreds();
  Object.assign(creds, isPlainRecord(decoded.creds) ? decoded.creds : {});

  creds.registrationId = Number(device.registrationId);
  creds.noiseKey = {
    public: noisePub,
    private: noisePriv
  };
  creds.signedIdentityKey = {
    public: identityPub,
    private: identityPriv
  };
  creds.signedPreKey = {
    keyId: Number(device?.signedPreKey?.keyId || 0),
    keyPair: {
      public: signedPreKeyPub,
      private: signedPreKeyPriv
    },
    signature: signedPreKeySignature
  };
  // Algumas versões do WA Web limpam o advSecretKey após o pareamento.
  // Nesses casos mantemos o valor default do initAuthCreds()/dump bruto.
  if (advSecretKey) {
    creds.advSecretKey = advSecretKey;
  }
  creds.account = device.account;
  creds.platform = String(device.platform || "web");
  creds.registered = true;
  creds.processedHistoryMessages = Array.isArray(creds.processedHistoryMessages)
    ? creds.processedHistoryMessages
    : [];
  creds.accountSyncCounter = Number.isFinite(Number(creds.accountSyncCounter))
    ? Number(creds.accountSyncCounter)
    : 0;
  // Se importamos one-time prekeys, o proximo id gerado localmente precisa
  // ficar acima do maior id ja publicado no servidor pela sessao de origem —
  // senao o Baileys recicla ids que o servidor ja entrega pra outros contatos.
  const minNextPreKeyId = maxImportedPreKeyId > 0 ? maxImportedPreKeyId + 1 : 1;
  creds.nextPreKeyId = Number.isFinite(Number(creds.nextPreKeyId)) && Number(creds.nextPreKeyId) > minNextPreKeyId
    ? Number(creds.nextPreKeyId)
    : minNextPreKeyId;
  creds.firstUnuploadedPreKeyId =
    Number.isFinite(Number(creds.firstUnuploadedPreKeyId)) &&
    Number(creds.firstUnuploadedPreKeyId) > minNextPreKeyId
      ? Number(creds.firstUnuploadedPreKeyId)
      : minNextPreKeyId;
  creds.accountSettings = isPlainRecord(creds.accountSettings)
    ? creds.accountSettings
    : { unarchiveChats: false };

  creds.me = {
    ...(isPlainRecord(creds.me) ? creds.me : {}),
    id: meJid,
    lid: device.meLid ? String(device.meLid) : creds?.me?.lid,
    name: device.meDisplayName ? String(device.meDisplayName) : creds?.me?.name
  };

  const keys: Record<string, Record<string, any>> = {};
  const rawKeys = isPlainRecord(decoded.keys) ? decoded.keys : {};

  KEY_BUCKET_ALIASES.forEach(([bucket, aliases]) => {
    const foundAlias = aliases.find(alias => isPlainRecord(rawKeys[alias]));
    if (!foundAlias) return;
    keys[bucket] = decodeWrappedBuffer(rawKeys[foundAlias]);
  });

  if (importedPreKeys.length > 0) {
    keys.preKeys = keys.preKeys || {};
    importedPreKeys.forEach(({ keyId, pub, priv }) => {
      keys.preKeys[String(keyId)] = { public: pub, private: priv };
    });
  }

  const appStateSyncKeys = Array.isArray(decoded.appStateSyncKeys)
    ? decoded.appStateSyncKeys
    : [];
  if (appStateSyncKeys.length > 0) {
    keys.appStateSyncKeys = keys.appStateSyncKeys || {};
    appStateSyncKeys.forEach((entry: any) => {
      const normalizedEntry = decodeWrappedBuffer(entry);
      const keyId = toBufferOrNull(normalizedEntry?.keyId);
      keys.appStateSyncKeys[encodeAppStateKeyId(keyId)] = normalizedEntry;
    });
  }

  const appStateVersions = Array.isArray(decoded.appStateVersions)
    ? decoded.appStateVersions
    : [];
  if (appStateVersions.length > 0) {
    keys.appStateVersions = keys.appStateVersions || {};
    appStateVersions.forEach((entry: any) => {
      const normalizedEntry = decodeWrappedBuffer(entry);
      const collection = String(normalizedEntry?.collection || "").trim();
      if (!collection) return;
      keys.appStateVersions[collection] = normalizedEntry;
    });
  }

  clearSessionRuntimeState(whatsapp.id);
  await removeWbot(whatsapp.id, false);
  await cacheLayer.delFromPattern(`sessions:${whatsapp.id}:*`);

  await whatsapp.update({
    session: JSON.stringify({ creds, keys }, BufferJSON.replacer, 0),
    qrcode: "",
    retries: 0,
    status: "DISCONNECTED",
    number: extractDigitsFromJid(meJid)
  });

  await StartWhatsAppSession(whatsapp, whatsapp.companyId);

  return {
    meJid
  };
};
