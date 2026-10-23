import AppError from "../../errors/AppError";
import QuickMessage from "../../models/QuickMessage";
import SyncFromQuickMessageService from "../PromptFilesServices/SyncFromQuickMessageService";

interface Data {
  shortcode: string;
  message: string;
  userId: number | string;
  id?: number | string;
  geral: boolean;
  mediaPath?: string | null;
  visao: boolean;
  userProfile?: string;

}

const UpdateService = async (data: Data): Promise<QuickMessage> => {
  const { id, shortcode, message, userId, geral, mediaPath, visao, userProfile } = data;

  const record = await QuickMessage.findByPk(id);

  if (!record) {
    throw new AppError("ERR_NO_TICKETNOTE_FOUND", 404);
  }

  const isAdmin = userProfile === "admin";

  if (!isAdmin && !record.geral && record.visao && record.userId !== userId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await record.update({
    shortcode,
    message,
    // userId,
    geral,
    mediaPath,
    visao
  });

  try {
    await SyncFromQuickMessageService(record);
  } catch (err) {
    console.error("Falha ao sincronizar mensagem rápida com Arquivos da IA:", err);
  }

  return record;
};

export default UpdateService;
