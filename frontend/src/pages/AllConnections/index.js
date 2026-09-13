import React, { useState, useCallback, useContext, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import { format, parseISO } from "date-fns";

import { makeStyles } from "@material-ui/core/styles";
import { useHistory } from "react-router-dom";
import { green } from "@material-ui/core/colors";
import {
  Button,
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
} from "@material-ui/core";
import {
  Edit,
  CheckCircle,
  SignalCellularConnectedNoInternet2Bar,
  SignalCellularConnectedNoInternet0Bar,
  SignalCellular4Bar,
  CropFree,
  DeleteOutline,
  Facebook,
  Instagram,
  WhatsApp,
  Wifi,
  WifiOff,
  DevicesOther,
  Business,
} from "@material-ui/icons";

import TableRowSkeleton from "../../components/TableRowSkeleton";
import { AuthContext } from "../../context/Auth/AuthContext";
import useCompanies from "../../hooks/useCompanies";
import api from "../../services/api";
import WhatsAppModalCompany from "../../components/CompanyWhatsapps";
import ConfirmationModal from "../../components/ConfirmationModal";
import QrcodeModal from "../../components/QrcodeModal";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import ForbiddenPage from "../../components/ForbiddenPage";

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    padding: theme.spacing(3),
    height: "calc(100% - 48px)",
    overflowY: "auto",
    ...theme.scrollbarStyles,
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

  // ── Stats row ────────────────────────────────────────────────────────────
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2.5),
    [theme.breakpoints.down("md")]: {
      gridTemplateColumns: "repeat(3, 1fr)",
    },
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
    boxShadow:
      theme.palette.type === "dark"
        ? "0 1px 3px rgba(0,0,0,0.3)"
        : "0 1px 3px rgba(15,23,42,0.06)",
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
    fontSize: "0.70rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    marginTop: 2,
    fontWeight: 500,
    lineHeight: 1.3,
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
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  },
  tableContainer: {
    flex: 1,
    minHeight: 0,
    overflowX: "auto",
    overflowY: "auto",
    ...theme.scrollbarStyles,
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
  totalRow: {
    borderTop: `2px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(15,23,42,0.03)",
  },
  tableCell: {
    padding: theme.spacing(1.25, 2),
    fontSize: "0.8rem",
    color: theme.palette.type === "dark" ? "#cbd5e1" : "#334155",
    borderBottom: "none",
    verticalAlign: "middle",
  },
  totalCell: {
    padding: theme.spacing(1.25, 2),
    fontSize: "0.78rem",
    fontWeight: 700,
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
    borderBottom: "none",
    verticalAlign: "middle",
  },

  // ── Company name cell ─────────────────────────────────────────────────────
  companyName: {
    fontWeight: 600,
    fontSize: "0.82rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
  },

  // ── Count badges ─────────────────────────────────────────────────────────
  countConnected: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 28,
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: "0.75rem",
    fontWeight: 700,
    backgroundColor: "rgba(34,197,94,0.10)",
    color: "#16a34a",
    border: "1px solid rgba(34,197,94,0.2)",
  },
  countDisconnected: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 28,
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: "0.75rem",
    fontWeight: 700,
    backgroundColor: "rgba(239,68,68,0.10)",
    color: "#dc2626",
    border: "1px solid rgba(239,68,68,0.2)",
  },
  countNeutral: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 28,
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: "0.75rem",
    fontWeight: 600,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.07)"
        : "rgba(15,23,42,0.06)",
    color: theme.palette.type === "dark" ? "#cbd5e1" : "#334155",
    border: `1px solid ${theme.palette.divider}`,
  },

  // ── Actions ──────────────────────────────────────────────────────────────
  actionsCell: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    justifyContent: "center",
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

  // ── Tooltip ──────────────────────────────────────────────────────────────
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

  // ── Legacy helpers (kept for renderStatusToolTips) ────────────────────────
  customTableCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonProgress: {
    color: green[500],
  },
}));

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

const IconChannel = (channel) => {
  switch (channel) {
    case "facebook":
      return <Facebook />;
    case "instagram":
      return <Instagram />;
    case "whatsapp":
      return <WhatsApp />;
    default:
      return "error";
  }
};

const getConnectionType = (connection) => {
  const channel = String(connection?.channel || "").toLowerCase();
  if (channel === "whatsapp_oficial") return "whatsapp_oficial";
  if (channel !== "whatsapp") return channel;
  const provider = String(connection?.provider || "beta").toLowerCase();
  return provider === "wuzapi" ? "whatsapp_wuzapi" : "whatsapp_baileys";
};

const getEffectiveConnectionStatus = (connection) => {
  const channel = String(connection?.channel || "").toLowerCase();
  if (channel !== "whatsapp_oficial") return connection?.status;

  const hasOfficialBinding =
    Boolean(connection?.waba_webhook_id) &&
    Boolean(String(connection?.token || "").trim()) &&
    Boolean(String(connection?.phone_number_id || "").trim());

  return hasOfficialBinding ? "CONNECTED" : "DISCONNECTED";
};

const AllConnections = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const { list } = useCompanies();
  const [loadingWhatsapp, setLoadingWhatsapp] = useState(true);
  const [loadingComp, setLoadingComp] = useState(false);
  const [whats, setWhats] = useState([]);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [filterConnections, setFilterConnections] = useState([]);
  const [companyWhatsApps, setCompanyWhatsApps] = useState(null);

  const confirmationModalInitialState = {
    action: "",
    title: "",
    message: "",
    whatsAppId: "",
    open: false,
  };
  const [confirmModalInfo, setConfirmModalInfo] = useState(confirmationModalInitialState);

  const history = useHistory();
  if (!user.super) {
    history.push("/tickets");
  }

  const getCompanyConnections = useCallback(
    (companyId) => (whats || []).filter((item) => item?.companyId === companyId),
    [whats]
  );

  const getConnectedCountByType = useCallback((connections, type) => {
    return connections.filter(
      (item) =>
        getEffectiveConnectionStatus(item) === "CONNECTED" &&
        getConnectionType(item) === type
    ).length;
  }, []);

  const getConnectedTotal = useCallback((connections) => {
    return connections.filter((item) => getEffectiveConnectionStatus(item) === "CONNECTED").length;
  }, []);

  const totals = useMemo(() => {
    const all = whats || [];
    const connectedTotal = getConnectedTotal(all);
    const connectedBaileys = getConnectedCountByType(all, "whatsapp_baileys");
    const connectedWuzapi = getConnectedCountByType(all, "whatsapp_wuzapi");
    const connectedOfficial = getConnectedCountByType(all, "whatsapp_oficial");

    return {
      connectedTotal,
      connectedBaileys,
      connectedWuzapi,
      connectedOfficial,
      disconnectedTotal: all.length - connectedTotal,
      total: all.length,
    };
  }, [whats, getConnectedTotal, getConnectedCountByType]);

  useEffect(() => {
    setLoadingWhatsapp(true);
    const fetchSession = async () => {
      try {
        const { data } = await api.get("/whatsapp/all/?session=0");
        setWhats(data);
        setLoadingWhatsapp(false);
      } catch (err) {
        setLoadingWhatsapp(false);
        toastError(err);
      }
    };
    fetchSession();
  }, []);

  useEffect(() => {
    loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCompanies = async () => {
    setLoadingComp(true);
    try {
      const companyList = await list();
      setCompanies(companyList);
    } catch (e) {
      toast.error("Não foi possível carregar a lista de registros");
    }
    setLoadingComp(false);
  };

  const handleStartWhatsAppSession = async (whatsAppId) => {
    try {
      await api.post(`/whatsappsession/${whatsAppId}`);
    } catch (err) {
      toastError(err);
    }
  };

  const handleRequestNewQrCode = async (whatsAppId) => {
    try {
      await api.put(`/whatsappsession/${whatsAppId}`);
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenWhatsAppModal = (whatsappsFilter, comp) => {
    setSelectedWhatsApp(null);
    setFilterConnections(whatsappsFilter || []);
    setCompanyWhatsApps(comp || null);
    setWhatsAppModalOpen(true);
  };

  const handleCloseWhatsAppModal = useCallback(() => {
    setWhatsAppModalOpen(false);
    setSelectedWhatsApp(null);
    setFilterConnections([]);
    setCompanyWhatsApps(null);
  }, [setSelectedWhatsApp, setWhatsAppModalOpen]);

  const handleOpenQrModal = (whatsApp) => {
    setSelectedWhatsApp(whatsApp);
    setQrModalOpen(true);
  };

  const handleCloseQrModal = useCallback(() => {
    setSelectedWhatsApp(null);
    setQrModalOpen(false);
  }, [setQrModalOpen, setSelectedWhatsApp]);

  const handleEditWhatsApp = (whatsApp) => {
    setSelectedWhatsApp(whatsApp);
    setWhatsAppModalOpen(true);
  };

  const handleOpenConfirmationModal = (action, whatsAppId) => {
    if (action === "disconnect") {
      setConfirmModalInfo({
        action,
        title: i18n.t("connections.confirmationModal.disconnectTitle"),
        message: i18n.t("connections.confirmationModal.disconnectMessage"),
        whatsAppId,
      });
    }
    if (action === "delete") {
      setConfirmModalInfo({
        action,
        title: i18n.t("connections.confirmationModal.deleteTitle"),
        message: i18n.t("connections.confirmationModal.deleteMessage"),
        alert: {
          title: "Atenção",
          message: "Ao excluir esta conexão, todos os tickets vinculados a ela que estiverem em aguardando ou em atendimento serão encerrados."
        },
        whatsAppId,
      });
    }
    setConfirmModalOpen(true);
  };

  const handleSubmitConfirmationModal = async () => {
    if (confirmModalInfo.action === "disconnect") {
      try {
        await api.delete(`/whatsappsession/${confirmModalInfo.whatsAppId}`);
      } catch (err) {
        toastError(err);
      }
    }
    if (confirmModalInfo.action === "delete") {
      try {
        await api.delete(`/whatsapp/${confirmModalInfo.whatsAppId}`);
        toast.success(i18n.t("connections.toasts.deleted"));
      } catch (err) {
        toastError(err);
      }
    }
    setConfirmModalInfo(confirmationModalInitialState);
  };

  const renderActionButtons = (whatsApp) => (
    <>
      {whatsApp.status === "qrcode" && (
        <Button size="small" variant="contained" color="primary" onClick={() => handleOpenQrModal(whatsApp)}>
          {i18n.t("connections.buttons.qrcode")}
        </Button>
      )}
      {whatsApp.status === "DISCONNECTED" && (
        <>
          <Button size="small" variant="outlined" color="primary" onClick={() => handleStartWhatsAppSession(whatsApp.id)}>
            {i18n.t("connections.buttons.tryAgain")}
          </Button>{" "}
          <Button size="small" variant="outlined" color="secondary" onClick={() => handleRequestNewQrCode(whatsApp.id)}>
            {i18n.t("connections.buttons.newQr")}
          </Button>
        </>
      )}
      {(whatsApp.status === "CONNECTED" || whatsApp.status === "PAIRING" || whatsApp.status === "TIMEOUT") && (
        <Button size="small" variant="outlined" color="secondary" onClick={() => handleOpenConfirmationModal("disconnect", whatsApp.id)}>
          {i18n.t("connections.buttons.disconnect")}
        </Button>
      )}
      {whatsApp.status === "OPENING" && (
        <Button size="small" variant="outlined" disabled color="default">
          {i18n.t("connections.buttons.connecting")}
        </Button>
      )}
    </>
  );

  const renderStatusToolTips = (whatsApp) => (
    <div className={classes.customTableCell}>
      {whatsApp.status === "DISCONNECTED" && (
        <CustomToolTip title={i18n.t("connections.toolTips.disconnected.title")} content={i18n.t("connections.toolTips.disconnected.content")}>
          <SignalCellularConnectedNoInternet0Bar color="secondary" />
        </CustomToolTip>
      )}
      {whatsApp.status === "OPENING" && (
        <CircularProgress size={24} className={classes.buttonProgress} />
      )}
      {whatsApp.status === "qrcode" && (
        <CustomToolTip title={i18n.t("connections.toolTips.qrcode.title")} content={i18n.t("connections.toolTips.qrcode.content")}>
          <CropFree />
        </CustomToolTip>
      )}
      {whatsApp.status === "CONNECTED" && (
        <CustomToolTip title={i18n.t("connections.toolTips.connected.title")}>
          <SignalCellular4Bar style={{ color: green[500] }} />
        </CustomToolTip>
      )}
      {(whatsApp.status === "TIMEOUT" || whatsApp.status === "PAIRING") && (
        <CustomToolTip title={i18n.t("connections.toolTips.timeout.title")} content={i18n.t("connections.toolTips.timeout.content")}>
          <SignalCellularConnectedNoInternet2Bar color="secondary" />
        </CustomToolTip>
      )}
    </div>
  );

  return (
    <div className={classes.pageRoot}>
      <ConfirmationModal
        title={confirmModalInfo.title}
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={handleSubmitConfirmationModal}
        alert={confirmModalInfo.alert}
      >
        {confirmModalInfo.message}
      </ConfirmationModal>

      <QrcodeModal
        open={qrModalOpen}
        onClose={handleCloseQrModal}
        whatsAppId={!whatsAppModalOpen && selectedWhatsApp?.id}
      />

      <WhatsAppModalCompany
        key={companyWhatsApps?.id ?? "new"}
        open={whatsAppModalOpen}
        onClose={handleCloseWhatsAppModal}
        filteredWhatsapps={filterConnections}
        companyInfos={companyWhatsApps}
        whatsAppId={!qrModalOpen && selectedWhatsApp?.id}
      />

      {user.profile === "user" ? (
        <ForbiddenPage />
      ) : (
        <>
          {/* ── Stats Row ── */}
          {!loadingWhatsapp && (
            <div className={classes.statsRow}>
              <div className={classes.statCard}>
                <div className={classes.statIconWrap} style={{ backgroundColor: "rgba(34,197,94,0.10)" }}>
                  <Wifi style={{ fontSize: 20, color: "#22c55e" }} />
                </div>
                <div>
                  <div className={classes.statValue}>{totals.connectedTotal}</div>
                  <div className={classes.statLabel}>Conectadas</div>
                </div>
              </div>
              <div className={classes.statCard}>
                <div className={classes.statIconWrap} style={{ backgroundColor: "rgba(37,211,102,0.10)" }}>
                  <WhatsApp style={{ fontSize: 20, color: "#25d366" }} />
                </div>
                <div>
                  <div className={classes.statValue}>{totals.connectedBaileys}</div>
                  <div className={classes.statLabel}>Baileys</div>
                </div>
              </div>
              <div className={classes.statCard}>
                <div className={classes.statIconWrap} style={{ backgroundColor: "rgba(99,102,241,0.10)" }}>
                  <DevicesOther style={{ fontSize: 20, color: "#6366f1" }} />
                </div>
                <div>
                  <div className={classes.statValue}>{totals.connectedWuzapi}</div>
                  <div className={classes.statLabel}>WuzAPI</div>
                </div>
              </div>
              <div className={classes.statCard}>
                <div className={classes.statIconWrap} style={{ backgroundColor: "rgba(18,140,126,0.10)" }}>
                  <WhatsApp style={{ fontSize: 20, color: "#128c7e" }} />
                </div>
                <div>
                  <div className={classes.statValue}>{totals.connectedOfficial}</div>
                  <div className={classes.statLabel}>API Oficial</div>
                </div>
              </div>
              <div className={classes.statCard}>
                <div className={classes.statIconWrap} style={{ backgroundColor: "rgba(239,68,68,0.10)" }}>
                  <WifiOff style={{ fontSize: 20, color: "#ef4444" }} />
                </div>
                <div>
                  <div className={classes.statValue}>{totals.disconnectedTotal}</div>
                  <div className={classes.statLabel}>Desconectadas</div>
                </div>
              </div>
              <div className={classes.statCard}>
                <div className={classes.statIconWrap} style={{ backgroundColor: "rgba(245,158,11,0.10)" }}>
                  <Business style={{ fontSize: 20, color: "#f59e0b" }} />
                </div>
                <div>
                  <div className={classes.statValue}>{companies?.length || 0}</div>
                  <div className={classes.statLabel}>Empresas</div>
                </div>
              </div>
            </div>
          )}

          {/* ── Main Table ── */}
          <Paper className={classes.mainPaper} variant="outlined">
            <div className={classes.tableContainer}>
              <Table size="small">
                <TableHead>
                  <TableRow className={classes.tableHeaderRow}>
                    <TableCell className={classes.tableHeaderCell}>Cliente</TableCell>
                    <TableCell className={classes.tableHeaderCell} align="center">Baileys</TableCell>
                    <TableCell className={classes.tableHeaderCell} align="center">WuzAPI</TableCell>
                    <TableCell className={classes.tableHeaderCell} align="center">API Oficial</TableCell>
                    <TableCell className={classes.tableHeaderCell} align="center">Conectadas</TableCell>
                    <TableCell className={classes.tableHeaderCell} align="center">Desconectadas</TableCell>
                    <TableCell className={classes.tableHeaderCell} align="center">Total</TableCell>
                    {user.profile === "admin" && (
                      <TableCell className={classes.tableHeaderCell} align="center">
                        {i18n.t("connections.table.actions")}
                      </TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingWhatsapp || loadingComp ? (
                    <TableRowSkeleton />
                  ) : (
                    <>
                      {companies?.length > 0 &&
                        companies.map((company) => {
                          const conns = getCompanyConnections(company?.id);
                          const baileys = getConnectedCountByType(conns, "whatsapp_baileys");
                          const wuzapi = getConnectedCountByType(conns, "whatsapp_wuzapi");
                          const official = getConnectedCountByType(conns, "whatsapp_oficial");
                          const connected = getConnectedTotal(conns);
                          const disconnected = conns.length - connected;
                          const total = conns.length;

                          return (
                            <TableRow key={company.id} className={classes.tableRow}>
                              <TableCell className={classes.tableCell}>
                                <span className={classes.companyName}>{company?.name}</span>
                              </TableCell>
                              <TableCell className={classes.tableCell} align="center">
                                <span className={baileys > 0 ? classes.countConnected : classes.countNeutral}>
                                  {baileys}
                                </span>
                              </TableCell>
                              <TableCell className={classes.tableCell} align="center">
                                <span className={wuzapi > 0 ? classes.countConnected : classes.countNeutral}>
                                  {wuzapi}
                                </span>
                              </TableCell>
                              <TableCell className={classes.tableCell} align="center">
                                <span className={official > 0 ? classes.countConnected : classes.countNeutral}>
                                  {official}
                                </span>
                              </TableCell>
                              <TableCell className={classes.tableCell} align="center">
                                <span className={connected > 0 ? classes.countConnected : classes.countNeutral}>
                                  {connected}
                                </span>
                              </TableCell>
                              <TableCell className={classes.tableCell} align="center">
                                <span className={disconnected > 0 ? classes.countDisconnected : classes.countNeutral}>
                                  {disconnected}
                                </span>
                              </TableCell>
                              <TableCell className={classes.tableCell} align="center">
                                <span className={classes.countNeutral}>{total}</span>
                              </TableCell>
                              {user.profile === "admin" && (
                                <TableCell className={classes.tableCell} align="center">
                                  <div className={classes.actionsCell}>
                                    <Tooltip
                                      title="Gerenciar conexões da empresa"
                                      arrow
                                      classes={{ tooltip: classes.tooltip }}
                                    >
                                      <IconButton
                                        className={classes.actionIconBtn}
                                        size="small"
                                        onClick={() => handleOpenWhatsAppModal(conns, company)}
                                      >
                                        <Edit style={{ fontSize: 15 }} />
                                      </IconButton>
                                    </Tooltip>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}

                      {/* ── Totals row ── */}
                      <TableRow className={classes.totalRow}>
                        <TableCell className={classes.totalCell}>Total</TableCell>
                        <TableCell className={classes.totalCell} align="center">{totals.connectedBaileys}</TableCell>
                        <TableCell className={classes.totalCell} align="center">{totals.connectedWuzapi}</TableCell>
                        <TableCell className={classes.totalCell} align="center">{totals.connectedOfficial}</TableCell>
                        <TableCell className={classes.totalCell} align="center">{totals.connectedTotal}</TableCell>
                        <TableCell className={classes.totalCell} align="center">{totals.disconnectedTotal}</TableCell>
                        <TableCell className={classes.totalCell} align="center">{totals.total}</TableCell>
                        {user.profile === "admin" && <TableCell className={classes.totalCell} />}
                      </TableRow>
                    </>
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

export default AllConnections;
