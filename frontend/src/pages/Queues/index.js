import React, { useEffect, useReducer, useState, useContext } from "react";

import {
  Button,
  IconButton,
  makeStyles,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Tooltip,
} from "@material-ui/core";

import TableRowSkeleton from "../../components/TableRowSkeleton";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { DeleteOutline, Edit, Add, AccountTreeOutlined } from "@material-ui/icons";
import QueueModal from "../../components/QueueModal";
import { toast } from "react-toastify";
import ConfirmationModal from "../../components/ConfirmationModal";
import { AuthContext } from "../../context/Auth/AuthContext";
import ForbiddenPage from "../../components/ForbiddenPage";

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    padding: theme.spacing(3),
    height: "calc(100% - 48px)",
    overflowY: "auto",
    ...theme.scrollbarStyles,
    display: "flex",
    flexDirection: "column",
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1.5),
      height: "auto",
      minHeight: "calc(100vh - 48px)",
    },
  },

  // ── Add button ───────────────────────────────────────────────────────────
  actionsWrap: {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: theme.spacing(1.5),
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

  // ── Main table ────────────────────────────────────────────────────────────
  mainPaper: {
    flex: 1,
    minHeight: 0,
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    overflowY: "auto",
    ...theme.scrollbarStyles,
    boxShadow:
      theme.palette.type === "dark"
        ? "0 1px 3px rgba(0,0,0,0.4)"
        : "0 1px 3px rgba(15,23,42,0.08)",
    [theme.breakpoints.down("sm")]: {
      flex: "0 0 auto",
      minHeight: "48vh",
      maxHeight: "62vh",
    },
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
  idCell: {
    fontFamily: "'JetBrains Mono', 'Fira Mono', monospace",
    fontSize: "0.72rem",
    fontWeight: 600,
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    letterSpacing: "0.02em",
  },

  // ── Name badge ────────────────────────────────────────────────────────────
  nameWrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 10px",
    borderRadius: 6,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(99,102,241,0.15)"
        : "rgba(99,102,241,0.08)",
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(99,102,241,0.3)"
        : "rgba(99,102,241,0.2)"
    }`,
    fontSize: "0.8rem",
    fontWeight: 700,
    color: theme.palette.type === "dark" ? "#818cf8" : "#4f46e5",
  },

  colorSwatch: {
    width: 48,
    height: 16,
    borderRadius: 5,
    border: `1px solid ${theme.palette.divider}`,
    display: "inline-block",
  },

  greetingText: {
    fontSize: "0.78rem",
    color: theme.palette.text.secondary,
    maxWidth: 280,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    display: "block",
  },
  greetingEmpty: {
    color: theme.palette.text.disabled,
    fontSize: "0.78rem",
    fontStyle: "italic",
  },

  // ── Action buttons ────────────────────────────────────────────────────────
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

  // ── Empty state ───────────────────────────────────────────────────────────
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

const reducer = (state, action) => {
  if (action.type === "LOAD_QUEUES") {
    const queues = action.payload;
    const newQueues = [];

    queues.forEach((queue) => {
      const queueIndex = state.findIndex((q) => q.id === queue.id);
      if (queueIndex !== -1) {
        state[queueIndex] = queue;
      } else {
        newQueues.push(queue);
      }
    });

    return [...state, ...newQueues];
  }

  if (action.type === "UPDATE_QUEUES") {
    const queue = action.payload;
    const queueIndex = state.findIndex((u) => u.id === queue.id);

    if (queueIndex !== -1) {
      state[queueIndex] = queue;
      return [...state];
    }
    return [queue, ...state];
  }

  if (action.type === "DELETE_QUEUE") {
    const queueId = action.payload;
    const queueIndex = state.findIndex((q) => q.id === queueId);
    if (queueIndex !== -1) {
      state.splice(queueIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const Queues = () => {
  const classes = useStyles();

  const [queues, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);

  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const { user, socket } = useContext(AuthContext);
  const companyId = user.companyId;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/queue");
        dispatch({ type: "LOAD_QUEUES", payload: data });
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const onQueueEvent = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_QUEUES", payload: data.queue });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_QUEUE", payload: data.queueId });
      }
    };
    socket.on(`company-${companyId}-queue`, onQueueEvent);

    return () => {
      socket.off(`company-${companyId}-queue`, onQueueEvent);
    };
  }, [socket, companyId]);

  const handleOpenQueueModal = () => {
    setQueueModalOpen(true);
    setSelectedQueue(null);
  };

  const handleCloseQueueModal = () => {
    setQueueModalOpen(false);
    setSelectedQueue(null);
  };

  const handleEditQueue = (queue) => {
    setSelectedQueue(queue);
    setQueueModalOpen(true);
  };

  const handleCloseConfirmationModal = () => {
    setConfirmModalOpen(false);
    setSelectedQueue(null);
  };

  const handleDeleteQueue = async (queueId) => {
    try {
      await api.delete(`/queue/${queueId}`);
      toast.success(i18n.t("Queue deleted successfully!"));
    } catch (err) {
      toastError(err);
    }
    setSelectedQueue(null);
  };

  if (user.profile === "user") {
    return <ForbiddenPage />;
  }

  return (
    <div className={classes.pageRoot}>
      <ConfirmationModal
        title={
          selectedQueue &&
          `${i18n.t("queues.confirmationModal.deleteTitle")} ${selectedQueue.name}?`
        }
        open={confirmModalOpen}
        onClose={handleCloseConfirmationModal}
        onConfirm={() => handleDeleteQueue(selectedQueue.id)}
      >
        {i18n.t("queues.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <QueueModal
        open={queueModalOpen}
        onClose={handleCloseQueueModal}
        queueId={selectedQueue?.id}
        onEdit={(res) => {
          if (res) {
            setTimeout(() => {
              handleEditQueue(res);
            }, 500);
          }
        }}
      />

      {/* ── Add button ── */}
      <div className={classes.actionsWrap}>
        <Button
          variant="contained"
          color="primary"
          className={classes.btnPrimary}
          startIcon={<Add style={{ fontSize: 16 }} />}
          onClick={handleOpenQueueModal}
        >
          {i18n.t("queues.buttons.add")}
        </Button>
      </div>

      {/* ── Main Table ── */}
      <Paper className={classes.mainPaper} variant="outlined">
        <div className={classes.tableContainer}>
          <Table size="small">
            <TableHead>
              <TableRow className={classes.tableHeaderRow}>
                <TableCell align="center" className={classes.tableHeaderCell}>
                  {i18n.t("queues.table.ID")}
                </TableCell>
                <TableCell className={classes.tableHeaderCell}>
                  {i18n.t("queues.table.name")}
                </TableCell>
                <TableCell align="center" className={classes.tableHeaderCell}>
                  {i18n.t("queues.table.color")}
                </TableCell>
                <TableCell align="center" className={classes.tableHeaderCell}>
                  {i18n.t("queues.table.orderQueue")}
                </TableCell>
                <TableCell className={classes.tableHeaderCell}>
                  {i18n.t("queues.table.greeting")}
                </TableCell>
                <TableCell align="right" className={classes.tableHeaderCell}>
                  {i18n.t("queues.table.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {queues.length > 0 ? (
                queues.map((queue) => (
                  <TableRow key={queue.id} className={classes.tableRow}>
                    <TableCell
                      align="center"
                      className={`${classes.tableCell} ${classes.idCell}`}
                    >
                      #{queue.id}
                    </TableCell>
                    <TableCell className={classes.tableCell}>
                      <span className={classes.nameWrap}>{queue.name}</span>
                    </TableCell>
                    <TableCell align="center" className={classes.tableCell}>
                      <span
                        className={classes.colorSwatch}
                        style={{ backgroundColor: queue.color }}
                      />
                    </TableCell>
                    <TableCell align="center" className={classes.tableCell}>
                      {queue.orderQueue}
                    </TableCell>
                    <TableCell className={classes.tableCell}>
                      {queue.greetingMessage ? (
                        <span className={classes.greetingText} title={queue.greetingMessage}>
                          {queue.greetingMessage}
                        </span>
                      ) : (
                        <span className={classes.greetingEmpty}>Sem mensagem</span>
                      )}
                    </TableCell>
                    <TableCell align="right" className={classes.tableCell}>
                      <div className={classes.actionsCell}>
                        <Tooltip title="Editar fila" arrow>
                          <IconButton
                            size="small"
                            className={classes.actionIconBtn}
                            onClick={() => handleEditQueue(queue)}
                          >
                            <Edit style={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Excluir fila" arrow>
                          <IconButton
                            size="small"
                            className={`${classes.actionIconBtn} ${classes.actionIconBtnDanger}`}
                            onClick={() => {
                              setSelectedQueue(queue);
                              setConfirmModalOpen(true);
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
                  <TableCell colSpan={6} style={{ border: "none", padding: 0 }}>
                    <div className={classes.emptyState}>
                      <div className={classes.emptyIcon}>
                        <AccountTreeOutlined style={{ fontSize: 28 }} />
                      </div>
                      <Typography className={classes.emptyTitle}>
                        Nenhuma fila cadastrada
                      </Typography>
                      <Typography className={classes.emptySubtitle}>
                        Crie sua primeira fila clicando em
                        "Adicionar fila" para organizar o atendimento.
                      </Typography>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}

              {loading && <TableRowSkeleton columns={6} />}
            </TableBody>
          </Table>
        </div>
      </Paper>
    </div>
  );
};

export default Queues;
