import React, { useState, useEffect, useReducer, useContext } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Typography from "@material-ui/core/Typography";
import Tooltip from "@material-ui/core/Tooltip";

import SearchIcon from "@material-ui/icons/Search";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import AddIcon from "@material-ui/icons/Add";
import PeopleIcon from "@material-ui/icons/People";
import LocalOfferIcon from "@material-ui/icons/LocalOffer";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import TagModal from "../../components/TagModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD_TAGS":
      return [...state, ...action.payload];
    case "UPDATE_TAGS": {
      const tag = action.payload;
      const tagIndex = state.findIndex((s) => s.id === tag.id);
      if (tagIndex !== -1) {
        state[tagIndex] = tag;
        return [...state];
      }
      return [tag, ...state];
    }
    case "DELETE_TAGS": {
      const tagId = action.payload;
      return state.filter((tag) => tag.id !== tagId);
    }
    case "RESET":
      return [];
    default:
      return state;
  }
};

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

  // ── Search bar ───────────────────────────────────────────────────────────
  searchBar: {
    marginBottom: theme.spacing(2),
  },
  searchField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 10,
      backgroundColor: theme.palette.background.paper,
      border: `1px solid ${theme.palette.divider}`,
      "& fieldset": { border: "none" },
    },
    "& .MuiInputBase-input": {
      fontSize: "0.82rem",
      paddingTop: 11,
      paddingBottom: 11,
    },
  },

  // ── Stats row ────────────────────────────────────────────────────────────
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2.5),
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
  statLabel: {
    fontSize: "0.72rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    marginTop: 2,
    fontWeight: 500,
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
  },
  tableContainer: {
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
  tableCell: {
    padding: theme.spacing(1.25, 2),
    fontSize: "0.8rem",
    color: theme.palette.type === "dark" ? "#cbd5e1" : "#334155",
    borderBottom: "none",
    verticalAlign: "middle",
  },

  // ── Tag chip ─────────────────────────────────────────────────────────────
  tagChipWrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 10px 3px 8px",
    borderRadius: 20,
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#fff",
    textShadow: "0 1px 2px rgba(0,0,0,0.35)",
    boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: "rgba(255,255,255,0.6)",
    flexShrink: 0,
  },

  // ── Contacts count badge ─────────────────────────────────────────────────
  contactsBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 12,
    fontSize: "0.72rem",
    fontWeight: 600,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(99,102,241,0.15)"
        : "rgba(99,102,241,0.08)",
    color: "#6366f1",
    border: "1px solid rgba(99,102,241,0.2)",
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

  // ── Tooltip ──────────────────────────────────────────────────────────────
  tooltip: {
    backgroundColor:
      theme.palette.type === "dark" ? "#1e293b" : "#f8fafc",
    color: theme.palette.type === "dark" ? "#e2e8f0" : "#334155",
    fontSize: "0.78rem",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
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

  // ── ID cell ──────────────────────────────────────────────────────────────
  idCell: {
    fontFamily: "monospace",
    fontSize: "0.75rem",
    color: theme.palette.type === "dark" ? "#64748b" : "#94a3b8",
  },
}));

const Tags = () => {
  const classes = useStyles();
  const { user, socket } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);
  const [deletingTag, setDeletingTag] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [tags, dispatch] = useReducer(reducer, []);
  const [tagModalOpen, setTagModalOpen] = useState(false);

  useEffect(() => {
    const fetchMoreTags = async () => {
      try {
        const { data } = await api.get("/tags/", {
          params: { searchParam, pageNumber, kanban: 0 },
        });
        dispatch({ type: "LOAD_TAGS", payload: data.tags });
        setHasMore(data.hasMore);
        setLoading(false);
      } catch (err) {
        toastError(err);
      }
    };

    if (pageNumber > 0) {
      setLoading(true);
      fetchMoreTags();
    }
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const onCompanyTags = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_TAGS", payload: data.tag });
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE_TAGS", payload: +data.tagId });
      }
    };
    socket.on(`company${user.companyId}-tag`, onCompanyTags);
    return () => {
      socket.off(`company${user.companyId}-tag`, onCompanyTags);
    };
  }, [socket, user.companyId]);

  const handleOpenTagModal = () => {
    setSelectedTag(null);
    setTagModalOpen(true);
  };

  const handleCloseTagModal = () => {
    setSelectedTag(null);
    setTagModalOpen(false);
  };

  const handleSearch = (event) => {
    const newSearchParam = event.target.value.toLowerCase();
    setSearchParam(newSearchParam);
    setPageNumber(1);
    dispatch({ type: "RESET" });
  };

  const handleEditTag = (tag) => {
    setSelectedTag(tag);
    setTagModalOpen(true);
  };

  const handleDeleteTag = async (tagId) => {
    try {
      await api.delete(`/tags/${tagId}`);
      toast.success(i18n.t("tags.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingTag(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const loadMore = () => {
    setPageNumber((prevPageNumber) => prevPageNumber + 1);
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
        title={deletingTag && `${i18n.t("tags.confirmationModal.deleteTitle")}`}
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={() => handleDeleteTag(deletingTag.id)}
      >
        {i18n.t("tags.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <TagModal
        open={tagModalOpen}
        onClose={handleCloseTagModal}
        aria-labelledby="form-dialog-title"
        tagId={selectedTag && selectedTag.id}
        kanban={0}
      />

      {/* ── Search bar + action ── */}
      <div className={classes.searchBar} style={{ display: "flex", gap: 8 }}>
        <TextField
          fullWidth
          placeholder={i18n.t("contacts.searchPlaceholder")}
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
          className={classes.btnPrimary}
          variant="contained"
          color="primary"
          startIcon={<AddIcon style={{ fontSize: 16 }} />}
          onClick={handleOpenTagModal}
          style={{ whiteSpace: "nowrap", flexShrink: 0 }}
        >
          {i18n.t("tags.buttons.add")}
        </Button>
      </div>

      {/* ── Main Table ── */}
      <Paper className={classes.mainPaper} variant="outlined">
        <div className={classes.tableContainer} onScroll={handleScroll}>
          <Table size="small">
            <TableHead>
              <TableRow className={classes.tableHeaderRow}>
                <TableCell className={classes.tableHeaderCell}>
                  {i18n.t("tags.table.id")}
                </TableCell>
                <TableCell className={classes.tableHeaderCell}>
                  {i18n.t("tags.table.name")}
                </TableCell>
                <TableCell
                  className={classes.tableHeaderCell}
                  align="center"
                >
                  {i18n.t("tags.table.contacts")}
                </TableCell>
                <TableCell
                  className={classes.tableHeaderCell}
                  align="right"
                >
                  {i18n.t("tags.table.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tags.length > 0 || loading ? (
                <>
                  {tags.map((tag) => (
                    <TableRow key={tag.id} className={classes.tableRow}>
                      <TableCell className={`${classes.tableCell} ${classes.idCell}`}>
                        #{tag.id}
                      </TableCell>

                      <TableCell className={classes.tableCell}>
                        <span
                          className={classes.tagChipWrap}
                          style={{ backgroundColor: tag.color || "#94a3b8" }}
                        >
                          <span className={classes.tagDot} />
                          {tag.name}
                        </span>
                      </TableCell>

                      <TableCell className={classes.tableCell} align="center">
                        <span className={classes.contactsBadge}>
                          <PeopleIcon style={{ fontSize: 11 }} />
                          {tag?.contacts?.length || 0}
                        </span>
                      </TableCell>

                      <TableCell className={classes.tableCell} align="right">
                        <div className={classes.actionsCell}>
                          <Tooltip
                            title="Editar tag"
                            arrow
                            classes={{ tooltip: classes.tooltip }}
                          >
                            <IconButton
                              className={classes.actionIconBtn}
                              size="small"
                              onClick={() => handleEditTag(tag)}
                            >
                              <EditIcon style={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>

                          <Tooltip
                            title="Excluir tag"
                            arrow
                            classes={{ tooltip: classes.tooltip }}
                          >
                            <IconButton
                              className={`${classes.actionIconBtn} ${classes.actionIconBtnDanger}`}
                              size="small"
                              onClick={() => {
                                setConfirmModalOpen(true);
                                setDeletingTag(tag);
                              }}
                            >
                              <DeleteOutlineIcon style={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {loading && (
                    <TableRowSkeleton key="skeleton" columns={4} />
                  )}
                </>
              ) : (
                <TableRow>
                  <TableCell colSpan={4} style={{ border: "none", padding: 0 }}>
                    <div className={classes.emptyState}>
                      <div className={classes.emptyIcon}>
                        <LocalOfferIcon style={{ fontSize: 28 }} />
                      </div>
                      <Typography className={classes.emptyTitle}>
                        Nenhuma tag encontrada
                      </Typography>
                      <Typography className={classes.emptySubtitle}>
                        Crie sua primeira tag clicando em "Nova Tag" para
                        organizar seus contatos e atendimentos.
                      </Typography>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Paper>
    </div>
  );
};

export default Tags;
