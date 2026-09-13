import React, { useContext, useState, useEffect, useReducer, useRef, memo, useCallback } from "react";
import { isSameDay, parseISO, format } from "date-fns";
import clsx from "clsx";
import { isNil } from "lodash";
import { blue, green, red } from "@material-ui/core/colors";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  makeStyles,
  Badge
} from "@material-ui/core";

import {
  AccessTime,
  Block,
  Description,
  Done,
  DoneAll,
  ExpandMore,
  GetApp,
  Facebook,
  Instagram,
  OpenInNew,
  Visibility,
  ChevronLeft,
  ChevronRight,
  GetApp as DownloadIcon,
  CropFree,
  RotateRight,
  WhatsApp,
  Reply,
  Close,
  PersonOutline,
  BarChart,
  EventNote,
  FileCopy,
  Payment,
} from "@material-ui/icons";
import { toast } from "react-toastify";

import MarkdownWrapper from "../MarkdownWrapper";
import VcardPreview from "../VcardPreview";
import LocationPreview from "../LocationPreview";
import ModalImageCors from "../ModalImageCors";
import MessageOptionsMenu from "../MessageOptionsMenu";
import whatsBackground from "../../assets/wa-background.png";
import whatsBackgroundDark from "../../assets/wa-background-dark.png";
import YouTubePreview from "../ModalYoutubeCors";

import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { ForwardMessageContext } from "../../context/ForwarMessage/ForwardMessageContext";

import api from "../../services/api";
import toastError from "../../errors/toastError";
// import { SocketContext } from "../../context/Socket/SocketContext";
import { i18n } from "../../translate/i18n";
import SelectMessageCheckbox from "./SelectMessageCheckbox";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import { AuthContext } from "../../context/Auth/AuthContext";
import { QueueSelectedContext } from "../../context/QueuesSelected/QueuesSelectedContext";
import AudioModal from "../AudioModal";
import AdMetaPreview from "../AdMetaPreview"; // Adicionado componente de preview de anúncio

import { messages } from "../../translate/languages";
import { useParams, useHistory } from 'react-router-dom';

const useStyles = makeStyles((theme) => ({
  messagesListWrapper: {
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    width: "100%",
    minWidth: 300,
    minHeight: 0,
  },

  currentTick: {
    alignItems: "center",
    textAlign: "center",
    alignSelf: "center",
    width: "90%",
    margin: "10px auto",
    borderRadius: 10,
    overflow: "hidden",
    boxShadow: theme.mode === "light"
      ? "0 2px 8px rgba(0,0,0,0.08)"
      : "0 2px 8px rgba(0,0,0,0.25)",
  },

  currentTicktText: {
    color: "#ffffff",
    fontWeight: 600,
    fontSize: "0.78rem",
    padding: "6px 12px",
    alignSelf: "center",
    letterSpacing: "0.01em",
  },

  messagesList: {
    backgroundImage: theme.mode === 'light' ? `url(${whatsBackground})` : `url(${whatsBackgroundDark})`,
    backgroundColor: theme.palette.chat.background,
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minHeight: 0,
    padding: "16px 20px 24px 20px",
    overflowY: "scroll",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
    overscrollBehaviorY: "contain",
    ...theme.scrollbarStyles,
  },
  dragElement: {
    background: theme.mode === "light" ? "rgba(248,250,252,0.92)" : "rgba(15,23,42,0.88)",
    backdropFilter: "blur(4px)",
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: 999999,
    textAlign: "center",
    fontSize: "2rem",
    fontWeight: 600,
    border: `3px dashed ${theme.mode === "light" ? "rgba(37,99,235,0.4)" : "rgba(147,197,253,0.4)"}`,
    color: theme.mode === "light" ? "#2563eb" : "#93c5fd",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  circleLoading: {
    color: blue[500],
    position: "absolute",
    opacity: "70%",
    top: 0,
    left: "50%",
    marginTop: 12,
  },

  messageLeft: {
    marginRight: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },
    whiteSpace: "pre-wrap",
    backgroundColor: theme.palette.chat.bubbleIncoming,
    color: theme.palette.chat.bubbleIncomingText,
    alignSelf: "flex-start",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 8,
    paddingBottom: 4,
    boxShadow: theme.mode === 'light'
      ? "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)"
      : "0 1px 3px rgba(0,0,0,0.2)",
    fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  },

  quotedContainerLeft: {
    margin: "-3px -80px 6px -6px",
    overflow: "hidden",
    backgroundColor: theme.mode === 'light' ? "#f0f0f0" : "#1d282f",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  quotedMsg: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
    fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    fontSize: "0.84rem",
    lineHeight: 1.4,
  },

  quotedSideColorLeft: {
    flex: "none",
    width: "4px",
    backgroundColor: "#388aff",
  },

  messageRight: {
    marginLeft: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },
    whiteSpace: "pre-wrap",
    backgroundColor: theme.palette.chat.bubbleOutgoing,
    color: theme.palette.chat.bubbleOutgoingText,
    alignSelf: "flex-end",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 8,
    paddingBottom: 4,
    boxShadow: theme.mode === 'light'
      ? "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)"
      : "0 1px 3px rgba(0,0,0,0.2)",
    fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  },

  messageRightPrivate: {
    marginLeft: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },
    whiteSpace: "pre-wrap",
    backgroundColor: "#fef3c7",
    color: "#92400e",
    alignSelf: "flex-end",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 8,
    paddingBottom: 4,
    boxShadow: theme.mode === 'light'
      ? "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)"
      : "0 1px 3px rgba(0,0,0,0.2)",
    fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  },

  messageRightScheduled: {
    marginLeft: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },
    whiteSpace: "pre-wrap",
    backgroundColor: "#d9ecff",
    color: "#303030",
    alignSelf: "flex-end",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 0,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: theme.mode === 'light' ? "0 1px 1px #b3b3b3" : "0 1px 1px #000000",
    fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  },

  quotedContainerRight: {
    margin: "-3px -80px 6px -6px",
    overflowY: "hidden",
    backgroundColor: theme.mode === 'light' ? "#cfe9ba" : "#025144",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  quotedMsgRight: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    whiteSpace: "pre-wrap",
    fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    fontSize: "0.84rem",
    lineHeight: 1.4,
  },

  quotedSideColorRight: {
    flex: "none",
    width: "4px",
    backgroundColor: "#35cd96",
  },

  messageActionsButton: {
    display: "none",
    position: "relative",
    color: "#999",
    zIndex: 1,
    backgroundColor: "inherit",
    opacity: "90%",
    "&:hover, &.Mui-focusVisible": { backgroundColor: "inherit" },
  },

  messageContactName: {
    display: "flex",
    color: "#6bcbef",
    fontWeight: 600,
    fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    fontSize: "0.73rem",
    letterSpacing: "0.01em",
  },

  textContentItem: {
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    padding: "3px 80px 6px 6px",
    fontFamily: '"DM Sans", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
    fontSize: "0.84rem",
    lineHeight: 1.45,
    letterSpacing: "0.01em",
  },

  textContentItemDeleted: {
    fontStyle: "italic",
    color: theme.mode === "light" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.28)",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    padding: "3px 80px 6px 6px",
    fontFamily: '"DM Sans", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
    fontSize: "0.84rem",
    lineHeight: 1.45,
  },
  interactiveCard: {
    margin: "4px 0 6px 6px",
    minWidth: 230,
    maxWidth: 400,
    border: `1px solid ${theme.mode === "light" ? "#d7e0e7" : "#36516a"}`,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: theme.mode === "light" ? "#f8fafc" : "#172033",
  },
  interactiveCardHeader: {
    padding: "10px 12px 6px",
    fontWeight: 600,
    fontSize: "0.88rem",
  },
  interactiveCardBody: {
    padding: "0 12px 10px",
    whiteSpace: "pre-wrap",
    fontSize: "0.84rem",
  },
  interactiveCardFooter: {
    padding: "0 12px 8px",
    opacity: 0.72,
    fontSize: "0.76rem",
  },
  interactiveOptions: {
    borderTop: `1px solid ${theme.mode === "light" ? "#d7e0e7" : "#36516a"}`,
    display: "flex",
    flexDirection: "column",
  },
  interactiveOption: {
    justifyContent: "flex-start",
    textAlign: "left",
    textTransform: "none",
    borderRadius: 0,
    minHeight: 42,
    padding: "8px 12px",
    color: theme.mode === "light" ? "#0b6bcb" : "#7cc4ff",
    borderBottom: `1px solid ${theme.mode === "light" ? "#e5ebf0" : "#2b4055"}`,
    "&:last-child": {
      borderBottom: "none",
    },
  },
  interactiveOptionDescription: {
    display: "block",
    marginTop: 2,
    opacity: 0.72,
    fontSize: "0.74rem",
    fontWeight: 400,
  },
  transcriptionInline: {
    marginTop: 6,
    padding: "6px 8px",
    borderRadius: 8,
    backgroundColor: theme.mode === "light" ? "#f1f5f9" : "rgba(30,41,59,0.8)",
    border: `1px solid ${theme.mode === "light" ? "#dbeafe" : "rgba(148,163,184,0.25)"}`,
    fontSize: "0.78rem",
    lineHeight: 1.4,
    color: theme.palette.text.secondary,
  },

  messageMedia: {
    objectFit: "cover",
    width: 400,
    height: "auto",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  messageImageGrid: {
    display: "grid",
    gap: 4,
    marginTop: 2,
    marginBottom: 6,
    maxWidth: 410,
    borderRadius: 10,
    overflow: "hidden",
  },
  messageImageGridItem: {
    position: "relative",
    width: "100%",
    minHeight: 120,
    cursor: "pointer",
    border: 0,
    background: "transparent",
    padding: 0,
  },
  messageImageGridThumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  messageImageGridMoreOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    color: "#fff",
    fontSize: "1.2rem",
    fontWeight: 700,
  },
  lightboxContent: {
    position: "relative",
    width: "100%",
    minHeight: "60vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    borderRadius: 8,
    overflow: "hidden",
  },
  lightboxImage: {
    maxWidth: "100%",
    maxHeight: "75vh",
    objectFit: "contain",
  },
  lightboxNavButton: {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    backgroundColor: "rgba(17,24,39,0.6)",
    color: "#fff",
    zIndex: 2,
    "&:hover": {
      backgroundColor: "rgba(17,24,39,0.78)",
    },
  },
  lightboxNavLeft: {
    left: 8,
  },
  lightboxNavRight: {
    right: 8,
  },

  timestamp: {
    fontSize: 9.8,
    position: "absolute",
    bottom: 0,
    right: 5,
    color: theme.palette.chat.bubbleMeta,
    fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    fontWeight: 600,
  },
  internalSender: {
    color: theme.mode === "light" ? "#64748b" : "#94a3b8",
    fontSize: 9.6,
    fontWeight: 500,
    marginRight: 6,
    opacity: 0.92,
  },
  internalSenderHeader: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    width: "fit-content",
    margin: "1px 0 6px 1px",
    padding: "1px 6px",
    borderRadius: 999,
    backgroundColor: theme.mode === "light" ? "rgba(15,23,42,0.06)" : "rgba(148,163,184,0.18)",
    color: theme.mode === "light" ? "#334155" : "#cbd5e1",
    fontSize: 10.2,
    fontWeight: 600,
    lineHeight: 1.2,
  },
  internalSenderIcon: {
    fontSize: 12,
    opacity: 0.9,
  },

  forwardMessage: {
    fontSize: 11,
    fontStyle: "italic",
    position: "absolute",
    top: 0,
    left: 5,
    color: theme.mode === "light" ? "#94a3b8" : "#64748b",
    display: "flex",
    alignItems: "center",
    fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  },

  dailyTimestamp: {
    alignItems: "center",
    textAlign: "center",
    alignSelf: "center",
    width: "auto",
    minWidth: 80,
    backgroundColor: theme.mode === "light" ? "rgba(226,232,240,0.88)" : "rgba(30,41,59,0.82)",
    margin: "12px auto",
    borderRadius: 20,
    boxShadow: theme.mode === "light"
      ? "0 1px 3px rgba(0,0,0,0.06)"
      : "0 1px 3px rgba(0,0,0,0.22)",
    border: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.1)"}`,
  },

  dailyTimestampText: {
    color: theme.mode === "light" ? "#64748b" : "#94a3b8",
    padding: "4px 12px",
    alignSelf: "center",
    fontSize: "0.68rem",
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },

  ackIcons: {
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  deletedIcon: {
    fontSize: 18,
    verticalAlign: "middle",
    marginRight: 4,
  },

  ackDoneAllIcon: {
    color: blue[500],
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  ackPlayedIcon: {
    color: green[500],
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },
  downloadMedia: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "inherit",
    padding: 10,
    color: theme.mode === "light" ? theme.palette.light : theme.palette.dark,
  },
  documentCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    border: "1px solid rgba(100,116,139,0.35)",
    backgroundColor: theme.mode === "light" ? "#f8fafc" : "#1b2730",
    padding: "10px 12px",
    marginBottom: 8,
    maxWidth: 420,
  },
  documentIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: theme.mode === "light" ? "#0f172a" : "#e2e8f0",
    backgroundColor: theme.mode === "light" ? "#e2e8f0" : "#334155",
  },
  documentMeta: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  documentName: {
    fontSize: "0.8rem",
    fontWeight: 700,
    lineHeight: 1.3,
    color: theme.mode === "light" ? "#0f172a" : "#e2e8f0",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  documentType: {
    fontSize: "0.72rem",
    lineHeight: 1.3,
    color: theme.mode === "light" ? "#475569" : "#94a3b8",
  },
  documentActions: {
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
    marginLeft: 4,
  },
  documentCardClickable: {
    cursor: "pointer",
  },
  pdfDialogTitle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingRight: 6,
  },
  pdfDialogName: {
    fontSize: "0.9rem",
    fontWeight: 600,
    color: theme.mode === "light" ? "#0f172a" : "#e2e8f0",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  pdfIframeWrap: {
    width: "100%",
    minHeight: 380,
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid rgba(100,116,139,0.35)",
    backgroundColor: theme.mode === "light" ? "#f8fafc" : "#111827",
  },
  pdfIframe: {
    width: "100%",
    height: 420,
    border: "none",
    display: "block",
  },

  messageCenter: {
    marginTop: 6,
    display: "flex",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: theme.mode === "light" ? "rgba(224,242,254,0.9)" : "rgba(15,23,42,0.72)",
    fontSize: "0.8rem",
    color: theme.mode === "light" ? "#0369a1" : "#7dd3fc",
    borderRadius: 20,
    padding: "4px 14px",
    boxShadow: theme.mode === "light"
      ? "0 1px 2px rgba(0,0,0,0.05)"
      : "0 1px 2px rgba(0,0,0,0.2)",
    border: `1px solid ${theme.mode === "light" ? "rgba(14,165,233,0.15)" : "rgba(125,211,252,0.1)"}`,
    fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    lineHeight: 1.5,
  },

  deletedMessage: {
    color: '#f55d65'
  },
  reactionBadge: {
    position: "absolute",
    bottom: -12,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.mode === "light" ? "#ffffff" : "#1e293b",
    border: `1px solid ${theme.mode === "light" ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.08)"}`,
    borderRadius: 12,
    padding: "2px 6px",
    boxShadow: theme.mode === "light"
      ? "0 1px 3px rgba(0,0,0,0.12)"
      : "0 1px 3px rgba(0,0,0,0.3)",
    zIndex: 2,
    maxWidth: 120,
  },
  reactionBadgeLeft: {
    left: 8,
  },
  reactionBadgeRight: {
    left: 8,
  },
  reactionEmojis: {
    fontSize: "0.78rem",
    lineHeight: 1,
    whiteSpace: "nowrap",
  },
  reactionCount: {
    fontSize: "0.68rem",
    fontWeight: 600,
    color: theme.mode === "light" ? "#4b5563" : "#94a3b8",
  },
  richCard: {
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    backgroundColor: theme.mode === "light" ? "#f8fafc" : "#1b2730",
    padding: "10px 12px",
    marginBottom: 8,
    minWidth: 240,
    maxWidth: 420,
  },
  richCardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: "0.8rem",
    fontWeight: 700,
    marginBottom: 8,
    color: theme.mode === "light" ? "#0f172a" : "#e2e8f0",
  },
  richCardTitle: {
    fontSize: "0.9rem",
    fontWeight: 700,
    marginBottom: 6,
    color: theme.mode === "light" ? "#1e293b" : "#f1f5f9",
  },
  richCardMeta: {
    fontSize: "0.78rem",
    lineHeight: 1.45,
    color: theme.mode === "light" ? "#334155" : "#cbd5e1",
    marginBottom: 4,
  },
  pixKeyBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    border: "1px solid rgba(100,116,139,0.35)",
    borderRadius: 8,
    padding: "8px 10px",
    marginTop: 4,
    backgroundColor: theme.mode === "light" ? "#ffffff" : "#0f172a",
  },
  pixKeyValue: {
    fontSize: "0.82rem",
    fontWeight: 600,
    color: theme.mode === "light" ? "#1e293b" : "#f1f5f9",
    wordBreak: "break-all",
  },
  pixCopyButton: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#25d366",
    cursor: "pointer",
    whiteSpace: "nowrap",
    background: "none",
    border: "none",
    padding: 0,
  },
  pollOption: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid rgba(100,116,139,0.35)",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: "0.78rem",
    marginTop: 6,
    color: theme.mode === "light" ? "#1f2937" : "#e5e7eb",
  },
  pollOptionDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    border: "2px solid rgba(100,116,139,0.8)",
    flexShrink: 0,
  },
  channelWarning: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    fontSize: "0.78rem",
    backgroundColor: theme.mode === "light" ? "rgba(224,242,254,0.88)" : "rgba(15,23,42,0.7)",
    color: theme.mode === "light" ? "#0369a1" : "#7dd3fc",
    borderTop: `1px solid ${theme.mode === "light" ? "rgba(14,165,233,0.15)" : "rgba(125,211,252,0.1)"}`,
  },
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_MESSAGES") {
    const messages = action.payload;
    const newMessages = [];
    const updatedState = [...state];

    messages.forEach((message) => {
      const messageIndex = updatedState.findIndex((m) => m.id === message.id);
      if (messageIndex !== -1) {
        updatedState[messageIndex] = message;
      } else {
        newMessages.push(message);
      }
    });

    return [...newMessages, ...updatedState];
  }

  if (action.type === "ADD_MESSAGE") {
    const newMessage = action.payload;
    const messageIndex = state.findIndex((m) => m.id === newMessage.id);

    if (messageIndex !== -1) {
      const updated = [...state];
      updated[messageIndex] = newMessage;
      return updated;
    }

    return [...state, newMessage];
  }

  if (action.type === "UPDATE_MESSAGE") {
    const messageToUpdate = action.payload;
    const messageIndex = state.findIndex((m) => m.id === messageToUpdate.id);

    if (messageIndex !== -1) {
      const updated = [...state];
      updated[messageIndex] = messageToUpdate;
      return updated;
    }

    return [...state, messageToUpdate];
  }

  if (action.type === "DELETE_MESSAGE") {
    const messageId = action.payload;
    return state.filter((m) => m.id !== messageId);
  }

  if (action.type === "RESET") {
    return [];
  }

  return state;
};

const MessagesList = ({
  isGroup,
  onDrop,
  whatsappId,
  queueId,
  channel,
  ticketDbId,
  ticketUuid,
  searchParam = ""
}) => {
  const classes = useStyles();
  const [messagesList, dispatch] = useReducer(reducer, []);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pdfPreview, setPdfPreview] = useState({
    open: false,
    href: "",
    name: "Documento"
  });
  const history = useHistory();
  const lastMessageRef = useRef();

  const [selectedMessage, setSelectedMessage] = useState({});
  const [interactiveSelections, setInteractiveSelections] = useState({});
  const [audioTranscriptions, setAudioTranscriptions] = useState({});
  const { setReplyingMessage } = useContext(ReplyMessageContext);
  const [anchorEl, setAnchorEl] = useState(null);
  const messageOptionsMenuOpen = Boolean(anchorEl);
  const { ticketId } = useParams();

  const currentTicketId = useRef(ticketId);
  const { getAll } = useCompanySettings();
  const [dragActive, setDragActive] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryRotation, setGalleryRotation] = useState(0);
  const touchStartXRef = useRef(null);
  const galleryContainerRef = useRef(null);

  const [lgpdDeleteMessage, setLGPDDeleteMessage] = useState(false);
  const { selectedQueuesMessage } = useContext(QueueSelectedContext);

  const { showSelectMessageCheckbox } = useContext(ForwardMessageContext);

  const { user, socket } = useContext(AuthContext);

  const companyId = user.companyId;

  const handleInteractiveOptionClick = async (message, option) => {
    const selectionKey = String(message?.id || message?.wid || "");
    if (!selectionKey || interactiveSelections[selectionKey]) return;

    setInteractiveSelections(current => ({
      ...current,
      [selectionKey]: { pending: true }
    }));

    try {
      // A seleção é enviada como texto usando o fluxo normal do ticket. Isto
      // mantém compatibilidade com Baileys, WuzAPI e API Oficial, que não
      // compartilham uma API única para emitir o evento nativo de clique.
      await api.post(`/messages/${ticketDbId || ticketId}`, {
        body: option.label,
        quotedMsg: message
      });
      setInteractiveSelections(current => ({
        ...current,
        [selectionKey]: { selectedId: option.id }
      }));
    } catch (error) {
      setInteractiveSelections(current => {
        const next = { ...current };
        delete next[selectionKey];
        return next;
      });
      toastError(error);
    }
  };

  const renderInteractiveCard = (message) => {
    const card = getInteractiveCard(message);
    if (!card) return null;

    const selection = interactiveSelections[String(message?.id || message?.wid || "")];
    return (
      <div className={classes.interactiveCard}>
        {card.title && <div className={classes.interactiveCardHeader}>{card.title}</div>}
        {card.body && <div className={classes.interactiveCardBody}>{card.body}</div>}
        {card.footer && <div className={classes.interactiveCardFooter}>{card.footer}</div>}
        <div className={classes.interactiveOptions}>
          {card.options.map(option => {
            const isSelected = selection?.selectedId === option.id;
            return (
              <Button
                key={option.id}
                className={classes.interactiveOption}
                disabled={Boolean(selection?.pending || selection?.selectedId)}
                onClick={() => handleInteractiveOptionClick(message, option)}
              >
                <span>
                  {isSelected ? `✓ ${option.label}` : option.label}
                  {option.description && (
                    <span className={classes.interactiveOptionDescription}>{option.description}</span>
                  )}
                </span>
              </Button>
            );
          })}
        </div>
      </div>
    );
  };

  useEffect(() => {

    async function fetchData() {

      const settings = await getAll(companyId);

      let settinglgpdDeleteMessage;
      let settingEnableLGPD;

      for (const [key, value] of Object.entries(settings)) {

        if (key === "lgpdDeleteMessage") settinglgpdDeleteMessage = value
        if (key === "enableLGPD") settingEnableLGPD = value
      }
      if (settingEnableLGPD === "enabled" && settinglgpdDeleteMessage === "enabled") {
        setLGPDDeleteMessage(true);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);

    currentTicketId.current = ticketId;
  }, [ticketId, selectedQueuesMessage, searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchMessages = async () => {
        if (ticketId === "undefined") {
          history.push("/tickets");
          return;
        }
        if (isNil(ticketId)) return;
        try {
          const { data } = await api.get("/messages/" + ticketId, {
            params: {
              pageNumber,
              selectedQueues: JSON.stringify(selectedQueuesMessage),
              searchParam
            },
          });

          if (currentTicketId.current === ticketId) {
            dispatch({ type: "LOAD_MESSAGES", payload: data.messages });
            setHasMore(data.hasMore);
            setLoading(false);
            setLoadingMore(false);
          }

          if (pageNumber === 1 && data.messages.length > 1) {
            scrollToBottom();
          }
        } catch (err) {
          setLoading(false);
          toastError(err);
          setLoadingMore(false);
        }
      };

      fetchMessages();
    }, 500);
    return () => {
      clearTimeout(delayDebounceFn);
    };
  }, [pageNumber, ticketId, selectedQueuesMessage, searchParam]);

  useEffect(() => {
    if (ticketId === "undefined") {
      return;
    }

    const companyId = user.companyId;

    //    const socket = socketManager.GetSocket();
    const connectEventMessagesList = () => {
      socket.emit("joinChatBox", `${ticketId}`);
    }

    const isCurrentTicketEvent = (data) => {
      const payloadTicketUuid =
        data?.ticket?.uuid || data?.message?.ticket?.uuid || null;
      const payloadTicketId =
        data?.ticket?.id ||
        data?.message?.ticket?.id ||
        data?.message?.ticketId ||
        data?.ticketId ||
        null;

      const expectedUuid = ticketUuid || ticketId || null;
      const expectedId = ticketDbId || null;

      if (expectedUuid && payloadTicketUuid) {
        return String(payloadTicketUuid) === String(expectedUuid);
      }

      if (expectedId && payloadTicketId) {
        return String(payloadTicketId) === String(expectedId);
      }

      return false;
    };

    const onAppMessageMessagesList = (data) => {
      if (data.action === "create" && isCurrentTicketEvent(data)) {
        dispatch({ type: "ADD_MESSAGE", payload: data.message });
        scrollToBottom();
      }

      if (data.action === "update" && isCurrentTicketEvent(data)) {
        dispatch({ type: "UPDATE_MESSAGE", payload: data.message });
      }

      if (data.action == "delete" && isCurrentTicketEvent(data)) {
        dispatch({ type: "DELETE_MESSAGE", payload: data.messageId });
      }
    };

    const onAppMessageRoomMessagesList = (data) => {
      onAppMessageMessagesList(data);
    };

    socket.on("connect", connectEventMessagesList);
    socket.on(`company-${companyId}-appMessage`, onAppMessageMessagesList);
    socket.on("appMessage", onAppMessageRoomMessagesList);
    connectEventMessagesList();

    return () => {

      socket.emit("joinChatBoxLeave", `${ticketId}`)

      socket.off("connect", connectEventMessagesList);
      socket.off(`company-${companyId}-appMessage`, onAppMessageMessagesList);
      socket.off("appMessage", onAppMessageRoomMessagesList);
    };

  }, [ticketId, ticketDbId, ticketUuid]);

  const loadMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setPageNumber((prevPageNumber) => prevPageNumber + 1);
  };

const scrollToBottom = () => {
  setTimeout(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({});
    }
  }, 100);
};

const handleScroll = (e) => {
  if (!hasMore) return;
  const { scrollTop } = e.currentTarget;

  if (scrollTop === 0) {
    document.getElementById("messagesList").scrollTop = 1;
  }

  if (loading) {
    return;
  }

  if (scrollTop < 50) {
    loadMore();
  }
};

const handleOpenMessageOptionsMenu = (e, message) => {
  setAnchorEl(e.currentTarget);
  setSelectedMessage(message);
};

const handleCloseMessageOptionsMenu = (e) => {
  setAnchorEl(null);
};

useEffect(() => {
  try {
    const stored = localStorage.getItem("audioMessageTranscriptions");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        setAudioTranscriptions(parsed);
      }
    }
  } catch (error) {
    // Ignora falhas de leitura para não impactar renderização das mensagens.
  }
}, []);

useEffect(() => {
  const vv = window.visualViewport;
  if (!vv) return;
  let prevHeight = vv.height;
  const onVvResize = () => {
    if (vv.height < prevHeight) {
      // Teclado abriu: rola para a última mensagem para não deixar o chat em branco
      scrollToBottom();
    }
    prevHeight = vv.height;
  };
  vv.addEventListener("resize", onVvResize);
  return () => vv.removeEventListener("resize", onVvResize);
}, []);

const handleAudioTranscription = useCallback((messageId, text) => {
  if (!messageId || !text) return;

  setAudioTranscriptions((prev) => {
    const next = { ...prev, [messageId]: text };
    try {
      localStorage.setItem("audioMessageTranscriptions", JSON.stringify(next));
    } catch (error) {
      // Ignora falhas de storage para não bloquear funcionalidade principal.
    }
    return next;
  });
}, []);

const renderInlineTranscription = (message) => {
  if (String(message?.mediaType || "").toLowerCase() !== "audio") return null;
  const text = audioTranscriptions?.[message?.id];
  if (!text) return null;

  return (
    <div className={classes.transcriptionInline}>
      <strong>Transcrição:</strong> {text}
    </div>
  );
};

const hanldeReplyMessage = (e, message) => {
  //if (ticket.status === "open" || ticket.status === "group") {
  setAnchorEl(null);
  setReplyingMessage(message);
  //}
};

const parsePollCardData = (body = "") => {
  const lines = String(body || "")
    .split("\n")
    .map((line) => line.trim());

  const title = lines.find((line) => line && !line.startsWith("*") && !line.startsWith("-")) || "";
  const options = lines
    .filter((line) => line.startsWith("-"))
    .map((line) => line.replace(/^-+\s*/, "").trim())
    .filter(Boolean);

  return { title, options };
};

const parseEventCardData = (body = "") => {
  const lines = String(body || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const getField = (prefix) =>
    lines.find((line) => line.toLowerCase().startsWith(prefix))?.split(":").slice(1).join(":").trim() || "";

  return {
    title: getField("nome"),
    description: getField("descrição") || getField("descricao"),
    location: getField("local"),
    date: getField("data")
  };
};

const isPollMessage = (message) =>
  message?.mediaType === "pollCreationMessageV3" || message?.mediaType === "pollCreationMessage";

const isEventMessage = (message) => message?.mediaType === "eventMessage";

const isPixCardMessage = (message) =>
  String(message?.body || "").trim().startsWith("[PIX]");

const parsePixCardData = (body = "") => {
  const lines = String(body || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line !== "[PIX]");

  const copyLine = lines.find((line) => line.startsWith("COPY::"));
  const copyValue = copyLine ? copyLine.slice("COPY::".length).trim() : "";
  const textLines = lines.filter((line) => line !== copyLine);

  const title = (textLines[0] || "Chave Pix").replace(/^\*+|\*+$/g, "").trim();
  const description = textLines.slice(1).join("\n").replace(/\*/g, "").trim();

  return { title, description, copyValue };
};

const copyPixKey = async (value) => {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    toast.success("Chave Pix copiada!");
  } catch (error) {
    toast.error("Não foi possível copiar a chave Pix.");
  }
};

const parseLocationFromBody = (body = "") => {
  const lines = String(body || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const mapLine = lines.find((line) => /^https?:\/\/.*maps\.google\./i.test(line)) || "";
  const textLines = lines.filter((line) => line !== mapLine);

  return {
    title: textLines[0] || "Localização",
    address: textLines.slice(1).join("\n"),
    link: mapLine
  };
};

const renderPollCard = (classes, message) => {
  const { title, options } = parsePollCardData(message?.body);
  return (
    <div className={classes.richCard}>
      <div className={classes.richCardHeader}>
        <BarChart fontSize="small" />
        Enquete
      </div>
      {title ? <div className={classes.richCardTitle}>{title}</div> : null}
      {options.map((option, index) => (
        <div className={classes.pollOption} key={`poll-${message.id}-${index}`}>
          <span className={classes.pollOptionDot} />
          <span>{option}</span>
        </div>
      ))}
    </div>
  );
};

const renderEventCard = (classes, message) => {
  const { title, description, location, date } = parseEventCardData(message?.body);
  return (
    <div className={classes.richCard}>
      <div className={classes.richCardHeader}>
        <EventNote fontSize="small" />
        Evento
      </div>
      {title ? <div className={classes.richCardTitle}>{title}</div> : null}
      {description ? <div className={classes.richCardMeta}>Descrição: {description}</div> : null}
      {location ? <div className={classes.richCardMeta}>Local: {location}</div> : null}
      {date ? <div className={classes.richCardMeta}>Data: {date}</div> : null}
    </div>
  );
};

const renderPixCard = (classes, message) => {
  const { title, description, copyValue } = parsePixCardData(message?.body);
  return (
    <div className={classes.richCard}>
      <div className={classes.richCardHeader}>
        <Payment fontSize="small" />
        Pagamento via Pix
      </div>
      <div className={classes.richCardTitle}>{title}</div>
      {description ? <div className={classes.richCardMeta}>{description}</div> : null}
      {copyValue ? (
        <div className={classes.pixKeyBox}>
          <span className={classes.pixKeyValue}>{copyValue}</span>
          <button
            type="button"
            className={classes.pixCopyButton}
            onClick={() => copyPixKey(copyValue)}
          >
            <FileCopy fontSize="small" />
            Copiar
          </button>
        </div>
      ) : null}
    </div>
  );
};

const checkMessageMedia = (message) => {
  const mediaHref = resolveMediaUrl(message?.mediaUrl);

  if (message.mediaType === "location") {
    const parsed = parseLocationFromBody(message.body);
    return (
      <LocationPreview
        link={parsed.link}
        title={parsed.title}
        address={parsed.address}
        description={parsed.address}
      />
    );
  }

  if (message.mediaType === "locationMessage" && message.body.split('|').length >= 2) {
    let locationParts = message.body.split('|')
    let imageLocation = locationParts[0]
    let linkLocation = locationParts[1]

    let descriptionLocation = null

    if (locationParts.length > 2)
      descriptionLocation = message.body.split('|')[2]

    return <LocationPreview image={imageLocation} link={linkLocation} description={descriptionLocation} />
  } else

    if (message.mediaType === "contactMessage") {
      const parsedVcard = parseVcard(message.body);

      return (
        <VcardPreview
          contact={parsedVcard.contactName}
          numbers={parsedVcard.primaryNumber}
          queueId={message?.ticket?.queueId}
          whatsappId={message?.ticket?.whatsappId}
        />
      );
    } else if (isPollMessage(message)) {
      return renderPollCard(classes, message);
    } else if (isEventMessage(message)) {
      return renderEventCard(classes, message);
    } else if (isPixCardMessage(message)) {
      return renderPixCard(classes, message);
    } else if (message.mediaType === "adMetaPreview") { // Adicionado para renderizar o componente de preview de anúncio
  let [image, sourceUrl, title, body] = message.body.split('|').map(part => (part || "").trim());
  let messageUser = "Olá! Tenho interesse e queria mais informações, por favor.";
  return <AdMetaPreview image={image} sourceUrl={sourceUrl} title={title} body={body} messageUser={messageUser} />;
}

      if (message.mediaType === "image" || message.mediaType === "sticker") {
        if (!mediaHref) return null;
        return <ModalImageCors imageUrl={mediaHref} />;
      } else

        if (message.mediaType === "audio") {
          if (!mediaHref) return null;
          return (
            <AudioModal url={mediaHref} />
            // <audio controls>
            //   <source src={message.mediaUrl} type="audio/ogg"></source>
            //   {/* <source src={message.mediaUrl} type="audio/mp3"></source> */}
            // </audio>
          );
        } else

          if (message.mediaType === "video") {
            if (!mediaHref) return null;
            return (
              <video
                className={classes.messageMedia}
                src={mediaHref}
                controls
              />
            );
          } else if (isDocumentMessage(message)) {
            return renderDocumentPreview(message);
          } else {
            if (!mediaHref) return null;
            return (
              <>
                <div className={classes.downloadMedia}>
                  <Button
                    startIcon={<GetApp />}
                    variant="outlined"
                    target="_blank"
                    href={mediaHref}
                  >
                    Download
                  </Button>
                </div>
                <Divider />
              </>
            );
          }
};

const renderMediaSafely = (message) => {
  try {
    return checkMessageMedia(message);
  } catch (_) {
    return (
      <div className={classes.downloadMedia}>
        <span>Midia indisponivel nesta mensagem.</span>
      </div>
    );
  }
};

const isImageMessage = (message) => {
  if (!message) return false;
  return String(message.mediaType || "").toLowerCase() === "image" && !!message.mediaUrl;
};

const canGroupImageMessage = (message) => {
  return isImageMessage(message) && !hasVisibleMediaText(message);
};

const openImageGallery = (images, initialIndex = 0) => {
  if (!Array.isArray(images) || images.length === 0) return;
  setGalleryImages(images);
  setGalleryIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
  setGalleryRotation(0);
  setGalleryOpen(true);
};

const closeImageGallery = () => {
  setGalleryOpen(false);
  setGalleryImages([]);
  setGalleryIndex(0);
  setGalleryRotation(0);
};

const goToPreviousImage = () => {
  setGalleryIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  setGalleryRotation(0);
};

const goToNextImage = () => {
  setGalleryIndex((prev) => (prev + 1) % galleryImages.length);
  setGalleryRotation(0);
};

const rotateGalleryImage = () => {
  setGalleryRotation((prev) => (prev + 90) % 360);
};

const openGalleryImageInFullScreen = async () => {
  const el = galleryContainerRef.current;
  if (!el) return;
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    }
  } catch (error) {
    // fallback silencioso para navegadores sem suporte completo
  }
};

const downloadGalleryImage = async () => {
  const imageUrl = galleryImages[galleryIndex]?.url;
  if (!imageUrl) return;
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `imagem-${galleryIndex + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    toastError(error);
  }
};

const handleGalleryTouchStart = (event) => {
  const touch = event?.changedTouches?.[0];
  touchStartXRef.current = touch?.clientX ?? null;
};

const handleGalleryTouchEnd = (event) => {
  const touch = event?.changedTouches?.[0];
  const startX = touchStartXRef.current;
  const endX = touch?.clientX;
  touchStartXRef.current = null;
  if (startX === null || endX === undefined) return;
  const diff = endX - startX;
  if (Math.abs(diff) < 40) return;
  if (diff > 0) {
    goToPreviousImage();
  } else {
    goToNextImage();
  }
};

const getGridTemplateForCount = (count) => {
  if (count === 1) return "1fr / 1fr";
  if (count === 2) return "1fr / 1fr 1fr";
  if (count === 3) return "repeat(2, 140px) / repeat(2, 1fr)";
  return "repeat(2, 140px) / repeat(3, 1fr)";
};

const renderImageGroupGrid = (groupMessages = []) => {
  const images = groupMessages
    .map((m) => ({
      id: m.id,
      url: resolveMediaUrl(m.mediaUrl),
      message: m
    }))
    .filter((item) => !!item.url);

  if (!images.length) return null;

  const visibleImages = images.slice(0, 6);
  const hiddenCount = images.length - visibleImages.length;
  const gridTemplate = getGridTemplateForCount(visibleImages.length);

  return (
    <div className={classes.messageImageGrid} style={{ gridTemplate: gridTemplate }}>
      {visibleImages.map((img, idx) => (
        <button
          type="button"
          className={classes.messageImageGridItem}
          key={`grid-img-${img.id}-${idx}`}
          onClick={() => openImageGallery(images, idx)}
        >
          <img className={classes.messageImageGridThumb} src={img.url} alt={`image-${idx + 1}`} />
          {hiddenCount > 0 && idx === visibleImages.length - 1 && (
            <span className={classes.messageImageGridMoreOverlay}>+{hiddenCount}</span>
          )}
        </button>
      ))}
    </div>
  );
};

const renderMessageAck = (message) => {
  if (message.ack === 0) {
    return <AccessTime fontSize="small" className={classes.ackIcons} />;
  } else
    if (message.ack === 1) {
      return <Done fontSize="small" className={classes.ackIcons} />;
    } else
      if (message.ack === 2) {
        return <DoneAll fontSize="small" className={classes.ackIcons} />;
      } else
        if (message.ack === 3 || message.ack === 4) {
          return <DoneAll fontSize="small" className={message.mediaType === "audio" ? classes.ackPlayedIcon : classes.ackDoneAllIcon} />;
        } else
          if (message.ack === 5) {
            return <DoneAll fontSize="small" className={classes.ackDoneAllIcon} />
          }
};

const renderDailyTimestamps = (message, index, sourceList = messagesList) => {
  const today = format(new Date(), "dd/MM/yyyy")

  if (index === 0) {
    return (
      <span
        className={classes.dailyTimestamp}
        key={`timestamp-${message.id}`}
      >
        <div className={classes.dailyTimestampText}>
          {today === format(parseISO(sourceList[index].createdAt), "dd/MM/yyyy") ? "HOJE" : format(parseISO(sourceList[index].createdAt), "dd/MM/yyyy")}
        </div>
      </span>
    );
  } else
    if (index < sourceList.length - 1) {
      let messageDay = parseISO(sourceList[index].createdAt);
      let previousMessageDay = parseISO(sourceList[index - 1].createdAt);

      if (!isSameDay(messageDay, previousMessageDay)) {
        return (
          <span
            className={classes.dailyTimestamp}
            key={`timestamp-${message.id}`}
          >
            <div className={classes.dailyTimestampText}>
              {today === format(parseISO(sourceList[index].createdAt), "dd/MM/yyyy") ? "HOJE" : format(parseISO(sourceList[index].createdAt), "dd/MM/yyyy")}
            </div>
          </span>
        );
      }
    } else
      if (index === sourceList.length - 1) {
        return (
          <div
            key={`ref-${message.id}`}
            ref={lastMessageRef}
            style={{ float: "left", clear: "both" }}
          />
        );
      }
};


const renderTicketsSeparator = (message, index, sourceList = messagesList) => {
  let lastTicket = sourceList[index - 1]?.ticketId;
  let currentTicket = message.ticketId;

  if (lastTicket !== currentTicket && lastTicket !== undefined) {
    if (message?.ticket?.queue) {
      return (
        <span
          className={classes.currentTick}
          key={`timestamp-${message.id}a`}
        >
          <div
            className={classes.currentTicktText}
            style={{ backgroundColor: message?.ticket?.queue?.color || "grey" }}
          >
            #{i18n.t("ticketsList.called")} {message?.ticketId} - {message?.ticket?.queue?.name}
          </div>

        </span>
      );
    } else {
      return (
        <span
          className={classes.currentTick}
          key={`timestamp-${message.id}b`}
        >
          <div
            className={classes.currentTicktText}
            style={{ backgroundColor: "grey" }}
          >
            #{i18n.t("ticketsList.called")} {message.ticketId} - {i18n.t("ticketsList.noQueue")}
          </div>

        </span>
      );
    }
  }

};

const renderMessageDivider = (message, index, sourceList = messagesList) => {
  if (index < sourceList.length && index > 0) {
    let messageUser = sourceList[index].fromMe;
    let previousMessageUser = sourceList[index - 1].fromMe;
    if (messageUser !== previousMessageUser) {
      return (

        <span style={{ marginTop: 16 }} key={`divider-${message.id}`}></span>
      );
    }
  }
};

const path = require('path');
const backendBaseUrl = String(process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");

const safeBasename = (value) => {
  const raw = typeof value === "string" ? value : "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return path.basename(trimmed.split("?")[0]);
};

const parseVcard = (body) => {
  const rawBody = String(body || "").trim();
  if (!rawBody) {
    return { contactName: "", primaryNumber: "", numbers: [] };
  }

  const lines = rawBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let contactName = "";
  const numbers = [];

  lines.forEach((line) => {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) return;

    const key = line.slice(0, separatorIndex).trim().toUpperCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (!contactName && (key === "FN" || key.startsWith("FN;"))) {
      contactName = value;
      return;
    }

    if (key === "N" || key.startsWith("N;")) {
      if (!contactName) {
        const normalizedName = value
          .split(";")
          .map((item) => item.trim())
          .filter(Boolean)
          .join(" ");

        if (normalizedName) {
          contactName = normalizedName;
        }
      }
      return;
    }

    if (key.startsWith("TEL")) {
      const waidMatch = key.match(/WAID=(\d+)/i);
      const normalizedNumber = value || (waidMatch ? `+${waidMatch[1]}` : "");

      if (normalizedNumber && !numbers.includes(normalizedNumber)) {
        numbers.push(normalizedNumber);
      }
    }
  });

  return {
    contactName,
    primaryNumber: numbers[0] || "",
    numbers
  };
};

const hasVisibleMediaText = (message) => {
  const body = String(message?.body || "").trim();
  if (!body) return false;

  const mediaUrlName = safeBasename(message?.mediaUrl);
  const mediaName = String(message?.mediaName || "").trim();

  return body !== mediaUrlName && body !== mediaName;
};

const shouldRenderMessageBody = (message) => {
  if (!message || message.mediaType === "adMetaPreview") return false;
  if (message.mediaType === "contactMessage") return false;

  if (hasVisibleMediaText(message)) return true;

  return (
    message.mediaType !== "audio" &&
    message.mediaType !== "image" &&
    message.mediaType !== "sticker" &&
    message.mediaType !== "video" &&
    message.mediaType !== "reactionMessage" &&
    message.mediaType !== "locationMessage" &&
    message.mediaType !== "location" &&
    message.mediaType !== "contactMessage" &&
    !isPollMessage(message) &&
    !isEventMessage(message) &&
    !isPixCardMessage(message)
  );
};

const resolveMediaUrl = (rawUrl) => {
  const value = String(rawUrl || "").trim();
  if (!value) return value;
  if (/^(blob:|data:|https?:\/\/)/i.test(value)) return value;
  if (!backendBaseUrl) return value;
  return `${backendBaseUrl}${value.startsWith("/") ? "" : "/"}${value}`;
};

const isDocumentMessage = (message) => {
  const mediaType = String(message?.mediaType || "").trim().toLowerCase();
  return mediaType === "application" || mediaType === "document";
};

const getNestedValue = (obj, path = []) => {
  return path.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
};

const extractDocumentNameFromDataJson = (message) => {
  const rawDataJson = message?.dataJson;
  if (!rawDataJson || typeof rawDataJson !== "string") return "";

  try {
    const parsed = JSON.parse(rawDataJson);
    const candidates = [
      getNestedValue(parsed, ["__mediaOriginalName"]),
      getNestedValue(parsed, ["Message", "documentMessage", "fileName"]),
      getNestedValue(parsed, ["Message", "documentMessage", "filename"]),
      getNestedValue(parsed, ["message", "documentMessage", "fileName"]),
      getNestedValue(parsed, ["message", "documentMessage", "filename"]),
      getNestedValue(parsed, ["documentMessage", "fileName"]),
      getNestedValue(parsed, ["documentMessage", "filename"]),
      getNestedValue(parsed, ["Info", "Media", "FileName"]),
      getNestedValue(parsed, ["info", "media", "fileName"]),
      getNestedValue(parsed, ["FileName"]),
      getNestedValue(parsed, ["fileName"]),
      getNestedValue(parsed, ["filename"])
    ];

    for (const candidate of candidates) {
      const value = String(candidate || "").trim();
      if (value) return value;
    }
  } catch (error) {
    // Mantém fallback para nome vindo de mediaName/mediaUrl.
  }

  return "";
};

const getDocumentLabel = (message) => {
  const dataJsonName = extractDocumentNameFromDataJson(message);
  if (dataJsonName) return dataJsonName;

  const mediaName = String(message?.mediaName || "").trim();
  if (mediaName) return mediaName;

  const mediaUrl = String(message?.mediaUrl || "").trim();
  if (mediaUrl) {
    const urlFileName = safeBasename(mediaUrl);
    if (urlFileName && urlFileName !== "/") return urlFileName;
  }

  return "Documento";
};

const isPdfDocument = (message) => {
  const label = getDocumentLabel(message);
  const mediaUrl = String(message?.mediaUrl || "");
  return /\.pdf$/i.test(label) || /\.pdf(?:$|\?)/i.test(mediaUrl);
};

const handleOpenPdfPreview = (message) => {
  const mediaHref = resolveMediaUrl(message?.mediaUrl);
  if (!mediaHref) return;
  setPdfPreview({
    open: true,
    href: mediaHref,
    name: getDocumentLabel(message)
  });
};

const handleClosePdfPreview = () => {
  setPdfPreview({
    open: false,
    href: "",
    name: "Documento"
  });
};

const renderDocumentPreview = (message) => {
  const mediaHref = resolveMediaUrl(message?.mediaUrl);
  if (!mediaHref) return null;
  const isPdf = isPdfDocument(message);

  return (
    <div
      className={clsx(classes.documentCard, {
        [classes.documentCardClickable]: isPdf
      })}
      onClick={isPdf ? () => handleOpenPdfPreview(message) : undefined}
      role={isPdf ? "button" : undefined}
      tabIndex={isPdf ? 0 : undefined}
      onKeyDown={
        isPdf
          ? (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleOpenPdfPreview(message);
            }
          }
          : undefined
      }
    >
      <span className={classes.documentIconWrap}>
        <Description fontSize="small" />
      </span>

      <div className={classes.documentMeta}>
        <span className={classes.documentName}>{getDocumentLabel(message)}</span>
        <span className={classes.documentType}>Documento</span>
      </div>

      <div className={classes.documentActions}>
        {isPdf && (
          <IconButton
            size="small"
            title="Visualizar PDF"
            onClick={(event) => {
              event.stopPropagation();
              handleOpenPdfPreview(message);
            }}
          >
            <Visibility fontSize="small" />
          </IconButton>
        )}
        <IconButton
          component="a"
          href={mediaHref}
          target="_blank"
          rel="noreferrer"
          size="small"
          title="Abrir"
          onClick={(event) => event.stopPropagation()}
        >
          <OpenInNew fontSize="small" />
        </IconButton>
        <IconButton
          component="a"
          href={mediaHref}
          size="small"
          title="Baixar"
          download={getDocumentLabel(message)}
          onClick={(event) => event.stopPropagation()}
        >
          <GetApp fontSize="small" />
        </IconButton>
      </div>
    </div>
  );
};

const renderQuotedMessage = (message) => {
  const quotedVcard = message?.quotedMsg?.mediaType === "contactMessage"
    ? parseVcard(message?.quotedMsg?.body)
    : null;

  return (
    <div
      className={clsx(classes.quotedContainerLeft, {
        [classes.quotedContainerRight]: message.fromMe,
      })}
    >
      <span
        className={clsx(classes.quotedSideColorLeft, {
          [classes.quotedSideColorRight]: message.quotedMsg?.fromMe,
        })}
      ></span>
      <div className={classes.quotedMsg}>
        {!message.quotedMsg?.fromMe && (
          <span className={classes.messageContactName}>
            {message.quotedMsg?.contact?.name}
          </span>
        )}

        {message.quotedMsg.mediaType === "audio"
          && (
            <div className={classes.downloadMedia}>
              <AudioModal url={resolveMediaUrl(message.quotedMsg.mediaUrl)} />

              {/* <audio controls>
                  <source src={message.quotedMsg.mediaUrl} type="audio/mp3"></source>
                  {/* <source src={message.quotedMsg.mediaUrl} type="audio/ogg"></source> 
                </audio> */}
            </div>
          )
        }
        {message.quotedMsg.mediaType === "video"
          && (
            <video
              className={classes.messageMedia}
              src={resolveMediaUrl(message.quotedMsg.mediaUrl)}
              controls
            />
          )
        }
        {message.quotedMsg.mediaType === "contactMessage"
          && (
            quotedVcard?.contactName
              ? `Contato: ${quotedVcard.contactName}`
              : "Contato"
          )
        }
        {isDocumentMessage(message.quotedMsg) && renderDocumentPreview(message.quotedMsg)}

        {["image", "sticker"].includes(message.quotedMsg.mediaType)
          && (
            <ModalImageCors imageUrl={resolveMediaUrl(message.quotedMsg.mediaUrl)} />)
          || (message.quotedMsg.mediaType !== "contactMessage" && message.quotedMsg?.body)}

        {!message.quotedMsg.mediaType === "image" && message.quotedMsg?.body}


      </div>
    </div>
  );
};

const handleDrag = event => {
  event.preventDefault();
  event.stopPropagation();
  if (event.type === "dragenter" || event.type === "dragover") {
    setDragActive(true);
  } else if (event.type === "dragleave") {
    setDragActive(false);
  }
}

const isYouTubeLink = (url) => {
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  return youtubeRegex.test(url);
};

const handleDrop = event => {
  event.preventDefault();
  event.stopPropagation();
  setDragActive(false);
  if (event.dataTransfer.files && event.dataTransfer.files[0]) {
    if (onDrop) {
      onDrop(event.dataTransfer.files);
    }
  }
}
const xmlRegex = /<([^>]+)>/g;
const boldRegex = /\*(.*?)\*/g;

const formatXml = (xmlString) => {
  // Verifica se o XML contém a assinatura com nome do atendente
  if (boldRegex.test(xmlString)) {
    // Formata o texto dentro da assinatura em negrito
    xmlString = xmlString.replace(boldRegex, "**$1**");
  }
  return xmlString;
};

const parseDataJson = (dataJson) => {
  if (!dataJson || typeof dataJson !== "string") return null;
  try {
    return JSON.parse(dataJson);
  } catch {
    return null;
  }
};

const firstInteractiveText = (...values) => {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
};

const parseInteractiveParams = (button) => {
  const raw = button?.buttonParamsJson || button?.buttonParamsJSON || "";
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// As três conexões persistem o payload original em posições diferentes no
// dataJson. Procuramos somente os formatos interativos conhecidos e não
// tentamos inferir opções a partir do texto salvo no body.
const findInteractivePayload = (value, depth = 0) => {
  if (!value || typeof value !== "object" || depth > 5) return null;

  if (value?.buttonsMessage || value?.listMessage || value?.interactiveMessage) {
    return value;
  }

  if (
    value?.type === "button" ||
    value?.type === "list" ||
    Array.isArray(value?.action?.buttons) ||
    Array.isArray(value?.action?.sections)
  ) {
    return { interactive: value };
  }

  const nextValues = [
    value?.message,
    value?.Message,
    value?.payload,
    value?.data,
    value?.body,
    value?.interactive,
    value?.ephemeralMessage?.message,
    value?.viewOnceMessage?.message,
    value?.viewOnceMessageV2?.message,
    value?.viewOnceMessageV2Extension?.message,
  ];

  for (const next of nextValues) {
    const found = findInteractivePayload(next, depth + 1);
    if (found) return found;
  }

  return null;
};

const normalizePrebuiltInteractiveCard = (card) => {
  if (!card || typeof card !== "object") return null;
  const options = (Array.isArray(card.options) ? card.options : [])
    .map(option => ({
      id: firstInteractiveText(option?.id, option?.label),
      label: firstInteractiveText(option?.label),
      description: firstInteractiveText(option?.description),
    }))
    .filter((option, index, all) =>
      option.label && option.id &&
      all.findIndex(candidate => candidate.id === option.id) === index
    );
  if (!options.length) return null;
  return {
    title: firstInteractiveText(card.title),
    body: firstInteractiveText(card.body),
    footer: firstInteractiveText(card.footer),
    options,
  };
};

const getInteractiveCard = (message) => {
  if (!message || message.fromMe) return null;

  const parsedDataJson = parseDataJson(message.dataJson);

  // WuzAPI serializa o protobuf do Go com casing/oneof que não bate com o
  // formato do Baileys, então o backend já entrega o card normalizado aqui.
  const prebuilt = normalizePrebuiltInteractiveCard(parsedDataJson?.__interactiveCard);
  if (prebuilt) return prebuilt;

  const payload = findInteractivePayload(parsedDataJson);
  if (!payload) return null;

  const options = [];
  let title = "";
  let body = "";
  let footer = "";

  if (payload.buttonsMessage) {
    const item = payload.buttonsMessage;
    title = firstInteractiveText(item.title, item.headerType === 1 ? item.contentText : "");
    body = firstInteractiveText(item.contentText);
    footer = firstInteractiveText(item.footerText);
    (item.buttons || []).forEach((button) => {
      const label = firstInteractiveText(button?.buttonText?.displayText, button?.displayText);
      const id = firstInteractiveText(button?.buttonId, button?.id, label);
      if (label) options.push({ id, label, description: "" });
    });
  } else if (payload.listMessage) {
    const item = payload.listMessage;
    title = firstInteractiveText(item.title);
    body = firstInteractiveText(item.description);
    footer = firstInteractiveText(item.footerText);
    (item.sections || []).forEach((section) => {
      (section?.rows || []).forEach((row) => {
        const label = firstInteractiveText(row?.title);
        const id = firstInteractiveText(row?.rowId, row?.id, label);
        if (label) options.push({
          id,
          label,
          description: firstInteractiveText(section?.title, row?.description),
        });
      });
    });
  } else {
    const item = payload.interactiveMessage || payload.interactive;
    title = firstInteractiveText(item?.header?.title, item?.header?.text);
    body = firstInteractiveText(item?.body?.text, item?.body);
    footer = firstInteractiveText(item?.footer?.text, item?.footer);

    (item?.action?.buttons || []).forEach((button) => {
      const reply = button?.reply || button;
      const label = firstInteractiveText(reply?.title, button?.title);
      const id = firstInteractiveText(reply?.id, button?.id, label);
      if (label) options.push({ id, label, description: "" });
    });

    (item?.action?.sections || []).forEach((section) => {
      (section?.rows || []).forEach((row) => {
        const label = firstInteractiveText(row?.title);
        const id = firstInteractiveText(row?.id, label);
        if (label) options.push({
          id,
          label,
          description: firstInteractiveText(section?.title, row?.description),
        });
      });
    });

    (item?.nativeFlowMessage?.buttons || []).forEach((button) => {
      const params = parseInteractiveParams(button);
      const label = firstInteractiveText(
        params?.display_text,
        params?.displayText,
        params?.title,
        params?.button_text,
      );
      const id = firstInteractiveText(params?.id, params?.reply?.id, label);
      if (label) options.push({ id, label, description: "" });

      (params?.sections || []).forEach((section) => {
        (section?.rows || []).forEach((row) => {
          const rowLabel = firstInteractiveText(row?.title);
          const rowId = firstInteractiveText(row?.id, rowLabel);
          if (rowLabel) options.push({
            id: rowId,
            label: rowLabel,
            description: firstInteractiveText(section?.title, row?.description),
          });
        });
      });
    });
  }

  const uniqueOptions = options.filter((option, index, all) =>
    option.id && all.findIndex(candidate => candidate.id === option.id) === index
  );

  if (!uniqueOptions.length) return null;
  return { title, body, footer, options: uniqueOptions };
};

const getInternalSenderName = (message) => {
  if (!message?.fromMe) return "";

  if (message?.dataJson && typeof message.dataJson === "string") {
    try {
      const parsedDataJson = JSON.parse(message.dataJson);
      if (parsedDataJson?.__sentByUserName) {
        return parsedDataJson.__sentByUserName;
      }
    } catch (error) {
      // Mantém fallback atual quando dataJson não estiver em formato JSON válido.
    }
  }

  if (message?.ticket?.user?.name) {
    return message.ticket.user.name;
  }

  return "";
};

const renderInternalSenderHeader = (classes, message) => {
  const senderName = getInternalSenderName(message);

  if (!senderName) return null;

  return (
    <span className={classes.internalSenderHeader}>
      <PersonOutline className={classes.internalSenderIcon} />
      {senderName}
    </span>
  );
};

const isScheduledMessage = (message) => {
  const dataJson = message?.dataJson;
  if (!dataJson || typeof dataJson !== "string") return false;
  return dataJson.includes('"__isScheduled":true');
};

// Mensagens automáticas de sistema (ex.: "Atendimento assumido por X."), que devem
// aparecer como um aviso centralizado no chat, e não como um balão de mensagem.
const isSystemNoticeMessage = (message) => {
  const dataJson = message?.dataJson;
  if (!dataJson || typeof dataJson !== "string") return false;
  return dataJson.includes('"__isSystemNotice":true');
};

const isReactionMessage = (message) => message?.mediaType === "reactionMessage";

const buildReactionsByTarget = (allMessages = []) => {
  const reactionsMap = new Map();

  allMessages.forEach((msg) => {
    if (!isReactionMessage(msg)) return;
    const targetId = msg?.quotedMsg?.id;
    const emoji = String(msg?.body || "").trim();
    if (!targetId || !emoji) return;

    const current = reactionsMap.get(targetId) || {
      total: 0,
      byEmoji: new Map()
    };

    current.total += 1;
    current.byEmoji.set(emoji, (current.byEmoji.get(emoji) || 0) + 1);
    reactionsMap.set(targetId, current);
  });

  return reactionsMap;
};

const renderReactionBadge = (message, reactionsByTarget) => {
  const reactionData = reactionsByTarget.get(message?.id);
  if (!reactionData) return null;

  const topEmojis = Array.from(reactionData.byEmoji.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([emoji]) => emoji)
    .join(" ");

  return (
    <span
      className={clsx(classes.reactionBadge, {
        [classes.reactionBadgeRight]: message.fromMe,
        [classes.reactionBadgeLeft]: !message.fromMe,
      })}
    >
      <span className={classes.reactionEmojis}>{topEmojis}</span>
      {reactionData.total > 1 && (
        <span className={classes.reactionCount}>{reactionData.total}</span>
      )}
    </span>
  );
};

const renderMessages = () => {

  if (messagesList.length > 0) {
    const reactionsByTarget = buildReactionsByTarget(messagesList);
    const visibleMessages = messagesList.filter((message) => {
      if (!isReactionMessage(message)) return true;
      return !message?.quotedMsg?.id;
    });

    const imageGroupStarts = new Map();
    const imageGroupSkips = new Set();

    for (let i = 0; i < visibleMessages.length; i += 1) {
      const current = visibleMessages[i];
      if (!canGroupImageMessage(current) || imageGroupSkips.has(current.id)) continue;
      const group = [current];
      let j = i + 1;
      while (j < visibleMessages.length) {
        const next = visibleMessages[j];
        if (!canGroupImageMessage(next)) break;
        if (Boolean(next.fromMe) !== Boolean(current.fromMe)) break;
        group.push(next);
        j += 1;
      }
      if (group.length >= 2) {
        imageGroupStarts.set(current.id, group);
        group.slice(1).forEach((m) => imageGroupSkips.add(m.id));
      }
    }

    const viewMessagesList = visibleMessages.map((message, index) => {
      if (imageGroupSkips.has(message.id)) return null;

      const imageGroup = imageGroupStarts.get(message.id) || null;
      if (imageGroup) {
        const firstMessage = imageGroup[0];
        const lastMessage = imageGroup[imageGroup.length - 1];

        const groupedBubbleClass = firstMessage.fromMe
          ? (isScheduledMessage(firstMessage)
            ? classes.messageRightScheduled
            : (firstMessage.isPrivate ? classes.messageRightPrivate : classes.messageRight))
          : classes.messageLeft;

        return (
          <React.Fragment key={`image-group-${firstMessage.id}`}>
            {renderDailyTimestamps(firstMessage, index, visibleMessages)}
            {renderTicketsSeparator(firstMessage, index, visibleMessages)}
            {renderMessageDivider(firstMessage, index, visibleMessages)}
            <div
              className={groupedBubbleClass}
              title={firstMessage.queueId && firstMessage.queue?.name}
              onDoubleClick={(e) => hanldeReplyMessage(e, firstMessage)}
            >
              {showSelectMessageCheckbox && (
                <SelectMessageCheckbox message={firstMessage} />
              )}
              <IconButton
                variant="contained"
                size="small"
                id="messageActionsButton"
                disabled={firstMessage.isDeleted}
                className={classes.messageActionsButton}
                onClick={(e) => handleOpenMessageOptionsMenu(e, firstMessage)}
              >
                <ExpandMore />
              </IconButton>
              {!firstMessage.fromMe && isGroup && (
                <span className={classes.messageContactName}>
                  {firstMessage.contact?.name}
                </span>
              )}
              {firstMessage.fromMe && renderInternalSenderHeader(classes, firstMessage)}
              {renderImageGroupGrid(imageGroup)}
              <div className={classes.textContentItem}>
                <span className={classes.timestamp}>
                  {lastMessage.isEdited ? "Editada " + format(parseISO(lastMessage.createdAt), "HH:mm") : format(parseISO(lastMessage.createdAt), "HH:mm")}
                  {lastMessage.fromMe && renderMessageAck(lastMessage)}
                </span>
              </div>
            </div>
          </React.Fragment>
        );
      }

      if (isSystemNoticeMessage(message)) {
        return (
          <React.Fragment key={message.id}>
            {renderDailyTimestamps(message, index, visibleMessages)}
            {renderTicketsSeparator(message, index, visibleMessages)}
            {renderMessageDivider(message, index, visibleMessages)}
            <div className={classes.messageCenter}>
              <span>{message.body} {format(parseISO(message.createdAt), "HH:mm")}</span>
            </div>
          </React.Fragment>
        );
      }

      if (message.mediaType === "call_log") {
        return (
          <React.Fragment key={message.id}>
            {renderDailyTimestamps(message, index, visibleMessages)}
            {renderTicketsSeparator(message, index, visibleMessages)}
            {renderMessageDivider(message, index, visibleMessages)}
            <div className={classes.messageCenter}>
              <IconButton
                variant="contained"
                size="small"
                id="messageActionsButton"
                disabled={message.isDeleted}
                className={classes.messageActionsButton}
                onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
              >
                <ExpandMore />
              </IconButton>
              {isGroup && (
                <span className={classes.messageContactName}>
                  {message.contact?.name}
                </span>
              )}

              {/* {isGroup && (
                  <span className={classes.messageContactName}>
                    {JSON.parse(message.dataJson).pushName} #{message.contact?.name}
                  </span>
                )} */}
              <div>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 17" width="20" height="17">
                  <path fill="#df3333" d="M18.2 12.1c-1.5-1.8-5-2.7-8.2-2.7s-6.7 1-8.2 2.7c-.7.8-.3 2.3.2 2.8.2.2.3.3.5.3 1.4 0 3.6-.7 3.6-.7.5-.2.8-.5.8-1v-1.3c.7-1.2 5.4-1.2 6.4-.1l.1.1v1.3c0 .2.1.4.2.6.1.2.3.3.5.4 0 0 2.2.7 3.6.7.2 0 1.4-2 .5-3.1zM5.4 3.2l4.7 4.6 5.8-5.7-.9-.8L10.1 6 6.4 2.3h2.5V1H4.1v4.8h1.3V3.2z"></path>
                </svg> <span>{i18n.t("ticketsList.missedCall")} {format(parseISO(message.createdAt), "HH:mm")}</span>
              </div>
            </div>
          </React.Fragment>
        );
      }

      if (!message.fromMe) {
        return (
          <React.Fragment key={message.id}>
            {renderDailyTimestamps(message, index, visibleMessages)}
            {renderTicketsSeparator(message, index, visibleMessages)}
            {renderMessageDivider(message, index, visibleMessages)}
            <div
              className={classes.messageLeft}
              title={message.queueId && message.queue?.name}
              onDoubleClick={(e) => hanldeReplyMessage(e, message)}
            >
              {showSelectMessageCheckbox && (
                <SelectMessageCheckbox
                  // showSelectMessageCheckbox={showSelectMessageCheckbox}
                  message={message}
                // selectedMessagesList={selectedMessagesList}
                // setSelectedMessagesList={setSelectedMessagesList}
                />
              )}
              <IconButton
                variant="contained"
                size="small"
                id="messageActionsButton"
                disabled={message.isDeleted}
                className={classes.messageActionsButton}
                onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
              >
                <ExpandMore />
              </IconButton>

              {message.isForwarded && (
                <div>
                  <span className={classes.forwardMessage}
                  ><Reply style={{ transform: 'scaleX(-1)' }} /> Encaminhada
                  </span>
                  <br />
                </div>
              )}
              {isGroup && (
                <span className={classes.messageContactName}>
                  {message.contact?.name}
                </span>
              )}
              {isYouTubeLink(message.body) && (
                <>
                  <YouTubePreview videoUrl={message.body} />
                </>
              )}
              {/* {isGroup && (
                  <span className={classes.messageContactName}>
                    {JSON.parse(message.dataJson).pushName} #{message.contact?.name}
                  </span>
                )} */}

              {/* aviso de mensagem apagado pelo contato */}

              {!lgpdDeleteMessage && message.isDeleted && (
                <div>
                  <span className={classes.deletedMessage}
                  >🚫 Essa mensagem foi apagada pelo contato &nbsp;
                  </span>
                </div>
              )}

              {(message.mediaUrl || message.mediaType === "locationMessage" || message.mediaType === "location" || message.mediaType === "contactMessage" || message.mediaType === "template" || message.mediaType === "adMetaPreview" || isPollMessage(message) || isEventMessage(message) || isPixCardMessage(message) // Adicionado para aceitar o componente de preview de anúncio
                //|| message.mediaType === "multi_vcard" 
              ) && renderMediaSafely(message)}
              {renderInlineTranscription(message)}

              <div className={clsx(classes.textContentItem, {
                [classes.textContentItemDeleted]: message.isDeleted,
              })}>
                {message.quotedMsg && renderQuotedMessage(message)}
                {renderInteractiveCard(message)}
                {shouldRenderMessageBody(message) && !getInteractiveCard(message) && (
                  <>
                    {xmlRegex.test(message.body) && (
                      <span>{message.body}</span>
                    )}
                    {!xmlRegex.test(message.body) && (
                      <MarkdownWrapper>{(lgpdDeleteMessage && message.isDeleted) ? "🚫 _Mensagem apagada_ " : message.body}</MarkdownWrapper>
                    )}
                  </>
                )}


                {message.quotedMsg && message.mediaType === "reactionMessage" && (
                  <>
                    <span style={{ marginLeft: "0px" }}>
                      <MarkdownWrapper>
                        {"" + message?.contact?.name + " reagiu... " + message.body}
                      </MarkdownWrapper>
                    </span>
                  </>
                )}

                <span className={classes.timestamp}>
                  {message.isEdited ? "Editada " + format(parseISO(message.createdAt), "HH:mm") : format(parseISO(message.createdAt), "HH:mm")}
                </span>
              </div>
              {renderReactionBadge(message, reactionsByTarget)}
            </div>
          </React.Fragment>
        );
      } else {
        return (
          <React.Fragment key={message.id}>
            {renderDailyTimestamps(message, index, visibleMessages)}
            {renderTicketsSeparator(message, index, visibleMessages)}
            {renderMessageDivider(message, index, visibleMessages)}
            <div
              className={
                isScheduledMessage(message)
                  ? classes.messageRightScheduled
                  : (message.isPrivate ? classes.messageRightPrivate : classes.messageRight)
              }
              title={message.queueId && message.queue?.name}
              onDoubleClick={(e) => hanldeReplyMessage(e, message)}
            >
              {showSelectMessageCheckbox && (
                <SelectMessageCheckbox
                  // showSelectMessageCheckbox={showSelectMessageCheckbox}
                  message={message}
                // selectedMessagesList={selectedMessagesList}
                // setSelectedMessagesList={setSelectedMessagesList}
                />
              )}

              <IconButton
                variant="contained"
                size="small"
                id="messageActionsButton"
                disabled={message.isDeleted}
                className={classes.messageActionsButton}
                onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
              >
                <ExpandMore />
              </IconButton>
              {message.isForwarded && (
                <div>
                  <span className={classes.forwardMessage}
                  ><Reply style={{ transform: 'scaleX(-1)' }} /> Encaminhada
                  </span>
                  <br />
                </div>
              )}
              {renderInternalSenderHeader(classes, message)}
              {isYouTubeLink(message.body) && (
                <>
                  <YouTubePreview videoUrl={message.body} />
                </>
              )}
              {!lgpdDeleteMessage && message.isDeleted && (
                <div>
                  <span className={classes.deletedMessage}
                  >🚫 Essa mensagem foi apagada &nbsp;
                  </span>
                </div>
              )}
              {(message.mediaUrl || message.mediaType === "locationMessage" || message.mediaType === "location" || message.mediaType === "contactMessage" || message.mediaType === "template" || message.mediaType === "adMetaPreview" || isPollMessage(message) || isEventMessage(message) || isPixCardMessage(message) // Adicionado para aceitar o componente de preview de anúncio
                //|| message.mediaType === "multi_vcard" 
              ) && renderMediaSafely(message)}
              {renderInlineTranscription(message)}
              <div
                className={clsx(classes.textContentItem, {
                  [classes.textContentItemDeleted]: message.isDeleted,
                })}
              >

                {/* {message.isDeleted && (`🚫`)} */}



                {message.quotedMsg && renderQuotedMessage(message)}

                {renderInteractiveCard(message)}
                {shouldRenderMessageBody(message) && !getInteractiveCard(message) && (
                  <>
                    {xmlRegex.test(message.body) && (
                      <div>{formatXml(message.body)}</div>
                    )}
                    {!xmlRegex.test(message.body) && (<MarkdownWrapper>{message.body}</MarkdownWrapper>)}
                  </>
                )}

                {message.quotedMsg && message.mediaType === "reactionMessage" && (
                  <>
                    <span style={{ marginLeft: "0px" }}>
                      <MarkdownWrapper>
                        {"Você reagiu... " + message.body}
                      </MarkdownWrapper>
                    </span>
                  </>
                )}

                <span className={classes.timestamp}>
                  {message.isEdited ? "Editada " + format(parseISO(message.createdAt), "HH:mm") : format(parseISO(message.createdAt), "HH:mm")}
                  {renderMessageAck(message)}
                </span>
              </div>
              {renderReactionBadge(message, reactionsByTarget)}
            </div>
          </React.Fragment>
        );
      }
    });
    return viewMessagesList;
  } else {
    return <div>Diga olá para seu novo contato!</div>;
  }
};

return (
  <div className={classes.messagesListWrapper} onDragEnter={handleDrag}>
    {dragActive && <div className={classes.dragElement} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>Solte o arquivo aqui</div>}

    <MessageOptionsMenu
      message={selectedMessage}
      anchorEl={anchorEl}
      menuOpen={messageOptionsMenuOpen}
      handleClose={handleCloseMessageOptionsMenu}
      onAudioTranscription={handleAudioTranscription}
      isGroup={isGroup}
      whatsappId={whatsappId}
      queueId={queueId}
    />
    <div
      id="messagesList"
      className={classes.messagesList}
      onScroll={handleScroll}
    >
      {messagesList.length > 0 ?
        renderMessages()
        : []}
    </div>

    <Dialog
      open={galleryOpen}
      onClose={closeImageGallery}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Imagem {galleryIndex + 1} de {galleryImages.length}
      </DialogTitle>
      <DialogContent>
        <div
          className={classes.lightboxContent}
          ref={galleryContainerRef}
          onTouchStart={handleGalleryTouchStart}
          onTouchEnd={handleGalleryTouchEnd}
        >
          {galleryImages.length > 1 && (
            <IconButton
              className={`${classes.lightboxNavButton} ${classes.lightboxNavLeft}`}
              onClick={goToPreviousImage}
            >
              <ChevronLeft />
            </IconButton>
          )}

          {galleryImages[galleryIndex]?.url && (
            <img
              className={classes.lightboxImage}
              src={galleryImages[galleryIndex].url}
              alt={`gallery-${galleryIndex + 1}`}
              style={{ transform: `rotate(${galleryRotation}deg)` }}
            />
          )}

          {galleryImages.length > 1 && (
            <IconButton
              className={`${classes.lightboxNavButton} ${classes.lightboxNavRight}`}
              onClick={goToNextImage}
            >
              <ChevronRight />
            </IconButton>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={downloadGalleryImage}
          startIcon={<DownloadIcon />}
          color="primary"
        >
          Download
        </Button>
        <Button
          onClick={openGalleryImageInFullScreen}
          startIcon={<CropFree />}
          color="primary"
        >
          Tela cheia
        </Button>
        <Button
          onClick={rotateGalleryImage}
          startIcon={<RotateRight />}
          color="primary"
        >
          Girar
        </Button>
        <Button onClick={closeImageGallery} color="primary">
          Fechar
        </Button>
      </DialogActions>
    </Dialog>

    {(channel !== "whatsapp" && channel !== "webchat" && channel !== undefined) && (
      <div className={classes.channelWarning}>
        {channel === "facebook" ? <Facebook /> : channel === "whatsapp_oficial" ? <WhatsApp /> : <Instagram />}
        <span>
          Você tem 24h para responder após receber uma mensagem, de acordo
          com as políticas do Facebook.
        </span>
      </div>
    )}
    <Dialog
      open={pdfPreview.open}
      onClose={handleClosePdfPreview}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle disableTypography>
        <div className={classes.pdfDialogTitle}>
          <span className={classes.pdfDialogName}>{pdfPreview.name}</span>
          <IconButton size="small" onClick={handleClosePdfPreview}>
            <Close fontSize="small" />
          </IconButton>
        </div>
      </DialogTitle>
      <DialogContent dividers>
        <div className={classes.pdfIframeWrap}>
          {pdfPreview.href ? (
            <iframe
              title={pdfPreview.name || "Visualização PDF"}
              src={pdfPreview.href}
              className={classes.pdfIframe}
            />
          ) : null}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClosePdfPreview} color="default">
          Fechar
        </Button>
        <Button
          component="a"
          href={pdfPreview.href}
          target="_blank"
          rel="noreferrer"
          color="primary"
          startIcon={<OpenInNew />}
        >
          Abrir em nova aba
        </Button>
        <Button
          component="a"
          href={pdfPreview.href}
          color="primary"
          startIcon={<GetApp />}
          download={pdfPreview.name}
        >
          Baixar
        </Button>
      </DialogActions>
    </Dialog>
    {loading && (
      <div>
        <CircularProgress className={classes.circleLoading} />
      </div>
    )}
  </div>
);
};

export default MessagesList;
