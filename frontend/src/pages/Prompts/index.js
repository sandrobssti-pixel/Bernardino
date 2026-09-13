import React, { useContext, useEffect, useReducer, useState } from "react";

import {
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Tooltip,
  Tabs,
  Tab,
} from "@material-ui/core";

import { makeStyles } from "@material-ui/core/styles";

import TableRowSkeleton from "../../components/TableRowSkeleton";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import {
  DeleteOutline,
  Edit,
  Add,
  AssistantOutlined,
  StarsOutlined,
  DeviceHubOutlined,
  FlashOn,
} from "@material-ui/icons";
import PromptModal from "../../components/PromptModal";
import PromptFilesTab from "../../components/PromptModal/PromptFilesTab";
import { toast } from "react-toastify";
import ConfirmationModal from "../../components/ConfirmationModal";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePlans from "../../hooks/usePlans";
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";
import ForbiddenPage from "../../components/ForbiddenPage";
import {
  AI_PROVIDER_LABELS,
  getProviderFromModel,
  normalizeAIProvider,
} from "../../utils/aiProviders";

const PROVIDER_ICON = {
  openai: AssistantOutlined,
  gemini: StarsOutlined,
  deepseek: DeviceHubOutlined,
  groq: FlashOn,
};

const PROVIDER_COLOR = {
  openai: "#10a37f",
  gemini: "#4285f4",
  deepseek: "#4d6bfe",
  groq: "#f55036",
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

  tokensWrap: {
    fontFamily: "'JetBrains Mono', 'Fira Mono', monospace",
    fontSize: "0.78rem",
    fontWeight: 600,
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
  },

  // ── Provider badge ────────────────────────────────────────────────────────
  providerWrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
  providerIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  providerLabel: {
    fontSize: "0.78rem",
    fontWeight: 600,
    color: theme.palette.type === "dark" ? "#cbd5e1" : "#334155",
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
  if (action.type === "LOAD_PROMPTS") {
    const prompts = action.payload;
    const newPrompts = [];

    prompts.forEach((prompt) => {
      const promptIndex = state.findIndex((p) => p.id === prompt.id);
      if (promptIndex !== -1) {
        state[promptIndex] = prompt;
      } else {
        newPrompts.push(prompt);
      }
    });

    return [...state, ...newPrompts];
  }

  if (action.type === "UPDATE_PROMPTS") {
    const prompt = action.payload;
    const promptIndex = state.findIndex((p) => p.id === prompt.id);

    if (promptIndex !== -1) {
      state[promptIndex] = prompt;
      return [...state];
    }
    return [prompt, ...state];
  }

  if (action.type === "DELETE_PROMPT") {
    const promptId = action.payload;
    const promptIndex = state.findIndex((p) => p.id === promptId);
    if (promptIndex !== -1) {
      state.splice(promptIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const Prompts = () => {
  const classes = useStyles();

  const [prompts, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);

  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const { user, socket } = useContext(AuthContext);

  const { getPlanCompany } = usePlans();
  const history = useHistory();
  const companyId = user.companyId;

  useEffect(() => {
    async function fetchData() {
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useOpenAi) {
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
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/prompt");
        dispatch({ type: "LOAD_PROMPTS", payload: data.prompts });
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const onPromptEvent = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_PROMPTS", payload: data.prompt });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_PROMPT", payload: data.promptId });
      }
    };

    socket.on(`company-${companyId}-prompt`, onPromptEvent);
    return () => {
      socket.off(`company-${companyId}-prompt`, onPromptEvent);
    };
  }, [socket, companyId]);

  const handleOpenPromptModal = () => {
    setPromptModalOpen(true);
    setSelectedPrompt(null);
  };

  const handleClosePromptModal = () => {
    setPromptModalOpen(false);
    setSelectedPrompt(null);
  };

  const handleEditPrompt = (prompt) => {
    setSelectedPrompt(prompt);
    setPromptModalOpen(true);
  };

  const handleCloseConfirmationModal = () => {
    setConfirmModalOpen(false);
    setSelectedPrompt(null);
  };

  const handleDeletePrompt = async (promptId) => {
    try {
      const { data } = await api.delete(`/prompt/${promptId}`);
      toast.info(i18n.t(data.message));
    } catch (err) {
      toastError(err);
    }
    setSelectedPrompt(null);
  };

  if (user.profile === "user") {
    return <ForbiddenPage />;
  }

  return (
    <div className={classes.pageRoot}>
      <ConfirmationModal
        title={
          selectedPrompt &&
          `${i18n.t("prompts.confirmationModal.deleteTitle")} ${selectedPrompt.name}?`
        }
        open={confirmModalOpen}
        onClose={handleCloseConfirmationModal}
        onConfirm={() => handleDeletePrompt(selectedPrompt.id)}
      >
        {i18n.t("prompts.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <PromptModal
        open={promptModalOpen}
        onClose={handleClosePromptModal}
        promptId={selectedPrompt?.id}
      />

      <Tabs
        value={tabValue}
        onChange={(e, value) => setTabValue(value)}
        indicatorColor="primary"
        textColor="primary"
        style={{ marginBottom: 16 }}
      >
        <Tab label="Assistentes de IA" />
        <Tab label="Arquivos da IA" />
      </Tabs>

      {tabValue === 1 ? (
        <Paper className={classes.mainPaper} variant="outlined" style={{ padding: 16 }}>
          <PromptFilesTab />
        </Paper>
      ) : (
      <>
      {/* ── Add button ── */}
      <div className={classes.actionsWrap}>
        <Button
          variant="contained"
          color="primary"
          className={classes.btnPrimary}
          startIcon={<Add style={{ fontSize: 16 }} />}
          onClick={handleOpenPromptModal}
        >
          {i18n.t("prompts.buttons.add")}
        </Button>
      </div>

      {/* ── Main Table ── */}
      <Paper className={classes.mainPaper} variant="outlined">
        <div className={classes.tableContainer}>
          <Table size="small">
            <TableHead>
              <TableRow className={classes.tableHeaderRow}>
                <TableCell align="left" className={classes.tableHeaderCell}>
                  Provedor
                </TableCell>
                <TableCell align="left" className={classes.tableHeaderCell}>
                  {i18n.t("prompts.table.name")}
                </TableCell>
                <TableCell align="left" className={classes.tableHeaderCell}>
                  {i18n.t("prompts.table.queue")}
                </TableCell>
                <TableCell align="left" className={classes.tableHeaderCell}>
                  {i18n.t("prompts.table.max_tokens")}
                </TableCell>
                <TableCell align="right" className={classes.tableHeaderCell}>
                  {i18n.t("prompts.table.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {prompts.length > 0 ? (
                prompts.map((prompt) => {
                  const provider = normalizeAIProvider(
                    prompt.provider || getProviderFromModel(prompt.model)
                  );
                  const ProviderIcon = PROVIDER_ICON[provider];
                  const providerColor = PROVIDER_COLOR[provider];

                  return (
                  <TableRow key={prompt.id} className={classes.tableRow}>
                    <TableCell className={classes.tableCell}>
                      <span className={classes.providerWrap}>
                        <span
                          className={classes.providerIconWrap}
                          style={{ backgroundColor: `${providerColor}1a` }}
                        >
                          <ProviderIcon style={{ fontSize: 15, color: providerColor }} />
                        </span>
                        <span className={classes.providerLabel}>
                          {AI_PROVIDER_LABELS[provider]}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className={classes.tableCell}>
                      <span className={classes.nameWrap}>{prompt.name}</span>
                    </TableCell>
                    <TableCell className={classes.tableCell}>
                      {prompt.queue.name}
                    </TableCell>
                    <TableCell className={classes.tableCell}>
                      <span className={classes.tokensWrap}>{prompt.maxTokens}</span>
                    </TableCell>
                    <TableCell align="right" className={classes.tableCell}>
                      <div className={classes.actionsCell}>
                        <Tooltip title="Editar prompt" arrow>
                          <IconButton
                            size="small"
                            className={classes.actionIconBtn}
                            onClick={() => handleEditPrompt(prompt)}
                          >
                            <Edit style={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Excluir prompt" arrow>
                          <IconButton
                            size="small"
                            className={`${classes.actionIconBtn} ${classes.actionIconBtnDanger}`}
                            onClick={() => {
                              setSelectedPrompt(prompt);
                              setConfirmModalOpen(true);
                            }}
                          >
                            <DeleteOutline style={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })
              ) : !loading ? (
                <TableRow>
                  <TableCell colSpan={5} style={{ border: "none", padding: 0 }}>
                    <div className={classes.emptyState}>
                      <div className={classes.emptyIcon}>
                        <AssistantOutlined style={{ fontSize: 28 }} />
                      </div>
                      <Typography className={classes.emptyTitle}>
                        Nenhum prompt cadastrado
                      </Typography>
                      <Typography className={classes.emptySubtitle}>
                        Crie seu primeiro prompt clicando em
                        "Adicionar prompt" para configurar o assistente de IA.
                      </Typography>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}

              {loading && <TableRowSkeleton columns={5} />}
            </TableBody>
          </Table>
        </div>
      </Paper>
      </>
      )}
    </div>
  );
};

export default Prompts;
