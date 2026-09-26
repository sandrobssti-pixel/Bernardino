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
  IconButton,
  makeStyles
} from "@material-ui/core";
import { FileCopy, Close as CloseIcon, Facebook as FacebookIcon, Instagram as InstagramIcon } from "@material-ui/icons";
import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  dialogPaper: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: theme.palette.type === "light" ? "#f7f8fa" : "#101418",
  },

  modalHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 20px",
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark || theme.palette.primary.main} 100%)`,
    color: "#fff",
    [theme.breakpoints.down("xs")]: {
      padding: "12px 14px",
      gap: 10,
    },
  },
  modalHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    flexShrink: 0,
    "& svg": {
      fontSize: 18,
    },
  },
  modalHeaderTexts: {
    flex: 1,
    minWidth: 0,
  },
  modalHeaderTitle: {
    fontSize: "0.95rem",
    fontWeight: 700,
    lineHeight: 1.3,
    letterSpacing: "-0.2px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  modalHeaderSubtitle: {
    fontSize: "0.72rem",
    opacity: 0.85,
    marginTop: 1,
    fontWeight: 400,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  modalCloseBtn: {
    color: "#fff",
    backgroundColor: "rgba(255,255,255,0.12)",
    flexShrink: 0,
    "&:hover": {
      backgroundColor: "rgba(255,255,255,0.24)",
    },
  },

  content: {
    padding: "14px 20px",
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      backgroundColor: theme.palette.type === "light" ? "#fff" : "#161b20",
    },
  },

  section: {
    backgroundColor: theme.palette.type === "light" ? "#fff" : "#161b20",
    border: `1px solid ${theme.palette.type === "light" ? "#e5e7eb" : "#262f38"}`,
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: "0.84rem",
    fontWeight: 700,
    color: theme.palette.type === "light" ? "#0f172a" : "#e2e8f0",
    marginBottom: 10,
  },

  dialogActions: {
    padding: "10px 20px",
    borderTop: `1px solid ${theme.palette.type === "light" ? "#e5e7eb" : "#262f38"}`,
    backgroundColor: theme.palette.type === "light" ? "#fff" : "#161b20",
  },
  pillButton: {
    borderRadius: 8,
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.82rem",
    padding: "5px 14px",
  },
}));

const CHANNEL_OPTIONS = [
  { value: "facebook", label: "Facebook Messenger" },
  { value: "instagram", label: "Instagram Direct" }
];

const resolveInitialChannel = (channelPreset = "facebook") =>
  channelPreset === "instagram" ? "instagram" : "facebook";

const initialState = (channelPreset = "facebook") => ({
  channel: resolveInitialChannel(channelPreset),
  name: "",
  appId: "",
  appSecret: "",
  verifyToken: "",
  pageId: "",
  pageAccessToken: "",
  instagramBusinessAccountId: "",
  businessId: "",
  status: "DISCONNECTED",
  isActive: true,
  promptId: "",
  metadata: ""
});

const MetaConnectionModal = ({
  open,
  onClose,
  metaConnectionId,
  channelPreset = "meta",
  onSaved
}) => {
  const classes = useStyles();
  const [form, setForm] = useState(initialState(channelPreset));
  const [loading, setLoading] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("");
  const [prompts, setPrompts] = useState([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const { data } = await api.get("/prompt");
        setPrompts(data.prompts || []);
      } catch (err) {
        toastError(err);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (!metaConnectionId) {
      setForm(initialState(channelPreset));
      setCallbackUrl("");
      return;
    }

    let mounted = true;

    const loadConnection = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/meta-connections/${metaConnectionId}`);
        if (!mounted) return;
        setForm({
          channel: data.channel || "meta",
          name: data.name || "",
          appId: data.appId || "",
          appSecret: data.appSecret || "",
          verifyToken: data.verifyToken || "",
          pageId: data.pageId || "",
          pageAccessToken: data.pageAccessToken || "",
          instagramBusinessAccountId: data.instagramBusinessAccountId || "",
          businessId: data.businessId || "",
          status: data.status || "DISCONNECTED",
          isActive: data.isActive !== false,
          promptId: data.promptId || "",
          metadata: data.metadata ? JSON.stringify(data.metadata, null, 2) : ""
        });
        setCallbackUrl(data.callbackUrl || "");
      } catch (error) {
        toastError(error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadConnection();

    return () => {
      mounted = false;
    };
  }, [open, metaConnectionId, channelPreset]);

  const title = useMemo(() => (
    metaConnectionId ? "Editar Conexão Meta" : "Nova Conexão Meta"
  ), [metaConnectionId]);

  const handleChange = (field) => (event) => {
    const value =
      field === "isActive" ? Boolean(event.target.checked) : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCopy = async (value) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success("Copiado.");
  };

  const handleSave = async () => {
    let parsedMetadata = null;

    if (String(form.metadata || "").trim()) {
      try {
        parsedMetadata = JSON.parse(form.metadata);
      } catch {
        toast.error("O campo metadata precisa ser um JSON valido.");
        return;
      }
    }

    const payload = {
      ...form,
      promptId: form.promptId || null,
      metadata: parsedMetadata
    };

    try {
      setLoading(true);
      if (metaConnectionId) {
        await api.put(`/meta-connections/${metaConnectionId}`, payload);
      } else {
        const { data } = await api.post("/meta-connections", payload);
        setCallbackUrl(data.callbackUrl || "");
      }

      toast.success("Conexao Meta salva com sucesso.");
      if (onSaved) await onSaved();
      onClose();
    } catch (error) {
      toastError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      scroll="paper"
      classes={{ paper: classes.dialogPaper }}
    >
      <div className={classes.modalHeader}>
        <div className={classes.modalHeaderIcon}>
          {form.channel === "instagram" ? <InstagramIcon /> : <FacebookIcon />}
        </div>
        <div className={classes.modalHeaderTexts}>
          <Typography className={classes.modalHeaderTitle}>
            {title}
          </Typography>
          <Typography className={classes.modalHeaderSubtitle}>
            Configure a integração com Facebook Messenger ou Instagram Direct
          </Typography>
        </div>
        <IconButton
          size="small"
          className={classes.modalCloseBtn}
          onClick={onClose}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>
      <DialogContent dividers className={classes.content}>
        <div className={classes.section}>
          <div className={classes.sectionTitle}>Informações da conexão</div>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                label="Canal"
                variant="outlined"
                margin="dense"
                value={form.channel}
                onChange={handleChange("channel")}
              >
                {CHANNEL_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nome da conexao"
                variant="outlined"
                margin="dense"
                value={form.name}
                onChange={handleChange("name")}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                label="Status"
                variant="outlined"
                margin="dense"
                value={form.status}
                onChange={handleChange("status")}
              >
                <MenuItem value="DISCONNECTED">DISCONNECTED</MenuItem>
                <MenuItem value="CONNECTED">CONNECTED</MenuItem>
                <MenuItem value="PENDING_WEBHOOK">PENDING_WEBHOOK</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box display="flex" alignItems="center" height="100%">
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(form.isActive)}
                      onChange={handleChange("isActive")}
                      color="primary"
                    />
                  }
                  label="Conexao ativa"
                />
              </Box>
            </Grid>
          </Grid>
        </div>

        <div className={classes.section}>
          <div className={classes.sectionTitle}>Credenciais da API Meta</div>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="App ID"
                variant="outlined"
                margin="dense"
                value={form.appId}
                onChange={handleChange("appId")}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="App Secret"
                variant="outlined"
                margin="dense"
                value={form.appSecret}
                onChange={handleChange("appSecret")}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Verify Token"
                variant="outlined"
                margin="dense"
                value={form.verifyToken}
                onChange={handleChange("verifyToken")}
                helperText="Se deixar em branco na criacao, o sistema gera um token automaticamente."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Business ID"
                variant="outlined"
                margin="dense"
                value={form.businessId}
                onChange={handleChange("businessId")}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Page ID"
                variant="outlined"
                margin="dense"
                value={form.pageId}
                onChange={handleChange("pageId")}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Instagram Business Account ID"
                variant="outlined"
                margin="dense"
                value={form.instagramBusinessAccountId}
                onChange={handleChange("instagramBusinessAccountId")}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Page Access Token"
                variant="outlined"
                margin="dense"
                multiline
                rows={3}
                value={form.pageAccessToken}
                onChange={handleChange("pageAccessToken")}
              />
            </Grid>
          </Grid>
        </div>

        <div className={classes.section}>
          <div className={classes.sectionTitle}>Agente de IA</div>
          <TextField
            select
            fullWidth
            label="Prompt (Agente de IA)"
            variant="outlined"
            margin="dense"
            value={form.promptId}
            onChange={handleChange("promptId")}
            helperText="A IA responde automaticamente as mensagens do Instagram/Messenger desta conexão enquanto o atendimento não estiver com um atendente ou fila. O cliente pode pedir para falar com um humano a qualquer momento."
          >
            <MenuItem value="">
              <em>Desativado</em>
            </MenuItem>
            {prompts.map((prompt) => (
              <MenuItem key={prompt.id} value={prompt.id}>
                {prompt.name}
              </MenuItem>
            ))}
          </TextField>
        </div>

        <div className={classes.section}>
          <div className={classes.sectionTitle}>Metadata</div>
          <TextField
            fullWidth
            label="Metadata JSON"
            variant="outlined"
            margin="dense"
            multiline
            rows={5}
            value={form.metadata}
            onChange={handleChange("metadata")}
            placeholder='{"notes":"opcional","webhookConfigured":false}'
          />
        </div>

        <div className={classes.section} style={{ marginBottom: 0 }}>
          <div className={classes.sectionTitle}>Webhook</div>
          <TextField
            fullWidth
            label="Callback URL (Meta Webhook)"
            variant="outlined"
            margin="dense"
            value={callbackUrl}
            InputProps={{ readOnly: true }}
            placeholder="Salve a conexao para gerar a URL do webhook"
          />
          <Box display="flex" alignItems="center" justifyContent="space-between" mt={1}>
            <Typography variant="caption" color="textSecondary">
              Esta URL ja pode ser usada na configuracao do app Meta desta conexao.
            </Typography>
            <Button
              size="small"
              onClick={() => handleCopy(callbackUrl)}
              startIcon={<FileCopy />}
              disabled={!callbackUrl}
            >
              Copiar URL
            </Button>
          </Box>
        </div>
      </DialogContent>
      <DialogActions className={classes.dialogActions}>
        <Button onClick={onClose} disabled={loading} className={classes.pillButton}>
          Cancelar
        </Button>
        <Button
          color="primary"
          variant="contained"
          onClick={handleSave}
          disabled={loading}
          className={classes.pillButton}
        >
          {loading ? "Salvando..." : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MetaConnectionModal;
