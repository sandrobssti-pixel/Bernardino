import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import {
  clearSessionRuntimeState,
  removeWbot,
  tryGetWbot
} from "../libs/wbot";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import cacheLayer from "../libs/cache";
import {
  isWuzapiProvider,
  wuzapiConfirmPasskey,
  wuzapiDisconnectSession,
  wuzapiLogoutSession,
  wuzapiSendPasskeyResponse
} from "../services/WuzapiServices/wuzapiClient";
import ShowWhatsAppServiceAdmin from "../services/WhatsappService/ShowWhatsAppServiceAdmin";

const getAuthorizedWhatsapp = async (
  whatsappId: string,
  companyId: number,
  isSuper?: boolean
) => {
  if (isSuper) {
    return ShowWhatsAppServiceAdmin(whatsappId);
  }

  return ShowWhatsAppService(whatsappId, companyId);
};

const store = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId, super: isSuper } = req.user;

  const whatsapp = await getAuthorizedWhatsapp(whatsappId, companyId, isSuper);
  const targetCompanyId = whatsapp.companyId;
  if (!isWuzapiProvider(whatsapp)) {
    const hasRuntime = Boolean(tryGetWbot(whatsapp.id, targetCompanyId));
    if (hasRuntime && (whatsapp.status === "qrcode" || whatsapp.status === "OPENING")) {
      return res.status(200).json({ message: "Session already starting." });
    }
  }
  await StartWhatsAppSession(whatsapp, targetCompanyId);

  return res.status(200).json({ message: "Starting session." });
};

const update = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId, super: isSuper } = req.user;

  const whatsapp = await getAuthorizedWhatsapp(whatsappId, companyId, isSuper);
  const targetCompanyId = whatsapp.companyId;

  if (whatsapp.channel === "whatsapp") {
    if (!isWuzapiProvider(whatsapp)) {
      const hasRuntime = Boolean(tryGetWbot(whatsapp.id, targetCompanyId));
      if (hasRuntime && (whatsapp.status === "qrcode" || whatsapp.status === "OPENING")) {
        return res.status(200).json({ message: "Session already starting." });
      }
    }

    clearSessionRuntimeState(whatsapp.id);
    await removeWbot(whatsapp.id, false);
    await cacheLayer.delFromPattern(`sessions:${whatsapp.id}:*`);
    if (isWuzapiProvider(whatsapp)) {
      try {
        await wuzapiDisconnectSession(whatsapp);
      } catch {}
      await whatsapp.update({
        qrcode: "",
        retries: 0,
        status: "OPENING"
      });
      await StartWhatsAppSession(whatsapp, targetCompanyId);
      return res.status(200).json({ message: "Starting session." });
    }
    await whatsapp.update({
      session: "",
      qrcode: "",
      number: "",
      retries: 0,
      status: "DISCONNECTED"
    });
    await StartWhatsAppSession(whatsapp, targetCompanyId);
  }

  return res.status(200).json({ message: "Starting session." });
};

const remove = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId, super: isSuper } = req.user;
  const whatsapp = await getAuthorizedWhatsapp(whatsappId, companyId, isSuper);
  const targetCompanyId = whatsapp.companyId;


  if (whatsapp.channel === "whatsapp") {
    clearSessionRuntimeState(whatsapp.id);
    if (isWuzapiProvider(whatsapp)) {
      try {
        await wuzapiLogoutSession(whatsapp);
      } catch {}
    } else {
      await DeleteBaileysService(whatsappId);
    }
    await cacheLayer.delFromPattern(`sessions:${whatsapp.id}:*`);

    const wbot = tryGetWbot(whatsapp.id);

    if (wbot) {
      try {
        await wbot.logout();
      } catch {}
      try {
        wbot.ws.close();
      } catch {}
    }
    await removeWbot(whatsapp.id, false);
  }

  await whatsapp.update({
    session: "",
    qrcode: "",
    number: "",
    retries: 0,
    status: "DISCONNECTED"
  });

  const io = getIO();
  io.of(String(targetCompanyId)).emit(`company-${targetCompanyId}-whatsappSession`, {
    action: "update",
    session: whatsapp
  });

  if (res.headersSent) {
    return res;
  }

  return res.status(200).json({ message: "Session disconnected." });
};

const passkey = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId, super: isSuper } = req.user;
  const { response } = req.body;

  const whatsapp = await getAuthorizedWhatsapp(whatsappId, companyId, isSuper);

  if (!isWuzapiProvider(whatsapp)) {
    return res
      .status(400)
      .json({ message: "Passkey pairing is only available for Wuzapi sessions." });
  }

  await wuzapiSendPasskeyResponse(whatsapp, response);
  await wuzapiConfirmPasskey(whatsapp);

  return res.status(200).json({ message: "Passkey confirmed." });
};

export default { store, remove, update, passkey };
