import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import "emoji-mart/css/emoji-mart.css";
import { NimblePicker } from "emoji-mart";
import emojiData from "emoji-mart/data/all.json";
import {
  Avatar,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  Input,
  InputAdornment,
  makeStyles,
  Paper,
  Typography,
} from "@material-ui/core";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import CloseIcon from "@material-ui/icons/Close";
import DoneAllIcon from "@material-ui/icons/DoneAll";
import DoneIcon from "@material-ui/icons/Done";
import GetAppIcon from "@material-ui/icons/GetApp";
import InsertDriveFileIcon from "@material-ui/icons/InsertDriveFile";
import MicIcon from "@material-ui/icons/Mic";
import MoodIcon from "@material-ui/icons/Mood";
import OpenInNewIcon from "@material-ui/icons/OpenInNew";
import PictureAsPdfIcon from "@material-ui/icons/PictureAsPdf";
import SendIcon from "@material-ui/icons/Send";
import StopIcon from "@material-ui/icons/Stop";
import VideocamIcon from "@material-ui/icons/Videocam";

import { AuthContext } from "../../context/Auth/AuthContext";
import { useDate } from "../../hooks/useDate";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    overflow: "hidden",
    borderRadius: 0,
    height: "100%",
    minHeight: 0,
    borderLeft: `1px solid ${theme.palette.divider}`,
  },
  chatHeader: {
    flexShrink: 0,
    padding: theme.spacing(1.1, 1.4),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(15, 23, 42, 0.82)"
        : "rgba(248, 252, 255, 0.95)",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  headerAvatar: {
    width: 34,
    height: 34,
    fontSize: "0.84rem",
    fontWeight: 700,
    backgroundColor: theme.palette.type === "dark" ? "#1d4ed8" : "#2563eb",
  },
  chatTitle: {
    fontWeight: 700,
    fontSize: "0.9rem",
    color: theme.palette.text.primary,
  },
  chatSubtitle: {
    fontSize: "0.76rem",
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  headerContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    width: "100%",
    minWidth: 0,
  },
  headerTextWrap: {
    minWidth: 0,
  },
  groupActionButton: {
    flexShrink: 0,
    borderRadius: 999,
    textTransform: "none",
    fontWeight: 700,
  },
  messageList: {
    position: "relative",
    overflowY: "auto",
    flex: 1,
    minHeight: 0,
    ...theme.scrollbarStyles,
    backgroundColor: theme.palette.type === "dark" ? "#0f172a" : "#e5ddd5",
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'%3E%3Cg fill='none' stroke='%2394a3b8' stroke-opacity='0.14' stroke-width='1.2'%3E%3Ccircle cx='26' cy='30' r='9'/%3E%3Cpath d='M70 18h22M80 8v20'/%3E%3Crect x='132' y='20' width='22' height='14' rx='3'/%3E%3Cpath d='M170 44q8-8 16 0t0 16q-8 8-16 0t0-16z'/%3E%3Cpath d='M18 92h26M32 78v28'/%3E%3Ccircle cx='92' cy='96' r='8'/%3E%3Crect x='146' y='84' width='14' height='24' rx='3'/%3E%3Cpath d='M184 98h20M194 88v20'/%3E%3Ccircle cx='40' cy='158' r='7'/%3E%3Cpath d='M72 148h28M86 134v28'/%3E%3Crect x='126' y='150' width='26' height='16' rx='4'/%3E%3Cpath d='M174 170q7-7 14 0t0 14q-7 7-14 0t0-14z'/%3E%3C/g%3E%3C/svg%3E\")",
    backgroundSize: "220px 220px",
    padding: theme.spacing(1.1),
  },
  inputArea: {
    position: "relative",
    flexShrink: 0,
    height: "auto",
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(15, 23, 42, 0.95)"
        : "rgba(248, 252, 255, 0.96)",
    padding: theme.spacing(0.7, 0.9),
  },
  input: {
    padding: "11px 14px",
    fontSize: "0.86rem",
  },
  buttonSend: {
    margin: theme.spacing(0.2, 0.4),
    color: theme.palette.primary.main,
  },
  buttonRec: {
    margin: theme.spacing(0.2, 0.4),
    color: "#0f766e",
  },
  buttonRecActive: {
    margin: theme.spacing(0.2, 0.4),
    color: "#dc2626",
  },
  boxLeft: {
    padding: "8px 11px 6px",
    margin: "10px",
    position: "relative",
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(30, 41, 59, 0.95)" : "#ffffff",
    color: theme.palette.type === "dark" ? "#e2e8f0" : "#303030",
    maxWidth: 420,
    borderRadius: 12,
    borderBottomLeftRadius: 4,
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(148, 163, 184, 0.22)"
        : "rgba(0, 0, 0, 0.12)"
    }`,
    boxShadow:
      theme.palette.type === "dark"
        ? "0 8px 18px rgba(0, 0, 0, 0.35)"
        : "0 6px 14px rgba(15, 23, 42, 0.08)",
  },
  boxRight: {
    padding: "8px 11px 6px",
    margin: "10px 10px 10px auto",
    position: "relative",
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(22, 101, 52, 0.35)" : "#dcf8c6",
    color: theme.palette.type === "dark" ? "#ecfdf5" : "#303030",
    textAlign: "left",
    maxWidth: 420,
    borderRadius: 12,
    borderBottomRightRadius: 4,
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(74, 222, 128, 0.28)"
        : "rgba(0, 0, 0, 0.12)"
    }`,
    boxShadow:
      theme.palette.type === "dark"
        ? "0 8px 18px rgba(0, 0, 0, 0.35)"
        : "0 6px 14px rgba(15, 23, 42, 0.08)",
  },
  messageSender: {
    fontSize: "0.76rem",
    fontWeight: 700,
    marginBottom: 2,
  },
  messageText: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontSize: "0.84rem",
    lineHeight: 1.35,
  },
  messageTime: {
    fontSize: "0.7rem",
    marginTop: 3,
    opacity: 0.72,
    textAlign: "right",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  emptyState: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.palette.type === "dark" ? "#cbd5e1" : "#334155",
    fontSize: "0.84rem",
  },
  mediaPreviewBox: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.6),
    flexWrap: "wrap",
  },
  previewChip: {
    maxWidth: "100%",
    "& .MuiChip-label": {
      maxWidth: 220,
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
  },
  pickerWrap: {
    position: "absolute",
    bottom: 70,
    left: 10,
    zIndex: 20,
    "& .emoji-mart": {
      border: "none !important",
      boxShadow:
        theme.palette.type === "dark"
          ? "0 14px 30px rgba(0, 0, 0, 0.45)"
          : "0 14px 30px rgba(15, 23, 42, 0.16)",
    },
  },
  mediaImage: {
    maxWidth: 260,
    borderRadius: 8,
    marginTop: 6,
    border: `1px solid ${theme.palette.divider}`,
    display: "block",
  },
  mediaVideo: {
    width: 260,
    maxWidth: "100%",
    borderRadius: 8,
    marginTop: 6,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: "#000",
    display: "block",
  },
  mediaPdf: {
    width: 260,
    maxWidth: "100%",
    height: 320,
    marginTop: 6,
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.type === "dark" ? "#0f172a" : "#ffffff",
  },
  audioPlayer: {
    marginTop: 8,
    width: 260,
    maxWidth: "100%",
  },
  mediaActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.8),
    marginTop: 6,
    flexWrap: "wrap",
  },
  mediaActionLink: {
    color: theme.palette.type === "dark" ? "#93c5fd" : "#1d4ed8",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: "0.8rem",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 16,
    padding: "3px 10px",
  },
  mediaLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    fontSize: "0.8rem",
    fontWeight: 600,
    wordBreak: "break-all",
  },
}));

const AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "oga", "m4a", "aac", "webm"];
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp"];
const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "mkv", "avi", "m4v"];
const PDF_EXTENSIONS = ["pdf"];

const extractExtension = (name) => String(name || "").split(".").pop()?.toLowerCase() || "";

const detectMediaKind = (mediaName = "", mediaPath = "") => {
  const ext = extractExtension(mediaName || mediaPath);
  if (AUDIO_EXTENSIONS.includes(ext)) return "audio";
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  if (PDF_EXTENSIONS.includes(ext)) return "pdf";
  return "file";
};

const getInitials = (name) => {
  const safe = String(name || "").trim();
  if (!safe) return "?";
  const parts = safe.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export default function ChatMessages({
  chat,
  targetUser,
  messages,
  handleSendMessage,
  handleLoadMore,
  scrollToBottomRef,
  pageInfo,
  loading,
  onEditGroup,
  canManageGroup,
}) {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const { datetimeToClient } = useDate();
  const baseRef = useRef();
  const fileInputRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const sendAfterStopRef = useRef(false);
  const contentMessageRef = useRef("");

  const [contentMessage, setContentMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [fileToSend, setFileToSend] = useState(null);
  const [audioToSend, setAudioToSend] = useState(null);
  const [audioFileName, setAudioFileName] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);

  useEffect(() => {
    contentMessageRef.current = contentMessage;
  }, [contentMessage]);

  const backendBase = String(process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
  const isGroupChat = Boolean(chat?.isGroup);

  const scrollToBottom = () => {
    if (baseRef.current) {
      baseRef.current.scrollIntoView({});
    }
  };

  const unreadMessages = (chatData) => {
    if (!chatData) return 0;
    const currentUser = Array.isArray(chatData.users)
      ? chatData.users.find((u) => Number(u.userId) === Number(user.id))
      : null;
    return Number(currentUser?.unreads || 0);
  };

  useEffect(() => {
    if (unreadMessages(chat) > 0) {
      handleSendMessage({ action: "mark-read" });
    }
    scrollToBottomRef.current = scrollToBottom;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const handleScroll = (e) => {
    const { scrollTop } = e.currentTarget;
    if (!pageInfo?.hasMore || loading) return;
    if (scrollTop < 600) {
      handleLoadMore();
    }
  };

  const addEmoji = (emoji) => {
    const icon = emoji?.native || "";
    if (!icon) return;
    setContentMessage((prev) => `${prev}${icon}`);
  };

  const clearMediaDrafts = () => {
    setFileToSend(null);
    setAudioToSend(null);
    setAudioFileName("");
  };

  const stopRecorderTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const extension = mimeType.includes("ogg") ? "ogg" : "webm";
        const generatedAudioFileName = `audio-${Date.now()}.${extension}`;
        setAudioToSend(blob);
        setAudioFileName(generatedAudioFileName);
        setFileToSend(null);
        setRecording(false);
        setRecordingSec(0);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        stopRecorderTracks();

        if (sendAfterStopRef.current) {
          sendAfterStopRef.current = false;
          handleSendMessage({
            text: String(contentMessageRef.current || "").trim(),
            file: null,
            audioBlob: blob,
            audioFileName: generatedAudioFileName,
          }).finally(() => {
            setContentMessage("");
            clearMediaDrafts();
            setShowEmoji(false);
          });
        }
      };

      recorder.start();
      sendAfterStopRef.current = false;
      setRecording(true);
      setShowEmoji(false);
      setRecordingSec(0);
      timerRef.current = setInterval(() => {
        setRecordingSec((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      setRecording(false);
      stopRecorderTracks();
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    sendAfterStopRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    setRecordingSec(0);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    stopRecorderTracks();
    chunksRef.current = [];
  };

  const formatRecordingTime = useMemo(() => {
    const minutes = String(Math.floor(recordingSec / 60)).padStart(2, "0");
    const seconds = String(recordingSec % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [recordingSec]);

  const recipientChatUser = useMemo(() => {
    if (isGroupChat) return null;
    if (!Array.isArray(chat?.users)) return null;
    return (
      chat.users.find((member) => Number(member.userId) !== Number(user.id)) || null
    );
  }, [chat, isGroupChat, user.id]);

  const groupParticipantsLabel = useMemo(() => {
    if (!isGroupChat) return "Chat Interno";
    const members = Array.isArray(chat?.users) ? chat.users : [];
    const names = members
      .filter((member) => Number(member.userId) !== Number(user.id))
      .map((member) => member?.user?.name)
      .filter(Boolean);

    if (names.length === 0) return "Grupo interno";
    if (names.length <= 3) return names.join(", ");
    return `${names.slice(0, 3).join(", ")} +${names.length - 3}`;
  }, [chat, isGroupChat, user.id]);

  const isMessageReadByRecipient = (messageItem) => {
    if (isGroupChat) return false;
    if (!recipientChatUser) return false;
    const recipientUnreads = Number(recipientChatUser.unreads || 0);
    const recipientUpdatedAt = recipientChatUser.updatedAt
      ? new Date(recipientChatUser.updatedAt)
      : null;
    if (!recipientUpdatedAt || Number.isNaN(recipientUpdatedAt.getTime())) return false;

    const messageCreatedAt = messageItem?.createdAt
      ? new Date(messageItem.createdAt)
      : null;
    if (!messageCreatedAt || Number.isNaN(messageCreatedAt.getTime())) return false;

    return recipientUnreads === 0 && messageCreatedAt <= recipientUpdatedAt;
  };

  const submitMessage = async () => {
    if (recording) {
      sendAfterStopRef.current = true;
      stopRecording();
      return;
    }
    const text = String(contentMessage || "").trim();
    if (!text && !fileToSend && !audioToSend) return;

    await handleSendMessage({
      text,
      file: fileToSend || null,
      audioBlob: audioToSend || null,
      audioFileName,
    });
    setContentMessage("");
    clearMediaDrafts();
    setShowEmoji(false);
  };

  const getMediaUrl = (item) => {
    const mediaPath = String(item?.mediaPath || "").trim();
    if (!mediaPath) return "";
    const encodedPath = mediaPath
      .split("/")
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join("/");

    if (/^https?:\/\//i.test(mediaPath)) return mediaPath;
    if (!backendBase) return `/public/company${user.companyId}/${encodedPath}`;
    return `${backendBase}/public/company${user.companyId}/${encodedPath}`;
  };

  const forceDownloadMedia = async (event, mediaUrl, fileName) => {
    event.preventDefault();
    try {
      const response = await fetch(mediaUrl, { credentials: "include" });
      if (!response.ok) throw new Error("download_failed");
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName || "arquivo";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (_) {
      window.open(mediaUrl, "_blank", "noopener,noreferrer");
    }
  };

  const renderMedia = (item) => {
    const mediaUrl = getMediaUrl(item);
    if (!mediaUrl) return null;

    const mediaKind = detectMediaKind(item.mediaName, item.mediaPath);
    const fileName = item.mediaName || "Arquivo";

    const MediaActions = () => (
      <Box className={classes.mediaActions}>
        <a href={mediaUrl} target="_blank" rel="noreferrer" className={classes.mediaActionLink}>
          <OpenInNewIcon style={{ fontSize: 15 }} />
          Visualizar
        </a>
        <a
          href={mediaUrl}
          onClick={(event) => forceDownloadMedia(event, mediaUrl, fileName)}
          className={classes.mediaActionLink}
        >
          <GetAppIcon style={{ fontSize: 15 }} />
          Baixar
        </a>
      </Box>
    );

    if (mediaKind === "image") {
      return (
        <>
          <img className={classes.mediaImage} src={mediaUrl} alt={fileName} loading="lazy" />
          <MediaActions />
        </>
      );
    }

    if (mediaKind === "audio") {
      return (
        <>
          <audio className={classes.audioPlayer} controls src={mediaUrl}>
            Seu navegador não suporta áudio.
          </audio>
          <MediaActions />
        </>
      );
    }

    if (mediaKind === "video") {
      return (
        <>
          <Typography className={classes.mediaLabel}>
            <VideocamIcon style={{ fontSize: 17 }} />
            {fileName}
          </Typography>
          <video className={classes.mediaVideo} controls preload="metadata" src={mediaUrl}>
            Seu navegador não suporta vídeo.
          </video>
          <MediaActions />
        </>
      );
    }

    if (mediaKind === "pdf") {
      return (
        <>
          <Typography className={classes.mediaLabel}>
            <PictureAsPdfIcon style={{ fontSize: 17 }} />
            {fileName}
          </Typography>
          <iframe title={fileName} src={mediaUrl} className={classes.mediaPdf} />
          <MediaActions />
        </>
      );
    }

    return (
      <>
        <Typography className={classes.mediaLabel}>
          <InsertDriveFileIcon style={{ fontSize: 17 }} />
          {fileName}
        </Typography>
        <MediaActions />
      </>
    );
  };

  return (
    <Paper className={classes.mainContainer}>
      <div className={classes.chatHeader}>
        <Avatar className={classes.headerAvatar}>{getInitials(targetUser?.name || chat?.title)}</Avatar>
        <div className={classes.headerContent}>
          <div className={classes.headerTextWrap}>
            <Typography className={classes.chatTitle}>
              {targetUser?.name || chat?.title || "Conversa interna"}
            </Typography>
            <Typography className={classes.chatSubtitle}>{groupParticipantsLabel}</Typography>
          </div>
          {isGroupChat && canManageGroup && (
            <Button
              size="small"
              variant="outlined"
              color="primary"
              onClick={onEditGroup}
              className={classes.groupActionButton}
            >
              Editar grupo
            </Button>
          )}
        </div>
      </div>
      <div onScroll={handleScroll} className={classes.messageList}>
        {Array.isArray(messages) &&
          messages.length > 0 &&
          messages.map((item) => {
            const isMe = Number(item.senderId) === Number(user.id);

            return (
              <Box key={item.id} className={isMe ? classes.boxRight : classes.boxLeft}>
                <Typography className={classes.messageSender}>{item?.sender?.name || "Usuário"}</Typography>
                {item.message ? <Typography className={classes.messageText}>{item.message}</Typography> : null}

                {renderMedia(item)}

                <Typography className={classes.messageTime} display="block">
                  {datetimeToClient(item.createdAt)}
                  {!isGroupChat &&
                    isMe &&
                    (isMessageReadByRecipient(item) ? (
                      <DoneAllIcon style={{ fontSize: 15, color: "#1d9bf0" }} />
                    ) : (
                      <DoneIcon style={{ fontSize: 14, color: "rgba(51,65,85,0.75)" }} />
                    ))}
                </Typography>
              </Box>
            );
          })}
        {(!Array.isArray(messages) || messages.length === 0) && (
          <Box className={classes.emptyState}>Nenhuma mensagem ainda. Envie a primeira mensagem.</Box>
        )}
        <div ref={baseRef} />
      </div>
      <div className={classes.inputArea}>
        {showEmoji && (
          <div className={classes.pickerWrap}>
            <NimblePicker
              set="apple"
              data={emojiData}
              showPreview={false}
              showSkinTones={false}
              onSelect={addEmoji}
              title="Emojis"
              emoji="speech_balloon"
            />
          </div>
        )}
        <div className={classes.mediaPreviewBox}>
          {fileToSend && (
            <Chip
              className={classes.previewChip}
              label={`Arquivo: ${fileToSend.name}`}
              onDelete={() => setFileToSend(null)}
              deleteIcon={<CloseIcon />}
            />
          )}
          {audioToSend && (
            <Chip
              className={classes.previewChip}
              label={`Áudio pronto: ${audioFileName || "gravação.webm"}`}
              onDelete={() => {
                setAudioToSend(null);
                setAudioFileName("");
              }}
              deleteIcon={<CloseIcon />}
            />
          )}
          {recording && (
            <Chip
              className={classes.previewChip}
              color="secondary"
              label={`Gravando áudio ${formatRecordingTime}`}
              onDelete={cancelRecording}
              deleteIcon={<StopIcon />}
            />
          )}
        </div>
        <FormControl variant="outlined" fullWidth>
          <Input
            multiline
            placeholder="Digite uma mensagem..."
            value={contentMessage}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitMessage();
              }
            }}
            onChange={(e) => setContentMessage(e.target.value)}
            className={classes.input}
            startAdornment={
              <InputAdornment position="start">
                <IconButton
                  size="small"
                  onClick={() => setShowEmoji((prev) => !prev)}
                  className={classes.buttonSend}
                >
                  <MoodIcon />
                </IconButton>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (!selected) return;
                    setFileToSend(selected);
                    setAudioToSend(null);
                    setAudioFileName("");
                    e.target.value = "";
                  }}
                />
                <IconButton
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                  className={classes.buttonSend}
                >
                  <AttachFileIcon />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => {
                    if (recording) {
                      stopRecording();
                    } else {
                      startRecording();
                    }
                  }}
                  className={recording ? classes.buttonRecActive : classes.buttonRec}
                >
                  <MicIcon />
                </IconButton>
              </InputAdornment>
            }
            endAdornment={
              <InputAdornment position="end">
                <IconButton onClick={submitMessage} className={classes.buttonSend}>
                  <SendIcon />
                </IconButton>
              </InputAdornment>
            }
          />
        </FormControl>
      </div>
    </Paper>
  );
}
