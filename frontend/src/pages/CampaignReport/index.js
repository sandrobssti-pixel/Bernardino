import React, { useEffect, useRef, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import { useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import {
  LinearProgress,
  Typography,
  Button,
  CircularProgress,
} from "@material-ui/core";
import api from "../../services/api";
import { has, get, isNull } from "lodash";
import GroupIcon from "@material-ui/icons/Group";
import ScheduleIcon from "@material-ui/icons/Schedule";
import EventAvailableIcon from "@material-ui/icons/EventAvailable";
import DoneIcon from "@material-ui/icons/Done";
import DoneAllIcon from "@material-ui/icons/DoneAll";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import ListAltIcon from "@material-ui/icons/ListAlt";
import CloudDownloadIcon from "@material-ui/icons/CloudDownload";
import ErrorOutlineIcon from "@material-ui/icons/ErrorOutline";
import AssessmentOutlinedIcon from "@material-ui/icons/AssessmentOutlined";
import { useDate } from "../../hooks/useDate";
import usePlans from "../../hooks/usePlans";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";

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
  btnGhost: {
    borderRadius: 8,
    fontWeight: 500,
    fontSize: "0.78rem",
    padding: theme.spacing(0.6, 1.4),
    border: `1px solid ${theme.palette.divider}`,
    color: theme.palette.text.secondary,
    backgroundColor: "transparent",
    textTransform: "none",
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
    textTransform: "none",
    boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
    "&:hover": {
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    },
  },

  // ── Stats row ─────────────────────────────────────────────────────────────
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
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
  statValueText: {
    fontWeight: 600,
    fontSize: "0.82rem",
    lineHeight: 1.3,
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
  },
  statLabel: {
    fontSize: "0.72rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    marginTop: 2,
    fontWeight: 500,
  },

  // ── Progress banner ───────────────────────────────────────────────────────
  progressCard: {
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(2, 2.5),
    marginBottom: theme.spacing(2.5),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
  },
  progressCardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  progressCardLeft: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  progressTitle: {
    fontWeight: 600,
    fontSize: "0.85rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
  },
  progressSubtitle: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    lineHeight: 1.5,
  },
  progressBar: {
    height: 6,
    borderRadius: 999,
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(255,255,255,0.08)" : "#e2e8f0",
  },
  progressPercent: {
    fontSize: "0.72rem",
    fontWeight: 600,
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    whiteSpace: "nowrap",
  },

  // ── Status badge ──────────────────────────────────────────────────────────
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

  // ── Main paper ────────────────────────────────────────────────────────────
  mainPaper: {
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
    boxShadow:
      theme.palette.type === "dark"
        ? "0 1px 3px rgba(0,0,0,0.4)"
        : "0 1px 3px rgba(15,23,42,0.08)",
    flex: 1,
    padding: theme.spacing(2.5),
  },
}));

// ── Campaign status badge ─────────────────────────────────────────────────

const CAMPAIGN_STATUS_CONFIG = {
  INATIVA: {
    label: "Inativa",
    dotColor: "#94a3b8",
    bg: "rgba(148,163,184,0.1)",
    color: "#64748b",
    border: "rgba(148,163,184,0.25)",
  },
  PROGRAMADA: {
    label: "Programada",
    dotColor: "#3b82f6",
    bg: "rgba(59,130,246,0.10)",
    color: "#2563eb",
    border: "rgba(59,130,246,0.25)",
  },
  EM_ANDAMENTO: {
    label: "Em andamento",
    dotColor: "#f59e0b",
    bg: "rgba(245,158,11,0.10)",
    color: "#d97706",
    border: "rgba(245,158,11,0.25)",
    loading: true,
  },
  CANCELADA: {
    label: "Cancelada",
    dotColor: "#ef4444",
    bg: "rgba(239,68,68,0.10)",
    color: "#dc2626",
    border: "rgba(239,68,68,0.25)",
  },
  FINALIZADA: {
    label: "Finalizada",
    dotColor: "#22c55e",
    bg: "rgba(34,197,94,0.10)",
    color: "#16a34a",
    border: "rgba(34,197,94,0.25)",
  },
};

const CampaignStatusBadge = ({ status }) => {
  const classes = useStyles();
  const cfg = CAMPAIGN_STATUS_CONFIG[status] || {
    label: status || "—",
    dotColor: "#94a3b8",
    bg: "rgba(148,163,184,0.1)",
    color: "#64748b",
    border: "rgba(148,163,184,0.25)",
  };

  return (
    <span
      className={classes.statusBadge}
      style={{
        backgroundColor: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {cfg.loading ? (
        <CircularProgress size={8} style={{ color: cfg.dotColor }} />
      ) : (
        <span className={classes.statusDot} style={{ backgroundColor: cfg.dotColor }} />
      )}
      {cfg.label}
    </span>
  );
};

// ── Main Component ────────────────────────────────────────────────────────

const CampaignReport = () => {
  const classes = useStyles();
  const history = useHistory();

  const { campaignId } = useParams();

  const [campaign, setCampaign] = useState({});
  const [validContacts, setValidContacts] = useState(0);
  const [delivered, setDelivered] = useState(0);
  const [confirmationRequested, setConfirmationRequested] = useState(0);
  const [confirmed, setConfirmed] = useState(0);
  const [percent, setPercent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notDeliveredContacts, setNotDeliveredContacts] = useState([]);
  const mounted = useRef(true);
  const { user, socket } = useContext(AuthContext);

  const { datetimeToClient } = useDate();
  const { getPlanCompany } = usePlans();

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useCampaigns) {
        toast.error("Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando.");
        setTimeout(() => {
          history.push(`/`);
        }, 1000);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mounted.current) {
      findCampaign();
    }

    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mounted.current && has(campaign, "shipping")) {
      if (has(campaign, "contactList")) {
        const contactList = get(campaign, "contactList");
        const valids = contactList.contacts.filter((c) => c.isWhatsappValid);
        setValidContacts(valids.length);
      }

      if (has(campaign, "shipping")) {
        const contacts = get(campaign, "shipping");
        const deliveredList = contacts.filter((c) => !isNull(c.deliveredAt));
        const confirmationRequestedList = contacts.filter(
          (c) => !isNull(c.confirmationRequestedAt)
        );
        const confirmedList = contacts.filter(
          (c) => !isNull(c.deliveredAt) && !isNull(c.confirmationRequestedAt)
        );
        setDelivered(deliveredList.length);
        setConfirmationRequested(confirmationRequestedList.length);
        setConfirmed(confirmedList.length);
      }

      const contactList = get(campaign, "contactList.contacts", []);
      const shipping = get(campaign, "shipping", []);
      const deliveredIds = new Set(
        shipping
          .filter((item) => !isNull(item.deliveredAt))
          .map((item) => item.contactId)
      );
      const pending = contactList.filter(
        (contact) => contact.isWhatsappValid && !deliveredIds.has(contact.id)
      );
      setNotDeliveredContacts(pending);
    }
  }, [campaign]);

  useEffect(() => {
    if (!validContacts) {
      setPercent(0);
      return;
    }
    setPercent((delivered / validContacts) * 100);
  }, [delivered, validContacts]);

  useEffect(() => {
    const companyId = user.companyId;

    const onCampaignEvent = (data) => {
      if (data.record.id === +campaignId) {
        setCampaign(data.record);

        if (data.record.status === "FINALIZADA") {
          setTimeout(() => {
            findCampaign();
          }, 5000);
        }
      }
    };
    socket.on(`company-${companyId}-campaign`, onCampaignEvent);

    return () => {
      socket.off(`company-${companyId}-campaign`, onCampaignEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const findCampaign = async () => {
    setLoading(true);
    const { data } = await api.get(`/campaigns/${campaignId}`);
    setCampaign(data);
    setLoading(false);
  };

  const downloadNotDeliveredCsv = () => {
    if (!notDeliveredContacts.length) {
      toast.info("Não há contatos pendentes para exportar.");
      return;
    }

    const lines = [
      ["nome", "numero", "e-mail"],
      ...notDeliveredContacts.map((c) => [c.name || "", c.number || "", c.email || ""]),
    ];
    const csv = lines
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";")
      )
      .join("\n");

    const csvWithBom = `﻿${csv}`;
    const blob = new Blob([csvWithBom], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `campanha-${campaignId}-nao-enviados-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Stat card ────────────────────────────────────────────────────────────

  const StatCard = ({ icon, iconBg, iconColor, title, value, isText }) => (
    <div className={classes.statCard}>
      <div
        className={classes.statIconWrap}
        style={{ backgroundColor: iconBg || "rgba(99,102,241,0.1)" }}
      >
        {React.cloneElement(icon, {
          style: { fontSize: 20, color: iconColor || "#6366f1" },
        })}
      </div>
      <div>
        <div className={isText ? classes.statValueText : classes.statValue}>
          {loading ? (
            <CircularProgress size={14} style={{ color: "#94a3b8" }} />
          ) : (
            value
          )}
        </div>
        <div className={classes.statLabel}>{title}</div>
      </div>
    </div>
  );

  return (
    <div className={classes.pageRoot}>
      {/* ── Page Header ── */}
      <div className={classes.header}>
        <div className={classes.headerLeft}>
          <Typography className={classes.headerTitle}>
            {i18n.t("campaignReport.title")}{" "}
            {campaign.name ? `— ${campaign.name}` : ""}
          </Typography>
          <Typography className={classes.headerSubtitle}>
            Acompanhe o progresso em tempo real e exporte os contatos pendentes
          </Typography>
        </div>
        <div className={classes.headerActions}>
          <Button
            className={classes.btnGhost}
            size="small"
            startIcon={<CloudDownloadIcon style={{ fontSize: 15 }} />}
            onClick={downloadNotDeliveredCsv}
          >
            Baixar não enviados
          </Button>
        </div>
      </div>

      {/* ── Progress banner ── */}
      <div className={classes.progressCard}>
        <div className={classes.progressCardHeader}>
          <div className={classes.progressCardLeft}>
            <AssessmentOutlinedIcon
              style={{
                fontSize: 18,
                color: "#6366f1",
              }}
            />
            <Typography className={classes.progressTitle}>
              Progresso do envio
            </Typography>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          <Typography className={classes.progressPercent}>
            {delivered} / {validContacts} —{" "}
            {loading ? "..." : `${Math.round(percent)}%`}
          </Typography>
        </div>
        <Typography className={classes.progressSubtitle}>
          {campaign.status === "EM_ANDAMENTO"
            ? "Campanha em andamento. Os números são atualizados em tempo real."
            : "Acompanhe quantos contatos foram alcançados e exporte os pendentes para continuar em nova campanha."}
        </Typography>
        <LinearProgress
          variant={loading ? "indeterminate" : "determinate"}
          className={classes.progressBar}
          value={percent}
        />
      </div>

      {/* ── Stats row ── */}
      <div className={classes.statsRow}>
        <StatCard
          icon={<GroupIcon />}
          iconBg="rgba(99,102,241,0.1)"
          iconColor="#6366f1"
          title={i18n.t("campaignReport.validContacts")}
          value={validContacts}
        />

        <StatCard
          icon={<CheckCircleIcon />}
          iconBg="rgba(34,197,94,0.1)"
          iconColor="#22c55e"
          title={i18n.t("campaignReport.deliver")}
          value={delivered}
        />

        <StatCard
          icon={<ErrorOutlineIcon />}
          iconBg="rgba(239,68,68,0.1)"
          iconColor="#ef4444"
          title="Não enviados"
          value={notDeliveredContacts.length}
        />

        {campaign.confirmation && (
          <>
            <StatCard
              icon={<DoneIcon />}
              iconBg="rgba(245,158,11,0.1)"
              iconColor="#f59e0b"
              title={i18n.t("campaignReport.confirmationsRequested")}
              value={confirmationRequested}
            />
            <StatCard
              icon={<DoneAllIcon />}
              iconBg="rgba(20,184,166,0.1)"
              iconColor="#14b8a6"
              title={i18n.t("campaignReport.confirmations")}
              value={confirmed}
            />
          </>
        )}

        {campaign.whatsappId && (
          <StatCard
            icon={<WhatsAppIcon />}
            iconBg="rgba(37,211,102,0.1)"
            iconColor="#25d366"
            title={i18n.t("campaignReport.connection")}
            value={get(campaign, "whatsapp.name", "-")}
            isText
          />
        )}

        {campaign.contactListId && (
          <StatCard
            icon={<ListAltIcon />}
            iconBg="rgba(59,130,246,0.1)"
            iconColor="#3b82f6"
            title={i18n.t("campaignReport.contactLists")}
            value={get(campaign, "contactList.name", "-")}
            isText
          />
        )}

        <StatCard
          icon={<ScheduleIcon />}
          iconBg="rgba(148,163,184,0.1)"
          iconColor="#64748b"
          title={i18n.t("campaignReport.schedule")}
          value={datetimeToClient(campaign.scheduledAt)}
          isText
        />

        <StatCard
          icon={<EventAvailableIcon />}
          iconBg="rgba(34,197,94,0.08)"
          iconColor="#16a34a"
          title={i18n.t("campaignReport.conclusion")}
          value={datetimeToClient(campaign.completedAt)}
          isText
        />
      </div>
    </div>
  );
};

export default CampaignReport;