import axios from "axios";
import fs from "fs";
import path from "path";
import { writeFile } from "fs/promises";
import mime from "mime-types";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import { wuzapiRequest } from "./wuzapiClient";

type MediaType = "image" | "video" | "audio" | "document" | "sticker";

const resolveFfmpegPath = (): string => {
  const candidates = [
    process.env.FFMPEG_PATH,
    ffmpegInstaller?.path,
    ffmpegStatic || undefined,
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "ffmpeg"
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (candidate === "ffmpeg" || fs.existsSync(candidate)) return candidate;
  }

  return "ffmpeg";
};

ffmpeg.setFfmpegPath(resolveFfmpegPath());

export type WuzapiMediaDescriptor = {
  mediaType: MediaType;
  body: string;
  sourceUrl?: string;
  base64Data?: string;
  mimetype?: string;
  fileName?: string;
  downloadEndpoint?:
    | "/chat/downloadimage"
    | "/chat/downloadvideo"
    | "/chat/downloadaudio"
    | "/chat/downloaddocument"
    | "/chat/downloadsticker";
  downloadPayload?: Record<string, any>;
};

const getNested = (obj: any, keys: string[]): any =>
  keys.reduce((acc, key) => (acc ? acc[key] : undefined), obj);

const resolveMessageNode = (
  messagePayload: any,
  key:
    | "imageMessage"
    | "videoMessage"
    | "ptvMessage"
    | "audioMessage"
    | "documentMessage"
    | "stickerMessage"
): any =>
  messagePayload?.[key] ||
  messagePayload?.ephemeralMessage?.message?.[key] ||
  messagePayload?.viewOnceMessage?.message?.[key] ||
  messagePayload?.viewOnceMessageV2?.message?.[key] ||
  messagePayload?.viewOnceMessageV2Extension?.message?.[key] ||
  messagePayload?.documentWithCaptionMessage?.message?.[key];

const resolveSourceUrl = (mediaNode: any): string | undefined => {
  const explicitUrl =
    mediaNode?.URL ||
    mediaNode?.url ||
    mediaNode?.Url ||
    mediaNode?.link ||
    mediaNode?.downloadUrl ||
    mediaNode?.downloadURL ||
    mediaNode?.mediaUrl ||
    mediaNode?.mediaURL;

  if (typeof explicitUrl === "string" && explicitUrl.trim()) {
    const normalized = explicitUrl.trim();
    try {
      const parsed = new URL(normalized);
      const host = String(parsed.hostname || "").trim().toLowerCase();

      // Alguns payloads trazem URLs-placeholder do cliente/webapp e não links diretos da mídia.
      if (host && host !== "a.whatsapp.net" && host !== "web.whatsapp.net") {
        return normalized;
      }
    } catch {
      const lowered = normalized.toLowerCase();
      if (
        !lowered.includes("web.whatsapp.net") &&
        !lowered.includes("a.whatsapp.net")
      ) {
        return normalized;
      }
    }
  }

  const directPath = String(mediaNode?.directPath || "").trim();
  if (directPath) {
    return `https://mmg.whatsapp.net${directPath.startsWith("/") ? "" : "/"}${directPath}`;
  }

  return undefined;
};

const resolveDownloadUrl = (mediaNode: any): string | undefined => {
  const preferred = resolveSourceUrl(mediaNode);
  if (preferred) return preferred;

  const directPath = String(mediaNode?.directPath || "").trim();
  if (!directPath) return undefined;
  return `https://mmg.whatsapp.net${directPath.startsWith("/") ? "" : "/"}${directPath}`;
};

const resolveBase64Data = (mediaNode: any, envelopePayload?: any): string | undefined => {
  const candidates = [
    mediaNode?.base64,
    mediaNode?.Base64,
    mediaNode?.data,
    mediaNode?.Data,
    mediaNode?.mediaData,
    mediaNode?.MediaData,
    mediaNode?.fileData,
    mediaNode?.FileData,
    envelopePayload?.base64,
    envelopePayload?.Base64
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (!value) continue;
    return value;
  }

  return undefined;
};

const resolveDownloadPayload = (mediaNode: any): Record<string, any> | undefined => {
  const directPath = String(mediaNode?.directPath || "").trim();
  const payload = {
    Url: resolveDownloadUrl(mediaNode),
    DirectPath: directPath || undefined,
    MediaKey: mediaNode?.MediaKey || mediaNode?.mediaKey,
    Mimetype: mediaNode?.Mimetype || mediaNode?.mimetype,
    FileSHA256:
      mediaNode?.FileSHA256 ||
      mediaNode?.fileSHA256 ||
      mediaNode?.fileSha256,
    FileLength: mediaNode?.FileLength || mediaNode?.fileLength,
    FileEncSHA256:
      mediaNode?.FileEncSHA256 ||
      mediaNode?.fileEncSHA256 ||
      mediaNode?.fileEncSha256
  };

  if (!payload.Url || !payload.MediaKey || !payload.Mimetype) {
    return undefined;
  }

  if (!payload.FileSHA256 || !payload.FileLength) {
    return undefined;
  }

  return payload;
};

const resolveEnvelopeS3Url = (envelopePayload?: any): string | undefined => {
  const url = String(envelopePayload?.s3?.url || envelopePayload?.S3?.url || "").trim();
  return url || undefined;
};

const resolveMediaMimeType = (
  mediaNode: any,
  envelopePayload: any,
  fallback: string
): string => {
  const candidates = [
    mediaNode?.Mimetype,
    mediaNode?.mimetype,
    mediaNode?.MimeType,
    mediaNode?.mimeType,
    envelopePayload?.Mimetype,
    envelopePayload?.mimetype,
    envelopePayload?.MimeType,
    envelopePayload?.mimeType
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }

  return fallback;
};

const resolveMediaFileName = (mediaNode: any, envelopePayload: any): string => {
  const candidates = [
    mediaNode?.fileName,
    mediaNode?.filename,
    mediaNode?.FileName,
    mediaNode?.Filename,
    envelopePayload?.fileName,
    envelopePayload?.filename,
    envelopePayload?.FileName,
    envelopePayload?.Filename
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }

  return "";
};

const resolveDownloadEndpoint = (
  mediaType: MediaType
):
  | "/chat/downloadimage"
  | "/chat/downloadvideo"
  | "/chat/downloadaudio"
  | "/chat/downloaddocument"
  | "/chat/downloadsticker" => {
  if (mediaType === "image") return "/chat/downloadimage";
  if (mediaType === "sticker") return "/chat/downloadsticker";
  if (mediaType === "video") return "/chat/downloadvideo";
  if (mediaType === "audio") return "/chat/downloadaudio";
  return "/chat/downloaddocument";
};

const inferExtension = (
  sourceUrl: string | undefined,
  mimetype: string | undefined,
  mediaType: MediaType,
  fileName?: string
): string => {
  if (mediaType === "audio") return "ogg";

  const extFromFileName = path.extname(String(fileName || "").trim()).replace(".", "");
  if (extFromFileName) return extFromFileName.toLowerCase();

  const normalizedMime = String(mimetype || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (normalizedMime) {
    const extByMime = mime.extension(normalizedMime);
    if (extByMime) return String(extByMime);
  }

  if (sourceUrl && /^https?:\/\//i.test(sourceUrl)) {
    try {
      const parsed = new URL(sourceUrl);
      const ext = path.extname(parsed.pathname || "").replace(".", "");
      if (ext) return ext;
    } catch {}
  }

  if (mediaType === "image") return "jpg";
  if (mediaType === "video") return "mp4";
  if (mediaType === "sticker") return "webp";
  return "bin";
};

const convertAudioToMp3 = (inputFile: string, outputFile: string): Promise<void> =>
  new Promise((resolve, reject) => {
    ffmpeg(inputFile)
      .noVideo()
      .audioCodec("libmp3lame")
      .format("mp3")
      .save(outputFile)
      .on("end", () => resolve())
      .on("error", reject);
  });

const toBufferFromDataUri = (value: string): Buffer | null => {
  // Accept data URIs with extra MIME params, e.g. "audio/ogg; codecs=opus;base64,..."
  const match = String(value || "").match(/^data:[^,]+;base64,(.+)$/i);
  if (!match) return null;
  try {
    return Buffer.from(match[1], "base64");
  } catch {
    return null;
  }
};

const sanitizeMimeType = (value?: string): string => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "application/octet-stream";
  return normalized.split(";")[0].trim() || "application/octet-stream";
};

const normalizeBase64DataUri = (base64Value: string, mimeType?: string): string => {
  const raw = String(base64Value || "").trim();
  if (!raw) return "";

  if (/^data:[^,]+;base64,/i.test(raw)) return raw;
  return `data:${sanitizeMimeType(mimeType)};base64,${raw}`;
};

const extractBase64Candidate = (value: any): string => {
  if (!value) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";

    if (/^data:[^,]+;base64,/i.test(trimmed)) {
      return trimmed;
    }

    if (/^[A-Za-z0-9+/=\r\n]+$/.test(trimmed) && trimmed.length > 64) {
      return trimmed;
    }

    try {
      const parsed = JSON.parse(trimmed);
      return extractBase64Candidate(parsed);
    } catch {
      return "";
    }
  }
  if (Buffer.isBuffer(value)) return value.toString("base64");

  const direct = [
    value?.Data,
    value?.data?.Data,
    value?.data?.data,
    value?.Data?.Data,
    value?.Base64,
    value?.base64,
    value?.data?.Base64,
    value?.data?.base64,
    value?.media,
    value?.Media
  ];

  for (const candidate of direct) {
    if (!candidate) continue;
    if (typeof candidate === "string") {
      const str = candidate.trim();
      if (str) return str;
      continue;
    }
    if (Buffer.isBuffer(candidate)) {
      return candidate.toString("base64");
    }
  }

  return "";
};

const extractDownloadUrlCandidate = (value: any): string => {
  if (!value) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";

    if (/^data:[^,]+;base64,/i.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    try {
      const parsed = JSON.parse(trimmed);
      return extractDownloadUrlCandidate(parsed);
    } catch {
      return "";
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = extractDownloadUrlCandidate(item);
      if (resolved) return resolved;
    }
    return "";
  }

  if (typeof value === "object") {
    const candidates = [
      value?.URL,
      value?.url,
      value?.downloadUrl,
      value?.downloadURL,
      value?.link,
      value?.Link,
      value?.src,
      value?.SourceUrl,
      value?.sourceUrl,
      value?.Data?.URL,
      value?.Data?.url,
      value?.Data?.downloadUrl,
      value?.Data?.downloadURL,
      value?.data?.URL,
      value?.data?.url,
      value?.data?.downloadUrl,
      value?.data?.downloadURL,
      value?.result?.URL,
      value?.result?.url
    ];

    for (const candidate of candidates) {
      const resolved = extractDownloadUrlCandidate(candidate);
      if (resolved) return resolved;
    }
  }

  return "";
};

const isWhatsappProtectedMediaUrl = (value?: string): boolean => {
  const raw = String(value || "").trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return false;

  try {
    const parsed = new URL(raw);
    const host = String(parsed.hostname || "").trim().toLowerCase();
    return (
      host === "mmg.whatsapp.net" ||
      host.endsWith(".mmg.whatsapp.net") ||
      host === "lookaside.whatsapp.net" ||
      host.endsWith(".lookaside.whatsapp.net")
    );
  } catch {
    return /mmg\.whatsapp\.net|lookaside\.whatsapp\.net/i.test(raw);
  }
};

export const extractWuzapiMedia = (
  messagePayload: any,
  envelopePayload?: any
): WuzapiMediaDescriptor | null => {
  const image = resolveMessageNode(messagePayload, "imageMessage");
  if (image) {
    const sourceUrl =
      resolveSourceUrl(image) || resolveEnvelopeS3Url(envelopePayload);
    const base64Data = resolveBase64Data(image, envelopePayload);
    const downloadPayload = resolveDownloadPayload(image);
    return {
      mediaType: "image",
      body: String(image?.caption || ":image:"),
      sourceUrl,
      base64Data,
      mimetype: resolveMediaMimeType(image, envelopePayload, "image/jpeg"),
      fileName: resolveMediaFileName(image, envelopePayload),
      downloadEndpoint: downloadPayload ? resolveDownloadEndpoint("image") : undefined,
      downloadPayload
    };
  }

  const video = resolveMessageNode(messagePayload, "videoMessage");
  const ptv = resolveMessageNode(messagePayload, "ptvMessage");
  const videoLike = video || ptv;
  if (videoLike) {
    const sourceUrl =
      resolveSourceUrl(videoLike) || resolveEnvelopeS3Url(envelopePayload);
    const base64Data = resolveBase64Data(videoLike, envelopePayload);
    const downloadPayload = resolveDownloadPayload(videoLike);
    return {
      mediaType: "video",
      body: String(videoLike?.caption || ":video:"),
      sourceUrl,
      base64Data,
      mimetype: resolveMediaMimeType(videoLike, envelopePayload, "video/mp4"),
      fileName: resolveMediaFileName(videoLike, envelopePayload),
      downloadEndpoint: downloadPayload ? resolveDownloadEndpoint("video") : undefined,
      downloadPayload
    };
  }

  const audio = resolveMessageNode(messagePayload, "audioMessage");
  if (audio) {
    const sourceUrl =
      resolveSourceUrl(audio) || resolveEnvelopeS3Url(envelopePayload);
    const base64Data = resolveBase64Data(audio, envelopePayload);
    const downloadPayload = resolveDownloadPayload(audio);
    return {
      mediaType: "audio",
      body: ":audio:",
      sourceUrl,
      base64Data,
      mimetype: resolveMediaMimeType(audio, envelopePayload, "audio/ogg"),
      fileName: resolveMediaFileName(audio, envelopePayload),
      downloadEndpoint: downloadPayload ? resolveDownloadEndpoint("audio") : undefined,
      downloadPayload
    };
  }

  const document = resolveMessageNode(messagePayload, "documentMessage");
  if (document) {
    const sourceUrl =
      resolveSourceUrl(document) || resolveEnvelopeS3Url(envelopePayload);
    const base64Data = resolveBase64Data(document, envelopePayload);
    const downloadPayload = resolveDownloadPayload(document);
    return {
      mediaType: "document",
      body: String(document?.caption || ":document:"),
      sourceUrl,
      base64Data,
      mimetype: resolveMediaMimeType(document, envelopePayload, "application/octet-stream"),
      fileName: resolveMediaFileName(document, envelopePayload),
      downloadEndpoint: downloadPayload ? resolveDownloadEndpoint("document") : undefined,
      downloadPayload
    };
  }

  const sticker = resolveMessageNode(messagePayload, "stickerMessage");
  if (sticker) {
    const sourceUrl =
      resolveSourceUrl(sticker) || resolveEnvelopeS3Url(envelopePayload);
    const base64Data = resolveBase64Data(sticker, envelopePayload);
    const downloadPayload = resolveDownloadPayload(sticker);
    return {
      mediaType: "sticker",
      body: ":sticker:",
      sourceUrl,
      base64Data,
      mimetype: resolveMediaMimeType(sticker, envelopePayload, "image/webp"),
      fileName: resolveMediaFileName(sticker, envelopePayload),
      downloadEndpoint: downloadPayload ? resolveDownloadEndpoint("sticker") : undefined,
      downloadPayload
    };
  }

  const locationThumbnail = getNested(messagePayload, ["locationMessage", "jpegThumbnail"]);
  if (locationThumbnail) {
    return null;
  }

  return null;
};

export const persistWuzapiMedia = async (
  companyId: number,
  media: WuzapiMediaDescriptor,
  whatsapp?: Whatsapp
): Promise<string | null> => {
  if (!media?.sourceUrl && !media?.base64Data && !media?.downloadPayload) return null;

  const folder = path.resolve(__dirname, "..", "..", "..", "public", `company${companyId}`);
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
    fs.chmodSync(folder, 0o777);
  }

  const ext = inferExtension(
    media.sourceUrl,
    media.mimetype,
    media.mediaType,
    media.fileName
  );
  const fileName = `${Date.now()}_${Math.random().toString(16).slice(2, 10)}.${ext}`;
  const target = path.join(folder, fileName);

  try {
    let buffer: Buffer | null = null;
    let fallbackDownloadUrl = "";

    if (media.base64Data) {
      const normalized = normalizeBase64DataUri(media.base64Data, media.mimetype);
      buffer = toBufferFromDataUri(normalized);
    }

    if (!buffer && media.sourceUrl && /^data:[^,]+;base64,/i.test(media.sourceUrl)) {
      buffer = toBufferFromDataUri(media.sourceUrl);
    }

    if (
      !buffer &&
      whatsapp &&
      media.downloadEndpoint &&
      media.downloadPayload
    ) {
      try {
        const downloadData = await wuzapiRequest(
          whatsapp,
          "POST",
          media.downloadEndpoint,
          media.downloadPayload
        );

        const base64Candidate = extractBase64Candidate(downloadData);

        if (base64Candidate) {
          const normalized = normalizeBase64DataUri(base64Candidate, media.mimetype);
          buffer = toBufferFromDataUri(normalized);
        }

        if (!buffer) {
          fallbackDownloadUrl = extractDownloadUrlCandidate(downloadData);
          if (fallbackDownloadUrl && /^data:[^,]+;base64,/i.test(fallbackDownloadUrl)) {
            buffer = toBufferFromDataUri(fallbackDownloadUrl);
          }
        }
      } catch (error) {
        logger.warn(
          `[WUZAPI_MEDIA] falha no endpoint de download (${media.mediaType}): ${String(
            (error as any)?.message || error
          )}`
        );
      }
    }

    const remoteFetchUrl = fallbackDownloadUrl || media.sourceUrl || "";
    const canFetchRemoteUrl =
      remoteFetchUrl &&
      !isWhatsappProtectedMediaUrl(remoteFetchUrl);

    if (!buffer && canFetchRemoteUrl) {
      const response = await axios.get(remoteFetchUrl, {
        responseType: "arraybuffer",
        timeout: 30000
      });
      buffer = Buffer.from(response.data);
    }

    if (!buffer && remoteFetchUrl && isWhatsappProtectedMediaUrl(remoteFetchUrl)) {
      logger.warn(
        `[WUZAPI_MEDIA] ignorando fallback para URL protegida do WhatsApp (${media.mediaType}); payload provavelmente criptografado`
      );
    }

    if (!buffer) return null;
    await writeFile(target, buffer);

    if (media.mediaType === "audio") {
      const mp3FileName = fileName.replace(/\.[^.]+$/, ".mp3");
      const mp3Target = path.join(folder, mp3FileName);

      try {
        await convertAudioToMp3(target, mp3Target);
        return mp3FileName;
      } catch (error) {
        logger.warn(
          `[WUZAPI_MEDIA] falha ao converter áudio para MP3: ${String(
            (error as any)?.message || error
          )}`
        );
      }
    }

    return fileName;
  } catch (error) {
    logger.warn(
      `[WUZAPI_MEDIA] falha ao salvar mídia (${media.mediaType}): ${String(
        (error as any)?.message || error
      )}`
    );
    return null;
  }
};
