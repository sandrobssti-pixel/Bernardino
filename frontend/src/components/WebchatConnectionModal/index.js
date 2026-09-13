import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Typography,
  Box,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
} from "@material-ui/core";
import {
  Chat,
  FileCopy,
  CloudUpload,
  Tune,
  Palette,
  Settings,
  Code,
  People,
  AccountTreeOutlined,
} from "@material-ui/icons";
import { makeStyles, createTheme, ThemeProvider, useTheme } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import QueueSelect from "../QueueSelect";
import TabPanel from "../TabPanel";

const useStyles = makeStyles((theme) => ({
  dialogPaper: {
    borderRadius: 16,
    overflow: "hidden",
    maxWidth: 720,
    width: "calc(100% - 32px)",
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 24px 64px rgba(15,23,42,0.22)",
  },
  tabPanel: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  },
  scrollableContent: {
    overflowY: "auto",
  },
  header: {
    padding: theme.spacing(3, 3, 2.5),
    display: "flex",
    alignItems: "center",
    gap: 16,
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark || theme.palette.primary.main} 100%)`,
    color: "#fff",
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: "rgba(255,255,255,0.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerTitle: {
    fontWeight: 700,
    fontSize: "1.05rem",
  },
  headerSubtitle: {
    fontSize: "0.8rem",
    opacity: 0.85,
  },
  tabsRoot: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    background: theme.palette.type === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
    minHeight: 40,
  },
  tabRoot: {
    minHeight: 40,
    minWidth: "auto",
    padding: theme.spacing(0.75, 1.25),
    fontSize: "0.74rem",
    fontWeight: 600,
    textTransform: "none",
  },
  tabLabel: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    whiteSpace: "nowrap",
  },
  tabIcon: {
    fontSize: "1rem",
  },
  snippetBox: {
    background: theme.palette.type === "dark" ? "#0b1220" : "#0f172a",
    color: "#e2e8f0",
    borderRadius: 10,
    padding: theme.spacing(2),
    fontFamily: "monospace",
    fontSize: "0.78rem",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
  },
  previewWrapper: {
    background: theme.palette.type === "dark" ? "rgba(255,255,255,0.03)" : "#f4f6f8",
    borderRadius: 12,
    padding: theme.spacing(3),
    display: "flex",
    justifyContent: "center",
  },
  previewWidget: {
    width: 280,
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
    background: theme.palette.background.paper,
  },
  previewHeader: {
    padding: theme.spacing(1.5, 2),
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#fff",
  },
  previewAvatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    objectFit: "cover",
    background: "rgba(255,255,255,0.3)",
    flexShrink: 0,
  },
  previewBody: {
    padding: theme.spacing(2),
    minHeight: 90,
  },
  previewBubble: {
    display: "inline-block",
    background: theme.palette.type === "dark" ? "rgba(255,255,255,0.08)" : "#eef1f4",
    borderRadius: 10,
    padding: theme.spacing(1, 1.5),
    fontSize: "0.78rem",
    maxWidth: "85%",
  },
  avatarPreview: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    objectFit: "cover",
    border: `1px solid ${theme.palette.divider}`,
  },
}));

const initialState = () => ({
  name: "",
  greetingMessage: "",
  outOfHoursMessage: "",
  subtitle: "",
  formTitle: "",
  textAboveButton: "",
  position: "right",
  requireName: false,
  requirePhone: false,
  hideDefaultButton: false,
  webchatActive: true,
  webchatAllowedDomains: "",
  primaryColor: "#2563eb",
  avatar: "",
  autoOpen: false,
  autoOpenDelay: 5,
  simulateTyping: true,
  typingDuration: 2,
  notificationSound: true,
});

const WebchatConnectionModal = ({ open, onClose, whatsappId }) => {
  const classes = useStyles();
  const outerTheme = useTheme();
  const isDark = outerTheme.palette.type === "dark";

  // Tema isolado só para este modal: reaproveita a paleta (cores/dark-mode)
  // do app, mas gera a escala tipográfica do zero com DM Sans + base 13px
  // (o typography.fontSize do MUI recalcula os rem de cada variant a partir
  // dele, então não dá pra só sobrescrever a fonte do tema pai por fora).
  const modalTheme = useMemo(
    () =>
      createTheme({
        palette: outerTheme.palette,
        typography: {
          fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
          fontSize: 13,
        },
        overrides: {
          MuiOutlinedInput: {
            root: {
              borderRadius: 10,
              backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#fafbfc",
              transition: "border-color .15s ease, box-shadow .15s ease",
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: outerTheme.palette.primary.main,
              },
              "&.Mui-focused": {
                boxShadow: `0 0 0 3px ${outerTheme.palette.primary.main}22`,
              },
            },
            input: {
              padding: "10.5px 12px",
            },
            notchedOutline: {
              borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.13)",
            },
          },
          MuiInputLabel: {
            outlined: {
              fontSize: 13,
              "&.MuiInputLabel-shrink": {
                fontSize: 13,
              },
            },
          },
          MuiFormHelperText: {
            root: {
              fontSize: 11.5,
              marginLeft: 2,
            },
          },
          MuiButton: {
            root: {
              borderRadius: 10,
              textTransform: "none",
              fontWeight: 600,
              fontSize: 13,
            },
            contained: {
              boxShadow: "none",
            },
            containedPrimary: {
              boxShadow: "0 2px 8px rgba(37,99,235,0.28)",
              "&:hover": {
                boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
              },
            },
          },
          MuiFormControlLabel: {
            label: {
              fontSize: 13,
            },
          },
          MuiTableCell: {
            root: {
              fontSize: 12.5,
              padding: "8px 12px",
            },
          },
          MuiMenuItem: {
            root: {
              fontSize: 13,
            },
          },
        },
      }),
    [outerTheme, isDark]
  );

  const [tab, setTab] = useState("config");
  const [form, setForm] = useState(initialState());
  const [selectedQueueIds, setSelectedQueueIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [widgetId, setWidgetId] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [flows, setFlows] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [flowIdWelcome, setFlowIdWelcome] = useState(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const { data: flowData } = await api.get("/flowbuilder");
        setFlows(flowData.flows || []);
      } catch (error) {
        toastError(error);
      }
      try {
        const { data: integrationData } = await api.get("/queueIntegration");
        const flowbuilderIntegrations = (integrationData.queueIntegrations || []).filter(
          (integration) => integration.type === "flowbuilder"
        );
        setIntegrations(flowbuilderIntegrations);
      } catch (error) {
        toastError(error);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setTab("config");

    if (!whatsappId) {
      setForm(initialState());
      setSelectedQueueIds([]);
      setWidgetId("");
      setSelectedIntegration(null);
      setFlowIdWelcome(null);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/whatsapp/${whatsappId}`);
        if (!mounted) return;
        const settings = data.webchatSettings || {};
        setForm({
          name: data.name || "",
          greetingMessage: data.greetingMessage || "",
          outOfHoursMessage: data.outOfHoursMessage || "",
          subtitle: settings.subtitle || "",
          formTitle: settings.formTitle || "",
          textAboveButton: settings.textAboveButton || "",
          position: settings.position || "right",
          requireName: Boolean(settings.requireName),
          requirePhone: Boolean(settings.requirePhone),
          hideDefaultButton: Boolean(settings.hideDefaultButton),
          webchatActive: data.webchatActive !== false,
          webchatAllowedDomains: data.webchatAllowedDomains || "",
          primaryColor: settings.appearance?.primaryColor || "#2563eb",
          avatar: settings.avatar || "",
          autoOpen: Boolean(settings.behavior?.autoOpen),
          autoOpenDelay: settings.behavior?.autoOpenDelay ?? 5,
          simulateTyping: settings.behavior?.simulateTyping !== false,
          typingDuration: settings.behavior?.typingDuration ?? 2,
          notificationSound: settings.behavior?.notificationSound !== false,
        });
        setSelectedQueueIds((data.queues || []).map((queue) => queue.id));
        setWidgetId(data.webchatWidgetId || "");
        setSelectedIntegration(data.integrationId || null);
        setFlowIdWelcome(data.flowIdWelcome || null);
      } catch (error) {
        toastError(error);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open, whatsappId]);

  useEffect(() => {
    if (!open || tab !== "sessions" || !whatsappId) return;

    let mounted = true;
    (async () => {
      try {
        setSessionsLoading(true);
        const { data } = await api.get(`/whatsapp/${whatsappId}/webchat-sessions`);
        if (mounted) setSessions(data.sessions || []);
      } catch (error) {
        toastError(error);
      } finally {
        if (mounted) setSessionsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open, tab, whatsappId]);

  const STATUS_LABELS = {
    open: "Em atendimento",
    pending: "Aguardando",
    closed: "Encerrado",
    group: "Grupo",
    nps: "Avaliação",
    lgpd: "LGPD",
  };

  const BOOLEAN_FIELDS = [
    "requireName",
    "requirePhone",
    "hideDefaultButton",
    "webchatActive",
    "autoOpen",
    "simulateTyping",
    "notificationSound",
  ];

  const handleChange = (field) => (event) => {
    const value = BOOLEAN_FIELDS.includes(field)
      ? Boolean(event.target.checked)
      : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCopy = async (value) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success("Copiado.");
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!whatsappId) {
      toast.warning("Salve o widget primeiro para poder enviar uma imagem.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploadingAvatar(true);
      const { data } = await api.post(
        `/whatsapp/${whatsappId}/webchat-avatar-upload`,
        formData
      );
      setForm((prev) => ({ ...prev, avatar: data.avatar || "" }));
      toast.success("Imagem atualizada.");
    } catch (error) {
      toastError(error);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const backendUrl = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
  const embedSnippet = widgetId
    ? `<script src="${backendUrl}/public/webchat/widget.js" data-widget-id="${widgetId}"></script>`
    : "";

  const handleSave = async () => {
    if (!form.name || form.name.trim().length < 2) {
      toast.error("Informe um nome para o widget.");
      return;
    }

    const payload = {
      name: form.name,
      channel: "webchat",
      status: "CONNECTED",
      isDefault: false,
      greetingMessage: form.greetingMessage,
      outOfHoursMessage: form.outOfHoursMessage,
      queueIds: selectedQueueIds,
      integrationId: selectedIntegration || null,
      flowIdWelcome: flowIdWelcome || null,
      webchatActive: form.webchatActive,
      webchatAllowedDomains: form.webchatAllowedDomains,
      webchatSettings: {
        subtitle: form.subtitle,
        formTitle: form.formTitle,
        textAboveButton: form.textAboveButton,
        position: form.position,
        requireName: form.requireName,
        requirePhone: form.requirePhone,
        hideDefaultButton: form.hideDefaultButton,
        avatar: form.avatar,
        appearance: {
          primaryColor: form.primaryColor,
        },
        behavior: {
          autoOpen: form.autoOpen,
          autoOpenDelay: Number(form.autoOpenDelay) || 0,
          simulateTyping: form.simulateTyping,
          typingDuration: Number(form.typingDuration) || 0,
          notificationSound: form.notificationSound,
        },
      },
    };

    try {
      setLoading(true);
      if (whatsappId) {
        await api.put(`/whatsapp/${whatsappId}`, payload);
      } else {
        const { data } = await api.post("/whatsapp", payload);
        setWidgetId(data.webchatWidgetId || "");
      }
      toast.success("Conexão de webchat salva com sucesso.");
      onClose();
    } catch (error) {
      toastError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={modalTheme}>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        PaperProps={{ className: classes.dialogPaper }}
      >
        <div className={classes.header}>
          <div className={classes.headerIcon}>
            <Chat style={{ color: "#fff" }} />
          </div>
          <div>
            <Typography className={classes.headerTitle}>
              {whatsappId ? "Editar Webchat" : "Novo Webchat"}
            </Typography>
            <Typography className={classes.headerSubtitle}>
              Chat para o seu site, direto no mesmo painel de atendimento — com filas e fluxos automáticos.
            </Typography>
          </div>
        </div>
  
        <Tabs
          value={tab}
          indicatorColor="primary"
          textColor="primary"
          onChange={(e, value) => setTab(value)}
          classes={{ root: classes.tabsRoot }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            label={
              <span className={classes.tabLabel}>
                <Settings className={classes.tabIcon} /> Configuração
              </span>
            }
            value="config"
            classes={{ root: classes.tabRoot }}
          />
          <Tab
            label={
              <span className={classes.tabLabel}>
                <Palette className={classes.tabIcon} /> Aparência
              </span>
            }
            value="appearance"
            classes={{ root: classes.tabRoot }}
          />
          <Tab
            label={
              <span className={classes.tabLabel}>
                <Tune className={classes.tabIcon} /> Comportamento
              </span>
            }
            value="behavior"
            classes={{ root: classes.tabRoot }}
          />
          <Tab
            label={
              <span className={classes.tabLabel}>
                <AccountTreeOutlined className={classes.tabIcon} /> Fluxos
              </span>
            }
            value="flows"
            classes={{ root: classes.tabRoot }}
          />
          <Tab
            label={
              <span className={classes.tabLabel}>
                <Code className={classes.tabIcon} /> Instalação
              </span>
            }
            value="install"
            classes={{ root: classes.tabRoot }}
            disabled={!whatsappId}
          />
          <Tab
            label={
              <span className={classes.tabLabel}>
                <People className={classes.tabIcon} /> Sessões
              </span>
            }
            value="sessions"
            classes={{ root: classes.tabRoot }}
            disabled={!whatsappId}
          />
        </Tabs>
  
        <TabPanel value={tab} name="config" className={classes.tabPanel}>
          <DialogContent dividers className={classes.scrollableContent}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Nome do widget"
                  variant="outlined"
                  margin="dense"
                  value={form.name}
                  onChange={handleChange("name")}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Subtítulo"
                  variant="outlined"
                  margin="dense"
                  value={form.subtitle}
                  onChange={handleChange("subtitle")}
                  placeholder="Ex: Normalmente respondemos em minutos"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Título do formulário inicial"
                  variant="outlined"
                  margin="dense"
                  value={form.formTitle}
                  onChange={handleChange("formTitle")}
                  placeholder="Ex: Antes de começar..."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  fullWidth
                  label="Posição do widget"
                  variant="outlined"
                  margin="dense"
                  value={form.position}
                  onChange={handleChange("position")}
                >
                  <MenuItem value="right">Direita</MenuItem>
                  <MenuItem value="left">Esquerda</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Mensagem de boas-vindas"
                  variant="outlined"
                  margin="dense"
                  multiline
                  rows={2}
                  value={form.greetingMessage}
                  onChange={handleChange("greetingMessage")}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Mensagem fora do horário de atendimento"
                  variant="outlined"
                  margin="dense"
                  multiline
                  rows={2}
                  value={form.outOfHoursMessage}
                  onChange={handleChange("outOfHoursMessage")}
                />
              </Grid>
              <Grid item xs={12}>
                <QueueSelect
                  selectedQueueIds={selectedQueueIds}
                  onChange={(ids) => setSelectedQueueIds(ids)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.requireName}
                      onChange={handleChange("requireName")}
                      color="primary"
                    />
                  }
                  label="Exigir nome"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.requirePhone}
                      onChange={handleChange("requirePhone")}
                      color="primary"
                    />
                  }
                  label="Exigir telefone"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.webchatActive}
                      onChange={handleChange("webchatActive")}
                      color="primary"
                    />
                  }
                  label="Widget ativo"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Domínios permitidos"
                  variant="outlined"
                  margin="dense"
                  value={form.webchatAllowedDomains}
                  onChange={handleChange("webchatAllowedDomains")}
                  placeholder="Ex: meusite.com.br, app.meusite.com.br"
                  helperText="Domínios separados por vírgula onde o widget pode ser carregado. Deixe em branco para permitir qualquer domínio."
                />
              </Grid>
            </Grid>
          </DialogContent>
        </TabPanel>
  
        <TabPanel value={tab} name="appearance" className={classes.tabPanel}>
          <DialogContent dividers className={classes.scrollableContent}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Cor principal"
                      variant="outlined"
                      margin="dense"
                      type="color"
                      value={form.primaryColor}
                      onChange={handleChange("primaryColor")}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Box display="flex" alignItems="center" gridGap={12}>
                      <img
                        src={form.avatar || "/nopicture.png"}
                        alt="Avatar do widget"
                        className={classes.avatarPreview}
                        onError={(e) => { e.target.src = "/nopicture.png"; }}
                      />
                      <label htmlFor="webchat-avatar-input">
                        <input
                          id="webchat-avatar-input"
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={handleAvatarChange}
                        />
                        <Button
                          component="span"
                          size="small"
                          variant="outlined"
                          startIcon={<CloudUpload />}
                          disabled={uploadingAvatar || !whatsappId}
                        >
                          {uploadingAvatar ? "Enviando..." : "Enviar imagem"}
                        </Button>
                      </label>
                    </Box>
                    {!whatsappId && (
                      <Typography variant="caption" color="textSecondary">
                        Salve o widget primeiro para poder enviar uma imagem.
                      </Typography>
                    )}
                  </Grid>
                </Grid>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="textSecondary" gutterBottom style={{ display: "block" }}>
                  Preview
                </Typography>
                <Box className={classes.previewWrapper}>
                  <Box className={classes.previewWidget}>
                    <Box
                      className={classes.previewHeader}
                      style={{ background: form.primaryColor }}
                    >
                      {form.avatar && (
                        <img src={form.avatar} alt="" className={classes.previewAvatar} />
                      )}
                      <Box>
                        <Typography style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                          {form.name || "Atendimento"}
                        </Typography>
                        {form.subtitle && (
                          <Typography style={{ fontSize: "0.7rem", opacity: 0.85 }}>
                            {form.subtitle}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <Box className={classes.previewBody}>
                      <span className={classes.previewBubble}>
                        {form.greetingMessage || "Olá! Como podemos ajudar?"}
                      </span>
                    </Box>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </DialogContent>
        </TabPanel>
  
        <TabPanel value={tab} name="behavior" className={classes.tabPanel}>
          <DialogContent dividers className={classes.scrollableContent}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.autoOpen}
                      onChange={handleChange("autoOpen")}
                      color="primary"
                    />
                  }
                  label="Abrir automaticamente"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Tempo para abrir (segundos)"
                  variant="outlined"
                  margin="dense"
                  value={form.autoOpenDelay}
                  onChange={handleChange("autoOpenDelay")}
                  disabled={!form.autoOpen}
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.simulateTyping}
                      onChange={handleChange("simulateTyping")}
                      color="primary"
                    />
                  }
                  label="Simular digitação"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Duração da simulação (segundos)"
                  variant="outlined"
                  margin="dense"
                  value={form.typingDuration}
                  onChange={handleChange("typingDuration")}
                  disabled={!form.simulateTyping}
                  inputProps={{ min: 0, step: 0.5 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.notificationSound}
                      onChange={handleChange("notificationSound")}
                      color="primary"
                    />
                  }
                  label="Som de notificação"
                />
              </Grid>
            </Grid>
          </DialogContent>
        </TabPanel>
  
        <TabPanel value={tab} name="flows" className={classes.tabPanel}>
          <DialogContent dividers className={classes.scrollableContent}>
            <FormControl variant="outlined" margin="dense" fullWidth>
              <InputLabel id="webchat-integrationId-label">Integração de fluxo</InputLabel>
              <Select
                label="Integração de fluxo"
                labelId="webchat-integrationId-label"
                value={selectedIntegration || ""}
                onChange={(e) => setSelectedIntegration(e.target.value || null)}
              >
                <MenuItem value="">Desabilitado</MenuItem>
                {integrations.map((integration) => (
                  <MenuItem key={integration.id} value={integration.id}>
                    {integration.name}
                  </MenuItem>
                ))}
              </Select>
              <Typography variant="caption" color="textSecondary" style={{ marginTop: 4 }}>
                Cadastre uma integração do tipo "Flowbuilder" em Integrações para poder selecioná-la aqui.
              </Typography>
            </FormControl>

            <Box mt={3}>
              <Typography variant="subtitle2" gutterBottom>Fluxo de boas-vindas</Typography>
              <FormControl variant="outlined" margin="dense" fullWidth>
                <Select
                  value={flowIdWelcome || ""}
                  onChange={(e) => setFlowIdWelcome(e.target.value || null)}
                  displayEmpty
                >
                  <MenuItem value="">Desabilitado</MenuItem>
                  {flows.map((flow) => (
                    <MenuItem key={flow.id} value={flow.id}>
                      {flow.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
        </TabPanel>

        <TabPanel value={tab} name="install" className={classes.tabPanel}>
          <DialogContent dividers className={classes.scrollableContent}>
            {widgetId ? (
              <>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Cole este código antes do fechamento da tag <code>&lt;/body&gt;</code> do seu site:
                </Typography>
                <Box className={classes.snippetBox}>{embedSnippet}</Box>
                <Box display="flex" justifyContent="flex-end" mt={1}>
                  <Button
                    size="small"
                    onClick={() => handleCopy(embedSnippet)}
                    startIcon={<FileCopy />}
                  >
                    Copiar código
                  </Button>
                </Box>
              </>
            ) : (
              <Typography variant="body2" color="textSecondary">
                Salve o widget primeiro para gerar o código de instalação.
              </Typography>
            )}
  
            <Box mt={3}>
              <Typography variant="subtitle2" gutterBottom>
                Documentação de integração
              </Typography>
              <Typography variant="body2" component="div" color="textSecondary">
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  <li>Copie o código acima e cole antes do <code>&lt;/body&gt;</code> em todas as páginas do seu site onde o chat deve aparecer.</li>
                  <li>O widget é carregado de forma assíncrona e não afeta o carregamento do restante da página.</li>
                  <li>Cada visitante recebe uma sessão própria, guardada no navegador dele — recarregar a página mantém a mesma conversa.</li>
                  <li>As mensagens aparecem no painel normalmente, como em qualquer outra conexão, respeitando filas e fluxos configurados.</li>
                  <li>Se você cadastrar domínios permitidos na aba Configuração, o widget só funcionará nesses domínios.</li>
                </ol>
              </Typography>
            </Box>
          </DialogContent>
        </TabPanel>
  
        <TabPanel value={tab} name="sessions" className={classes.tabPanel}>
          <DialogContent dividers className={classes.scrollableContent}>
            {sessionsLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress size={24} />
              </Box>
            ) : sessions.length === 0 ? (
              <Typography variant="body2" color="textSecondary">
                Nenhuma sessão registrada ainda para este widget.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Nome</TableCell>
                    <TableCell>Telefone</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Última atividade</TableCell>
                    <TableCell>Ticket</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.ticketId}>
                      <TableCell>{session.contactName}</TableCell>
                      <TableCell>{session.contactNumber}</TableCell>
                      <TableCell>
                        {STATUS_LABELS[session.status] || session.status}
                      </TableCell>
                      <TableCell>
                        {session.updatedAt
                          ? new Date(session.updatedAt).toLocaleString("pt-BR")
                          : "-"}
                      </TableCell>
                      <TableCell>#{session.ticketId}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DialogContent>
        </TabPanel>
  
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button color="primary" variant="contained" onClick={handleSave} disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
};

export default WebchatConnectionModal;
