import React, { useEffect, useState, useContext, useRef, useCallback } from "react";
import QRCode from "qrcode.react";
import toastError from "../../errors/toastError";
import { makeStyles } from "@material-ui/core/styles";
import {
  Dialog,
  DialogContent,
  Paper,
  Typography,
  Box,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Button
} from "@material-ui/core";
import {
  Smartphone,
  MoreVert,
  Settings,
  Link,
  CameraAlt
} from "@material-ui/icons";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: theme.spacing(3),
  },
  dialogPaper: {
    borderRadius: 16,
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  },
  contentPaper: {
    padding: theme.spacing(4),
    borderRadius: 12,
    textAlign: "center",
    background: "white",
    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
  },
  title: {
    fontWeight: 700,
    color: "#2d3748",
    marginBottom: theme.spacing(2),
    fontSize: "1.5rem",
  },
  subtitle: {
    color: "#718096",
    marginBottom: theme.spacing(3),
    fontSize: "1rem",
  },
  qrContainer: {
    padding: theme.spacing(2),
    backgroundColor: "white",
    borderRadius: 12,
    margin: theme.spacing(2, 0),
    border: "1px solid #e2e8f0",
    display: "inline-block",
  },
  qrCode: {
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  },
  instructions: {
    marginTop: theme.spacing(3),
    textAlign: "left",
  },
  instructionList: {
    backgroundColor: "#f7fafc",
    borderRadius: 8,
    padding: theme.spacing(2),
  },
  listItem: {
    padding: theme.spacing(1, 0),
  },
  listIcon: {
    minWidth: 40,
    color: theme.palette.primary.main, // <-- cor seguindo o whitelabel
  },
  timer: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(1, 2),
    backgroundColor: "#edf2f7",
    borderRadius: 20,
    display: "inline-block",
    fontWeight: 600,
    color: "#4a5568",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing(2),
    padding: theme.spacing(4),
  },
  brand: {
    fontWeight: 700,
    color: theme.palette.primary.main,
    fontSize: "1.2rem",
    marginBottom: theme.spacing(1),
  },
}));

const base64UrlToArrayBuffer = (base64Url) => {
  const padded = String(base64Url || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = "=".repeat((4 - (padded.length % 4)) % 4);
  const binary = window.atob(padded + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const arrayBufferToBase64Url = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

const buildWebAuthnRequestOptions = (publicKey) => ({
  challenge: base64UrlToArrayBuffer(publicKey.challenge),
  timeout: publicKey.timeout,
  rpId: publicKey.rpId,
  userVerification: publicKey.userVerification,
  extensions: publicKey.extensions,
  allowCredentials: (publicKey.allowCredentials || []).map((cred) => ({
    id: base64UrlToArrayBuffer(cred.id),
    type: cred.type,
    transports: cred.transports,
  })),
});

const serializeWebAuthnAssertion = (credential) => ({
  id: credential.id,
  rawId: arrayBufferToBase64Url(credential.rawId),
  type: credential.type,
  response: {
    clientDataJSON: arrayBufferToBase64Url(credential.response.clientDataJSON),
    authenticatorData: arrayBufferToBase64Url(
      credential.response.authenticatorData
    ),
    signature: arrayBufferToBase64Url(credential.response.signature),
    userHandle: credential.response.userHandle
      ? arrayBufferToBase64Url(credential.response.userHandle)
      : null,
  },
});

// Prazo de segurança no próprio frontend: cobre os casos em que o
// backend nem chega a emitir um update (ex.: trava de sessão já em
// andamento, sessionStartLocks com TTL de 120s em
// StartWhatsAppSession.ts) — sem isso, o modal spinner fica girando
// pra sempre sem nenhum sinal de erro. 125s dá margem acima tanto do
// timeout de inicialização do backend (90s, wbot.ts) quanto da trava
// de concorrência (120s).
const HARD_TIMEOUT_MS = 125000;

const QrcodeModal = ({ open, onClose, whatsAppId }) => {
  const classes = useStyles();
  const [qrCode, setQrCode] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  const [errorMessage, setErrorMessage] = useState("");
  const [passkeyState, setPasskeyState] = useState("idle"); // idle | waiting | error
  const [retryTick, setRetryTick] = useState(0);
  const qrDeadlineRef = useRef(0);
  const lastQrCodeRef = useRef("");
  const sawActiveRef = useRef(false);
  const passkeyInFlightRef = useRef(false);
  const { user, socket } = useContext(AuthContext);

  const handlePasskeyRequest = useCallback(
    async (publicKey) => {
      if (!publicKey || passkeyInFlightRef.current) return;
      passkeyInFlightRef.current = true;
      setPasskeyState("waiting");

      try {
        if (!window.PublicKeyCredential) {
          throw new Error("WEBAUTHN_UNSUPPORTED");
        }

        const credential = await navigator.credentials.get({
          publicKey: buildWebAuthnRequestOptions(publicKey),
        });

        if (!credential) {
          throw new Error("WEBAUTHN_NO_CREDENTIAL");
        }

        await api.post(`/whatsappsession/${whatsAppId}/passkey`, {
          response: serializeWebAuthnAssertion(credential),
        });

        setPasskeyState("idle");
      } catch (err) {
        toastError(err);
        setPasskeyState("error");
      } finally {
        passkeyInFlightRef.current = false;
      }
    },
    [whatsAppId]
  );

  const applyIncomingQrCode = useCallback((nextQrCode) => {
    const normalized = String(nextQrCode || "").trim();
    if (!normalized) return;

    // Evita resetar o contador quando o backend reenvia o mesmo QR repetidamente.
    if (lastQrCodeRef.current === normalized) return;

    lastQrCodeRef.current = normalized;
    qrDeadlineRef.current = Date.now() + 60 * 1000;
    setQrCode(normalized);
    setTimeLeft(60);
    setErrorMessage("");
  }, []);

  // O backend volta pra "DISCONNECTED" tanto no início normal (antes de
  // tentar abrir a sessão) quanto quando a tentativa falha/expira (ex.:
  // ERR_WAPP_INIT_TIMEOUT em wbot.ts). Só tratamos como falha de verdade
  // se já vimos a sessão em "OPENING"/"qrcode" antes — senão um
  // DISCONNECTED inicial (corrida normal, sessão ainda nem começou a
  // tentar) ia disparar erro na cara do usuário sem motivo.
  const handleStatusUpdate = useCallback((status) => {
    const normalized = String(status || "").toUpperCase();
    if (normalized === "OPENING" || normalized === "QRCODE") {
      sawActiveRef.current = true;
      return;
    }
    if (normalized === "DISCONNECTED" && sawActiveRef.current) {
      setErrorMessage(
        "A sessão do WhatsApp caiu antes de conectar. Tente gerar o QR Code novamente."
      );
    }
  }, []);

  const handleRetry = useCallback(async () => {
    if (!whatsAppId) return;
    setErrorMessage("");
    setQrCode("");
    setTimeLeft(60);
    sawActiveRef.current = false;
    lastQrCodeRef.current = "";
    qrDeadlineRef.current = 0;
    setRetryTick((tick) => tick + 1);
    try {
      await api.put(`/whatsappsession/${whatsAppId}`);
    } catch (err) {
      toastError(err);
    }
  }, [whatsAppId]);

  useEffect(() => {
    if (!open || !whatsAppId) return;

    setErrorMessage("");
    setQrCode("");
    setTimeLeft(60);
    sawActiveRef.current = false;
    lastQrCodeRef.current = "";
    qrDeadlineRef.current = 0;

    const hardTimeout = setTimeout(() => {
      if (!lastQrCodeRef.current) {
        setErrorMessage(
          "Não foi possível gerar o QR Code a tempo. Tente novamente."
        );
      }
    }, HARD_TIMEOUT_MS);

    return () => clearTimeout(hardTimeout);
  }, [open, whatsAppId, retryTick]);

  useEffect(() => {
    if (!open || !whatsAppId) return;

    let mounted = true;
    const fetchSession = async () => {
      try {
        const { data } = await api.get(`/whatsapp/${whatsAppId}`);
        if (!mounted) return;

        const status = String(data?.status || "").toUpperCase();
        if (status === "CONNECTED") {
          onClose();
          return;
        }

        if (data?.qrcode) applyIncomingQrCode(data.qrcode);
        handleStatusUpdate(status);
      } catch (err) {
        toastError(err);
      }
    };

    fetchSession();
    const timer = setInterval(async () => {
      await fetchSession();
    }, 3000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [open, whatsAppId, onClose, applyIncomingQrCode, handleStatusUpdate, retryTick]);

  useEffect(() => {
    if (!qrCode) return;

    if (!qrDeadlineRef.current) {
      qrDeadlineRef.current = Date.now() + 60 * 1000;
    }

    const timer = setInterval(() => {
      setTimeLeft((prevTime) => {
        const secondsLeft = Math.max(
          0,
          Math.ceil((qrDeadlineRef.current - Date.now()) / 1000)
        );

        if (secondsLeft <= 0) {
          clearInterval(timer);
          return 0;
        }

        return secondsLeft;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [qrCode]);

  useEffect(() => {
    if (!whatsAppId) return;
    const companyId = user.companyId;

    const onWhatsappData = (data) => {
      if (data.action !== "update" || !data?.session?.id) {
        return;
      }

      const sameSession =
        Number(data.session.id) === Number(whatsAppId) ||
        String(data.session.id) === String(whatsAppId);

      if (!sameSession) {
        return;
      }

      if (data.session.qrcode) {
        applyIncomingQrCode(data.session.qrcode);
      }

      const status = String(data.session.status || "").toUpperCase();
      if (status === "CONNECTED") {
        onClose();
        return;
      }

      handleStatusUpdate(status);
    };

    socket.on(`company-${companyId}-whatsappSession`, onWhatsappData);

    return () => {
      socket.off(`company-${companyId}-whatsappSession`, onWhatsappData);
    };
  }, [
    whatsAppId,
    onClose,
    user.companyId,
    socket,
    applyIncomingQrCode,
    handleStatusUpdate
  ]);

  useEffect(() => {
    if (!whatsAppId) return;
    const companyId = user.companyId;

    const onPasskeyRequest = (data) => {
      const sameSession =
        Number(data?.whatsappId) === Number(whatsAppId) ||
        String(data?.whatsappId) === String(whatsAppId);

      if (!sameSession || !data?.publicKey) return;

      handlePasskeyRequest(data.publicKey);
    };

    socket.on(`company-${companyId}-whatsappSessionPasskey`, onPasskeyRequest);

    return () => {
      socket.off(`company-${companyId}-whatsappSessionPasskey`, onPasskeyRequest);
    };
  }, [whatsAppId, user.companyId, socket, handlePasskeyRequest]);

  const instructions = [
    {
      icon: <Smartphone />,
      text: "Abra o WhatsApp no seu celular",
    },
    {
      icon: <MoreVert />,
      text: "Toque em Mais opções no Android ou em Configurações no iPhone",
    },
    {
      icon: <Link />,
      text: "Toque em Dispositivos conectados e depois em Conectar dispositivos",
    },
    {
      icon: <CameraAlt />,
      text:
        "Aponte a câmera do celular para esta tela para escanear o QR Code",
    },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        className: classes.dialogPaper,
      }}
    >
      <DialogContent style={{ padding: 0 }}>
        <Paper className={classes.contentPaper}>
          <div className={classes.root}>
            <Typography className={classes.brand}>
              {/* você pode colocar o nome do sistema aqui, se quiser */}
            </Typography>
            <Typography className={classes.title}>
              Conectar WhatsApp
            </Typography>
            <Typography className={classes.subtitle}>
              Escaneie o QR Code para vincular sua conta do WhatsApp
            </Typography>

            {errorMessage ? (
              <div className={classes.loadingContainer}>
                <Typography variant="body1" color="error" align="center">
                  {errorMessage}
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleRetry}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : qrCode ? (
              <>
                <div className={classes.qrContainer}>
                  {String(qrCode).startsWith("data:image/") ? (
                    <img
                      src={qrCode}
                      alt="QR Code"
                      width={280}
                      height={280}
                      className={classes.qrCode}
                    />
                  ) : (
                    <QRCode
                      value={qrCode}
                      size={280}
                      className={classes.qrCode}
                      fgColor="#2d3748"
                      bgColor="#ffffff"
                      level="H"
                    />
                  )}
                </div>

                <div className={classes.timer}>Atualiza em: {timeLeft}s</div>

                {passkeyState === "waiting" && (
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    style={{ gap: 8, marginTop: 16 }}
                  >
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="textSecondary">
                      Confirme a vinculação usando sua chave de acesso (passkey)
                    </Typography>
                  </Box>
                )}

                {passkeyState === "error" && (
                  <Typography
                    variant="body2"
                    color="error"
                    style={{ marginTop: 16 }}
                  >
                    Não foi possível confirmar a chave de acesso. Escaneie o QR
                    Code novamente para tentar de novo.
                  </Typography>
                )}

                <div className={classes.instructions}>
                  <Typography
                    variant="subtitle2"
                    color="textSecondary"
                    gutterBottom
                  >
                    Como conectar:
                  </Typography>
                  <List className={classes.instructionList} dense>
                    {instructions.map((instruction, index) => (
                      <ListItem key={index} className={classes.listItem}>
                        <ListItemIcon className={classes.listIcon}>
                          {instruction.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={instruction.text}
                          primaryTypographyProps={{ variant: "body2" }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </div>

                <Typography
                  variant="caption"
                  color="textSecondary"
                  style={{ marginTop: 16 }}
                >
                  O QR Code atualiza automaticamente a cada 60 segundos
                </Typography>
              </>
            ) : (
              <div className={classes.loadingContainer}>
                <CircularProgress
                  size={40}
                  style={{ color: "#667eea" }}
                />
                <Typography variant="body1" color="textSecondary">
                  Aguardando pelo QR Code...
                </Typography>
              </div>
            )}
          </div>
        </Paper>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(QrcodeModal);
