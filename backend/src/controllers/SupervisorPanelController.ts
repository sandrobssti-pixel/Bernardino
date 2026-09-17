import { Request, Response } from "express";
import * as Yup from "yup";
import AppError from "../errors/AppError";
import EnsureSupervisorPanelAccess, {
  GetSupervisorPanelAccessStatus
} from "../services/SupervisorPanelService/EnsureSupervisorPanelAccess";
import * as SupervisorPanelService from "../services/SupervisorPanelService/SupervisorPanelService";
import * as NotificationService from "../services/SupervisorPanelService/NotificationService";
import User from "../models/User";
import { getIO } from "../libs/socket";

const ensureAccess = async (req: Request): Promise<void> => {
  const allowed = await EnsureSupervisorPanelAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_SUPERVISOR_PANEL_ACCESS", 403);
  }
};

export const access = async (req: Request, res: Response): Promise<Response> => {
  const status = await GetSupervisorPanelAccessStatus(req.user as any);
  return res.status(200).json(status);
};

export const live = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const rows = await SupervisorPanelService.listLiveTickets(companyId);
  return res.status(200).json(rows);
};

export const summary = async (req: Request, res: Response): Promise<Response> => {
  await ensureAccess(req);
  const { companyId } = req.user;

  const data = await SupervisorPanelService.getSummary(companyId);
  return res.status(200).json(data);
};

const messageSchema = Yup.object().shape({
  ticketId: Yup.number().required("ERR_SUPERVISOR_MESSAGE_TICKET_REQUIRED"),
  userId: Yup.number().required("ERR_SUPERVISOR_MESSAGE_USER_REQUIRED"),
  message: Yup.string().required("ERR_SUPERVISOR_MESSAGE_REQUIRED").min(1)
});

// Mensagem ao vivo de um supervisor autorizado direto pro atendente que está
// no meio de um atendimento (ver docs/MANUAL_TECNICO.md) — persiste como
// Notification e entrega em tempo real via socket, sala pessoal do usuário.
export const sendMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  await ensureAccess(req);
  const { companyId, id: fromUserId } = req.user;

  try {
    await messageSchema.validate(req.body);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const { ticketId, userId, message } = req.body;

  const fromUser = await User.findByPk(fromUserId);

  const notification = await NotificationService.create({
    type: "supervisor_message",
    title: `Mensagem de ${fromUser?.name || "supervisor"}`,
    message,
    userId,
    ticketId,
    companyId
  });

  const io = getIO();
  io.of(String(companyId))
    .to(`user-${userId}`)
    .emit(`company-${companyId}-supervisorMessage`, notification);

  return res.status(200).json(notification);
};
