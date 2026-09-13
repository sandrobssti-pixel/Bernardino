import fs from "fs/promises";
import { Dirent } from "fs";
import path from "path";

type StorageUsageResult = {
  companyId: number;
  bytes: number;
  gb: number;
};

const getDirectorySize = async (directoryPath: string): Promise<number> => {
  let total = 0;

  let entries: Dirent[];
  try {
    entries = await fs.readdir(directoryPath, { withFileTypes: true });
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return 0;
    }
    throw error;
  }

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      total += await getDirectorySize(fullPath);
      continue;
    }

    if (entry.isFile()) {
      const fileStats = await fs.stat(fullPath);
      total += fileStats.size;
    }
  }

  return total;
};

const GetCompanyStorageUsageService = async (
  companyId: number
): Promise<StorageUsageResult> => {
  const companyFolderPath = path.resolve("public", `company${companyId}`);
  const bytes = await getDirectorySize(companyFolderPath);
  const gb = Number((bytes / (1024 ** 3)).toFixed(3));

  return {
    companyId,
    bytes,
    gb
  };
};

export default GetCompanyStorageUsageService;
