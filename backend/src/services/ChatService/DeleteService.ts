import Chat from "../../models/Chat";
import { ensureChatOwner } from "./ChatHelpers";

const DeleteService = async (
  id: string,
  companyId: number,
  requestUserId: number
): Promise<void> => {
  const record = await ensureChatOwner({
    chatId: Number(id),
    userId: requestUserId,
    companyId
  });

  await record.destroy();
};

export default DeleteService;
