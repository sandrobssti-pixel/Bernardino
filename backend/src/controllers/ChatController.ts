import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import CreateService from "../services/ChatService/CreateService";
import ListService from "../services/ChatService/ListService";
import ShowFromUuidService from "../services/ChatService/ShowFromUuidService";
import DeleteService from "../services/ChatService/DeleteService";
import FindMessages from "../services/ChatService/FindMessages";
import UpdateService from "../services/ChatService/UpdateService";

import Chat from "../models/Chat";
import CreateMessageService from "../services/ChatService/CreateMessageService";
import User from "../models/User";
import ChatUser from "../models/ChatUser";
import AppError from "../errors/AppError";
import { ensureChatAccess } from "../services/ChatService/ChatHelpers";

type IndexQuery = {
  pageNumber: string;
  companyId: string | number;
  ownerId?: number;
};

type StoreData = {
  users: any[];
  title: string;
  isGroup?: boolean;
};

type FindParams = {
  companyId: number;
  ownerId?: number;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { pageNumber } = req.query as unknown as IndexQuery;
  const ownerId = +req.user.id;

  const { records, count, hasMore } = await ListService({
    ownerId,
    pageNumber
  });

  return res.json({ records, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const ownerId = +req.user.id;
  const data = req.body as StoreData;

  const schema = Yup.object().shape({
    title: Yup.string().nullable(),
    isGroup: Yup.boolean(),
    users: Yup.array()
      .of(
        Yup.object().shape({
          id: Yup.number().required()
        })
      )
      .required()
  });

  try {
    await schema.validate(data);
  } catch (err) {
    throw new AppError(err.message);
  }

  const record = await CreateService({
    ...data,
    ownerId,
    companyId
  });

  const io = getIO();

  record.users.forEach(user => {
    const targetUserId = Number((user as any)?.userId || (user as any)?.user?.id || 0);
    if (!targetUserId) return;
    io.of(String(companyId))
      .emit(`company-${companyId}-chat-user-${targetUserId}`, {
        action: "create",
        record
      });
  });

  return res.status(200).json(record);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const data = req.body as StoreData;
  const { id } = req.params;

  const schema = Yup.object().shape({
    title: Yup.string().nullable(),
    users: Yup.array().of(
      Yup.object().shape({
        id: Yup.number().required()
      })
    )
  });

  try {
    await schema.validate(data);
  } catch (err) {
    throw new AppError(err.message);
  }

  const record = await UpdateService({
    ...data,
    id: +id,
    companyId,
    requestUserId: +req.user.id
  });

  const io = getIO();

  record.users.forEach(user => {
    const targetUserId = Number((user as any)?.userId || (user as any)?.user?.id || 0);
    if (!targetUserId) return;
    io.of(String(companyId))
      .emit(`company-${companyId}-chat-user-${targetUserId}`, {
        action: "update",
        record,
        userId: targetUserId
      });
  });

  return res.status(200).json(record);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;

  const record = await ShowFromUuidService(id, +req.user.id, +req.user.companyId);

  return res.status(200).json(record);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  await DeleteService(id, +companyId, +req.user.id);

  const io = getIO();
  io.of(String(companyId))
    .emit(`company-${companyId}-chat`, {
      action: "delete",
      id
    });

  return res.status(200).json({ message: "Chat deleted" });
};

export const saveMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { message } = req.body;
  const { id } = req.params;
  const senderId = +req.user.id;
  const chatId = +id;
  const file = req.file as Express.Multer.File | undefined;

  await ensureChatAccess({
    chatId,
    userId: senderId,
    companyId: +companyId
  });

  const newMessage = await CreateMessageService({
    chatId,
    senderId,
    companyId: +companyId,
    message: String(message || ""),
    mediaPath: file?.filename || null,
    mediaName: file?.originalname || null
  });

  const chat = await Chat.findByPk(chatId, {
    include: [
      { model: User, as: "owner" },
      { model: ChatUser, as: "users", include: [{ model: User, as: "user" }] }
    ]
  });

  const io = getIO();
  io.of(String(companyId))
    .emit(`company-${companyId}-chat-${chatId}`, {
      action: "new-message",
      newMessage,
      chat
    });

  io.of(String(companyId))
    .emit(`company-${companyId}-chat`, {
      action: "new-message",
      newMessage,
      chat
    });

  return res.json(newMessage);
};

export const checkAsRead = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const userId = +req.user.id;

  await ensureChatAccess({
    chatId: +id,
    userId,
    companyId: +companyId
  });

  const chatUser = await ChatUser.findOne({ where: { chatId: id, userId } });
  if (!chatUser) {
    throw new AppError("UNAUTHORIZED", 403);
  }

  await chatUser.update({ unreads: 0 });

  const chat = await Chat.findByPk(id, {
    include: [
      { model: User, as: "owner" },
      { model: ChatUser, as: "users", include: [{ model: User, as: "user" }] }
    ]
  });

  const io = getIO();
  io.of(String(companyId))
    .emit(`company-${companyId}-chat-${id}`, {
      action: "update",
      chat
    });

  io.of(String(companyId))
    .emit(`company-${companyId}-chat`, {
      action: "update",
      chat
    });

  return res.json(chat);
};

export const messages = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { pageNumber } = req.query as unknown as IndexQuery;
  const { id: chatId } = req.params;
  const ownerId = +req.user.id;

  const { records, count, hasMore } = await FindMessages({
    chatId,
    ownerId,
    pageNumber
  });

  return res.json({ records, count, hasMore });
};
