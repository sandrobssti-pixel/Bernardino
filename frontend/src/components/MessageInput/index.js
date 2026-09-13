import React, { useState, useEffect, useContext, useRef } from "react";
import "emoji-mart/css/emoji-mart.css";
import { NimblePicker } from "emoji-mart";
import emojiData from "emoji-mart/data/all.json";
import { useMediaQuery, useTheme } from '@material-ui/core';
import { isNil } from "lodash";
import {
  Box,
  CircularProgress,
  ClickAwayListener,
  IconButton,
  InputBase,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  TextField,
  makeStyles,
  Paper,
  Hidden,
  Menu,
  MenuItem,
  Tooltip,
} from "@material-ui/core";
import {
  green,
  grey,
} from "@material-ui/core/colors";
import {
  AttachFile,
  CheckCircleOutline,
  Clear,
  Comment,
  Create,
  Description,
  HighlightOff,
  Mic,
  Mood,
  MoreVert,
  Send,
  PermMedia,
  Person,
  Room,
  Reply,
  Duo,
  Timer,
  KeyboardArrowDown,
  AlternateEmail,
  EmojiEmotions,
} from "@material-ui/icons";
import AddIcon from "@material-ui/icons/Add";
import BoltIcon from '@mui/icons-material/FlashOn';
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { CameraAlt } from "@material-ui/icons";
import MicRecorder from "mic-recorder-to-mp3";
import clsx from "clsx";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import RecordingTimer from "./RecordingTimer";

import useQuickMessages from "../../hooks/useQuickMessages";
import { isString, isEmpty } from "lodash";
import ContactSendModal from "../ContactSendModal";
import CameraModal from "../CameraModal";
import axios from "axios";
import { toast } from "react-toastify";
import ButtonModal from "../ButtonModal";
import MenuIcon from '@material-ui/icons/Menu';
import useCompanySettings from "../../hooks/useSettings/companySettings";
import { ForwardMessageContext } from "../../context/ForwarMessage/ForwardMessageContext";
import MessageUploadMedias from "../MessageUploadMedias";
import { EditMessageContext } from "../../context/EditingMessage/EditingMessageContext";
import ScheduleModal from "../ScheduleModal";
import LocationModal from "../LocationModal";


const Mp3Recorder = new MicRecorder({ bitRate: 192 });

const PT_EMOJI_KEYWORDS = {
  car: ["carro", "automovel", "veiculo"],
  blue_car: ["carro", "automovel", "veiculo"],
  taxi: ["taxi", "carro", "veiculo"],
  racing_car: ["carro", "corrida", "veiculo"],
  bus: ["onibus", "busao", "coletivo"],
  trolleybus: ["onibus", "coletivo"],
  minibus: ["onibus", "van"],
  truck: ["caminhao", "veiculo"],
  motorcycle: ["moto", "motocicleta"],
  bike: ["bicicleta", "bike"],
  airplane: ["aviao", "aeronave"],
  rocket: ["foguete"],
  ship: ["navio", "barco"],
  boat: ["barco", "lancha"],
  train: ["trem"],
  metro: ["metro"],
  ambulance: ["ambulancia"],
  police_car: ["viatura", "policia"],
  fire_engine: ["bombeiro", "caminhao"],
  "red_apple": ["maca", "fruta"],
  pear: ["pera", "fruta"],
  banana: ["banana", "fruta"],
  grapes: ["uva", "fruta"],
  strawberry: ["morango", "fruta"],
  carrot: ["cenoura", "legume"],
  broccoli: ["brocolis", "legume"],
  pizza: ["pizza"],
  hamburger: ["hamburguer", "lanche"],
  fries: ["batata", "frita"],
  coffee: ["cafe"],
  beer: ["cerveja"],
  wine_glass: ["vinho"],
  "soccer": ["futebol", "bola"],
  basketball: ["basquete", "bola"],
  volleyball: ["volei", "bola"],
  tennis: ["tenis", "bola"],
  football: ["futebol", "bola"],
  trophy: ["trofeu", "premio"],
  medal_sports: ["medalha"],
  phone: ["telefone", "celular"],
  iphone: ["celular", "telefone"],
  computer: ["computador", "pc"],
  laptop: ["notebook", "laptop", "computador"],
  tv: ["televisao", "tv"],
  camera: ["camera", "foto"],
  lock: ["cadeado", "seguranca"],
  key: ["chave"],
  house: ["casa", "lar"],
  office: ["escritorio", "predio"],
  hospital: ["hospital"],
  school: ["escola"],
  church: ["igreja"],
  moneybag: ["dinheiro", "grana"],
  credit_card: ["cartao", "credito"],
  "heart": ["coracao", "amor"],
  broken_heart: ["coracao", "triste"],
  smile: ["sorriso", "feliz"],
  laughing: ["rindo", "risada"],
  joy: ["alegria", "feliz"],
  cry: ["choro", "triste"],
  sob: ["chorando", "triste"],
  angry: ["raiva", "bravo"],
  rage: ["raiva", "irritado"],
  thumbs_up: ["legal", "joia", "positivo"],
  "+1": ["legal", "joia", "positivo"],
  "-1": ["negativo", "ruim"],
  clap: ["palmas"],
  pray: ["oracao", "reza"],
  wave: ["tchau", "aceno", "ola"],
  warning: ["alerta", "atencao"],
  no_entry: ["proibido"],
  checkered_flag: ["bandeira"],
  brazil: ["brasil", "bandeira"],
  us: ["estados unidos", "eua"],
};

const PT_EMOJI_ALIASES = {
  carro: "car",
  automovel: "car",
  veiculo: "car",
  caminhao: "truck",
  onibus: "bus",
  moto: "motorcycle",
  bicicleta: "bike",
  aviao: "airplane",
  barco: "boat",
  navio: "ship",
  trem: "train",
  celular: "iphone",
  telefone: "phone",
  computador: "computer",
  casa: "house",
  dinheiro: "moneybag",
  coracao: "heart",
  sorriso: "smile",
  triste: "cry",
  alegria: "joy",
  cenoura: "carrot",
};

const buildEmojiDataWithPtKeywords = () => {
  const clonedData = JSON.parse(JSON.stringify(emojiData));

  Object.entries(PT_EMOJI_KEYWORDS).forEach(([emojiId, ptKeywords]) => {
    const emoji = clonedData?.emojis?.[emojiId];
    if (!emoji) return;
    const existingKeywords = Array.isArray(emoji.j)
      ? emoji.j
      : emoji.j
        ? [emoji.j]
        : [];
    emoji.j = Array.from(new Set([...existingKeywords, ...ptKeywords]));
  });

  Object.entries(PT_EMOJI_ALIASES).forEach(([aliasId, baseEmojiId]) => {
    if (clonedData?.emojis?.[aliasId]) return;
    const baseEmoji = clonedData?.emojis?.[baseEmojiId];
    if (!baseEmoji) return;

    const aliasEmoji = JSON.parse(JSON.stringify(baseEmoji));
    const existingShortNames = Array.isArray(aliasEmoji.n) ? aliasEmoji.n : [];
    aliasEmoji.n = [aliasId, ...existingShortNames.filter((name) => name !== aliasId)];
    clonedData.emojis[aliasId] = aliasEmoji;
  });

  return clonedData;
};

const emojiDataWithPtKeywords = buildEmojiDataWithPtKeywords();

const useStyles = makeStyles((theme) => ({
  mainWrapper: {
    background: theme.mode === "light" ? "#f8fafc" : "rgba(15,23,42,0.95)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flexShrink: 0,
    borderTop: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.2)" : "rgba(148,163,184,0.15)"}`,
    padding: "8px 12px",
    [theme.breakpoints.down("sm")]: {
      position: "sticky",
      bottom: 0,
      zIndex: 2,
      paddingBottom: "max(env(safe-area-inset-bottom), 4px)",
    },
  },
  avatar: {
    width: "50px",
    height: "50px",
    borderRadius: "25%",
  },
  dropInfo: {
    background: theme.mode === "light" ? "#f1f5f9" : "rgba(30,41,59,0.8)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    padding: 15,
    left: 0,
    right: 0,
  },
  dropInfoOut: {
    display: "none",
  },
  gridFiles: {
    maxHeight: "100%",
    overflow: "scroll",
  },
  newMessageBox: {
    background: theme.palette.background.default,
    width: "100%",
    display: "flex",
    padding: "7px",
    alignItems: "center",
    gap: 8,
  },
  messageInputWrapper: {
    padding: "4px 8px",
    background: theme.mode === "light" ? "#ffffff" : "rgba(30,41,59,0.8)",
    display: "flex",
    borderRadius: 12,
    flex: 1,
    position: "relative",
    border: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.25)" : "rgba(148,163,184,0.2)"}`,
    boxShadow: theme.mode === "light" ? "0 1px 3px rgba(0,0,0,0.05)" : "0 1px 3px rgba(0,0,0,0.15)",
    transition: "all 0.2s ease",
    "&:focus-within": {
      borderColor: theme.mode === "light" ? "rgba(99,102,241,0.4)" : "rgba(99,102,241,0.5)",
      boxShadow: theme.mode === "light" ? "0 0 0 3px rgba(99,102,241,0.1)" : "0 0 0 3px rgba(99,102,241,0.15)",
    },
  },
  messageInputWrapperPrivate: {
    padding: "4px 8px",
    marginRight: 8,
    background: "#fef3c7",
    display: "flex",
    borderRadius: 12,
    flex: 1,
    position: "relative",
    border: "1px solid rgba(245,158,11,0.3)",
    boxShadow: "0 1px 3px rgba(245,158,11,0.1)",
  },
  messageInput: {
    paddingLeft: 10,
    flex: 1,
    border: "none",

  },
  messageInputPrivate: {
    paddingLeft: 10,
    flex: 1,
    border: "none",
    color: grey[800],

  },
  sendMessageIcons: {
    color: grey[600],
    fontSize: 22,
  },
  ForwardMessageIcons: {
    color: grey[600],
    transform: 'scaleX(-1)',
    fontSize: 22,
  },
  actionIconButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.3)" : "rgba(148,163,184,0.22)"}`,
    color: theme.mode === "light" ? "#64748b" : "#94a3b8",
    transition: "all 0.15s ease",
    "&:hover": {
      background: theme.mode === "light" ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.15)",
      borderColor: theme.mode === "light" ? "rgba(99,102,241,0.35)" : "rgba(99,102,241,0.4)",
      color: theme.mode === "light" ? "#6366f1" : "#818cf8",
    },
    "&.Mui-disabled": {
      borderColor: theme.mode === "light" ? "rgba(148,163,184,0.16)" : "rgba(148,163,184,0.1)",
    },
  },
  actionIconButtonActive: {
    background: theme.mode === "light" ? "rgba(99,102,241,0.14)" : "rgba(99,102,241,0.25)",
    borderColor: theme.mode === "light" ? "rgba(99,102,241,0.5)" : "rgba(129,140,248,0.5)",
    color: theme.mode === "light" ? "#4f46e5" : "#a5b4fc",
    "&:hover": {
      background: theme.mode === "light" ? "rgba(99,102,241,0.18)" : "rgba(99,102,241,0.3)",
      borderColor: theme.mode === "light" ? "rgba(99,102,241,0.5)" : "rgba(129,140,248,0.5)",
    },
  },
  sendIconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: theme.mode === "light"
      ? "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
      : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
    color: "#fff",
    boxShadow: theme.mode === "light" ? "0 2px 8px rgba(99,102,241,0.35)" : "0 2px 8px rgba(99,102,241,0.25)",
    transition: "all 0.15s ease",
    "&:hover": {
      background: theme.mode === "light"
        ? "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)"
        : "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
      transform: "translateY(-1px)",
      boxShadow: theme.mode === "light" ? "0 4px 12px rgba(99,102,241,0.45)" : "0 4px 12px rgba(99,102,241,0.35)",
    },
  },
  micIconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: theme.mode === "light" ? "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)" : "linear-gradient(135deg, #475569 0%, #334155 100%)",
    color: "#fff",
    boxShadow: theme.mode === "light" ? "0 2px 8px rgba(100,116,139,0.3)" : "0 2px 8px rgba(0,0,0,0.3)",
    transition: "all 0.15s ease",
    "&:hover": {
      background: theme.mode === "light" ? "linear-gradient(135deg, #64748b 0%, #475569 100%)" : "linear-gradient(135deg, #334155 0%, #1e293b 100%)",
      transform: "translateY(-1px)",
      boxShadow: theme.mode === "light" ? "0 4px 12px rgba(100,116,139,0.4)" : "0 4px 12px rgba(0,0,0,0.4)",
    },
    "&.Mui-disabled": {
      color: "#fff",
      opacity: 1,
      background: theme.mode === "light"
        ? "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)"
        : "linear-gradient(135deg, #475569 0%, #334155 100%)",
    },
  },
  uploadInput: {
    display: "none",
  },
  viewMediaInputWrapper: {
    maxHeight: "100%",
    display: "flex",
    padding: "10px 13px",
    position: "relative",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.mode === "light" ? "#ffffff" : "rgba(15,23,42,0.95)",
    borderTop: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.2)" : "rgba(148,163,184,0.15)"}`,
  },
  emojiBox: {
    position: "absolute",
    bottom: "calc(100% + 8px)",
    left: 0,
    width: 480,
    borderRadius: 16,
    border: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.28)" : "rgba(148,163,184,0.38)"}`,
    background:
      theme.mode === "light"
        ? "linear-gradient(165deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)"
        : "linear-gradient(165deg, rgba(30,41,59,0.98) 0%, rgba(15,23,42,0.98) 100%)",
    boxShadow:
      theme.mode === "light"
        ? "0 18px 36px rgba(15,23,42,0.18)"
        : "0 20px 40px rgba(0,0,0,0.5)",
    backdropFilter: "blur(6px)",
    overflow: "hidden",
    zIndex: 80,
    animation: "$quickAnswersReveal 0.18s ease-out",
  },
  emojiHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 10px",
    borderBottom: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.22)" : "rgba(148,163,184,0.3)"}`,
    background:
      theme.mode === "light"
        ? "rgba(255,255,255,0.75)"
        : "rgba(15,23,42,0.68)",
  },
  emojiHeaderTitle: {
    fontSize: "0.74rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
    color: theme.mode === "light" ? "#0f172a" : "#e2e8f0",
  },
  emojiCloseButton: {
    width: 24,
    height: 24,
    borderRadius: 8,
    color: theme.mode === "light" ? "#334155" : "#cbd5e1",
    background: theme.mode === "light" ? "rgba(15,23,42,0.05)" : "rgba(148,163,184,0.18)",
    "&:hover": {
      background: theme.mode === "light" ? "rgba(15,23,42,0.12)" : "rgba(148,163,184,0.28)",
    },
  },
  emojiPickerWrap: {
    "& .emoji-mart": {
      width: "100% !important",
      border: "0 !important",
      background: "transparent !important",
    },
    "& .emoji-mart-scroll": {
      maxHeight: "260px !important",
    },
  },
  circleLoading: {
    color: green[500],
    opacity: "70%",
    position: "absolute",
    top: "20%",
    left: "50%",
    marginLeft: -12,
  },
  audioLoading: {
    color: green[500],
    opacity: "70%",
  },
  recorderWrapper: {
    display: "flex",
    alignItems: "center",
    alignContent: "middle",
  },
  cancelAudioIcon: {
    color: "red",
  },
  sendAudioIcon: {
    color: "green",
  },
  replyginMsgWrapper: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingLeft: 73,
    paddingRight: 7,
    backgroundColor: theme.palette.optionsBackground,
  },
  replyginMsgContainer: {
    flex: 1,
    marginRight: 5,
    overflowY: "hidden",
    backgroundColor: theme.mode === "light" ? "#f1f5f9" : "rgba(30,41,59,0.8)",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },
  replyginMsgBody: {
    padding: 10,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
  },
  replyginContactMsgSideColor: {
    flex: "none",
    width: "4px",
    backgroundColor: "#35cd96",
  },
  replyginSelfMsgSideColor: {
    flex: "none",
    width: "4px",
    backgroundColor: "#6bcbef",
  },
  messageContactName: {
    display: "flex",
    color: "#6bcbef",
    fontWeight: 500,
  },
  messageQuickAnswersWrapper: {
    margin: 0,
    position: "absolute",
    bottom: "54px",
    background:
      theme.mode === "light"
        ? "linear-gradient(165deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)"
        : "linear-gradient(165deg, rgba(30,41,59,0.96) 0%, rgba(15,23,42,0.96) 100%)",
    padding: 4,
    border: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.26)" : "rgba(148,163,184,0.36)"}`,
    borderRadius: 14,
    boxShadow:
      theme.mode === "light"
        ? "0 14px 30px rgba(15,23,42,0.16)"
        : "0 16px 30px rgba(0,0,0,0.45)",
    backdropFilter: "blur(6px)",
    left: 0,
    width: "100%",
    zIndex: 30,
    maxHeight: 290,
    overflowY: "auto",
    ...theme.scrollbarStyles,
    animation: "$quickAnswersReveal 0.18s ease-out",
    "& li": {
      listStyle: "none",
    },
  },
  "@keyframes quickAnswersReveal": {
    "0%": {
      opacity: 0,
      transform: "translateY(6px)",
    },
    "100%": {
      opacity: 1,
      transform: "translateY(0)",
    },
  },
  messageQuickAnswersWrapperItem: {
    borderBottom: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.22)" : "rgba(148,163,184,0.32)"}`,
    "&:last-child": {
      borderBottom: "none",
    },
  },
  messageQuickAnswerLink: {
    display: "block",
    padding: "9px 11px",
    cursor: "pointer",
    textDecoration: "none",
    borderRadius: 10,
    transition: "all .16s ease",
    "&:hover": {
      background:
        theme.mode === "light"
          ? "linear-gradient(145deg, rgba(37,99,235,0.12), rgba(14,165,233,0.08))"
          : "linear-gradient(145deg, rgba(59,130,246,0.2), rgba(14,165,233,0.12))",
    },
  },
  messageQuickAnswerShortcut: {
    display: "block",
    fontWeight: 700,
    fontSize: "0.81rem",
    color: theme.mode === "light" ? "#0f172a" : "#f1f5f9",
    lineHeight: 1.25,
    marginBottom: 3,
  },
  messageQuickAnswerPreview: {
    display: "block",
    fontSize: "0.73rem",
    color: theme.mode === "light" ? grey[600] : "#9ca3af",
    lineHeight: 1.3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  invertedFabMenu: {
    border: "none",
    borderRadius: 50, // Define o raio da borda para 0 para remover qualquer borda
    boxShadow: "none", // Remove a sombra
    padding: theme.spacing(1),
    backgroundColor: "transparent",
    color: "grey",
    "&:hover": {
      backgroundColor: "transparent",
    },
    "&:disabled": {
      backgroundColor: "transparent !important",
    },
  },
  attachMenuPaper: {
    marginTop: -8,
    minWidth: 200,
    borderRadius: 14,
    padding: 4,
    border: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.28)" : "rgba(148,163,184,0.38)"}`,
    background:
      theme.mode === "light"
        ? "linear-gradient(165deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)"
        : "linear-gradient(165deg, rgba(30,41,59,0.98) 0%, rgba(15,23,42,0.98) 100%)",
    boxShadow:
      theme.mode === "light"
        ? "0 18px 36px rgba(15,23,42,0.18)"
        : "0 20px 40px rgba(0,0,0,0.5)",
    backdropFilter: "blur(6px)",
  },
  attachMenuList: {
    padding: 0,
  },
  attachMenuItem: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "5px 7px",
    borderRadius: 8,
    minHeight: "auto",
    transition: "all .16s ease",
    "&:hover": {
      background: theme.mode === "light" ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.16)",
    },
    "& label": {
      display: "flex",
      alignItems: "center",
      gap: 9,
      width: "100%",
      cursor: "pointer",
    },
  },
  attachMenuIcon: {
    width: 26,
    height: 26,
    minWidth: 26,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    boxShadow: "0 2px 6px rgba(15,23,42,0.18)",
    "& svg": {
      fontSize: 14,
    },
  },
  attachMenuLabel: {
    fontSize: "0.76rem",
    fontWeight: 600,
    color: theme.mode === "light" ? "#0f172a" : "#e2e8f0",
  },
  attachMenuIconMedia: {
    background: "linear-gradient(135deg, #818cf8, #4f46e5)",
  },
  attachMenuIconCamera: {
    background: "linear-gradient(135deg, #f9a8d4, #ec4899)",
  },
  attachMenuIconDoc: {
    background: "linear-gradient(135deg, #c4b5fd, #7c3aed)",
  },
  attachMenuIconSticker: {
    background: "linear-gradient(135deg, #fcd34d, #f59e0b)",
  },
  attachMenuIconContact: {
    background: "linear-gradient(135deg, #7dd3fc, #0ea5e9)",
  },
  attachMenuIconLocation: {
    background: "linear-gradient(135deg, #6ee7b7, #10b981)",
  },
  attachMenuIconMeet: {
    background: "linear-gradient(135deg, #86efac, #22c55e)",
  },
  attachMenuIconButtons: {
    background: "linear-gradient(135deg, #cbd5e1, #64748b)",
  },
  flexContainer: {
    display: "flex",
    flex: 1,
    flexDirection: "column",
  },
  flexItem: {
    flex: 1,
  },
}));

const MessageInput = ({
  ticketId,
  ticketStatus,
  droppedFiles,
  contactId,
  ticketChannel,
  ticketIsGroup = false,
  disableAutoFocus = false
}) => {

  const classes = useStyles();
  const theme = useTheme();
  const [mediasUpload, setMediasUpload] = useState([]);
  const isMounted = useRef(true);
  const [buttonModalOpen, setButtonModalOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [aiImproving, setAiImproving] = useState(false);
  const [aiReplyFeatureEnabled, setAiReplyFeatureEnabled] = useState(false);
  const [quickAnswers, setQuickAnswer] = useState([]);
  const [typeBar, setTypeBar] = useState(false);
  const inputRef = useRef();
  const [onDragEnter, setOnDragEnter] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const { setReplyingMessage, replyingMessage } = useContext(ReplyMessageContext);
  const { setEditingMessage, editingMessage } = useContext(EditMessageContext);
  const { user } = useContext(AuthContext);
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [officialTemplatesLoading, setOfficialTemplatesLoading] = useState(false);
  const [officialTemplatesSending, setOfficialTemplatesSending] = useState(false);
  const [officialTemplates, setOfficialTemplates] = useState([]);
  const [selectedTemplateIdMeta, setSelectedTemplateIdMeta] = useState("");
  const [templateVariables, setTemplateVariables] = useState([]);
  const [templateHeaderVariables, setTemplateHeaderVariables] = useState([]);
  const [templateHeaderMediaFile, setTemplateHeaderMediaFile] = useState(null);

  const [signMessagePar, setSignMessagePar] = useState(false);
  const { get: getSetting } = useCompanySettings();
  const [signMessage, setSignMessage] = useState(true);
  const [privateMessage, setPrivateMessage] = useState(false);
  const [hiddenMentionAll, setHiddenMentionAll] = useState(false);
  const [privateMessageInputVisible, setPrivateMessageInputVisible] = useState(false);
  const [senVcardModalOpen, setSenVcardModalOpen] = useState(false);
  const [showModalMedias, setShowModalMedias] = useState(false);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const useNativeRecorderRef = useRef(false);

  const { list: listQuickMessages } = useQuickMessages();


  const isMobile = useMediaQuery('(max-width: 767px)'); // Ajuste o valor conforme necessário
  const [placeholderText, setPlaceHolderText] = useState("");

  // Determine o texto do placeholder com base no ticketStatus e dispositivo
  useEffect(() => {
    if (isMobile) {
      setPlaceHolderText(
        ticketStatus === "open" || ticketStatus === "group"
          ? "Mensagem..."
          : "Ticket fechado..."
      );
      return;
    }
    if (ticketStatus === "open" || ticketStatus === "group") {
      setPlaceHolderText(i18n.t("messagesInput.placeholderOpen"));
    } else {
      setPlaceHolderText(i18n.t("messagesInput.placeholderClosed"));
    }
  }, [ticketStatus, isMobile])

  const {
    selectedMessages,
    setForwardMessageModalOpen,
    showSelectMessageCheckbox } = useContext(ForwardMessageContext);

  const isOfficialTicket = String(ticketChannel || "").toLowerCase() === "whatsapp_oficial";
  const canUseHiddenMentionAll =
    String(ticketChannel || "").toLowerCase() === "whatsapp" && ticketIsGroup === true;
  const isHiddenMentionAllActive =
    canUseHiddenMentionAll && hiddenMentionAll && !privateMessage;

  useEffect(() => {
    if (droppedFiles && droppedFiles.length > 0) {
      const selectedMedias = Array.from(droppedFiles);
      setMediasUpload(selectedMedias);
      setShowModalMedias(true);
    }
  }, [droppedFiles]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!disableAutoFocus && inputRef.current) {
      inputRef.current.focus();
    }
    if (editingMessage) {
      setInputMessage(editingMessage.body);
    }
  }, [replyingMessage, editingMessage, disableAutoFocus]);

  useEffect(() => {
    if (!disableAutoFocus && inputRef.current) {
      inputRef.current.focus();
    }
    return () => {
      setInputMessage("");
      setShowEmoji(false);
      setMediasUpload([]);
      setReplyingMessage(null);
      //setSignMessage(true);
      setPrivateMessage(false);
      setPrivateMessageInputVisible(false)
      setEditingMessage(null);
    };
  }, [ticketId, setReplyingMessage, setEditingMessage, disableAutoFocus]);

  useEffect(() => {
    if (!disableAutoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disableAutoFocus]);

  useEffect(() => {
    setTimeout(() => {
      if (isMounted.current)
        setOnDragEnter(false);
    }, 1000);
    // eslint-disable-next-line
  }, [onDragEnter === true]);

  //permitir ativar/desativar firma
  useEffect(() => {
    const fetchSettings = async () => {
      const setting = await getSetting({
        "column": "sendSignMessage"
      });

      if (isMounted.current) {
        if (setting.sendSignMessage === "enabled") {
          setSignMessagePar(true);
          const signMessageStorage = JSON.parse(
            localStorage.getItem("persistentSignMessage")
          );
          if (isNil(signMessageStorage)) {
            setSignMessage(true)
          } else {
            setSignMessage(signMessageStorage);
          }
        } else {
          setSignMessagePar(false);
        }
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const fetchAiReplySetting = async () => {
      const setting = await getSetting({ column: "aiReplyEnabled" });
      if (isMounted.current) {
        setAiReplyFeatureEnabled(setting.aiReplyEnabled === "enabled");
      }
    };
    fetchAiReplySetting();
  }, []);

  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  const handleSendLinkVideo = async () => {
    const link = `https://meet.jit.si/${ticketId}`;
    setInputMessage(link);
  }

  const handleChangeInput = (e) => {
    setInputMessage(e.target.value);
  };

  const handlePrivateMessage = (e) => {
    setPrivateMessage(!privateMessage);
    setPrivateMessageInputVisible(!privateMessageInputVisible);
    if (!privateMessage) {
      setHiddenMentionAll(false);
    }
  };

  const handleButtonModalOpen = () => {
    handleMenuItemClick();
    setButtonModalOpen(true); // Define o estado como true para abrir o modal
  };

  const handleQuickAnswersClick = async (value) => {
    if (value.mediaPath) {
      try {
        const { data } = await axios.get(value.mediaPath, {
          responseType: "blob",
        });

        handleUploadQuickMessageMedia(data, value.value);
        setInputMessage("");
        return;
        //  handleChangeMedias(response)
      } catch (err) {
        toastError(err);
      }
    }

    setInputMessage("");
    setInputMessage(value.value);
    setTypeBar(false);
  };

  const handleAddEmoji = (e) => {
    let emoji = e.native;
    setInputMessage((prevState) => prevState + emoji);
  };

  const [modalCameraOpen, setModalCameraOpen] = useState(false);

  const handleCapture = (imageData) => {
    if (imageData) {
      handleUploadCamera(imageData);
    }
  };

  const handleChangeMedias = (e) => {
    if (!e.target.files) {
      return;
    }
    const selectedMedias = Array.from(e.target.files);
    setMediasUpload(selectedMedias);
    setShowModalMedias(true);
  };

  const handleChangeSticker = async (e) => {
    if (!e.target.files || !e.target.files[0]) {
      return;
    }
    const file = e.target.files[0];
    e.target.value = null;
    setLoading(true);

    const formData = new FormData();
    formData.append("fromMe", true);
    formData.append("isPrivate", "false");
    formData.append("isSticker", "true");
    formData.append("body", "");
    formData.append("medias", file);
    formData.append("hiddenMentionAll", "false");

    try {
      await api.post(`/messages/${ticketId}`, formData);
    } catch (err) {
      toastError(err);
    }

    setLoading(false);
  };

  const handleChangeSign = (e) => {
    getStatusSingMessageLocalstogare();
  };

  const handleOpenModalForward = () => {
    if (selectedMessages.length === 0) {
      setForwardMessageModalOpen(false)
      toastError(i18n.t("messagesList.header.notMessage"));
      return;
    }
    setForwardMessageModalOpen(true);
  }

  const getStatusSingMessageLocalstogare = () => {
    const signMessageStorage = JSON.parse(
      localStorage.getItem("persistentSignMessage")
    );
    //si existe uma chave "sendSingMessage"
    if (signMessageStorage !== null) {
      if (signMessageStorage) {
        localStorage.setItem("persistentSignMessage", false);
        setSignMessage(false);
      } else {
        localStorage.setItem("persistentSignMessage", true);
        setSignMessage(true);
      }
    } else {
      localStorage.setItem("persistentSignMessage", false);
      setSignMessage(false);
    }
  };

  const handleInputPaste = (e) => {
    if (e.clipboardData.files[0]) {
      const selectedMedias = Array.from(e.clipboardData.files);
      setMediasUpload(selectedMedias);
      setShowModalMedias(true);
    }
  };

  const handleInputDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) {
      const selectedMedias = Array.from(e.dataTransfer.files);
      setMediasUpload(selectedMedias);
      setShowModalMedias(true);
    }
  };

  const handleUploadMedia = async (mediasUpload) => {
    setLoading(true);
    // e.preventDefault();

    // Certifique-se de que a variável medias esteja preenchida antes de continuar
    if (!mediasUpload.length) {
      console.log("Nenhuma mídia selecionada.");
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("fromMe", true);
    formData.append("isPrivate", privateMessage ? "true" : "false");
    mediasUpload.forEach((media) => {
      formData.append("body", media.caption);
      formData.append("medias", media.file);
    });
    formData.append(
      "hiddenMentionAll",
      canUseHiddenMentionAll && hiddenMentionAll && !privateMessage ? "true" : "false"
    );

    try {
      await api.post(`/messages/${ticketId}`, formData);
    } catch (err) {
      toastError(err);
    }

    setLoading(false);
    setMediasUpload([]);
    setShowModalMedias(false);
    setHiddenMentionAll(false);
    setPrivateMessage(false);
    setPrivateMessageInputVisible(false)
  };

  const handleSendContatcMessage = async (vcard) => {
    setSenVcardModalOpen(false);
    setLoading(true);

    if (isNil(vcard)) {
      setLoading(false);
      return;
    }

    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: null,
      quotedMsg: replyingMessage,
      isPrivate: privateMessage ? "true" : "false",
      hiddenMentionAll:
        canUseHiddenMentionAll && hiddenMentionAll && !privateMessage ? "true" : "false",
      vCard: vcard,
    };
    try {
      await api.post(`/messages/${ticketId}`, message);
    } catch (err) {
      toastError(err);
    }

    setInputMessage("");
    setShowEmoji(false);
    setLoading(false);
    setReplyingMessage(null);
    setEditingMessage(null);
    setHiddenMentionAll(false);
    setPrivateMessage(false);
    setPrivateMessageInputVisible(false);
  };

  const focusMessageInput = () => {
    if (disableAutoFocus || !inputRef.current) return;
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleSendMessage = async () => {
    if (loading || inputMessage.trim() === "") return;
    setLoading(true);

    const userName = privateMessage
      ? `${user.name} - Mensagem Privada`
      : user.name;

    const sendMessage = inputMessage.trim();

    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: (signMessage || privateMessage) && !editingMessage
        ? `*${userName}:*\n${sendMessage}`
        : sendMessage,
      quotedMsg: replyingMessage,
      isPrivate: privateMessage ? "true" : "false",
      hiddenMentionAll:
        canUseHiddenMentionAll && hiddenMentionAll && !privateMessage ? "true" : "false",
    };

    try {
      if (editingMessage !== null) {
        await api.post(`/messages/edit/${editingMessage.id}`, message);
      } else {
        await api.post(`/messages/${ticketId}`, message);
      }
    } catch (err) {
      toastError(err);
    }

    setInputMessage("");
    setShowEmoji(false);
    setLoading(false);
    setReplyingMessage(null);
    setHiddenMentionAll(false);
    setPrivateMessage(false);
    setEditingMessage(null);
    setPrivateMessageInputVisible(false)
    handleMenuItemClick();
    focusMessageInput();
  };

  const handleImproveMessageWithAI = async () => {
    const originalText = String(inputMessage || "");
    const trimmedText = originalText.trim();

    if (!trimmedText || aiImproving || loading) return;

    setAiImproving(true);
    try {
      const { data } = await api.post(`/messages/ai-improve/${ticketId}`, {
        text: trimmedText
      });

      const improvedText = String(data?.improvedText || "").trim();
      if (!improvedText) {
        toast.warn("A IA não retornou sugestão. O texto original foi mantido.");
        return;
      }

      setInputMessage(improvedText);
      focusMessageInput();
      toast.success("Texto melhorado com IA.");
    } catch (err) {
      toast.warn("Não foi possível melhorar com IA agora. O texto original foi mantido.");
    } finally {
      setAiImproving(false);
    }
  };

  const handleStartRecording = async () => {
    setLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });

      const canUseNativeRecorder =
        typeof window !== "undefined" &&
        typeof window.MediaRecorder !== "undefined";

      if (canUseNativeRecorder) {
        const preferredMimeTypes = [
          "audio/mp4;codecs=mp4a.40.2",
          "audio/mp4",
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/ogg;codecs=opus",
        ];

        const mimeType = preferredMimeTypes.find((type) =>
          window.MediaRecorder.isTypeSupported(type)
        );

        const options = mimeType
          ? { mimeType, audioBitsPerSecond: 192000 }
          : { audioBitsPerSecond: 192000 };

        const recorder = new window.MediaRecorder(stream, options);
        audioChunksRef.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.start(250);
        mediaRecorderRef.current = recorder;
        mediaStreamRef.current = stream;
        useNativeRecorderRef.current = true;
      } else {
        stream.getTracks().forEach((track) => track.stop());
        await Mp3Recorder.start();
        useNativeRecorderRef.current = false;
      }

      setRecording(true);
      setLoading(false);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const messages = await listQuickMessages({ companyId, userId: user.id });
      const options = messages.map((m) => {
        let truncatedMessage = m.message;
        if (isString(truncatedMessage) && truncatedMessage.length > 90) {
          truncatedMessage = m.message.substring(0, 90) + "...";
        }
        return {
          value: m.message,
          label: `/${m.shortcode}`,
          preview: truncatedMessage,
          shortcode: m.shortcode,
          mediaPath: m.mediaPath,
        };
      });
      if (isMounted.current) {

        setQuickAnswer(options);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      isString(inputMessage) &&
      !isEmpty(inputMessage) &&
      inputMessage.length >= 1
    ) {
      const firstWord = inputMessage.charAt(0);

      if (firstWord === "/") {
        setTypeBar(firstWord.indexOf("/") > -1);

        const filteredOptions = quickAnswers.filter((m) => {
          const search = inputMessage.toLowerCase();
          return (
            m.label.toLowerCase().indexOf(search) > -1 ||
            (m.preview || "").toLowerCase().indexOf(search) > -1
          );
        });
        setTypeBar(filteredOptions);
      } else {
        setTypeBar(false);
      }
    } else {
      setTypeBar(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMessage]);

  const disableOption = () => {
    return (
      loading ||
      recording ||
      (ticketStatus !== "open" && ticketStatus !== "group")
    );
  };

  const disableTextInputOption = () => {
    return (
      recording ||
      (ticketStatus !== "open" && ticketStatus !== "group")
    );
  };

  const emojiPickerI18n = {
    search: "Buscar",
    notfound: "Nenhum emoji encontrado",
    clear: "Limpar",
    skintext: "Escolha o tom de pele padrão",
    categories: {
      search: "Resultados da busca",
      recent: "Usados recentemente",
      people: "Carinhas e pessoas",
      nature: "Animais e natureza",
      foods: "Comidas e bebidas",
      activity: "Atividades",
      places: "Viagens e lugares",
      objects: "Objetos",
      symbols: "Símbolos",
      flags: "Bandeiras",
      custom: "Personalizados",
    },
  };

  const handleUploadCamera = async (blob) => {
    setLoading(true);
    try {
      const formData = new FormData();
      const filename = `${new Date().getTime()}.png`;
      formData.append("medias", blob, filename);
      formData.append("body", privateMessage ? `\u200d` : "");
      formData.append("fromMe", true);
      formData.append(
        "hiddenMentionAll",
        canUseHiddenMentionAll && hiddenMentionAll && !privateMessage ? "true" : "false"
      );

      await api.post(`/messages/${ticketId}`, formData);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
    setLoading(false);
    setHiddenMentionAll(false);
  };

  const handleUploadQuickMessageMedia = async (blob, message) => {
    setLoading(true);
    try {
      const extension = blob.type.split("/")[1];

      const formData = new FormData();
      const filename = `${new Date().getTime()}.${extension}`;
      formData.append("medias", blob, filename);
      formData.append("body", privateMessage ? `\u200d${message}` : message);
      formData.append("fromMe", true);
      formData.append(
        "hiddenMentionAll",
        canUseHiddenMentionAll && hiddenMentionAll && !privateMessage ? "true" : "false"
      );

      if (isMounted.current) {
        await api.post(`/messages/${ticketId}`, formData);
      }
    } catch (err) {
      toastError(err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setHiddenMentionAll(false);
      }
    }
  };


  const handleUploadAudio = async () => {

    setLoading(true);
    try {
      let blob;

      if (useNativeRecorderRef.current && mediaRecorderRef.current) {
        const recorder = mediaRecorderRef.current;

        blob = await new Promise((resolve, reject) => {
          recorder.onerror = (event) => reject(event?.error || new Error("Audio recording failed"));
          recorder.onstop = () => {
            const mimeType = recorder.mimeType || "audio/webm";
            resolve(new Blob(audioChunksRef.current, { type: mimeType }));
          };
          recorder.stop();
        });
      } else {
        const mp3Result = await Mp3Recorder.stop().getMp3();
        blob = mp3Result[1];
      }

      if (blob.size < 10000) {
        setLoading(false);
        setRecording(false);
        return;
      }

      const formData = new FormData();
      const mimeType = blob.type || "";
      const extension =
        mimeType.includes("mp4") || mimeType.includes("aac")
          ? "m4a"
          : mimeType.includes("ogg") || mimeType.includes("opus")
            ? "ogg"
            : mimeType.includes("webm")
              ? "webm"
              : ticketChannel === "whatsapp"
                ? "mp3"
                : "m4a";

      const filename = `${new Date().getTime()}.${extension}`;
      formData.append("medias", blob, filename);
      formData.append("body", filename);
      formData.append("fromMe", true);
      formData.append(
        "hiddenMentionAll",
        canUseHiddenMentionAll && hiddenMentionAll && !privateMessage ? "true" : "false"
      );

      if (isMounted.current) {
        await api.post(`/messages/${ticketId}`, formData);
      }
    } catch (err) {
      toastError(err);
    } finally {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      useNativeRecorderRef.current = false;

      if (isMounted.current) {
        setLoading(false);
        setRecording(false);
        setHiddenMentionAll(false);
      }
    }
  };

  const handleCloseModalMedias = () => {
    setShowModalMedias(false);
  };
  const handleCancelAudio = async () => {
    try {
      if (useNativeRecorderRef.current && mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } else {
        await Mp3Recorder.stop().getMp3();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      useNativeRecorderRef.current = false;
      setRecording(false);
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuItemClick = (event) => {
    setAnchorEl(null);
  };

  const handleSendContactModalOpen = async () => {
    handleMenuItemClick();
    setSenVcardModalOpen(true);
  };

  const handleSendLocation = () => {
    handleMenuItemClick();

    if (ticketChannel !== "whatsapp" || privateMessage) {
      return;
    }

    setLocationModalOpen(true);
  };

  const handleSendLocationMessage = async locationData => {
    setLoading(true);
    try {
      const message = {
        read: 1,
        fromMe: true,
        body: "",
        quotedMsg: replyingMessage,
        isPrivate: privateMessage ? "true" : "false",
        hiddenMentionAll:
          canUseHiddenMentionAll && hiddenMentionAll && !privateMessage ? "true" : "false",
        location: locationData
      };

      await api.post(`/messages/${ticketId}`, message);
      setInputMessage("");
      setShowEmoji(false);
      setReplyingMessage(null);
      setEditingMessage(null);
      setHiddenMentionAll(false);
      setPrivateMessage(false);
      setPrivateMessageInputVisible(false);
    } finally {
      setLoading(false);
      setLocationModalOpen(false);
    }
  };

  const MEDIA_HEADER_FORMATS = ["IMAGE", "VIDEO", "DOCUMENT"];

  const getTemplateComponent = (components = [], targetType) =>
    (components || []).find(
      component => String(component?.type || "").toUpperCase() === String(targetType).toUpperCase()
    );

  const getTemplateHeaderFormat = (components = []) => {
    const header = getTemplateComponent(components, "HEADER");
    const format = String(header?.format || "").toUpperCase();
    return format || null;
  };

  const getPlaceholderMaxIndex = (components = [], targetType) => {
    const component = getTemplateComponent(components, targetType);
    const text = String(component?.text || "");
    const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)];
    if (!matches.length) return 0;

    return matches.reduce((max, match) => {
      const current = Number(match?.[1] || 0);
      return Number.isFinite(current) && current > max ? current : max;
    }, 0);
  };

  const getBodyPlaceholderMaxIndex = (components = []) =>
    getPlaceholderMaxIndex(components, "BODY");

  const resetTemplateFieldsForTemplate = (template) => {
    const components = template?.components || [];
    const headerFormat = getTemplateHeaderFormat(components);
    const isMediaHeader = MEDIA_HEADER_FORMATS.includes(headerFormat);
    const headerCount = isMediaHeader ? 0 : getPlaceholderMaxIndex(components, "HEADER");
    const bodyCount = getBodyPlaceholderMaxIndex(components);

    setTemplateHeaderVariables(Array.from({ length: headerCount }, () => ""));
    setTemplateVariables(Array.from({ length: bodyCount }, () => ""));
    setTemplateHeaderMediaFile(null);
  };

  const selectedTemplate = officialTemplates.find(
    template => String(template.templateIdMeta) === String(selectedTemplateIdMeta)
  );
  const selectedTemplateHeaderFormat = getTemplateHeaderFormat(selectedTemplate?.components || []);
  const selectedTemplateIsMediaHeader = MEDIA_HEADER_FORMATS.includes(selectedTemplateHeaderFormat);
  const mediaHeaderAccept =
    selectedTemplateHeaderFormat === "IMAGE"
      ? "image/*"
      : selectedTemplateHeaderFormat === "VIDEO"
      ? "video/*"
      : selectedTemplateHeaderFormat === "DOCUMENT"
      ? ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
      : undefined;

  const handleOpenTemplateModal = async () => {
    try {
      setTemplateModalOpen(true);
      setOfficialTemplatesLoading(true);
      const { data } = await api.get(`/messages/template-options/${ticketId}`);
      const templates = Array.isArray(data?.templates) ? data.templates : [];
      setOfficialTemplates(templates);
      if (templates.length > 0) {
        const firstTemplateIdMeta = String(templates[0].templateIdMeta || "");
        setSelectedTemplateIdMeta(firstTemplateIdMeta);
        resetTemplateFieldsForTemplate(templates[0]);
      } else {
        setSelectedTemplateIdMeta("");
        setTemplateVariables([]);
        setTemplateHeaderVariables([]);
        setTemplateHeaderMediaFile(null);
      }
    } catch (err) {
      toastError(err);
      setTemplateModalOpen(false);
    } finally {
      setOfficialTemplatesLoading(false);
    }
  };

  const handleTemplateSelectionChange = (event) => {
    const selectedIdMeta = String(event.target.value || "");
    setSelectedTemplateIdMeta(selectedIdMeta);

    const template = officialTemplates.find(
      item => String(item.templateIdMeta) === selectedIdMeta
    );
    resetTemplateFieldsForTemplate(template);
  };

  const handleTemplateVariableChange = (index, value) => {
    setTemplateVariables(prev => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const handleTemplateHeaderVariableChange = (index, value) => {
    setTemplateHeaderVariables(prev => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const handleTemplateHeaderMediaChange = (event) => {
    const file = event.target.files?.[0] || null;
    setTemplateHeaderMediaFile(file);
  };

  const handleCloseTemplateModal = () => {
    if (officialTemplatesSending) return;
    setTemplateModalOpen(false);
    setOfficialTemplates([]);
    setSelectedTemplateIdMeta("");
    setTemplateVariables([]);
    setTemplateHeaderVariables([]);
    setTemplateHeaderMediaFile(null);
  };

  const handleSendOfficialTemplate = async () => {
    if (!selectedTemplateIdMeta) {
      toastError("Selecione um template para enviar.");
      return;
    }

    if (selectedTemplateIsMediaHeader && !templateHeaderMediaFile) {
      toastError(`Selecione um arquivo de ${selectedTemplateHeaderFormat} para o header do template.`);
      return;
    }

    try {
      setOfficialTemplatesSending(true);
      const formData = new FormData();
      formData.append("templateIdMeta", selectedTemplateIdMeta);
      formData.append("languageCode", selectedTemplate?.language || "");
      formData.append(
        "headerVariables",
        JSON.stringify(templateHeaderVariables.map(item => String(item || "")))
      );
      formData.append(
        "bodyVariables",
        JSON.stringify(templateVariables.map(item => String(item || "")))
      );
      if (templateHeaderMediaFile) {
        formData.append("headerMedia", templateHeaderMediaFile);
      }

      await api.post(`/messages/template/${ticketId}`, formData);
      handleCloseTemplateModal();
    } catch (err) {
      toastError(err);
    } finally {
      setOfficialTemplatesSending(false);
    }
  };

  const handleCameraModalOpen = async () => {
    handleMenuItemClick();
    setModalCameraOpen(true);
  };

  const handleCancelSelection = () => {
    setMediasUpload([]);
    setShowModalMedias(false);
  };

  const renderReplyingMessage = (message) => {
    return (
      <div className={classes.replyginMsgWrapper}>
        <div className={classes.replyginMsgContainer}>
          <span
            className={clsx(classes.replyginContactMsgSideColor, {
              [classes.replyginSelfMsgSideColor]: !message.fromMe,
            })}
          ></span>
          {replyingMessage && (
            <div className={classes.replyginMsgBody}>
              {!message.fromMe && (
                <span className={classes.messageContactName}>
                  {message.contact?.name}
                </span>
              )}
              {message.body}
            </div>
          )
          }
        </div>
        <IconButton
          aria-label="showRecorder"
          component="span"
          disabled={disableOption()}
          onClick={() => {
            setReplyingMessage(null);
            setEditingMessage(null);
            setInputMessage("");
          }}
        >
          <Clear className={classes.sendMessageIcons} />
        </IconButton>
      </div>
    );
  };

  if (mediasUpload.length > 0) {
    return (

      <Paper
        elevation={0}
        square
        className={classes.viewMediaInputWrapper}
        onDragEnter={() => setOnDragEnter(true)}
        onDrop={(e) => handleInputDrop(e)}
      >
        {showModalMedias && (
          <MessageUploadMedias
            isOpen={showModalMedias}
            files={mediasUpload}
            onClose={handleCloseModalMedias}
            onSend={handleUploadMedia}
            onCancelSelection={handleCancelSelection}
          />
        )}

      </Paper>
    )
  }
  else {
    return (
      <>
        {modalCameraOpen && (
          <CameraModal
            isOpen={modalCameraOpen}
            onRequestClose={() => setModalCameraOpen(false)}
            onCapture={handleCapture}
          />
        )}
        {senVcardModalOpen && (
          <ContactSendModal
            modalOpen={senVcardModalOpen}
            onClose={(c) => {
              handleSendContatcMessage(c);
            }}
          />
        )}
        {locationModalOpen && (
          <LocationModal
            open={locationModalOpen}
            onClose={() => setLocationModalOpen(false)}
            onSubmit={handleSendLocationMessage}
            defaultAddress={inputMessage}
          />
        )}
        {templateModalOpen && (
          <Dialog
            open={templateModalOpen}
            onClose={handleCloseTemplateModal}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Enviar template (Meta)</DialogTitle>
            <DialogContent dividers>
              {officialTemplatesLoading ? (
                <CircularProgress size={24} />
              ) : officialTemplates.length === 0 ? (
                <p>Nenhum template sincronizado para esta conexão.</p>
              ) : (
                <>
                  <FormControl variant="outlined" margin="dense" fullWidth>
                    <InputLabel id="template-selection-label">Template</InputLabel>
                    <Select
                      native
                      labelId="template-selection-label"
                      value={selectedTemplateIdMeta}
                      onChange={handleTemplateSelectionChange}
                      label="Template"
                    >
                      {officialTemplates.map(template => (
                        <option key={template.id} value={template.templateIdMeta}>
                          {template.name} ({template.language}) [{template.status || "-"}]
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  {selectedTemplateIsMediaHeader && (
                    <Box mt={1} mb={1}>
                      <Button variant="outlined" component="label" fullWidth>
                        {templateHeaderMediaFile
                          ? templateHeaderMediaFile.name
                          : `Selecionar arquivo (${selectedTemplateHeaderFormat})`}
                        <input
                          type="file"
                          hidden
                          accept={mediaHeaderAccept}
                          onChange={handleTemplateHeaderMediaChange}
                        />
                      </Button>
                    </Box>
                  )}
                  {templateHeaderVariables.map((value, index) => (
                    <TextField
                      key={`template-header-variable-${index}`}
                      margin="dense"
                      variant="outlined"
                      fullWidth
                      label={`Header variável {{${index + 1}}}`}
                      value={value}
                      onChange={(event) =>
                        handleTemplateHeaderVariableChange(index, event.target.value)
                      }
                    />
                  ))}
                  {templateVariables.map((value, index) => (
                    <TextField
                      key={`template-variable-${index}`}
                      margin="dense"
                      variant="outlined"
                      fullWidth
                      label={`Variável {{${index + 1}}}`}
                      value={value}
                      onChange={(event) =>
                        handleTemplateVariableChange(index, event.target.value)
                      }
                    />
                  ))}
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button
                onClick={handleCloseTemplateModal}
                color="secondary"
                disabled={officialTemplatesSending}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSendOfficialTemplate}
                color="primary"
                variant="contained"
                disabled={
                  officialTemplatesSending ||
                  officialTemplatesLoading ||
                  officialTemplates.length === 0
                }
              >
                {officialTemplatesSending ? "Enviando..." : "Enviar template"}
              </Button>
            </DialogActions>
          </Dialog>
        )}
        <Paper
          elevation={0}
          className={classes.mainWrapper}
          onDragEnter={() => setOnDragEnter(true)}
          onDrop={(e) => handleInputDrop(e)}
        >
          {(replyingMessage && renderReplyingMessage(replyingMessage)) || (editingMessage && renderReplyingMessage(editingMessage))}
          <div className={classes.newMessageBox}>
            <Hidden only={["sm", "xs"]}>
              <Box style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
              <Tooltip title="Emojis">
                <IconButton
                  aria-label="emojiPicker"
                  component="span"
                  disabled={disableOption()}
                  onClick={(e) => setShowEmoji((prevState) => !prevState)}
                  className={classes.actionIconButton}
                  size="small"
                >
                  <Mood fontSize="small" />
                </IconButton>
              </Tooltip>
              {showEmoji ? (
                <div className={classes.emojiBox}>
                  <ClickAwayListener onClickAway={() => setShowEmoji(false)}>
                    <div>
                      <div className={classes.emojiHeader}>
                        <span className={classes.emojiHeaderTitle}>Emojis</span>
                        <IconButton
                          size="small"
                          aria-label="fechar emojis"
                          className={classes.emojiCloseButton}
                          onClick={() => setShowEmoji(false)}
                        >
                          <KeyboardArrowDown fontSize="small" />
                        </IconButton>
                      </div>
                      <div className={classes.emojiPickerWrap}>
                        <NimblePicker
                          data={emojiDataWithPtKeywords}
                          perLine={10}
                          theme={theme.mode === "light" ? "light" : "dark"}
                          i18n={emojiPickerI18n}
                          showPreview={false}
                          showSkinTones={false}
                          onSelect={handleAddEmoji}
                        />
                      </div>
                    </div>
                  </ClickAwayListener>
                </div>
              ) : null}

              <Tooltip title="Anexar arquivo">
                <IconButton
                  disabled={disableOption()}
                  aria-label="uploadMedias"
                  component="span"
                  className={classes.actionIconButton}
                  onClick={handleOpenMenuClick}
                  size="small"
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={anchorEl}
                keepMounted
                open={Boolean(anchorEl)}
                onClose={handleMenuItemClick}
                id="simple-menu"
                getContentAnchorEl={null}
                anchorOrigin={{ vertical: "top", horizontal: "left" }}
                transformOrigin={{ vertical: "bottom", horizontal: "left" }}
                PaperProps={{ className: classes.attachMenuPaper }}
                MenuListProps={{ className: classes.attachMenuList }}
              >
                <MenuItem className={classes.attachMenuItem} onClick={handleMenuItemClick}>
                  <input
                    multiple
                    type="file"
                    id="upload-img-button"
                    accept="image/*, video/*, audio/* "
                    // disabled={disableOption()}
                    className={classes.uploadInput}
                    onChange={handleChangeMedias}
                  />
                  <label htmlFor="upload-img-button">
                    <span className={clsx(classes.attachMenuIcon, classes.attachMenuIconMedia)}>
                      <PermMedia />
                    </span>
                    <span className={classes.attachMenuLabel}>
                      {i18n.t("messageInput.type.imageVideo")}
                    </span>
                  </label>
                </MenuItem>
                <MenuItem className={classes.attachMenuItem} onClick={handleCameraModalOpen}>
                  <span className={clsx(classes.attachMenuIcon, classes.attachMenuIconCamera)}>
                    <CameraAlt />
                  </span>
                  <span className={classes.attachMenuLabel}>
                    {i18n.t("messageInput.type.cam")}
                  </span>
                </MenuItem>
                <MenuItem className={classes.attachMenuItem} onClick={handleMenuItemClick}>
                  <input
                    multiple
                    type="file"
                    id="upload-doc-button"
                    accept="application/*, text/*"
                    // disabled={disableOption()}
                    className={classes.uploadInput}
                    onChange={handleChangeMedias}
                  />
                  <label htmlFor="upload-doc-button">
                    <span className={clsx(classes.attachMenuIcon, classes.attachMenuIconDoc)}>
                      <Description />
                    </span>
                    <span className={classes.attachMenuLabel}>Documento</span>
                  </label>
                </MenuItem>
                <MenuItem className={classes.attachMenuItem} onClick={handleMenuItemClick}>
                  <input
                    type="file"
                    id="upload-sticker-button"
                    accept="image/webp"
                    className={classes.uploadInput}
                    onChange={handleChangeSticker}
                  />
                  <label htmlFor="upload-sticker-button">
                    <span className={clsx(classes.attachMenuIcon, classes.attachMenuIconSticker)}>
                      <EmojiEmotions />
                    </span>
                    <span className={classes.attachMenuLabel}>Figurinha</span>
                  </label>
                </MenuItem>
                <MenuItem className={classes.attachMenuItem} onClick={handleSendContactModalOpen}>
                  <span className={clsx(classes.attachMenuIcon, classes.attachMenuIconContact)}>
                    <Person />
                  </span>
                  <span className={classes.attachMenuLabel}>
                    {i18n.t("messageInput.type.contact")}
                  </span>
                </MenuItem>
                <MenuItem
                  className={classes.attachMenuItem}
                  onClick={handleSendLocation}
                  disabled={
                    disableOption() ||
                    ticketChannel !== "whatsapp" ||
                    privateMessage
                  }
                >
                  <span className={clsx(classes.attachMenuIcon, classes.attachMenuIconLocation)}>
                    <Room />
                  </span>
                  <span className={classes.attachMenuLabel}>
                    {i18n.t("messageInput.type.location")}
                  </span>
                </MenuItem>
                <MenuItem className={classes.attachMenuItem} onClick={handleSendLinkVideo}>
                  <span className={clsx(classes.attachMenuIcon, classes.attachMenuIconMeet)}>
                    <Duo />
                  </span>
                  <span className={classes.attachMenuLabel}>
                    {i18n.t("messageInput.type.meet")}
                  </span>
                </MenuItem>
                {buttonModalOpen && (
          <ButtonModal
            modalOpen={buttonModalOpen}
            onClose={() => setButtonModalOpen(false)} // Função para fechar o modal
            ticketId={ticketId}
          />
        )}
                <MenuItem className={classes.attachMenuItem} onClick={handleButtonModalOpen}>
                  <span className={clsx(classes.attachMenuIcon, classes.attachMenuIconButtons)}>
                    <MenuIcon />
                  </span>
                  <span className={classes.attachMenuLabel}>Botões</span>
                </MenuItem>
              </Menu>
              {/* <IconButton
				  aria-label="upload"
				  component="span"
				  disabled={disableOption()}
				  onMouseOver={() => setOnDragEnter(true)}
				>
				  <AttachFile className={classes.sendMessageIcons} />
				</IconButton> */}

              {/* </label> */}
              {signMessagePar && (
                <Tooltip title={signMessage ? "Assinatura ativada" : i18n.t("messageInput.tooltip.signature")}>
                  <IconButton
                    aria-label="send-upload"
                    aria-pressed={signMessage}
                    component="span"
                    onClick={handleChangeSign}
                    className={clsx(classes.actionIconButton, signMessage && classes.actionIconButtonActive)}
                    size="small"
                  >
                    <Create fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={privateMessage ? "Mensagem privada ativada" : i18n.t("messageInput.tooltip.privateMessage")}>
                <IconButton
                  aria-label="send-upload"
                  aria-pressed={privateMessage}
                  component="span"
                  onClick={handlePrivateMessage}
                  className={clsx(classes.actionIconButton, privateMessage && classes.actionIconButtonActive)}
                  size="small"
                >
                  <Comment fontSize="small" />
                </IconButton>
              </Tooltip>
              {canUseHiddenMentionAll && (
                <Tooltip title={isHiddenMentionAllActive ? "Marcação oculta ativada" : "Marcar todos ocultamente"}>
                  <IconButton
                    aria-label="hidden-mention-all"
                    aria-pressed={isHiddenMentionAllActive}
                    component="span"
                    onClick={() => setHiddenMentionAll((prev) => !prev)}
                    className={clsx(
                      classes.actionIconButton,
                      isHiddenMentionAllActive && classes.actionIconButtonActive
                    )}
                    size="small"
                    disabled={privateMessage}
                  >
                    <AlternateEmail fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {/* <Tooltip title={i18n.t("messageInput.tooltip.meet")}>
                <IconButton
                  aria-label="send-upload"
                  component="span"
                  onClick={handleSendLinkVideo}
                >
                  <Duo style={{ color: "grey" }} />
                </IconButton>
              </Tooltip> */}
              </Box>
            </Hidden>
            <Hidden only={["md", "lg", "xl"]}>
              <IconButton
                aria-controls="simple-menu"
                aria-haspopup="true"
                onClick={handleOpenMenuClick}
              >
                <MoreVert></MoreVert>
              </IconButton>
              <Menu
                id="simple-menu"
                keepMounted
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuItemClick}
              >
                <MenuItem onClick={handleMenuItemClick}>
                  <IconButton
                    aria-label="emojiPicker"
                    component="span"
                    disabled={disableOption()}
                    onClick={(e) => setShowEmoji((prevState) => !prevState)}
                  >
                    <Mood className={classes.sendMessageIcons} />
                  </IconButton>
                </MenuItem>
                <MenuItem onClick={handleMenuItemClick}>
                  <input
                    multiple
                    type="file"
                    id="upload-button"
                    disabled={disableOption()}
                    className={classes.uploadInput}
                    onChange={handleChangeMedias}
                  />
                  <label htmlFor="upload-button">
                    <IconButton
                      aria-label="upload"
                      component="span"
                      disabled={disableOption()}
                    >
                      <AttachFile className={classes.sendMessageIcons} />
                    </IconButton>
                  </label>
                </MenuItem>
                <MenuItem onClick={handleSendLocation}>
                  <IconButton
                    aria-label="sendLocation"
                    component="span"
                    disabled={
                      disableOption() ||
                      ticketChannel !== "whatsapp" ||
                      privateMessage
                    }
                  >
                    <Room className={classes.sendMessageIcons} />
                  </IconButton>
                </MenuItem>
                {signMessagePar && (
                  <Tooltip title="Habilitar/Desabilitar Assinatura">
                    <IconButton
                      aria-label="send-upload"
                      component="span"
                      onClick={handleChangeSign}
                    >
                      {signMessage === true ? (
                        <Create style={{ color: theme.mode === "light" ? theme.palette.primary.main : "#EEE" }} />
                      ) : (
                        <Create style={{ color: "grey" }} />
                      )}
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Habilitar/Desabilitar Comentários">
                  <IconButton
                    aria-label="send-upload"
                    component="span"
                    onClick={handlePrivateMessage}
                  >
                    {privateMessage === true ? (
                      <Comment style={{ color: theme.mode === "light" ? theme.palette.primary.main : "#EEE" }} />
                    ) : (
                      <Comment style={{ color: "grey" }} />
                    )}
                  </IconButton>
                </Tooltip>
                {canUseHiddenMentionAll && (
                  <Tooltip title={isHiddenMentionAllActive ? "Marcação oculta ativada" : "Marcar todos ocultamente"}>
                    <IconButton
                      aria-label="hidden-mention-all"
                      aria-pressed={isHiddenMentionAllActive}
                      component="span"
                      onClick={() => setHiddenMentionAll((prev) => !prev)}
                      className={clsx(
                        isHiddenMentionAllActive && classes.actionIconButtonActive
                      )}
                      disabled={privateMessage}
                    >
                      <AlternateEmail
                        style={{
                          color: isHiddenMentionAllActive
                            ? theme.mode === "light"
                              ? "#4f46e5"
                              : "#c7d2fe"
                            : "grey"
                        }}
                      />
                    </IconButton>
                  </Tooltip>
                )}
                {/* Botões secundários no menu mobile */}
                <MenuItem onClick={() => { handleMenuItemClick(); setInputMessage('/'); }}>
                  <IconButton component="span" size="small">
                    <BoltIcon className={classes.sendMessageIcons} />
                  </IconButton>
                  {i18n.t("tickets.buttons.quickMessageFlash")}
                </MenuItem>
                {aiReplyFeatureEnabled && (
                  <MenuItem
                    onClick={() => { handleMenuItemClick(); handleImproveMessageWithAI(); }}
                    disabled={disableOption() || aiImproving || !String(inputMessage || "").trim()}
                  >
                    <IconButton component="span" size="small">
                      <AutoAwesomeIcon className={classes.sendMessageIcons} />
                    </IconButton>
                    Melhorar com IA
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => { handleMenuItemClick(); setAppointmentModalOpen(true); }}
                  disabled={loading}
                >
                  <IconButton component="span" size="small">
                    <Timer className={classes.sendMessageIcons} />
                  </IconButton>
                  {i18n.t("tickets.buttons.scredule")}
                </MenuItem>
              </Menu>
            </Hidden>
            <div className={classes.flexContainer}>
              {privateMessageInputVisible && (
                <div className={classes.flexItem}>
                  <div className={classes.messageInputWrapperPrivate}>
                    <InputBase
                      inputRef={(input) => {
                        input && (inputRef.current = input);
                      }}
                      inputProps={{
                        spellCheck: true,
                        lang: "pt-BR",
                      }}
                      className={classes.messageInputPrivate}
                      placeholder={
                        ticketStatus === "open" || ticketStatus === "group"
                          ? i18n.t("messagesInput.placeholderPrivateMessage")
                          : i18n.t("messagesInput.placeholderClosed")
                      }
                      multiline
                      maxRows={5}
                      value={inputMessage}
                      onChange={handleChangeInput}
                      disabled={disableTextInputOption()}
                      onFocus={() => {
                        setTimeout(() => {
                          const el = document.getElementById("messagesList");
                          if (el) el.scrollTop = el.scrollHeight;
                        }, 320);
                      }}
                      onPaste={(e) => {
                        (ticketStatus === "open" || ticketStatus === "group") &&
                          handleInputPaste(e);
                      }}
                      onKeyDown={(e) => {
                        if (loading || e.shiftKey || e.nativeEvent.isComposing) return;
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}

                    />
                    {typeBar ? (
                      <ul className={classes.messageQuickAnswersWrapper}>
                        {typeBar.map((value, index) => {
                          return (
                            <li
                              className={classes.messageQuickAnswersWrapperItem}
                              key={index}
                            >
                              {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                              <a
                                className={classes.messageQuickAnswerLink}
                                onClick={() => handleQuickAnswersClick(value)}
                              >
                                <span className={classes.messageQuickAnswerShortcut}>
                                  {value.label}
                                </span>
                                <span className={classes.messageQuickAnswerPreview}>
                                  {value.preview || value.value}
                                </span>
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div></div>
                    )}
                  </div>
                </div>
              )}
              {!privateMessageInputVisible && (
                <div className={classes.flexItem}>
                  <div className={classes.messageInputWrapper}>
                    <InputBase
                      inputRef={(input) => {
                        input && (inputRef.current = input);
                      }}
                      inputProps={{
                        spellCheck: true,
                        lang: "pt-BR",
                      }}
                      className={classes.messageInput}
                      placeholder={placeholderText}
                      multiline
                      maxRows={5}
                      value={inputMessage}
                      onChange={handleChangeInput}
                      disabled={disableTextInputOption()}
                      onFocus={() => {
                        setTimeout(() => {
                          const el = document.getElementById("messagesList");
                          if (el) el.scrollTop = el.scrollHeight;
                        }, 320);
                      }}
                      onPaste={(e) => {
                        (ticketStatus === "open" || ticketStatus === "group") &&
                          handleInputPaste(e);
                      }}
                      onKeyDown={(e) => {
                        if (loading || e.shiftKey || e.nativeEvent.isComposing) return;
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    {typeBar ? (
                      <ul className={classes.messageQuickAnswersWrapper}>
                        {typeBar.map((value, index) => {
                          return (
                            <li
                              className={classes.messageQuickAnswersWrapperItem}
                              key={index}
                            >
                              {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                              <a
                                className={classes.messageQuickAnswerLink}
                                onClick={() => handleQuickAnswersClick(value)}
                              >
                                <span className={classes.messageQuickAnswerShortcut}>
                                  {value.label}
                                </span>
                                <span className={classes.messageQuickAnswerPreview}>
                                  {value.preview || value.value}
                                </span>
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div></div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {!privateMessageInputVisible && (
              <>
                {/* Botões secundários: apenas no desktop (no mobile ficam no menu MoreVert) */}
                <Hidden only={["sm", "xs"]}>
                  <Tooltip title={i18n.t("tickets.buttons.quickMessageFlash")}>
                    <IconButton
                      aria-label={i18n.t("tickets.buttons.quickMessageFlash")}
                      component="span"
                      onClick={() => setInputMessage('/')}
                      className={classes.actionIconButton}
                      size="small"
                    >
                      <BoltIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {aiReplyFeatureEnabled && (
                    <Tooltip title={!String(inputMessage || "").trim() ? "Digite uma mensagem para melhorar com IA" : "Melhorar texto com IA"}>
                      <span>
                        <IconButton
                          aria-label="improveMessageWithAI"
                          onClick={handleImproveMessageWithAI}
                          disabled={disableOption() || aiImproving || !String(inputMessage || "").trim()}
                          className={classes.actionIconButton}
                          size="small"
                        >
                          {aiImproving ? <CircularProgress size={16} /> : <AutoAwesomeIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                  {isOfficialTicket && (
                    <Tooltip title="Enviar template (Meta)">
                      <IconButton
                        aria-label="send-template-meta"
                        component="span"
                        onClick={handleOpenTemplateModal}
                        disabled={loading || recording}
                        className={classes.actionIconButton}
                        size="small"
                      >
                        <Description fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title={i18n.t("tickets.buttons.scredule")}>
                    <IconButton
                      aria-label="scheduleMessage"
                      component="span"
                      onClick={() => setAppointmentModalOpen(true)}
                      disabled={loading}
                      className={classes.actionIconButton}
                      size="small"
                    >
                      <Timer fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Hidden>
                {inputMessage || showSelectMessageCheckbox ? (
                  <>
                    <Tooltip title={showSelectMessageCheckbox ? "Encaminhar mensagem" : "Enviar mensagem"}>
                      <IconButton
                        aria-label="sendMessage"
                        component="span"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={showSelectMessageCheckbox ? handleOpenModalForward : handleSendMessage}
                        disabled={loading}
                        className={classes.sendIconButton}
                        size="small"
                      >
                        {showSelectMessageCheckbox ?
                          <Reply fontSize="small" /> : <Send fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  </>
                ) : recording ? (
                  <div className={classes.recorderWrapper}>
                    <Tooltip title="Cancelar gravação">
                      <IconButton
                        aria-label="cancelRecording"
                        component="span"
                        fontSize="large"
                        disabled={loading}
                        onClick={handleCancelAudio}
                        className={classes.actionIconButton}
                        size="small"
                      >
                        <HighlightOff className={classes.cancelAudioIcon} />
                      </IconButton>
                    </Tooltip>
                    {loading ? (
                      <div>
                        <CircularProgress className={classes.audioLoading} />
                      </div>
                    ) : (
                      <RecordingTimer />
                    )}

                    <Tooltip title="Enviar áudio">
                      <IconButton
                        aria-label="sendRecordedAudio"
                        component="span"
                        onClick={handleUploadAudio}
                        disabled={loading}
                        className={classes.actionIconButton}
                        size="small"
                      >
                        <CheckCircleOutline className={classes.sendAudioIcon} />
                      </IconButton>
                    </Tooltip>
                  </div>
                ) : (
                  <Tooltip title="Gravar áudio">
                    <IconButton
                      aria-label="showRecorder"
                      component="span"
                      disabled={disableOption()}
                      onClick={handleStartRecording}
                      className={classes.micIconButton}
                      size="small"
                    >
                      <Mic fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </>
            )}

            {privateMessageInputVisible && (
              <>
                <Tooltip title={showSelectMessageCheckbox ? "Encaminhar mensagem" : "Enviar mensagem"}>
                  <IconButton
                    aria-label="sendMessage"
                    component="span"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={showSelectMessageCheckbox ? handleOpenModalForward : handleSendMessage}
                    disabled={loading}
                    className={classes.sendIconButton}
                    size="small"
                  >
                    {showSelectMessageCheckbox ?
                      <Reply fontSize="small" /> : <Send fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </>
            )}
            {appointmentModalOpen && (
              <ScheduleModal
                open={appointmentModalOpen}
                onClose={() => setAppointmentModalOpen(false)}
                message={inputMessage}
                contactId={contactId}
              />
            )}
          </div>
        </Paper>
      </>
    );
  }
};

export default MessageInput;
