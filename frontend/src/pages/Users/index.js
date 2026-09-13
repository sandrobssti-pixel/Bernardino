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
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import CircularProgress from "@material-ui/core/CircularProgress";
import Tooltip from "@material-ui/core/Tooltip";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import AddIcon from "@material-ui/icons/Add";
import { Avatar, Grid } from "@material-ui/core";

import MainHeader from "../../components/MainHeader";
import whatsappIcon from "../../assets/nopicture.png";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import UserModal from "../../components/UserModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import UserStatusIcon from "../../components/UserModal/statusIcon";
import { getBackendUrl } from "../../config";
import { AuthContext } from "../../context/Auth/AuthContext";
import ForbiddenPage from "../../components/ForbiddenPage";

const backendUrl = getBackendUrl();

const reducer = (state, action) => {
  if (action.type === "LOAD_USERS") {
    const users = action.payload;
    const newUsers = [];

    users.forEach((user) => {
      const userIndex = state.findIndex((u) => u.id === user.id);
      if (userIndex !== -1) {
        state[userIndex] = user;
      } else {
        newUsers.push(user);
      }
    });

    return [...state, ...newUsers];
  }

  if (action.type === "UPDATE_USERS") {
    const user = action.payload;
    const userIndex = state.findIndex((u) => u.id === user.id);

    if (userIndex !== -1) {
      state[userIndex] = user;
      return [...state];
    }
    return [user, ...state];
  }

  if (action.type === "DELETE_USER") {
    const userId = action.payload;

    const userIndex = state.findIndex((u) => u.id === userId);
    if (userIndex !== -1) {
      state.splice(userIndex, 1);
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
  tableCellMono: {
    fontFamily: "monospace",
    fontSize: "0.76rem",
    letterSpacing: "0.02em",
  },
  userAvatar: {
    width: 32,
    height: 32,
    fontSize: "0.8rem",
  },
  avatarDiv: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing(3),
    gap: theme.spacing(1.5),
  },
  loadingText: {
    fontSize: "0.8rem",
    color: theme.palette.text.secondary,
  },
}));

const Users = () => {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [users, dispatch] = useReducer(reducer, []);
  const { user: loggedInUser, socket } = useContext(AuthContext);
  const { profileImage } = loggedInUser;

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const fetchUsers = async () => {
      try {
        const { data } = await api.get("/users/", {
          params: { searchParam, pageNumber },
        });
        dispatch({ type: "LOAD_USERS", payload: data.users });
        setHasMore(data.hasMore);
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    };
    fetchUsers();
  }, [searchParam, pageNumber]);

  useEffect(() => {
    if (loggedInUser) {
      const companyId = loggedInUser.companyId;
      const onCompanyUser = (data) => {
        if (data.action === "update" || data.action === "create") {
          dispatch({ type: "UPDATE_USERS", payload: data.user });
        }
        if (data.action === "delete") {
          dispatch({ type: "DELETE_USER", payload: +data.userId });
        }
      };
      socket.on(`company-${companyId}-user`, onCompanyUser);
      return () => {
        socket.off(`company-${companyId}-user`, onCompanyUser);
      };
    }
  }, [socket, loggedInUser]);

  const handleOpenUserModal = () => {
    setSelectedUser(null);
    setUserModalOpen(true);
  };

  const handleCloseUserModal = () => {
    setSelectedUser(null);
    setUserModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setUserModalOpen(true);
  };

  const isProtectedSuperAdmin = (user) => {
    if (!user) return false;
    return Boolean(user.super) || Number(user.id) === 1;
  };

  const handleRequestDeleteUser = (user) => {
    if (isProtectedSuperAdmin(user)) return;
    setConfirmModalOpen(true);
    setDeletingUser(user);
  };

  const handleDeleteUser = async (userId) => {
    const targetUser = users.find((u) => Number(u.id) === Number(userId));
    if (isProtectedSuperAdmin(targetUser)) {
      toast.error(i18n.t("backendErrors.ERR_NO_PERMISSION"));
      setDeletingUser(null);
      setConfirmModalOpen(false);
      return;
    }

    try {
      await api.delete(`/users/${userId}`);
      toast.success(i18n.t("users.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingUser(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const loadMore = () => {
    setLoadingMore(true);
    setPageNumber((prevPage) => prevPage + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  const renderProfileImage = (user) => {
    const src =
      user.id === loggedInUser.id
        ? profileImage
          ? `${backendUrl}/public/avatar/${profileImage}`
          : whatsappIcon
        : user.profileImage
          ? `${backendUrl}/public/avatar/${user.profileImage}`
          : whatsappIcon;

    return <Avatar src={src} alt={user.name} className={classes.userAvatar} />;
  };

  return (
    <div className={classes.pageRoot}>
      <ConfirmationModal
        title={
          deletingUser &&
          `${i18n.t("users.confirmationModal.deleteTitle")} ${deletingUser.name}?`
        }
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={() => handleDeleteUser(deletingUser.id)}
      >
        {i18n.t("users.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <UserModal
        open={userModalOpen}
        onClose={handleCloseUserModal}
        aria-labelledby="form-dialog-title"
        userId={selectedUser && selectedUser.id}
        key={i18n.language}
      />

      {loggedInUser.profile === "user" ? (
        <ForbiddenPage />
      ) : (
        <>
          <MainHeader>
            <Grid container style={{ width: "100%" }}>
              <Grid item xs={12}>
                <Paper elevation={0} className={classes.controlsPaper}>
                  <Grid container spacing={1} alignItems="center">
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
                        onClick={handleOpenUserModal}
                        className={classes.actionButton}
                        startIcon={<AddIcon style={{ fontSize: 16 }} />}
                      >
                        {i18n.t("users.buttons.add")}
                      </Button>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          </MainHeader>

          <Paper className={classes.mainPaper} variant="outlined" onScroll={handleScroll}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell className={classes.tableHeaderCell} align="center">
                    {i18n.t("users.table.ID")}
                  </TableCell>
                  <TableCell className={classes.tableHeaderCell} align="center">
                    {i18n.t("users.table.status")}
                  </TableCell>
                  <TableCell className={classes.tableHeaderCell} align="center">
                    Avatar
                  </TableCell>
                  <TableCell className={classes.tableHeaderCell}>
                    {i18n.t("users.table.name")}
                  </TableCell>
                  <TableCell className={classes.tableHeaderCell}>
                    {i18n.t("users.table.email")}
                  </TableCell>
                  <TableCell className={classes.tableHeaderCell} align="center">
                    {i18n.t("users.table.profile")}
                  </TableCell>
                  <TableCell className={classes.tableHeaderCell} align="center">
                    {i18n.t("users.table.startWork")}
                  </TableCell>
                  <TableCell className={classes.tableHeaderCell} align="center">
                    {i18n.t("users.table.endWork")}
                  </TableCell>
                  <TableCell className={classes.tableHeaderCell} align="right">
                    {i18n.t("users.table.actions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <>
                  {users.map((user) => (
                    <TableRow key={user.id} className={classes.tableRow}>
                      <TableCell className={`${classes.tableCell} ${classes.tableCellMono}`} align="center">
                        {user.id}
                      </TableCell>
                      <TableCell className={classes.tableCell} align="center">
                        <UserStatusIcon user={user} />
                      </TableCell>
                      <TableCell className={classes.tableCell} align="center">
                        <div className={classes.avatarDiv}>
                          {renderProfileImage(user)}
                        </div>
                      </TableCell>
                      <TableCell className={`${classes.tableCell} ${classes.tableCellName}`}>
                        {user.name}
                      </TableCell>
                      <TableCell className={`${classes.tableCell} ${classes.tableCellMono}`}>
                        {user.email}
                      </TableCell>
                      <TableCell className={classes.tableCell} align="center">
                        {user.super ? "Master" : user.profile}
                      </TableCell>
                      <TableCell className={classes.tableCell} align="center">
                        {user.startWork}
                      </TableCell>
                      <TableCell className={classes.tableCell} align="center">
                        {user.endWork}
                      </TableCell>
                      <TableCell className={classes.tableCell} align="right">
                        <div className={classes.actionsCell}>
                          <Tooltip title="Editar Usuário" arrow>
                            <IconButton
                              size="small"
                              className={classes.actionIconBtn}
                              onClick={() => handleEditUser(user)}
                            >
                              <EditIcon style={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>

                          {!isProtectedSuperAdmin(user) && (
                            <Tooltip title="Excluir Usuário" arrow>
                              <IconButton
                                size="small"
                                className={`${classes.actionIconBtn} ${classes.actionIconBtnDanger}`}
                                onClick={() => handleRequestDeleteUser(user)}
                              >
                                <DeleteOutlineIcon style={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {loadingMore && (
                    <TableRow>
                      <TableCell colSpan={9} align="center" style={{ borderBottom: "none" }}>
                        <CircularProgress size={24} />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              </TableBody>
            </Table>
            {loading && !loadingMore && (
              <div className={classes.loadingContainer}>
                <CircularProgress size={24} />
                <span className={classes.loadingText}>{i18n.t("loading")}</span>
              </div>
            )}
          </Paper>
        </>
      )}
    </div>
  );
};

export default Users;
