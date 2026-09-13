import fs from "fs/promises";
import path from "path";
import { Op } from "sequelize";
import Company from "../../models/Company";

export const PUBLIC_DIR = path.resolve(__dirname, "..", "..", "..", "public");
const COMPANY_FOLDER_REGEX = /^company(\d+)$/;

export type PublicCompanyFolderAudit = {
  companyId: number;
  folderName: string;
  folderPath: string;
  bytes: number;
  gb: number;
  filesCount: number;
  updatedAt: string | null;
};

type FolderStats = {
  bytes: number;
  filesCount: number;
  updatedAtMs: number;
};

export const parseCompanyFolderName = (folderName: string): number | null => {
  const match = COMPANY_FOLDER_REGEX.exec(String(folderName || "").trim());
  if (!match) return null;

  const companyId = Number(match[1]);
  if (!Number.isInteger(companyId) || companyId <= 1) return null;

  return companyId;
};

export const resolveCompanyFolderPath = (folderName: string): string => {
  const companyId = parseCompanyFolderName(folderName);
  if (!companyId) {
    throw new Error("Invalid company folder name");
  }

  const folderPath = path.resolve(PUBLIC_DIR, folderName);
  if (!folderPath.startsWith(PUBLIC_DIR + path.sep)) {
    throw new Error("Folder path escapes public directory");
  }

  return folderPath;
};

const getFolderStats = async (directoryPath: string): Promise<FolderStats> => {
  let bytes = 0;
  let filesCount = 0;
  let updatedAtMs = 0;

  const entries = await fs.readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    const stats = await fs.stat(entryPath);

    if (stats.mtimeMs > updatedAtMs) {
      updatedAtMs = stats.mtimeMs;
    }

    if (entry.isDirectory()) {
      const child = await getFolderStats(entryPath);
      bytes += child.bytes;
      filesCount += child.filesCount;
      if (child.updatedAtMs > updatedAtMs) {
        updatedAtMs = child.updatedAtMs;
      }
      continue;
    }

    if (entry.isFile()) {
      bytes += stats.size;
      filesCount += 1;
    }
  }

  return { bytes, filesCount, updatedAtMs };
};

export const listOrphanCompanyFolders = async (): Promise<PublicCompanyFolderAudit[]> => {
  const entries = await fs.readdir(PUBLIC_DIR, { withFileTypes: true });

  const candidateFolders = entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .map(folderName => ({
      folderName,
      companyId: parseCompanyFolderName(folderName)
    }))
    .filter(item => item.companyId !== null) as Array<{ folderName: string; companyId: number }>;

  if (!candidateFolders.length) {
    return [];
  }

  const existingCompanies = await Company.findAll({
    attributes: ["id"],
    where: {
      id: {
        [Op.in]: candidateFolders.map(item => item.companyId)
      }
    }
  });

  const existingCompanyIds = new Set(existingCompanies.map(company => Number(company.id)));
  const orphanFolders = candidateFolders.filter(item => !existingCompanyIds.has(item.companyId));

  const audits = await Promise.all(
    orphanFolders.map(async ({ folderName, companyId }) => {
      const folderPath = resolveCompanyFolderPath(folderName);
      const stats = await getFolderStats(folderPath);

      return {
        companyId,
        folderName,
        folderPath: path.relative(PUBLIC_DIR, folderPath).replace(/\\/g, "/"),
        bytes: stats.bytes,
        gb: Number((stats.bytes / (1024 ** 3)).toFixed(3)),
        filesCount: stats.filesCount,
        updatedAt: stats.updatedAtMs ? new Date(stats.updatedAtMs).toISOString() : null
      };
    })
  );

  return audits.sort((a, b) => b.bytes - a.bytes);
};
