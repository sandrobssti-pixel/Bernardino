import React, {
    useState,
    useEffect,
    useReducer,
    useCallback,
    useContext,
} from "react";
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
import FolderOutlinedIcon from "@material-ui/icons/FolderOutlined";
import AttachFileIcon from "@material-ui/icons/AttachFile";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import FileModal from "../../components/FileModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
// import { SocketContext } from "../../context/Socket/SocketContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import ForbiddenPage from "../../components/ForbiddenPage";

const reducer = (state, action) => {
    if (action.type === "LOAD_FILES") {
        const files = action.payload;
        const newFiles = [];

        files.forEach((fileList) => {
            const fileListIndex = state.findIndex((s) => s.id === fileList.id);
            if (fileListIndex !== -1) {
                state[fileListIndex] = fileList;
            } else {
                newFiles.push(fileList);
            }
        });

        return [...state, ...newFiles];
    }

    if (action.type === "UPDATE_FILES") {
        const fileList = action.payload;
        const fileListIndex = state.findIndex((s) => s.id === fileList.id);

        if (fileListIndex !== -1) {
            state[fileListIndex] = fileList;
            return [...state];
        } else {
            return [fileList, ...state];
        }
    }

    if (action.type === "DELETE_FILE") {
        const fileListId = action.payload;

        const fileListIndex = state.findIndex((s) => s.id === fileListId);
        if (fileListIndex !== -1) {
            state.splice(fileListIndex, 1);
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

    // ── File list name badge ─────────────────────────────────────────────────
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

    // ── Message preview cell ──────────────────────────────────────────────────
    messageWrap: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        color: theme.palette.text.secondary,
        fontSize: "0.78rem",
        maxWidth: 360,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    messageEmpty: {
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

const FileLists = () => {
    const classes = useStyles();

    //   const socketManager = useContext(SocketContext);
    const { user, socket } = useContext(AuthContext);


    const [loading, setLoading] = useState(false);
    const [pageNumber, setPageNumber] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [selectedFileList, setSelectedFileList] = useState(null);
    const [deletingFileList, setDeletingFileList] = useState(null);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [searchParam, setSearchParam] = useState("");
    const [files, dispatch] = useReducer(reducer, []);
    const [fileListModalOpen, setFileListModalOpen] = useState(false);

    const fetchFileLists = useCallback(async () => {
        try {
            const { data } = await api.get("/files/", {
                params: { searchParam, pageNumber },
            });
            dispatch({ type: "LOAD_FILES", payload: data.files });
            setHasMore(data.hasMore);
            setLoading(false);
        } catch (err) {
            toastError(err);
        }
    }, [searchParam, pageNumber]);

    useEffect(() => {
        dispatch({ type: "RESET" });
        setPageNumber(1);
    }, [searchParam]);

    useEffect(() => {
        setLoading(true);
        const delayDebounceFn = setTimeout(() => {
            fetchFileLists();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchParam, pageNumber, fetchFileLists]);

    useEffect(() => {
        // const socket = socketManager.GetSocket(user.companyId, user.id);

        const onFileEvent = (data) => {
            if (data.action === "update" || data.action === "create") {
                dispatch({ type: "UPDATE_FILES", payload: data.files });
            }

            if (data.action === "delete") {
                dispatch({ type: "DELETE_FILE", payload: +data.fileId });
            }
        };

        socket.on(`company-${user.companyId}-file`, onFileEvent);
        return () => {
            socket.off(`company-${user.companyId}-file`, onFileEvent);
        };
    }, [socket]);

    const handleOpenFileListModal = () => {
        setSelectedFileList(null);
        setFileListModalOpen(true);
    };

    const handleCloseFileListModal = () => {
        setSelectedFileList(null);
        setFileListModalOpen(false);
    };

    const handleSearch = (event) => {
        setSearchParam(event.target.value.toLowerCase());
    };

    const handleEditFileList = (fileList) => {
        setSelectedFileList(fileList);
        setFileListModalOpen(true);
    };

    const handleDeleteFileList = async (fileListId) => {
        try {
            await api.delete(`/files/${fileListId}`);
            toast.success(i18n.t("files.toasts.deleted"));
        } catch (err) {
            toastError(err);
        }
        setDeletingFileList(null);
        setSearchParam("");
        setPageNumber(1);

        dispatch({ type: "RESET" });
        setPageNumber(1);
        await fetchFileLists();
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

    if (user.profile === "user") {
        return <ForbiddenPage />;
    }

    return (
        <div className={classes.pageRoot}>
            <ConfirmationModal
                title={deletingFileList && `${i18n.t("files.confirmationModal.deleteTitle")}`}
                open={confirmModalOpen}
                onClose={setConfirmModalOpen}
                onConfirm={() => handleDeleteFileList(deletingFileList.id)}
            >
                {i18n.t("files.confirmationModal.deleteMessage")}
            </ConfirmationModal>
            <FileModal
                open={fileListModalOpen}
                onClose={handleCloseFileListModal}
                reload={fetchFileLists}
                aria-labelledby="form-dialog-title"
                fileListId={selectedFileList && selectedFileList.id}
            />

            {/* ── Search bar + Add button ── */}
            <div className={classes.searchWrap} style={{ display: "flex", gap: 8 }}>
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
                    variant="contained"
                    color="primary"
                    className={classes.btnPrimary}
                    startIcon={<AddIcon style={{ fontSize: 16 }} />}
                    onClick={handleOpenFileListModal}
                    style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                >
                    {i18n.t("files.buttons.add")}
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
                                    {i18n.t("files.table.name")}
                                </TableCell>
                                <TableCell className={classes.tableHeaderCell}>
                                    Mensagem
                                </TableCell>
                                <TableCell className={classes.tableHeaderCell} align="right">
                                    {i18n.t("files.table.actions")}
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {files.length > 0 ? (
                                files.map((fileList) => (
                                    <TableRow key={fileList.id} className={classes.tableRow}>

                                        {/* Name */}
                                        <TableCell className={classes.tableCell}>
                                            <span className={classes.nameWrap}>
                                                <FolderOutlinedIcon style={{ fontSize: 14 }} />
                                                {fileList.name}
                                            </span>
                                        </TableCell>

                                        {/* Message */}
                                        <TableCell className={classes.tableCell}>
                                            {fileList.message ? (
                                                <span className={classes.messageWrap} title={fileList.message}>
                                                    <AttachFileIcon style={{ fontSize: 14, flexShrink: 0 }} />
                                                    {fileList.message}
                                                </span>
                                            ) : (
                                                <span className={classes.messageEmpty}>
                                                    Sem mensagem
                                                </span>
                                            )}
                                        </TableCell>

                                        {/* Actions */}
                                        <TableCell className={classes.tableCell} align="right">
                                            <div className={classes.actionsCell}>
                                                <Tooltip title="Editar lista" arrow>
                                                    <IconButton
                                                        size="small"
                                                        className={classes.actionIconBtn}
                                                        onClick={() => handleEditFileList(fileList)}
                                                    >
                                                        <EditIcon style={{ fontSize: 15 }} />
                                                    </IconButton>
                                                </Tooltip>

                                                <Tooltip title="Excluir lista" arrow>
                                                    <IconButton
                                                        size="small"
                                                        className={`${classes.actionIconBtn} ${classes.actionIconBtnDanger}`}
                                                        onClick={() => {
                                                            setConfirmModalOpen(true);
                                                            setDeletingFileList(fileList);
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
                                    <TableCell colSpan={3} style={{ border: "none", padding: 0 }}>
                                        <div className={classes.emptyState}>
                                            <div className={classes.emptyIcon}>
                                                <FolderOutlinedIcon style={{ fontSize: 28 }} />
                                            </div>
                                            <Typography className={classes.emptyTitle}>
                                                Nenhuma lista de arquivos encontrada
                                            </Typography>
                                            <Typography className={classes.emptySubtitle}>
                                                Crie sua primeira lista clicando em
                                                "Adicionar" para organizar arquivos de envio rápido.
                                            </Typography>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : null}

                            {loading && <TableRowSkeleton columns={3} />}
                        </TableBody>
                    </Table>
                </div>
            </Paper>
        </div>
    );
};

export default FileLists;
