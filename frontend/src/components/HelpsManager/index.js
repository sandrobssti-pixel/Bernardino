import React, { useState, useEffect } from "react";
import {
  makeStyles,
  Paper,
  Grid,
  TextField,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
  IconButton,
  Box,
  Typography,
  Dialog,
  DialogContent,
  Tooltip,
  InputAdornment,
  CircularProgress,
  Button,
  useTheme,
  useMediaQuery,
} from "@material-ui/core";
import { Formik, Form, Field } from "formik";
import ButtonWithSpinner from "../ButtonWithSpinner";
import ConfirmationModal from "../ConfirmationModal";

import {
  EditOutlined as EditOutlinedIcon,
  DeleteOutline as DeleteOutlineIcon,
  Add as AddIcon,
  Search as SearchIcon,
  OndemandVideo as OndemandVideoIcon,
  Cancel as CancelIcon,
  VideoLibrary as VideoLibraryIcon,
} from "@material-ui/icons";

import { toast } from "react-toastify";
import useHelps from "../../hooks/useHelps";
import { i18n } from "../../translate/i18n";

// ─── YouTube helpers ───────────────────────────────────────────────────────────

const extractYouTubeVideoId = (value = "") => {
  const input = String(value).trim();
  if (!input) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  try {
    const url = new URL(input);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.replace("/", "").trim();
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (url.pathname.startsWith("/shorts/")) {
      const id = url.pathname.split("/shorts/")[1]?.split("/")[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id || "") ? id : null;
    }
    if (url.pathname.startsWith("/embed/")) {
      const id = url.pathname.split("/embed/")[1]?.split("/")[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id || "") ? id : null;
    }
    const id = url.searchParams.get("v");
    return /^[a-zA-Z0-9_-]{11}$/.test(id || "") ? id : null;
  } catch (error) {
    return null;
  }
};

const buildYouTubeUrl = (videoId = "") => {
  if (!videoId) return "";
  return `https://www.youtube.com/watch?v=${videoId}`;
};

const getYouTubeThumbnail = (videoId = "") => {
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
};

// ─── Styles ────────────────────────────────────────────────────────────────────

const useStyles = makeStyles((theme) => ({
  root: { width: "100%" },
  mainPaper: {
    width: "100%",
    flex: 1,
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: "transparent",
    boxShadow: "none",
    padding: 0,
  },
  fullWidth: { width: "100%" },

  // ─── Toolbar ──────────────────────────────────────────────────────
  toolbar: {
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1.5, 2),
    marginBottom: theme.spacing(1.5),
    background:
      theme.palette.type === "light"
        ? "#ffffff"
        : theme.palette.background.default,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(1.5),
  },
  toolbarLeft: {
    display: "flex",
    flexDirection: "column",
  },
  toolbarTitle: {
    fontWeight: 700,
    fontSize: "0.9rem",
    color: theme.palette.text.primary,
    lineHeight: 1.3,
  },
  toolbarMeta: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    marginTop: 1,
  },
  toolbarRight: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  searchInput: {
    minWidth: 240,
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      height: 36,
      backgroundColor: theme.palette.type === "light" ? "#f8f9fc" : theme.palette.background.paper,
    },
    "& .MuiInputLabel-outlined": {
      transform: "translate(14px, 10px) scale(1)",
    },
    "& .MuiInputLabel-outlined.MuiInputLabel-shrink": {
      transform: "translate(14px, -6px) scale(0.75)",
    },
    [theme.breakpoints.down("sm")]: {
      minWidth: "100%",
    },
  },
  btnPrimary: {
    borderRadius: 8,
    height: 36,
    padding: "0 16px",
    fontSize: "0.78rem",
    fontWeight: 600,
    textTransform: "none",
    whiteSpace: "nowrap",
    boxShadow: "none",
    "&:hover": { boxShadow: "none" },
  },
  btnOutlined: {
    borderRadius: 8,
    height: 36,
    padding: "0 14px",
    fontSize: "0.78rem",
    fontWeight: 600,
    textTransform: "none",
    whiteSpace: "nowrap",
  },
  btnDanger: {
    borderRadius: 8,
    height: 36,
    padding: "0 14px",
    fontSize: "0.78rem",
    fontWeight: 600,
    textTransform: "none",
    whiteSpace: "nowrap",
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fca5a5",
    "&:hover": { backgroundColor: "#fecaca" },
    boxShadow: "none",
  },

  // ─── Table ────────────────────────────────────────────────────────
  tableContainer: {
    width: "100%",
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    overflowX: "auto",
    backgroundColor: theme.palette.background.paper,
    ...theme.scrollbarStyles,
  },
  table: {
    minWidth: 600,
    borderCollapse: "collapse",
  },
  tableHead: {
    "& .MuiTableCell-head": {
      background: theme.palette.type === "light" ? "#f4f7fb" : theme.palette.background.default,
      fontWeight: 700,
      fontSize: "0.72rem",
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: theme.palette.text.secondary,
      padding: "10px 12px",
      borderBottom: `1px solid ${theme.palette.divider}`,
      whiteSpace: "nowrap",
    },
  },
  tableBody: {
    "& .MuiTableCell-body": {
      padding: "8px 12px",
      fontSize: "0.82rem",
      color: theme.palette.text.primary,
      borderBottom: `1px solid ${theme.palette.type === "light" ? "#f0f4f8" : theme.palette.divider}`,
    },
  },
  tableRow: {
    transition: "background 0.15s ease",
    "&:hover": {
      backgroundColor: theme.palette.type === "light" ? "#f8fbff" : theme.palette.action.hover,
    },
    "&:last-child td": { borderBottom: "none" },
  },

  // ─── Thumbnail ────────────────────────────────────────────────────
  thumbnailWrap: {
    width: 80,
    height: 45,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: theme.palette.type === "light" ? "#e8eef6" : "#1a2a47",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    border: `1px solid ${theme.palette.divider}`,
  },
  thumbnailImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  thumbnailPlaceholder: {
    color: theme.palette.text.disabled,
    fontSize: 20,
  },

  // ─── Row title / meta ─────────────────────────────────────────────
  rowTitle: {
    fontWeight: 600,
    fontSize: "0.84rem",
    color: theme.palette.text.primary,
  },
  rowLink: {
    fontSize: "0.75rem",
    color: theme.palette.primary.main,
    wordBreak: "break-all",
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" },
  },
  rowCode: {
    fontFamily: "monospace",
    fontSize: "0.75rem",
    backgroundColor: theme.palette.type === "light" ? "#f1f5f9" : "#1e2d42",
    color: theme.palette.text.secondary,
    borderRadius: 4,
    padding: "1px 6px",
    border: `1px solid ${theme.palette.divider}`,
    whiteSpace: "nowrap",
  },

  // ─── Action Cell ──────────────────────────────────────────────────
  actionCell: { whiteSpace: "nowrap" },
  actionBtn: {
    padding: 5,
    borderRadius: 6,
    color: theme.palette.text.secondary,
    transition: "all 0.15s ease",
    "&:hover": {
      backgroundColor: theme.palette.type === "light" ? "#eef2ff" : theme.palette.action.hover,
      color: theme.palette.primary.main,
    },
  },
  actionBtnDanger: {
    padding: 5,
    borderRadius: 6,
    color: theme.palette.text.secondary,
    transition: "all 0.15s ease",
    "&:hover": {
      backgroundColor: "#fee2e2",
      color: "#b91c1c",
    },
  },

  // ─── Empty / Loading States ───────────────────────────────────────
  emptyState: {
    padding: theme.spacing(5, 2),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
  loadingState: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing(4),
  },

  // ─── Dialog ───────────────────────────────────────────────────────
  dialogPaper: {
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    width: "min(580px, 96vw)",
    maxWidth: "96vw",
    overflow: "hidden",
  },
  dialogHeader: {
    padding: theme.spacing(2.5, 3, 2, 3),
    background:
      theme.palette.type === "light"
        ? "#fafbff"
        : theme.palette.background.default,
    borderBottom: `1px solid ${theme.palette.divider}`,
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1.5),
  },
  dialogHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    backgroundColor: theme.palette.type === "light" ? "#eff6ff" : "#1e3a5f",
    "& svg": {
      color: theme.palette.primary.main,
      fontSize: 19,
    },
  },
  dialogHeaderText: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
  },
  dialogTitle: {
    fontWeight: 700,
    fontSize: "1rem",
    color: theme.palette.text.primary,
    lineHeight: 1.3,
  },
  dialogSubtitle: {
    fontSize: "0.78rem",
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  dialogContent: {
    padding: theme.spacing(2.5, 3),
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(2),
    },
  },
  dialogActions: {
    padding: theme.spacing(1.5, 3),
    borderTop: `1px solid ${theme.palette.divider}`,
    display: "flex",
    justifyContent: "flex-end",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    [theme.breakpoints.down("xs")]: {
      flexDirection: "column-reverse",
      "& > *": { width: "100%" },
    },
  },

  // ─── Form ─────────────────────────────────────────────────────────
  formSection: {
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(2),
    background:
      theme.palette.type === "light"
        ? "#fafbff"
        : theme.palette.background.paper,
    marginBottom: theme.spacing(1.5),
  },
  formSectionTitle: {
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1.5),
  },
  inputField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      backgroundColor: theme.palette.background.paper,
    },
  },

  // ─── Preview card ─────────────────────────────────────────────────
  previewCard: {
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
    backgroundColor: theme.palette.type === "light" ? "#f8fbff" : "#0f1d33",
    display: "flex",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    alignItems: "center",
    marginTop: theme.spacing(1.5),
  },
  previewThumb: {
    width: 120,
    height: 68,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: theme.palette.type === "light" ? "#e2e8f0" : "#1a2a47",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${theme.palette.divider}`,
    [theme.breakpoints.down("xs")]: {
      width: 80,
      height: 45,
    },
  },
  previewThumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  previewMeta: {
    flex: 1,
    minWidth: 0,
  },
  previewLabel: {
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    marginBottom: 2,
  },
  previewTitle: {
    fontSize: "0.84rem",
    fontWeight: 600,
    color: theme.palette.text.primary,
    marginBottom: 4,
  },
  previewCode: {
    fontFamily: "monospace",
    fontSize: "0.72rem",
    backgroundColor: theme.palette.type === "light" ? "#e2e8f0" : "#1e2d42",
    color: theme.palette.text.secondary,
    borderRadius: 4,
    padding: "2px 7px",
    border: `1px solid ${theme.palette.divider}`,
    display: "inline-block",
  },
}));

// ─── Form component ────────────────────────────────────────────────────────────

export function HelpManagerForm({ onSubmit, onDelete, onCancel, initialValue, loading }) {
  const classes = useStyles();

  const [record, setRecord] = useState({
    ...initialValue,
    youtubeLink: initialValue?.link || buildYouTubeUrl(initialValue?.video || ""),
  });

  useEffect(() => {
    setRecord({
      ...initialValue,
      youtubeLink: initialValue?.link || buildYouTubeUrl(initialValue?.video || ""),
    });
  }, [initialValue]);

  const previewVideoId = extractYouTubeVideoId(record.youtubeLink || "");
  const isEditing = record.id !== undefined;

  return (
    <Formik
      enableReinitialize
      className={classes.fullWidth}
      initialValues={record}
      onSubmit={(values, { resetForm }) =>
        setTimeout(() => {
          onSubmit(values);
          resetForm();
        }, 500)
      }
    >
      {({ values }) => {
        const liveVideoId = extractYouTubeVideoId(values.youtubeLink || "");
        return (
          <Form className={classes.fullWidth}>
            <Box className={classes.formSection}>
              <Typography className={classes.formSectionTitle}>
                {isEditing ? "Editar vídeo de ajuda" : "Novo vídeo de ajuda"}
              </Typography>
              <Grid spacing={2} container>
                <Grid xs={12} sm={5} item>
                  <Field
                    as={TextField}
                    label="Título"
                    name="title"
                    variant="outlined"
                    fullWidth
                    margin="dense"
                    placeholder="Ex.: Aula 01 - Configuração inicial"
                    className={classes.inputField}
                  />
                </Grid>
                <Grid xs={12} sm={7} item>
                  <Field
                    as={TextField}
                    label="Link do YouTube"
                    name="youtubeLink"
                    variant="outlined"
                    fullWidth
                    margin="dense"
                    placeholder="https://www.youtube.com/watch?v=..."
                    className={classes.inputField}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <OndemandVideoIcon style={{ fontSize: 16, opacity: 0.45 }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              </Grid>

              {liveVideoId && (
                <Box className={classes.previewCard}>
                  <Box className={classes.previewThumb}>
                    <img
                      src={getYouTubeThumbnail(liveVideoId)}
                      alt="thumbnail"
                      className={classes.previewThumbImg}
                    />
                  </Box>
                  <Box className={classes.previewMeta}>
                    <Typography className={classes.previewLabel}>Pré-visualização</Typography>
                    <Typography className={classes.previewTitle} noWrap>
                      {values.title || "Sem título"}
                    </Typography>
                    <span className={classes.previewCode}>{liveVideoId}</span>
                  </Box>
                </Box>
              )}
            </Box>

            <Box display="flex" justifyContent="flex-end" alignItems="center" style={{ gap: 8, flexWrap: "wrap" }}>
              <ButtonWithSpinner
                loading={loading}
                onClick={onCancel}
                variant="outlined"
                classes={{ root: classes.btnOutlined }}
              >
                {i18n.t("helps.settings.clear")}
              </ButtonWithSpinner>
              {isEditing && (
                <ButtonWithSpinner
                  loading={loading}
                  onClick={() => onDelete(record)}
                  classes={{ root: classes.btnDanger }}
                >
                  {i18n.t("helps.settings.delete")}
                </ButtonWithSpinner>
              )}
              <ButtonWithSpinner
                loading={loading}
                type="submit"
                variant="contained"
                color="primary"
                classes={{ root: classes.btnPrimary }}
              >
                {i18n.t("helps.settings.save")}
              </ButtonWithSpinner>
            </Box>
          </Form>
        );
      }}
    </Formik>
  );
}

// ─── Grid component ────────────────────────────────────────────────────────────

export function HelpsManagerGrid({ records, onSelect, onRequestDelete, searchTerm }) {
  const classes = useStyles();

  const filtered = records.filter((row) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (row.title || "").toLowerCase().includes(term) ||
      (row.video || "").toLowerCase().includes(term)
    );
  });

  if (filtered.length === 0) {
    return (
      <Paper className={classes.tableContainer} elevation={0}>
        <Box className={classes.emptyState}>
          <VideoLibraryIcon style={{ fontSize: 40, opacity: 0.2, marginBottom: 8 }} />
          <Typography variant="body2">
            {searchTerm ? "Nenhum resultado para a busca." : "Nenhum vídeo de ajuda cadastrado."}
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper className={classes.tableContainer} elevation={0}>
      <Table className={classes.table} size="small" aria-label="helps table">
        <TableHead className={classes.tableHead}>
          <TableRow>
            <TableCell align="center" style={{ width: 44 }}>#</TableCell>
            <TableCell align="left" style={{ width: 96 }}>Vídeo</TableCell>
            <TableCell align="left">Título</TableCell>
            <TableCell align="left">Código</TableCell>
            <TableCell align="center">Ações</TableCell>
          </TableRow>
        </TableHead>
        <TableBody className={classes.tableBody}>
          {filtered.map((row) => {
            const videoId = row.video || extractYouTubeVideoId(row.link || "");
            const thumbnailUrl = getYouTubeThumbnail(videoId);
            const youtubeUrl = row.link || buildYouTubeUrl(videoId);

            return (
              <TableRow key={row.id} className={classes.tableRow}>
                <TableCell align="center">
                  <Typography style={{ fontSize: "0.75rem", fontWeight: 700, opacity: 0.5 }}>
                    #{row.id}
                  </Typography>
                </TableCell>
                <TableCell align="left">
                  <Box className={classes.thumbnailWrap}>
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={row.title || "thumbnail"}
                        className={classes.thumbnailImg}
                      />
                    ) : (
                      <OndemandVideoIcon className={classes.thumbnailPlaceholder} />
                    )}
                  </Box>
                </TableCell>
                <TableCell align="left">
                  <Typography className={classes.rowTitle}>{row.title || "—"}</Typography>
                  {youtubeUrl && (
                    <a
                      href={youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={classes.rowLink}
                    >
                      {youtubeUrl.length > 52 ? youtubeUrl.slice(0, 52) + "…" : youtubeUrl}
                    </a>
                  )}
                </TableCell>
                <TableCell align="left">
                  {videoId ? (
                    <span className={classes.rowCode}>{videoId}</span>
                  ) : (
                    <Typography style={{ opacity: 0.4, fontSize: "0.78rem" }}>—</Typography>
                  )}
                </TableCell>
                <TableCell align="center" className={classes.actionCell}>
                  <Tooltip title="Editar" arrow>
                    <IconButton size="small" className={classes.actionBtn} onClick={() => onSelect(row)}>
                      <EditOutlinedIcon style={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Excluir" arrow>
                    <IconButton size="small" className={classes.actionBtnDanger} onClick={() => onRequestDelete(row)}>
                      <DeleteOutlineIcon style={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function HelpsManager() {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("xs"));
  const { list, save, update, remove } = useHelps();

  const EMPTY_RECORD = { title: "", description: "", video: "", link: "", youtubeLink: "" };

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [record, setRecord] = useState(EMPTY_RECORD);

  useEffect(() => {
    loadHelps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadHelps = async () => {
    setLoading(true);
    try {
      const helpList = await list();
      setRecords(helpList);
    } catch (e) {
      toast.error("Não foi possível carregar a lista de registros");
    }
    setLoading(false);
  };

  const handleSubmit = async (data) => {
    const videoId = extractYouTubeVideoId(data.youtubeLink);
    if (!videoId) {
      toast.error("Informe um link válido do YouTube.");
      return;
    }
    if (!String(data.title || "").trim()) {
      toast.error("Informe um título para o vídeo.");
      return;
    }
    const payload = {
      id: data.id,
      title: String(data.title).trim(),
      video: videoId,
      link: data.youtubeLink,
    };
    setLoading(true);
    try {
      if (payload.id !== undefined) await update(payload);
      else await save(payload);
      await loadHelps();
      handleCancel();
      toast.success("Operação realizada com sucesso!");
    } catch (e) {
      toast.error("Não foi possível realizar a operação com o link informado");
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await remove(record.id);
      await loadHelps();
      handleCancel();
      toast.success("Operação realizada com sucesso!");
    } catch (e) {
      toast.error("Não foi possível realizar a operação");
    }
    setLoading(false);
  };

  const handleCancel = () => {
    setRecord(EMPTY_RECORD);
    setModalOpen(false);
  };

  const handleSelect = (data) => {
    setRecord({
      id: data.id,
      title: data.title || "",
      description: data.description || "",
      video: data.video || "",
      link: data.link || "",
      youtubeLink: data.link || buildYouTubeUrl(data.video || ""),
    });
    setModalOpen(true);
  };

  const handleOpenCreateModal = () => {
    setRecord(EMPTY_RECORD);
    setModalOpen(true);
  };

  const handleRequestDelete = (row) => {
    setRecord({
      id: row.id,
      title: row.title || "",
      description: row.description || "",
      video: row.video || "",
      link: row.link || "",
      youtubeLink: row.link || buildYouTubeUrl(row.video || ""),
    });
    setShowConfirmDialog(true);
  };

  const visibleCount = records.filter((row) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (row.title || "").toLowerCase().includes(term) ||
      (row.video || "").toLowerCase().includes(term)
    );
  }).length;

  return (
    <Paper className={classes.mainPaper} elevation={0}>
      {/* Toolbar */}
      <Box className={classes.toolbar}>
        <Box className={classes.toolbarLeft}>
          <Typography className={classes.toolbarTitle}>Vídeos de ajuda</Typography>
          <Typography className={classes.toolbarMeta}>
            {visibleCount} de {records.length} vídeo{records.length !== 1 ? "s" : ""}
          </Typography>
        </Box>
        <Box className={classes.toolbarRight}>
          <TextField
            placeholder="Buscar por título…"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={classes.searchInput}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon style={{ fontSize: 16, opacity: 0.5 }} />
                </InputAdornment>
              ),
            }}
          />
          <Button
            onClick={handleOpenCreateModal}
            variant="contained"
            color="primary"
            classes={{ root: classes.btnPrimary }}
            startIcon={<AddIcon style={{ fontSize: 16 }} />}
          >
            Novo vídeo
          </Button>
        </Box>
      </Box>

      {/* Table */}
      {loading && records.length === 0 ? (
        <Paper className={classes.tableContainer} elevation={0}>
          <Box className={classes.loadingState}>
            <CircularProgress size={28} />
          </Box>
        </Paper>
      ) : (
        <HelpsManagerGrid
          records={records}
          onSelect={handleSelect}
          onRequestDelete={handleRequestDelete}
          searchTerm={searchTerm}
        />
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={modalOpen}
        onClose={handleCancel}
        fullWidth
        fullScreen={isMobile}
        maxWidth="sm"
        classes={{ paper: isMobile ? undefined : classes.dialogPaper }}
      >
        <Box className={classes.dialogHeader}>
          <Box className={classes.dialogHeaderIcon}>
            <OndemandVideoIcon />
          </Box>
          <Box className={classes.dialogHeaderText}>
            <Typography className={classes.dialogTitle}>
              {record.id !== undefined ? "Editar vídeo" : "Novo vídeo de ajuda"}
            </Typography>
            <Typography className={classes.dialogSubtitle}>
              Cole o link do YouTube e defina um título para o vídeo.
            </Typography>
          </Box>
          {isMobile && (
            <IconButton size="small" onClick={handleCancel} style={{ marginLeft: "auto" }}>
              <CancelIcon style={{ fontSize: 20, opacity: 0.5 }} />
            </IconButton>
          )}
        </Box>
        <DialogContent className={classes.dialogContent}>
          <HelpManagerForm
            initialValue={record}
            onDelete={() => { setModalOpen(false); setShowConfirmDialog(true); }}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
          />
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        title={record.title ? `Excluir "${record.title}"?` : "Exclusão de Registro"}
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleDelete}
      >
        Deseja realmente excluir esse vídeo de ajuda?
      </ConfirmationModal>
    </Paper>
  );
}
