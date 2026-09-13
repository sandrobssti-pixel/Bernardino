import path from "path";
import fs from "fs";
import Company from "../../models/Company";
import AppError from "../../errors/AppError";
import Task from "../../models/Task";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import sequelize from "../../database";
import { removeWbot } from "../../libs/wbot";
import logger from "../../utils/logger";

const PUBLIC_DIR = path.resolve(__dirname, "..", "..", "..", "public");

const deleteCompanyFolder = (companyId: number): void => {
  // Proteção 1: nunca apagar a empresa mãe (id=1)
  if (!companyId || companyId <= 1) return;

  const companyFolder = path.resolve(PUBLIC_DIR, `company${companyId}`);

  // Proteção 2: garantir que o caminho está dentro de PUBLIC_DIR
  if (!companyFolder.startsWith(PUBLIC_DIR + path.sep)) return;

  // Proteção 3: só age se a pasta existir
  if (!fs.existsSync(companyFolder)) return;

  // Remoção segura — erro de I/O não interrompe o fluxo principal
  try {
    fs.rmSync(companyFolder, { recursive: true, force: true });
  } catch (err) {
    console.error(`[DeleteCompanyService] Falha ao remover pasta company${companyId}:`, err);
  }
};

const DeleteCompanyService = async (id: string): Promise<void> => {
  let companyId: number | null = null;
  let whatsappIdsToClose: number[] = [];

  await sequelize.transaction(async transaction => {
    const company = await Company.findOne({
      where: { id },
      transaction
    });

    if (!company) {
      throw new AppError("ERR_NO_COMPANY_FOUND", 404);
    }

    companyId = company.id;

    // A FK Whatsapps.companyId é "ON DELETE SET NULL": excluir a Company não
    // apaga nem desconecta as conexões WhatsApp associadas, apenas zera o
    // companyId delas. Por isso precisamos capturar os IDs ANTES de destruir
    // a Company — depois do destroy o companyId já estará nulo e não seria
    // mais possível localizá-los por essa coluna.
    const whatsapps = await Whatsapp.findAll({
      where: { companyId: company.id },
      transaction
    });
    whatsappIdsToClose = whatsapps.map(w => w.id);

    // Tasks referenciam Users com RESTRICT; removemos as tasks da empresa
    // antes de excluir a Company para evitar violação de FK em cascata.
    await Task.destroy({
      where: { companyId: company.id },
      transaction
    });

    await User.destroy({
      where: { companyId: company.id },
      transaction
    });

    await company.destroy({ transaction });
  });

  // Com a Company já excluída (companyId zerado nos Whatsapps), encerramos
  // as sessões Baileys em memória que ainda estavam ativas para essas
  // conexões — sem isso a sessão continuaria processando mensagens e
  // tentando gravar Contacts com um companyId que não existe mais,
  // causando ERR_NO_WAPP_FOUND e SequelizeForeignKeyConstraintError.
  for (const whatsappId of whatsappIdsToClose) {
    try {
      await removeWbot(whatsappId);
    } catch (err) {
      logger.error(
        `[DeleteCompanyService] Falha ao encerrar sessão do whatsapp ${whatsappId}:`,
        err
      );
    }
  }

  // Remoção da pasta feita APÓS o commit da transação,
  // para não apagar arquivos caso o banco falhe e faça rollback.
  if (companyId) {
    deleteCompanyFolder(companyId);
  }
};

export default DeleteCompanyService;
