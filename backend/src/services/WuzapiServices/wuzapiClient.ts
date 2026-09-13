import axios, { AxiosRequestConfig, Method } from "axios";
import { SocksProxyAgent } from "socks-proxy-agent";
import mime from "mime-types";
import AppError from "../../errors/AppError";
import Setting from "../../models/Setting";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";

const normalizeProvider = (provider?: string | null): string =>
  String(provider || "").trim().toLowerCase();

const isWuzapiProvider = (whatsapp: Whatsapp): boolean =>
  normalizeProvider((whatsapp as any).provider) === "wuzapi";

const getExpectedWuzapiAdminUserName = (whatsapp: Whatsapp): string =>
  `wpp-${whatsapp.companyId}-${whatsapp.id}`;

type WuzapiGlobalSettings = {
  baseUrl: string;
  adminToken: string;
  defaultUserToken: string;
};

const GLOBAL_SETTINGS_TTL_MS = 30000;
let globalSettingsCache: {
  expiresAt: number;
  data: WuzapiGlobalSettings;
} | null = null;

const normalizeBaseUrl = (value: string): string =>
  value.endsWith("/") ? value.slice(0, -1) : value;

const normalizeTokenValue = (value: string): string =>
  String(value || "")
    .trim()
    .replace(/^Bearer\s+/i, "");

const splitSubscribedEvents = (rawEvents: string): string[] =>
  String(rawEvents || "")
    .split(",")
    .map(event => String(event || "").trim())
    .filter(Boolean);

const mergeSubscribedEvents = (events: string[], required: string[]): string[] => {
  const normalized = new Set(events.map(event => event.toLowerCase()));
  const hasAll = normalized.has("all");
  if (hasAll) return events;

  const merged = [...events];
  for (const requiredEvent of required) {
    const normalizedRequired = String(requiredEvent || "").trim().toLowerCase();
    if (!normalizedRequired || normalized.has(normalizedRequired)) continue;
    merged.push(requiredEvent);
    normalized.add(normalizedRequired);
  }

  return merged;
};

const WUZAPI_REQUIRED_EVENTS = [
  "Message",
  "Notify",
  "Presence",
  "ChatPresence",
  "ReadReceipt",
  "Connected",
  "PairSuccess",
  "CallOffer",
  "CallOfferNotice",
  "CallTerminate"
];
const WUZAPI_RUNTIME_WEBHOOK_SYNC_TTL_MS = 2 * 60 * 1000;
const wuzapiRuntimeWebhookSyncCache = new Map<number, number>();

const ensureWuzapiLiveWebhookSubscription = async (
  whatsapp: Whatsapp,
  webhookUrl: string,
  events: string[]
): Promise<void> => {
  if (!webhookUrl || !events.length) return;

  try {
    await wuzapiRequest(whatsapp, "PUT", "/webhook", {
      webhook: webhookUrl,
      events,
      active: true
    });
    return;
  } catch (error: any) {
    logger.warn(
      `[WUZAPI_WEBHOOK_RUNTIME_SYNC] PUT /webhook falhou (tentando fallback POST): ${JSON.stringify(
        error?.message || error
      )}`
    );
  }

  try {
    await wuzapiRequest(whatsapp, "POST", "/webhook", {
      webhookurl: webhookUrl,
      events
    });
  } catch (error: any) {
    logger.warn(
      `[WUZAPI_WEBHOOK_RUNTIME_SYNC] POST /webhook falhou: ${JSON.stringify(
        error?.message || error
      )}`
    );
  }
};

export const syncWuzapiRuntimeWebhookSubscription = async (
  whatsapp: Whatsapp,
  options?: { force?: boolean }
): Promise<void> => {
  if (!isWuzapiProvider(whatsapp)) return;

  const force = Boolean(options?.force);
  const lastSync = wuzapiRuntimeWebhookSyncCache.get(Number(whatsapp.id));
  if (!force && lastSync && Date.now() - lastSync < WUZAPI_RUNTIME_WEBHOOK_SYNC_TTL_MS) {
    return;
  }

  const webhookUrl = resolveInboundWebhookUrl();
  if (!webhookUrl) return;

  await ensureWuzapiLiveWebhookSubscription(whatsapp, webhookUrl, WUZAPI_REQUIRED_EVENTS);
  wuzapiRuntimeWebhookSyncCache.set(Number(whatsapp.id), Date.now());
};

const normalizeWebhookHost = (host: string): string => {
  const normalized = String(host || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "localhost" || normalized === "127.0.0.1" || normalized === "0.0.0.0") {
    return "host.docker.internal";
  }
  return host;
};

const buildInboundWebhookFromBackendUrl = (backendUrlRaw: string): string => {
  const raw = String(backendUrlRaw || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    const host = normalizeWebhookHost(parsed.hostname);
    const defaultPort = parsed.protocol === "https:" ? "443" : "80";
    const port = parsed.port || defaultPort;
    const portPart = port === defaultPort ? "" : `:${port}`;
    return `${parsed.protocol}//${host}${portPart}/webhook/wuzapi`;
  } catch {
    const withoutProtocol = raw.replace(/^[a-z]+:\/\//i, "");
    const [hostPort = ""] = withoutProtocol.split("/");
    const [hostRaw = "", portRaw = ""] = hostPort.split(":");
    const host = normalizeWebhookHost(hostRaw) || "host.docker.internal";
    const port = String(portRaw || "").trim();
    return `http://${host}${port ? `:${port}` : ""}/webhook/wuzapi`;
  }
};

const resolveInboundWebhookUrl = (): string => {
  const fromExplicit = String(
    process.env.WUZAPI_INBOUND_WEBHOOK_URL || process.env.WUZAPI_WEBHOOK_URL || ""
  ).trim();
  if (fromExplicit) return normalizeBaseUrl(fromExplicit);

  const backendUrl = String(process.env.BACKEND_URL || "").trim();
  if (!backendUrl) return "";

  return normalizeBaseUrl(buildInboundWebhookFromBackendUrl(backendUrl));
};

const loadGlobalSettings = async (
  forceReload = false
): Promise<WuzapiGlobalSettings> => {
  if (!forceReload && globalSettingsCache && globalSettingsCache.expiresAt > Date.now()) {
    return globalSettingsCache.data;
  }

  const empty: WuzapiGlobalSettings = {
    baseUrl: "",
    adminToken: "",
    defaultUserToken: ""
  };

  try {
    const rows = await Setting.findAll({
      where: {
        companyId: 1,
        key: ["WUZAPI_BASE_URL", "WUZAPI_ADMIN_TOKEN", "WUZAPI_DEFAULT_USER_TOKEN"]
      },
      order: [["updatedAt", "DESC"], ["id", "DESC"]]
    });

    const map: Record<string, string> = {};
    rows.forEach((row: any) => {
      const key = String(row.key || "");
      const value = String(row.value || "").trim();
      if (!key || map[key]) return;
      if (!value) return;
      map[key] = value;
    });

    // Fallback: quando o super admin salvou em outra company, usa o valor mais recente por chave.
    if (!map.WUZAPI_BASE_URL || !map.WUZAPI_ADMIN_TOKEN) {
      const fallbackRows = await Setting.findAll({
        where: {
          key: ["WUZAPI_BASE_URL", "WUZAPI_ADMIN_TOKEN", "WUZAPI_DEFAULT_USER_TOKEN"]
        },
        order: [["updatedAt", "DESC"], ["id", "DESC"]]
      });

      fallbackRows.forEach((row: any) => {
        const key = String(row.key || "");
        if (!map[key] && String(row.value || "").trim()) {
          map[key] = String(row.value || "").trim();
        }
      });
    }

    const loaded: WuzapiGlobalSettings = {
      baseUrl: normalizeBaseUrl(String(map.WUZAPI_BASE_URL || "")),
      adminToken: normalizeTokenValue(String(map.WUZAPI_ADMIN_TOKEN || "")),
      defaultUserToken: normalizeTokenValue(String(map.WUZAPI_DEFAULT_USER_TOKEN || ""))
    };

    globalSettingsCache = {
      expiresAt: Date.now() + GLOBAL_SETTINGS_TTL_MS,
      data: loaded
    };

    return loaded;
  } catch {
    return empty;
  }
};

const getBaseUrl = async (
  whatsapp: Whatsapp,
  forceReload = false
): Promise<string> => {
  const fromConnection = String((whatsapp as any).wuzapiUrl || "").trim();
  const fromGlobal = (await loadGlobalSettings(forceReload)).baseUrl;
  const fromEnv = String(process.env.WUZAPI_BASE_URL || "").trim();
  const base = fromConnection || fromGlobal || fromEnv;

  if (!base) {
    throw new AppError("WUZAPI_URL_NOT_CONFIGURED");
  }

  return normalizeBaseUrl(base);
};

const getToken = async (
  whatsapp: Whatsapp,
  forceReload = false
): Promise<string> => {
  const fromConnection = String((whatsapp as any).wuzapiToken || "").trim();
  const fromWhatsappToken = String((whatsapp as any).token || "").trim();
  const fromGlobal = (await loadGlobalSettings(forceReload)).defaultUserToken;
  const fromEnv = String(process.env.WUZAPI_TOKEN || "").trim();
  const token = normalizeTokenValue(
    fromConnection || fromWhatsappToken || fromGlobal || fromEnv
  );

  if (!token) {
    throw new AppError("WUZAPI_TOKEN_NOT_CONFIGURED");
  }

  return token;
};

const getAdminToken = async (forceReload = false): Promise<string> => {
  const fromGlobal = (await loadGlobalSettings(forceReload)).adminToken;
  if (fromGlobal) return normalizeTokenValue(String(fromGlobal || ""));

  const fromEnv = normalizeTokenValue(String(process.env.WUZAPI_ADMIN_TOKEN || ""));
  return fromEnv;
};

const buildHeaders = (token: string) => ({
  token,
  Token: token,
  Authorization: token,
  "Content-Type": "application/json"
});

const extractData = (response: any): any => {
  if (response?.data?.data !== undefined) return response.data.data;
  if (response?.data !== undefined) return response.data;
  return response;
};

const extractAvatarUrlLoose = (data: any): string => {
  const fromValue = (value: any): string => {
    if (!value) return "";
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return "";
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      try {
        const parsed = JSON.parse(trimmed);
        return fromValue(parsed);
      } catch {
        return "";
      }
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        const resolved = fromValue(entry);
        if (resolved) return resolved;
      }
      return "";
    }
    if (typeof value === "object") {
      const candidates = [
        value?.URL,
        value?.url,
        value?.avatar,
        value?.Avatar,
        value?.picture,
        value?.Picture,
        value?.data?.URL,
        value?.data?.url,
        value?.data?.avatar,
        value?.Data?.URL,
        value?.Data?.url,
        value?.result?.url,
        value?.result?.URL
      ];
      for (const candidate of candidates) {
        const resolved = fromValue(candidate);
        if (resolved) return resolved;
      }
    }
    return "";
  };

  return fromValue(data);
};

const normalizePhone = (jidOrPhone: string): string => {
  const raw = String(jidOrPhone || "").trim();
  if (!raw) return raw;

  if (raw.includes("@")) {
    const [left, domain] = raw.split("@");
    const primaryIdRaw = (left || "").split(":")[0] || left || "";
    const normalizedDomain = String(domain || "").toLowerCase();
    if (!normalizedDomain) return primaryIdRaw.replace(/\s+/g, "");

    // Normaliza apenas domínios numéricos. Em LID, o identificador pode conter letras.
    if (normalizedDomain === "lid") {
      return `${primaryIdRaw.replace(/\s+/g, "")}@${normalizedDomain}`;
    }

    const isNumericDirectDomain =
      normalizedDomain === "s.whatsapp.net" || normalizedDomain === "c.us";
    const isGroupDomain = normalizedDomain === "g.us";

    const primaryId = isGroupDomain
      ? primaryIdRaw.replace(/[^\d-]/g, "")
      : isNumericDirectDomain
      ? primaryIdRaw.replace(/\D/g, "")
      : primaryIdRaw.replace(/\s+/g, "");

    return `${primaryId}@${normalizedDomain}`;
  }

  return raw.replace(/\D/g, "");
};

const toWuzapiPresencePhone = (jidOrPhone?: string): string => {
  const normalized = normalizePhone(String(jidOrPhone || ""));
  if (!normalized) return "";
  if (normalized.includes("@")) return normalized;
  const digits = normalized.replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : normalized;
};

const toWuzapiBlockPhone = (jidOrPhone?: string): string => {
  const normalized = normalizePhone(String(jidOrPhone || ""));
  if (!normalized) return "";
  if (normalized.endsWith("@lid")) return "";
  const digits = normalized.includes("@")
    ? normalized.split("@")[0].replace(/\D/g, "")
    : normalized.replace(/\D/g, "");
  return digits;
};

const buildWuzapiBlockPhoneVariants = (rawPhone: string): string[] => {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  if (!digits) return [];

  const variants = new Set<string>();
  variants.add(digits);

  // Fallback BR: tenta com/sem o nono dígito após DDI+DDD.
  const withNine = /^55(\d{2})9(\d{8})$/.exec(digits);
  if (withNine) {
    variants.add(`55${withNine[1]}${withNine[2]}`);
  }

  const withoutNine = /^55(\d{2})(\d{8})$/.exec(digits);
  if (withoutNine) {
    variants.add(`55${withoutNine[1]}9${withoutNine[2]}`);
  }

  return Array.from(variants);
};

const randomId = () =>
  `${Date.now()}${Math.random().toString(16).slice(2, 10)}`.toUpperCase();

const isDataUri = (value?: string): boolean =>
  Boolean(value && /^data:[^;]+;base64,/i.test(value));

const guessMime = (fileName?: string, fallback = "application/octet-stream") => {
  if (fileName) {
    const detected = mime.lookup(fileName);
    if (detected) return String(detected);
  }
  return fallback;
};

const toSafeDataUriMime = (value?: string): string => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "application/octet-stream";

  // Wuzapi espera data URI simples; parâmetros (ex. codecs=opus) quebram decode.
  const baseMime = raw.split(";")[0].trim();
  if (!baseMime) return "application/octet-stream";
  if (baseMime === "audio/x-m4a") return "audio/mp4";
  return baseMime;
};

const toDataUriFromBuffer = (
  value: Buffer,
  mimeType: string = "application/octet-stream"
): string => `data:${toSafeDataUriMime(mimeType)};base64,${value.toString("base64")}`;

const readRemoteAsDataUri = async (url: string, mimeHint?: string): Promise<string> => {
  const resp = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000
  });

  const contentType = String(
    resp.headers?.["content-type"] || mimeHint || "application/octet-stream"
  );
  return toDataUriFromBuffer(Buffer.from(resp.data), contentType);
};

const buildProxyConfig = (proxyUrl: string | null | undefined): Partial<AxiosRequestConfig> => {
  if (!proxyUrl) return {};
  try {
    const agent = new SocksProxyAgent(proxyUrl);
    return { httpAgent: agent, httpsAgent: agent, proxy: false };
  } catch {
    return {};
  }
};

export const wuzapiRequest = async (
  whatsapp: Whatsapp,
  method: Method,
  path: string,
  payload?: any,
  extraConfig?: AxiosRequestConfig
): Promise<any> => {
  if (!isWuzapiProvider(whatsapp)) {
    throw new AppError("WUZAPI_PROVIDER_REQUIRED");
  }

  const baseURL = await getBaseUrl(whatsapp);
  const token = await getToken(whatsapp);
  const url = `${baseURL}${path.startsWith("/") ? path : `/${path}`}`;

  const proxyUrl = (whatsapp as any).proxyUrl as string | null | undefined;

  const doRequest = async (withProxy: boolean) => {
    const proxyConfig = withProxy ? buildProxyConfig(proxyUrl) : {};
    return axios({
      url,
      method,
      headers: buildHeaders(token),
      data: payload,
      timeout: 45000,
      ...proxyConfig,
      ...extraConfig
    });
  };

  try {
    const response = await doRequest(Boolean(proxyUrl));
    return extractData(response);
  } catch (error: any) {
    // Se falhou por erro de rede (sem resposta HTTP) e havia proxy, remove e tenta sem proxy
    if (!error?.response && proxyUrl) {
      const safeUrl = proxyUrl.replace(/:[^:@]*@/, ":***@");
      logger.warn(
        `[Wuzapi] Falha de rede com proxy ${safeUrl} em ${whatsapp.name}. Removendo proxy e tentando sem proxy.`
      );
      await (whatsapp as any).update({ proxyUrl: null });
      try {
        const response = await doRequest(false);
        return extractData(response);
      } catch (retryError: any) {
        const status = retryError?.response?.status;
        const details = retryError?.response?.data || retryError?.message || retryError;
        throw new AppError(
          `WUZAPI_REQUEST_FAILED${status ? `_${status}` : ""}: ${JSON.stringify(details)}`
        );
      }
    }
    const status = error?.response?.status;
    const details = error?.response?.data || error?.message || error;
    throw new AppError(
      `WUZAPI_REQUEST_FAILED${status ? `_${status}` : ""}: ${JSON.stringify(details)}`
    );
  }
};

export const resolveWuzapiAvatarUrlByCandidates = async (
  whatsapp: Whatsapp,
  jidOrPhones: Array<string | null | undefined>
): Promise<string> => {
  const candidates = Array.from(
    new Set(
      jidOrPhones
        .map(value => normalizePhone(String(value || "")))
        .filter(Boolean)
    )
  );

  if (!candidates.length) return "";

  const baseURL = await getBaseUrl(whatsapp);
  const token = await getToken(whatsapp);
  const rawHeaders = {
    ...buildHeaders(token),
    Authorization: `Bearer ${token}`
  };

  for (const candidate of candidates) {
    const isJidCandidate = candidate.includes("@");
    const isGroupJid = candidate.endsWith("@g.us");
    const phoneDigits = normalizeDigits(candidate);

    const payloads: any[] = [];

    if (isJidCandidate) {
      payloads.push({ Phone: candidate, Preview: false });
      payloads.push({ Phone: candidate, Preview: true });
      payloads.push({ JID: candidate, Preview: false });
      payloads.push({ JID: candidate, Preview: true });
      payloads.push({ phone: candidate, preview: true });
    } else {
      payloads.push({ Phone: candidate, Preview: false });
      payloads.push({ Phone: candidate, Preview: true });
      if (phoneDigits) {
        payloads.push({ Phone: `${phoneDigits}@s.whatsapp.net`, Preview: false });
        payloads.push({ Phone: `${phoneDigits}@s.whatsapp.net`, Preview: true });
        payloads.push({ JID: `${phoneDigits}@s.whatsapp.net`, Preview: false });
        payloads.push({ JID: `${phoneDigits}@s.whatsapp.net`, Preview: true });
      }
      payloads.push({ phone: candidate, preview: true });
    }

    // Fallback explícito para grupos quando vier apenas o número/hífen sem domínio.
    if (!isJidCandidate && isGroupJid === false && candidate.includes("-")) {
      const groupJid = `${candidate}@g.us`;
      payloads.push({ Phone: groupJid, Preview: false });
      payloads.push({ Phone: groupJid, Preview: true });
      payloads.push({ JID: groupJid, Preview: false });
      payloads.push({ JID: groupJid, Preview: true });
    }

    for (const payload of payloads) {
      try {
        const data = await wuzapiRequest(whatsapp, "POST", "/user/avatar", payload);
        const resolved = extractAvatarUrlLoose(data);
        if (resolved) return resolved;
      } catch {
        // tenta fallback abaixo
      }

      try {
        const response = await axios({
          url: `${baseURL}/user/avatar`,
          method: "POST",
          headers: rawHeaders,
          data: payload,
          timeout: 20000
        });
        const resolved = extractAvatarUrlLoose(extractData(response));
        if (resolved) return resolved;
      } catch {
        // tenta próximo payload
      }
    }
  }

  return "";
};

export const ensureWuzapiUserExists = async (whatsapp: Whatsapp): Promise<void> => {
  if (!isWuzapiProvider(whatsapp)) return;

  const userName = getExpectedWuzapiAdminUserName(whatsapp);
  const webhookUrl = resolveInboundWebhookUrl();
  const events = WUZAPI_REQUIRED_EVENTS.join(",");
  let baseURL = "";
  let token = "";
  let adminTokenInUse = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const forceReload = attempt === 1;
    const adminToken = await getAdminToken(forceReload);
    if (!adminToken) return;
    adminTokenInUse = adminToken;

    baseURL = await getBaseUrl(whatsapp, forceReload);
    token = await getToken(whatsapp, forceReload);

    try {
      const createPayload: any = {
        name: userName,
        token
      };
      if (webhookUrl) {
        createPayload.webhook = webhookUrl;
        createPayload.events = events;
      }

      await axios.post(
        `${baseURL}/admin/users`,
        createPayload,
        {
          headers: {
            Authorization: adminToken,
            "Content-Type": "application/json"
          },
          timeout: 30000
        }
      );
      break;
    } catch (error: any) {
      const status = error?.response?.status;
      const details = error?.response?.data || error?.message || "";
      const normalized = String(JSON.stringify(details)).toLowerCase();
      const alreadyExists =
        status === 409 ||
        normalized.includes("already exists") ||
        normalized.includes("já existe") ||
        normalized.includes("duplicate");

      if (alreadyExists) break;

      if (status === 401 && attempt === 0) {
        continue;
      }

      const webhookRejected =
        status === 400 ||
        status === 422 ||
        normalized.includes("webhook") ||
        normalized.includes("invalid url") ||
        normalized.includes("invalid_uri");
      if (webhookRejected) {
        try {
          await axios.post(
            `${baseURL}/admin/users`,
            {
              name: userName,
              token
            },
            {
              headers: {
                Authorization: adminToken,
                "Content-Type": "application/json"
              },
              timeout: 30000
            }
          );
          logger.warn(
            `WUZAPI_ADMIN_CREATE_USER_WITHOUT_WEBHOOK: webhook inválido/recusado, mantendo criação da sessão sem travar QR`
          );
          break;
        } catch {}
      }

      throw new AppError(
        `WUZAPI_ADMIN_CREATE_USER_FAILED${status ? `_${status}` : ""}: ${JSON.stringify(
          details
        )}`
      );
    }
  }

  if (adminTokenInUse && baseURL && token && webhookUrl) {
    try {
      const listResponse = await axios.get(`${baseURL}/admin/users`, {
        headers: {
          Authorization: adminTokenInUse,
          "Content-Type": "application/json"
        },
        timeout: 30000
      });

      const users = extractData(listResponse);
      const userList: any[] = Array.isArray(users)
        ? users
        : Array.isArray(users?.users)
        ? users.users
        : [];

      const currentUser = userList.find((item: any) => {
        const itemName = String(item?.name || "");
        const itemToken = normalizeTokenValue(String(item?.token || ""));
        return itemName === userName || itemToken === token;
      });

      if (currentUser?.id) {
        const currentWebhook = String(currentUser?.webhook || "").trim();
        const currentEvents = String(currentUser?.events || "").trim();
        if (
          normalizeBaseUrl(currentWebhook) !== normalizeBaseUrl(webhookUrl) ||
          currentEvents !== events
        ) {
          await axios.put(
            `${baseURL}/admin/users/${currentUser.id}`,
            {
              name: userName,
              webhook: webhookUrl,
              events
            },
            {
              headers: {
                Authorization: adminTokenInUse,
                "Content-Type": "application/json"
              },
              timeout: 30000
            }
          );
        }
      }
    } catch (error: any) {
      logger.warn(
        `WUZAPI_ADMIN_SYNC_WEBHOOK_FAILED: ${JSON.stringify(
          error?.response?.data || error?.message || error
        )}`
      );
    }
  }

  const pendingUpdate: any = {};
  if (!String((whatsapp as any).wuzapiUrl || "").trim()) {
    pendingUpdate.wuzapiUrl = baseURL;
  }
  if (!String((whatsapp as any).wuzapiToken || "").trim()) {
    pendingUpdate.wuzapiToken = token;
  }
  if (Object.keys(pendingUpdate).length > 0) {
    await whatsapp.update(pendingUpdate);
  }

  // Sincroniza também no endpoint do próprio usuário para atualizar a sessão ativa
  // sem depender de reconnect manual (cache de subscriptions no WuzAPI).
  if (webhookUrl) {
    await ensureWuzapiLiveWebhookSubscription(whatsapp, webhookUrl, WUZAPI_REQUIRED_EVENTS);
  }
};

type SyncWuzapiWebhooksResult = {
  checked: number;
  updated: number;
  skipped: number;
  errors: number;
  reason?: string;
};

const parseAdminUsersResponse = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.users)) return payload.users;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

export const removeWuzapiAdminUser = async (whatsapp: Whatsapp): Promise<boolean> => {
  if (!isWuzapiProvider(whatsapp)) return false;

  const expectedName = getExpectedWuzapiAdminUserName(whatsapp);
  const expectedToken = normalizeTokenValue(
    String((whatsapp as any).wuzapiToken || (whatsapp as any).token || "")
  );

  for (let attempt = 0; attempt < 2; attempt++) {
    const forceReload = attempt === 1;
    const adminToken = await getAdminToken(forceReload);
    if (!adminToken) return false;

    try {
      const baseURL = await getBaseUrl(whatsapp, forceReload);
      const response = await axios.get(`${baseURL}/admin/users`, {
        headers: {
          Authorization: adminToken,
          "Content-Type": "application/json"
        },
        timeout: 30000
      });

      const users = parseAdminUsersResponse(extractData(response));
      const currentUser = users.find((item: any) => {
        const itemName = String(item?.name || "").trim();
        const itemToken = normalizeTokenValue(String(item?.token || ""));

        if (itemName === expectedName) return true;
        if (expectedToken && itemToken && itemToken === expectedToken) return true;
        return false;
      });

      if (!currentUser?.id) {
        return false;
      }

      await axios.delete(`${baseURL}/admin/users/${currentUser.id}`, {
        headers: {
          Authorization: adminToken,
          "Content-Type": "application/json"
        },
        timeout: 30000
      });

      return true;
    } catch (error: any) {
      const status = Number(error?.response?.status || 0);
      if (status === 401 && attempt === 0) {
        continue;
      }

      logger.warn(
        `[WUZAPI_ADMIN_DELETE_USER_FAILED] whatsappId=${whatsapp.id} companyId=${whatsapp.companyId}: ${JSON.stringify(
          error?.response?.data || error?.message || error
        )}`
      );
      return false;
    }
  }

  return false;
};

export const syncWuzapiUsersWebhooks = async (
  forceReload = false
): Promise<SyncWuzapiWebhooksResult> => {
  const defaultEvents = WUZAPI_REQUIRED_EVENTS.join(",");
  const requiredEvents = WUZAPI_REQUIRED_EVENTS;
  const webhookUrl = resolveInboundWebhookUrl();

  if (!webhookUrl) {
    return {
      checked: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      reason: "INBOUND_WEBHOOK_URL_NOT_CONFIGURED"
    };
  }

  const settings = await loadGlobalSettings(forceReload);
  const baseURL = normalizeBaseUrl(String(settings.baseUrl || process.env.WUZAPI_BASE_URL || ""));
  const adminToken = normalizeTokenValue(
    String(settings.adminToken || process.env.WUZAPI_ADMIN_TOKEN || "")
  );

  if (!baseURL || !adminToken) {
    return {
      checked: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      reason: "WUZAPI_GLOBAL_SETTINGS_NOT_CONFIGURED"
    };
  }

  const response = await axios.get(`${baseURL}/admin/users`, {
    headers: {
      Authorization: adminToken,
      "Content-Type": "application/json"
    },
    timeout: 30000
  });

  const users = parseAdminUsersResponse(extractData(response));
  let checked = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users) {
    const userId = String(user?.id || "").trim();
    const userName = String(user?.name || "").trim();
    if (!userId || !userName || !/^wpp-\d+-\d+$/i.test(userName)) {
      skipped += 1;
      continue;
    }

    checked += 1;
    const currentWebhook = normalizeBaseUrl(String(user?.webhook || "").trim());
    const currentEvents = String(user?.events || "").trim();
    const targetEventsList = mergeSubscribedEvents(
      splitSubscribedEvents(currentEvents || defaultEvents),
      requiredEvents
    );
    const targetEvents = targetEventsList.join(",");
    const normalizedCurrentEvents = splitSubscribedEvents(currentEvents)
      .map(event => event.toLowerCase())
      .join(",");
    const normalizedTargetEvents = targetEventsList
      .map(event => event.toLowerCase())
      .join(",");

    if (
      currentWebhook === normalizeBaseUrl(webhookUrl) &&
      normalizedCurrentEvents === normalizedTargetEvents
    ) {
      skipped += 1;
      continue;
    }

    try {
      await axios.put(
        `${baseURL}/admin/users/${userId}`,
        {
          name: userName,
          webhook: webhookUrl,
          events: targetEvents
        },
        {
          headers: {
            Authorization: adminToken,
            "Content-Type": "application/json"
          },
          timeout: 30000
        }
      );
      updated += 1;
    } catch (error: any) {
      // Fallback: alguns builds do WuzAPI não aceitam campo events no PUT de users.
      try {
        await axios.put(
          `${baseURL}/admin/users/${userId}`,
          {
            name: userName,
            webhook: webhookUrl
          },
          {
            headers: {
              Authorization: adminToken,
              "Content-Type": "application/json"
            },
            timeout: 30000
          }
        );
        updated += 1;
      } catch (fallbackError: any) {
        errors += 1;
        logger.warn(
          `[WUZAPI_WEBHOOK_SYNC] falha ao atualizar user=${userName} id=${userId}: ${JSON.stringify(
            fallbackError?.response?.data || fallbackError?.message || fallbackError
          )}`
        );
      }
    }
  }

  return { checked, updated, skipped, errors };
};

export const wuzapiConnectSession = async (whatsapp: Whatsapp): Promise<any> => {
  const webhookUrl = resolveInboundWebhookUrl();
  if (webhookUrl) {
    await ensureWuzapiLiveWebhookSubscription(whatsapp, webhookUrl, WUZAPI_REQUIRED_EVENTS);
  }

  return wuzapiRequest(whatsapp, "POST", "/session/connect", {
    Subscribe: WUZAPI_REQUIRED_EVENTS,
    Immediate: true
  });
};

export const wuzapiDisconnectSession = async (whatsapp: Whatsapp): Promise<any> =>
  wuzapiRequest(whatsapp, "POST", "/session/disconnect");

export const wuzapiLogoutSession = async (whatsapp: Whatsapp): Promise<any> =>
  wuzapiRequest(whatsapp, "POST", "/session/logout");

export const wuzapiStatusSession = async (
  whatsapp: Whatsapp
): Promise<{ connected: boolean; loggedIn: boolean; jid?: string; raw: any }> => {
  const data = await wuzapiRequest(whatsapp, "GET", "/session/status");

  const connected = Boolean(data?.Connected ?? data?.connected ?? data?.IsConnected);
  const loggedIn = Boolean(data?.LoggedIn ?? data?.loggedIn ?? data?.IsLoggedIn);
  const jid = data?.Jid || data?.jid;

  return { connected, loggedIn, jid, raw: data };
};

const normalizeDigits = (value: string): string =>
  String(value || "")
    .split("@")[0]
    .split(":")[0]
    .replace(/\D/g, "");

const WUZAPI_TRANSIENT_STATUSES = ["OPENING", "qrcode"];
const WUZAPI_TRANSIENT_STALE_MS = 5 * 60 * 1000;

export const syncWuzapiStatusFromProvider = async (
  whatsapp: Whatsapp
): Promise<void> => {
  if (!isWuzapiProvider(whatsapp)) return;

  try {
    const status = await wuzapiStatusSession(whatsapp);
    const isConnected = Boolean(status.connected && status.loggedIn);
    const nextStatus = isConnected ? "CONNECTED" : "DISCONNECTED";
    const numberFromStatus = normalizeDigits(String(status.jid || ""));

    const pendingUpdate: any = {};

    const currentStatus = String(whatsapp.status || "");
    const isTransient = WUZAPI_TRANSIENT_STATUSES.includes(currentStatus);
    const updatedAtMs = whatsapp.updatedAt
      ? new Date(whatsapp.updatedAt as any).getTime()
      : 0;
    const isStaleTransient =
      isTransient && Date.now() - updatedAtMs > WUZAPI_TRANSIENT_STALE_MS;

    if (
      currentStatus !== nextStatus &&
      (!isTransient || isConnected || isStaleTransient)
    ) {
      pendingUpdate.status = nextStatus;
    }

    if (isConnected) {
      if (String(whatsapp.qrcode || "").trim()) pendingUpdate.qrcode = "";
      if ((whatsapp as any).retries !== 0) pendingUpdate.retries = 0;
      if (numberFromStatus && String(whatsapp.number || "") !== numberFromStatus) {
        pendingUpdate.number = numberFromStatus;
      }
    } else if (String(whatsapp.status || "") === "CONNECTED") {
      pendingUpdate.qrcode = "";
    }

    if (Object.keys(pendingUpdate).length > 0) {
      await whatsapp.update(pendingUpdate);
    }
  } catch {
    // Falha de comunicação com o WuzAPI não deve derrubar listagens da aplicação.
  }
};

export const wuzapiGetQrCode = async (whatsapp: Whatsapp): Promise<string> => {
  const data = await wuzapiRequest(whatsapp, "GET", "/session/qr");
  return String(data?.QRCode || data?.qrCode || data?.qr || "");
};

export const wuzapiGetPasskeyStatus = async (
  whatsapp: Whatsapp
): Promise<{ passkeyPending: boolean; publicKey: any }> => {
  const data = await wuzapiRequest(whatsapp, "GET", "/session/passkey-status");
  return {
    passkeyPending: Boolean(data?.passkeyPending),
    publicKey: data?.publicKey || null
  };
};

export const wuzapiSendPasskeyResponse = async (
  whatsapp: Whatsapp,
  response: any
): Promise<any> =>
  wuzapiRequest(whatsapp, "POST", "/session/passkey-response", { response });

export const wuzapiConfirmPasskey = async (whatsapp: Whatsapp): Promise<any> =>
  wuzapiRequest(whatsapp, "POST", "/session/passkey-confirm");

const toOwnParticipantJid = (whatsapp?: Whatsapp): string => {
  const number = String((whatsapp as any)?.number || "").replace(/\D/g, "");
  return number ? `${number}@s.whatsapp.net` : "";
};

const buildContextInfo = (options?: any, whatsapp?: Whatsapp): any | undefined => {
  const quoted = options?.quoted;
  const quotedKey = quoted?.key || {};

  const stanzaId =
    quotedKey?.id ||
    quoted?.wid ||
    quoted?.id;
  const ownParticipant = toOwnParticipantJid(whatsapp);
  const participantCandidate =
    quotedKey?.participant ||
    (quotedKey?.fromMe === true ? ownParticipant : "") ||
    quoted?.participant ||
    quotedKey?.remoteJid ||
    quoted?.remoteJid;
  const normalizedParticipant = normalizePhone(String(participantCandidate || ""));
  const participant =
    normalizedParticipant && !normalizedParticipant.endsWith("@g.us")
      ? normalizedParticipant
      : "";

  const contextInfo: any = {};

  if (stanzaId) {
    contextInfo.StanzaId = stanzaId;
  }

  if (participant && stanzaId) {
    contextInfo.Participant = participant;
  }

  const mentionedJid = Array.isArray(options?.mentionedJid)
    ? options.mentionedJid
        .map((jid: any) => normalizePhone(String(jid || "")))
        .filter((jid: string) => Boolean(jid))
    : [];

  if (mentionedJid.length > 0) {
    contextInfo.MentionedJID = mentionedJid;
  }

  const rawNonJidMentions =
    options?.nonJidMentions ??
    options?.contextInfo?.nonJidMentions ??
    options?.contextInfo?.NonJidMentions;
  const nonJidMentions = Number(rawNonJidMentions);

  if (Number.isFinite(nonJidMentions) && nonJidMentions > 0) {
    contextInfo.NonJidMentions = Math.max(1, Math.floor(nonJidMentions));
  }

  const rawForwardingScore =
    options?.forwardingScore ??
    options?.contextInfo?.forwardingScore ??
    options?.contextInfo?.ForwardingScore;
  const forwardingScore = Number(rawForwardingScore);

  if (Number.isFinite(forwardingScore) && forwardingScore > 0) {
    contextInfo.ForwardingScore = Math.max(1, Math.floor(forwardingScore));
    contextInfo.forwardingScore = Math.max(1, Math.floor(forwardingScore));
  }

  const rawIsForwarded =
    options?.isForwarded ??
    options?.contextInfo?.isForwarded ??
    options?.contextInfo?.IsForwarded;
  const isForwarded = parseLooseBoolean(rawIsForwarded);

  if (isForwarded !== null) {
    contextInfo.IsForwarded = isForwarded;
    contextInfo.isForwarded = isForwarded;
  }

  return Object.keys(contextInfo).length > 0 ? contextInfo : undefined;
};

const buildQuotedPayload = (options?: any): Partial<Pick<any, "QuotedMessage" | "QuotedText">> => {
  const quotedMessage = options?.quoted?.message;
  if (quotedMessage && typeof quotedMessage === "object") {
    return { QuotedMessage: quotedMessage };
  }

  const quotedText =
    options?.quoted?.conversation ||
    options?.quoted?.text ||
    options?.quoted?.body;
  if (typeof quotedText === "string" && quotedText.trim()) {
    return { QuotedText: quotedText.trim() };
  }

  return {};
};

const buildForwardingPayload = (options?: any): Record<string, any> => {
  const rawForwardingScore =
    options?.forwardingScore ??
    options?.contextInfo?.forwardingScore ??
    options?.contextInfo?.ForwardingScore;
  const forwardingScore = Number(rawForwardingScore);
  const rawIsForwarded =
    options?.isForwarded ??
    options?.contextInfo?.isForwarded ??
    options?.contextInfo?.IsForwarded;
  const isForwarded = parseLooseBoolean(rawIsForwarded);

  const payload: Record<string, any> = {};

  if (Number.isFinite(forwardingScore) && forwardingScore > 0) {
    const normalizedScore = Math.max(1, Math.floor(forwardingScore));
    payload.ForwardingScore = normalizedScore;
    payload.forwardingScore = normalizedScore;
  }

  if (isForwarded !== null) {
    payload.IsForwarded = isForwarded;
    payload.isForwarded = isForwarded;
  }

  return payload;
};

const mergeOutboundOptions = (message: any, options?: any): any => {
  const merged: any = {
    ...(options || {})
  };

  const messageContextInfo = message?.contextInfo;
  if (messageContextInfo && typeof messageContextInfo === "object") {
    merged.contextInfo = {
      ...(merged.contextInfo || {}),
      ...messageContextInfo
    };
  }

  if (Array.isArray(message?.mentions) && message.mentions.length > 0) {
    merged.mentionedJid = message.mentions;
  }

  if (Array.isArray(message?.mentionedJid) && message.mentionedJid.length > 0) {
    merged.mentionedJid = message.mentionedJid;
  }

  if (typeof message?.nonJidMentions !== "undefined") {
    merged.nonJidMentions = message.nonJidMentions;
  }

  if (typeof message?.mentionAll !== "undefined") {
    merged.mentionAll = message.mentionAll;
  }

  return merged;
};

const toRemoteJid = (phoneOrJid: string): string => {
  const normalized = normalizePhone(String(phoneOrJid || ""));
  if (!normalized) return "";
  if (normalized.includes("@")) return normalized;
  const digits = normalized.replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : normalized;
};

const parseLooseBoolean = (value: any): boolean | null => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "sim"].includes(normalized)) return true;
    if (["false", "0", "no", "nao", "não"].includes(normalized)) return false;
  }
  return null;
};

const parseUserCheckResult = (value: any): { exists: boolean; jid: string } => {
  const explicitExists =
    parseLooseBoolean(value?.IsInWhatsapp) ??
    parseLooseBoolean(value?.isInWhatsapp) ??
    parseLooseBoolean(value?.exists) ??
    parseLooseBoolean(value?.Exists) ??
    parseLooseBoolean(value?.on_whatsapp) ??
    parseLooseBoolean(value?.OnWhatsApp);

  const jid = String(
    value?.JID ||
      value?.jid ||
      value?.contactJid ||
      value?.contact_jid ||
      value?.LID ||
      value?.lid ||
      ""
  ).trim();

  return {
    exists: explicitExists ?? Boolean(jid),
    jid
  };
};

const wuzapiOnWhatsApp = async (whatsapp: Whatsapp, jid: string): Promise<any[]> => {
  const normalized = normalizePhone(String(jid || ""));
  if (!normalized || normalized.endsWith("@g.us")) {
    return [{ exists: false, jid: normalized }];
  }

  const digits = normalized.split("@")[0].replace(/\D/g, "");
  if (!digits) {
    return [{ exists: false, jid: normalized }];
  }

  try {
    const data = await wuzapiRequest(whatsapp, "POST", "/user/check", {
      Phone: [digits]
    });

    const users = Array.isArray(data?.Users)
      ? data.Users
      : Array.isArray(data?.users)
      ? data.users
      : Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data?.Results)
      ? data.Results
      : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
      ? data
      : data && typeof data === "object"
      ? [data]
      : [];

    const first = users[0];
    const parsed = parseUserCheckResult(first);
    const resolvedJid = parsed.jid || `${digits}@s.whatsapp.net`;
    return [{ exists: parsed.exists, jid: resolvedJid }];
  } catch (err) {
    // Nao mascara falha de comunicacao com a API WuzAPI como "numero nao existe":
    // quem chama precisa diferenciar "checado e nao existe" de "nao foi possivel checar".
    throw err;
  }
};

const isNoLidFoundError = (error: any): boolean =>
  String(error?.message || "")
    .toLowerCase()
    .includes("no lid found");

const toLidCandidate = (phoneOrJid: string): string => {
  const normalized = normalizePhone(String(phoneOrJid || ""));
  if (!normalized || normalized.endsWith("@g.us")) return "";
  if (normalized.endsWith("@lid")) return normalized;
  if (!normalized.endsWith("@s.whatsapp.net")) return "";
  const digits = normalized.split("@")[0].replace(/\D/g, "");
  return digits ? `${digits}@lid` : "";
};

const sendWithLidFallback = async (
  phone: string,
  sender: (targetPhone: string) => Promise<any>
): Promise<any> => {
  try {
    return await sender(phone);
  } catch (error: any) {
    const lidCandidate = toLidCandidate(phone);
    if (!lidCandidate || !isNoLidFoundError(error)) {
      throw error;
    }

    return sender(lidCandidate);
  }
};

const normalizeWuzapiJid = (value?: string | null): string => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || !raw.includes("@")) return "";
  const [left, domain] = raw.split("@");
  const primary = String(left || "").split(":")[0] || "";
  if (!primary || !domain) return "";
  return `${primary}@${domain}`;
};

const safeParseWuzapiDataJson = (value?: string | null): any => {
  if (!value || typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const resolveMessageChatJid = (message: any): string => {
  const parsed = safeParseWuzapiDataJson(message?.dataJson);
  const candidates = [
    normalizeWuzapiJid(message?.remoteJid),
    normalizeWuzapiJid(parsed?.key?.remoteJid),
    normalizeWuzapiJid(parsed?.remoteJid)
  ].filter(Boolean);

  return candidates[0] || "";
};

const resolveMessageSenderJid = (message: any, chatJid: string): string => {
  const parsed = safeParseWuzapiDataJson(message?.dataJson);

  const sender = [
    normalizeWuzapiJid(parsed?.key?.participant),
    normalizeWuzapiJid(parsed?.participant),
    normalizeWuzapiJid(message?.participant)
  ].filter(Boolean)[0];

  if (sender) return sender;
  if (chatJid.endsWith("@g.us")) return "";
  return chatJid;
};

const extractProviderMessageId = (message: any): string => {
  const parsed = safeParseWuzapiDataJson(message?.dataJson);
  const raw = String(
    message?.messageId ||
      parsed?.key?.id ||
      message?.wid ||
      ""
  ).trim();

  if (!raw) return "";
  const prefixedWidMatch = raw.match(/^wuzapi:[^:]+:(.+)$/i);
  if (prefixedWidMatch?.[1]) return String(prefixedWidMatch[1]).trim();
  return raw;
};

export const wuzapiMarkMessagesAsRead = async (
  whatsapp: Whatsapp,
  messages: any[]
): Promise<void> => {
  const groupedPayloads = new Map<string, { Id: string[]; Chat: string; Sender?: string }>();

  for (const message of messages) {
    const chatJid = resolveMessageChatJid(message);
    const senderJid = resolveMessageSenderJid(message, chatJid);
    const messageId = extractProviderMessageId(message);

    if (!chatJid || !messageId) continue;

    const groupKey = `${chatJid}::${senderJid || ""}`;
    const current = groupedPayloads.get(groupKey) || {
      Id: [],
      Chat: chatJid,
      ...(senderJid ? { Sender: senderJid } : {})
    };

    if (!current.Id.includes(messageId)) {
      current.Id.push(messageId);
    }

    groupedPayloads.set(groupKey, current);
  }

  for (const payload of groupedPayloads.values()) {
    await wuzapiRequest(whatsapp, "POST", "/chat/markread", payload);
  }
};

const mapResponseToWbotShape = (
  response: any,
  meta?: { phone?: string; message?: any }
) => {
  const msgId =
    response?.Id ||
    response?.ID ||
    response?.id ||
    response?.MessageID ||
    randomId();
  const remoteJid = toRemoteJid(String(meta?.phone || ""));
  const message = meta?.message || { conversation: "" };

  return {
    key: {
      id: String(msgId),
      fromMe: true,
      remoteJid
    },
    message,
    messageTimestamp: new Date().toISOString()
  };
};

const sendText = async ({ whatsapp, phone, body, options }: any) => {
  const payload: any = {
    Phone: phone,
    Body: body || ""
  };

  const contextInfo = buildContextInfo(options, whatsapp);
  if (contextInfo) payload.ContextInfo = contextInfo;
  Object.assign(payload, buildForwardingPayload(options));
  Object.assign(payload, buildQuotedPayload(options));

  const response = await wuzapiRequest(whatsapp, "POST", "/chat/send/text", payload);
  return mapResponseToWbotShape(response, {
    phone,
    message: { conversation: String(body || "") }
  });
};

const sendContact = async ({
  whatsapp,
  phone,
  name,
  vcard,
  options
}: any) => {
  const payload: any = {
    Phone: phone,
    Name: String(name || "").trim() || "Contato",
    Vcard: String(vcard || "").trim()
  };

  if (!payload.Vcard) {
    throw new AppError("WUZAPI_CONTACT_VCARD_REQUIRED");
  }

  const contextInfo = buildContextInfo(options, whatsapp);
  if (contextInfo) payload.ContextInfo = contextInfo;
  Object.assign(payload, buildQuotedPayload(options));

  const response = await wuzapiRequest(whatsapp, "POST", "/chat/send/contact", payload);
  return mapResponseToWbotShape(response, {
    phone,
    message: {
      contactMessage: {
        displayName: payload.Name,
        vcard: payload.Vcard
      }
    }
  });
};

// Traduz um botão nativeFlowMessage (formato Baileys) para o formato aceito
// pelo endpoint /chat/send/buttons do WuzAPI (ver handlers.go SendButtons).
const NATIVE_FLOW_TO_WUZAPI_BUTTON_TYPE: Record<string, string> = {
  cta_copy: "copy",
  copy_code: "copy",
  copy: "copy",
  cta_url: "cta_url",
  cta_call: "cta_call",
  quick_reply: "reply"
};

const sendButtons = async ({
  whatsapp,
  phone,
  title,
  body,
  footer,
  buttons,
  options
}: any) => {
  const payload: any = {
    Phone: phone,
    Body: body || "",
    Buttons: buttons
  };
  if (title) payload.Title = title;
  if (footer) payload.Footer = footer;

  const contextInfo = buildContextInfo(options, whatsapp);
  if (contextInfo) payload.ContextInfo = contextInfo;
  Object.assign(payload, buildQuotedPayload(options));

  const response = await wuzapiRequest(whatsapp, "POST", "/chat/send/buttons", payload);
  return mapResponseToWbotShape(response, {
    phone,
    message: { conversation: String(body || title || "") }
  });
};

// Converte um objeto interactiveMessage (mesmo shape usado nas rotas de
// botões/PIX do MessageController) para o payload de /chat/send/buttons.
export const sendWuzapiInteractiveMessage = async ({
  whatsapp,
  jidOrPhone,
  interactiveMessage,
  options
}: any) => {
  const phone = normalizePhone(jidOrPhone);
  const nativeButtons = interactiveMessage?.nativeFlowMessage?.buttons || [];
  const buttons = nativeButtons
    .map((btn: any) => {
      let params: any = {};
      try {
        params = btn?.buttonParamsJson ? JSON.parse(btn.buttonParamsJson) : {};
      } catch {
        params = {};
      }

      const type = NATIVE_FLOW_TO_WUZAPI_BUTTON_TYPE[btn?.name] || "reply";
      return {
        type,
        title: params?.display_text || params?.title || "Selecionar",
        copy_code: params?.copy_code,
        url: params?.url,
        phone_number: params?.phone_number,
        id: params?.id
      };
    })
    .filter((btn: any) => btn.title);

  if (!buttons.length) {
    throw new AppError("WUZAPI_INTERACTIVE_BUTTONS_REQUIRED");
  }

  return sendButtons({
    whatsapp,
    phone,
    title: interactiveMessage?.header?.title,
    body: interactiveMessage?.body?.text,
    footer: interactiveMessage?.footer?.text,
    buttons,
    options
  });
};

const extractReactionTargetId = (reactionKey: any): string => {
  const raw = String(reactionKey?.id || "").trim();
  if (!raw) return "";
  if (raw.startsWith("me:")) return raw;

  const prefixedWidMatch = raw.match(/^wuzapi:[^:]+:(.+)$/i);
  if (prefixedWidMatch?.[1]) return String(prefixedWidMatch[1]).trim();

  return raw;
};

const sendReaction = async ({ whatsapp, phone, message }: any) => {
  const reactionText = String(message?.react?.text || "").trim();
  const reactionKey = message?.react?.key || {};
  const reactionId = extractReactionTargetId(reactionKey);

  if (!reactionText) {
    throw new AppError("WUZAPI_REACTION_TEXT_REQUIRED");
  }
  if (!reactionId) {
    throw new AppError("WUZAPI_REACTION_ID_REQUIRED");
  }

  const payload: any = {
    Phone: phone,
    Body: reactionText,
    Id: reactionId
  };

  const response = await wuzapiRequest(whatsapp, "POST", "/chat/react", payload);
  return mapResponseToWbotShape(response, {
    phone,
    message: {
      reactionMessage: {
        text: reactionText
      }
    }
  });
};

const extractDeleteTargetId = (deletePayload: any): string => {
  const rawId = String(deletePayload?.id || deletePayload?.key?.id || "").trim();
  if (!rawId) return "";
  if (rawId.startsWith("me:")) return rawId;

  const prefixedWidMatch = rawId.match(/^wuzapi:[^:]+:(.+)$/i);
  if (prefixedWidMatch?.[1]) return String(prefixedWidMatch[1]).trim();

  return rawId;
};

const sendDelete = async ({ whatsapp, phone, message }: any) => {
  const deletePayload = message?.delete;
  const deleteId = extractDeleteTargetId(deletePayload);

  if (!deleteId) {
    throw new AppError("WUZAPI_DELETE_ID_REQUIRED");
  }

  const payload: any = {
    Phone: phone,
    Id: deleteId
  };

  const response = await wuzapiRequest(whatsapp, "POST", "/chat/delete", payload);
  return mapResponseToWbotShape(response, {
    phone,
    message: {
      protocolMessage: {
        type: 0
      }
    }
  });
};

const extractEditTargetId = (editPayload: any): string => {
  const rawId = String(
    editPayload?.id || editPayload?.key?.id || editPayload?.messageID || ""
  ).trim();
  if (!rawId) return "";
  if (rawId.startsWith("me:")) return rawId.slice(3);
  const prefixedWidMatch = rawId.match(/^wuzapi:[^:]+:(.+)$/i);
  if (prefixedWidMatch?.[1]) return String(prefixedWidMatch[1]).trim();
  return rawId;
};

const sendEdit = async ({ whatsapp, phone, message }: any) => {
  const editPayload = message?.edit;
  const editId = extractEditTargetId(editPayload);
  const newBody = String(message?.text ?? message?.body ?? "").trim();

  if (!editId) {
    throw new AppError("WUZAPI_EDIT_ID_REQUIRED");
  }
  if (!newBody) {
    throw new AppError("WUZAPI_EDIT_BODY_REQUIRED");
  }

  const payload: any = {
    Phone: phone,
    Id: editId,
    Body: newBody
  };

  const response = await wuzapiRequest(whatsapp, "POST", "/chat/send/edit", payload);
  return mapResponseToWbotShape(response, {
    phone,
    message: {
      protocolMessage: {
        editedMessage: {
          conversation: newBody
        }
      }
    }
  });
};

const sendMedia = async ({
  whatsapp,
  endpoint,
  dataKey,
  phone,
  dataUri,
  caption,
  fileName,
  mediaMeta,
  options
}: any) => {
  const payload: any = {
    Phone: phone,
    [dataKey]: dataUri
  };

  if (caption) payload.Caption = caption;
  if (fileName) payload.FileName = fileName;
  if (endpoint === "/chat/send/audio" && mediaMeta) {
    if (typeof mediaMeta.MimeType === "string" && mediaMeta.MimeType.trim()) {
      payload.MimeType = mediaMeta.MimeType.trim();
    }
    if (typeof mediaMeta.PTT === "boolean") {
      payload.PTT = mediaMeta.PTT;
    }
    if (typeof mediaMeta.Seconds === "number" && Number.isFinite(mediaMeta.Seconds)) {
      payload.Seconds = Math.max(0, Math.floor(mediaMeta.Seconds));
    }
    if (typeof mediaMeta.Waveform === "string" && mediaMeta.Waveform.trim()) {
      payload.Waveform = mediaMeta.Waveform.trim();
    }
  }
  const contextInfo = buildContextInfo(options, whatsapp);
  if (contextInfo) payload.ContextInfo = contextInfo;
  Object.assign(payload, buildForwardingPayload(options));
  Object.assign(payload, buildQuotedPayload(options));

  const response = await wuzapiRequest(whatsapp, "POST", endpoint, payload);
  const messageByEndpoint: Record<string, any> = {
    "/chat/send/image": {
      imageMessage: {
        caption: String(caption || "")
      }
    },
    "/chat/send/video": {
      videoMessage: {
        caption: String(caption || "")
      }
    },
    "/chat/send/audio": {
      audioMessage: {}
    },
    "/chat/send/document": {
      documentMessage: {
        caption: String(caption || ""),
        fileName: String(fileName || "document")
      }
    },
    "/chat/send/sticker": {
      stickerMessage: {}
    }
  };
  return mapResponseToWbotShape(response, {
    phone,
    message: messageByEndpoint[endpoint] || { conversation: String(caption || "") }
  });
};

const toDataUri = async (
  input: any,
  mimeHint?: string,
  fileName?: string
): Promise<string> => {
  if (!input) throw new AppError("WUZAPI_MEDIA_EMPTY");

  if (Buffer.isBuffer(input)) {
    const resolvedMime = mimeHint || guessMime(fileName);
    return toDataUriFromBuffer(input, resolvedMime);
  }

  if (typeof input === "string") {
    if (isDataUri(input)) return input;
    if (/^https?:\/\//i.test(input)) return readRemoteAsDataUri(input, mimeHint);
    throw new AppError("WUZAPI_MEDIA_STRING_UNSUPPORTED");
  }

  if (input?.url && typeof input.url === "string") {
    if (isDataUri(input.url)) return input.url;
    if (/^https?:\/\//i.test(input.url)) {
      return readRemoteAsDataUri(input.url, mimeHint);
    }
  }

  throw new AppError("WUZAPI_MEDIA_FORMAT_UNSUPPORTED");
};

export const wuzapiSendMessage = async (
  whatsapp: Whatsapp,
  jidOrPhone: string,
  message: any,
  options?: any
): Promise<any> => {
  const phone = normalizePhone(jidOrPhone);

  if (message?.delete) {
    return sendWithLidFallback(phone, targetPhone =>
      sendDelete({
        whatsapp,
        phone: targetPhone,
        message
      })
    );
  }

  if (message?.react) {
    return sendWithLidFallback(phone, targetPhone =>
      sendReaction({
        whatsapp,
        phone: targetPhone,
        message
      })
    );
  }

  if (message?.edit) {
    return sendWithLidFallback(phone, targetPhone =>
      sendEdit({
        whatsapp,
        phone: targetPhone,
        message
      })
    );
  }

  if (message?.text !== undefined) {
    return sendWithLidFallback(phone, targetPhone =>
      sendText({
        whatsapp,
        phone: targetPhone,
        body: message.text,
        options: mergeOutboundOptions(message, options)
      })
    );
  }

  const firstContactVcard = message?.contacts?.contacts?.[0]?.vcard;
  if (firstContactVcard) {
    const displayName =
      message?.contacts?.displayName ||
      String(firstContactVcard)
        .split("\n")
        .find((line: string) => line.startsWith("FN:"))
        ?.replace(/^FN:/, "")
        ?.trim() ||
      "Contato";

    return sendWithLidFallback(phone, targetPhone =>
      sendContact({
        whatsapp,
        phone: targetPhone,
        name: displayName,
        vcard: firstContactVcard,
        options: mergeOutboundOptions(message, options)
      })
    );
  }

  if (message?.location) {
    const lat = Number(message.location?.degreesLatitude);
    const lng = Number(message.location?.degreesLongitude);
    const mapLink = `https://maps.google.com/maps?q=${lat}%2C${lng}&z=17`;
    const label = message.location?.name || message.location?.address || "Localizacao";
    return sendWithLidFallback(phone, targetPhone =>
      sendText({
        whatsapp,
        phone: targetPhone,
        body: `${label}\n${message.location?.address || ""}\n${mapLink}`.trim(),
        options: mergeOutboundOptions(message, options)
      })
    );
  }

  if (message?.image) {
    const mimeType = guessMime(message?.fileName, "image/jpeg");
    const dataUri = await toDataUri(message.image, mimeType, message?.fileName);
    return sendWithLidFallback(phone, targetPhone =>
      sendMedia({
        whatsapp,
        endpoint: "/chat/send/image",
        dataKey: "Image",
        phone: targetPhone,
        dataUri,
        caption: message?.caption,
        fileName: message?.fileName,
        options: mergeOutboundOptions(message, options)
      })
    );
  }

  if (message?.sticker) {
    const mimeType = message?.mimetype || guessMime(message?.fileName, "image/webp");
    const dataUri = await toDataUri(message.sticker, mimeType, message?.fileName);
    return sendWithLidFallback(phone, targetPhone =>
      sendMedia({
        whatsapp,
        endpoint: "/chat/send/sticker",
        dataKey: "Sticker",
        phone: targetPhone,
        dataUri,
        fileName: message?.fileName,
        options: mergeOutboundOptions(message, options)
      })
    );
  }

  if (message?.video) {
    const mimeType = guessMime(message?.fileName, "video/mp4");
    const dataUri = await toDataUri(message.video, mimeType, message?.fileName);
    return sendWithLidFallback(phone, targetPhone =>
      sendMedia({
        whatsapp,
        endpoint: "/chat/send/video",
        dataKey: "Video",
        phone: targetPhone,
        dataUri,
        caption: message?.caption,
        fileName: message?.fileName,
        options: mergeOutboundOptions(message, options)
      })
    );
  }

  if (message?.audio) {
    const mimeType = message?.mimetype || guessMime(message?.fileName, "audio/ogg");
    const dataUri = await toDataUri(message.audio, mimeType, message?.fileName);
    const waveformInput = message?.waveform;
    const waveform =
      typeof waveformInput === "string"
        ? waveformInput
        : Buffer.isBuffer(waveformInput)
        ? waveformInput.toString("base64")
        : waveformInput instanceof Uint8Array
        ? Buffer.from(waveformInput).toString("base64")
        : undefined;

    return sendWithLidFallback(phone, targetPhone =>
      sendMedia({
        whatsapp,
        endpoint: "/chat/send/audio",
        dataKey: "Audio",
        phone: targetPhone,
        dataUri,
        caption: message?.caption,
        fileName: message?.fileName,
        mediaMeta: {
          MimeType: mimeType,
          PTT: typeof message?.ptt === "boolean" ? message.ptt : true,
          Seconds:
            typeof message?.seconds === "number" ? Number(message.seconds) : undefined,
          Waveform: waveform
        },
        options: mergeOutboundOptions(message, options)
      })
    );
  }

  if (message?.document) {
    const mimeType =
      message?.mimetype || guessMime(message?.fileName, "application/octet-stream");
    const dataUri = await toDataUri(message.document, mimeType, message?.fileName);
    return sendWithLidFallback(phone, targetPhone =>
      sendMedia({
        whatsapp,
        endpoint: "/chat/send/document",
        dataKey: "Document",
        phone: targetPhone,
        dataUri,
        caption: message?.caption,
        fileName: message?.fileName || "document",
        options: mergeOutboundOptions(message, options)
      })
    );
  }

  throw new AppError("WUZAPI_MESSAGE_TYPE_UNSUPPORTED");
};

export const createWuzapiSessionAdapter = (whatsapp: Whatsapp, companyId: number): any => {
  const resolveAvatar = async (jidOrPhone: string): Promise<string> => {
    return resolveWuzapiAvatarUrlByCandidates(whatsapp, [jidOrPhone]);
  };

  const adapter: any = {
    id: whatsapp.id,
    companyId,
    provider: "wuzapi",
    user: {
      id: whatsapp.number ? `${whatsapp.number}@s.whatsapp.net` : undefined
    },
    sendMessage: async (jid: string, message: any, options?: any) =>
      wuzapiSendMessage(whatsapp, jid, message, options),
    sendPresenceUpdate: async (presence: string, jid?: string) => {
      const state = String(presence || "").toLowerCase().trim();

      if (state === "available" || state === "unavailable") {
        await wuzapiRequest(whatsapp, "POST", "/user/presence", {
          type: state
        });
        return true;
      }

      if (!jid) return true;

      const phone = toWuzapiPresencePhone(jid);
      if (!phone) return true;

      if (state === "recording") {
        await wuzapiRequest(whatsapp, "POST", "/chat/presence", {
          Phone: phone,
          State: "composing",
          Media: "audio"
        });
        return true;
      }

      if (state === "composing" || state === "paused") {
        await wuzapiRequest(whatsapp, "POST", "/chat/presence", {
          Phone: phone,
          State: state,
          Media: ""
        });
        return true;
      }

      return true;
    },
    presenceSubscribe: async () => true,
    readMessages: async () => true,
    groupMetadata: async (jid: string) => {
      const normalizedJid = normalizePhone(String(jid || ""));
      const data = await wuzapiRequest(whatsapp, "GET", "/group/info", undefined, {
        params: { groupJID: normalizedJid }
      });

      const participants = Array.isArray(data?.Participants)
        ? data.Participants
        : Array.isArray(data?.participants)
        ? data.participants
        : [];

      return {
        id: normalizedJid,
        subject: String(data?.Name || data?.name || data?.Subject || data?.subject || "").trim(),
        participants: participants.map((participant: any) => ({
          id: normalizePhone(
            String(
              participant?.JID ||
                participant?.jid ||
                participant?.id ||
                participant?.Phone ||
                participant?.phone ||
                participant?.Number ||
                participant?.number ||
                ""
            )
          ),
          lid: normalizePhone(String(participant?.LID || participant?.lid || "")),
          name:
            participant?.DisplayName ||
            participant?.displayName ||
            participant?.Name ||
            participant?.name ||
            participant?.PushName ||
            participant?.pushName ||
            null,
          admin:
            participant?.IsSuperAdmin === true
              ? "superadmin"
              : participant?.IsAdmin === true
              ? "admin"
              : null
        }))
      };
    },
    groupParticipantsUpdate: async (
      jid: string,
      participants: string[],
      action: "add" | "remove" | "promote" | "demote"
    ) => {
      const groupJID = normalizePhone(String(jid || ""));
      const phones = participants.map(p => normalizePhone(String(p || "")));
      await wuzapiRequest(whatsapp, "POST", "/group/updateparticipants", {
        GroupJID: groupJID,
        Phone: phones,
        Action: action
      });
      return true;
    },
    groupUpdateSubject: async (jid: string, subject: string) => {
      const groupJID = normalizePhone(String(jid || ""));
      await wuzapiRequest(whatsapp, "POST", "/group/name", {
        GroupJID: groupJID,
        Name: subject
      });
      return true;
    },
    groupUpdateDescription: async (jid: string, description: string) => {
      const groupJID = normalizePhone(String(jid || ""));
      await wuzapiRequest(whatsapp, "POST", "/group/topic", {
        GroupJID: groupJID,
        Topic: description || ""
      });
      return true;
    },
    groupInviteCode: async (jid: string) => {
      const groupJID = normalizePhone(String(jid || ""));
      const data = await wuzapiRequest(whatsapp, "GET", "/group/invitelink", undefined, {
        params: { groupJID, reset: false }
      });
      return data?.InviteLink || data?.inviteLink || "";
    },
    groupRevokeInvite: async (jid: string) => {
      const groupJID = normalizePhone(String(jid || ""));
      const data = await wuzapiRequest(whatsapp, "GET", "/group/invitelink", undefined, {
        params: { groupJID, reset: true }
      });
      return data?.InviteLink || data?.inviteLink || "";
    },
    onWhatsApp: async (jid: string) => wuzapiOnWhatsApp(whatsapp, jid),
    updateBlockStatus: async (jid: string, action: "block" | "unblock") => {
      const normalizedAction =
        String(action || "").toLowerCase() === "unblock" ? "unblock" : "block";
      const normalizedJid = normalizePhone(String(jid || ""));
      const payloads: Array<Record<string, string>> = [];
      const seenPayloads = new Set<string>();
      const pushPayload = (payload: Record<string, string>) => {
        const key = JSON.stringify(payload);
        if (!seenPayloads.has(key)) {
          seenPayloads.add(key);
          payloads.push(payload);
        }
      };
      const digits = normalizedJid.split("@")[0].replace(/\D/g, "");

      if (digits) {
        try {
          const checkData = await wuzapiRequest(whatsapp, "POST", "/user/check", {
            Phone: [digits]
          });
          const users = Array.isArray(checkData?.Users)
            ? checkData.Users
            : Array.isArray(checkData?.users)
            ? checkData.users
            : Array.isArray(checkData)
            ? checkData
            : [];
          const parsed = parseUserCheckResult(users[0]);
          const resolvedCheckJid = normalizePhone(
            String(parsed.jid || `${digits}@s.whatsapp.net`)
          );
          const checkDigits = resolvedCheckJid.split("@")[0].replace(/\D/g, "");

          // Usa payload por Phone vindo de /user/check (mais estável para blocklist).
          if (parsed.exists && checkDigits) {
            pushPayload({ Phone: checkDigits });
          }
        } catch {
          // Se /user/check falhar, mantém fallback de payloads abaixo.
        }
      }

      const phone = toWuzapiBlockPhone(jid);
      if (phone) {
        for (const variant of buildWuzapiBlockPhoneVariants(phone)) {
          pushPayload({ Phone: variant });
        }
      }

      if (!payloads.length) {
        throw new AppError("WUZAPI_INVALID_PHONE_FOR_BLOCK");
      }

      const endpoint = normalizedAction === "unblock" ? "/user/unblock" : "/user/block";
      let lastError: any = null;
      let lastPayload: Record<string, string> | null = null;
      for (const payload of payloads) {
        try {
          return await wuzapiRequest(whatsapp, "POST", endpoint, payload);
        } catch (error: any) {
          lastPayload = payload;
          lastError = error;
        }
      }

      if (lastError) {
        throw new AppError(
          `${String(lastError?.message || "WUZAPI_BLOCK_REQUEST_FAILED")} | target=${JSON.stringify(
            {
              input: jid,
              normalizedJid,
              endpoint,
              lastPayload
            }
          )}`
        );
      }

      throw new AppError(
        `WUZAPI_BLOCK_REQUEST_FAILED | target=${JSON.stringify({
          input: jid,
          normalizedJid,
          endpoint,
          lastPayload
        })}`
      );
    },
    profilePictureUrl: async (jid: string) => resolveAvatar(jid),
    relayMessage: async () => {
      throw new AppError("WUZAPI_RELAY_NOT_SUPPORTED");
    },
    upsertMessage: async () => true,
    logout: async () => {
      await wuzapiLogoutSession(whatsapp);
      return true;
    },
    ws: {
      close: async () => {
        await wuzapiDisconnectSession(whatsapp);
      }
    }
  };

  return adapter;
};

export { isWuzapiProvider };
