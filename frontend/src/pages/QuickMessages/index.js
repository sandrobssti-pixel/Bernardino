import React, { useState, useEffect, useReducer, useContext } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Tooltip from "@material-ui/core/Tooltip";

import SearchIcon from "@material-ui/icons/Search";
import AddIcon from "@material-ui/icons/Add";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import FlashOnIcon from "@material-ui/icons/FlashOn";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import TuneIcon from "@material-ui/icons/Tune";
import SmsOutlinedIcon from "@material-ui/icons/SmsOutlined";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import CancelIcon from "@material-ui/icons/Cancel";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import QuickMessageDialog from "../../components/QuickMessageDialog";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { isArray } from "lodash";
import { AuthContext } from "../../context/Auth/AuthContext";

const reducer = (state, action) => {
  if (action.type === "LOAD_QUICKMESSAGES") {
    const quickmessages = action.payload;
    const newQuickmessages = [];

    if (isArray(quickmessages)) {
      quickmessages.forEach((quickemessage) => {
        const quickemessageIndex = state.findIndex((u) => u.id === quickemessage.id);
        if (quickemessageIndex !== -1) {
          state[quickemessageIndex] = quickemessage;
        } else {
          newQuickmessages.push(quickemessage);
        }
      });
    }

    return [...state, ...newQuickmessages];
  }

  if (action.type === "UPDATE_QUICKMESSAGES") {
    const quickemessage = action.payload;
    const quickemessageIndex = state.findIndex((u) => u.id === quickemessage.id);

    if (quickemessageIndex !== -1) {
      state[quickemessageIndex] = quickemessage;
      return [...state];
    }
    return [quickemessage, ...state];
  }

  if (action.type === "DELETE_QUICKMESSAGE") {
    const quickemessageId = action.payload;

    const quickemessageIndex = state.findIndex((u) => u.id === quickemessageId);
    if (quickemessageIndex !== -1) {
      state.splice(quickemessageIndex, 1);
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

  // ── Stats row ─────────────────────────────────────────────────────────────
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down("xs")]: {
      gridTemplateColumns: "1fr",
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

  // ── Search bar ────────────────────────────────────────────────────────────
  searchWrap: {
    marginBottom: theme.spacing(1.5),
  },
  searchField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      backgroundColor: theme.palette.background.paper,
    },
    "& .MuiInputBase-input": {
      fontSize: "0.82rem",
      paddingTop: 10,
      paddingBottom: 10,
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

  // ── Shortcode badge ───────────────────────────────────────────────────────
  shortcodeWrap: {
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
    fontFamily: "monospace",
    fontSize: "0.78rem",
    fontWeight: 700,
    color: theme.palette.type === "dark" ? "#818cf8" : "#4f46e5",
    letterSpacing: "0.02em",
  },

  // ── File cell ─────────────────────────────────────────────────────────────
  fileWrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    color: theme.palette.text.secondary,
    fontSize: "0.78rem",
  },
  fileNoAttach: {
    color: theme.palette.text.disabled,
    fontSize: "0.78rem",
    fontStyle: "italic",
  },

  // ── Status badge (editável) ───────────────────────────────────────────────
  badgeEditable: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: "0.7rem",
    fontWeight: 600,
    backgroundColor: "rgba(34,197,94,0.10)",
    color: "#16a34a",
    border: "1px solid rgba(34,197,94,0.25)",
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    backgroundColor: "#22c55e",
    flexShrink: 0,
  },
  badgeMuted: {
    color: theme.palette.text.disabled,
    fontSize: "0.78rem",
    fontWeight: 600,
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

const Quickemessages = () => {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedQuickemessage, setSelectedQuickemessage] = useState(null);
  const [deletingQuickemessage, setDeletingQuickemessage] = useState(null);
  const [quickemessageModalOpen, setQuickMessageDialogOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [quickemessages, dispatch] = useReducer(reducer, []);
  const { user, socket } = useContext(AuthContext);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      fetchQuickemessages();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const companyId = user.companyId;

    const onQuickMessageEvent = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_QUICKMESSAGES", payload: data.record });
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE_QUICKMESSAGE", payload: +data.id });
      }
    };
    socket.on(`company-${companyId}-quickemessage`, onQuickMessageEvent);

    return () => {
      socket.off(`company-${companyId}-quickemessage`, onQuickMessageEvent);
    };
  }, [socket, user.companyId]);

  const fetchQuickemessages = async () => {
    try {
      const { data } = await api.get("/quick-messages", {
        params: { searchParam, pageNumber },
      });

      dispatch({ type: "LOAD_QUICKMESSAGES", payload: data.records });
      setHasMore(data.hasMore);
      setLoading(false);
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenQuickMessageDialog = () => {
    setSelectedQuickemessage(null);
    setQuickMessageDialogOpen(true);
  };

  const handleCloseQuickMessageDialog = () => {
    setSelectedQuickemessage(null);
    setQuickMessageDialogOpen(false);
    fetchQuickemessages();
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditQuickemessage = (quickemessage) => {
    setSelectedQuickemessage(quickemessage);
    setQuickMessageDialogOpen(true);
  };

  const handleDeleteQuickemessage = async (quickemessageId) => {
    try {
      await api.delete(`/quick-messages/${quickemessageId}`);
      toast.success(i18n.t("quickemessages.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingQuickemessage(null);
    setSearchParam("");
    setPageNumber(1);
    fetchQuickemessages();
    dispatch({ type: "RESET" });
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

  const totalQuickMessages = quickemessages.length;
  const messagesWithAttachment = quickemessages.filter((item) => !!item.mediaName).length;
  const editableMessages = quickemessages.filter((item) => item.geral === true).length;

  return (
    <div className={classes.pageRoot}>
      <ConfirmationModal
        title={
          deletingQuickemessage &&
          `${i18n.t("quickMessages.confirmationModal.deleteTitle")} ${
            deletingQuickemessage.shortcode
          }?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteQuickemessage(deletingQuickemessage.id)}
      >
        {i18n.t("quickMessages.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <QuickMessageDialog
        resetPagination={() => {
          setPageNumber(1);
          fetchQuickemessages();
        }}
        open={quickemessageModalOpen}
        onClose={handleCloseQuickMessageDialog}
        aria-labelledby="form-dialog-title"
        quickemessageId={selectedQuickemessage && selectedQuickemessage.id}
      />

      {/* ── Stats row ── */}
      <div className={classes.statsRow}>
        <div className={classes.statCard}>
          <div
            className={classes.statIconWrap}
            style={{ backgroundColor: "rgba(99,102,241,0.1)" }}
          >
            <FlashOnIcon style={{ fontSize: 20, color: "#6366f1" }} />
          </div>
          <div>
            <div className={classes.statValue}>{totalQuickMessages}</div>
            <div className={classes.statLabel}>Total de atalhos</div>
          </div>
        </div>

        <div className={classes.statCard}>
          <div
            className={classes.statIconWrap}
            style={{ backgroundColor: "rgba(59,130,246,0.1)" }}
          >
            <AttachFileIcon style={{ fontSize: 20, color: "#3b82f6" }} />
          </div>
          <div>
            <div className={classes.statValue}>{messagesWithAttachment}</div>
            <div className={classes.statLabel}>Com arquivo</div>
          </div>
        </div>

        <div className={classes.statCard}>
          <div
            className={classes.statIconWrap}
            style={{ backgroundColor: "rgba(34,197,94,0.1)" }}
          >
            <TuneIcon style={{ fontSize: 20, color: "#22c55e" }} />
          </div>
          <div>
            <div className={classes.statValue}>{editableMessages}</div>
            <div className={classes.statLabel}>Permitem edição</div>
          </div>
        </div>
      </div>

      {/* ── Search bar + Add button ── */}
      <div className={classes.searchWrap} style={{ display: "flex", gap: 8 }}>
        <TextField
          fullWidth
          placeholder={i18n.t("quickMessages.searchPlaceholder")}
          type="search"
          value={searchParam}
          onChange={handleSearch}
          variant="outlined"
          size="small"
          className={classes.searchField}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon style={{ fontSize: 18, color: "#94a3b8" }} />
              </InputAdornment>
            ),
          }}
        />
        <Button
          variant="contained"
          color="primary"
          className={classes.btnPrimary}
          startIcon={<AddIcon style={{ fontSize: 16 }} />}
          onClick={handleOpenQuickMessageDialog}
          style={{ whiteSpace: "nowrap", flexShrink: 0 }}
        >
          {i18n.t("quickMessages.buttons.add")}
        </Button>
      </div>

      {/* ── Main Table ── */}
      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        <div className={classes.tableContainer}>
          <Table size="small">
            <TableHead>
              <TableRow className={classes.tableHeaderRow}>
                <TableCell className={classes.tableHeaderCell}>
                  {i18n.t("quickMessages.table.shortcode")}
                </TableCell>
                <TableCell className={classes.tableHeaderCell}>
                  {i18n.t("quickMessages.table.mediaName")}
                </TableCell>
                <TableCell className={classes.tableHeaderCell} align="center">
                  Visível
                </TableCell>
                <TableCell className={classes.tableHeaderCell} align="center">
                  Permite edição
                </TableCell>
                <TableCell className={classes.tableHeaderCell} align="right">
                  {i18n.t("quickMessages.table.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {quickemessages.length > 0 ? (
                quickemessages.map((quickemessage) => (
                  <TableRow key={quickemessage.id} className={classes.tableRow}>

                    {/* Shortcode */}
                    <TableCell className={classes.tableCell}>
                      <span className={classes.shortcodeWrap}>
                        /{quickemessage.shortcode}
                      </span>
                    </TableCell>

                    {/* File */}
                    <TableCell className={classes.tableCell}>
                      {quickemessage.mediaName ? (
                        <span className={classes.fileWrap}>
                          <AttachFileIcon style={{ fontSize: 14 }} />
                          {quickemessage.mediaName}
                        </span>
                      ) : (
                        <span className={classes.fileNoAttach}>
                          {i18n.t("quickMessages.noAttachment")}
                        </span>
                      )}
                    </TableCell>

                    {/* visao — Visível para equipe */}
                    <TableCell className={classes.tableCell} align="center">
                      {quickemessage.visao === true ? (
                        <CheckCircleIcon style={{ fontSize: 20, color: "#22c55e" }} />
                      ) : (
                        <CancelIcon style={{ fontSize: 20, color: "#ef4444" }} />
                      )}
                    </TableCell>

                    {/* geral — Permite edição */}
                    <TableCell className={classes.tableCell} align="center">
                      {quickemessage.geral === true ? (
                        <CheckCircleIcon style={{ fontSize: 20, color: "#22c55e" }} />
                      ) : (
                        <CancelIcon style={{ fontSize: 20, color: "#ef4444" }} />
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className={classes.tableCell} align="right">
                      <div className={classes.actionsCell}>
                        <Tooltip title="Editar atalho" arrow>
                          <IconButton
                            size="small"
                            className={classes.actionIconBtn}
                            onClick={() => handleEditQuickemessage(quickemessage)}
                          >
                            <EditIcon style={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Excluir atalho" arrow>
                          <IconButton
                            size="small"
                            className={`${classes.actionIconBtn} ${classes.actionIconBtnDanger}`}
                            onClick={() => {
                              setConfirmModalOpen(true);
                              setDeletingQuickemessage(quickemessage);
                            }}
                          >
                            <DeleteOutlineIcon style={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : !loading ? (
                <TableRow>
                  <TableCell colSpan={5} style={{ border: "none", padding: 0 }}>
                    <div className={classes.emptyState}>
                      <div className={classes.emptyIcon}>
                        <SmsOutlinedIcon style={{ fontSize: 28 }} />
                      </div>
                      <Typography className={classes.emptyTitle}>
                        Nenhum atalho encontrado
                      </Typography>
                      <Typography className={classes.emptySubtitle}>
                        Crie sua primeira resposta rápida clicando em
                        "Nova Resposta" para agilizar o atendimento.
                      </Typography>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}

              {loading && <TableRowSkeleton columns={4} />}
            </TableBody>
          </Table>
        </div>
      </Paper>
    </div>
  );
};

export default Quickemessages;
