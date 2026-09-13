import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import {
  CloudUpload,
  OpenInNew,
} from "@material-ui/icons";
import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  cardBox: {
    borderRadius: 10,
    padding: theme.spacing(2),
    background: theme.palette.type === "dark" ? "rgba(15,23,42,0.35)" : "#fff",
    border: `1px solid ${theme.palette.divider}`
  },
  actionsRow: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap"
  },
  sectionTitle: {
    fontWeight: 700,
    marginBottom: theme.spacing(1)
  },
  hiddenInput: {
    display: "none"
  },
  uploadName: {
    marginTop: theme.spacing(1),
    fontSize: 12,
    color: theme.palette.text.secondary
  },
  statusBox: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.25),
    padding: theme.spacing(1.25, 0),
    minHeight: 40
  },
  statusText: {
    fontSize: 13,
    color: theme.palette.text.secondary
  },
  primaryActionBox: {
    borderRadius: 10,
    padding: theme.spacing(2),
    background: theme.palette.type === "dark" ? "rgba(34,197,94,0.12)" : "#f0fdf4",
    border: `1px solid ${theme.palette.type === "dark" ? "rgba(34,197,94,0.22)" : "#bbf7d0"}`
  }
}));

const emptyTokenState = {
  endpoint: "",
  token: "",
  expiresInSeconds: 0,
  authHeaderHint: ""
};

// A pagina bridge.html fica hospedada num dominio central (nao no dominio
// deste tenant), pra que a extensao "Multi Web API" so precise reconhecer um
// unico dominio fixo (content_scripts) em vez de qualquer site — isso e o
// que permite remover host_permissions amplas da extensao.
const BRIDGE_ORIGIN = process.env.REACT_APP_WA_CONNECT_URL || "https://connect.zapchatpro.com.br";
const BRIDGE_PATH = "/bridge.html";
const BRIDGE_INIT_QUERY = "?init=1";

const BRIDGE_LOADING_MESSAGE = "Carregando...";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const encodeBridgePayload = (value) => {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const WhatsAppCredentialsModal = ({ open, onClose, whatsApp }) => {
  const classes = useStyles();
  const fileInputRef = useRef(null);
  const bridgeWindowRef = useRef(null);
  const { user, socket } = useContext(AuthContext);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenData, setTokenData] = useState(emptyTokenState);
  const [runtimeMessage, setRuntimeMessage] = useState("");
  const [bridgeLoading, setBridgeLoading] = useState(false);

  const resetState = useCallback(() => {
    setSelectedFileName("");
    setLoading(false);
    setTokenLoading(false);
    setTokenData(emptyTokenState);
    setRuntimeMessage("");
    setBridgeLoading(false);
    bridgeWindowRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const loadBridgeToken = useCallback(async () => {
    if (!whatsApp?.id) return;
    setTokenLoading(true);
    try {
      const { data } = await api.post(`/whatsapp/${whatsApp.id}/credentials-import-token`);
      const nextTokenData = {
        endpoint: data?.endpoint || "",
        token: data?.token || "",
        expiresInSeconds: Number(data?.expiresInSeconds || 0),
        authHeaderHint: data?.authHeaderHint || ""
      };
      setTokenData(nextTokenData);
      return nextTokenData;
    } catch (error) {
      toastError(error);
      return null;
    } finally {
      setTokenLoading(false);
    }
  }, [whatsApp?.id]);

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  useEffect(() => {
    if (!open || !whatsApp?.id) return;
    const companyId = user.companyId;

    const onWhatsappData = (data) => {
      if (data.action !== "update" || !data?.session?.id) return;
      if (Number(data.session.id) !== Number(whatsApp.id)) return;

      const nextStatus = String(data.session.status || "").toUpperCase();
      if (nextStatus === "OPENING") {
        setRuntimeMessage("Carregando...");
      }
      if (nextStatus === "CONNECTED") {
        toast.success("Conexão autenticada com sucesso.");
        setRuntimeMessage("Está tudo ok.");
        onClose();
      }
    };

    socket.on(`company-${companyId}-whatsappSession`, onWhatsappData);
    return () => {
      socket.off(`company-${companyId}-whatsappSession`, onWhatsappData);
    };
  }, [open, onClose, socket, user.companyId, whatsApp?.id]);

  const importJsonPayload = useCallback(async (nextPayload) => {
    if (!whatsApp?.id) return;

    setLoading(true);
    try {
      const { data } = await api.post(`/whatsapp/${whatsApp.id}/credentials-import`, {
        payload: nextPayload
      });
      setRuntimeMessage(data?.message || "Está tudo ok.");
      toast.success("Sessão importada com sucesso.");
    } catch (error) {
      toastError(error);
    } finally {
      setLoading(false);
    }
  }, [whatsApp?.id]);

  const handleReadFile = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const nextPayload = String(reader.result || "");
      setSelectedFileName(file.name);
      setRuntimeMessage("Carregando...");
      importJsonPayload(nextPayload);
    };
    reader.onerror = () => {
      toast.error("Não foi possível ler o arquivo selecionado.");
    };
    reader.readAsText(file);
  }, [importJsonPayload]);

  const handleOpenWhatsAppWeb = useCallback(async () => {
    if (!whatsApp?.id) return;

    setBridgeLoading(true);
    setRuntimeMessage(BRIDGE_LOADING_MESSAGE);

    const popup = window.open(
      `${BRIDGE_ORIGIN}${BRIDGE_PATH}${BRIDGE_INIT_QUERY}`,
      "_blank"
    );
    if (!popup) {
      setBridgeLoading(false);
      toast.error("Não foi possível abrir a nova aba. Verifique o bloqueador de pop-ups.");
      return;
    }

    bridgeWindowRef.current = popup;

    try {
      const nextTokenData = tokenData.token && tokenData.endpoint
        ? tokenData
        : await loadBridgeToken();

      if (!nextTokenData?.token || !nextTokenData?.endpoint) {
        throw new Error("Não foi possível gerar o link seguro.");
      }

      const bridgePayload = {
        url: nextTokenData.endpoint,
        token: nextTokenData.token
      };
      const bridgeUrl =
        `${BRIDGE_ORIGIN}${BRIDGE_PATH}?session=${Date.now()}#p=${encodeBridgePayload(bridgePayload)}`;
      popup.location.href = bridgeUrl;
      popup.focus();
      await sleep(900);
      setRuntimeMessage(BRIDGE_LOADING_MESSAGE);
    } catch (error) {
      try {
        popup.close();
      } catch (_) {}
      toastError(error);
      setRuntimeMessage("");
    } finally {
      setBridgeLoading(false);
    }
  }, [loadBridgeToken, tokenData, whatsApp?.id]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Whatsapp Web</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Paper className={classes.primaryActionBox} elevation={0}>
              <Typography variant="subtitle1" className={classes.sectionTitle}>
                Abrir WhatsApp Web
              </Typography>
              <div style={{ marginTop: 12 }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={bridgeLoading ? <CircularProgress size={16} color="inherit" /> : <OpenInNew />}
                  onClick={handleOpenWhatsAppWeb}
                  disabled={bridgeLoading || tokenLoading || loading}
                >
                  {bridgeLoading ? "Abrindo..." : "Abrir WhatsApp Web"}
                </Button>
              </div>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper className={classes.cardBox} elevation={0}>
              <Typography variant="subtitle1" className={classes.sectionTitle}>
                Importar sessão em JSON
              </Typography>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className={classes.hiddenInput}
                onChange={handleReadFile}
              />
              <div className={classes.actionsRow}>
                <Button
                  variant="outlined"
                  startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <CloudUpload />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || bridgeLoading || tokenLoading}
                >
                  {loading ? "Importando..." : "Selecionar arquivo JSON"}
                </Button>
              </div>
              {selectedFileName ? (
                <Typography className={classes.uploadName}>
                  Arquivo carregado: {selectedFileName}
                </Typography>
              ) : null}
            </Paper>
          </Grid>

          {runtimeMessage ? (
            <Grid item xs={12}>
              <Box className={classes.statusBox}>
                {(bridgeLoading || loading) ? <CircularProgress size={18} /> : null}
                <Typography variant="body2" color="primary" className={classes.statusText}>
                  {runtimeMessage}
                </Typography>
              </Box>
            </Grid>
          ) : null}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading || tokenLoading || bridgeLoading}>
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default React.memo(WhatsAppCredentialsModal);
