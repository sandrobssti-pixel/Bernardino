import React, { useContext, useEffect, useReducer, useState } from "react";
import { toast } from "react-toastify";
import {
  Button,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import SearchIcon from "@material-ui/icons/Search";
import AddIcon from "@material-ui/icons/Add";
import EditIcon from "@material-ui/icons/Edit";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import PauseCircleOutlineIcon from "@material-ui/icons/PauseCircleOutline";
import PlayCircleOutlineIcon from "@material-ui/icons/PlayCircleOutline";
import VerifiedUserIcon from "@material-ui/icons/VerifiedUser";
import { isArray } from "lodash";
import { useDate } from "../../hooks/useDate";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import ConfirmationModal from "../ConfirmationModal";
import OfficialCampaignModal from "../OfficialCampaignModal";

const reducer = (state, action) => {
  if (action.type === "LOAD_CAMPAIGNS") {
    const campaigns = action.payload;
    const newCampaigns = [];

    if (isArray(campaigns)) {
      campaigns.forEach(campaign => {
        const campaignIndex = state.findIndex(item => item.id === campaign.id);
        if (campaignIndex !== -1) {
          state[campaignIndex] = campaign;
        } else {
          newCampaigns.push(campaign);
        }
      });
    }

    return [...state, ...newCampaigns];
  }

  if (action.type === "UPDATE_CAMPAIGN") {
    const campaign = action.payload;
    const campaignIndex = state.findIndex(item => item.id === campaign.id);

    if (campaignIndex !== -1) {
      state[campaignIndex] = campaign;
      return [...state];
    }

    return [campaign, ...state];
  }

  if (action.type === "DELETE_CAMPAIGN") {
    return state.filter(item => item.id !== Number(action.payload));
  }

  if (action.type === "RESET") {
    return [];
  }

  return state;
};

const useStyles = makeStyles(theme => ({
  tabRoot: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    height: "100%",
  },

  // ── Filters ──────────────────────────────────────────────────────────────
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
  },
  filterField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      backgroundColor: theme.palette.background.default,
    },
    "& .MuiInputBase-input": {
      fontSize: "0.82rem",
    },
  },
  controlsActions: {
    display: "flex",
    gap: theme.spacing(1),
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
    [theme.breakpoints.down("sm")]: {
      justifyContent: "flex-start",
    },
  },
  actionButton: {
    minHeight: 40,
    borderRadius: 8,
    fontWeight: 600,
    fontSize: "0.75rem",
    textTransform: "none",
    whiteSpace: "nowrap",
    boxShadow: "none",
    "&:hover": {
      boxShadow: "none",
    },
  },

  // ── Table ────────────────────────────────────────────────────────────────
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
  tableScroll: {
    overflow: "auto",
    flex: 1,
    ...theme.scrollbarStyles,
  },
  tableHeaderRow: {
    display: "flex",
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(15,23,42,0.025)",
    minWidth: 860,
  },
  tableHeaderCell: {
    fontWeight: 600,
    fontSize: "0.72rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    padding: theme.spacing(1.25, 2),
  },
  row: {
    display: "flex",
    alignItems: "center",
    minWidth: 860,
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
  cell: {
    padding: theme.spacing(1.25, 2),
    fontSize: "0.8rem",
    color: theme.palette.type === "dark" ? "#cbd5e1" : "#334155",
  },

  campaignName: {
    fontWeight: 600,
    fontSize: "0.82rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
    lineHeight: 1.2,
  },
  templateCategory: {
    fontSize: "0.7rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    marginTop: 1,
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

  // ── Empty / skeleton ─────────────────────────────────────────────────────
  emptyState: {
    padding: theme.spacing(7, 3),
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing(1),
    minWidth: 860,
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
    maxWidth: 360,
    lineHeight: 1.5,
  },
  skeletonRow: {
    display: "flex",
    alignItems: "center",
    minWidth: 860,
    padding: theme.spacing(1.5, 2),
    gap: theme.spacing(2),
  },
  skeletonBlock: {
    height: 12,
    borderRadius: 4,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(15,23,42,0.06)",
  },
}));

const STATUS_CONFIG = {
  INATIVA: {
    label: "Inativa",
    dotColor: "#94a3b8",
    bg: "rgba(148,163,184,0.10)",
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

const StatusBadge = ({ status, classes }) => {
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

const OfficialCampaignsTab = () => {
  const classes = useStyles();
  const { user, socket } = useContext(AuthContext);
  const { datetimeToClient } = useDate();
  const [campaigns, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [whatsappIdFilter, setWhatsappIdFilter] = useState("");
  const [scheduledDateFilter, setScheduledDateFilter] = useState("");
  const [contactListNameFilter, setContactListNameFilter] = useState("");
  const [connections, setConnections] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deletingCampaign, setDeletingCampaign] = useState(null);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam, statusFilter, whatsappIdFilter, scheduledDateFilter, contactListNameFilter]);

  useEffect(() => {
    const loadConnections = async () => {
      try {
        const { data } = await api.get("/whatsapp/filter", {
          params: { session: 0, channel: "whatsapp_oficial" }
        });
        setConnections(Array.isArray(data) ? data : []);
      } catch (err) {
        setConnections([]);
      }
    };

    loadConnections();
  }, []);

  const fetchCampaigns = async forcedPageNumber => {
    try {
      setLoading(true);
      const currentPage = forcedPageNumber || pageNumber;
      const { data } = await api.get("/official-campaigns", {
        params: {
          searchParam,
          status: statusFilter,
          whatsappId: whatsappIdFilter,
          scheduledDate: scheduledDateFilter,
          contactListName: contactListNameFilter,
          pageNumber: currentPage
        }
      });

      if (currentPage === 1) {
        dispatch({ type: "RESET" });
      }

      dispatch({ type: "LOAD_CAMPAIGNS", payload: data.records });
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchCampaigns();
    }, 400);

    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, statusFilter, whatsappIdFilter, scheduledDateFilter, contactListNameFilter, pageNumber]);

  useEffect(() => {
    const companyId = user?.companyId;
    if (!companyId || !socket) return;

    const onCompanyOfficialCampaign = data => {
      if (!data) return;
      if (data.action === "create" || data.action === "update") {
        dispatch({ type: "UPDATE_CAMPAIGN", payload: data.record });
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE_CAMPAIGN", payload: data.id });
      }
    };

    socket.on(`company-${companyId}-official-campaign`, onCompanyOfficialCampaign);
    return () => {
      socket.off(`company-${companyId}-official-campaign`, onCompanyOfficialCampaign);
    };
  }, [socket, user?.companyId]);

  const handleScroll = event => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      setPageNumber(prev => prev + 1);
    }
  };

  const handleClearFilters = () => {
    setSearchParam("");
    setContactListNameFilter("");
    setStatusFilter("");
    setWhatsappIdFilter("");
    setScheduledDateFilter("");
  };

  const handleDelete = async campaignId => {
    try {
      await api.delete(`/official-campaigns/${campaignId}`);
      toast.success("Campanha oficial removida.");
    } catch (err) {
      toastError(err);
    } finally {
      setDeletingCampaign(null);
    }
  };

  const handleCancel = async campaign => {
    try {
      await api.post(`/official-campaigns/${campaign.id}/cancel`);
      toast.success("Campanha oficial cancelada.");
      fetchCampaigns(1);
    } catch (err) {
      toastError(err);
    }
  };

  const handleRestart = async campaign => {
    try {
      await api.post(`/official-campaigns/${campaign.id}/restart`);
      toast.success("Campanha oficial reiniciada.");
      fetchCampaigns(1);
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className={classes.tabRoot}>
      <ConfirmationModal
        title={
          deletingCampaign
            ? `Excluir campanha oficial ${deletingCampaign.name}?`
            : "Excluir campanha oficial"
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => deletingCampaign && handleDelete(deletingCampaign.id)}
      >
        Esta ação removerá apenas a campanha oficial selecionada.
      </ConfirmationModal>

      {modalOpen ? (
        <OfficialCampaignModal
          open={modalOpen}
          campaignId={selectedCampaignId}
          onClose={() => {
            setModalOpen(false);
            setSelectedCampaignId(null);
          }}
          onSave={() => {
            setPageNumber(1);
            fetchCampaigns(1);
          }}
        />
      ) : null}

      {/* ── Filters ── */}
      <Paper elevation={0} className={classes.controlsPaper}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              placeholder="Buscar campanha ou template"
              value={searchParam}
              onChange={event => setSearchParam(event.target.value.toLowerCase())}
              className={classes.filterField}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon style={{ color: "gray" }} />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              placeholder="Lista de contatos"
              value={contactListNameFilter}
              onChange={event => setContactListNameFilter(event.target.value.toLowerCase())}
              className={classes.filterField}
            />
          </Grid>
          <Grid item xs={12} sm={4} md={1}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              type="date"
              value={scheduledDateFilter}
              onChange={event => setScheduledDateFilter(event.target.value)}
              className={classes.filterField}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4} md={2}>
            <TextField
              select
              fullWidth
              variant="outlined"
              size="small"
              value={whatsappIdFilter}
              onChange={event => setWhatsappIdFilter(event.target.value)}
              className={classes.filterField}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">Todas as conexões</MenuItem>
              {connections.map(connection => (
                <MenuItem key={connection.id} value={connection.id}>
                  {connection.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4} md={2}>
            <TextField
              select
              fullWidth
              variant="outlined"
              size="small"
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value)}
              className={classes.filterField}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">Todos os status</MenuItem>
              <MenuItem value="INATIVA">Inativa</MenuItem>
              <MenuItem value="PROGRAMADA">Programada</MenuItem>
              <MenuItem value="EM_ANDAMENTO">Em andamento</MenuItem>
              <MenuItem value="CANCELADA">Cancelada</MenuItem>
              <MenuItem value="FINALIZADA">Finalizada</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={12} md={2}>
            <div className={classes.controlsActions}>
              <Button
                variant="outlined"
                onClick={handleClearFilters}
                className={classes.actionButton}
              >
                Limpar
              </Button>
              <Button
                variant="contained"
                color="primary"
                className={classes.actionButton}
                onClick={() => {
                  setSelectedCampaignId(null);
                  setModalOpen(true);
                }}
                startIcon={<AddIcon style={{ fontSize: 16 }} />}
              >
                Adicionar
              </Button>
            </div>
          </Grid>
        </Grid>
      </Paper>

      {/* ── Table ── */}
      <Paper className={classes.mainPaper} variant="outlined">
        <div className={classes.tableScroll} onScroll={handleScroll}>
          <div className={classes.tableHeaderRow}>
            <div className={classes.tableHeaderCell} style={{ flex: "1.4 0 0" }}>
              Campanha
            </div>
            <div className={classes.tableHeaderCell} style={{ flex: "1 0 0" }}>
              Conexão
            </div>
            <div className={classes.tableHeaderCell} style={{ flex: "1.2 0 0" }}>
              Template
            </div>
            <div className={classes.tableHeaderCell} style={{ flex: "1 0 0" }}>
              Público
            </div>
            <div className={classes.tableHeaderCell} style={{ flex: "1 0 0" }}>
              Agendamento
            </div>
            <div className={classes.tableHeaderCell} style={{ flex: "1 0 0" }}>
              Status
            </div>
            <div
              className={classes.tableHeaderCell}
              style={{ flex: "0 0 150px", textAlign: "center" }}
            >
              Ações
            </div>
          </div>

          {campaigns.map(campaign => (
            <div className={classes.row} key={campaign.id}>
              <div className={classes.cell} style={{ flex: "1.4 0 0" }}>
                <div className={classes.campaignName}>{campaign.name}</div>
              </div>
              <div className={classes.cell} style={{ flex: "1 0 0" }}>
                {campaign.whatsapp?.name || "-"}
              </div>
              <div className={classes.cell} style={{ flex: "1.2 0 0" }}>
                <div>{campaign.templateName || "-"}</div>
                <div className={classes.templateCategory}>
                  {campaign.templateCategory || "-"}
                </div>
              </div>
              <div className={classes.cell} style={{ flex: "1 0 0" }}>
                {campaign.contactList?.name || "-"}
              </div>
              <div className={classes.cell} style={{ flex: "1 0 0" }}>
                {campaign.scheduledAt ? datetimeToClient(campaign.scheduledAt) : "-"}
              </div>
              <div className={classes.cell} style={{ flex: "1 0 0" }}>
                <StatusBadge status={campaign.status} classes={classes} />
              </div>
              <div
                className={classes.cell}
                style={{ flex: "0 0 150px", padding: "8px 12px" }}
              >
                <div className={classes.actionsCell}>
                  <Tooltip title="Editar" arrow>
                    <IconButton
                      size="small"
                      className={classes.actionIconBtn}
                      onClick={() => {
                        setSelectedCampaignId(campaign.id);
                        setModalOpen(true);
                      }}
                    >
                      <EditIcon style={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  {(campaign.status === "EM_ANDAMENTO" || campaign.status === "PROGRAMADA") && (
                    <Tooltip title="Cancelar" arrow>
                      <IconButton
                        size="small"
                        className={classes.actionIconBtn}
                        onClick={() => handleCancel(campaign)}
                      >
                        <PauseCircleOutlineIcon style={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {campaign.status === "CANCELADA" && (
                    <Tooltip title="Reiniciar" arrow>
                      <IconButton
                        size="small"
                        className={classes.actionIconBtn}
                        onClick={() => handleRestart(campaign)}
                      >
                        <PlayCircleOutlineIcon style={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Excluir" arrow>
                    <IconButton
                      size="small"
                      className={`${classes.actionIconBtn} ${classes.actionIconBtnDanger}`}
                      onClick={() => {
                        setDeletingCampaign(campaign);
                        setConfirmModalOpen(true);
                      }}
                    >
                      <DeleteOutlineIcon style={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                </div>
              </div>
            </div>
          ))}

          {loading &&
            [...Array(4)].map((_, index) => (
              <div className={classes.skeletonRow} key={index}>
                <div
                  className={classes.skeletonBlock}
                  style={{ flex: "1.4 0 0", opacity: 1 - index * 0.15 }}
                />
                <div
                  className={classes.skeletonBlock}
                  style={{ flex: "3.2 0 0", opacity: 1 - index * 0.15 }}
                />
                <div
                  className={classes.skeletonBlock}
                  style={{ flex: "0 0 150px", opacity: 1 - index * 0.15 }}
                />
              </div>
            ))}

          {!loading && campaigns.length === 0 && (
            <div className={classes.emptyState}>
              <div className={classes.emptyIcon}>
                <VerifiedUserIcon style={{ fontSize: 28 }} />
              </div>
              <Typography className={classes.emptyTitle}>
                Nenhuma campanha oficial encontrada
              </Typography>
              <Typography className={classes.emptySubtitle}>
                Clique em "Adicionar" para criar uma campanha usando a API oficial do WhatsApp.
              </Typography>
            </div>
          )}
        </div>
      </Paper>
    </div>
  );
};

export default OfficialCampaignsTab;
