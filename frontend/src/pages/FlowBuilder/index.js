import React, { useState, useEffect, useReducer, useContext } from "react";

import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";

import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import Switch from "@material-ui/core/Switch";

import api from "../../services/api";
import ConfirmationModal from "../../components/ConfirmationModal";

import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import NewTicketModal from "../../components/NewTicketModal";
import {
  AddCircle,
  DevicesFold,
  Edit,
  ContentCopy,
  DeleteOutline,
  AccountTree,
} from "@mui/icons-material";

import { CircularProgress, Grid, Stack } from "@mui/material";

import FlowBuilderModal from "../../components/FlowBuilderModal";

const reducer = (state, action) => {
  if (action.type === "LOAD_CONTACTS") {
    const contacts = action.payload;
    const newContacts = [];

    contacts.forEach(contact => {
      const contactIndex = state.findIndex(c => c.id === contact.id);
      if (contactIndex !== -1) {
        state[contactIndex] = contact;
      } else {
        newContacts.push(contact);
      }
    });

    return [...state, ...newContacts];
  }

  if (action.type === "UPDATE_CONTACTS") {
    const contact = action.payload;
    const contactIndex = state.findIndex(c => c.id === contact.id);

    if (contactIndex !== -1) {
      state[contactIndex] = contact;
      return [...state];
    } else {
      return [contact, ...state];
    }
  }

  if (action.type === "DELETE_CONTACT") {
    const contactId = action.payload;

    const contactIndex = state.findIndex(c => c.id === contactId);
    if (contactIndex !== -1) {
      state.splice(contactIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles(theme => ({
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
    cursor: "pointer",
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

  // ── iOS Switch ───────────────────────────────────────────────────────────
  iosSwitch: {
    width: 44,
    height: 26,
    padding: 0,
    margin: 0,
    "& .MuiSwitch-switchBase": {
      padding: 2,
      transition: theme.transitions.create("transform", { duration: 200 }),
      "&.Mui-checked": {
        transform: "translateX(18px)",
        color: "#fff",
        "& + .MuiSwitch-track": {
          backgroundColor: "#22c55e",
          opacity: 1,
          border: "none",
        },
      },
      "&.Mui-disabled": {
        "& .MuiSwitch-thumb": { opacity: 0.6 },
        "& + .MuiSwitch-track": { opacity: 0.4 },
      },
    },
    "& .MuiSwitch-thumb": {
      width: 22,
      height: 22,
      backgroundColor: "#fff",
      boxShadow: "0 1px 4px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(0,0,0,0.06)",
      transition: theme.transitions.create(["width"], { duration: 200 }),
    },
    "& .MuiSwitch-track": {
      borderRadius: 13,
      backgroundColor:
        theme.palette.type === "dark" ? "#52525b" : "#d4d4d8",
      opacity: 1,
      transition: theme.transitions.create("background-color", { duration: 300 }),
    },
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

const FlowBuilder = () => {
  const classes = useStyles();
  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [, dispatch] = useReducer(reducer, []);
  const [webhooks, setWebhooks] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [selectedWebhookName, setSelectedWebhookName] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [contactTicket] = useState({});
  const [deletingContact, setDeletingContact] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDuplicateOpen, setConfirmDuplicateOpen] = useState(false);

  const [hasMore, setHasMore] = useState(false);
  const [reloadData, setReloadData] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const { user, socket } = useContext(AuthContext);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get("/flowbuilder");
          const filteredFlows = searchParam
            ? data.flows.filter(flow =>
                flow.name?.toLowerCase().includes(searchParam)
              )
            : data.flows;
          setWebhooks(filteredFlows);
          dispatch({ type: "LOAD_CONTACTS", payload: filteredFlows });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber, reloadData]);

  useEffect(() => {
    const companyId = user.companyId;

    const onContact = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_CONTACTS", payload: data.contact });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_CONTACT", payload: +data.contactId });
      }
    };

    socket.on(`company-${companyId}-contact`, onContact);

    return () => {
      socket.off(`company-${companyId}-contact`, onContact);
    };
  }, [socket, user.companyId]);

  const handleSearch = event => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleOpenContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(true);
  };

  const handleCloseContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(false);
  };

  const handleCloseOrOpenTicket = ticket => {
    setNewTicketModalOpen(false);
    if (ticket !== undefined && ticket.uuid !== undefined) {
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  const handleDeleteWebhook = async webhookId => {
    try {
      await api.delete(`/flowbuilder/${webhookId}`).then(res => {
        setDeletingContact(null);
        setReloadData(old => !old);
      });
      toast.success("Fluxo excluído com sucesso");
    } catch (err) {
      toastError(err);
    }
  };

  const handleToggleActive = async (contact) => {
    const nextActive = !contact.active;
    setTogglingId(contact.id);
    try {
      await api.patch(`/flowbuilder/${contact.id}/active`, { active: nextActive });
      dispatch({ type: "UPDATE_CONTACTS", payload: { ...contact, active: nextActive } });
      setWebhooks(old =>
        old.map(w => (w.id === contact.id ? { ...w, active: nextActive } : w))
      );
      toast.success(nextActive ? "Fluxo ativado" : "Fluxo desativado");
    } catch (err) {
      toastError(err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDuplicateFlow = async flowId => {
    try {
      await api.post(`/flowbuilder/duplicate`, { flowId: flowId }).then(res => {
        setDeletingContact(null);
        setReloadData(old => !old);
      });
      toast.success("Fluxo duplicado com sucesso");
    } catch (err) {
      toastError(err);
    }
  };

  const loadMore = () => {
    setPageNumber(prevState => prevState + 1);
  };

  const handleScroll = e => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  return (
    <div className={classes.pageRoot}>
      <NewTicketModal
        modalOpen={newTicketModalOpen}
        initialContact={contactTicket}
        onClose={ticket => {
          handleCloseOrOpenTicket(ticket);
        }}
      />
      <FlowBuilderModal
        open={contactModalOpen}
        onClose={handleCloseContactModal}
        aria-labelledby="form-dialog-title"
        flowId={selectedContactId}
        nameWebhook={selectedWebhookName}
        onSave={() => setReloadData(old => !old)}
      />
      <ConfirmationModal
        title={
          deletingContact
            ? `${i18n.t("contacts.confirmationModal.deleteTitle")} ${deletingContact.name}?`
            : `${i18n.t("contacts.confirmationModal.importTitlte")}`
        }
        open={confirmOpen}
        onClose={setConfirmOpen}
        onConfirm={e =>
          deletingContact ? handleDeleteWebhook(deletingContact.id) : () => {}
        }
      >
        {deletingContact
          ? `Tem certeza que deseja deletar este fluxo? Todas as integrações relacionados serão perdidos.`
          : `${i18n.t("contacts.confirmationModal.importMessage")}`}
      </ConfirmationModal>
      <ConfirmationModal
        title={
          deletingContact
            ? `Deseja duplicar o fluxo ${deletingContact.name}?`
            : `${i18n.t("contacts.confirmationModal.importTitlte")}`
        }
        open={confirmDuplicateOpen}
        onClose={setConfirmDuplicateOpen}
        onConfirm={e =>
          deletingContact ? handleDuplicateFlow(deletingContact.id) : () => {}
        }
      >
        {deletingContact
          ? `Tem certeza que deseja duplicar este fluxo?`
          : `${i18n.t("contacts.confirmationModal.importMessage")}`}
      </ConfirmationModal>

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
          onClick={handleOpenContactModal}
        >
          Adicionar Fluxo
        </Button>
      </Paper>

      {/* ── Main Table ── */}
      <Paper className={classes.mainPaper} variant="outlined">
        <Grid container className={classes.tableHeaderRow}>
          <Grid item xs={5} className={classes.tableHeaderCell}>
            {i18n.t("contacts.table.name")}
          </Grid>
          <Grid item xs={4} align="center" className={classes.tableHeaderCell}>
            Status
          </Grid>
          <Grid item xs={3} align="right" className={classes.tableHeaderCell}>
            {i18n.t("contacts.table.actions")}
          </Grid>
        </Grid>
        <div className={classes.tableScroll} onScroll={handleScroll}>
          {webhooks.map(contact => (
            <Grid
              container
              key={contact.id}
              className={classes.row}
              alignItems="center"
            >
              <Grid item xs={5} onClick={() => history.push(`/flowbuilder/${contact.id}`)}>
                <div className={classes.flowCell}>
                  <div className={classes.flowIconWrap}>
                    <DevicesFold style={{ fontSize: 18 }} />
                  </div>
                  <div className={classes.flowName}>{contact.name}</div>
                </div>
              </Grid>
              <Grid item xs={4} align="center">
                <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                  <StatusBadge active={contact.active} classes={classes} />
                  <Tooltip title={contact.active ? "Desativar fluxo" : "Ativar fluxo"} arrow>
                    <span>
                      <Switch
                        className={classes.iosSwitch}
                        checked={!!contact.active}
                        disabled={togglingId === contact.id}
                        onClick={e => e.stopPropagation()}
                        onChange={() => handleToggleActive(contact)}
                      />
                    </span>
                  </Tooltip>
                </Stack>
              </Grid>
              <Grid item xs={3} align="right">
                <div className={classes.actionsCell}>
                  <Tooltip title="Editar fluxo" arrow>
                    <IconButton
                      className={classes.actionIconBtn}
                      size="small"
                      onClick={() => history.push(`/flowbuilder/${contact.id}`)}
                    >
                      <AccountTree style={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Editar nome" arrow>
                    <IconButton
                      className={classes.actionIconBtn}
                      size="small"
                      onClick={() => {
                        setDeletingContact(contact);
                        setSelectedContactId(contact.id);
                        setSelectedWebhookName(contact.name);
                        setContactModalOpen(true);
                      }}
                    >
                      <Edit style={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Duplicar" arrow>
                    <IconButton
                      className={classes.actionIconBtn}
                      size="small"
                      onClick={() => {
                        setDeletingContact(contact);
                        setConfirmDuplicateOpen(true);
                      }}
                    >
                      <ContentCopy style={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Excluir" arrow>
                    <IconButton
                      className={`${classes.actionIconBtn} ${classes.actionIconBtnDanger}`}
                      size="small"
                      onClick={() => {
                        setDeletingContact(contact);
                        setConfirmOpen(true);
                      }}
                    >
                      <DeleteOutline style={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </div>
              </Grid>
            </Grid>
          ))}

          {loading && (
            <Stack
              justifyContent={"center"}
              alignItems={"center"}
              minHeight={"50vh"}
            >
              <CircularProgress />
            </Stack>
          )}

          {!loading && webhooks.length === 0 && (
            <div className={classes.emptyState}>
              <div className={classes.emptyIcon}>
                <DevicesFold style={{ fontSize: 28 }} />
              </div>
              <Typography className={classes.emptyTitle}>
                Nenhum fluxo encontrado
              </Typography>
              <Typography className={classes.emptySubtitle}>
                Adicione seu primeiro fluxo clicando em "Adicionar Fluxo" para começar a automatizar o atendimento.
              </Typography>
            </div>
          )}
        </div>
      </Paper>
    </div>
  );
};

export default FlowBuilder;
