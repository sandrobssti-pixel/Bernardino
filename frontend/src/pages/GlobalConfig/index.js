import React, { useState, useEffect, useContext } from "react";
import {
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Tabs,
  Tab,
  CircularProgress,
  Box,
  FormControlLabel,
  Switch,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  makeStyles,
} from "@material-ui/core";
import {
  Save,
  ExpandMore,
  MailOutline,
  Drafts,
  WhatsApp,
  MonetizationOn,
  Tune,
  AvTimer,
  Collections,
  SettingsEthernet,
  Dashboard,
  Business,
  CheckCircle,
  ErrorOutline,
  People,
  Link as LinkIcon,
  LinkOff,
  FolderOpen,
  DeleteSweep,
  AccountBalance,
  AttachMoney,
  HourglassEmpty
} from "@material-ui/icons";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import moment from "moment";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import ServerMetrics from "../ServerMetrics";
import { AuthContext } from "../../context/Auth/AuthContext";
import Whitelabel from "../../components/Settings/Whitelabel";
import useSettings from "../../hooks/useSettings";
import formatToCurrency from "../../utils/formatToCurrency";
import { CreatedAtFilter } from "../../components/CreatedAtFilter";

const useStyles = makeStyles(theme => {
  const isDark = theme.palette.type === "dark";

  return ({
  root: {
    padding: theme.spacing(2),
    width: "100%",
    maxWidth: "100%",
    margin: 0,
    boxSizing: "border-box",
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1)
    }
  },
  hero: {
    borderRadius: 16,
    padding: theme.spacing(2.5),
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    background: isDark
      ? "linear-gradient(135deg, rgba(56,189,248,.12) 0%, rgba(16,185,129,.12) 100%)"
      : "linear-gradient(135deg, rgba(15,76,129,.1) 0%, rgba(19,111,99,.1) 100%)",
    boxShadow: "0 12px 24px rgba(15, 23, 42, 0.07)"
  },
  title: {
    marginBottom: theme.spacing(0.5),
    fontWeight: 700
  },
  subtitle: {
    fontSize: "0.86rem",
    color: theme.palette.text.secondary
  },
  tabs: {
    marginBottom: theme.spacing(2),
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
    "& .MuiTabs-flexContainer": {
      padding: theme.spacing(0.5),
      flexWrap: "nowrap"
    },
    "& .MuiTabs-scroller": {
      overflowX: "auto !important",
      WebkitOverflowScrolling: "touch"
    },
    "& .MuiTab-root": {
      textTransform: "none",
      minHeight: 40,
      borderRadius: 8,
      fontWeight: 600
    }
  },
  tabIcon: {
    color: theme.palette.text.secondary,
    fontSize: 18
  },
  sectionTitle: {
    marginBottom: theme.spacing(0.75),
    fontWeight: 700
  },
  sectionDescription: {
    marginBottom: theme.spacing(2),
    fontSize: "0.8rem",
    color: theme.palette.text.secondary
  },
  form: {
    marginTop: theme.spacing(1)
  },
  sectionCard: {
    borderRadius: 14,
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
    background: theme.palette.background.paper
  },
  sectionCardScrollable: {
    maxHeight: "calc(100vh - 280px)",
    overflowY: "auto",
    paddingRight: theme.spacing(1.2),
    [theme.breakpoints.down("sm")]: {
      maxHeight: "none",
      overflowY: "visible",
      paddingRight: theme.spacing(2)
    }
  },
  textField: {
    marginBottom: theme.spacing(2)
  },
  actions: {
    marginTop: theme.spacing(3),
    display: "flex",
    justifyContent: "flex-end"
  },
  actionsSticky: {
    position: "fixed",
    right: theme.spacing(3),
    bottom: theme.spacing(2),
    zIndex: 1200,
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    paddingLeft: theme.spacing(1.5),
    paddingRight: theme.spacing(1.5),
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.16)",
    [theme.breakpoints.down("sm")]: {
      right: theme.spacing(1.5),
      left: theme.spacing(1.5),
      bottom: theme.spacing(1.5),
      justifyContent: "flex-end"
    }
  },
  button: {
    minWidth: 160
  },
  loadingWrapper: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(4)
  },
  helperText: {
    color: theme.palette.text.secondary,
    fontSize: "0.78rem",
    marginTop: -theme.spacing(0.3),
    marginBottom: theme.spacing(2)
  },
  brandingPreviewImg: {
    maxWidth: "100%",
    maxHeight: 120,
    borderRadius: 8,
    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
    objectFit: "contain",
    background: "#fafafa"
  },
  uploadButton: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  uploadActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap"
  },
  smtpRowCard: {
    padding: theme.spacing(1.5),
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    background: isDark ? "rgba(255,255,255,.04)" : "rgba(248,250,252,.9)",
    marginBottom: theme.spacing(2)
  },
  smtpColumnCard: {
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
    padding: theme.spacing(1.5),
    height: "100%"
  },
  compactField: {
    marginBottom: theme.spacing(1.2)
  },
  templatePreview: {
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    background: isDark ? "rgba(255,255,255,.03)" : "#f8fafc",
    padding: theme.spacing(1.25),
    maxHeight: 140,
    overflow: "auto"
  },
  accordion: {
    borderRadius: "10px !important",
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "none",
    marginBottom: theme.spacing(1.25),
    "&:before": {
      display: "none"
    }
  },
  accordionSummary: {
    minHeight: 50,
    "& .MuiAccordionSummary-content": {
      margin: "12px 0"
    }
  },
  accordionSummaryContent: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.1)
  },
  accordionSummaryIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    "& .MuiSvgIcon-root": {
      fontSize: 18
    }
  },
  iconSmtp: {
    color: "#0f4c81",
    background: "linear-gradient(135deg, rgba(15,76,129,.16) 0%, rgba(56,189,248,.16) 100%)"
  },
  iconWelcomeEmail: {
    color: "#9a3412",
    background: "linear-gradient(135deg, rgba(249,115,22,.16) 0%, rgba(251,191,36,.16) 100%)"
  },
  iconWelcomeWhatsapp: {
    color: "#166534",
    background: "linear-gradient(135deg, rgba(34,197,94,.16) 0%, rgba(16,185,129,.16) 100%)"
  },
  iconTrial: {
    color: "#4338ca",
    background: "linear-gradient(135deg, rgba(99,102,241,.16) 0%, rgba(129,140,248,.16) 100%)"
  },
  accordionDetails: {
    display: "block",
    paddingTop: 0
  },
  iosSwitchRoot: {
    width: 36,
    height: 22,
    padding: 0,
    margin: "0 8px 0 0"
  },
  iosSwitchBase: {
    padding: 2,
    "&.Mui-checked": {
      transform: "translateX(14px)",
      color: "#fff",
      "& + .MuiSwitch-track": {
        backgroundColor: "#34c759",
        borderColor: "#34c759",
        opacity: 1
      }
    }
  },
  iosSwitchThumb: {
    width: 18,
    height: 18,
    boxShadow: "0 1px 3px rgba(0,0,0,0.25)"
  },
  iosSwitchTrack: {
    borderRadius: 11,
    border: `1px solid ${theme.palette.type === "light" ? "#d1d5db" : "#475569"}`,
    backgroundColor: theme.palette.type === "light" ? "#e5e7eb" : "#334155",
    opacity: 1,
    transition: theme.transitions.create(["background-color", "border"])
  },
  switchFieldLabel: {
    marginLeft: 0,
    marginRight: 0,
    width: "100%",
    display: "flex",
    alignItems: "center",
    marginBottom: theme.spacing(0.6),
    "&:last-child": {
      marginBottom: 0
    },
    "& .MuiFormControlLabel-label": {
      marginLeft: theme.spacing(0.75),
      fontSize: "0.88rem"
    }
  },
  // ── Financeiro / Dashboard / Pagamentos / WuzAPI (padrão visual da tela Conexões) ────
  finHeaderTitle: {
    fontWeight: 700,
    fontSize: "1.15rem",
    letterSpacing: "-0.3px",
    color: isDark ? "#f1f5f9" : "#0f172a",
    lineHeight: 1.2,
    marginBottom: 4
  },
  finHeaderSubtitle: {
    fontSize: "0.82rem",
    color: isDark ? "#94a3b8" : "#64748b",
    fontWeight: 400,
    marginBottom: theme.spacing(2)
  },
  finFormCard: {
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(15,23,42,0.012)",
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2)
  },
  finStatsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2.5),
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "repeat(2, 1fr)"
    }
  },
  finStatCard: {
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1.5, 2),
    backgroundColor: theme.palette.background.paper,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5)
  },
  finStatIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  finStatValue: {
    fontWeight: 700,
    fontSize: "1.3rem",
    lineHeight: 1,
    color: isDark ? "#f1f5f9" : "#0f172a"
  },
  finStatLabel: {
    fontSize: "0.72rem",
    color: isDark ? "#94a3b8" : "#64748b",
    marginTop: 2,
    fontWeight: 500
  },
  finMainPaper: {
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
    boxShadow: isDark
      ? "0 1px 3px rgba(0,0,0,0.4)"
      : "0 1px 3px rgba(15,23,42,0.08)"
  },
  finTableContainer: {
    overflowX: "auto"
  },
  finTableHeaderRow: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.025)"
  },
  finTableHeaderCell: {
    fontWeight: 600,
    fontSize: "0.72rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: isDark ? "#94a3b8" : "#64748b",
    padding: theme.spacing(1.25, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    whiteSpace: "nowrap"
  },
  finTableRow: {
    borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.06)"}`,
    "&:last-child": { borderBottom: "none" },
    "&:hover": {
      backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.02)"
    }
  },
  finTableCell: {
    padding: theme.spacing(1.25, 2),
    fontSize: "0.8rem",
    color: isDark ? "#cbd5e1" : "#334155",
    borderBottom: "none",
    verticalAlign: "middle"
  },
  finStatusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "0.02em",
    whiteSpace: "nowrap"
  },
  finStatusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    flexShrink: 0
  },
  finEmptyState: {
    padding: theme.spacing(7, 3),
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing(1)
  },
  finEmptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing(1),
    color: isDark ? "#475569" : "#94a3b8"
  },
  finEmptyTitle: {
    fontWeight: 600,
    fontSize: "0.95rem",
    color: isDark ? "#cbd5e1" : "#334155"
  }
});
});

// ── Badge de status de fatura (mesmo padrão visual da tela Conexões) ───────
const FINANCIAL_STATUS_CONFIG = {
  paid: {
    label: "Pago",
    dotColor: "#22c55e",
    bg: "rgba(34,197,94,0.10)",
    color: "#16a34a",
    border: "rgba(34,197,94,0.25)"
  },
  open: {
    label: "Em Aberto",
    dotColor: "#f59e0b",
    bg: "rgba(245,158,11,0.10)",
    color: "#d97706",
    border: "rgba(245,158,11,0.25)"
  },
  overdue: {
    label: "Vencido",
    dotColor: "#ef4444",
    bg: "rgba(239,68,68,0.10)",
    color: "#dc2626",
    border: "rgba(239,68,68,0.25)"
  }
};

// helper pra montar URL da imagem (relativa ou absoluta)
const resolveImageUrl = (value) => {
  if (!value) return "";
  if (value.startsWith("http")) return value;

  const base = process.env.REACT_APP_BACKEND_URL || "";
  if (!base) return value;

  const normalizedBase = base.replace(/\/+$/, "");
  const path = value.startsWith("/") ? value : `/${value}`;
  return `${normalizedBase}${path}`;
};

const GlobalConfig = () => {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const { getAll: getAllSettings } = useSettings();

  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingWelcomeTest, setSendingWelcomeTest] = useState(false);
  const [sendingBillingEmailTest, setSendingBillingEmailTest] = useState(false);
  const [sendingBillingWhatsappTest, setSendingBillingWhatsappTest] = useState(false);
  const [welcomeTestEmail, setWelcomeTestEmail] = useState("");
  const [billingTestEmail, setBillingTestEmail] = useState("");
  const [billingTestPhone, setBillingTestPhone] = useState("");
  const [uploading, setUploading] = useState({
    loginLogo: false,
    loginBackground: false
  });
  const [removing, setRemoving] = useState({
    loginLogo: false,
    loginBackground: false
  });

  const [config, setConfig] = useState({
    mpAccessToken: "",
    paymentGateway: "mercadopago",
    asaasApiKey: "",
    asaasWebhookSecret: "",
    efiClientId: "",
    efiClientSecret: "",
    efiCertificate: "",
    efiCertificatePassphrase: "",
    efiPixKey: "",
    efiSandbox: false,
    pushinPayToken: "",
    smtpHost: "",
    smtpPort: "",
    smtpSecure: "false",
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
    welcomeEmailEnabled: "disabled",
    welcomeWhatsappEnabled: "enabled",
    welcomeEmailSubject: "Bem-vindo(a) | Seu acesso foi liberado",
    welcomeEmailTemplate:
      "<div style='font-family:Arial,Helvetica,sans-serif;background:#f4f6fb;padding:24px'><table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb'><tr><td style='background:linear-gradient(135deg,#0f4c81,#136f63);padding:22px 24px;color:#ffffff'><h1 style='margin:0;font-size:20px'>Bem-vindo(a), {name}!</h1><p style='margin:8px 0 0;font-size:13px;opacity:.92'>Seu acesso foi liberado com sucesso.</p></td></tr><tr><td style='padding:24px'><p style='margin:0 0 14px;color:#1f2937;font-size:14px'>Olá, {name}. Abaixo estão os dados iniciais da sua conta:</p><table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px'><tr><td style='padding:14px 16px;color:#111827;font-size:14px;line-height:1.6'><strong>Empresa:</strong> {companyName}<br/><strong>E-mail:</strong> {email}<br/><strong>Senha provisória:</strong> {password}<br/><strong>Vencimento:</strong> {dueDate}</td></tr></table><p style='margin:16px 0 0;color:#374151;font-size:14px'>Acesse: <a href='{loginUrl}' style='color:#0f4c81;text-decoration:none'>{loginUrl}</a></p><p style='margin:18px 0 0;color:#6b7280;font-size:12px'>Por segurança, recomendamos alterar sua senha no primeiro acesso.</p></td></tr><tr><td style='padding:14px 24px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px'>Este é um e-mail automático da plataforma {companyName}.</td></tr></table></div>",
    trialExpiration: "",
    loginLogo: "",
    loginBackground: "",
    loginWhatsapp: "",
    wuzapiBaseUrl: "",
    wuzapiAdminToken: "",
    billingDueEmailEnabled: "disabled",
    billingDueWhatsappEnabled: "disabled",
    billingDueDaysBefore: "3",
    billingDueEmailSubject: "Lembrete: vencimento em {daysToDue} dia(s) - {companyName}",
    billingDueEmailTemplate:
      "<p>Olá, {companyName}.</p><p>Seu vencimento será em <strong>{daysToDue} dia(s)</strong> ({dueDate}).</p><p>Valor atual: <strong>{invoiceValue}</strong>.</p><p>Link da fatura: <a href='{invoiceLink}'>{invoiceLink}</a></p>",
    billingDueWhatsappTemplate:
      "Olá, {companyName}! Lembrete: sua fatura vence em {daysToDue} dia(s), na data {dueDate}. Valor: {invoiceValue}. Link: {invoiceLink}",
    channelWhatsappBaileysEnabled: "enabled",
    channelWhatsappWuzapiEnabled: "enabled",
    channelWhatsappOfficialEnabled: "enabled",
    channelFacebookEnabled: "enabled",
    channelInstagramEnabled: "enabled",
    channelWebchatEnabled: "enabled",
    signupRequireCpfCnpj: "disabled"
  });
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
    totalCompanies: 0,
    activeCompanies: 0,
    expiredCompanies: 0,
    totalUsers: 0,
    onlineUsers: 0,
    totalConnections: 0,
    activeConnections: 0,
    disconnectedConnections: 0
  });
  const [financialLoading, setFinancialLoading] = useState(false);
  const [financialSummary, setFinancialSummary] = useState({
    totalBilled: 0,
    totalReceived: 0,
    totalOpen: 0,
    totalOverdue: 0
  });
  const [financialInvoices, setFinancialInvoices] = useState([]);
  const [financialCount, setFinancialCount] = useState(0);
  const [financialCompaniesList, setFinancialCompaniesList] = useState([]);
  const [financialPage, setFinancialPage] = useState(0);
  const [financialPageSize, setFinancialPageSize] = useState(20);
  const [financialFilters, setFinancialFilters] = useState({
    startDate: "",
    endDate: "",
    status: "all",
    companyId: "",
    searchParam: ""
  });
  const [financialSearchDebounced, setFinancialSearchDebounced] = useState("");

  const [publicFoldersLoading, setPublicFoldersLoading] = useState(false);
  const [publicFoldersDeleting, setPublicFoldersDeleting] = useState(false);
  const [orphanPublicFolders, setOrphanPublicFolders] = useState([]);
  const [selectedOrphanFolders, setSelectedOrphanFolders] = useState([]);
  const [whiteLabelSettings, setWhiteLabelSettings] = useState([]);

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  const handleChange = e => {
    const { name, value } = e.target;

    if (name === "trialExpiration" || name === "billingDueDaysBefore") {
      const onlyDigits = value.replace(/\D/g, "");
      return setConfig(prev => ({ ...prev, [name]: onlyDigits }));
    }

    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleWelcomeEmailToggle = (event) => {
    setConfig(prev => ({
      ...prev,
      welcomeEmailEnabled: event.target.checked ? "enabled" : "disabled"
    }));
  };

  const handleWelcomeWhatsappToggle = (event) => {
    setConfig(prev => ({
      ...prev,
      welcomeWhatsappEnabled: event.target.checked ? "enabled" : "disabled"
    }));
  };

  const handleBillingToggle = (name) => (event) => {
    setConfig(prev => ({
      ...prev,
      [name]: event.target.checked ? "enabled" : "disabled"
    }));
  };

  const handleChannelToggle = (name) => (event) => {
    setConfig(prev => ({
      ...prev,
      [name]: event.target.checked ? "enabled" : "disabled"
    }));
  };

  const handleGlobalToggle = (name) => (event) => {
    setConfig(prev => ({
      ...prev,
      [name]: event.target.checked ? "enabled" : "disabled"
    }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const selectedGateway = String(config.paymentGateway || "").toLowerCase();

    if (selectedGateway === "asaas") {
      if (!String(config.asaasApiKey || "").trim()) {
        toast.error("Informe a API Key do Asaas.");
        return;
      }

      if (!String(config.asaasWebhookSecret || "").trim()) {
        toast.error("Informe o Token de Webhook do Asaas.");
        return;
      }
    }

    if (selectedGateway === "efi") {
      if (!String(config.efiClientId || "").trim()) {
        toast.error("Informe o Client ID da EFI.");
        return;
      }
      if (!String(config.efiClientSecret || "").trim()) {
        toast.error("Informe o Client Secret da EFI.");
        return;
      }
      if (!String(config.efiCertificate || "").trim()) {
        toast.error("Informe o certificado (base64) da EFI.");
        return;
      }
      if (!String(config.efiPixKey || "").trim()) {
        toast.error("Informe a Chave Pix da EFI.");
        return;
      }
    }

    if (selectedGateway === "pushinpay") {
      if (!String(config.pushinPayToken || "").trim()) {
        toast.error("Informe o Token da Pushin Pay.");
        return;
      }
    }

    setSaving(true);

    try {
      await api.put("/global-config", config);
      setConfig(prev => ({
        ...prev
      }));
      toast.success("Configurações salvas com sucesso.");
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const [{ data }, settingsData] = await Promise.all([
        api.get("/global-config"),
        getAllSettings().catch(() => [])
      ]);
      setConfig(prev => ({
        ...prev,
        ...data,
        trialExpiration:
          data.trialExpiration !== undefined && data.trialExpiration !== null
            ? String(data.trialExpiration)
            : prev.trialExpiration
      }));
      setWhiteLabelSettings(Array.isArray(settingsData) ? settingsData : []);
      setWelcomeTestEmail(data?.smtpUser || "");
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.super === false) {
      history.replace("/");
    }
  }, [user, history]);

  useEffect(() => {
    if (user?.super === false) return;
    fetchConfig();
  }, [user]);

  useEffect(() => {
    if (user?.super === false) return;
    if (tab !== 0) return;

    let mounted = true;
    const loadDashboard = async () => {
      setDashboardLoading(true);
      try {
        const { data } = await api.get("/global-config/dashboard-summary");
        if (mounted && data) {
          setDashboardStats(prev => ({ ...prev, ...data }));
        }
      } catch (err) {
        if (mounted) {
          toastError(err);
        }
      } finally {
        if (mounted) setDashboardLoading(false);
      }
    };

    loadDashboard();
    return () => {
      mounted = false;
    };
  }, [tab, user]);

  useEffect(() => {
    if (user?.super === false) return;
    if (tab !== 1) return;

    let mounted = true;
    const loadFinancialCompanies = async () => {
      try {
        const { data } = await api.get("/global-config/financial-companies");
        if (mounted) setFinancialCompaniesList(Array.isArray(data) ? data : []);
      } catch (err) {
        if (mounted) toastError(err);
      }
    };

    loadFinancialCompanies();
    return () => {
      mounted = false;
    };
  }, [tab, user]);

  useEffect(() => {
    if (user?.super === false) return;
    if (tab !== 1) return;

    let mounted = true;
    const loadFinancialSummary = async () => {
      try {
        const { data } = await api.get("/global-config/financial-summary", {
          params: {
            startDate: financialFilters.startDate || undefined,
            endDate: financialFilters.endDate || undefined,
            companyId: financialFilters.companyId || undefined
          }
        });
        if (mounted && data) {
          setFinancialSummary(prev => ({ ...prev, ...data }));
        }
      } catch (err) {
        if (mounted) toastError(err);
      }
    };

    loadFinancialSummary();
    return () => {
      mounted = false;
    };
  }, [tab, user, financialFilters.startDate, financialFilters.endDate, financialFilters.companyId]);

  useEffect(() => {
    if (user?.super === false) return;
    if (tab !== 1) return;

    let mounted = true;
    const loadFinancialInvoices = async () => {
      setFinancialLoading(true);
      try {
        const { data } = await api.get("/global-config/financial-invoices", {
          params: {
            page: financialPage + 1,
            pageSize: financialPageSize,
            startDate: financialFilters.startDate || undefined,
            endDate: financialFilters.endDate || undefined,
            status: financialFilters.status,
            companyId: financialFilters.companyId || undefined,
            searchParam: financialSearchDebounced || undefined
          }
        });
        if (mounted) {
          setFinancialInvoices(Array.isArray(data?.invoices) ? data.invoices : []);
          setFinancialCount(Number(data?.count) || 0);
        }
      } catch (err) {
        if (mounted) toastError(err);
      } finally {
        if (mounted) setFinancialLoading(false);
      }
    };

    loadFinancialInvoices();
    return () => {
      mounted = false;
    };
  }, [
    tab,
    user,
    financialPage,
    financialPageSize,
    financialFilters.startDate,
    financialFilters.endDate,
    financialFilters.status,
    financialFilters.companyId,
    financialSearchDebounced
  ]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setFinancialSearchDebounced(financialFilters.searchParam);
      setFinancialPage(0);
    }, 500);
    return () => clearTimeout(handler);
  }, [financialFilters.searchParam]);

  const handleFinancialFilterChange = (field) => (event) => {
    const { value } = event.target;
    setFinancialFilters(prev => ({ ...prev, [field]: value }));
    if (field !== "searchParam") {
      setFinancialPage(0);
    }
  };

  const getFinancialInvoiceStatus = (record) => {
    const todayIso = moment().format("YYYY-MM-DD");
    const dueDateIso = moment(record.dueDate).format("YYYY-MM-DD");

    if (record.status === "paid") {
      return FINANCIAL_STATUS_CONFIG.paid;
    }
    if (dueDateIso < todayIso) {
      return FINANCIAL_STATUS_CONFIG.overdue;
    }
    return FINANCIAL_STATUS_CONFIG.open;
  };

  useEffect(() => {
    if (!billingTestEmail && user?.email) {
      setBillingTestEmail(String(user.email));
    }
    if (!billingTestPhone && user?.company?.phone) {
      setBillingTestPhone(String(user.company.phone));
    }
  }, [user, billingTestEmail, billingTestPhone]);

  if (user?.super === false) {
    return null;
  }

  const handleBrandingUpload = async (field, file) => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("field", field); // "loginLogo" ou "loginBackground"

    try {
      setUploading(prev => ({ ...prev, [field]: true }));
      const { data } = await api.post("/global-config/upload", formData);

      // backend retorna { field, url }
      const url = data?.url || data?.[field];

      if (url) {
        setConfig(prev => ({
          ...prev,
          [field]: url
        }));
      }

      toast.success("Imagem atualizada com sucesso.");
    } catch (err) {
      toastError(err);
    } finally {
      setUploading(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleBrandingRemove = async (field) => {
    try {
      setRemoving(prev => ({ ...prev, [field]: true }));
      await api.post("/global-config/upload/remove", { field });

      setConfig(prev => ({
        ...prev,
        [field]: ""
      }));

      toast.success("Imagem removida com sucesso.");
    } catch (err) {
      toastError(err);
    } finally {
      setRemoving(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleSendWelcomeEmailTest = async () => {
    if (!welcomeTestEmail) {
      toast.error("Informe um e-mail para teste.");
      return;
    }

    setSendingWelcomeTest(true);
    try {
      await api.post("/global-config/test-welcome-email", {
        testEmail: welcomeTestEmail,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpSecure: config.smtpSecure,
        smtpUser: config.smtpUser,
        smtpPass: config.smtpPass,
        smtpFrom: config.smtpFrom,
        welcomeEmailEnabled: config.welcomeEmailEnabled,
        welcomeEmailSubject: config.welcomeEmailSubject,
        welcomeEmailTemplate: config.welcomeEmailTemplate
      });
      toast.success("E-mail de teste enviado com sucesso.");
    } catch (err) {
      toastError(err);
    } finally {
      setSendingWelcomeTest(false);
    }
  };

  const handleSendBillingDueEmailTest = async () => {
    if (!String(billingTestEmail).trim()) {
      toast.error("Informe um e-mail para teste.");
      return;
    }

    setSendingBillingEmailTest(true);
    try {
      await api.post("/global-config/test-billing-due-email", {
        testEmail: String(billingTestEmail).trim(),
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpSecure: config.smtpSecure,
        smtpUser: config.smtpUser,
        smtpPass: config.smtpPass,
        smtpFrom: config.smtpFrom,
        billingDueEmailSubject: config.billingDueEmailSubject,
        billingDueEmailTemplate: config.billingDueEmailTemplate
      });
      toast.success("E-mail de teste de vencimento enviado com sucesso.");
    } catch (err) {
      toastError(err);
    } finally {
      setSendingBillingEmailTest(false);
    }
  };

  const handleSendBillingDueWhatsappTest = async () => {
    if (!String(billingTestPhone).trim()) {
      toast.error("Informe um telefone para teste.");
      return;
    }

    setSendingBillingWhatsappTest(true);
    try {
      await api.post("/global-config/test-billing-due-whatsapp", {
        testPhone: String(billingTestPhone).trim(),
        billingDueWhatsappTemplate: config.billingDueWhatsappTemplate
      });
      toast.success("WhatsApp de teste de vencimento enviado com sucesso.");
    } catch (err) {
      toastError(err);
    } finally {
      setSendingBillingWhatsappTest(false);
    }
  };

  const formatBytes = (bytes) => {
    const value = Number(bytes || 0);
    if (value >= 1024 ** 3) {
      return `${(value / (1024 ** 3)).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} GB`;
    }
    if (value >= 1024 ** 2) {
      return `${(value / (1024 ** 2)).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} MB`;
    }
    if (value >= 1024) {
      return `${(value / 1024).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} KB`;
    }
    return `${value} B`;
  };

  const loadOrphanPublicFolders = async () => {
    setPublicFoldersLoading(true);
    try {
      const { data } = await api.get("/companies/public-folders/orphans");
      const folders = Array.isArray(data?.folders) ? data.folders : [];
      setOrphanPublicFolders(folders);
      setSelectedOrphanFolders([]);
    } catch (err) {
      toast.error("Não foi possível carregar as pastas órfãs da Pasta Public.");
    } finally {
      setPublicFoldersLoading(false);
    }
  };

  const handleToggleOrphanFolder = (companyId) => {
    setSelectedOrphanFolders((current) =>
      current.includes(companyId)
        ? current.filter((id) => id !== companyId)
        : [...current, companyId]
    );
  };

  const handleDeleteOrphanFolders = async (companyIds) => {
    const normalizedIds = Array.from(
      new Set(
        (Array.isArray(companyIds) ? companyIds : [])
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 1)
      )
    );

    if (!normalizedIds.length) {
      toast.info("Selecione ao menos uma pasta órfã para excluir.");
      return;
    }

    const confirmed = window.confirm(
      `Confirma a exclusão definitiva de ${normalizedIds.length} pasta(s) órfã(s) da Pasta Public?`
    );

    if (!confirmed) return;

    setPublicFoldersDeleting(true);
    try {
      const { data } = await api.post("/companies/public-folders/orphans/delete", {
        companyIds: normalizedIds
      });

      const removedCount = Array.isArray(data?.removed) ? data.removed.length : 0;
      const skippedCount = Array.isArray(data?.skipped) ? data.skipped.length : 0;

      if (removedCount > 0) {
        toast.success(`${removedCount} pasta(s) órfã(s) removida(s) com sucesso.`);
      }

      if (skippedCount > 0) {
        toast.info(`${skippedCount} pasta(s) não foram removidas por segurança.`);
      }

      await loadOrphanPublicFolders();
    } catch (err) {
      toast.error("Não foi possível excluir as pastas órfãs selecionadas.");
    } finally {
      setPublicFoldersDeleting(false);
    }
  };

  const formId = "global-config-form";

  const renderSaveButton = (extraActions = null, sticky = false) => (
    <div className={`${classes.actions} ${sticky ? classes.actionsSticky : ""}`}>
      {extraActions}
      <Button
        type="submit"
        color="primary"
        variant="contained"
        className={classes.button}
        startIcon={!saving && <Save />}
        disabled={saving}
      >
        {saving ? <CircularProgress size={20} /> : "Salvar"}
      </Button>
    </div>
  );

  const publicFolderCard = (
    <Grid item xs={12} md={6}>
      <Paper elevation={0} style={{ borderRadius: 14, border: "1px solid #e5e7eb", padding: 16, height: "100%" }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography className={classes.sectionTitle}>Pasta Public</Typography>
          <FolderOpen style={{ color: "#1d4ed8", fontSize: 18 }} />
        </Box>

        <Typography className={classes.sectionDescription} style={{ marginBottom: 12 }}>
          Auditoria e limpeza de pastas órfãs de empresas antigas já excluídas do sistema.
        </Typography>

        <div className={classes.actions} style={{ marginTop: 0, justifyContent: "flex-start", gap: 8, flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={publicFoldersLoading ? <CircularProgress size={16} /> : <FolderOpen />}
            onClick={loadOrphanPublicFolders}
            disabled={publicFoldersLoading || publicFoldersDeleting}
          >
            Carregar arquivos
          </Button>
          <Button
            variant="outlined"
            style={{ color: "#b91c1c", borderColor: "#fecaca" }}
            startIcon={publicFoldersDeleting ? <CircularProgress size={16} /> : <DeleteSweep />}
            onClick={() => handleDeleteOrphanFolders(selectedOrphanFolders)}
            disabled={!selectedOrphanFolders.length || publicFoldersLoading || publicFoldersDeleting}
          >
            Excluir selecionados
          </Button>
        </div>

        <Box mt={2} display="flex" flexWrap="wrap" gridGap={8}>
          <Chip
            label={`${orphanPublicFolders.length} pasta(s) órfã(s)`}
            size="small"
            style={{ backgroundColor: "#e0e7ff", color: "#3730a3", fontWeight: 600 }}
          />
          <Chip
            label={`${selectedOrphanFolders.length} selecionada(s)`}
            size="small"
            style={{ backgroundColor: "#fee2e2", color: "#991b1b", fontWeight: 600 }}
          />
        </Box>

        {!orphanPublicFolders.length && !publicFoldersLoading ? (
          <Box
            mt={2}
            px={2}
            py={3}
            textAlign="center"
            border="1px dashed #d1d5db"
            borderRadius="10px"
            color="#6b7280"
          >
            <Typography style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: 4 }}>
              Nenhuma pasta órfã carregada
            </Typography>
            <Typography style={{ fontSize: "0.75rem" }}>
              Use o botão "Carregar arquivos" para localizar pastas <code>company{"{ID}"}</code> sem empresa correspondente no banco.
            </Typography>
          </Box>
        ) : null}

        {orphanPublicFolders.length > 0 && (
          <Box mt={2}>
            <TableContainer style={{ border: "1px solid #e5e7eb", borderRadius: 10, maxHeight: 360 }}>
              <Table size="small" stickyHeader>
                <TableHead style={{ backgroundColor: "#f9fafb" }}>
                  <TableRow>
                    <TableCell style={{ width: 60, fontSize: "0.75rem", fontWeight: 600 }}>Sel.</TableCell>
                    <TableCell style={{ fontSize: "0.75rem", fontWeight: 600 }}>Pasta</TableCell>
                    <TableCell style={{ fontSize: "0.75rem", fontWeight: 600 }}>Tamanho</TableCell>
                    <TableCell style={{ fontSize: "0.75rem", fontWeight: 600 }}>Arquivos</TableCell>
                    <TableCell style={{ fontSize: "0.75rem", fontWeight: 600 }}>Última alteração</TableCell>
                    <TableCell style={{ fontSize: "0.75rem", fontWeight: 600 }}>Ação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orphanPublicFolders.map((folder) => {
                    const checked = selectedOrphanFolders.includes(Number(folder.companyId));

                    return (
                      <TableRow key={folder.companyId} hover>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleOrphanFolder(Number(folder.companyId))}
                          />
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                              {folder.folderName}
                            </Typography>
                            <Typography style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                              {folder.folderPath}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>{formatBytes(folder.bytes)}</TableCell>
                        <TableCell>{Number(folder.filesCount || 0).toLocaleString("pt-BR")}</TableCell>
                        <TableCell>
                          {folder.updatedAt ? new Date(folder.updatedAt).toLocaleString("pt-BR") : "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            style={{ color: "#b91c1c" }}
                            onClick={() => handleDeleteOrphanFolders([folder.companyId])}
                            disabled={publicFoldersLoading || publicFoldersDeleting}
                          >
                            Excluir
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>
    </Grid>
  );

  if (loading) {
    return (
      <div className={classes.root}>
        <div className={classes.loadingWrapper}>
          <CircularProgress />
        </div>
      </div>
    );
  }

  return (
    <div className={classes.root}>
      <Tabs
        value={tab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        indicatorColor="primary"
        textColor="primary"
        className={classes.tabs}
      >
        <Tab icon={<Dashboard className={classes.tabIcon} />} label="Dashboard" />
        <Tab icon={<AccountBalance className={classes.tabIcon} />} label="Financeiro" />
        <Tab icon={<MonetizationOn className={classes.tabIcon} />} label="Meios de Pagamento" />
        <Tab icon={<Tune className={classes.tabIcon} />} label="Configurações" />
        <Tab icon={<SettingsEthernet className={classes.tabIcon} />} label="WuzAPI" />
        <Tab icon={<Collections className={classes.tabIcon} />} label="White Label" />
      </Tabs>

      <form id={formId} onSubmit={handleSubmit} className={classes.form}>
        {/* ABA 0: DASHBOARD */}
        {tab === 0 && (
          <Paper elevation={0} className={classes.sectionCard}>
            {dashboardLoading ? (
              <div className={classes.loadingWrapper}>
                <CircularProgress size={24} />
              </div>
            ) : (
              <div className={classes.finStatsRow}>
                <div className={classes.finStatCard}>
                  <div className={classes.finStatIconWrap} style={{ backgroundColor: "rgba(99,102,241,0.1)" }}>
                    <Business style={{ fontSize: 20, color: "#6366f1" }} />
                  </div>
                  <div>
                    <div className={classes.finStatValue}>{dashboardStats.totalCompanies}</div>
                    <div className={classes.finStatLabel}>Empresas cadastradas</div>
                  </div>
                </div>
                <div className={classes.finStatCard}>
                  <div className={classes.finStatIconWrap} style={{ backgroundColor: "rgba(34,197,94,0.1)" }}>
                    <CheckCircle style={{ fontSize: 20, color: "#22c55e" }} />
                  </div>
                  <div>
                    <div className={classes.finStatValue}>{dashboardStats.activeCompanies}</div>
                    <div className={classes.finStatLabel}>Empresas Ativas</div>
                  </div>
                </div>
                <div className={classes.finStatCard}>
                  <div className={classes.finStatIconWrap} style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
                    <ErrorOutline style={{ fontSize: 20, color: "#ef4444" }} />
                  </div>
                  <div>
                    <div className={classes.finStatValue}>{dashboardStats.expiredCompanies}</div>
                    <div className={classes.finStatLabel}>Empresas Vencidas</div>
                  </div>
                </div>
                <div className={classes.finStatCard}>
                  <div className={classes.finStatIconWrap} style={{ backgroundColor: "rgba(59,130,246,0.1)" }}>
                    <People style={{ fontSize: 20, color: "#3b82f6" }} />
                  </div>
                  <div>
                    <div className={classes.finStatValue}>{dashboardStats.totalUsers}</div>
                    <div className={classes.finStatLabel}>Total de Usuários</div>
                  </div>
                </div>
                <div className={classes.finStatCard}>
                  <div className={classes.finStatIconWrap} style={{ backgroundColor: "rgba(6,182,212,0.1)" }}>
                    <People style={{ fontSize: 20, color: "#06b6d4" }} />
                  </div>
                  <div>
                    <div className={classes.finStatValue}>{dashboardStats.onlineUsers}</div>
                    <div className={classes.finStatLabel}>Usuários Online</div>
                  </div>
                </div>
                <div className={classes.finStatCard}>
                  <div className={classes.finStatIconWrap} style={{ backgroundColor: "rgba(168,85,247,0.1)" }}>
                    <LinkIcon style={{ fontSize: 20, color: "#a855f7" }} />
                  </div>
                  <div>
                    <div className={classes.finStatValue}>{dashboardStats.totalConnections}</div>
                    <div className={classes.finStatLabel}>Total de Conexões</div>
                  </div>
                </div>
                <div className={classes.finStatCard}>
                  <div className={classes.finStatIconWrap} style={{ backgroundColor: "rgba(16,185,129,0.1)" }}>
                    <LinkIcon style={{ fontSize: 20, color: "#10b981" }} />
                  </div>
                  <div>
                    <div className={classes.finStatValue}>{dashboardStats.activeConnections}</div>
                    <div className={classes.finStatLabel}>Conexões Ativas</div>
                  </div>
                </div>
                <div className={classes.finStatCard}>
                  <div className={classes.finStatIconWrap} style={{ backgroundColor: "rgba(245,158,11,0.1)" }}>
                    <LinkOff style={{ fontSize: 20, color: "#f59e0b" }} />
                  </div>
                  <div>
                    <div className={classes.finStatValue}>{dashboardStats.disconnectedConnections}</div>
                    <div className={classes.finStatLabel}>Conexões Desconectadas</div>
                  </div>
                </div>
              </div>
            )}

            <Box mt={3}>
              <Typography variant="subtitle1" className={classes.sectionTitle}>
                Dados do Servidor
              </Typography>
              <ServerMetrics embedded hideAccessCheck extraCards={publicFolderCard} />
            </Box>
          </Paper>
        )}

        {/* ABA 1: MEIOS DE PAGAMENTO */}
        {tab === 2 && (
          <Paper elevation={0} className={classes.sectionCard}>
            <Typography className={classes.finHeaderTitle}>Pagamentos</Typography>
            <Typography className={classes.finHeaderSubtitle}>
              Selecione o gateway padrão da plataforma e configure as credenciais.
            </Typography>

            <div className={classes.finFormCard}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    select
                    label="Gateway padrão"
                    name="paymentGateway"
                    value={config.paymentGateway || "mercadopago"}
                    onChange={handleChange}
                    variant="outlined"
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="mercadopago">Mercado Pago</MenuItem>
                    <MenuItem value="asaas">Asaas</MenuItem>
                    <MenuItem value="efi">EFI Bank (Pix)</MenuItem>
                    <MenuItem value="pushinpay">Pushin Pay (Pix)</MenuItem>
                  </TextField>
                  <div className={classes.helperText} style={{ marginBottom: 0 }}>
                    Define qual gateway será usado no botão de pagamento das faturas.
                  </div>
                </Grid>
              </Grid>
            </div>

            {String(config.paymentGateway || "").toLowerCase() === "mercadopago" && (
              <div className={classes.finFormCard}>
                <TextField
                  label="Mercado Pago - Access Token"
                  name="mpAccessToken"
                  value={config.mpAccessToken}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  className={classes.textField}
                  size="small"
                />
                <div className={classes.helperText} style={{ marginBottom: 0 }}>
                  Use o Access Token do Mercado Pago da conta principal da
                  plataforma. As empresas clientes usarão sempre essa
                  configuração.
                </div>
              </div>
            )}

            {String(config.paymentGateway || "").toLowerCase() === "asaas" && (
              <div className={classes.finFormCard}>
                <TextField
                  label="Asaas - API Key"
                  name="asaasApiKey"
                  value={config.asaasApiKey}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  className={classes.textField}
                  size="small"
                />
                <div className={classes.helperText}>
                  API Key do Asaas usada para criar cobranças.
                </div>
                <TextField
                  label="Asaas - Token de Webhook"
                  name="asaasWebhookSecret"
                  value={config.asaasWebhookSecret}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  required
                  className={classes.textField}
                  size="small"
                />
                <div className={classes.helperText} style={{ marginBottom: 0 }}>
                  URL do webhook Asaas: <strong>{`${process.env.REACT_APP_BACKEND_URL || ""}/subscription/webhook/asaas`}</strong>
                </div>
              </div>
            )}

            {String(config.paymentGateway || "").toLowerCase() === "efi" && (
              <div className={classes.finFormCard}>
                <TextField
                  label="EFI - Client ID"
                  name="efiClientId"
                  value={config.efiClientId}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  className={classes.textField}
                  size="small"
                />
                <TextField
                  label="EFI - Client Secret"
                  name="efiClientSecret"
                  value={config.efiClientSecret}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  className={classes.textField}
                  size="small"
                  type="password"
                />
                <TextField
                  label="EFI - Certificado (base64 do .p12)"
                  name="efiCertificate"
                  value={config.efiCertificate}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  multiline
                  minRows={4}
                  className={classes.textField}
                  size="small"
                  helperText="Cole aqui o conteúdo do certificado .p12 convertido para base64 (ex: base64 -w0 certificado.p12)."
                />
                <TextField
                  label="EFI - Senha do certificado (se houver)"
                  name="efiCertificatePassphrase"
                  value={config.efiCertificatePassphrase}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  className={classes.textField}
                  size="small"
                  type="password"
                />
                <TextField
                  label="EFI - Chave Pix cadastrada"
                  name="efiPixKey"
                  value={config.efiPixKey}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  className={classes.textField}
                  size="small"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!config.efiSandbox}
                      onChange={e =>
                        setConfig(prev => ({ ...prev, efiSandbox: e.target.checked }))
                      }
                      classes={{
                        root: classes.iosSwitchRoot,
                        switchBase: classes.iosSwitchBase,
                        thumb: classes.iosSwitchThumb,
                        track: classes.iosSwitchTrack
                      }}
                    />
                  }
                  label="Usar ambiente de homologação (sandbox)"
                />
                <div className={classes.helperText} style={{ marginBottom: 0 }}>
                  URL do webhook EFI: <strong>{`${process.env.REACT_APP_BACKEND_URL || ""}/subscription/webhook/efi`}</strong>. Configure-a manualmente no painel EFI (Área Pix &gt; Webhooks) usando sua chave Pix.
                </div>
              </div>
            )}

            {String(config.paymentGateway || "").toLowerCase() === "pushinpay" && (
              <div className={classes.finFormCard}>
                <TextField
                  label="Pushin Pay - Token"
                  name="pushinPayToken"
                  value={config.pushinPayToken}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  className={classes.textField}
                  size="small"
                  type="password"
                />
                <div className={classes.helperText} style={{ marginBottom: 0 }}>
                  URL do webhook Pushin Pay: <strong>{`${process.env.REACT_APP_BACKEND_URL || ""}/subscription/webhook/pushinpay`}</strong> (já é enviada automaticamente em cada cobrança criada).
                </div>
              </div>
            )}
            {renderSaveButton(null, true)}
          </Paper>
        )}

        {/* ABA 2: SMTP */}
        {tab === 3 && (
          <Paper elevation={0} className={`${classes.sectionCard} ${classes.sectionCardScrollable}`}>
            <Accordion className={classes.accordion}>
              <AccordionSummary expandIcon={<ExpandMore />} className={classes.accordionSummary}>
                <div className={classes.accordionSummaryContent}>
                  <span className={`${classes.accordionSummaryIcon} ${classes.iconWelcomeWhatsapp}`}>
                    <Tune />
                  </span>
                  <Typography variant="subtitle2">Canais Disponíveis</Typography>
                </div>
              </AccordionSummary>
              <AccordionDetails className={classes.accordionDetails}>
                <Paper elevation={0} className={classes.smtpRowCard}>
                  <FormControlLabel
                    className={classes.switchFieldLabel}
                    control={
                      <Switch
                        checked={String(config.channelWhatsappBaileysEnabled) === "enabled"}
                        onChange={handleChannelToggle("channelWhatsappBaileysEnabled")}
                        color="primary"
                        disableRipple
                        classes={{
                          root: classes.iosSwitchRoot,
                          switchBase: classes.iosSwitchBase,
                          thumb: classes.iosSwitchThumb,
                          track: classes.iosSwitchTrack
                        }}
                      />
                    }
                    label="WhatsApp (Baileys)"
                  />
                  <FormControlLabel
                    className={classes.switchFieldLabel}
                    control={
                      <Switch
                        checked={String(config.channelWhatsappWuzapiEnabled) === "enabled"}
                        onChange={handleChannelToggle("channelWhatsappWuzapiEnabled")}
                        color="primary"
                        disableRipple
                        classes={{
                          root: classes.iosSwitchRoot,
                          switchBase: classes.iosSwitchBase,
                          thumb: classes.iosSwitchThumb,
                          track: classes.iosSwitchTrack
                        }}
                      />
                    }
                    label="WhatsApp (wuzAPI)"
                  />
                  <FormControlLabel
                    className={classes.switchFieldLabel}
                    control={
                      <Switch
                        checked={String(config.channelWhatsappOfficialEnabled) === "enabled"}
                        onChange={handleChannelToggle("channelWhatsappOfficialEnabled")}
                        color="primary"
                        disableRipple
                        classes={{
                          root: classes.iosSwitchRoot,
                          switchBase: classes.iosSwitchBase,
                          thumb: classes.iosSwitchThumb,
                          track: classes.iosSwitchTrack
                        }}
                      />
                    }
                    label="WhatsApp (API Oficial)"
                  />
                  <FormControlLabel
                    className={classes.switchFieldLabel}
                    control={
                      <Switch
                        checked={String(config.channelFacebookEnabled) === "enabled"}
                        onChange={handleChannelToggle("channelFacebookEnabled")}
                        color="primary"
                        disableRipple
                        classes={{
                          root: classes.iosSwitchRoot,
                          switchBase: classes.iosSwitchBase,
                          thumb: classes.iosSwitchThumb,
                          track: classes.iosSwitchTrack
                        }}
                      />
                    }
                    label="Facebook"
                  />
                  <FormControlLabel
                    className={classes.switchFieldLabel}
                    control={
                      <Switch
                        checked={String(config.channelInstagramEnabled) === "enabled"}
                        onChange={handleChannelToggle("channelInstagramEnabled")}
                        color="primary"
                        disableRipple
                        classes={{
                          root: classes.iosSwitchRoot,
                          switchBase: classes.iosSwitchBase,
                          thumb: classes.iosSwitchThumb,
                          track: classes.iosSwitchTrack
                        }}
                      />
                    }
                    label="Instagram"
                  />
                  <FormControlLabel
                    className={classes.switchFieldLabel}
                    control={
                      <Switch
                        checked={String(config.channelWebchatEnabled) === "enabled"}
                        onChange={handleChannelToggle("channelWebchatEnabled")}
                        color="primary"
                        disableRipple
                        classes={{
                          root: classes.iosSwitchRoot,
                          switchBase: classes.iosSwitchBase,
                          thumb: classes.iosSwitchThumb,
                          track: classes.iosSwitchTrack
                        }}
                      />
                    }
                    label="Webchat"
                  />
                </Paper>
              </AccordionDetails>
            </Accordion>

            <Accordion className={classes.accordion}>
              <AccordionSummary expandIcon={<ExpandMore />} className={classes.accordionSummary}>
                <div className={classes.accordionSummaryContent}>
                  <span className={`${classes.accordionSummaryIcon} ${classes.iconTrial}`}>
                    <AvTimer />
                  </span>
                  <Typography variant="subtitle2">Trial / Assinatura</Typography>
                </div>
              </AccordionSummary>
              <AccordionDetails className={classes.accordionDetails}>
                <TextField
                  label="Dias de teste"
                  name="trialExpiration"
                  value={config.trialExpiration}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  className={classes.compactField}
                  size="small"
                  type="number"
                  inputProps={{ min: 1 }}
                />
                <div className={classes.helperText} style={{ marginBottom: 0 }}>
                  Quantidade de dias de teste que a empresa nova terá. Se vazio,
                  o sistema usa o valor padrão do .env (APP_TRIALEXPIRATION, ex.: 3).
                </div>
              </AccordionDetails>
            </Accordion>

            <Accordion className={classes.accordion}>
              <AccordionSummary expandIcon={<ExpandMore />} className={classes.accordionSummary}>
                <div className={classes.accordionSummaryContent}>
                  <span className={`${classes.accordionSummaryIcon} ${classes.iconWelcomeEmail}`}>
                    <Tune />
                  </span>
                  <Typography variant="subtitle2">Configurações Globais</Typography>
                </div>
              </AccordionSummary>
              <AccordionDetails className={classes.accordionDetails}>
                <Paper elevation={0} className={classes.smtpRowCard}>
                  <FormControlLabel
                    className={classes.switchFieldLabel}
                    control={
                      <Switch
                        checked={String(config.signupRequireCpfCnpj) === "enabled"}
                        onChange={handleGlobalToggle("signupRequireCpfCnpj")}
                        color="primary"
                        disableRipple
                        classes={{
                          root: classes.iosSwitchRoot,
                          switchBase: classes.iosSwitchBase,
                          thumb: classes.iosSwitchThumb,
                          track: classes.iosSwitchTrack
                        }}
                      />
                    }
                    label="Exigir CPF ou CNPJ no cadastro"
                  />
                </Paper>
                <div className={classes.helperText} style={{ marginBottom: 0 }}>
                  Quando ativado, o formulário de cadastro passa a exigir um único campo de CPF ou CNPJ.
                </div>
              </AccordionDetails>
            </Accordion>

            <Accordion className={classes.accordion}>
              <AccordionSummary expandIcon={<ExpandMore />} className={classes.accordionSummary}>
                <div className={classes.accordionSummaryContent}>
                  <span className={`${classes.accordionSummaryIcon} ${classes.iconSmtp}`}>
                    <MailOutline />
                  </span>
                  <Typography variant="subtitle2">E-mail (SMTP e Recuperação de Senha)</Typography>
                </div>
              </AccordionSummary>
              <AccordionDetails className={classes.accordionDetails}>
                <TextField
                  label="Host"
                  name="smtpHost"
                  value={config.smtpHost}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  className={classes.compactField}
                  size="small"
                />
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <TextField
                      label="Porta"
                      name="smtpPort"
                      value={config.smtpPort}
                      onChange={handleChange}
                      variant="outlined"
                      fullWidth
                      className={classes.compactField}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Secure"
                      name="smtpSecure"
                      value={config.smtpSecure}
                      onChange={handleChange}
                      variant="outlined"
                      fullWidth
                      className={classes.compactField}
                      size="small"
                    />
                  </Grid>
                </Grid>
                <TextField
                  label="E-mail"
                  name="smtpUser"
                  value={config.smtpUser}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  className={classes.compactField}
                  size="small"
                />
                <TextField
                  label="Senha de app"
                  name="smtpPass"
                  value={config.smtpPass}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  className={classes.compactField}
                  size="small"
                  type="password"
                />
                <TextField
                  label="Remetente (FROM)"
                  name="smtpFrom"
                  value={config.smtpFrom}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  className={classes.compactField}
                  size="small"
                />
                <div className={classes.helperText} style={{ marginBottom: 0 }}>
                  Use `true` em Secure para SSL/TLS e `false` para STARTTLS.
                </div>
              </AccordionDetails>
            </Accordion>

            <Accordion className={classes.accordion}>
              <AccordionSummary expandIcon={<ExpandMore />} className={classes.accordionSummary}>
                <div className={classes.accordionSummaryContent}>
                  <span className={`${classes.accordionSummaryIcon} ${classes.iconWelcomeEmail}`}>
                    <Drafts />
                  </span>
                  <Typography variant="subtitle2">E-mail de Boas-vindas</Typography>
                </div>
              </AccordionSummary>
              <AccordionDetails className={classes.accordionDetails}>
                <Paper elevation={0} className={classes.smtpRowCard}>
                  <FormControlLabel
                    className={classes.switchFieldLabel}
                    control={
                      <Switch
                        checked={String(config.welcomeEmailEnabled) === "enabled"}
                        onChange={handleWelcomeEmailToggle}
                        color="primary"
                        disableRipple
                        classes={{
                          root: classes.iosSwitchRoot,
                          switchBase: classes.iosSwitchBase,
                          thumb: classes.iosSwitchThumb,
                          track: classes.iosSwitchTrack
                        }}
                      />
                    }
                    label="Enviar e-mail de boas-vindas automaticamente"
                  />
                  <div className={classes.helperText} style={{ marginBottom: 0 }}>
                    Ative para disparar e-mail no cadastro de empresas e usuários.
                  </div>
                </Paper>

                <TextField
                  label="Assunto do e-mail de boas-vindas"
                  name="welcomeEmailSubject"
                  value={config.welcomeEmailSubject}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  className={classes.compactField}
                  size="small"
                  disabled={String(config.welcomeEmailEnabled) !== "enabled"}
                />

                <TextField
                  label="Conteúdo HTML do e-mail"
                  name="welcomeEmailTemplate"
                  value={config.welcomeEmailTemplate}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  className={classes.compactField}
                  multiline
                  minRows={5}
                  disabled={String(config.welcomeEmailEnabled) !== "enabled"}
                />
                <div className={classes.helperText}>
                  Variáveis: {"{name}, {companyName}, {email}, {password}, {dueDate}, {loginUrl}"}.
                </div>

                <Typography variant="subtitle2" style={{ marginBottom: 8 }}>
                  Pré-visualização
                </Typography>
                <Box
                  className={classes.templatePreview}
                  dangerouslySetInnerHTML={{
                    __html: config.welcomeEmailTemplate || "<p>Template vazio</p>"
                  }}
                />

                <Grid container spacing={1} style={{ marginTop: 8 }}>
                  <Grid item xs={12} sm={8}>
                    <TextField
                      label="E-mail para teste"
                      value={welcomeTestEmail}
                      onChange={(e) => setWelcomeTestEmail(e.target.value)}
                      variant="outlined"
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Button
                      variant="outlined"
                      color="primary"
                      fullWidth
                      style={{ height: 40 }}
                      onClick={handleSendWelcomeEmailTest}
                      disabled={sendingWelcomeTest}
                    >
                      {sendingWelcomeTest ? "Enviando..." : "Enviar teste"}
                    </Button>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            <Accordion className={classes.accordion}>
              <AccordionSummary expandIcon={<ExpandMore />} className={classes.accordionSummary}>
                <div className={classes.accordionSummaryContent}>
                  <span className={`${classes.accordionSummaryIcon} ${classes.iconWelcomeWhatsapp}`}>
                    <WhatsApp />
                  </span>
                  <Typography variant="subtitle2">WhatsApp de Boas-vindas</Typography>
                </div>
              </AccordionSummary>
              <AccordionDetails className={classes.accordionDetails}>
                <Paper elevation={0} className={classes.smtpRowCard}>
                  <FormControlLabel
                    className={classes.switchFieldLabel}
                    control={
                      <Switch
                        checked={String(config.welcomeWhatsappEnabled) === "enabled"}
                        onChange={handleWelcomeWhatsappToggle}
                        color="primary"
                        disableRipple
                        classes={{
                          root: classes.iosSwitchRoot,
                          switchBase: classes.iosSwitchBase,
                          thumb: classes.iosSwitchThumb,
                          track: classes.iosSwitchTrack
                        }}
                      />
                    }
                    label="Enviar WhatsApp de boas-vindas automaticamente"
                  />
                  <div className={classes.helperText} style={{ marginBottom: 0 }}>
                    Ative para enviar WhatsApp de boas-vindas no cadastro de empresas (signup).
                  </div>
                </Paper>
              </AccordionDetails>
            </Accordion>

            <Accordion className={classes.accordion}>
              <AccordionSummary expandIcon={<ExpandMore />} className={classes.accordionSummary}>
                <div className={classes.accordionSummaryContent}>
                  <span className={`${classes.accordionSummaryIcon} ${classes.iconWelcomeEmail}`}>
                    <MonetizationOn />
                  </span>
                  <Typography variant="subtitle2">Aviso de Vencimento - Faturas</Typography>
                </div>
              </AccordionSummary>
              <AccordionDetails className={classes.accordionDetails}>
                <Paper elevation={0} className={classes.smtpRowCard}>
                  <FormControlLabel
                    className={classes.switchFieldLabel}
                    control={
                      <Switch
                        checked={String(config.billingDueEmailEnabled) === "enabled"}
                        onChange={handleBillingToggle("billingDueEmailEnabled")}
                        color="primary"
                        disableRipple
                        classes={{
                          root: classes.iosSwitchRoot,
                          switchBase: classes.iosSwitchBase,
                          thumb: classes.iosSwitchThumb,
                          track: classes.iosSwitchTrack
                        }}
                      />
                    }
                    label="Enviar aviso de vencimento por e-mail"
                  />
                  <FormControlLabel
                    className={classes.switchFieldLabel}
                    control={
                      <Switch
                        checked={String(config.billingDueWhatsappEnabled) === "enabled"}
                        onChange={handleBillingToggle("billingDueWhatsappEnabled")}
                        color="primary"
                        disableRipple
                        classes={{
                          root: classes.iosSwitchRoot,
                          switchBase: classes.iosSwitchBase,
                          thumb: classes.iosSwitchThumb,
                          track: classes.iosSwitchTrack
                        }}
                      />
                    }
                    label="Enviar aviso de vencimento por WhatsApp"
                  />
                </Paper>
                <TextField
                  label="Dias antes do vencimento"
                  name="billingDueDaysBefore"
                  value={config.billingDueDaysBefore}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  className={classes.compactField}
                  size="small"
                  type="number"
                  inputProps={{ min: 1 }}
                />
                <TextField
                  label="Assunto do e-mail"
                  name="billingDueEmailSubject"
                  value={config.billingDueEmailSubject}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  className={classes.compactField}
                  size="small"
                />
                <TextField
                  label="Template do e-mail (HTML)"
                  name="billingDueEmailTemplate"
                  value={config.billingDueEmailTemplate}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  className={classes.compactField}
                  multiline
                  minRows={4}
                />
                <TextField
                  label="Template do WhatsApp"
                  name="billingDueWhatsappTemplate"
                  value={config.billingDueWhatsappTemplate}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  className={classes.compactField}
                  multiline
                  minRows={3}
                />
                <TextField
                  label="E-mail para teste"
                  value={billingTestEmail}
                  onChange={(e) => setBillingTestEmail(e.target.value)}
                  variant="outlined"
                  fullWidth
                  className={classes.compactField}
                  size="small"
                />
                <TextField
                  label="WhatsApp para teste (com DDD)"
                  value={billingTestPhone}
                  onChange={(e) => setBillingTestPhone(e.target.value)}
                  variant="outlined"
                  fullWidth
                  className={classes.compactField}
                  size="small"
                  placeholder="11999998888"
                />
                <div className={classes.helperText}>
                  Variáveis: {"{companyName}, {dueDate}, {daysToDue}, {invoiceValue}, {invoiceLink}"}.
                </div>
                <div className={classes.actions} style={{ marginTop: 8 }}>
                  <Button
                    type="button"
                    variant="outlined"
                    color="primary"
                    onClick={handleSendBillingDueEmailTest}
                    disabled={sendingBillingEmailTest || sendingBillingWhatsappTest || saving}
                    style={{ marginRight: 8 }}
                  >
                    {sendingBillingEmailTest ? "Enviando e-mail..." : "Testar envio e-mail"}
                  </Button>
                  <Button
                    type="button"
                    variant="outlined"
                    color="primary"
                    onClick={handleSendBillingDueWhatsappTest}
                    disabled={sendingBillingWhatsappTest || sendingBillingEmailTest || saving}
                    style={{ marginRight: 8 }}
                  >
                    {sendingBillingWhatsappTest ? "Enviando WhatsApp..." : "Testar envio WhatsApp"}
                  </Button>
                </div>
              </AccordionDetails>
            </Accordion>
          </Paper>
        )}

        {/* ABA 3: WUZAPI */}
        {tab === 4 && (
          <Paper elevation={0} className={classes.sectionCard}>
            <Typography className={classes.finHeaderTitle}>WuzAPI</Typography>
            <Typography className={classes.finHeaderSubtitle}>
              Configure os dados finais retornados pela instalação do WuzAPI na VPS.
              Essas informações ficam centralizadas no Super Admin para uso global.
            </Typography>

            <div className={classes.finFormCard}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="URL WuzAPI"
                    name="wuzapiBaseUrl"
                    value={config.wuzapiBaseUrl}
                    onChange={handleChange}
                    variant="outlined"
                    fullWidth
                    className={classes.textField}
                    size="small"
                    placeholder="http://127.0.0.1:8080"
                  />
                  <div className={classes.helperText} style={{ marginBottom: 0 }}>
                    URL base do serviço WuzAPI desse servidor.
                  </div>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="Admin Token"
                    name="wuzapiAdminToken"
                    value={config.wuzapiAdminToken}
                    onChange={handleChange}
                    variant="outlined"
                    fullWidth
                    className={classes.textField}
                    size="small"
                    type="password"
                  />
                  <div className={classes.helperText} style={{ marginBottom: 0 }}>
                    Token administrativo para criar usuários/sessões no WuzAPI.
                  </div>
                </Grid>
              </Grid>
            </div>
            {renderSaveButton()}
          </Paper>
        )}

        {tab === 5 && (
          <Paper elevation={0} className={classes.sectionCard}>
            <Typography variant="subtitle1" className={classes.sectionTitle}>
              White Label
            </Typography>
            <Typography className={classes.sectionDescription}>
              Personalize identidade visual, nome do sistema, cores e ativos principais da plataforma.
            </Typography>
            <Whitelabel
              settings={whiteLabelSettings}
              loginBrandingConfig={config}
              onLoginBrandingChange={handleChange}
              onLoginBrandingUpload={handleBrandingUpload}
              onLoginBrandingRemove={handleBrandingRemove}
              resolveBrandingImageUrl={resolveImageUrl}
              loginBrandingUploading={uploading}
              loginBrandingRemoving={removing}
            />
            {renderSaveButton()}
          </Paper>
        )}
      </form>

      {tab === 1 && (
        <div>
          {/* ── Stats row ── */}
          <div className={classes.finStatsRow}>
            <div className={classes.finStatCard}>
              <div className={classes.finStatIconWrap} style={{ backgroundColor: "rgba(99,102,241,0.1)" }}>
                <AttachMoney style={{ fontSize: 20, color: "#6366f1" }} />
              </div>
              <div>
                <div className={classes.finStatValue}>{formatToCurrency(financialSummary.totalBilled)}</div>
                <div className={classes.finStatLabel}>Total Faturado</div>
              </div>
            </div>
            <div className={classes.finStatCard}>
              <div className={classes.finStatIconWrap} style={{ backgroundColor: "rgba(34,197,94,0.1)" }}>
                <CheckCircle style={{ fontSize: 20, color: "#22c55e" }} />
              </div>
              <div>
                <div className={classes.finStatValue}>{formatToCurrency(financialSummary.totalReceived)}</div>
                <div className={classes.finStatLabel}>Total Recebido</div>
              </div>
            </div>
            <div className={classes.finStatCard}>
              <div className={classes.finStatIconWrap} style={{ backgroundColor: "rgba(245,158,11,0.1)" }}>
                <HourglassEmpty style={{ fontSize: 20, color: "#f59e0b" }} />
              </div>
              <div>
                <div className={classes.finStatValue}>{formatToCurrency(financialSummary.totalOpen)}</div>
                <div className={classes.finStatLabel}>Total em Aberto</div>
              </div>
            </div>
            <div className={classes.finStatCard}>
              <div className={classes.finStatIconWrap} style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
                <ErrorOutline style={{ fontSize: 20, color: "#ef4444" }} />
              </div>
              <div>
                <div className={classes.finStatValue}>{formatToCurrency(financialSummary.totalOverdue)}</div>
                <div className={classes.finStatLabel}>Total Vencido</div>
              </div>
            </div>
          </div>

          {/* ── Filtros ── */}
          <Grid container spacing={2} style={{ marginBottom: 20 }}>
            <Grid item xs={12} md={5}>
              <CreatedAtFilter
                dateStart={(value) => {
                  setFinancialFilters(prev => ({ ...prev, startDate: value }));
                  setFinancialPage(0);
                }}
                dateEnd={(value) => {
                  setFinancialFilters(prev => ({ ...prev, endDate: value }));
                  setFinancialPage(0);
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <TextField
                select
                fullWidth
                size="small"
                variant="outlined"
                label="Status"
                value={financialFilters.status}
                onChange={handleFinancialFilterChange("status")}
              >
                <MenuItem value="all">Todos</MenuItem>
                <MenuItem value="paid">Pago</MenuItem>
                <MenuItem value="open">Em Aberto</MenuItem>
                <MenuItem value="overdue">Vencido</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <TextField
                select
                fullWidth
                size="small"
                variant="outlined"
                label="Empresa"
                value={financialFilters.companyId}
                onChange={handleFinancialFilterChange("companyId")}
              >
                <MenuItem value="">Todas</MenuItem>
                {financialCompaniesList.map(c => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <TextField
                fullWidth
                size="small"
                variant="outlined"
                label="Buscar (empresa ou descrição)"
                value={financialFilters.searchParam}
                onChange={handleFinancialFilterChange("searchParam")}
              />
            </Grid>
          </Grid>

          {/* ── Main table ── */}
          <Paper className={classes.finMainPaper} variant="outlined">
            <div className={classes.finTableContainer}>
              <Table size="small">
                <TableHead>
                  <TableRow className={classes.finTableHeaderRow}>
                    <TableCell className={classes.finTableHeaderCell}>Empresa</TableCell>
                    <TableCell className={classes.finTableHeaderCell}>Descrição</TableCell>
                    <TableCell className={classes.finTableHeaderCell} align="right">Valor</TableCell>
                    <TableCell className={classes.finTableHeaderCell} align="center">Vencimento</TableCell>
                    <TableCell className={classes.finTableHeaderCell} align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {financialLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" style={{ padding: 32 }}>
                        <CircularProgress size={24} />
                      </TableCell>
                    </TableRow>
                  ) : financialInvoices.length > 0 ? (
                    financialInvoices.map(inv => {
                      const cfg = getFinancialInvoiceStatus(inv);
                      return (
                        <TableRow key={inv.id} className={classes.finTableRow}>
                          <TableCell className={classes.finTableCell}>{inv.company?.name || "-"}</TableCell>
                          <TableCell className={classes.finTableCell}>{inv.detail}</TableCell>
                          <TableCell className={classes.finTableCell} align="right">{formatToCurrency(inv.value)}</TableCell>
                          <TableCell className={classes.finTableCell} align="center">
                            {moment(inv.dueDate).format("DD/MM/YYYY")}
                          </TableCell>
                          <TableCell className={classes.finTableCell} align="center">
                            <span
                              className={classes.finStatusBadge}
                              style={{
                                backgroundColor: cfg.bg,
                                color: cfg.color,
                                border: `1px solid ${cfg.border}`
                              }}
                            >
                              <span className={classes.finStatusDot} style={{ backgroundColor: cfg.dotColor }} />
                              {cfg.label}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className={classes.finEmptyState}>
                          <div className={classes.finEmptyIcon}>
                            <AttachMoney />
                          </div>
                          <Typography className={classes.finEmptyTitle}>Nenhuma fatura encontrada</Typography>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              component="div"
              count={financialCount}
              page={financialPage}
              onPageChange={(_, newPage) => setFinancialPage(newPage)}
              rowsPerPage={financialPageSize}
              onRowsPerPageChange={(e) => {
                setFinancialPageSize(Number(e.target.value));
                setFinancialPage(0);
              }}
              rowsPerPageOptions={[10, 20, 50]}
              labelRowsPerPage="Linhas por página"
            />
          </Paper>
        </div>
      )}

      {tab === 3 && (
        <div className={`${classes.actions} ${classes.actionsSticky}`}>
          <Button
            type="submit"
            form={formId}
            color="primary"
            variant="contained"
            className={classes.button}
            startIcon={!saving && <Save />}
            disabled={saving}
          >
            {saving ? <CircularProgress size={20} /> : "Salvar"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default GlobalConfig;
