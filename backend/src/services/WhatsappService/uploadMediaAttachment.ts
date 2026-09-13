import { Request, Response } from "express";
import { isNil, head } from "lodash";
import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import path from "path";
import fs from "fs";
import { buildWebchatPublicUrl } from "../../helpers/BuildWebchatPublicUrl";

export const mediaUpload = async (req: Request, res: Response): Promise<Response> => {
    const { whatsappId } = req.params;
    const files = req.files as Express.Multer.File[];
    const file = head(files);
  
    try {
  
      const whatsapp = await Whatsapp.findByPk(whatsappId);
  
      whatsapp.greetingMediaAttachment = file.filename;
  
      await whatsapp.save();
  
      return res.status(200).json({ mensagem: "Arquivo adicionado!" });
  
    } catch (err: any) {
      throw new AppError(err.message);
    }
  };
  
export const webchatAvatarUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const files = req.files as Express.Multer.File[];
  const file = head(files);

  if (!file) {
    throw new AppError("Nenhum arquivo enviado", 400);
  }

  try {
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      throw new AppError("ERR_NO_WAPP_FOUND", 404);
    }

    const settings: any = whatsapp.webchatSettings || {};
    settings.avatar = buildWebchatPublicUrl(`company${whatsapp.companyId}/${file.filename}`);
    whatsapp.webchatSettings = settings;
    whatsapp.changed("webchatSettings", true);

    await whatsapp.save();

    return res.status(200).json({ avatar: settings.avatar });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};

export const deleteMedia = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { whatsappId } = req.params;
  
    try {
      const whatsapp = await Whatsapp.findByPk(whatsappId);
      const filePath = path.resolve(
        "public",
        `company${whatsapp.companyId}`,
        whatsapp.greetingMediaAttachment
      );
      const fileExists = fs.existsSync(filePath);
      if (fileExists) {
        fs.unlinkSync(filePath);
      }
  
      whatsapp.greetingMediaAttachment = null
      await whatsapp.save();
      return res.send({ message: "Arquivo excluído" });
    } catch (err: any) {
      throw new AppError(err.message);
    }
};