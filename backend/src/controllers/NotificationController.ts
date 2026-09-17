import { Request, Response } from "express";
import AppError from "../errors/AppError";
import EnsureSupervisorPanelAccess from "../services/SupervisorPanelService/EnsureSupervisorPanelAccess";
import * as NotificationService from "../services/SupervisorPanelService/NotificationService";

// Listar é liberado pra qualquer usuário autenticado — cada um só vê as
// próprias notificações, a menos que tenha acesso ao Painel Vigia (aí vê
// todas da empresa). Apagar é restrito a quem tem acesso ao Painel Vigia
// (mesma regra do "canClearNotifications" do sino: admin/autorizado).
export const index = async (req: Request, res: Response): Promise<Response> => {
  const records = await NotificationService.list(req.user as any);
  return res.status(200).json(records);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const allowed = await EnsureSupervisorPanelAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_SUPERVISOR_PANEL_ACCESS", 403);
  }
  const { companyId } = req.user;
  const { id } = req.params;

  await NotificationService.remove(id, companyId);
  return res.status(200).json({ message: "Notification deleted" });
};

export const removeAll = async (req: Request, res: Response): Promise<Response> => {
  const allowed = await EnsureSupervisorPanelAccess(req.user as any);
  if (!allowed) {
    throw new AppError("ERR_NO_SUPERVISOR_PANEL_ACCESS", 403);
  }
  const { companyId } = req.user;

  await NotificationService.removeAll(companyId);
  return res.status(200).json({ message: "Notifications cleared" });
};
