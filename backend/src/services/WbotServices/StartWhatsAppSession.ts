import { initWASocket, tryGetWbot, upsertWbotSession } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import { wbotMessageListener } from "./wbotMessageListener";
import { getIO } from "../../libs/socket";
import wbotMonitor from "./wbotMonitor";
import logger from "../../utils/logger";
import * as Sentry from "@sentry/node";
import {
  createWuzapiSessionAdapter,
  ensureWuzapiUserExists,
  isWuzapiProvider,
  wuzapiConnectSession,
  wuzapiGetPasskeyStatus,
  wuzapiGetQrCode,
  wuzapiStatusSession
} from "../WuzapiServices/wuzapiClient";
import importWuzapiHistoryService from "../WuzapiServices/ImportWuzapiHistoryService";

const sessionStartLocks = new Map<number, number>();
const START_LOCK_TTL_MS = 120_000;
const QR_FETCH_ATTEMPTS = 20;
const QR_FETCH_DELAY_MS = 1500;
const WUZAPI_LOGIN_POLL_ATTEMPTS = 180;
const WUZAPI_LOGIN_POLL_DELAY_MS = 2000;
const wuzapiLoginMonitors = new Set<number>();
const wuzapiPasskeyNotified = new Map<number, string>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isWuzapiAlreadyConnectedError = (error: any): boolean =>
  String(error?.message || "")
    .toLowerCase()
    .includes("already connected");

const extractNumberFromJid = (jid?: string, fallback = ""): string => {
  const raw = String(jid || "").trim();
  if (!raw) return fallback;

  const localPart = raw.split("@")[0] || "";
  const primaryId = localPart.split(":")[0] || localPart;
  const digits = primaryId.replace(/\D/g, "");

  return digits || fallback;
};

const startWuzapiLoginMonitor = async (
  whatsappId: number,
  companyId: number
): Promise<void> => {
  if (wuzapiLoginMonitors.has(whatsappId)) return;
  wuzapiLoginMonitors.add(whatsappId);

  try {
    for (let attempt = 0; attempt < WUZAPI_LOGIN_POLL_ATTEMPTS; attempt++) {
      await sleep(WUZAPI_LOGIN_POLL_DELAY_MS);

      const current = await Whatsapp.findByPk(whatsappId);
      if (!current) return;
      if (!isWuzapiProvider(current)) return;
      if (current.status === "CONNECTED") return;
      if (current.status === "DISCONNECTED") return;

      let status;
      try {
        status = await wuzapiStatusSession(current);
      } catch {
        continue;
      }

      if (status?.loggedIn) {
        const number = extractNumberFromJid(status.jid, current.number || "");

        await current.update({
          status: "CONNECTED",
          qrcode: "",
          retries: 0,
          number
        });

        const adapter = createWuzapiSessionAdapter(current, companyId);
        upsertWbotSession(adapter, current.id, companyId);

        const io = getIO();
        io.of(String(companyId)).emit(`company-${companyId}-whatsappSession`, {
          action: "update",
          session: current
        });

        void importWuzapiHistoryService(current.id);

        return;
      }

      try {
        const passkey = await wuzapiGetPasskeyStatus(current);
        if (passkey.passkeyPending && passkey.publicKey) {
          const marker = JSON.stringify(passkey.publicKey);
          if (wuzapiPasskeyNotified.get(whatsappId) !== marker) {
            wuzapiPasskeyNotified.set(whatsappId, marker);
            const io = getIO();
            io.of(String(companyId)).emit(
              `company-${companyId}-whatsappSessionPasskey`,
              { whatsappId, publicKey: passkey.publicKey }
            );
          }
        } else {
          wuzapiPasskeyNotified.delete(whatsappId);
        }
      } catch {
        // Falha ao consultar passkey não deve interromper o monitor de login.
      }
    }
  } finally {
    wuzapiLoginMonitors.delete(whatsappId);
    wuzapiPasskeyNotified.delete(whatsappId);
  }
};

export const StartWhatsAppSession = async (
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> => {
  const isWuzapi = isWuzapiProvider(whatsapp);
  if (!isWuzapi) {
    const current = await Whatsapp.findByPk(whatsapp.id);
    const currentStatus = String(current?.status || "");
    const hasActiveRuntime = Boolean(tryGetWbot(whatsapp.id, companyId));
    if (
      hasActiveRuntime &&
      (currentStatus === "qrcode" ||
        currentStatus === "OPENING" ||
        currentStatus === "CONNECTED")
    ) {
      logger.warn(
        `Session ${whatsapp.id} já está em ${currentStatus} com runtime ativo; ignorando start duplicado`
      );
      return;
    }
  }

  const lockAt = sessionStartLocks.get(whatsapp.id);
  if (lockAt && Date.now() - lockAt < START_LOCK_TTL_MS) {
    logger.warn(
      `Session ${whatsapp.id} start já em andamento; ignorando chamada duplicada`
    );
    return;
  }
  if (lockAt) {
    logger.warn(`Session ${whatsapp.id} lock antigo detectado; liberando lock`);
  }
  sessionStartLocks.set(whatsapp.id, Date.now());

  try {
    await whatsapp.update({ status: "OPENING" });

    const io = getIO();
    io.of(String(companyId)).emit(`company-${companyId}-whatsappSession`, {
      action: "update",
      session: whatsapp
    });

    if (isWuzapi) {
      await ensureWuzapiUserExists(whatsapp);
      try {
        await wuzapiConnectSession(whatsapp);
      } catch (error: any) {
        if (!isWuzapiAlreadyConnectedError(error)) {
          throw error;
        }
      }
      const status = await wuzapiStatusSession(whatsapp);

      if (status.loggedIn) {
        const number = extractNumberFromJid(status.jid, whatsapp.number || "");

        await whatsapp.update({
          status: "CONNECTED",
          qrcode: "",
          retries: 0,
          number
        });

        const adapter = createWuzapiSessionAdapter(whatsapp, companyId);
        upsertWbotSession(adapter, whatsapp.id, companyId);
        void importWuzapiHistoryService(whatsapp.id);
      } else {
        let qrCode = String(
          status?.raw?.qrcode || status?.raw?.QRCode || status?.raw?.qr || ""
        );

        for (let attempt = 0; !qrCode && attempt < QR_FETCH_ATTEMPTS; attempt++) {
          try {
            qrCode = await wuzapiGetQrCode(whatsapp);
          } catch {
            // ignore and keep retrying
          }

          if (qrCode) break;
          await sleep(QR_FETCH_DELAY_MS);
        }

        if (!qrCode) {
          logger.error(
            `Session ${whatsapp.id}: falha ao obter QR Code do WuzAPI após ${QR_FETCH_ATTEMPTS} tentativas`
          );
          await whatsapp.update({
            status: "DISCONNECTED",
            qrcode: "",
            retries: 0,
            number: ""
          });
          const refreshedFail = await Whatsapp.findByPk(whatsapp.id);
          io.of(String(companyId)).emit(`company-${companyId}-whatsappSession`, {
            action: "update",
            session: refreshedFail || whatsapp
          });
          return;
        }

        await whatsapp.update({
          status: "qrcode",
          qrcode: qrCode,
          retries: 0,
          number: ""
        });

        void startWuzapiLoginMonitor(whatsapp.id, companyId);
      }

      const refreshed = await Whatsapp.findByPk(whatsapp.id);
      io.of(String(companyId)).emit(`company-${companyId}-whatsappSession`, {
        action: "update",
        session: refreshed || whatsapp
      });
      return;
    }

    const wbot = await initWASocket(whatsapp);
    if (wbot) {
      wbotMessageListener(wbot, companyId);
      wbotMonitor(wbot, whatsapp, companyId);
    }
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
    try {
      const current = await Whatsapp.findByPk(whatsapp.id);
      if (current?.status === "OPENING") {
        await current.update({ status: "DISCONNECTED", qrcode: "" });
        const io = getIO();
        io.of(String(companyId)).emit(`company-${companyId}-whatsappSession`, {
          action: "update",
          session: current
        });
      }
    } catch (updateErr) {
      logger.error(updateErr);
    }
  } finally {
    sessionStartLocks.delete(whatsapp.id);
  }
};
