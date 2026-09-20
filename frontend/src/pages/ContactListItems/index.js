import React, {
  useState,
  useEffect,
  useReducer,
  useContext,
  useRef,
} from "react";

import { toast } from "react-toastify";
import { useParams, useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  InputAdornment,
  LinearProgress,
  Typography,
  IconButton,
  Tooltip,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@material-ui/core";

import SearchIcon from "@material-ui/icons/Search";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import BlockIcon from "@material-ui/icons/Block";
import AddIcon from "@material-ui/icons/Add";
import PublishIcon from "@material-ui/icons/Publish";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import PeopleOutlineIcon from "@material-ui/icons/PeopleOutline";
import VisibilityIcon from "@material-ui/icons/Visibility";

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ContactListItemModal from "../../components/ContactListItemModal";
import ConfirmationModal from "../../components/ConfirmationModal";

import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import useContactLists from "../../hooks/useContactLists";

import planilhaExemplo from "../../assets/planilha.xlsx";
import ForbiddenPage from "../../components/ForbiddenPage";

const reducer = (state, action) => {
  if (action.type === "LOAD_CONTACTS") {
    const contacts = action.payload;
    const newContacts = [];

    contacts.forEach((contact) => {
      const contactIndex = state.findIndex((c) => c.id === contact.id);
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
    const contactIndex = state.findIndex((c) => c.id === contact.id);

    if (contactIndex !== -1) {
      state[contactIndex] = contact;
      return [...state];
    } else {
      return [contact, ...state];
    }
  }

  if (action.type === "DELETE_CONTACT") {
    const contactId = action.payload;
    const contactIndex = state.findIndex((c) => c.id === contactId);
    if (contactIndex !== -1) {
      state.splice(contactIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
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

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: theme.spacing(2.5),
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

  // ── Search field ─────────────────────────────────────────────────────────
  searchField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      fontSize: "0.8rem",
      height: 32,
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.04)"
          : "rgba(15,23,42,0.02)",
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: theme.palette.divider,
    },
    "& .MuiOutlinedInput-input": {
      padding: theme.spacing(0.5, 1),
    },
    "& .MuiInputAdornment-root svg": {
      fontSize: 16,
      color: theme.palette.type === "dark" ? "#64748b" : "#94a3b8",
    },
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
    whiteSpace: "nowrap",
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
    whiteSpace: "nowrap",
    boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
    "&:hover": {
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    },
  },

  // ── Import progress card ─────────────────────────────────────────────────
  importCard: {
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(2, 2.5),
    marginBottom: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
  },
  importCardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  importTitle: {
    fontWeight: 600,
    fontSize: "0.85rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
  },
  importPercent: {
    fontSize: "0.72rem",
    fontWeight: 600,
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
  },
  importProgressBar: {
    height: 6,
    borderRadius: 999,
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(255,255,255,0.08)" : "#e2e8f0",
  },
  importMeta: {
    display: "flex",
    gap: theme.spacing(2),
  },
  importMetaItem: {
    fontSize: "0.72rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
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
    overflowY: "auto",
    ...theme.scrollbarStyles,
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
  tableCellMono: {
    fontFamily: "monospace",
    fontSize: "0.78rem",
    letterSpacing: "0.02em",
  },

  // ── Contact name cell ────────────────────────────────────────────────────
  contactName: {
    fontWeight: 600,
    fontSize: "0.82rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
  },

  // ── WhatsApp validity badge ──────────────────────────────────────────────
  validBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: "0.7rem",
    fontWeight: 600,
    whiteSpace: "nowrap",
    backgroundColor: "rgba(34,197,94,0.10)",
    color: "#16a34a",
    border: "1px solid rgba(34,197,94,0.25)",
  },
  invalidBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: "0.7rem",
    fontWeight: 600,
    whiteSpace: "nowrap",
    backgroundColor: "rgba(148,163,184,0.10)",
    color: "#64748b",
    border: "1px solid rgba(148,163,184,0.25)",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    flexShrink: 0,
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

const ContactListItems = () => {
  const classes = useStyles();

  const { user, socket } = useContext(AuthContext);

  const { contactListId } = useParams();
  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [contacts, dispatch] = useReducer(reducer, []);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [contactListItemModalOpen, setContactListItemModalOpen] = useState(false);
  const [deletingContact, setDeletingContact] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detailsContact, setDetailsContact] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [contactList, setContactList] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [importProgress, setImportProgress] = useState({
    visible: false,
    total: 0,
    processed: 0,
    percent: 0,
    imported: 0,
    duplicates: 0,
    invalid: 0,
  });
  const fileUploadRef = useRef(null);
  const importHideTimerRef = useRef(null);

  const { findById: findContactList } = useContactLists();

  useEffect(() => {
    findContactList(contactListId).then((data) => {
      setContactList(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactListId]);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get(`contact-list-items`, {
            params: { searchParam, pageNumber, contactListId },
          });
          dispatch({ type: "LOAD_CONTACTS", payload: data.contacts });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber, contactListId, refreshKey]);

  useEffect(() => {
    const companyId = user.companyId;

    const onCompanyContactLists = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_CONTACTS", payload: data.record });
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE_CONTACT", payload: +data.id });
      }
      if (data.action === "reload") {
        dispatch({ type: "LOAD_CONTACTS", payload: data.records });
      }
    };

    const genericChannel = `company-${companyId}-ContactListItem`;
    const byListChannel = `company-${companyId}-ContactListItem-${contactListId}`;

    socket.on(genericChannel, onCompanyContactLists);
    socket.on(byListChannel, onCompanyContactLists);

    return () => {
      socket.off(genericChannel, onCompanyContactLists);
      socket.off(byListChannel, onCompanyContactLists);
    };
  }, [contactListId, socket, user.companyId]);

  useEffect(() => {
    const companyId = user.companyId;
    const progressChannel = `company-${companyId}-ContactListImport-${contactListId}`;

    const onImportProgress = (data) => {
      if (!data) return;

      if (data.status === "done") {
        setImportProgress((prev) => ({ ...prev, visible: true, percent: 100 }));
        if (importHideTimerRef.current) clearTimeout(importHideTimerRef.current);
        importHideTimerRef.current = setTimeout(() => {
          setImportProgress((prev) => ({ ...prev, visible: false }));
        }, 1500);
        return;
      }

      setImportProgress({
        visible: true,
        total: Number(data.total || 0),
        processed: Number(data.processed || 0),
        percent: Number(data.percent || 0),
        imported: Number(data.imported || 0),
        duplicates: Number(data.duplicates || 0),
        invalid: Number(data.invalid || 0),
      });
    };

    socket.on(progressChannel, onImportProgress);
    return () => {
      socket.off(progressChannel, onImportProgress);
      if (importHideTimerRef.current) clearTimeout(importHideTimerRef.current);
    };
  }, [contactListId, socket, user.companyId]);

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleOpenContactListItemModal = () => {
    setSelectedContactId(null);
    setContactListItemModalOpen(true);
  };

  const handleCloseContactListItemModal = () => {
    setSelectedContactId(null);
    setContactListItemModalOpen(false);
  };

  const hadleEditContact = (contactId) => {
    setSelectedContactId(contactId);
    setContactListItemModalOpen(true);
  };

  const handleDeleteContact = async (contactId) => {
    try {
      await api.delete(`/contact-list-items/${contactId}`);
      toast.success(i18n.t("contacts.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingContact(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const handleImportContacts = async () => {
    try {
      setImportProgress({
        visible: true,
        total: 0,
        processed: 0,
        percent: 0,
        imported: 0,
        duplicates: 0,
        invalid: 0,
      });

      const formData = new FormData();
      formData.append("file", fileUploadRef.current.files[0]);
      const { data } = await api.request({
        url: `contact-lists/${contactListId}/upload`,
        method: "POST",
        data: formData,
      });

      if (Array.isArray(data) && data.length > 0) {
        dispatch({ type: "LOAD_CONTACTS", payload: data });
      }

      dispatch({ type: "RESET" });
      setPageNumber(1);
      setSearchParam("");
      setRefreshKey((prevState) => prevState + 1);

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { data: refreshedData } = await api.get("contact-list-items", {
          params: { searchParam: "", pageNumber: 1, contactListId },
        });

        dispatch({ type: "RESET" });
        dispatch({ type: "LOAD_CONTACTS", payload: refreshedData.contacts });
        setHasMore(refreshedData.hasMore);

        if (refreshedData.contacts?.length > 0 || attempt === 2) break;
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    } catch (err) {
      toastError(err);
    }
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

  const goToContactLists = () => {
    history.push("/contact-lists");
  };

  if (user.profile === "user") {
    return <ForbiddenPage />;
  }

  return (
    <div className={classes.pageRoot}>
      {/* Modals */}
      <ContactListItemModal
        open={contactListItemModalOpen}
        onClose={handleCloseContactListItemModal}
        aria-labelledby="form-dialog-title"
        contactId={selectedContactId}
      />
      <ConfirmationModal
        title={
          deletingContact
            ? `${i18n.t("contactListItems.confirmationModal.deleteTitle")} ${deletingContact.name}?`
            : `${i18n.t("contactListItems.confirmationModal.importTitlte")}`
        }
        open={confirmOpen}
        onClose={setConfirmOpen}
        onConfirm={() =>
          deletingContact
            ? handleDeleteContact(deletingContact.id)
            : handleImportContacts()
        }
      >
        {deletingContact ? (
          `${i18n.t("contactListItems.confirmationModal.deleteMessage")}`
        ) : (
          <>
            {i18n.t("contactListItems.confirmationModal.importMessage")}
            <a href={planilhaExemplo} download="planilha.xlsx">
              Clique aqui para baixar planilha exemplo.
            </a>
          </>
        )}
      </ConfirmationModal>

      <Dialog open={!!detailsContact} onClose={() => setDetailsContact(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Dados da planilha — {detailsContact?.name}</DialogTitle>
        <DialogContent dividers>
          {detailsContact?.extraData &&
            Object.entries(detailsContact.extraData).map(([key, value]) => (
              <Box key={key} display="flex" justifyContent="space-between" py={0.5}>
                <Typography variant="body2" color="textSecondary">{key}</Typography>
                <Typography variant="body2">{String(value ?? "")}</Typography>
              </Box>
            ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsContact(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      {/* Hidden file input */}
      <input
        style={{ display: "none" }}
        id="upload"
        name="file"
        type="file"
        accept=".xls,.xlsx"
        onChange={() => setConfirmOpen(true)}
        ref={fileUploadRef}
      />

      {/* ── Page Header ── */}
      <div className={classes.header}>
        <div className={classes.headerLeft}>
          <Typography className={classes.headerTitle}>
            {contactList.name || i18n.t("contactListItems.title")}
          </Typography>
          <Typography className={classes.headerSubtitle}>
            Gerencie os contatos desta lista de campanha
          </Typography>
        </div>
        <div className={classes.headerActions}>
          <TextField
            className={classes.searchField}
            placeholder={i18n.t("contactListItems.searchPlaceholder")}
            type="search"
            variant="outlined"
            size="small"
            value={searchParam}
            onChange={handleSearch}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button
            className={classes.btnGhost}
            size="small"
            startIcon={<ArrowBackIcon style={{ fontSize: 15 }} />}
            onClick={goToContactLists}
          >
            {i18n.t("contactListItems.buttons.lists")}
          </Button>
          <Button
            className={classes.btnGhost}
            size="small"
            startIcon={<PublishIcon style={{ fontSize: 15 }} />}
            onClick={() => {
              fileUploadRef.current.value = null;
              fileUploadRef.current.click();
            }}
          >
            {i18n.t("contactListItems.buttons.import")}
          </Button>
          <Button
            className={classes.btnPrimary}
            size="small"
            variant="contained"
            color="primary"
            startIcon={<AddIcon style={{ fontSize: 16 }} />}
            onClick={handleOpenContactListItemModal}
          >
            {i18n.t("contactListItems.buttons.add")}
          </Button>
        </div>
      </div>

      {/* ── Import progress ── */}
      {importProgress.visible && (
        <div className={classes.importCard}>
          <div className={classes.importCardHeader}>
            <Typography className={classes.importTitle}>
              Importando contatos
            </Typography>
            <Typography className={classes.importPercent}>
              {importProgress.processed} / {importProgress.total || 0} — {importProgress.percent}%
            </Typography>
          </div>
          <LinearProgress
            variant="determinate"
            className={classes.importProgressBar}
            value={Math.max(0, Math.min(100, importProgress.percent))}
          />
          <div className={classes.importMeta}>
            <Typography className={classes.importMetaItem}>
              Importados: <strong>{importProgress.imported}</strong>
            </Typography>
            <Typography className={classes.importMetaItem}>
              Duplicados: <strong>{importProgress.duplicates}</strong>
            </Typography>
            <Typography className={classes.importMetaItem}>
              Inválidos: <strong>{importProgress.invalid}</strong>
            </Typography>
          </div>
        </div>
      )}

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
                <TableCell className={classes.tableHeaderCell} align="center" style={{ width: 60 }}>
                  Status
                </TableCell>
                <TableCell className={classes.tableHeaderCell}>
                  {i18n.t("contactListItems.table.name")}
                </TableCell>
                <TableCell className={classes.tableHeaderCell} align="center">
                  {i18n.t("contactListItems.table.number")}
                </TableCell>
                <TableCell className={classes.tableHeaderCell} align="center">
                  {i18n.t("contactListItems.table.email")}
                </TableCell>
                <TableCell className={classes.tableHeaderCell} align="right">
                  {i18n.t("contactListItems.table.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id} className={classes.tableRow}>
                  <TableCell className={classes.tableCell} align="center">
                    {contact.isWhatsappValid ? (
                      <span className={classes.validBadge}>
                        <span className={classes.statusDot} style={{ backgroundColor: "#22c55e" }} />
                        Válido
                      </span>
                    ) : (
                      <span className={classes.invalidBadge}>
                        <span className={classes.statusDot} style={{ backgroundColor: "#94a3b8" }} />
                        Inválido
                      </span>
                    )}
                  </TableCell>
                  <TableCell className={classes.tableCell}>
                    <span className={classes.contactName}>{contact.name}</span>
                  </TableCell>
                  <TableCell className={`${classes.tableCell} ${classes.tableCellMono}`} align="center">
                    {contact.number}
                  </TableCell>
                  <TableCell className={classes.tableCell} align="center">
                    {contact.email}
                  </TableCell>
                  <TableCell className={classes.tableCell} align="right">
                    <div className={classes.actionsCell}>
                      {contact.extraData && Object.keys(contact.extraData).length > 0 && (
                        <Tooltip
                          title="Ver dados da planilha (CPF, vigência, status, etc.)"
                          arrow
                          classes={{ tooltip: classes.tooltip }}
                        >
                          <IconButton
                            className={classes.actionIconBtn}
                            size="small"
                            onClick={() => setDetailsContact(contact)}
                          >
                            <VisibilityIcon style={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip
                        title="Editar contato"
                        arrow
                        classes={{ tooltip: classes.tooltip }}
                      >
                        <IconButton
                          className={classes.actionIconBtn}
                          size="small"
                          onClick={() => hadleEditContact(contact.id)}
                        >
                          <EditIcon style={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                      <Can
                        role={user.profile}
                        perform="contacts-page:deleteContact"
                        yes={() => (
                          <Tooltip
                            title="Excluir contato"
                            arrow
                            classes={{ tooltip: classes.tooltip }}
                          >
                            <IconButton
                              className={`${classes.actionIconBtn} ${classes.actionIconBtnDanger}`}
                              size="small"
                              onClick={() => {
                                setConfirmOpen(true);
                                setDeletingContact(contact);
                              }}
                            >
                              <DeleteOutlineIcon style={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {loading && <TableRowSkeleton columns={5} />}
              {!loading && contacts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} style={{ border: "none", padding: 0 }}>
                    <div className={classes.emptyState}>
                      <div className={classes.emptyIcon}>
                        <PeopleOutlineIcon style={{ fontSize: 28 }} />
                      </div>
                      <Typography className={classes.emptyTitle}>
                        Nenhum contato encontrado
                      </Typography>
                      <Typography className={classes.emptySubtitle}>
                        {searchParam
                          ? "Nenhum resultado para a busca. Tente outro nome ou número."
                          : "Adicione contatos manualmente ou importe uma planilha .xlsx."}
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

export default ContactListItems;