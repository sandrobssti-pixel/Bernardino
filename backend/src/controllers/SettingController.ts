import { Request, Response } from "express";

import { getIO } from "../libs/socket";
import AppError from "../errors/AppError";

import UpdateSettingService from "../services/SettingServices/UpdateSettingService";
import ListSettingsService from "../services/SettingServices/ListSettingsService";
import ListSettingsServiceOne from "../services/SettingServices/ListSettingsServiceOne";
import GetSettingService from "../services/SettingServices/GetSettingService";
import UpdateOneSettingService from "../services/SettingServices/UpdateOneSettingService";
import GetPublicSettingService from "../services/SettingServices/GetPublicSettingService";

type LogoRequest = {
  mode: string;
};

type PrivateFileRequest = {
  settingKey: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  // if (req.user.profile !== "admin") {
  //   throw new AppError("ERR_NO_PERMISSION", 403);
  // }

  const settings = await ListSettingsService({ companyId });

  return res.status(200).json(settings);
};

export const showOne = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { settingKey: key } = req.params;

  console.log("|======== GetPublicSettingService ========|")
  console.log("key", key)
  console.log("|=========================================|")

  
  const settingsTransfTicket = await ListSettingsServiceOne({ companyId: companyId, key: key });

  return res.status(200).json(settingsTransfTicket);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {

  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { settingKey: key } = req.params;
  const { value } = req.body;
  const { companyId } = req.user;

  const setting = await UpdateSettingService({
    key,
    value,
    companyId
  });

  const io = getIO();
  io.of(String(companyId))
  .emit(`company-${companyId}-settings`, {
    action: "update",
    setting
  });

  return res.status(200).json(setting);
};

export const getSetting = async (
  req: Request,
  res: Response): Promise<Response> => {

  const { settingKey: key } = req.params;

  const setting = await GetSettingService({ key });

  return res.status(200).json(setting);

}

export const updateOne = async (
  req: Request,
  res: Response
): Promise<Response> => {

  const { settingKey: key } = req.params;
  const { value } = req.body;

  const setting = await UpdateOneSettingService({
    key,
    value
  });

  return res.status(200).json(setting); 
};

export const publicShow = async (req: Request, res: Response): Promise<Response> => {
  console.log("|=============== publicShow  ==============|")
  
  const { settingKey: key } = req.params;
  
  const settingValue = await GetPublicSettingService({ key });


  return res.status(200).json(settingValue);
};

export const manifest = async (req: Request, res: Response): Promise<Response> => {
  const [appName, icon192, icon512, themeColor] = await Promise.all([
    GetPublicSettingService({ key: "appName" }),
    GetPublicSettingService({ key: "appLogoPwaAndroid192" }),
    GetPublicSettingService({ key: "appLogoPwaAndroid512" }),
    GetPublicSettingService({ key: "primaryColorLight" })
  ]);

  const backendUrl = String(process.env.BACKEND_URL || "").trim().replace(/\/+$/, "");
  const frontendUrl = String(process.env.FRONTEND_URL || "").trim().replace(/\/+$/, "");

  const resolveIconUrl = (value: string | undefined, fallbackPath: string): string => {
    if (!value) return `${frontendUrl}${fallbackPath}`;
    if (value.startsWith("http")) return value;
    return `${backendUrl}/public/${value}`;
  };

  const name = appName || "AtendeFlow";
  // O manifesto é servido pela API, mas o PWA é executado no domínio do
  // frontend. start_url e scope precisam apontar para o frontend para que o
  // service worker daquele domínio controle a página inicial do aplicativo.
  const appUrl = frontendUrl ? `${frontendUrl}/` : "/";

  const manifestJson = {
    short_name: name,
    name,
    icons: [
      {
        src: resolveIconUrl(icon192, "/android-chrome-192x192.png"),
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: resolveIconUrl(icon512, "/android-chrome-512x512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ],
    id: appUrl,
    start_url: appUrl,
    display: "standalone",
    theme_color: themeColor || "#000000",
    background_color: "#ffffff",
    prefer_related_applications: false,
    categories: ["business", "productivity"],
    description: "Sistema de MultiAtendimento para WhatsApp",
    orientation: "any",
    scope: appUrl
  };

  res.setHeader("Content-Type", "application/manifest+json");
  return res.status(200).json(manifestJson);
};

export const storeLogo = async (req: Request, res: Response): Promise<Response> => {
  const file = req.file as Express.Multer.File;
  const { mode }: LogoRequest = req.body;
  const { companyId } = req.user;
  const validModes = ["Light", "Dark", "Favicon", "AppleTouchIcon", "PwaAndroid192", "PwaAndroid512", "PwaMsTile150"];

  const modeToSettingKey: Record<string, string> = {
    Light: "appLogoLight",
    Dark: "appLogoDark",
    Favicon: "appLogoFavicon",
    AppleTouchIcon: "appLogoAppleTouchIcon",
    PwaAndroid192: "appLogoPwaAndroid192",
    PwaAndroid512: "appLogoPwaAndroid512",
    PwaMsTile150: "appLogoPwaMsTile150",
  };

  console.log("|=============== storeLogo  ==============|", storeLogo)

  if ( validModes.indexOf(mode) === -1 ) {
    return res.status(406);
  }

  if (file && file.mimetype.startsWith("image/")) {
    
    const setting = await UpdateSettingService({
      key: modeToSettingKey[mode],
      value: file.filename,
      companyId
    });
    
    return res.status(200).json(setting.value);
  }
  
  return res.status(406);
}

export const storePrivateFile = async (req: Request, res: Response): Promise<Response> => {
  const file = req.file as Express.Multer.File;
  const { settingKey }: PrivateFileRequest = req.body;
  const { companyId } = req.user;


  console.log("|=============== storePrivateFile  ==============|", storeLogo)

  const setting = await UpdateSettingService({
    key: `_${settingKey}`,
    value: file.filename,
    companyId
  });
  
  return res.status(200).json(setting.value);
}
