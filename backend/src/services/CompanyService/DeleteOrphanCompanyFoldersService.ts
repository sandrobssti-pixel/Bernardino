import fs from "fs";
import { Op } from "sequelize";
import Company from "../../models/Company";
import AppError from "../../errors/AppError";
import {
  listOrphanCompanyFolders,
  parseCompanyFolderName,
  resolveCompanyFolderPath
} from "./publicFolderAudit";

type Request = {
  companyIds: Array<number | string>;
};

type Response = {
  removed: number[];
  skipped: Array<{ companyId: number; reason: string }>;
};

const DeleteOrphanCompanyFoldersService = async ({
  companyIds
}: Request): Promise<Response> => {
  const normalizedIds = Array.from(
    new Set(
      (Array.isArray(companyIds) ? companyIds : [])
        .map(value => Number(value))
        .filter(value => Number.isInteger(value) && value > 1)
    )
  );

  if (!normalizedIds.length) {
    throw new AppError("Nenhuma pasta órfã válida foi informada.", 400);
  }

  const orphanFolders = await listOrphanCompanyFolders();
  const orphanMap = new Map(orphanFolders.map(item => [item.companyId, item]));
  const existingCompanies = await Company.findAll({
    attributes: ["id"],
    where: {
      id: {
        [Op.in]: normalizedIds
      }
    }
  });
  const existingCompanyIds = new Set(existingCompanies.map(company => Number(company.id)));

  const removed: number[] = [];
  const skipped: Array<{ companyId: number; reason: string }> = [];

  for (const companyId of normalizedIds) {
    if (existingCompanyIds.has(companyId)) {
      skipped.push({ companyId, reason: "Empresa ainda existe no banco." });
      continue;
    }

    const folderName = `company${companyId}`;
    if (parseCompanyFolderName(folderName) !== companyId) {
      skipped.push({ companyId, reason: "Nome da pasta inválido." });
      continue;
    }

    if (!orphanMap.has(companyId)) {
      skipped.push({ companyId, reason: "Pasta órfã não encontrada." });
      continue;
    }

    const folderPath = resolveCompanyFolderPath(folderName);

    try {
      fs.rmSync(folderPath, { recursive: true, force: true });
      removed.push(companyId);
    } catch (error: any) {
      skipped.push({
        companyId,
        reason: error?.message || "Falha ao remover a pasta."
      });
    }
  }

  return { removed, skipped };
};

export default DeleteOrphanCompanyFoldersService;
