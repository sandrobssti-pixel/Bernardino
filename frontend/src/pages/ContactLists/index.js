import React, { useState, useEffect, useReducer, useContext, useMemo } from "react";
import { toast } from "react-toastify";

import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Tooltip from "@material-ui/core/Tooltip";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import PeopleIcon from "@material-ui/icons/People";
import DownloadIcon from "@material-ui/icons/GetApp";
import AddIcon from "@material-ui/icons/Add";
import PlaylistAddCheckIcon from "@material-ui/icons/PlaylistAddCheck";
import PublishIcon from "@material-ui/icons/Publish";
import ArrowDropDownIcon from "@material-ui/icons/ArrowDropDown";
import GroupIcon from "@material-ui/icons/Group";
import PersonAddIcon from "@material-ui/icons/PersonAdd";
import NoteAddIcon from "@material-ui/icons/NoteAdd";

import MainHeader from "../../components/MainHeader";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ContactListDialog from "../../components/ContactListDialog";
import ConfirmationModal from "../../components/ConfirmationModal";
import ImportSystemContactsModal from "../../components/ImportSystemContactsModal";
import ImportFileContactsModal from "../../components/ImportFileContactsModal";
import ImportGroupContactsModal from "../../components/ImportGroupContactsModal";
import AddSingleContactListModal from "../../components/AddSingleContactListModal";
import toastError from "../../errors/toastError";
import { Grid, Menu, MenuItem, ListItemIcon, ListItemText } from "@material-ui/core";

import planilhaExemplo from "../../assets/planilha.xlsx";
import { AuthContext } from "../../context/Auth/AuthContext";

const reducer = (state, action) => {
  if (action.type === "LOAD_CONTACTLISTS") {
    const contactLists = action.payload;
    const newContactLists = [];

    contactLists.forEach((contactList) => {
      const contactListIndex = state.findIndex((u) => u.id === contactList.id);
      if (contactListIndex !== -1) {
        state[contactListIndex] = contactList;
      } else {
        newContactLists.push(contactList);
      }
    });

    return [...state, ...newContactLists];
  }

  if (action.type === "UPDATE_CONTACTLIST") {
    const contactList = action.payload;
    const contactListIndex = state.findIndex((u) => u.id === contactList.id);

    if (contactListIndex !== -1) {
      state[contactListIndex] = contactList;
      return [...state];
    } else {
      return [contactList, ...state];
    }
  }

  if (action.type === "DELETE_CONTACTLIST") {
    const contactListId = action.payload;

    const contactListIndex = state.findIndex((u) => u.id === contactListId);
    if (contactListIndex !== -1) {
      state.splice(contactListIndex, 1);
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
  controlsPaper: {
    marginBottom: theme.spacing(2),
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1.25, 1.5),
    backgroundColor: theme.palette.background.paper,
    boxShadow:
      theme.palette.type === "dark"
        ? "0 1px 3px rgba(0,0,0,0.3)"
        : "0 1px 3px rgba(15,23,42,0.06)",
  },
  searchField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      backgroundColor: theme.palette.background.default,
    },
    "& .MuiInputBase-input": {
      fontSize: "0.8rem",
      paddingTop: 9,
      paddingBottom: 9,
    },
  },
  actionButton: {
    borderRadius: 8,
    fontWeight: 600,
    fontSize: "0.78rem",
    padding: theme.spacing(0.7, 1.5),
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
    "&:hover": {
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    },
  },
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
  tableHeaderCell: {
    fontWeight: 600,
    fontSize: "0.72rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    padding: theme.spacing(1.25, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(15,23,42,0.025)",
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
  tableCellName: {
    fontWeight: 600,
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
  },
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
}));

const ContactLists = () => {
  const classes = useStyles();
  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedContactList, setSelectedContactList] = useState(null);
  const [deletingContactList, setDeletingContactList] = useState(null);
  const [contactListModalOpen, setContactListModalOpen] = useState(false);
  const [importSystemModalOpen, setImportSystemModalOpen] = useState(false);
  const [importTargetContactList, setImportTargetContactList] = useState(null);
  const [importFileModalOpen, setImportFileModalOpen] = useState(false);
  const [importFileTargetContactList, setImportFileTargetContactList] = useState(null);
  const [addMenuAnchorEl, setAddMenuAnchorEl] = useState(null);
  const [contactListModalPendingAction, setContactListModalPendingAction] = useState(null);
  const [importGroupModalOpen, setImportGroupModalOpen] = useState(false);
  const [addSingleContactModalOpen, setAddSingleContactModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [contactLists, dispatch] = useReducer(reducer, []);
  const { user, socket } = useContext(AuthContext);

  const sortedContactLists = useMemo(() => {
    return [...contactLists].sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || ""), "pt-BR", {
        sensitivity: "base",
      })
    );
  }, [contactLists]);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContactLists = async () => {
        try {
          const { data } = await api.get("/contact-lists/", {
            params: { searchParam, pageNumber },
          });
          dispatch({ type: "LOAD_CONTACTLISTS", payload: data.records });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchContactLists();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const companyId = user.companyId;

    const onContactListEvent = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_CONTACTLIST", payload: data.record });
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE_CONTACTLIST", payload: +data.id });
      }
    };

    socket.on(`company-${companyId}-ContactList`, onContactListEvent);

    return () => {
      socket.off(`company-${companyId}-ContactList`, onContactListEvent);
    };
  }, [socket, user.companyId]);

  const handleOpenContactListModal = () => {
    setSelectedContactList(null);
    setContactListModalOpen(true);
  };

  const handleCloseContactListModal = () => {
    setSelectedContactList(null);
    setContactListModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditContactList = (contactList) => {
    setSelectedContactList(contactList);
    setContactListModalOpen(true);
  };

  const handleDeleteContactList = async (contactListId) => {
    try {
      await api.delete(`/contact-lists/${contactListId}`);
      toast.success(i18n.t("contactLists.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingContactList(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const handleOpenImportSystemModal = (contactList) => {
    setImportTargetContactList(contactList);
    setImportSystemModalOpen(true);
  };

  const handleCloseImportSystemModal = () => {
    setImportSystemModalOpen(false);
    setImportTargetContactList(null);
  };

  const handleOpenImportFileModal = (contactList) => {
    setImportFileTargetContactList(contactList);
    setImportFileModalOpen(true);
  };

  const handleCloseImportFileModal = () => {
    setImportFileModalOpen(false);
    setImportFileTargetContactList(null);
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

  const goToContacts = (id) => {
    history.push(`/contact-lists/${id}/contacts`);
  };

  // Menu de "Adicionar nova lista" — reúne, num só lugar, todos os jeitos
  // de criar uma lista (manual, por arquivo, por grupo, avulsa). É o único
  // ponto de entrada pra criar listas; a campanha só escolhe entre listas
  // já prontas (ver docs/MANUAL_TECNICO.md).
  const handleOpenAddMenu = (event) => setAddMenuAnchorEl(event.currentTarget);
  const handleCloseAddMenu = () => setAddMenuAnchorEl(null);

  const handlePickEmptyList = () => {
    handleCloseAddMenu();
    setContactListModalPendingAction(null);
    handleOpenContactListModal();
  };

  const handlePickImportFile = () => {
    handleCloseAddMenu();
    setContactListModalPendingAction("import-file");
    handleOpenContactListModal();
  };

  const handlePickImportGroups = () => {
    handleCloseAddMenu();
    setImportGroupModalOpen(true);
  };

  const handlePickAddSingleContact = () => {
    handleCloseAddMenu();
    setAddSingleContactModalOpen(true);
  };

  // Callback do ContactListDialog: quando a lista acabou de nascer pelo
  // caminho "Anexar arquivo" do menu, já abre a importação em seguida, sem
  // precisar o usuário ir até a linha da tabela pra achar o botão.
  const handleContactListSaved = (savedContactList) => {
    if (contactListModalPendingAction === "import-file" && savedContactList?.id) {
      setImportFileTargetContactList(savedContactList);
      setImportFileModalOpen(true);
    }
    setContactListModalPendingAction(null);
  };

  const handleGroupsImported = (contactList) => {
    setImportGroupModalOpen(false);
    if (contactList?.id) goToContacts(contactList.id);
  };

  const handleSingleContactCreated = (contactList) => {
    setAddSingleContactModalOpen(false);
    if (contactList?.id) goToContacts(contactList.id);
  };

  return (
    <div className={classes.pageRoot}>
      <ConfirmationModal
        title={
          deletingContactList &&
          `${i18n.t("contactLists.confirmationModal.deleteTitle")} ${deletingContactList.name}?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteContactList(deletingContactList.id)}
      >
        {i18n.t("contactLists.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <ContactListDialog
        open={contactListModalOpen}
        onClose={handleCloseContactListModal}
        onSaved={handleContactListSaved}
        aria-labelledby="form-dialog-title"
        contactListId={selectedContactList && selectedContactList.id}
      />
      <ImportSystemContactsModal
        open={importSystemModalOpen}
        onClose={handleCloseImportSystemModal}
        contactList={importTargetContactList}
      />
      <ImportFileContactsModal
        open={importFileModalOpen}
        onClose={handleCloseImportFileModal}
        contactList={importFileTargetContactList}
      />
      <ImportGroupContactsModal
        open={importGroupModalOpen}
        onClose={() => setImportGroupModalOpen(false)}
        onImported={handleGroupsImported}
      />
      <AddSingleContactListModal
        open={addSingleContactModalOpen}
        onClose={() => setAddSingleContactModalOpen(false)}
        onCreated={handleSingleContactCreated}
      />

      <MainHeader>
        <Grid style={{ width: "100%" }} container>
          <Grid item xs={12}>
            <Paper elevation={0} className={classes.controlsPaper}>
              <Grid spacing={1} container alignItems="center">
                <Grid item xs={12} sm={9} md={10}>
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
                          <SearchIcon style={{ color: "gray", fontSize: 18 }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={3} md={2}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    onClick={handleOpenAddMenu}
                    className={classes.actionButton}
                    startIcon={<AddIcon style={{ fontSize: 16 }} />}
                    endIcon={<ArrowDropDownIcon />}
                  >
                    {i18n.t("contactLists.buttons.add")}
                  </Button>
                  <Menu
                    anchorEl={addMenuAnchorEl}
                    open={Boolean(addMenuAnchorEl)}
                    onClose={handleCloseAddMenu}
                  >
                    <MenuItem onClick={handlePickEmptyList}>
                      <ListItemIcon>
                        <AddIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Lista vazia"
                        secondary="Cria a lista e você adiciona os contatos manualmente"
                      />
                    </MenuItem>
                    <MenuItem onClick={handlePickImportFile}>
                      <ListItemIcon>
                        <NoteAddIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Anexar arquivo"
                        secondary="Importa uma planilha (.xlsx/.csv)"
                      />
                    </MenuItem>
                    <MenuItem onClick={handlePickImportGroups}>
                      <ListItemIcon>
                        <GroupIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Importar de grupos"
                        secondary="Participantes ou os próprios grupos como destinatário"
                      />
                    </MenuItem>
                    <MenuItem onClick={handlePickAddSingleContact}>
                      <ListItemIcon>
                        <PersonAddIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Contato avulso"
                        secondary="Um único número, pra campanha individual"
                      />
                    </MenuItem>
                  </Menu>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </MainHeader>

      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell className={classes.tableHeaderCell}>
                {i18n.t("contactLists.table.name")}
              </TableCell>
              <TableCell className={classes.tableHeaderCell} align="center">
                {i18n.t("contactLists.table.contacts")}
              </TableCell>
              <TableCell className={classes.tableHeaderCell} align="right">
                {i18n.t("contactLists.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {sortedContactLists.map((contactList) => (
                <TableRow key={contactList.id} className={classes.tableRow}>
                  <TableCell className={`${classes.tableCell} ${classes.tableCellName}`}>
                    {contactList.name}
                  </TableCell>
                  <TableCell className={classes.tableCell} align="center">
                    {contactList.contactsCount || 0}
                  </TableCell>
                  <TableCell className={classes.tableCell} align="right">
                    <div className={classes.actionsCell}>
                      <Tooltip title="Baixar Planilha Exemplo" arrow>
                        <a href={planilhaExemplo} download="planilha.xlsx">
                          <IconButton size="small" className={classes.actionIconBtn}>
                            <DownloadIcon style={{ fontSize: 15 }} />
                          </IconButton>
                        </a>
                      </Tooltip>

                      <Tooltip title="Ver Contatos" arrow>
                        <IconButton
                          size="small"
                          className={classes.actionIconBtn}
                          onClick={() => goToContacts(contactList.id)}
                        >
                          <PeopleIcon style={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title={i18n.t("contactLists.importSystem.iconTitle")} arrow>
                        <IconButton
                          size="small"
                          className={classes.actionIconBtn}
                          onClick={() => handleOpenImportSystemModal(contactList)}
                        >
                          <PlaylistAddCheckIcon style={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Importar Arquivo" arrow>
                        <IconButton
                          size="small"
                          className={classes.actionIconBtn}
                          onClick={() => handleOpenImportFileModal(contactList)}
                        >
                          <PublishIcon style={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Editar Lista" arrow>
                        <IconButton
                          size="small"
                          className={classes.actionIconBtn}
                          onClick={() => handleEditContactList(contactList)}
                        >
                          <EditIcon style={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Excluir Lista" arrow>
                        <IconButton
                          size="small"
                          className={`${classes.actionIconBtn} ${classes.actionIconBtnDanger}`}
                          onClick={() => {
                            setConfirmModalOpen(true);
                            setDeletingContactList(contactList);
                          }}
                        >
                          <DeleteOutlineIcon style={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {loading && <TableRowSkeleton columns={3} />}
            </>
          </TableBody>
        </Table>
      </Paper>
    </div>
  );
};

export default ContactLists;
