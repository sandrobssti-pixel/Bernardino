import { Request, Response } from "express";
import * as Yup from "yup";
import AppError from "../errors/AppError";
import BirthdayService from "../services/BirthdayService";

const settingsSchema = Yup.object().shape({
  userBirthdayEnabled: Yup.boolean(),
  contactBirthdayEnabled: Yup.boolean(),
  contactBirthdayMessage: Yup.string().max(1000),
  sendBirthdayTime: Yup.string().matches(
    /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/,
    "Formato de horário inválido (HH:MM ou HH:MM:SS)"
  ),
  sendIntervalSeconds: Yup.number().integer().min(0).max(3600),
  whatsappId: Yup.number().nullable()
});

const sendSchema = Yup.object().shape({
  contactId: Yup.number().required(),
  customMessage: Yup.string().max(1000)
});

const normalizeTime = (time?: string): string | undefined => {
  if (!time) return time;
  return /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
};

export const getTodayBirthdays = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const data = await BirthdayService.getTodayBirthdaysForCompany(companyId);
  return res.json({ status: "success", data });
};

export const getBirthdaySettings = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const data = await BirthdayService.getBirthdaySettings(companyId);
  return res.json({ status: "success", data });
};

export const updateBirthdaySettings = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const body = { ...req.body, sendBirthdayTime: normalizeTime(req.body?.sendBirthdayTime) };
  await settingsSchema.validate(body);
  const data = await BirthdayService.updateBirthdaySettings(companyId, body);
  return res.json({ status: "success", data });
};

export const sendBirthdayMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  await sendSchema.validate(req.body);
  try {
    const ok = await BirthdayService.sendBirthdayMessageToContact(
      req.body.contactId,
      companyId,
      req.body.customMessage
    );
    if (!ok) throw new AppError("Erro ao enviar mensagem de aniversário", 400);
    return res.json({ status: "success" });
  } catch (error: any) {
    if (error?.message === "MESSAGE_ALREADY_SENT") {
      throw new AppError("Mensagem de aniversário já foi enviada hoje para este contato", 409);
    }
    throw error;
  }
};
