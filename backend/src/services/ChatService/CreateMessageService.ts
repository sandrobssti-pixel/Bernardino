import { Op } from "sequelize";
import Chat from "../../models/Chat";
import ChatMessage from "../../models/ChatMessage";
import ChatUser from "../../models/ChatUser";
import User from "../../models/User";
import AppError from "../../errors/AppError";

export interface ChatMessageData {
  senderId: number;
  chatId: number;
  companyId: number;
  message?: string;
  mediaPath?: string | null;
  mediaName?: string | null;
}

export default async function CreateMessageService({
  senderId,
  chatId,
  companyId,
  message,
  mediaPath,
  mediaName
}: ChatMessageData) {
  const senderMembership = await ChatUser.findOne({
    where: { chatId, userId: senderId }
  });

  if (!senderMembership) {
    throw new AppError("UNAUTHORIZED", 403);
  }

  const chatRecord = await Chat.findByPk(chatId);
  if (!chatRecord || Number(chatRecord.companyId) !== Number(companyId)) {
    throw new AppError("UNAUTHORIZED", 403);
  }

  const newMessage = await ChatMessage.create({
    senderId,
    chatId,
    message: String(message || ""),
    mediaPath: mediaPath || null,
    mediaName: mediaName || null
  });

  await newMessage.reload({
    include: [
      { model: User, as: "sender", attributes: ["id", "name"] },
      {
        model: Chat,
        as: "chat",
        include: [{ model: ChatUser, as: "users" }]
      }
    ]
  });

  const sender = await User.findByPk(senderId);

  const summary =
    String(message || "").trim() ||
    (mediaName ? `Arquivo: ${mediaName}` : "Arquivo enviado");
  await newMessage.chat.update({ lastMessage: `${sender?.name || "Usuário"}: ${summary}` });

  const chatUsers = await ChatUser.findAll({
    where: { chatId }
  });

  for (let chatUser of chatUsers) {
    if (chatUser.userId === senderId) {
      await chatUser.update({ unreads: 0 });
    } else {
      await chatUser.update({ unreads: chatUser.unreads + 1 });
    }
  }

  return newMessage;
}
