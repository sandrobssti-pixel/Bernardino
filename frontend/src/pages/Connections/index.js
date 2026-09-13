import React, { useState, useCallback, useContext, useEffect } from "react";
import { toast } from "react-toastify";
import { add, format, parseISO } from "date-fns";

import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import PopupState, { bindTrigger, bindMenu } from "material-ui-popup-state";
import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Table,
  TableHead,
  Paper,
  Tooltip,
  Typography,
  CircularProgress,
  Box,
  TextField,
  LinearProgress,
} from "@material-ui/core";
import {
  Edit,
  Autorenew,
  CheckCircle,
  CropFree,
  DeleteOutline,
  Facebook,
  Instagram,
  WhatsApp,
  SwapHoriz,
  Add,
  Refresh,
  HeadsetMic,
  WifiOff,
  Wifi,
  HourglassEmpty,
  DevicesOther,
  Chat,
  FileCopy,
} from "@material-ui/icons";

import TableRowSkeleton from "../../components/TableRowSkeleton";

import api from "../../services/api";
import WhatsAppModal from "../../components/WhatsAppModal";
import MetaConnectionModal from "../../components/MetaConnectionModal";
import WebchatConnectionModal from "../../components/WebchatConnectionModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import QrcodeModal from "../../components/QrcodeModal";
import WhatsAppCredentialsModal from "../../components/WhatsAppCredentialsModal";
import { i18n } from "../../translate/i18n";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import toastError from "../../errors/toastError";
import formatSerializedId from "../../utils/formatSerializedId";
import { getConnectionColor } from "../../utils/connectionColor";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePlans from "../../hooks/usePlans";
import ForbiddenPage from "../../components/ForbiddenPage";
import { Can } from "../../components/Can";

const SHOW_WHATSAPP_WEB_BUTTON = true;

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    padding: theme.spacing(3),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1.5),
    },
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: theme.spacing(3),
    gap: theme.spacing(2),
    flexWrap: "wrap",
  },
  headerLeft: {},
  headerTitle: {
    fontWeight: 700,
    fontSize: "1.45rem",
    letterSpacing: "-0.3px",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
    lineHeight: 1.2,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: "0.82rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    fontWeight: 400,
  },
  headerActions: {
    display: "flex",
    gap: theme.spacing(1),
    alignItems: "center",
    flexWrap: "wrap",
  },

  // ── Buttons ──────────────────────────────────────────────────────────────
  btnGhost: {
    borderRadius: 8,
    fontWeight: 500,
    fontSize: "0.78rem",
    padding: theme.spacing(0.6, 1.4),
    border: `1px solid ${theme.palette.divider}`,
    color: theme.palette.text.secondary,
    backgroundColor: "transparent",
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.06)"
          : "rgba(15,23,42,0.04)",
    },
  },
  btnPrimary: {
    borderRadius: 8,
    fontWeight: 600,
    fontSize: "0.78rem",
    padding: theme.spacing(0.7, 1.5),
    boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
    "&:hover": {
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    },
  },
  btnAction: {
    borderRadius: 6,
    fontWeight: 500,
    fontSize: "0.72rem",
    padding: theme.spacing(0.4, 1),
    minHeight: 28,
  },

  // ── Stats row ────────────────────────────────────────────────────────────
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2.5),
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "repeat(2, 1fr)",
    },
  },
  statCard: {
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1.5, 2),
    backgroundColor: theme.palette.background.paper,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statValue: {
    fontWeight: 700,
    fontSize: "1.3rem",
    lineHeight: 1,
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
  },
  statLabel: {
    fontSize: "0.72rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    marginTop: 2,
    fontWeight: 500,
  },

  // ── Import progress card ─────────────────────────────────────────────────
  importCard: {
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(2, 2.5),
    marginBottom: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
  },
  importTitle: {
    fontWeight: 600,
    fontSize: "0.85rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
  },
  importSubtitle: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
  },

  // ── Main table ───────────────────────────────────────────────────────────
  mainPaper: {
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
    boxShadow:
      theme.palette.type === "dark"
        ? "0 1px 3px rgba(0,0,0,0.4)"
        : "0 1px 3px rgba(15,23,42,0.08)",
    flex: 1,
  },
  tableContainer: {
    overflowX: "auto",
  },
  tableHeaderRow: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(15,23,42,0.025)",
  },
  tableHeaderCell: {
    fontWeight: 600,
    fontSize: "0.72rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    padding: theme.spacing(1.25, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    whiteSpace: "nowrap",
  },
  tableRow: {
    borderBottom: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.05)"
        : "rgba(15,23,42,0.06)"
    }`,
    "&:last-child": { borderBottom: "none" },
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.03)"
          : "rgba(15,23,42,0.02)",
    },
  },
  tableCell: {
    padding: theme.spacing(1.25, 2),
    fontSize: "0.8rem",
    color: theme.palette.type === "dark" ? "#cbd5e1" : "#334155",
    borderBottom: "none",
    verticalAlign: "middle",
  },
  tableCellMono: {
    fontFamily: "monospace",
    fontSize: "0.78rem",
    letterSpacing: "0.02em",
  },

  // ── Connection identity cell ─────────────────────────────────────────────
  connectionCell: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.25),
  },
  connectionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.05)"
        : "rgba(15,23,42,0.03)",
  },
  connectionName: {
    fontWeight: 600,
    fontSize: "0.82rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
    lineHeight: 1.2,
  },
  connectionOrigin: {
    fontSize: "0.72rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    marginTop: 1,
  },

  // ── Status badges ────────────────────────────────────────────────────────
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "0.02em",
    whiteSpace: "nowrap",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    flexShrink: 0,
  },

  // ── Action icons ─────────────────────────────────────────────────────────
  actionsCell: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    justifyContent: "flex-end",
  },
  actionIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    border: `1px solid ${theme.palette.divider}`,
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.08)"
          : "rgba(15,23,42,0.06)",
      color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
    },
  },
  actionIconBtnDanger: {
    "&:hover": {
      backgroundColor: "rgba(239,68,68,0.08)",
      borderColor: "rgba(239,68,68,0.4)",
      color: "#ef4444",
    },
  },
  defaultBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 12,
    fontSize: "0.68rem",
    fontWeight: 600,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(34,197,94,0.15)"
        : "rgba(34,197,94,0.1)",
    color: "#16a34a",
    border: "1px solid rgba(34,197,94,0.2)",
  },

  // ── Empty state ──────────────────────────────────────────────────────────
  emptyState: {
    padding: theme.spacing(7, 3),
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.05)"
        : "rgba(15,23,42,0.04)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing(1),
    color: theme.palette.type === "dark" ? "#475569" : "#94a3b8",
  },
  emptyTitle: {
    fontWeight: 600,
    fontSize: "0.95rem",
    color: theme.palette.type === "dark" ? "#cbd5e1" : "#334155",
  },
  emptySubtitle: {
    fontSize: "0.8rem",
    color: theme.palette.type === "dark" ? "#64748b" : "#94a3b8",
    maxWidth: 320,
    lineHeight: 1.5,
  },

  colorSwatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
    border: `1.5px solid ${theme.palette.type === "dark" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)"}`,
    flexShrink: 0,
    cursor: "default",
    display: "inline-block",
  },

  connectionTypeIcon: {
    width: 20,
    height: 20,
    objectFit: "contain",
  },
  connectionTypeIconMenu: {
    width: 20,
    height: 20,
    objectFit: "contain",
    marginRight: 10,
    verticalAlign: "middle",
  },

  tooltip: {
    backgroundColor:
      theme.palette.type === "dark" ? "#1e293b" : "#f8fafc",
    color: theme.palette.type === "dark" ? "#e2e8f0" : "#334155",
    fontSize: "0.78rem",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
    maxWidth: 300,
  },
  tooltipPopper: {
    textAlign: "center",
  },
  buttonProgress: {
    color: green[500],
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────


const CustomToolTip = ({ title, content, children }) => {
  const classes = useStyles();
  return (
    <Tooltip
      arrow
      classes={{ tooltip: classes.tooltip, popper: classes.tooltipPopper }}
      title={
        <React.Fragment>
          <Typography variant="caption" gutterBottom color="inherit" style={{ display: "block", fontWeight: 600 }}>
            {title}
          </Typography>
          {content && <Typography variant="caption">{content}</Typography>}
        </React.Fragment>
      }
    >
      {children}
    </Tooltip>
  );
};

const CONNECTION_TYPE_ICON_PATHS = {
  whatsapp_baileys: "/connection-icons/whatsapp-baileys.png",
  whatsapp_wuzapi: "/connection-icons/whatsapp-wuzapi.png",
  whatsapp_oficial: "/connection-icons/whatsapp-oficial.png",
};

const getConnectionType = (whatsApp) => {
  const channel = String(whatsApp?.channel || "").toLowerCase();
  if (channel === "whatsapp_oficial") return "whatsapp_oficial";
  if (channel !== "whatsapp") return channel;
  const provider = String(whatsApp?.provider || "beta").toLowerCase();
  return provider === "wuzapi" ? "whatsapp_wuzapi" : "whatsapp_baileys";
};

const renderConnectionTypeImage = (type, className) => {
  const iconPath = CONNECTION_TYPE_ICON_PATHS[type];
  if (!iconPath) return null;
  return <img src={iconPath} alt={type} className={className} loading="lazy" />;
};

const IconChannel = (whatsApp, classes) => {
  const type = getConnectionType(whatsApp);
  const customTypeIcon = renderConnectionTypeImage(type, classes.connectionTypeIcon);
  if (customTypeIcon) return customTypeIcon;

  const channel = String(whatsApp?.channel || "").toLowerCase();
  switch (channel) {
    case "facebook":
      return <Facebook style={{ color: "#3b5998", fontSize: 20 }} />;
    case "instagram":
      return <Instagram style={{ color: "#e1306c", fontSize: 20 }} />;
    case "whatsapp":
      return <WhatsApp style={{ color: "#25d366", fontSize: 20 }} />;
    case "whatsapp_oficial":
      return <WhatsApp style={{ color: "#128c7e", fontSize: 20 }} />;
    case "webchat":
      return <Chat style={{ color: "#7c3aed", fontSize: 20 }} />;
    default:
      return <DevicesOther style={{ fontSize: 20 }} />;
  }
};

const getConnectionOriginLabel = (whatsApp) => {
  const type = getConnectionType(whatsApp);
  if (type === "whatsapp_baileys") return "WhatsApp (Baileys)";
  if (type === "whatsapp_wuzapi") return "WhatsApp (wuzAPI)";
  if (type === "whatsapp_oficial") return "WhatsApp Oficial";
  if (type === "facebook") return "Facebook";
  if (type === "instagram") return "Instagram";
  if (type === "meta") return "Facebook/Instagram";
  if (type === "webchat") return "Webchat";
  return type || "-";
};

const getConnectionDisplayNumber = (whatsApp) => {
  const channel = String(whatsApp?.channel || "").toLowerCase();
  if (channel === "whatsapp_oficial") return whatsApp?.phone_number || whatsApp?.number || "-";
  if (channel === "meta") return whatsApp?.pageId || whatsApp?.instagramBusinessAccountId || "-";
  if (channel === "facebook") return whatsApp?.pageId || whatsApp?.facebookPageUserId || whatsApp?.number || "-";
  if (channel === "instagram") return whatsApp?.instagramBusinessAccountId || whatsApp?.pageId || whatsApp?.number || "-";
  if (channel === "webchat") return "Widget";
  if (whatsApp?.number && channel === "whatsapp") return formatSerializedId(whatsApp.number);
  return whatsApp?.number || "-";
};

const normalizeConnectionNumber = (whatsApp) => {
  const raw = String(whatsApp?.number || "").trim();
  if (!raw) return "";
  const base = raw.includes("@") ? raw.split("@")[0] : raw;
  const digits = base.replace(/\D/g, "");
  return digits || base.toLowerCase();
};

const getEffectiveConnectionStatus = (whatsApp) => {
  const channel = String(whatsApp?.channel || "").toLowerCase();
  if (channel !== "whatsapp_oficial") return whatsApp?.status;
  const hasOfficialBinding =
    Boolean(whatsApp?.waba_webhook_id) &&
    Boolean(String(whatsApp?.token || "").trim()) &&
    Boolean(String(whatsApp?.phone_number_id || "").trim());
  return hasOfficialBinding ? "CONNECTED" : "DISCONNECTED";
};

// ── Status Badge ───────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  CONNECTED: {
    label: "Conectado",
    dotColor: "#22c55e",
    bg: "rgba(34,197,94,0.10)",
    color: "#16a34a",
    border: "rgba(34,197,94,0.25)",
  },
  DISCONNECTED: {
    label: "Desconectado",
    dotColor: "#ef4444",
    bg: "rgba(239,68,68,0.10)",
    color: "#dc2626",
    border: "rgba(239,68,68,0.25)",
  },
  qrcode: {
    label: "Aguard. QR",
    dotColor: "#f59e0b",
    bg: "rgba(245,158,11,0.10)",
    color: "#d97706",
    border: "rgba(245,158,11,0.25)",
  },
  OPENING: {
    label: "Conectando",
    dotColor: "#3b82f6",
    bg: "rgba(59,130,246,0.10)",
    color: "#2563eb",
    border: "rgba(59,130,246,0.25)",
  },
  TIMEOUT: {
    label: "Timeout",
    dotColor: "#f97316",
    bg: "rgba(249,115,22,0.10)",
    color: "#ea580c",
    border: "rgba(249,115,22,0.25)",
  },
  PAIRING: {
    label: "Pareando",
    dotColor: "#f97316",
    bg: "rgba(249,115,22,0.10)",
    color: "#ea580c",
    border: "rgba(249,115,22,0.25)",
  },
};

const StatusBadge = ({ status }) => {
  const classes = useStyles();
  const cfg = STATUS_CONFIG[status] || {
    label: status || "—",
    dotColor: "#94a3b8",
    bg: "rgba(148,163,184,0.1)",
    color: "#64748b",
    border: "rgba(148,163,184,0.25)",
  };

  const isLoading = status === "OPENING";

  return (
    <span
      className={classes.statusBadge}
      style={{
        backgroundColor: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {isLoading ? (
        <CircularProgress size={8} style={{ color: cfg.dotColor }} />
      ) : (
        <span className={classes.statusDot} style={{ backgroundColor: cfg.dotColor }} />
      )}
      {cfg.label}
    </span>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────

const Connections = () => {
  const classes = useStyles();

  const { whatsApps, loading } = useContext(WhatsAppsContext);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [statusImport, setStatusImport] = useState([]);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [providerPreset, setProviderPreset] = useState("beta");
  const [channelPreset, setChannelPreset] = useState("whatsapp");
  const [metaConnectionModalOpen, setMetaConnectionModalOpen] = useState(false);
  const [metaChannelPreset, setMetaChannelPreset] = useState("facebook");
  const [metaConnections, setMetaConnections] = useState([]);
  const [metaConnectionsLoading, setMetaConnectionsLoading] = useState(true);
  const [selectedMetaConnection, setSelectedMetaConnection] = useState(null);
  const [webchatModalOpen, setWebchatModalOpen] = useState(false);
  const [selectedWebchat, setSelectedWebchat] = useState(null);
  const [togglingWebchatId, setTogglingWebchatId] = useState(null);

  const confirmationModalInitialState = {
    action: "",
    title: "",
    message: "",
    whatsAppId: "",
    connectionSource: "whatsapp",
    open: false,
  };
  const [confirmModalInfo, setConfirmModalInfo] = useState(confirmationModalInitialState);
  const [planConfig, setPlanConfig] = useState(false);
  const [globalConfig, setGlobalConfig] = useState(null);
  const [supportWhatsapp, setSupportWhatsapp] = useState("");
  const [migrationModalOpen, setMigrationModalOpen] = useState(false);
  const [migrationSourceConnection, setMigrationSourceConnection] = useState(null);
  const [migrationTargetConnectionId, setMigrationTargetConnectionId] = useState("");
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [syncingTemplateConnectionId, setSyncingTemplateConnectionId] = useState(null);

  const { user, socket } = useContext(AuthContext);
  const companyId = user.companyId;
  const { getPlanCompany } = usePlans();

  const globalWhatsappBaileysEnabled = String(globalConfig?.channelWhatsappBaileysEnabled || "enabled") !== "disabled";
  const globalWhatsappWuzapiEnabled = String(globalConfig?.channelWhatsappWuzapiEnabled || "enabled") !== "disabled";
  const globalWhatsappOficialEnabled = String(globalConfig?.channelWhatsappOfficialEnabled || "enabled") !== "disabled";
  const globalFacebookEnabled = String(globalConfig?.channelFacebookEnabled || "enabled") !== "disabled";
  const globalInstagramEnabled = String(globalConfig?.channelInstagramEnabled || "enabled") !== "disabled";
  const globalWebchatEnabled = String(globalConfig?.channelWebchatEnabled || "enabled") !== "disabled";

  const whatsappEnabled = planConfig?.plan?.useWhatsapp !== false;
  const whatsappBaileysEnabled =
    whatsappEnabled &&
    (planConfig?.plan?.useWhatsappBaileys !== false) &&
    globalWhatsappBaileysEnabled;
  const whatsappWuzapiEnabled =
    whatsappEnabled &&
    (planConfig?.plan?.useWhatsappWuzapi !== false) &&
    globalWhatsappWuzapiEnabled;
  const whatsappOficialEnabled =
    whatsappEnabled &&
    (planConfig?.plan?.useWhatsappOficial !== false) &&
    globalWhatsappOficialEnabled;
  const facebookEnabled =
    (planConfig?.plan?.useFacebook !== false) &&
    globalFacebookEnabled;
  const instagramEnabled =
    (planConfig?.plan?.useInstagram !== false) &&
    globalInstagramEnabled;
  const webchatEnabled =
    (planConfig?.plan?.useWebchat !== false) &&
    globalWebchatEnabled;

  useEffect(() => {
    async function fetchData() {
      const planConfigs = await getPlanCompany(undefined, companyId);
      setPlanConfig(planConfigs);
      const { data } = await api.get("/global-config");
      setGlobalConfig(data);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMetaConnections = useCallback(async () => {
    try {
      setMetaConnectionsLoading(true);
      const { data } = await api.get("/meta-connections");
      setMetaConnections(Array.isArray(data) ? data : []);
    } catch (err) {
      toastError(err);
      setMetaConnections([]);
    } finally {
      setMetaConnectionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetaConnections();
  }, [loadMetaConnections]);

  useEffect(() => {
    const onImportMessages = (data) => {
      if (data.action === "refresh") { setStatusImport([]); return; }
      if (data.action === "update") setStatusImport(data.status);
    };
    socket.on(`importMessages-${user.companyId}`, onImportMessages);
    return () => { socket.off(`importMessages-${user.companyId}`, onImportMessages); };
  }, [socket, user.companyId]);

  useEffect(() => {
    const fetchSupportWhatsapp = async () => {
      try {
        const { data } = await api.get("/global-config/public-branding");
        const fromPanel = data?.loginWhatsapp;
        const fromEnv = process.env.REACT_APP_NUMBER_SUPPORT
          ? `https://wa.me/${process.env.REACT_APP_NUMBER_SUPPORT}`
          : "";
        setSupportWhatsapp(fromPanel || fromEnv);
      } catch (err) {
        if (process.env.REACT_APP_NUMBER_SUPPORT)
          setSupportWhatsapp(`https://wa.me/${process.env.REACT_APP_NUMBER_SUPPORT}`);
      }
    };
    fetchSupportWhatsapp();
  }, []);

  const handleStartWhatsAppSession = async (whatsAppId) => {
    try { await api.post(`/whatsappsession/${whatsAppId}`); }
    catch (err) { toastError(err); }
  };

  const handleToggleWebchatActive = async (whatsApp) => {
    const nextActive = !(whatsApp?.webchatActive !== false);
    try {
      setTogglingWebchatId(whatsApp.id);
      await api.put(`/whatsapp/${whatsApp.id}/webchat-active`, { active: nextActive });
      toast.success(nextActive ? "Webchat ativado." : "Webchat desativado.");
    } catch (err) {
      toastError(err);
    } finally {
      setTogglingWebchatId(null);
    }
  };

  const handleCopyWebchatSnippet = async (whatsApp) => {
    if (!whatsApp?.webchatWidgetId) return;
    const backendUrl = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
    const snippet = `<script src="${backendUrl}/public/webchat/widget.js" data-widget-id="${whatsApp.webchatWidgetId}"></script>`;
    try {
      await navigator.clipboard.writeText(snippet);
      toast.success("Código do widget copiado.");
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenWhatsAppModal = (provider = "beta", channel = "whatsapp") => {
    setProviderPreset(provider);
    setChannelPreset(channel);
    setSelectedWhatsApp(null);
    setWhatsAppModalOpen(true);
  };

  const handleCloseWhatsAppModal = useCallback(() => {
    setWhatsAppModalOpen(false);
    setSelectedWhatsApp(null);
    setProviderPreset("beta");
    setChannelPreset("whatsapp");
  }, [setSelectedWhatsApp, setWhatsAppModalOpen]);

  const handleOpenMetaConnectionModal = (channel = "facebook") => {
    setSelectedMetaConnection(null);
    setMetaChannelPreset(channel);
    setMetaConnectionModalOpen(true);
  };

  const handleCloseMetaConnectionModal = useCallback(() => {
    setMetaConnectionModalOpen(false);
    setSelectedMetaConnection(null);
    setMetaChannelPreset("facebook");
  }, []);

  const handleOpenWebchatModal = () => {
    setSelectedWebchat(null);
    setWebchatModalOpen(true);
  };

  const handleCloseWebchatModal = useCallback(() => {
    setWebchatModalOpen(false);
    setSelectedWebchat(null);
  }, []);

  const handleOpenQrModal = (whatsApp) => {
    setSelectedWhatsApp(whatsApp);
    setQrModalOpen(true);
  };

  const handleCloseQrModal = useCallback(() => {
    setSelectedWhatsApp(null);
    setQrModalOpen(false);
  }, [setQrModalOpen, setSelectedWhatsApp]);

  const handleOpenCredentialModal = useCallback((whatsApp) => {
    setSelectedWhatsApp(whatsApp);
    setCredentialModalOpen(true);
  }, []);

  const handleCloseCredentialModal = useCallback(() => {
    setSelectedWhatsApp(null);
    setCredentialModalOpen(false);
  }, []);

  const handleOpenDisconnectedQrFlow = useCallback(async (whatsApp) => {
    try {
      await api.put(`/whatsappsession/${whatsApp.id}`);
      setSelectedWhatsApp(whatsApp);
      setQrModalOpen(true);
    } catch (err) {
      toastError(err);
    }
  }, []);

  const handleEditWhatsApp = (whatsApp) => {
    if (whatsApp?.connectionSource === "meta") {
      setSelectedMetaConnection(whatsApp);
      setMetaChannelPreset(whatsApp?.channel || "facebook");
      setMetaConnectionModalOpen(true);
      return;
    }
    if (whatsApp?.channel === "webchat") {
      setSelectedWebchat(whatsApp);
      setWebchatModalOpen(true);
      return;
    }
    setProviderPreset(whatsApp?.provider || "beta");
    setChannelPreset(whatsApp?.channel || "whatsapp");
    setSelectedWhatsApp(whatsApp);
    setWhatsAppModalOpen(true);
  };

  const openInNewTab = (url) => { window.open(url, "_blank", "noopener,noreferrer"); };

  const handleOpenConfirmationModal = (action, whatsAppId, connectionSource = "whatsapp") => {
    if (action === "disconnect")
      setConfirmModalInfo({ action, title: i18n.t("connections.confirmationModal.disconnectTitle"), message: i18n.t("connections.confirmationModal.disconnectMessage"), whatsAppId, connectionSource });
    if (action === "delete")
      setConfirmModalInfo({
        action,
        title: i18n.t("connections.confirmationModal.deleteTitle"),
        message: i18n.t("connections.confirmationModal.deleteMessage"),
        alert: {
          title: "Atenção",
          message: "Ao excluir esta conexão, todos os tickets vinculados a ela que estiverem em aguardando ou em atendimento serão encerrados."
        },
        whatsAppId,
        connectionSource
      });
    if (action === "closedImported")
      setConfirmModalInfo({ action, title: i18n.t("connections.confirmationModal.closedImportedTitle"), message: i18n.t("connections.confirmationModal.closedImportedMessage"), whatsAppId, connectionSource });
    setConfirmModalOpen(true);
  };

  const handleSubmitConfirmationModal = async () => {
    if (confirmModalInfo.action === "disconnect") {
      try { await api.delete(`/whatsappsession/${confirmModalInfo.whatsAppId}`); }
      catch (err) { toastError(err); }
    }
    if (confirmModalInfo.action === "delete") {
      try {
        if (confirmModalInfo.connectionSource === "meta") {
          await api.delete(`/meta-connections/${confirmModalInfo.whatsAppId}`);
          await loadMetaConnections();
        } else {
          await api.delete(`/whatsapp/${confirmModalInfo.whatsAppId}`);
        }
        toast.success(i18n.t("connections.toasts.deleted"));
      } catch (err) { toastError(err); }
    }
    if (confirmModalInfo.action === "closedImported") {
      try {
        await api.post(`/closedimported/${confirmModalInfo.whatsAppId}`);
        toast.success(i18n.t("connections.toasts.closedimported"));
      } catch (err) { toastError(err); }
    }
    setConfirmModalInfo(confirmationModalInitialState);
  };

  const getMigrationTargets = (sourceConnection) => {
    if (!sourceConnection) return [];
    const sourceNumber = normalizeConnectionNumber(sourceConnection);
    return (whatsApps || []).filter((connection) => {
      const isWhatsApp = String(connection?.channel || "").toLowerCase() === "whatsapp";
      if (!isWhatsApp || Number(connection.id) === Number(sourceConnection.id)) return false;
      const targetNumber = normalizeConnectionNumber(connection);
      return Boolean(sourceNumber && targetNumber && sourceNumber === targetNumber);
    });
  };

  const handleOpenMigrationModal = (sourceConnection) => {
    const targets = getMigrationTargets(sourceConnection);
    if (!targets.length) { toast.warning("Só é permitido migrar para uma conexão com o mesmo número."); return; }
    setMigrationSourceConnection(sourceConnection);
    setMigrationTargetConnectionId(String(targets[0].id));
    setMigrationModalOpen(true);
  };

  const handleCloseMigrationModal = () => {
    setMigrationModalOpen(false);
    setMigrationSourceConnection(null);
    setMigrationTargetConnectionId("");
  };

  const handleSubmitMigration = async () => {
    if (!migrationSourceConnection || !migrationTargetConnectionId) {
      toast.warning("Selecione a conexão de destino para continuar.");
      return;
    }
    let migratedWithSuccess = false;
    try {
      setMigrationLoading(true);
      const { data } = await api.post(`/whatsapp/${migrationSourceConnection.id}/migrate/${migrationTargetConnectionId}`);
      toast.success(["Migração concluída com sucesso.", `Tickets migrados: ${data?.migratedTickets || 0}`, `Tickets mesclados: ${data?.mergedTickets || 0}`, `Contatos migrados: ${data?.migratedContacts || 0}`, `Contatos mesclados: ${data?.mergedContacts || 0}`].join(" "));
      migratedWithSuccess = true;
    } catch (err) { toastError(err); }
    finally {
      setMigrationLoading(false);
      if (migratedWithSuccess) handleCloseMigrationModal();
    }
  };

  const handleSyncOfficialTemplates = async (whatsApp) => {
    if (!whatsApp?.id) return;
    try {
      setSyncingTemplateConnectionId(whatsApp.id);
      const { data } = await api.post(`/whatsapp/${whatsApp.id}/templates/sync`);
      toast.success(`Templates sincronizados com sucesso (${Number(data?.synced || 0)} processados).`);
    } catch (err) { toastError(err); }
    finally { setSyncingTemplateConnectionId(null); }
  };

  const restartWhatsapps = async () => {
    try { await api.post(`/whatsapp-restart/`); toast.success(i18n.t("connections.waitConnection")); }
    catch (err) { toastError(err); }
  };

  const allConnections = React.useMemo(() => {
    const normalizedMetaConnections = (metaConnections || []).map((connection) => ({
      ...connection,
      connectionSource: "meta"
    }));
    const normalizedWhatsApps = (whatsApps || []).map((connection) => ({
      ...connection,
      connectionSource: "whatsapp"
    }));
    return [...normalizedMetaConnections, ...normalizedWhatsApps].sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [metaConnections, whatsApps]);

  // ── Derived stats ──────────────────────────────────────────────────────
  const stats = React.useMemo(() => {
    const list = allConnections || [];
    return {
      total: list.length,
      connected: list.filter((w) => getEffectiveConnectionStatus(w) === "CONNECTED").length,
      disconnected: list.filter((w) => getEffectiveConnectionStatus(w) === "DISCONNECTED").length,
      pending: list.filter((w) => getEffectiveConnectionStatus(w) === "qrcode").length,
    };
  }, [allConnections]);

  // ── Session action buttons (inside table) ──────────────────────────────
  const renderActionButtons = (whatsApp) => {
    const status = getEffectiveConnectionStatus(whatsApp);
    const isOfficial = String(whatsApp?.channel || "").toLowerCase() === "whatsapp_oficial";
    const isWuzapi = String(whatsApp?.provider || "").toLowerCase() === "wuzapi";
    const isWebchat = String(whatsApp?.channel || "").toLowerCase() === "webchat";

    if (isWebchat) {
      const isActive = whatsApp?.webchatActive !== false;
      return (
        <Can
          role={user.profile === "user" && user.allowConnections === "enabled" ? "admin" : user.profile}
          perform="connections-page:addConnection"
          yes={() => (
            <Box display="flex" style={{ gap: 4 }}>
              <Button
                className={classes.btnAction}
                size="small"
                variant="outlined"
                color={isActive ? "secondary" : "primary"}
                disabled={togglingWebchatId === whatsApp.id}
                onClick={() => handleToggleWebchatActive(whatsApp)}
              >
                {togglingWebchatId === whatsApp.id
                  ? "Aguarde..."
                  : isActive
                  ? "Desconectar"
                  : "Conectar"}
              </Button>
              {whatsApp?.webchatWidgetId && (
                <Button
                  className={classes.btnAction}
                  size="small"
                  variant="outlined"
                  color="primary"
                  startIcon={<FileCopy style={{ fontSize: 14 }} />}
                  onClick={() => handleCopyWebchatSnippet(whatsApp)}
                >
                  Widget
                </Button>
              )}
            </Box>
          )}
        />
      );
    }

    if (isOfficial) {
      return (
        <Can
          role={user.profile}
          perform="connections-page:addConnection"
          yes={() => (
            <Button className={classes.btnAction} size="small" variant="outlined" color="primary" onClick={() => handleEditWhatsApp(whatsApp)}>
              Editar
            </Button>
          )}
        />
      );
    }

    if (whatsApp?.connectionSource === "meta") {
      return (
        <Button className={classes.btnAction} size="small" variant="outlined" color="primary" onClick={() => handleEditWhatsApp(whatsApp)}>
          Configurar
        </Button>
      );
    }

    return (
      <>
        {status === "qrcode" && (
          <Can
            role={user.profile === "user" && user.allowConnections === "enabled" ? "admin" : user.profile}
            perform="connections-page:addConnection"
            yes={() => (
              <Button className={classes.btnAction} size="small" variant="contained" color="primary" startIcon={<CropFree style={{ fontSize: 14 }} />} onClick={() => handleOpenQrModal(whatsApp)}>
                {i18n.t("connections.buttons.qrcode")}
              </Button>
            )}
          />
        )}
        {status === "DISCONNECTED" && (
          <Can
            role={user.profile === "user" && user.allowConnections === "enabled" ? "admin" : user.profile}
            perform="connections-page:addConnection"
            yes={() => (
              <Box display="flex" style={{ gap: 4 }}>
                <Button className={classes.btnAction} size="small" variant="outlined" color="primary" onClick={() => handleStartWhatsAppSession(whatsApp.id)}>
                  {i18n.t("connections.buttons.tryAgain")}
                </Button>
                <Button className={classes.btnAction} size="small" variant="outlined" color="secondary" startIcon={<CropFree style={{ fontSize: 14 }} />} onClick={() => handleOpenDisconnectedQrFlow(whatsApp)}>
                  QR Code
                </Button>
                {!isWuzapi && SHOW_WHATSAPP_WEB_BUTTON && (
                  <Button className={classes.btnAction} size="small" variant="outlined" color="primary" onClick={() => handleOpenCredentialModal(whatsApp)}>
                    Whatsapp Web
                  </Button>
                )}
              </Box>
            )}
          />
        )}
        {(status === "CONNECTED" || status === "PAIRING" || status === "TIMEOUT") && (
          <Can
            role={user.profile}
            perform="connections-page:addConnection"
            yes={() => (
              <Box display="flex" style={{ gap: 4 }}>
                <Button className={classes.btnAction} size="small" variant="outlined" color="secondary" onClick={() => handleOpenConfirmationModal("disconnect", whatsApp.id)}>
                  {i18n.t("connections.buttons.disconnect")}
                </Button>
                {whatsApp?.statusImportMessages === "renderButtonCloseTickets" && (
                  <Button className={classes.btnAction} size="small" variant="outlined" color="primary" onClick={() => handleOpenConfirmationModal("closedImported", whatsApp.id)}>
                    {i18n.t("connections.buttons.closedImported")}
                  </Button>
                )}
                {whatsApp?.importOldMessages && (() => {
                  const isTimeStamp = !isNaN(new Date(Math.floor(whatsApp?.statusImportMessages)).getTime());
                  if (!isTimeStamp) return null;
                  const ultimoStatus = new Date(Math.floor(whatsApp?.statusImportMessages)).getTime();
                  const dataLimite = +add(ultimoStatus, { seconds: +35 }).getTime();
                  if (dataLimite > new Date().getTime()) {
                    return (
                      <Button disabled className={classes.btnAction} size="small" variant="outlined" color="primary" endIcon={<CircularProgress size={10} className={classes.buttonProgress} />}>
                        {i18n.t("connections.buttons.preparing")}
                      </Button>
                    );
                  }
                  return null;
                })()}
              </Box>
            )}
          />
        )}
        {status === "OPENING" && (
          <Button className={classes.btnAction} size="small" variant="outlined" disabled color="default">
            {i18n.t("connections.buttons.connecting")}
          </Button>
        )}
      </>
    );
  };

  // ── Import progress ────────────────────────────────────────────────────
  const importPercent = statusImport?.all
    ? Math.round((statusImport.this / statusImport.all) * 100)
    : 0;

  return (
    <div className={classes.pageRoot}>
      {/* Modals */}
      <ConfirmationModal
        title={confirmModalInfo.title}
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={handleSubmitConfirmationModal}
        alert={confirmModalInfo.alert}
      >
        {confirmModalInfo.message}
      </ConfirmationModal>

      {qrModalOpen && (
        <QrcodeModal
          open={qrModalOpen}
          onClose={handleCloseQrModal}
          whatsAppId={!whatsAppModalOpen && !credentialModalOpen && selectedWhatsApp?.id}
        />
      )}

      {credentialModalOpen && (
        <WhatsAppCredentialsModal
          open={credentialModalOpen}
          onClose={handleCloseCredentialModal}
          whatsApp={selectedWhatsApp}
        />
      )}

      <WhatsAppModal
        open={whatsAppModalOpen}
        onClose={handleCloseWhatsAppModal}
        whatsAppId={!qrModalOpen && !credentialModalOpen && selectedWhatsApp?.id}
        providerPreset={providerPreset}
        channelPreset={channelPreset}
        baileysEnabled={whatsappBaileysEnabled}
        wuzapiEnabled={whatsappWuzapiEnabled}
      />

      <MetaConnectionModal
        open={metaConnectionModalOpen}
        onClose={handleCloseMetaConnectionModal}
        metaConnectionId={selectedMetaConnection?.id}
        channelPreset={metaChannelPreset}
        onSaved={loadMetaConnections}
      />

      <WebchatConnectionModal
        open={webchatModalOpen}
        onClose={handleCloseWebchatModal}
        whatsappId={selectedWebchat?.id}
      />

      {/* Migration Modal */}
      <Dialog open={migrationModalOpen} onClose={handleCloseMigrationModal} fullWidth maxWidth="sm">
        <DialogTitle>Migrar atendimentos da conexão</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Conexão origem: <strong>{migrationSourceConnection?.name || "-"}</strong>
          </Typography>
          <TextField
            select margin="dense" variant="outlined" fullWidth label="Conexão destino"
            value={migrationTargetConnectionId}
            onChange={(e) => setMigrationTargetConnectionId(e.target.value)}
            disabled={migrationLoading}
          >
            {getMigrationTargets(migrationSourceConnection).map((connection) => (
              <MenuItem key={connection.id} value={String(connection.id)}>
                {connection.name} ({getConnectionOriginLabel(connection)})
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseMigrationModal} disabled={migrationLoading}>Cancelar</Button>
          <Button onClick={handleSubmitMigration} color="primary" variant="contained" disabled={migrationLoading || !migrationTargetConnectionId}>
            {migrationLoading ? "Migrando..." : "Migrar"}
          </Button>
        </DialogActions>
      </Dialog>

      {user.profile === "user" && user.allowConnections === "disabled" ? (
        <ForbiddenPage />
      ) : (
        <>
          {/* ── Page Header ── */}
          <div className={classes.header}>
            <div className={classes.headerLeft}>
              <Typography className={classes.headerTitle}>Conexões</Typography>
              <Typography className={classes.headerSubtitle}>
                Gerencie seus canais de atendimento
              </Typography>
            </div>

            <div className={classes.headerActions}>
              <Button
                className={classes.btnGhost}
                size="small"
                startIcon={<Refresh style={{ fontSize: 15 }} />}
                onClick={restartWhatsapps}
              >
                {i18n.t("connections.restartConnections")}
              </Button>

              {supportWhatsapp && (
                <Button
                  className={classes.btnGhost}
                  size="small"
                  startIcon={<HeadsetMic style={{ fontSize: 15 }} />}
                  onClick={() => openInNewTab(supportWhatsapp)}
                >
                  {i18n.t("connections.callSupport")}
                </Button>
              )}

              <PopupState variant="popover" popupId="new-connection-menu">
                {(popupState) => (
                  <React.Fragment>
                    <Can
                      role={user.profile}
                      perform="connections-page:addConnection"
                      yes={() => (
                        <>
                          <Button
                            className={classes.btnPrimary}
                            size="small"
                            variant="contained"
                            color="primary"
                            startIcon={<Add style={{ fontSize: 16 }} />}
                            {...bindTrigger(popupState)}
                          >
                            {i18n.t("connections.newConnection")}
                          </Button>
                          <Menu
                            {...bindMenu(popupState)}
                            getContentAnchorEl={null}
                            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                            transformOrigin={{ vertical: "top", horizontal: "right" }}
                            PaperProps={{
                              style: { borderRadius: 10, minWidth: 220, marginTop: 4 },
                            }}
                          >
                            {(whatsappBaileysEnabled || whatsappWuzapiEnabled) && (
                              <MenuItem onClick={() => { handleOpenWhatsAppModal(whatsappBaileysEnabled ? "beta" : "wuzapi"); popupState.close(); }}>
                                {renderConnectionTypeImage("whatsapp_baileys", classes.connectionTypeIconMenu)}
                                WhatsApp (QR Code)
                              </MenuItem>
                            )}
                            {whatsappOficialEnabled && (
                              <MenuItem onClick={() => { handleOpenWhatsAppModal("beta", "whatsapp_oficial"); popupState.close(); }}>
                                {renderConnectionTypeImage("whatsapp_oficial", classes.connectionTypeIconMenu)}
                                WhatsApp (API Oficial)
                              </MenuItem>
                            )}
                            {(facebookEnabled || instagramEnabled) && (
                              <MenuItem onClick={() => { handleOpenMetaConnectionModal(facebookEnabled ? "facebook" : "instagram"); popupState.close(); }}>
                                <Facebook fontSize="small" style={{ marginRight: 10, color: "#3b5998" }} />
                                Facebook / Instagram
                              </MenuItem>
                            )}
                            {webchatEnabled && (
                              <MenuItem onClick={() => { handleOpenWebchatModal(); popupState.close(); }}>
                                <Chat fontSize="small" style={{ marginRight: 10, color: "#7c3aed" }} />
                                Webchat
                              </MenuItem>
                            )}
                          </Menu>
                        </>
                      )}
                    />
                  </React.Fragment>
                )}
              </PopupState>
            </div>
          </div>

          {/* ── Stats row ── */}
          {!loading && (
            <div className={classes.statsRow}>
              <div className={classes.statCard}>
                <div className={classes.statIconWrap} style={{ backgroundColor: "rgba(99,102,241,0.1)" }}>
                  <DevicesOther style={{ fontSize: 20, color: "#6366f1" }} />
                </div>
                <div>
                  <div className={classes.statValue}>{stats.total}</div>
                  <div className={classes.statLabel}>Total</div>
                </div>
              </div>
              <div className={classes.statCard}>
                <div className={classes.statIconWrap} style={{ backgroundColor: "rgba(34,197,94,0.1)" }}>
                  <Wifi style={{ fontSize: 20, color: "#22c55e" }} />
                </div>
                <div>
                  <div className={classes.statValue}>{stats.connected}</div>
                  <div className={classes.statLabel}>Conectadas</div>
                </div>
              </div>
              <div className={classes.statCard}>
                <div className={classes.statIconWrap} style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
                  <WifiOff style={{ fontSize: 20, color: "#ef4444" }} />
                </div>
                <div>
                  <div className={classes.statValue}>{stats.disconnected}</div>
                  <div className={classes.statLabel}>Desconectadas</div>
                </div>
              </div>
              <div className={classes.statCard}>
                <div className={classes.statIconWrap} style={{ backgroundColor: "rgba(245,158,11,0.1)" }}>
                  <HourglassEmpty style={{ fontSize: 20, color: "#f59e0b" }} />
                </div>
                <div>
                  <div className={classes.statValue}>{stats.pending}</div>
                  <div className={classes.statLabel}>Aguard. QR</div>
                </div>
              </div>
            </div>
          )}

          {/* ── Import progress ── */}
          {statusImport?.all ? (
            <div className={classes.importCard}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography className={classes.importTitle}>
                  {statusImport?.this === -1
                    ? i18n.t("connections.buttons.preparing")
                    : i18n.t("connections.buttons.importing")}
                </Typography>
                {statusImport?.this !== -1 && (
                  <Typography variant="caption" color="textSecondary">
                    {statusImport?.this} / {statusImport?.all} — {importPercent}%
                  </Typography>
                )}
              </Box>
              {statusImport?.this === -1 ? (
                <LinearProgress style={{ borderRadius: 4 }} />
              ) : (
                <LinearProgress variant="determinate" value={importPercent} style={{ borderRadius: 4 }} />
              )}
              {statusImport?.date && (
                <Typography className={classes.importSubtitle}>
                  {i18n.t("connections.typography.date")}: {statusImport.date}
                </Typography>
              )}
            </div>
          ) : null}

          {/* ── Main Table ── */}
          <Paper className={classes.mainPaper} variant="outlined">
            <div className={classes.tableContainer}>
              <Table size="small">
                <TableHead>
                  <TableRow className={classes.tableHeaderRow}>
                    <TableCell className={classes.tableHeaderCell}>Conexão</TableCell>
                    <TableCell className={classes.tableHeaderCell} align="center">Número</TableCell>
                    <TableCell className={classes.tableHeaderCell} align="center">Status</TableCell>
                    <TableCell className={classes.tableHeaderCell} align="center">Sessão</TableCell>
                    <TableCell className={classes.tableHeaderCell} align="center">Atualização</TableCell>
                    <TableCell className={classes.tableHeaderCell} align="center">Padrão</TableCell>
                    <Can
                      role={user.profile === "user" && user.allowConnections === "enabled" ? "admin" : user.profile}
                      perform="connections-page:addConnection"
                      yes={() => (
                        <TableCell className={classes.tableHeaderCell} align="right">Ações</TableCell>
                      )}
                    />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading || metaConnectionsLoading ? (
                    <TableRowSkeleton />
                  ) : allConnections?.length > 0 ? (
                    allConnections.map((whatsApp) => {
                      const status = getEffectiveConnectionStatus(whatsApp);
                      const isOfficial = String(whatsApp?.channel || "").toLowerCase() === "whatsapp_oficial";
                      const isMetaConnection = whatsApp?.connectionSource === "meta";

                      return (
                        <TableRow key={whatsApp.id} className={classes.tableRow}>
                          {/* Identity */}
                          <TableCell className={classes.tableCell} style={{ minWidth: 200 }}>
                            <div className={classes.connectionCell}>
                              <div className={classes.connectionIconWrap}>
                                {IconChannel(whatsApp, classes)}
                              </div>
                              <div>
                                <div className={classes.connectionName}>{whatsApp.name}</div>
                                <div className={classes.connectionOrigin}>{getConnectionOriginLabel(whatsApp)}</div>
                              </div>
                              <Tooltip
                                title={whatsApp.color ? `Cor: ${whatsApp.color}` : "Sem cor definida"}
                                arrow
                                classes={{ tooltip: classes.tooltip, popper: classes.tooltipPopper }}
                              >
                                <span
                                  className={classes.colorSwatch}
                                  style={{ backgroundColor: getConnectionColor(whatsApp) }}
                                />
                              </Tooltip>
                            </div>
                          </TableCell>

                          {/* Number */}
                          <TableCell className={`${classes.tableCell} ${classes.tableCellMono}`} align="center">
                            {getConnectionDisplayNumber(whatsApp)}
                          </TableCell>

                          {/* Status badge */}
                          <TableCell className={classes.tableCell} align="center">
                            <CustomToolTip
                              title={
                                status === "CONNECTED" ? i18n.t("connections.toolTips.connected.title")
                                : status === "DISCONNECTED" ? i18n.t("connections.toolTips.disconnected.title")
                                : status === "qrcode" ? i18n.t("connections.toolTips.qrcode.title")
                                : status === "TIMEOUT" || status === "PAIRING" ? i18n.t("connections.toolTips.timeout.title")
                                : ""
                              }
                              content={
                                status === "DISCONNECTED" ? i18n.t("connections.toolTips.disconnected.content")
                                : status === "qrcode" ? i18n.t("connections.toolTips.qrcode.content")
                                : status === "TIMEOUT" || status === "PAIRING" ? i18n.t("connections.toolTips.timeout.content")
                                : undefined
                              }
                            >
                              <span>
                                <StatusBadge status={status} />
                              </span>
                            </CustomToolTip>
                          </TableCell>

                          {/* Session actions */}
                          <TableCell className={classes.tableCell} align="center">
                            {renderActionButtons(whatsApp)}
                          </TableCell>

                          {/* Last update */}
                          <TableCell className={`${classes.tableCell} ${classes.tableCellMono}`} align="center" style={{ fontSize: "0.72rem" }}>
                            {whatsApp?.updatedAt ? format(parseISO(whatsApp.updatedAt), "dd/MM/yy HH:mm") : "-"}
                          </TableCell>

                          {/* Default */}
                          <TableCell className={classes.tableCell} align="center">
                            {whatsApp.isDefault && (
                              <span className={classes.defaultBadge}>
                                <CheckCircle style={{ fontSize: 11 }} />
                                Padrão
                              </span>
                            )}
                          </TableCell>

                          {/* Actions column */}
                          <Can
                            role={user.profile}
                            perform="connections-page:addConnection"
                            yes={() => (
                              <TableCell className={classes.tableCell} align="right">
                                <div className={classes.actionsCell}>
                                  <Tooltip title="Editar conexão" arrow>
                                    <IconButton
                                      className={classes.actionIconBtn}
                                      size="small"
                                      onClick={() => handleEditWhatsApp(whatsApp)}
                                    >
                                      <Edit style={{ fontSize: 15 }} />
                                    </IconButton>
                                  </Tooltip>

                                  {isOfficial && (
                                    <Tooltip title="Sincronizar templates" arrow>
                                      <span>
                                        <IconButton
                                          className={classes.actionIconBtn}
                                          size="small"
                                          onClick={() => handleSyncOfficialTemplates(whatsApp)}
                                          disabled={syncingTemplateConnectionId === whatsApp.id}
                                        >
                                          {syncingTemplateConnectionId === whatsApp.id
                                            ? <CircularProgress size={13} />
                                            : <Autorenew style={{ fontSize: 15 }} />
                                          }
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                  )}

                                  {user.profile === "admin" && String(whatsApp?.channel || "").toLowerCase() === "whatsapp" && (
                                    <Tooltip title="Migrar mensagens" arrow>
                                      <IconButton
                                        className={classes.actionIconBtn}
                                        size="small"
                                        onClick={() => handleOpenMigrationModal(whatsApp)}
                                      >
                                        <SwapHoriz style={{ fontSize: 15 }} />
                                      </IconButton>
                                    </Tooltip>
                                  )}

                                  <Tooltip title="Excluir conexão" arrow>
                                    <IconButton
                                      className={`${classes.actionIconBtn} ${classes.actionIconBtnDanger}`}
                                      size="small"
                                      onClick={() => handleOpenConfirmationModal("delete", whatsApp.id, isMetaConnection ? "meta" : "whatsapp")}
                                    >
                                      <DeleteOutline style={{ fontSize: 15 }} />
                                    </IconButton>
                                  </Tooltip>
                                </div>
                              </TableCell>
                            )}
                          />
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} style={{ border: "none", padding: 0 }}>
                        <div className={classes.emptyState}>
                          <div className={classes.emptyIcon}>
                            <DevicesOther style={{ fontSize: 28 }} />
                          </div>
                          <Typography className={classes.emptyTitle}>
                            Nenhuma conexão encontrada
                          </Typography>
                          <Typography className={classes.emptySubtitle}>
                            Adicione sua primeira conexão clicando em "Nova Conexão" para começar a receber mensagens.
                          </Typography>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Paper>
        </>
      )}
    </div>
  );
};

export default Connections;
