import React, { useState, useEffect, useReducer, useContext } from "react";
import { toast } from "react-toastify";
import n8n from "../../assets/n8n.png";
import dialogflow from "../../assets/dialogflow.png";
import webhooks from "../../assets/webhook.png";
import typebot from "../../assets/typebot.jpg";
import flowbuilder from "../../assets/flowbuilders.png";

import { makeStyles } from "@material-ui/core/styles";

import {
  Avatar,
  Button,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";

import { DeleteOutline, Edit, Add, DeviceHub } from "@material-ui/icons";
import SearchIcon from "@material-ui/icons/Search";

import MainHeader from "../../components/MainHeader";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import IntegrationModal from "../../components/QueueIntegrationModal";
import ConfirmationModal from "../../components/ConfirmationModal";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePlans from "../../hooks/usePlans";
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";
import ForbiddenPage from "../../components/ForbiddenPage";

const reducer = (state, action) => {
  if (action.type === "LOAD_INTEGRATIONS") {
    const queueIntegration = action.payload;
    const newIntegrations = [];

    queueIntegration.forEach((integration) => {
      const integrationIndex = state.findIndex((u) => u.id === integration.id);
      if (integrationIndex !== -1) {
        state[integrationIndex] = integration;
      } else {
        newIntegrations.push(integration);
      }
    });

    return [...state, ...newIntegrations];
  }

  if (action.type === "UPDATE_INTEGRATIONS") {
    const queueIntegration = action.payload;
    const integrationIndex = state.findIndex((u) => u.id === queueIntegration.id);

    if (integrationIndex !== -1) {
      state[integrationIndex] = queueIntegration;
      return [...state];
    }
    return [queueIntegration, ...state];
  }

  if (action.type === "DELETE_INTEGRATION") {
    const integrationId = action.payload;

    const integrationIndex = state.findIndex((u) => u.id === integrationId);
    if (integrationIndex !== -1) {
      state.splice(integrationIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    padding: theme.spacing(2),
    height: "calc(100% - 48px)",
    display: "flex",
    flexDirection: "column",
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
    },
  },

  // ── Controls bar ─────────────────────────────────────────────────────────
  controlsPaper: {
    marginBottom: theme.spacing(2),
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow:
      theme.palette.type === "dark"
        ? "0 1px 3px rgba(0,0,0,0.4)"
        : "0 1px 3px rgba(15,23,42,0.08)",
    padding: theme.spacing(1.25, 1.5),
    backgroundColor: theme.palette.background.paper,
  },
  searchField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.03)"
          : theme.palette.background.default,
    },
    "& .MuiInputBase-input": {
      fontSize: "0.82rem",
      paddingTop: 12,
      paddingBottom: 12,
    },
  },
  actionButton: {
    height: "100%",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: "0.78rem",
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
    "&:hover": {
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    },
  },

  // ── Main table ───────────────────────────────────────────────────────────
  mainPaper: {
    flex: 1,
    overflowY: "auto",
    ...theme.scrollbarStyles,
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
    boxShadow:
      theme.palette.type === "dark"
        ? "0 1px 3px rgba(0,0,0,0.4)"
        : "0 1px 3px rgba(15,23,42,0.08)",
    [theme.breakpoints.down("sm")]: {
      overflowX: "auto",
    },
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
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
  },

  // ── Logo avatar ───────────────────────────────────────────────────────────
  avatar: {
    width: 110,
    height: 32,
    borderRadius: 4,
    objectFit: "contain",
  },

  // ── Name cell ─────────────────────────────────────────────────────────────
  nameText: {
    fontWeight: 600,
    fontSize: "0.82rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
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

  tooltip: {
    backgroundColor:
      theme.palette.type === "dark" ? "#1e293b" : "#f8fafc",
    color: theme.palette.type === "dark" ? "#e2e8f0" : "#334155",
    fontSize: "0.78rem",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
  },
}));

const INTEGRATION_LOGOS = {
  dialogflow,
  n8n,
  webhook: webhooks,
  typebot,
  flowbuilder,
};

const QueueIntegration = () => {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [queueIntegration, dispatch] = useReducer(reducer, []);
  const { user, socket } = useContext(AuthContext);

  const { getPlanCompany } = usePlans();
  const companyId = user.companyId;
  const history = useHistory();

  useEffect(() => {
    async function fetchData() {
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useIntegrations) {
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
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchIntegrations = async () => {
        try {
          const { data } = await api.get("/queueIntegration/", {
            params: { searchParam, pageNumber },
          });
          dispatch({ type: "LOAD_INTEGRATIONS", payload: data.queueIntegrations });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchIntegrations();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const onQueueEvent = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_INTEGRATIONS", payload: data.queueIntegration });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_INTEGRATION", payload: +data.integrationId });
      }
    };

    socket.on(`company-${companyId}-queueIntegration`, onQueueEvent);
    return () => {
      socket.off(`company-${companyId}-queueIntegration`, onQueueEvent);
    };
  }, [socket, companyId]);

  const handleOpenUserModal = () => {
    setSelectedIntegration(null);
    setUserModalOpen(true);
  };

  const handleCloseIntegrationModal = () => {
    setSelectedIntegration(null);
    setUserModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditIntegration = (integration) => {
    setSelectedIntegration(integration);
    setUserModalOpen(true);
  };

  const handleDeleteIntegration = async (integrationId) => {
    try {
      await api.delete(`/queueIntegration/${integrationId}`);
      toast.success(i18n.t("queueIntegration.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingUser(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  return (
    <div className={classes.pageRoot}>
      <ConfirmationModal
        title={
          deletingUser &&
          `${i18n.t("queueIntegration.confirmationModal.deleteTitle")} ${deletingUser.name}?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteIntegration(deletingUser.id)}
      >
        {i18n.t("queueIntegration.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <IntegrationModal
        open={userModalOpen}
        onClose={handleCloseIntegrationModal}
        aria-labelledby="form-dialog-title"
        integrationId={selectedIntegration && selectedIntegration.id}
      />

      {user.profile === "user" ? (
        <ForbiddenPage />
      ) : (
        <>
          <MainHeader>
            <Grid container style={{ width: "100%" }}>
              <Grid item xs={12}>
                <Paper elevation={0} className={classes.controlsPaper}>
                  <Grid container spacing={1} alignItems="stretch">
                    <Grid item xs={12} sm={9} md={9}>
                      <TextField
                        fullWidth
                        placeholder={i18n.t("queueIntegration.searchPlaceholder")}
                        type="search"
                        value={searchParam}
                        onChange={handleSearch}
                        variant="outlined"
                        className={classes.searchField}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <SearchIcon style={{ fontSize: 18, color: "#94a3b8" }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={3} md={3}>
                      <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        onClick={handleOpenUserModal}
                        className={classes.actionButton}
                        startIcon={<Add style={{ fontSize: 16 }} />}
                      >
                        {i18n.t("queueIntegration.buttons.add")}
                      </Button>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          </MainHeader>

          {/* ── Main Table ── */}
          <Paper className={classes.mainPaper} variant="outlined" onScroll={handleScroll}>
            <Table size="small">
              <TableHead>
                <TableRow className={classes.tableHeaderRow}>
                  <TableCell className={classes.tableHeaderCell} padding="checkbox" />
                  <TableCell className={classes.tableHeaderCell} align="center">
                    {i18n.t("queueIntegration.table.id")}
                  </TableCell>
                  <TableCell className={classes.tableHeaderCell} align="center">
                    {i18n.t("queueIntegration.table.name")}
                  </TableCell>
                  <TableCell className={classes.tableHeaderCell} align="right">
                    {i18n.t("queueIntegration.table.actions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {queueIntegration.length > 0 ? (
                  queueIntegration.map((integration) => (
                    <TableRow key={integration.id} className={classes.tableRow}>
                      {/* Logo */}
                      <TableCell className={classes.tableCell} style={{ width: 130 }}>
                        {INTEGRATION_LOGOS[integration.type] && (
                          <Avatar
                            src={INTEGRATION_LOGOS[integration.type]}
                            variant="square"
                            className={classes.avatar}
                          />
                        )}
                      </TableCell>

                      {/* ID */}
                      <TableCell
                        className={`${classes.tableCell} ${classes.tableCellMono}`}
                        align="center"
                      >
                        {integration.id}
                      </TableCell>

                      {/* Name */}
                      <TableCell className={classes.tableCell} align="center">
                        <span className={classes.nameText}>{integration.name}</span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className={classes.tableCell} align="right">
                        <div className={classes.actionsCell}>
                          <Tooltip
                            title="Editar integração"
                            arrow
                            classes={{ tooltip: classes.tooltip }}
                          >
                            <IconButton
                              className={classes.actionIconBtn}
                              size="small"
                              onClick={() => handleEditIntegration(integration)}
                            >
                              <Edit style={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>

                          <Tooltip
                            title="Excluir integração"
                            arrow
                            classes={{ tooltip: classes.tooltip }}
                          >
                            <IconButton
                              className={`${classes.actionIconBtn} ${classes.actionIconBtnDanger}`}
                              size="small"
                              onClick={() => {
                                setConfirmModalOpen(true);
                                setDeletingUser(integration);
                              }}
                            >
                              <DeleteOutline style={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : !loading ? (
                  <TableRow>
                    <TableCell colSpan={4} style={{ border: "none", padding: 0 }}>
                      <div className={classes.emptyState}>
                        <div className={classes.emptyIcon}>
                          <DeviceHub style={{ fontSize: 28 }} />
                        </div>
                        <Typography className={classes.emptyTitle}>
                          Nenhuma integração encontrada
                        </Typography>
                        <Typography className={classes.emptySubtitle}>
                          Adicione sua primeira integração clicando em "Adicionar Projeto".
                        </Typography>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
                {loading && <TableRowSkeleton columns={4} />}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}
    </div>
  );
};

export default QueueIntegration;
