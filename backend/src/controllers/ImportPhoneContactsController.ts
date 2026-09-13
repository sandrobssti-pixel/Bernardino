import { Request, Response } from "express";
import ImportContactsService from "../services/WbotServices/ImportContactsService";

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const whatsappIdRaw = req.body?.whatsappId;
  const whatsappId =
    whatsappIdRaw !== undefined && whatsappIdRaw !== null && whatsappIdRaw !== ""
      ? Number(whatsappIdRaw)
      : undefined;
  const safeWhatsappId =
    whatsappId !== undefined && !Number.isNaN(whatsappId) ? whatsappId : undefined;

  const result = await ImportContactsService(companyId, safeWhatsappId);

  return res.status(200).json(result);
};
