import Chat from "../../models/Chat";
import ChatUser from "../../models/ChatUser";
import AppError from "../../errors/AppError";
import {
  findDirectChatBetweenUsers,
  loadChatWithRelations,
  normalizeParticipantIds,
  validateParticipants
} from "./ChatHelpers";

interface Data {
  ownerId: number;
  companyId: number;
  users: any[];
  title: string;
  isGroup?: boolean;
}

const CreateService = async (data: Data): Promise<Chat> => {
  const { ownerId, companyId, users, title, isGroup = false } = data;
  const participantIds = normalizeParticipantIds(ownerId, users);
  const normalizedTitle = String(title || "").trim();

  await validateParticipants(companyId, participantIds, ownerId);

  if (isGroup) {
    if (!normalizedTitle) {
      throw new AppError("ERR_GROUP_TITLE_REQUIRED", 400);
    }

    if (participantIds.length < 2) {
      throw new AppError("ERR_GROUP_MIN_PARTICIPANTS", 400);
    }
  } else if (participantIds.length !== 2) {
    throw new AppError("ERR_DIRECT_CHAT_INVALID_PARTICIPANTS", 400);
  }

  if (!isGroup) {
    const existingChat = await findDirectChatBetweenUsers({
      companyId,
      participantIds
    });

    if (existingChat) return existingChat;
  }

  const record = await Chat.create({
    ownerId,
    companyId,
    title: normalizedTitle,
    isGroup
  });

  await ChatUser.bulkCreate(
    participantIds.map(userId => ({
      chatId: record.id,
      userId
    }))
  );

  return loadChatWithRelations(record.id);
};

export default CreateService;
