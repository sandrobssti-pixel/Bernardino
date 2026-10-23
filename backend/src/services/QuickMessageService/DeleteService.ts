import QuickMessage from "../../models/QuickMessage";
import AppError from "../../errors/AppError";
import SyncFromQuickMessageService from "../PromptFilesServices/SyncFromQuickMessageService";

const DeleteService = async (id: string): Promise<void> => {
  const record = await QuickMessage.findOne({
    where: { id }
  });

  if (!record) {
    throw new AppError("ERR_NO_QUICKMESSAGE_FOUND", 404);
  }

  try {
    // sinaliza "não geral" só em memória (não persiste) pra reaproveitar a
    // mesma lógica do sync que já sabe remover o espelho em Arquivos da IA
    // (linha física + registro) antes de apagar a mensagem rápida de vez.
    record.geral = false;
    await SyncFromQuickMessageService(record);
  } catch (err) {
    console.error("Falha ao remover espelho em Arquivos da IA:", err);
  }

  await record.destroy();
};

export default DeleteService;
