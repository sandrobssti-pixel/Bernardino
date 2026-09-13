import * as Sentry from "@sentry/node";
import { SocksProxyAgent } from "socks-proxy-agent";

import type { GroupMetadata, WAMessage, WAMessageKey, WASocket } from "baileys";

import Whatsapp from "../models/Whatsapp";
import logger from "../utils/logger";
import authState from "../helpers/authState";
import { Boom } from "@hapi/boom";
import AppError from "../errors/AppError";
import { getIO } from "./socket";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import cacheLayer from "./cache";
import ImportWhatsAppMessageService from "../services/WhatsappService/ImportWhatsAppMessageService";
import { add } from "date-fns";
import moment from "moment";
import { getTypeMessage, isValidMsg } from "../services/WbotServices/wbotMessageListener";
import { addLogs } from "../helpers/addLogs";
import NodeCache from "node-cache";
import type { Store } from "./store";
import qrcode from "qrcode-terminal"; // QR no terminal para debug / instalações novas
import { dynamicImport } from "../utils/dynamicImport";

type LIDMappingStoreType = import("baileys/lib/Signal/lid-mapping").LIDMappingStore;
type LIDMappingStoreCtor = typeof import("baileys/lib/Signal/lid-mapping").LIDMappingStore;

let baileysMod: typeof import("baileys") | null = null;
async function getBaileys() {
  if (!baileysMod) baileysMod = await dynamicImport("baileys");
  return baileysMod;
}

let baileysLoggerMod: typeof import("baileys/lib/Utils/logger") | null = null;
async function getBaileysLogger() {
  if (!baileysLoggerMod)
    baileysLoggerMod = await dynamicImport("baileys/lib/Utils/logger.js");
  return baileysLoggerMod.default.child({});
}

let lidMappingStoreCtor: LIDMappingStoreCtor | null = null;
async function getLidMappingStoreCtor() {
  if (!lidMappingStoreCtor) {
    const lidMappingMod = await dynamicImport(
      "baileys/lib/Signal/lid-mapping.js"
    );
    lidMappingStoreCtor = lidMappingMod.LIDMappingStore;
  }
  return lidMappingStoreCtor;
}

// --- Caches de retry e mensagens ---
const msgRetryCounterCache = new NodeCache({
  stdTTL: 600,
  maxKeys: 1000,
  checkperiod: 300,
  useClones: false
});

const msgCache = new NodeCache({
  stdTTL: 60,
  maxKeys: 1000,
  checkperiod: 300,
  useClones: false
});

const placeholderResendCache = new NodeCache({
  stdTTL: 300,
  maxKeys: 5000,
  checkperiod: 120,
  useClones: false
});

let loggerBaileys: any = logger;
loggerBaileys.level = "error";

type Session = WASocket & {
  id?: number;
  companyId?: number; // 🔒 empresa dona da sessão
  store?: Store | any;
  _contactsCache?: Map<string, any>;
  lidMappingStore?: LIDMappingStoreType;
};

const sessions: Session[] = [];

export const upsertWbotSession = (
  session: any,
  whatsappId: number,
  companyId: number
): void => {
  const idx = sessions.findIndex(s => s.id === whatsappId);
  session.id = whatsappId;
  session.companyId = companyId;
  if (idx === -1) sessions.push(session);
  else sessions[idx] = session;
};

// --- Estados de proteção e reconexão ---
const badMacState = new Map<number, { count: number; last: number }>();
const reconnectAttemptMap = new Map<number, number>();
const reconnectLock = new Map<number, boolean>();
const reconnectTimers = new Map<number, NodeJS.Timeout>();
const startingSessions = new Set<number>();
const retriesQrCodeMap = new Map<number, number>();

// --- Rate limit extra (para 403/geral) ---
const reconnectAttempts403 = new Map<number, number>();
const lastReconnectTime = new Map<number, number>();
const MIN_RECONNECT_INTERVAL = 10_000; // 10s

// --- Flag para saber se estamos em "new login" (QR recém escaneado) ---
const newLoginFlag = new Map<number, boolean>();

// --- Cache de metadados de grupos ---
const groupCache = new NodeCache({
  stdTTL: 3600,
  maxKeys: 10000,
  checkperiod: 600,
  useClones: false
});

// helper limpar timer/backoff
const clearReconnectTimer = (wid: number) => {
  const t = reconnectTimers.get(wid);
  if (t) clearTimeout(t);
  reconnectTimers.delete(wid);
  reconnectLock.set(wid, false);
  reconnectAttemptMap.set(wid, 0);
};

export const clearSessionRuntimeState = (wid: number) => {
  clearReconnectTimer(wid);
  reconnectAttempts403.delete(wid);
  lastReconnectTime.delete(wid);
  newLoginFlag.delete(wid);
  badMacState.delete(wid);
  retriesQrCodeMap.delete(wid);
  reconnectAttemptMap.delete(wid);
  reconnectLock.delete(wid);
  startingSessions.delete(wid);
};

// DB de mensagens para quoted/getMessage
export default function msg() {
  return {
    get: (key: WAMessageKey) => {
      const { id } = key;
      if (!id) return;
      const data = msgCache.get(id);
      if (data) {
        try {
          const msg = JSON.parse(data as string);
          return msg?.message;
        } catch (e) {
          logger.error(e);
        }
      }
    },
    save: (m: WAMessage) => {
      const { id } = m.key;
      const s = JSON.stringify(m);
      try {
        msgCache.set(id as string, s);
      } catch (e) {
        logger.error(e);
      }
    }
  };
}

export var dataMessages: any = {};
export const msgDB = msg();

// 🔒 Agora aceita opcionalmente companyId para garantir que a sessão é da empresa correta
export const getWbot = (whatsappId: number, companyId?: number): Session => {
  const idx = sessions.findIndex(s => {
    if (s.id !== whatsappId) return false;
    if (companyId != null && s.companyId != null) {
      return s.companyId === companyId;
    }
    return true;
  });

  if (idx === -1) throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  return sessions[idx];
};

export const tryGetWbot = (whatsappId: number, companyId?: number): Session | null => {
  const idx = sessions.findIndex(s => {
    if (s.id !== whatsappId) return false;
    if (companyId != null && s.companyId != null) {
      return s.companyId === companyId;
    }
    return true;
  });
  return idx === -1 ? null : sessions[idx];
};

export const getKnownContacts = (whatsappId: number): string[] => {
  try {
    const w = getWbot(whatsappId);
    const ids = Array.from(w?._contactsCache?.keys?.() || []);
    return ids.filter(j => j && j.endsWith("@s.whatsapp.net"));
  } catch {
    return [];
  }
};

export const ensureContactSyncKick = async (whatsappId: number): Promise<string[]> => {
  const w = getWbot(whatsappId);
  let spins = 20;
  while (spins-- > 0) {
    if ((w as any)?.user?.id) break;
    await new Promise(r => setTimeout(r, 500));
  }
  const before = (w?._contactsCache?.size ?? 0);
  try {
    await w?.presenceSubscribe?.((w as any)?.user?.id || "");
  } catch {}
  try {
    await new Promise(r => setTimeout(r, 300));
  } catch {}
  let attempts = 10;
  while (attempts-- > 0) {
    const now = (w?._contactsCache?.size ?? 0);
    if (now > before) break;
    await new Promise(r => setTimeout(r, 500));
  }
  return getKnownContacts(whatsappId);
};

export const restartWbot = async (companyId: number): Promise<void> => {
  try {
    const whatsapps = await Whatsapp.findAll({
      where: { companyId }
    });
    for (const w of whatsapps) {
      if (w.channel !== "whatsapp") continue;
      if (w.status === "DISCONNECTED") continue;
      const isWuzapi =
        String((w as any)?.provider || "").toLowerCase() === "wuzapi";
      clearSessionRuntimeState(w.id);
      try {
        const idx = sessions.findIndex(s => s.id === w.id);
        if (idx !== -1 && !isWuzapi) (sessions[idx] as any)?.ws?.close?.();
      } catch {}
      await removeWbot(w.id, false, !isWuzapi);
      if (startingSessions.has(w.id)) continue;
      startingSessions.add(w.id);
      setTimeout(() => {
        StartWhatsAppSession(w, w.companyId).finally(() => startingSessions.delete(w.id));
      }, 1500);
    }
  } catch (err) {
    logger.error(err);
  }
};

export const removeWbot = async (
  whatsappId: number,
  isLogout = true,
  shouldCloseWs = true
): Promise<void> => {
  try {
    const idx = sessions.findIndex(s => s.id === whatsappId);
    if (idx !== -1) {
      try {
        if (isLogout) await sessions[idx].logout?.();
      } catch {}
      try {
        if (shouldCloseWs) {
          (sessions[idx] as any)?.ws?.close?.();
        }
      } catch {}
      try {
        (sessions[idx] as any)?.ev?.removeAllListeners?.();
      } catch {}
      sessions.splice(idx, 1);
    }
  } catch (err) {
    logger.error(err);
  }
};

// --- scheduleReconnect com lock/backoff + rate-limit ---
const scheduleReconnect = (what: Whatsapp, delayMs = 0, reasonText = "") => {
  const wid = what.id;
  if (reconnectLock.get(wid)) return;
  reconnectLock.set(wid, true);

  const attempt = Math.min((reconnectAttemptMap.get(wid) || 0) + 1, 6);
  const base = Math.pow(2, attempt) * 1000;
  let wait = Math.max(5000, Math.max(base, delayMs)); // min 5s

  const now = Date.now();
  const last = lastReconnectTime.get(wid) || 0;
  if (now - last < MIN_RECONNECT_INTERVAL) {
    wait = Math.max(wait, MIN_RECONNECT_INTERVAL - (now - last) + 500);
  }
  lastReconnectTime.set(wid, now + wait);

  logger.info(
    `Session ${what.name} disconnected ${reasonText ? `[${reasonText}] ` : ""}- Reconnecting in ${wait}ms (attempt ${attempt})`
  );

  clearReconnectTimer(wid);
  const timer = setTimeout(async () => {
    reconnectLock.set(wid, false);
    reconnectTimers.delete(wid);
    if (startingSessions.has(wid)) return;
    startingSessions.add(wid);
    try {
      await StartWhatsAppSession(what, what.companyId);
    } finally {
      startingSessions.delete(wid);
    }
  }, wait);
  reconnectAttemptMap.set(wid, attempt);
  reconnectTimers.set(wid, timer);
};

export const initWASocket = async (whatsapp: Whatsapp): Promise<Session> => {
  return new Promise((resolve, reject) => {
    try {
      void (async () => {
        const io = getIO();
        const {
          default: makeWASocket,
          Browsers,
          DisconnectReason,
          fetchLatestBaileysVersion,
          isJidBroadcast,
          jidNormalizedUser,
          makeCacheableSignalKeyStore
        } = await getBaileys();
        loggerBaileys = await getBaileysLogger();
        loggerBaileys.level = "error";

        const whatsappUpdate = await Whatsapp.findOne({ where: { id: whatsapp.id } });
        if (!whatsappUpdate) {
          reject(new Error(`ERR_WAPP_NOT_FOUND: ${whatsapp.id}`));
          return;
        }

        const { id, name, allowGroup, companyId, proxyUrl } = whatsappUpdate;
        let settled = false;
        const settleResolve = (value: Session) => {
          if (settled) return;
          settled = true;
          clearTimeout(initTimeout);
          resolve(value);
        };
        const settleReject = (error: any) => {
          if (settled) return;
          settled = true;
          clearTimeout(initTimeout);
          reject(error);
        };
        const initTimeout = setTimeout(async () => {
          logger.error(
            `Session ${name} init timeout: não recebeu open/qr dentro do prazo`
          );
          try {
            const current = await Whatsapp.findByPk(id);
            if (current?.status === "OPENING") {
              await current.update({ status: "DISCONNECTED", qrcode: "" });
              io.of(String(companyId)).emit(
                `company-${companyId}-whatsappSession`,
                { action: "update", session: current }
              );
            }
            await removeWbot(id, false);
          } catch (timeoutErr) {
            logger.error(timeoutErr);
          }
          settleReject(new Error(`ERR_WAPP_INIT_TIMEOUT: ${id}`));
        }, 90_000);

        // 1) Obter versão RECOMENDADA pelo Baileys v7 (com fallback seguro)
        let waVersion: [number, number, number] | undefined;
        try {
          const { version, isLatest } = await fetchLatestBaileysVersion();
          if (isLatest) {
            waVersion = version;
            logger.info(`(Recomendado) WA Web v${version.join(".")} | isLatest:${isLatest}`);
            logger.info(`Iniciando sessão ${name} com Baileys v7 + WAWeb ${version.join(".")}`);
          } else {
            waVersion = undefined;
            logger.warn(
              `fetchLatestBaileysVersion retornou isLatest=false para ${version.join(".")}. Iniciando sessão ${name} sem version fixa para evitar 515.`
            );
          }
        } catch (e: any) {
          waVersion = undefined;
          logger.warn(
            `fetchLatestBaileysVersion falhou (${e?.message || e}). Iniciando sessão ${name} sem version fixa.`
          );
        }

        logger.info(`Starting session ${name}`);
        let retriesQrCode = 0;

        let wsocket: Session = null;

        const { state, saveState } = await authState(whatsapp);
        const signalKeyStore = makeCacheableSignalKeyStore(state.keys as any, loggerBaileys);

        // 2) Cache de metadata de grupos
        const cachedGroupMetadata = async (jid: string): Promise<GroupMetadata> => {
          let data: GroupMetadata | undefined = groupCache.get(jid);
          if (data) return data;
          const result = await wsocket.groupMetadata(jid);
          groupCache.set(jid, result);
          return result;
        };

        const shouldImportHistory = Boolean(whatsappUpdate.importOldMessages);

        // 3) SOCKET em modo de compatibilidade (isolar regressão pós-WuzAPI)
        const socketOptions: any = {
          logger: loggerBaileys,
          // printQRInTerminal está deprecated; mantemos false e usamos qrcode-terminal manualmente
          printQRInTerminal: false,
          auth: {
            creds: state.creds,
            keys: signalKeyStore
          },
          browser: Browsers.ubuntu("Chrome"),
          qrTimeout: 120_000,
          defaultQueryTimeoutMs: 45_000,
          connectTimeoutMs: 60_000,
          keepAliveIntervalMs: 20_000,
          markOnlineOnConnect: true,
          msgRetryCounterCache,
          getMessage: async (key: WAMessageKey) => msgDB.get(key as any),
          cachedGroupMetadata,
          syncFullHistory: shouldImportHistory,
          fireInitQueries: true,
          shouldSyncHistoryMessage: () => shouldImportHistory,

          // Nunca ignorar grupos no nível do socket.
          // O tratamento de negócio deve ocorrer no listener para evitar
          // "silêncio" total quando uma configuração de UI estiver inconsistente.
          shouldIgnoreJid: jid => isJidBroadcast(jid),
        };
        logger.info(
          `[IMPORT][${id}] History sync ${
            shouldImportHistory ? "habilitado" : "desabilitado"
          } na inicialização da sessão.`
        );
        if (waVersion) {
          socketOptions.version = waVersion;
        }

        if (proxyUrl) {
          try {
            const proxyAgent = new SocksProxyAgent(proxyUrl);
            socketOptions.agent = proxyAgent;
            socketOptions.fetchAgent = proxyAgent;
            const safeUrl = proxyUrl.replace(/:[^:@]*@/, ":***@");
            logger.info(`Session ${name} usando proxy SOCKS5: ${safeUrl}`);
          } catch (proxyErr: any) {
            logger.warn(
              `Session ${name} proxyUrl inválido (${proxyUrl}), desativando: ${proxyErr?.message}`
            );
            await whatsappUpdate.update({ proxyUrl: null });
          }
        }

        wsocket = makeWASocket(socketOptions);

        // 5) Caches expostos (compat)
        wsocket._contactsCache = new Map<string, any>();
        (wsocket as any).store = { contacts: {} };

        // 6) Popular caches de contatos/chats
        wsocket.ev.process(async (events: any) => {
          if (events["contacts.set"]) {
            try {
              const { contacts } = events["contacts.set"] as any;
              for (const c of contacts || []) {
                const jid = (c as any)?.id;
                if (!jid) continue;
                wsocket._contactsCache!.set(jid, c);
                (wsocket as any).store.contacts[jid] = c;
              }
            } catch (e) {
              logger.warn(`contacts.set cache error: ${(e as any)?.message}`);
            }
          }
          if (events["chats.set"]) {
            try {
              const { chats } = events["chats.set"] as any;
              for (const ch of chats || []) {
                const jid = (ch as any)?.id;
                if (!jid) continue;
                if (!wsocket._contactsCache!.has(jid)) {
                  const basic = { id: jid };
                  wsocket._contactsCache!.set(jid, basic);
                  (wsocket as any).store.contacts[jid] = basic;
                }
              }
            } catch (e) {
              logger.warn(`chats.set cache error: ${(e as any)?.message}`);
            }
          }
          if (events["contacts.upsert"]) {
            const list = (events["contacts.upsert"] as any) || [];
            for (const c of list) {
              const jid = (c as any)?.id;
              if (!jid) continue;
              wsocket._contactsCache!.set(jid, c);
              (wsocket as any).store.contacts[jid] = c;
            }
          }
          if (events["contacts.update"]) {
            const list = (events["contacts.update"] as any) || [];
            for (const c of list) {
              const jid = (c as any)?.id;
              if (!jid) continue;
              const prev = wsocket._contactsCache!.get(jid) || {};
              const merged = { ...prev, ...c };
              wsocket._contactsCache!.set(jid, merged);
              (wsocket as any).store.contacts[jid] = merged;
            }
          }
          if (events["chats.upsert"]) {
            const chats = (events["chats.upsert"] as any)?.[0]?.list || [];
            for (const ch of chats) {
              const jid = (ch as any)?.id;
              if (!jid) continue;
              if (!wsocket._contactsCache!.has(jid)) {
                const basic = { id: jid };
                wsocket._contactsCache!.set(jid, basic);
                (wsocket as any).store.contacts[jid] = basic;
              }
            }
          }
        });

        let importConnectionOpen = false;

        // 8) Import de mensagens antigas – registra o listener imediatamente
        // para não perder `messaging-history.set` em conexões rápidas.
        (async () => {
          const wpp = await Whatsapp.findByPk(whatsapp.id);
          if (!wpp?.importOldMessages) return;
          logger.info(
            `[IMPORT][${wpp.id}] Importação habilitada (${wpp.importOldMessages} -> ${wpp.importRecentMessages}). Aguardando messaging-history.set...`
          );

          addLogs({
            fileName: `preparingImportMessagesWppId${whatsapp.id}.txt`,
            forceNewFile: true,
            text: `Aguardando conexão para iniciar a importação de mensagens:
  Whatsapp nome: ${wpp.name}
  Whatsapp Id: ${wpp.id}
  Criação do arquivo de logs: ${moment().format("DD/MM/YYYY HH:mm:ss")}
  Selecionado Data de inicio de importação: ${moment(new Date(wpp.importOldMessages).getTime()).format("DD/MM/YYYY HH:mm:ss")}
  Selecionado Data final da importação: ${moment(new Date(wpp.importRecentMessages).getTime()).format("DD/MM/YYYY HH:mm:ss")}
  `
          });
          let importUiInitialized = false;
          wsocket.ev.on("messaging-history.set", async (messageSet: any) => {
            try {
              const currentWpp = await Whatsapp.findByPk(whatsapp.id);
              if (!currentWpp?.importOldMessages) {
                logger.info(`[IMPORT][${whatsapp.id}] Ignorando lote: importOldMessages desabilitado`);
                return;
              }
              if (currentWpp.status !== "CONNECTED") {
                logger.info(
                  `[IMPORT][${whatsapp.id}] Lote recebido antes de CONNECTED (status=${currentWpp.status}); mantendo para processamento`
                );
              }

              const dateOldLimit = new Date(currentWpp.importOldMessages).getTime();
              const dateRecentLimit = new Date(currentWpp.importRecentMessages).getTime();

              logger.info(
                `[IMPORT][${whatsapp.id}] messaging-history.set recebido com ${
                  messageSet?.messages?.length || 0
                } mensagens`
              );
              const statusImportMessages2 = Date.now();
              await currentWpp.update({ statusImportMessages: statusImportMessages2 });

              if (!importUiInitialized && importConnectionOpen) {
                io.of(String(companyId)).emit(`importMessages-${currentWpp.companyId}`, {
                  action: "update",
                  status: { this: -1, all: -1 }
                });
                importUiInitialized = true;
              } else if (!importUiInitialized) {
                logger.info(
                  `[IMPORT][${whatsapp.id}] UI de import ainda não exibida; aguardando connection=open`
                );
              }

              const whatsappId = whatsapp.id;
              const filteredMessages = messageSet?.messages || [];
              const filteredDateMessages: any[] = [];

              filteredMessages.forEach(msg => {
                const rawTs: any = msg?.messageTimestamp;
                const tsSeconds =
                  typeof rawTs === "number"
                    ? rawTs
                    : Number(rawTs?.low ?? rawTs);
                if (!Number.isFinite(tsSeconds)) {
                  logger.warn(
                    `[IMPORT][${whatsapp.id}] Mensagem sem timestamp válido (${msg?.key?.id || "sem-id"})`
                  );
                  return;
                }
                const timestampMsg = Math.floor(tsSeconds * 1000);
                if (isValidMsg(msg) && dateOldLimit < timestampMsg && dateRecentLimit > timestampMsg) {
                  if (msg.key?.remoteJid.split("@")[1] !== "g.us") {
                    addLogs({
                      fileName: `preparingImportMessagesWppId${whatsapp.id}.txt`,
                      text: `Adicionando mensagem para pos processamento:
  Não é Mensagem de GRUPO >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  Data e hora da mensagem: ${moment(timestampMsg).format("DD/MM/YYYY HH:mm:ss")}
  Contato da Mensagem : ${msg.key?.remoteJid}
  Tipo da mensagem : ${getTypeMessage(msg)}
  
  `
                    });
                    filteredDateMessages.push(msg);
                  } else if (currentWpp?.importOldMessagesGroups) {
                    addLogs({
                      fileName: `preparingImportMessagesWppId${whatsapp.id}.txt`,
                      text: `Adicionando mensagem para pos processamento:
  Mensagem de GRUPO >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  Data e hora da mensagem: ${moment(timestampMsg).format("DD/MM/YYYY HH:mm:ss")}
  Contato da Mensagem : ${msg.key?.remoteJid}
  Tipo da mensagem : ${getTypeMessage(msg)}
  
  `
                    });
                    filteredDateMessages.push(msg);
                  }
                }
              });

              if (!dataMessages?.[whatsappId]) dataMessages[whatsappId] = [];
              dataMessages[whatsappId].unshift(...filteredDateMessages);
              logger.info(
                `[IMPORT][${whatsapp.id}] Lote filtrado=${filteredDateMessages.length}; acumulado=${dataMessages[whatsappId].length}`
              );

              setTimeout(async () => {
                const wpp2 = await Whatsapp.findByPk(whatsappId);
                if (importConnectionOpen) {
                  io.of(String(companyId)).emit(`importMessages-${wpp2.companyId}`, {
                    action: "update",
                    status: { this: -1, all: -1 }
                  });
                }
                io.of(String(companyId)).emit(`company-${companyId}-whatsappSession`, {
                  action: "update",
                  session: wpp2
                });
              }, 500);

              setTimeout(async () => {
                const wpp3 = await Whatsapp.findByPk(whatsappId);
                if (wpp3?.importOldMessages) {
                  const isTimeStamp = !isNaN(
                    new Date(Math.floor(parseInt(String(wpp3?.statusImportMessages)))).getTime()
                  );
                  if (isTimeStamp) {
                    const ultimoStatus = new Date(
                      Math.floor(parseInt(String(wpp3?.statusImportMessages)))
                    ).getTime();
                    const dataLimite = +add(ultimoStatus, { seconds: +45 }).getTime();
                    if (dataLimite < Date.now()) {
                      logger.info(
                        `[IMPORT][${whatsapp.id}] Janela de 45s atingida; disparando ImportWhatsAppMessageService`
                      );
                      ImportWhatsAppMessageService(wpp3.id);
                      wpp3.update({ statusImportMessages: "Running" });
                    } else {
                      logger.info(
                        `[IMPORT][${whatsapp.id}] Ainda recebendo lotes; aguardando próximo ciclo de 45s`
                      );
                    }
                  } else {
                    logger.info(
                      `[IMPORT][${whatsapp.id}] statusImportMessages inválido para disparo (${wpp3?.statusImportMessages})`
                    );
                  }
                }
                io.of(String(companyId)).emit(`company-${companyId}-whatsappSession`, {
                  action: "update",
                  session: wpp3
                });
              }, 1000 * 45);
            } catch (error: any) {
              logger.error(
                `[IMPORT][${whatsapp.id}] Falha no handler messaging-history.set: ${error?.message || error}`
              );
            }
          });
        })();

        // ========================================================================
        // 9) Bloco connection.update CORRIGIDO
        // ========================================================================
        wsocket.ev.on("connection.update", async update => {
          const safe = JSON.stringify(
            update,
            (k, v) => (k === "qr" && typeof v === "string" ? "***qr omitted***" : v)
          );
          logger.info(`Connection Update: ${safe}`);

          const { connection, lastDisconnect, qr } = update;

          const errorBoom = lastDisconnect?.error as Boom | undefined;
          const statusCode = Number(errorBoom?.output?.statusCode || 0);
          const errorMessage = (lastDisconnect as any)?.error?.message || "";

          // Se este update sinalizar "new login", marcamos numa flag global
          if ((update as any)?.isNewLogin) {
            newLoginFlag.set(id, true);
          }

          if (connection === "close") {
            importConnectionOpen = false;
            // calculamos se estávamos em new login recentemente
            const wasNewLogin = newLoginFlag.get(id) === true;

            // connection replaced
            if (statusCode === DisconnectReason.connectionReplaced) {
              logger.warn(
                `Session ${name} connectionReplaced — outra instância ativa. Não vou reconectar aqui.`
              );
              clearReconnectTimer(id);
              newLoginFlag.delete(id);
              await removeWbot(id, false);
              return;
            }

            // 401 / loggedOut - APENAS AQUI CHAMAMOS DeleteBaileysService
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
              const isIntentionalLogout = /Intentional Logout/i.test(errorMessage || "");

              if (isIntentionalLogout) {
                // Logout feito pelo painel (desconectar conexão)
                logger.warn(
                  `Session ${name} logout intencional (via painel). Não será feito auto-reconnect.`
                );
                clearReconnectTimer(id);
                newLoginFlag.delete(id);
                // Aqui normalmente DeleteBaileysService já foi chamado pela rota de logout
                await removeWbot(id, false);
                return;
              }

              // Logout vindo do celular / servidor => tratamos como antes
              logger.warn(`Session ${name} logged out (401). Limpando sessão e marcando como DISCONNECTED`);
              
              await DeleteBaileysService(whatsapp.id);
              await whatsapp.update({
                status: "DISCONNECTED",
                session: "",
                qrcode: "",
                number: ""
              });
              
              await cacheLayer.delFromPattern(`sessions:${whatsapp.id}:*`);
              io.of(String(companyId)).emit(
                `company-${whatsapp.companyId}-whatsappSession`,
                { action: "update", session: whatsapp }
              );
              
              clearReconnectTimer(id);
              newLoginFlag.delete(id);
              await removeWbot(id, false);
              
              // Aguarda comando manual para novo QR
              logger.info(`Session ${name} desconectada. Aguardando comando manual para novo QR.`);
              return;
            }

            // Bad MAC / integridade de chaves
            if (/bad mac|mac check|integrity|invalid mac|checksum/i.test(errorMessage)) {
              logger.warn(
                `Session ${name} key integrity error (Bad MAC), clearing sessão`
              );
              await whatsapp.update({
                status: "DISCONNECTED",
                session: "",
                qrcode: ""
              });
              await DeleteBaileysService(whatsapp.id);
              await cacheLayer.delFromPattern(`sessions:${whatsapp.id}:*`);
              io.of(String(companyId)).emit(
                `company-${whatsapp.companyId}-whatsappSession`,
                { action: "update", session: whatsapp }
              );
              clearReconnectTimer(id);
              newLoginFlag.delete(id);
              await removeWbot(id, false);
              scheduleReconnect(whatsapp, 5000, "bad-mac");
              return;
            }

            // ========================================================================
            // CORREÇÃO 515 - TRATAMENTO SIMPLIFICADO
            // ========================================================================
            if (statusCode === 515) {
              const currentWpp = await Whatsapp.findByPk(id);
              const currentStatus = currentWpp?.status;
              const shouldHardResetNow =
                wasNewLogin || currentStatus === "OPENING" || currentStatus === "qrcode";

              if (shouldHardResetNow) {
                logger.warn(
                  `Session ${name} recebeu erro 515 durante login (status=${currentStatus}, isNewLogin=${wasNewLogin}). Preservando credenciais e tentando reconnect automático.`
                );
                clearReconnectTimer(id);
                newLoginFlag.delete(id);
                await removeWbot(id, false);
                scheduleReconnect(whatsapp, 3000, "515-newlogin-preserve-creds");
                return;
              }

              logger.warn(
                `Session ${name} desconectada com erro 515 (stream) (isNewLogin=${wasNewLogin}) — tratando como erro transitório, sem limpar sessão`
              );

              const attempts = reconnectAttemptMap.get(id) || 0;
              const nextAttempt = attempts + 1;
              const delay = Math.min(30000, 5000 * nextAttempt); // 5s, 10s, 15s... máx 30s

              reconnectAttemptMap.set(id, nextAttempt);

              if (nextAttempt >= 6) {
                logger.error(
                  `Session ${name} recebeu erro 515 repetido (${nextAttempt}x). Limpando credenciais para forçar novo QR.`
                );
                await whatsapp.update({
                  status: "DISCONNECTED",
                  session: "",
                  qrcode: "",
                  number: ""
                });
                await DeleteBaileysService(whatsapp.id);
                await cacheLayer.delFromPattern(`sessions:${whatsapp.id}:*`);
                io.of(String(companyId)).emit(
                  `company-${whatsapp.companyId}-whatsappSession`,
                  { action: "update", session: whatsapp }
                );
                clearReconnectTimer(id);
                reconnectAttemptMap.delete(id);
                newLoginFlag.delete(id);
                await removeWbot(id, false);
                return;
              }

              logger.info(
                `Session ${name} disconnected (code 515). Reconnecting in ${delay}ms (attempt ${nextAttempt})`
              );

              clearReconnectTimer(id);
              newLoginFlag.delete(id);
              await removeWbot(id, false);

              setTimeout(() => {
                StartWhatsAppSession(whatsapp, companyId).catch(err =>
                  logger.error(
                    `Erro ao tentar reconectar sessão ${name} após 515:`,
                    err
                  )
                );
              }, delay);

              return;
            }
            // ========================================================================
            // FIM CORREÇÃO 515
            // ========================================================================

            // 403 com tentativas inteligentes
            if (statusCode === 403) {
              const attempts = reconnectAttempts403.get(id) || 0;
              if (attempts < 5) {
                reconnectAttempts403.set(id, attempts + 1);
                const delays = [2000, 5000, 10000, 30000, 60000];
                clearReconnectTimer(id);
                newLoginFlag.delete(id);
                await removeWbot(id, false);
                scheduleReconnect(whatsapp, delays[attempts], `403 tentativa ${attempts + 1}`);
                return;
              } else {
                logger.error(
                  `403 persistente para ${name} — deletando sessão após 5 tentativas`
                );
                reconnectAttempts403.delete(id);
                await whatsapp.update({
                  status: "PENDING",
                  session: "",
                  number: ""
                });
                await DeleteBaileysService(whatsapp.id);
                clearReconnectTimer(id);
                newLoginFlag.delete(id);
                await removeWbot(id, false);
                io.of(String(companyId)).emit(
                  `company-${whatsapp.companyId}-whatsappSession`,
                  { action: "update", session: whatsapp }
                );
                scheduleReconnect(whatsapp, 5000, "403-reset");
                return;
              }
            }

            // Fallback proxy: se proxyUrl está configurado e ocorreu erro de rede (código 0),
            // remove o proxy e deixa o fluxo de reconexão normal tentar sem proxy.
            if (statusCode === 0 || !statusCode) {
              const wppForProxy = await Whatsapp.findByPk(id);
              if (wppForProxy?.proxyUrl) {
                const safeUrl = wppForProxy.proxyUrl.replace(/:[^:@]*@/, ":***@");
                logger.warn(
                  `Session ${name}: falha de rede com proxy ${safeUrl}. Removendo proxy e reconectando sem proxy.`
                );
                await wppForProxy.update({ proxyUrl: null });
                io.of(String(companyId)).emit(
                  `company-${companyId}-whatsappSession`,
                  { action: "update", session: { ...wppForProxy.get({ plain: true }), proxyUrl: null } }
                );
                clearReconnectTimer(id);
                newLoginFlag.delete(id);
                await removeWbot(id, false);
                scheduleReconnect(whatsapp, 3000, "proxy-fallback");
                return;
              }
            }

            // transitórios padrão (410/428/440/499/5xx/0)
            const transientCodes = new Set([410, 428, 440, 499]);
            if (transientCodes.has(statusCode) || statusCode >= 500 || statusCode === 0) {
              logger.info(
                `Session ${name} transient disconnect (code ${
                  statusCode || "?"
                }). Backoff reconnect.`
              );
              clearReconnectTimer(id);
              newLoginFlag.delete(id);
              await removeWbot(id, false);
              scheduleReconnect(whatsapp, 0, "transient");
              return;
            }

            // fallback
            clearReconnectTimer(id);
            newLoginFlag.delete(id);
            await removeWbot(id, false);
            scheduleReconnect(whatsapp, 0, "fallback");
            return;
          }

          if (connection === "open") {
            importConnectionOpen = true;
            // reset backoff/locks/timers/403/newLogin
            clearReconnectTimer(whatsapp.id);
            reconnectAttempts403.delete(id);
            lastReconnectTime.delete(id);
            newLoginFlag.delete(id);
            reconnectAttemptMap.delete(id); // Reset attempts on successful connection

            await whatsapp.update({
              status: "CONNECTED",
              qrcode: "",
              retries: 0,
              number:
                wsocket.type === "md"
                  ? jidNormalizedUser((wsocket as WASocket).user.id).split("@")[0]
                  : "-"
            });

            io.of(String(companyId)).emit(
              `company-${whatsapp.companyId}-whatsappSession`,
              {
                action: "update",
                session: whatsapp
              }
            );

            const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
            wsocket.id = whatsapp.id;
            wsocket.companyId = whatsapp.companyId; // 🔒 vincula sessão à empresa
            if (sessionIndex === -1) sessions.push(wsocket);
            else sessions[sessionIndex] = wsocket;

            // Auto-heal: garante bind do listener inbound mesmo após reconexões complexas.
            if (!(wsocket as any).__messagesUpsertListenerBound) {
              try {
                const mod = await import("../services/WbotServices/wbotMessageListener");
                mod.wbotMessageListener(wsocket as any, companyId);
                logger.warn(
                  `[WBOT][AUTOHEAL] messages.upsert listener reattached (session=${whatsapp.id})`
                );
              } catch (err: any) {
                logger.error(
                  `[WBOT][AUTOHEAL] failed to reattach messages.upsert listener (session=${whatsapp.id}): ${
                    err?.message || err
                  }`
                );
              }
            }

            // Importar contatos pós-conexão (leve delay)
            setTimeout(async () => {
              try {
                const { default: ImportContactsService } = await import(
                  "../services/WbotServices/ImportContactsService"
                );
                await ImportContactsService(companyId);
              } catch (e) {
                logger.warn(
                  `Falha ao rodar ImportContactsService pós-conexão: ${
                    (e as any)?.message
                  }`
                );
              }
            }, 8000);

            settleResolve(wsocket);
          }

          if (qr !== undefined) {
            retriesQrCodeMap.set(id, 0);
            logger.info(`Session QRCode Generate ${name}`);

            // QR no terminal também (manual, sem usar printQRInTerminal)
            try {
              qrcode.generate(qr, { small: true });
            } catch (err) {
              logger.warn(
                `Falha ao gerar QR no terminal: ${(err as any)?.message}`
              );
            }

            await whatsapp.update({
              qrcode: qr,
              status: "qrcode",
              retries: 0,
              number: ""
            });

            const idx = sessions.findIndex(s => s.id === whatsapp.id);
            wsocket.id = whatsapp.id;
            wsocket.companyId = whatsapp.companyId; // 🔒 garante empresa também no estado de QR
            if (idx === -1) sessions.push(wsocket);
            else sessions[idx] = wsocket;

            io.of(String(companyId)).emit(
              `company-${whatsapp.companyId}-whatsappSession`,
              {
                action: "update",
                session: whatsapp
              }
            );
            settleResolve(wsocket);

            // CORREÇÃO: timer de expiração do QR
            const oldQrTimer = reconnectTimers.get(id);
            if (oldQrTimer) clearTimeout(oldQrTimer);

            const qrTimer = setTimeout(async () => {
              reconnectTimers.delete(id);

              const current = await Whatsapp.findByPk(whatsapp.id);
              if (current?.status === "qrcode") {
                logger.info(`Regenerating QR Code for ${name} after timeout`);
                await removeWbot(id, false);
                scheduleReconnect(whatsapp, 2000, "qr-timeout");
              }
            }, 120_000);

            reconnectTimers.set(id, qrTimer);
          }
        });

        // 10) GARANTIA: registrar persistência de credenciais no estado legado
        wsocket.ev.on("creds.update", saveState);

        // 11) Debounce Bad MAC em upsert (mantido)
        wsocket.ev.on("messages.upsert", async () => {
          try {
            // processamento normal em wbotMessageListener
          } catch (error: any) {
            const msg = String(error?.message || "");
            if (/bad mac/i.test(msg)) {
              const now = Date.now();
              const prev = badMacState.get(id) ?? { count: 0, last: 0 };
              const within2min = now - prev.last < 120_000;
              const count = within2min ? prev.count + 1 : 1;
              badMacState.set(id, { count, last: now });

              if (count >= 3) {
                logger.error(
                  `Session ${name}: Bad MAC repetido (${count}x) — limpando sessão`
                );
                await whatsapp.update({
                  status: "DISCONNECTED",
                  session: "",
                  qrcode: ""
                });
                await DeleteBaileysService(whatsapp.id);
                await cacheLayer.delFromPattern(`sessions:${whatsapp.id}:*`);
                io.of(String(companyId)).emit(
                  `company-${whatsapp.companyId}-whatsappSession`,
                  {
                    action: "update",
                    session: whatsapp
                  }
                );
                await removeWbot(id, false);
                scheduleReconnect(whatsapp, 5000, "bad-mac-upsert");
              } else {
                logger.info(
                  `Session ${name}: Bad MAC transitório em upsert (${count}x). Backoff reconnect.`
                );
                await removeWbot(id, false);
                scheduleReconnect(whatsapp, 0, "bad-mac-upsert");
              }
            } else {
              logger.error(
                `Session ${name}: Message processing error: ${msg}`
              );
            }
          }
        });

        (wsocket as any)?.ws?.on?.("error", (error: any) => {
          logger.error(
            `Session ${name}: WebSocket error: ${error?.message}`
          );
        });
      })().catch(err => reject(err));
    } catch (error) {
      Sentry.captureException(error);
      console.log(error);
      reject(error);
    }
  });
};
