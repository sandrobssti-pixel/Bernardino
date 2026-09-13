import Chat from "../../models/Chat";
import AppError from "../../errors/AppError";
import ChatUser from "../../models/ChatUser";
import User from "../../models/User";

const ShowFromUuidService = async (
  uuid: string,
  userId: number,
  companyId: number
): Promise<Chat> => {
  const record = await Chat.findOne({
    where: { uuid, companyId },
    include: [
      { model: User, as: "owner" },
      { model: ChatUser, as: "users", include: [{ model: User, as: "user" }] }
    ]
  });

  if (!record) {
    throw new AppError("ERR_NO_CHAT_FOUND", 404);
  }

  const hasAccess = Array.isArray(record.users)
    ? record.users.some(member => Number(member.userId) === Number(userId))
    : false;

  if (!hasAccess) {
    throw new AppError("UNAUTHORIZED", 403);
  }

  return record;
};

export default ShowFromUuidService;
