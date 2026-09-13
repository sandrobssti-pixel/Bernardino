import AppError from "../../errors/AppError";

const MAX_IMPORT_DAYS = 60;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_IMPORT_WINDOW_MS = MAX_IMPORT_DAYS * DAY_IN_MS;

const validateImportMessagesWindow = (
  importOldMessages?: string | null,
  importRecentMessages?: string | null
): void => {
  if (!importOldMessages && !importRecentMessages) return;

  if (!importOldMessages || !importRecentMessages) {
    throw new AppError("Janela de importação incompleta.");
  }

  const importStartMs = new Date(importOldMessages).getTime();
  const importEndMs = new Date(importRecentMessages).getTime();
  const now = Date.now();
  const oldestAllowedStart = now - MAX_IMPORT_WINDOW_MS;

  if (!Number.isFinite(importStartMs) || !Number.isFinite(importEndMs)) {
    throw new AppError("Datas de importação inválidas.");
  }

  if (importEndMs < importStartMs) {
    throw new AppError("A data final da importação deve ser maior ou igual à data inicial.");
  }

  if (importStartMs < oldestAllowedStart) {
    throw new AppError(`A importação permite no máximo os últimos ${MAX_IMPORT_DAYS} dias.`);
  }

  if (importEndMs > now) {
    throw new AppError("A data final da importação não pode ser futura.");
  }

  if (importEndMs - importStartMs > MAX_IMPORT_WINDOW_MS) {
    throw new AppError(`O período de importação não pode ultrapassar ${MAX_IMPORT_DAYS} dias.`);
  }
};

export default validateImportMessagesWindow;
