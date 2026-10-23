import path from "path";

// Extensões mais comuns que chegam por Mensagens Rápidas (imagem, vídeo,
// áudio, documento) — QuickMessage não guarda o mimetype original, só o
// nome do arquivo, então na hora de espelhar pro catálogo "Arquivos da IA"
// (PromptFiles.mediaType) a gente infere pela extensão.
const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".3gp": "video/3gpp",
  ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".txt": "text/plain"
};

export const inferMimeTypeFromFilename = (filename: string): string => {
  const ext = path.extname(filename || "").toLowerCase();
  return MIME_BY_EXTENSION[ext] || "application/octet-stream";
};

// Marca especial de mediaType pra item do catálogo que não tem arquivo
// físico nenhum — só texto (mensagem rápida sem anexo). OpenAiService e o
// SyncFromQuickMessageService leem essa mesma constante.
export const TEXT_MEDIA_TYPE = "text";

interface QuickMessageLike {
  shortcode: string;
  message?: string | null;
}

export const buildSyncedName = (quickMessage: QuickMessageLike): string => {
  const shortcode = (quickMessage.shortcode || "").replace(/^\//, "").trim();
  return shortcode || "Resposta rápida";
};

// "Quando a IA deve enviar" não existe em Mensagens Rápidas — gera um texto
// inicial a partir do atalho; fica editável depois em Arquivos da IA (a
// sincronização nunca sobrescreve esse campo depois de criado).
export const buildSyncedDescription = (quickMessage: QuickMessageLike): string => {
  const shortcode = (quickMessage.shortcode || "").replace(/^\//, "").trim();
  return `Enviar quando o cliente perguntar sobre: ${shortcode || quickMessage.shortcode}`;
};
