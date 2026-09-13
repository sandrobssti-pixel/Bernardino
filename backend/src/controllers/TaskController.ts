import { Request, Response } from "express";
import * as Yup from "yup";

import AppError from "../errors/AppError";
import Task from "../models/Task";
import User from "../models/User";

type TaskPayload = {
  title: string;
  description?: string;
  comments?: string;
  dueDate?: string;
  status?: string;
  priority?: string;
  sortOrder?: number;
  responsibleUserId?: number | string;
};

const isManager = (user: any): boolean => {
  return Boolean(user?.super) || String(user?.profile || "").toLowerCase() === "admin";
};

const resolveUserName = async (userId: number, fallback = "Usuário") => {
  const user = await User.findByPk(userId);
  return user?.name || fallback;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;

  const where = isManager(req.user)
    ? { companyId }
    : { companyId, responsibleUserId: userId };

  const tasks = await Task.findAll({
    where,
    order: [["updatedAt", "DESC"]]
  });

  return res.status(200).json(tasks);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const data = req.body as TaskPayload;
  const { companyId, id: userId } = req.user;

  const schema = Yup.object().shape({
    title: Yup.string().trim().required(),
    description: Yup.string().nullable(),
    comments: Yup.string().nullable(),
    dueDate: Yup.string().nullable(),
    status: Yup.string().oneOf(["rejected", "pending", "in_progress", "complete"]).nullable(),
    priority: Yup.string().oneOf(["low", "medium", "high", "urgent"]).nullable(),
    sortOrder: Yup.number().integer().nullable(),
    responsibleUserId: Yup.mixed().nullable()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const manager = isManager(req.user);
  const responsibleIdRaw = manager ? data.responsibleUserId : userId;
  const responsibleUserId = Number(responsibleIdRaw || userId);

  if (!Number.isFinite(responsibleUserId) || responsibleUserId <= 0) {
    throw new AppError("ERR_INVALID_RESPONSIBLE_USER", 400);
  }

  const responsibleUserName = await resolveUserName(responsibleUserId, "Usuário");
  const createdByUserName = await resolveUserName(Number(userId), "Usuário");

  const task = await Task.create({
    title: data.title.trim(),
    description: (data.description || "").trim(),
    comments: (data.comments || "").trim(),
    dueDate: data.dueDate || "",
    status: data.status || "pending",
    priority: data.priority || "medium",
    sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 0,
    companyId,
    responsibleUserId,
    responsibleUserName,
    createdByUserId: Number(userId),
    createdByUserName
  });

  return res.status(200).json(task);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const data = req.body as TaskPayload;
  const { id } = req.params;
  const { companyId, id: userId } = req.user;

  const task = await Task.findOne({ where: { id, companyId } });

  if (!task) {
    throw new AppError("ERR_NO_TASK_FOUND", 404);
  }

  const manager = isManager(req.user);
  if (!manager && Number(task.responsibleUserId) !== Number(userId) && Number(task.createdByUserId) !== Number(userId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const schema = Yup.object().shape({
    title: Yup.string().trim().required(),
    description: Yup.string().nullable(),
    comments: Yup.string().nullable(),
    dueDate: Yup.string().nullable(),
    status: Yup.string().oneOf(["rejected", "pending", "in_progress", "complete"]).nullable(),
    priority: Yup.string().oneOf(["low", "medium", "high", "urgent"]).nullable(),
    sortOrder: Yup.number().integer().nullable(),
    responsibleUserId: Yup.mixed().nullable()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const responsibleIdRaw = manager ? data.responsibleUserId : task.responsibleUserId;
  const responsibleUserId = Number(responsibleIdRaw || task.responsibleUserId);

  if (!Number.isFinite(responsibleUserId) || responsibleUserId <= 0) {
    throw new AppError("ERR_INVALID_RESPONSIBLE_USER", 400);
  }

  const responsibleUserName = await resolveUserName(responsibleUserId, task.responsibleUserName || "Usuário");

  await task.update({
    title: data.title.trim(),
    description: (data.description || "").trim(),
    comments: (data.comments || "").trim(),
    dueDate: data.dueDate || "",
    status: data.status || task.status,
    priority: data.priority || task.priority,
    sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : task.sortOrder,
    responsibleUserId,
    responsibleUserName
  });

  return res.status(200).json(task);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const { companyId, id: userId } = req.user;

  const task = await Task.findOne({ where: { id, companyId } });

  if (!task) {
    throw new AppError("ERR_NO_TASK_FOUND", 404);
  }

  const manager = isManager(req.user);
  if (!manager && Number(task.responsibleUserId) !== Number(userId) && Number(task.createdByUserId) !== Number(userId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await task.destroy();

  return res.status(200).json({ message: "Task deleted" });
};
