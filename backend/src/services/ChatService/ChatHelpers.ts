import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Chat from "../../models/Chat";
import ChatUser from "../../models/ChatUser";
import User from "../../models/User";

type ChatUserInput = {
  id?: number | string;
};

const chatRelations = [
  { model: User, as: "owner" },
  { model: ChatUser, as: "users", include: [{ model: User, as: "user" }] }
];

export const normalizeParticipantIds = (
  ownerId: number,
  users: ChatUserInput[] = []
): number[] => {
  const participantIds = new Set<number>([Number(ownerId)]);

  users.forEach(user => {
    const parsedId = Number(user?.id);
    if (Number.isInteger(parsedId) && parsedId > 0) {
      participantIds.add(parsedId);
    }
  });

  return Array.from(participantIds);
};

export const validateParticipants = async (
  companyId: number,
  participantIds: number[],
  ownerId: number
): Promise<void> => {
  const otherParticipantIds = participantIds.filter(id => id !== ownerId);

  if (otherParticipantIds.length === 0) {
    throw new AppError("ERR_CHAT_PARTICIPANTS_REQUIRED", 400);
  }

  const users = await User.findAll({
    where: {
      id: { [Op.in]: otherParticipantIds },
      companyId
    },
    attributes: ["id"]
  });

  if (users.length !== otherParticipantIds.length) {
    throw new AppError("ERR_INVALID_CHAT_PARTICIPANTS", 400);
  }
};

export const loadChatWithRelations = async (
  chatId: number
): Promise<Chat> => {
  const chat = await Chat.findByPk(chatId, {
    include: chatRelations
  });

  if (!chat) {
    throw new AppError("ERR_NO_CHAT_FOUND", 404);
  }

  return chat;
};

export const ensureChatAccess = async ({
  chatId,
  userId,
  companyId
}: {
  chatId: number;
  userId: number;
  companyId: number;
}): Promise<Chat> => {
  const chat = await loadChatWithRelations(chatId);

  if (Number(chat.companyId) !== Number(companyId)) {
    throw new AppError("UNAUTHORIZED", 403);
  }

  const hasAccess = Array.isArray(chat.users)
    ? chat.users.some(member => Number(member.userId) === Number(userId))
    : false;

  if (!hasAccess) {
    throw new AppError("UNAUTHORIZED", 403);
  }

  return chat;
};

export const ensureChatOwner = async ({
  chatId,
  userId,
  companyId
}: {
  chatId: number;
  userId: number;
  companyId: number;
}): Promise<Chat> => {
  const chat = await ensureChatAccess({ chatId, userId, companyId });

  if (Number(chat.ownerId) !== Number(userId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  return chat;
};

export const findDirectChatBetweenUsers = async ({
  companyId,
  participantIds
}: {
  companyId: number;
  participantIds: number[];
}): Promise<Chat | null> => {
  if (participantIds.length !== 2) return null;

  const chats = await Chat.findAll({
    where: {
      companyId,
      isGroup: false
    },
    include: chatRelations
  });

  const targetIds = new Set(participantIds.map(id => Number(id)));

  const match = chats.find(chat => {
    const memberIds = new Set(
      (Array.isArray(chat.users) ? chat.users : []).map(member => Number(member.userId))
    );

    if (memberIds.size !== targetIds.size) return false;

    return Array.from(targetIds).every(id => memberIds.has(id));
  });

  return match || null;
};
