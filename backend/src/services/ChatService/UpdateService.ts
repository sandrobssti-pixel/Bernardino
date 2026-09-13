import ChatUser from "../../models/ChatUser";
import {
  ensureChatOwner,
  loadChatWithRelations,
  normalizeParticipantIds,
  validateParticipants
} from "./ChatHelpers";
import AppError from "../../errors/AppError";

interface ChatData {
  id: number;
  title?: string;
  users?: any[];
  companyId: number;
  requestUserId: number;
}

export default async function UpdateService(data: ChatData) {
  const { users, companyId, requestUserId } = data;
  const record = await ensureChatOwner({
    chatId: data.id,
    userId: requestUserId,
    companyId
  });

  const updates: Record<string, unknown> = {};
  const normalizedTitle = typeof data.title === "string" ? data.title.trim() : undefined;

  if (typeof normalizedTitle === "string") {
    if (record.isGroup && !normalizedTitle) {
      throw new AppError("ERR_GROUP_TITLE_REQUIRED", 400);
    }

    updates.title = normalizedTitle;
  }

  if (Object.keys(updates).length > 0) {
    await record.update(updates);
  }

  if (Array.isArray(users)) {
    const participantIds = normalizeParticipantIds(record.ownerId, users);

    await validateParticipants(companyId, participantIds, record.ownerId);

    if (record.isGroup) {
      if (participantIds.length < 2) {
        throw new AppError("ERR_GROUP_MIN_PARTICIPANTS", 400);
      }
    } else if (participantIds.length !== 2) {
      throw new AppError("ERR_DIRECT_CHAT_INVALID_PARTICIPANTS", 400);
    }

    await ChatUser.destroy({ where: { chatId: record.id } });
    await ChatUser.bulkCreate(
      participantIds.map(userId => ({
        chatId: record.id,
        userId
      }))
    );
  }

  return loadChatWithRelations(record.id);
}
