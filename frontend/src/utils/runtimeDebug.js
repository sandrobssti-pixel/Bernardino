import { getBackendUrl } from "../config";

const STORAGE_KEY = "wt_front_debug_log";
const MAX_ITEMS = 120;
const lastSentByType = {};

const isIosSafariBrowser = () => {
  try {
    const ua = window.navigator.userAgent || "";
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    const isSafari =
      /Safari/i.test(ua) &&
      !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|GSA/i.test(ua);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    return isIOS && isSafari && !isStandalone;
  } catch (_) {
    return false;
  }
};

const shouldDebug = () => {
  try {
    return localStorage.getItem("wt_front_debug") === "1" || isIosSafariBrowser();
  } catch (_) {
    return isIosSafariBrowser();
  }
};

const persistLog = (entry) => {
  if (!shouldDebug()) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.push(entry);
    if (list.length > MAX_ITEMS) {
      list.splice(0, list.length - MAX_ITEMS);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (_) {}
};

const postToBackend = (entry) => {
  if (!shouldDebug()) return;
  const backendUrl = getBackendUrl();
  if (!backendUrl) return;

  const url = `${backendUrl}/debug/frontend-log`;
  const body = JSON.stringify(entry);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon(url, blob);
      if (ok) return;
    }
  } catch (_) {}

  try {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch (_) {}
};

const stringifyError = (error) => {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error?.stack) return String(error.stack);
  if (error?.message) return String(error.message);
  try {
    return JSON.stringify(error);
  } catch (_) {
    return String(error);
  }
};

export const debugLogFrontend = (type, payload = {}) => {
  const entry = {
    type,
    stage: payload.stage || "runtime",
    message: payload.message || "",
    route: window.location?.pathname || "",
    ts: new Date().toISOString(),
    ua: window.navigator?.userAgent || "",
  };

  persistLog(entry);
  const now = Date.now();
  const minInterval = type === "route.render" ? 3000 : 800;
  const last = lastSentByType[type] || 0;
  if (now - last >= minInterval) {
    lastSentByType[type] = now;
    postToBackend(entry);
  }

  if (shouldDebug()) {
    try {
      // Não remova: útil para inspecionar em Safari remote debugger
      console.log("[WT_FRONT_DEBUG]", entry);
    } catch (_) {}
  }
};

export const debugCaptureWindowErrors = () => {
  if (!shouldDebug()) return;

  window.addEventListener("error", (event) => {
    debugLogFrontend("window.error", {
      stage: "global",
      message: stringifyError(event?.error || event?.message),
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    debugLogFrontend("window.unhandledrejection", {
      stage: "global",
      message: stringifyError(event?.reason),
    });
  });
};

export const debugGetStoredLogs = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
};
