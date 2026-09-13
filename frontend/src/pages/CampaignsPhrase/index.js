import React, { useState, useEffect, useContext } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Typography from "@material-ui/core/Typography";
import Tooltip from "@material-ui/core/Tooltip";
import ConfirmationModal from "../../components/ConfirmationModal";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";

import { AddCircle, TextFields } from "@mui/icons-material";
import { CircularProgress, Grid, Stack } from "@mui/material";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { Can } from "../../components/Can";
import { AuthContext } from "../../context/Auth/AuthContext";
import CampaignModalPhrase from "../../components/CampaignModalPhrase";

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
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

  // ── Buttons ──────────────────────────────────────────────────────────────
  btnPrimary: {
    borderRadius: 8,
    fontWeight: 600,
    fontSize: "0.78rem",
    padding: theme.spacing(0.7, 1.5),
    boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
    textTransform: "none",
    whiteSpace: "nowrap",
    "&:hover": {
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    },
  },

  // ── Search ───────────────────────────────────────────────────────────────
  controlsPaper: {
    marginBottom: theme.spacing(2),
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow:
      theme.palette.type === "dark"
        ? "0 1px 3px rgba(0,0,0,0.4)"
        : "0 1px 3px rgba(15,23,42,0.08)",
    padding: theme.spacing(1.25),
    backgroundColor: theme.palette.background.paper,
    display: "flex",
    gap: theme.spacing(1.5),
    alignItems: "center",
    [theme.breakpoints.down("xs")]: {
      flexWrap: "wrap",
    },
  },
  searchField: {
    flex: 1,
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      backgroundColor: theme.palette.background.default,
    },
    "& .MuiInputBase-input": {
      fontSize: "0.82rem",
      paddingTop: 13,
      paddingBottom: 13,
    },
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
    display: "flex",
    flexDirection: "column",
  },
  tableScroll: {
    overflowY: "auto",
    flex: 1,
    ...theme.scrollbarStyles,
  },
  tableHeaderRow: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(15,23,42,0.025)",
    padding: theme.spacing(1.25, 2),
  },
  tableHeaderCell: {
    fontWeight: 600,
    fontSize: "0.72rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
  },
  row: {
    padding: theme.spacing(1.25, 2),
    margin: 0,
    borderBottom: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.05)"
        : "rgba(15,23,42,0.06)"
    }`,
    transition: "background-color 0.2s ease",
    "&:last-child": { borderBottom: "none" },
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.03)"
          : "rgba(15,23,42,0.02)",
    },
  },

  // ── Flow identity cell ───────────────────────────────────────────────────
  flowCell: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.25),
  },
  flowIconWrap: {
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
  flowName: {
    fontWeight: 600,
    fontSize: "0.82rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
    lineHeight: 1.2,
  },

  // ── Status badge ─────────────────────────────────────────────────────────
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

  // ── Actions ──────────────────────────────────────────────────────────────
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
}));

const STATUS_CONFIG = {
  active: {
    label: "Ativo",
    dotColor: "#22c55e",
    bg: "rgba(34,197,94,0.10)",
    color: "#16a34a",
    border: "rgba(34,197,94,0.25)",
  },
  inactive: {
    label: "Desativado",
    dotColor: "#ef4444",
    bg: "rgba(239,68,68,0.10)",
    color: "#dc2626",
    border: "rgba(239,68,68,0.25)",
  },
};

const StatusBadge = ({ active, classes }) => {
  const cfg = active ? STATUS_CONFIG.active : STATUS_CONFIG.inactive;
  return (
    <span
      className={classes.statusBadge}
      style={{
        backgroundColor: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <span className={classes.statusDot} style={{ backgroundColor: cfg.dotColor }} />
      {cfg.label}
    </span>
  );
};

const CampaignsPhrase = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deletingFlow, setDeletingFlow] = useState(null);

  const [campaignFlows, setCampaignFlows] = useState([]);
  const [modalOpenPhrase, setModalOpenPhrase] = useState(false);
  const [campaignFlowSelected, setCampaignFlowSelected] = useState();
  const [searchParam, setSearchParam] = useState("");

  const getCampaigns = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/flowcampaign");
      setCampaignFlows(data.flow || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getCampaigns();
  }, []);

  const handleDeleteCampaign = async (campaignId) => {
    try {
      await api.delete(`/flowcampaign/${campaignId}`);
      toast.success("Frase deletada");
      setDeletingFlow(null);
      getCampaigns();
    } catch (err) {
      toastError(err);
    }
  };

  const handleSearch = (event) => {
    setSearchParam(String(event.target.value || "").toLowerCase());
  };

  const filteredCampaignFlows = campaignFlows.filter((flow) =>
    String(flow?.name || "").toLowerCase().includes(searchParam)
  );

  return (
    <div className={classes.pageRoot}>
      <ConfirmationModal
        title={
          deletingFlow &&
          `${i18n.t("campaigns.confirmationModal.deleteTitle")} ${deletingFlow.name}?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteCampaign(deletingFlow.id)}
      >
        {i18n.t("campaigns.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <CampaignModalPhrase
        open={modalOpenPhrase}
        onClose={() => setModalOpenPhrase(false)}
        FlowCampaignId={campaignFlowSelected}
        onSave={getCampaigns}
      />

      {/* ── Search + actions ── */}
      <Paper elevation={0} className={classes.controlsPaper}>
        <TextField
          placeholder={i18n.t("contacts.searchPlaceholder")}
          type="search"
          value={searchParam}
          onChange={handleSearch}
          variant="outlined"
          className={classes.searchField}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon style={{ color: "gray" }} />
              </InputAdornment>
            )
          }}
        />
        <Button
          className={classes.btnPrimary}
          size="small"
          variant="contained"
          color="primary"
          startIcon={<AddCircle style={{ fontSize: 16 }} />}
          onClick={() => {
            setCampaignFlowSelected();
            setModalOpenPhrase(true);
          }}
        >
          Adicionar Fluxo
        </Button>
      </Paper>

      {/* ── Main Table ── */}
      <Paper className={classes.mainPaper} variant="outlined">
        <Grid container className={classes.tableHeaderRow}>
          <Grid item xs={5} className={classes.tableHeaderCell}>
            Nome
          </Grid>
          <Grid item xs={4} align="center" className={classes.tableHeaderCell}>
            Status
          </Grid>
          <Grid item xs={3} align="right" className={classes.tableHeaderCell}>
            {i18n.t("contacts.table.actions")}
          </Grid>
        </Grid>
        <div className={classes.tableScroll}>
          {!loading &&
            filteredCampaignFlows.map((flow) => (
              <Grid container key={flow.id} className={classes.row} alignItems="center">
                <Grid item xs={5}>
                  <div className={classes.flowCell}>
                    <div className={classes.flowIconWrap}>
                      <TextFields style={{ fontSize: 18 }} />
                    </div>
                    <div className={classes.flowName}>{flow.name}</div>
                  </div>
                </Grid>
                <Grid item xs={4} align="center">
                  <StatusBadge active={!!flow.status} classes={classes} />
                </Grid>
                <Grid item xs={3} align="right">
                  <div className={classes.actionsCell}>
                    <Tooltip title="Editar" arrow>
                      <IconButton
                        className={classes.actionIconBtn}
                        size="small"
                        onClick={() => {
                          setCampaignFlowSelected(flow.id);
                          setModalOpenPhrase(true);
                        }}
                      >
                        <EditIcon style={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Can
                      role={user.profile}
                      perform="contacts-page:deleteContact"
                      yes={() => (
                        <Tooltip title="Excluir" arrow>
                          <IconButton
                            className={`${classes.actionIconBtn} ${classes.actionIconBtnDanger}`}
                            size="small"
                            onClick={() => {
                              setConfirmModalOpen(true);
                              setDeletingFlow(flow);
                            }}
                          >
                            <DeleteOutlineIcon style={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    />
                  </div>
                </Grid>
              </Grid>
            ))}

          {loading && (
            <Stack justifyContent="center" alignItems="center" minHeight="50vh">
              <CircularProgress />
            </Stack>
          )}

          {!loading && filteredCampaignFlows.length === 0 && (
            <div className={classes.emptyState}>
              <div className={classes.emptyIcon}>
                <TextFields style={{ fontSize: 28 }} />
              </div>
              <Typography className={classes.emptyTitle}>
                Nenhum fluxo encontrado
              </Typography>
              <Typography className={classes.emptySubtitle}>
                Adicione seu primeiro fluxo por palavra chave clicando em "Adicionar Fluxo".
              </Typography>
            </div>
          )}
        </div>
      </Paper>
    </div>
  );
};

export default CampaignsPhrase;
