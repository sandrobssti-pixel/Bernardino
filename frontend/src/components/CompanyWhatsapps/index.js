import React, { useState, useCallback, useContext } from "react";
import { toast } from "react-toastify";
import { format, parseISO } from "date-fns";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import {
  Button,
  TableBody,
  TableCell,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  TableRow,
  Table,
  TableHead,
  Paper,
  Tooltip,
  Typography,
  CircularProgress,
  Box,
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
  Business,
} from "@material-ui/icons";

import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import WhatsAppModalAdmin from "../WhatsAppModalAdmin";
import ConfirmationModal from "../ConfirmationModal";
import QrcodeModal from "../QrcodeModal";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  // ── Dialog ───────────────────────────────────────────────────────────────
  dialogPaper: {
    borderRadius: 14,
  },
  dialogTitle: {
    padding: theme.spacing(2.5, 3, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.02)"
        : "rgba(15,23,42,0.02)",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
  },
  titleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(245,158,11,0.18)"
        : "rgba(245,158,11,0.1)",
    border: "1px solid rgba(245,158,11,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  titleText: {
    fontWeight: 700,
    fontSize: "1.05rem",
    letterSpacing: "-0.2px",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
    lineHeight: 1.2,
  },
  titleSubtext: {
    fontSize: "0.76rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    marginTop: 2,
    fontWeight: 400,
  },
  dialogContent: {
    padding: theme.spacing(2),
    backgroundColor:
      theme.palette.type === "dark"
        ? theme.palette.background.default
        : "#f8fafc",
  },

  // ── Table ─────────────────────────────────────────────────────────────────
  tablePaper: {
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
    boxShadow:
      theme.palette.type === "dark"
        ? "0 1px 3px rgba(0,0,0,0.4)"
        : "0 1px 3px rgba(15,23,42,0.08)",
  },
  tableContainer: {
    overflowX: "auto",
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

  // ── Channel cell ──────────────────────────────────────────────────────────
  channelCell: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.25),
  },
  channelIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 7,
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
  channelName: {
    fontWeight: 600,
    fontSize: "0.82rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
  },

  // ── Status badge ──────────────────────────────────────────────────────────
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: "0.70rem",
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

  // ── Default badge ─────────────────────────────────────────────────────────
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

  // ── Session action buttons ────────────────────────────────────────────────
  btnAction: {
    borderRadius: 6,
    fontWeight: 500,
    fontSize: "0.72rem",
    padding: theme.spacing(0.4, 1),
    minHeight: 28,
  },
  sessionCell: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    justifyContent: "center",
  },

  // ── Action icons ──────────────────────────────────────────────────────────
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
  actionIconBtnDanger: {
    "&:hover": {
      backgroundColor: "rgba(239,68,68,0.08)",
      borderColor: "rgba(239,68,68,0.4)",
      color: "#ef4444",
    },
  },

  // ── Tooltip ───────────────────────────────────────────────────────────────
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

  // ── Legacy helpers ────────────────────────────────────────────────────────
  customTableCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonProgress: {
    color: green[500],
  },
}));

// ── Status configs ─────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  CONNECTED:    { label: "Conectado",    dotColor: "#22c55e", bg: "rgba(34,197,94,0.10)",   color: "#16a34a", border: "rgba(34,197,94,0.25)" },
  DISCONNECTED: { label: "Desconectado", dotColor: "#ef4444", bg: "rgba(239,68,68,0.10)",   color: "#dc2626", border: "rgba(239,68,68,0.25)" },
  qrcode:       { label: "Aguard. QR",   dotColor: "#f59e0b", bg: "rgba(245,158,11,0.10)",  color: "#d97706", border: "rgba(245,158,11,0.25)" },
  OPENING:      { label: "Conectando",   dotColor: "#3b82f6", bg: "rgba(59,130,246,0.10)",  color: "#2563eb", border: "rgba(59,130,246,0.25)" },
  TIMEOUT:      { label: "Timeout",      dotColor: "#f97316", bg: "rgba(249,115,22,0.10)",  color: "#ea580c", border: "rgba(249,115,22,0.25)" },
  PAIRING:      { label: "Pareando",     dotColor: "#f97316", bg: "rgba(249,115,22,0.10)",  color: "#ea580c", border: "rgba(249,115,22,0.25)" },
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

  return (
    <span
      className={classes.statusBadge}
      style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      {status === "OPENING" ? (
        <CircularProgress size={8} style={{ color: cfg.dotColor }} />
      ) : (
        <span className={classes.statusDot} style={{ backgroundColor: cfg.dotColor }} />
      )}
      {cfg.label}
    </span>
  );
};

// ── Channel icon ───────────────────────────────────────────────────────────

const getChannelIcon = (channel) => {
  switch (String(channel || "").toLowerCase()) {
    case "facebook":
      return <Facebook style={{ fontSize: 18, color: "#3b5998" }} />;
    case "instagram":
      return <Instagram style={{ fontSize: 18, color: "#e1306c" }} />;
    case "whatsapp":
    default:
      return <WhatsApp style={{ fontSize: 18, color: "#25d366" }} />;
  }
};

// ── Main Component ─────────────────────────────────────────────────────────

const WhatsAppModalCompany = ({ open, onClose, whatsAppId, filteredWhatsapps, companyInfos }) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const confirmationModalInitialState = {
    action: "",
    title: "",
    message: "",
    whatsAppId: "",
    open: false,
  };
  const [confirmModalInfo, setConfirmModalInfo] = useState(confirmationModalInitialState);

  const handleStartWhatsAppSession = async (id) => {
    try { await api.post(`/whatsappsession/${id}`); }
    catch (err) { toastError(err); }
  };

  const handleRequestNewQrCode = async (id) => {
    try { await api.put(`/whatsappsession/${id}`); }
    catch (err) { toastError(err); }
  };

  const handleOpenWhatsAppModal = () => {
    setSelectedWhatsApp(null);
    setWhatsAppModalOpen(true);
  };

  const handleCloseWhatsAppModal = useCallback(() => {
    setWhatsAppModalOpen(false);
    setSelectedWhatsApp(null);
  }, []);

  const handleOpenQrModal = (whatsApp) => {
    setSelectedWhatsApp(whatsApp);
    setQrModalOpen(true);
  };

  const handleCloseQrModal = useCallback(() => {
    setSelectedWhatsApp(null);
    setQrModalOpen(false);
  }, []);

  const handleEditWhatsApp = (whatsApp) => {
    setSelectedWhatsApp(whatsApp);
    setWhatsAppModalOpen(true);
  };

  const handleOpenConfirmationModal = (action, id) => {
    if (action === "disconnect") {
      setConfirmModalInfo({
        action,
        title: i18n.t("connections.confirmationModal.disconnectTitle"),
        message: i18n.t("connections.confirmationModal.disconnectMessage"),
        whatsAppId: id,
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
        whatsAppId: id,
      });
    }
    setConfirmModalOpen(true);
  };

  const handleSubmitConfirmationModal = async () => {
    if (confirmModalInfo.action === "disconnect") {
      try { await api.delete(`/whatsappsession/${confirmModalInfo.whatsAppId}`); }
      catch (err) { toastError(err); }
    }
    if (confirmModalInfo.action === "delete") {
      try {
        await api.delete(`/whatsapp/${confirmModalInfo.whatsAppId}`);
        toast.success(i18n.t("connections.toasts.deleted"));
      } catch (err) { toastError(err); }
    }
    setConfirmModalInfo(confirmationModalInitialState);
  };

  const renderActionButtons = (whatsApp) => (
    <div className={classes.sessionCell}>
      {whatsApp.status === "qrcode" && (
        <Button className={classes.btnAction} size="small" variant="contained" color="primary"
          onClick={() => handleOpenQrModal(whatsApp)}>
          {i18n.t("connections.buttons.qrcode")}
        </Button>
      )}
      {whatsApp.status === "DISCONNECTED" && (
        <Box display="flex" style={{ gap: 4 }}>
          <Button className={classes.btnAction} size="small" variant="outlined" color="primary"
            onClick={() => handleStartWhatsAppSession(whatsApp.id)}>
            {i18n.t("connections.buttons.tryAgain")}
          </Button>
          <Button className={classes.btnAction} size="small" variant="outlined" color="secondary"
            onClick={() => handleRequestNewQrCode(whatsApp.id)}>
            {i18n.t("connections.buttons.newQr")}
          </Button>
        </Box>
      )}
      {(whatsApp.status === "CONNECTED" || whatsApp.status === "PAIRING" || whatsApp.status === "TIMEOUT") && (
        <Button className={classes.btnAction} size="small" variant="outlined" color="secondary"
          onClick={() => handleOpenConfirmationModal("disconnect", whatsApp.id)}>
          {i18n.t("connections.buttons.disconnect")}
        </Button>
      )}
      {whatsApp.status === "OPENING" && (
        <Button className={classes.btnAction} size="small" variant="outlined" disabled color="default">
          {i18n.t("connections.buttons.connecting")}
        </Button>
      )}
    </div>
  );

  const handleClose = () => onClose();

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      scroll="paper"
      PaperProps={{ className: classes.dialogPaper }}
    >
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

      <WhatsAppModalAdmin
        open={whatsAppModalOpen}
        onClose={handleCloseWhatsAppModal}
        whatsAppId={!qrModalOpen && selectedWhatsApp?.id}
      />

      {/* ── Dialog Title ── */}
      <DialogTitle disableTypography className={classes.dialogTitle}>
        <div className={classes.titleRow}>
          <div className={classes.titleIconWrap}>
            <Business style={{ fontSize: 18, color: "#f59e0b" }} />
          </div>
          <div>
            <Typography className={classes.titleText}>
              {companyInfos?.name || "Empresa"}
            </Typography>
            <Typography className={classes.titleSubtext}>
              {filteredWhatsapps?.length || 0} conexão{filteredWhatsapps?.length !== 1 ? "ões" : ""} cadastrada{filteredWhatsapps?.length !== 1 ? "s" : ""}
            </Typography>
          </div>
        </div>
      </DialogTitle>

      {/* ── Dialog Content ── */}
      <DialogContent className={classes.dialogContent}>
        <Paper className={classes.tablePaper} variant="outlined">
          <div className={classes.tableContainer}>
            <Table size="small">
              <TableHead>
                <TableRow className={classes.tableHeaderRow}>
                  <TableCell className={classes.tableHeaderCell}>Canal</TableCell>
                  <TableCell className={classes.tableHeaderCell} align="center">
                    {i18n.t("connections.table.status")}
                  </TableCell>
                  {user.profile === "admin" && (
                    <TableCell className={classes.tableHeaderCell} align="center">
                      {i18n.t("connections.table.session")}
                    </TableCell>
                  )}
                  <TableCell className={classes.tableHeaderCell} align="center">
                    {i18n.t("connections.table.lastUpdate")}
                  </TableCell>
                  <TableCell className={classes.tableHeaderCell} align="center">
                    {i18n.t("connections.table.default")}
                  </TableCell>
                  {user.profile === "admin" && (
                    <TableCell className={classes.tableHeaderCell} align="right">
                      {i18n.t("connections.table.actions")}
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredWhatsapps?.length > 0 ? (
                  filteredWhatsapps.map((whatsApp) => (
                    <TableRow key={whatsApp.id} className={classes.tableRow}>
                      {/* Channel + Name */}
                      <TableCell className={classes.tableCell} style={{ minWidth: 180 }}>
                        <div className={classes.channelCell}>
                          <div className={classes.channelIconWrap}>
                            {getChannelIcon(whatsApp.channel)}
                          </div>
                          <span className={classes.channelName}>{whatsApp?.name}</span>
                        </div>
                      </TableCell>

                      {/* Status badge */}
                      <TableCell className={classes.tableCell} align="center">
                        <StatusBadge status={whatsApp.status} />
                      </TableCell>

                      {/* Session actions */}
                      {user.profile === "admin" && (
                        <TableCell className={classes.tableCell} align="center">
                          {renderActionButtons(whatsApp)}
                        </TableCell>
                      )}

                      {/* Last update */}
                      <TableCell
                        className={`${classes.tableCell} ${classes.tableCellMono}`}
                        align="center"
                        style={{ fontSize: "0.72rem" }}
                      >
                        {format(parseISO(whatsApp.updatedAt), "dd/MM/yy HH:mm")}
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

                      {/* Actions */}
                      {user.profile === "admin" && (
                        <TableCell className={classes.tableCell} align="right">
                          <div className={classes.actionsCell}>
                            <Tooltip
                              title="Editar conexão"
                              arrow
                              classes={{ tooltip: classes.tooltip, popper: classes.tooltipPopper }}
                            >
                              <IconButton
                                className={classes.actionIconBtn}
                                size="small"
                                onClick={() => handleEditWhatsApp(whatsApp)}
                              >
                                <Edit style={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>

                            <Tooltip
                              title="Excluir conexão"
                              arrow
                              classes={{ tooltip: classes.tooltip, popper: classes.tooltipPopper }}
                            >
                              <IconButton
                                className={`${classes.actionIconBtn} ${classes.actionIconBtnDanger}`}
                                size="small"
                                onClick={() => handleOpenConfirmationModal("delete", whatsApp.id)}
                              >
                                <DeleteOutline style={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center" style={{ padding: "40px 0", color: "#94a3b8", fontSize: "0.82rem" }}>
                      Nenhuma conexão encontrada para esta empresa.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Paper>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(WhatsAppModalCompany);
