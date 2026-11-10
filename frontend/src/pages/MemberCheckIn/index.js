import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import Webcam from "react-webcam";

import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import Avatar from "@material-ui/core/Avatar";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import ListItemText from "@material-ui/core/ListItemText";
import PersonIcon from "@material-ui/icons/Person";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import CancelIcon from "@material-ui/icons/Cancel";

import { AuthContext } from "../../context/Auth/AuthContext";
import useMembers from "../../hooks/useMembers";
import { computeFaceDescriptor } from "../../utils/faceRecognition";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    padding: theme.spacing(2),
    height: "calc(100% - 48px)",
    overflowY: "auto",
    ...theme.scrollbarStyles,
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
    },
  },
  content: {
    display: "flex",
    gap: theme.spacing(3),
    flexWrap: "wrap",
    maxWidth: 1100,
    margin: "0 auto",
  },
  webcamBox: {
    padding: theme.spacing(2),
    flex: "1 1 420px",
    textAlign: "center",
  },
  video: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 8,
  },
  resultBox: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(2),
    borderRadius: 8,
  },
  success: {
    backgroundColor: "#e8f5e9",
  },
  failure: {
    backgroundColor: "#ffebee",
  },
  historyBox: {
    padding: theme.spacing(2),
    flex: "1 1 320px",
  },
  lockedBox: {
    maxWidth: 480,
    margin: "0 auto",
    textAlign: "center",
    padding: theme.spacing(4),
  },
}));

// Controle de Acesso do Gerenciador CAC — Decreto nº 11.615/2023, art.
// 38, §5º, III (redação dada pelo Decreto nº 12.345/2024): entidades de
// tiro desportivo devem reportar a relação de quem frequentou, obtida
// por biometria/reconhecimento facial. Reconhecimento roda 100% no
// navegador (ver utils/faceRecognition.js) — a câmera nunca envia vídeo/
// imagem pro backend, só o descritor (128 números) no momento do
// check-in. Ver docs/MANUAL_TECNICO.md.
const MemberCheckIn = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const members = useMembers();
  const webcamRef = useRef(null);
  const [access, setAccess] = useState(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const status = await members.getAccess();
        setAccess(status);
      } catch (err) {
        setAccess({ planHasModule: false, hasAccess: false });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await members.listCheckIns({ pageNumber: 1 });
      setHistory(data.records || []);
    } catch (err) {
      // Lista de histórico é só informativa — uma falha aqui não deve
      // atrapalhar o fluxo de check-in em si.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (access?.hasAccess) fetchHistory();
  }, [access, fetchHistory]);

  const handleCheckIn = async () => {
    const video = webcamRef.current?.video;
    if (!video) return;

    setChecking(true);
    setResult(null);
    try {
      const descriptor = await computeFaceDescriptor(video);
      if (!descriptor) {
        setResult({ matched: false, reason: "no-face" });
      } else {
        const response = await members.checkIn(descriptor);
        setResult(response);
        if (response.matched) fetchHistory();
      }
    } catch (err) {
      toastError(err);
    }
    setChecking(false);
  };

  if (!user.super) {
    if (access === null) {
      return (
        <div className={classes.pageRoot}>
          <Box display="flex" justifyContent="center" my={6}>
            <CircularProgress />
          </Box>
        </div>
      );
    }

    if (!access.hasAccess) {
      return (
        <div className={classes.pageRoot}>
          <Box className={classes.lockedBox}>
            <Typography variant="h6" gutterBottom>
              Módulo Gerenciador CAC não disponível
            </Typography>
            <Typography variant="body2">
              {access.planHasModule
                ? "Peça para o administrador da sua empresa liberar seu acesso ao módulo Gerenciador CAC."
                : "Esse módulo é um add-on separado do plano contratado. Fale com o suporte para contratá-lo."}
            </Typography>
          </Box>
        </div>
      );
    }
  }

  return (
    <div className={classes.pageRoot}>
      <Typography variant="h5" gutterBottom align="center">
        Controle de Acesso — Check-in
      </Typography>
      <div className={classes.content}>
        <Paper className={classes.webcamBox}>
          <Webcam
            ref={webcamRef}
            audio={false}
            mirrored
            className={classes.video}
            videoConstraints={{ facingMode: "user" }}
          />
          <Box mt={2}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              disabled={checking}
              onClick={handleCheckIn}
            >
              {checking ? "Verificando..." : "Registrar presença"}
            </Button>
          </Box>
          {result && (
            <Box
              className={`${classes.resultBox} ${
                result.matched ? classes.success : classes.failure
              }`}
            >
              {result.matched ? (
                <Box display="flex" alignItems="center" justifyContent="center" gridGap={8}>
                  <CheckCircleIcon style={{ color: "#2e7d32" }} />
                  <Typography variant="h6">
                    Bem-vindo(a), {result.member.name}!
                  </Typography>
                </Box>
              ) : (
                <Box display="flex" alignItems="center" justifyContent="center" gridGap={8}>
                  <CancelIcon style={{ color: "#c62828" }} />
                  <Typography variant="body1">
                    {result.reason === "no-face"
                      ? "Nenhum rosto detectado — posicione o rosto na câmera e tente de novo."
                      : "Rosto não reconhecido. Procure a secretaria do clube."}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Paper>

        <Paper className={classes.historyBox}>
          <Typography variant="subtitle1" gutterBottom>
            Últimas presenças
          </Typography>
          <List dense>
            {history.length === 0 && (
              <Typography variant="body2" color="textSecondary">
                Nenhum check-in registrado ainda.
              </Typography>
            )}
            {history.map((checkIn) => (
              <ListItem key={checkIn.id}>
                <ListItemAvatar>
                  <Avatar src={checkIn.member?.photoUrl || undefined}>
                    {!checkIn.member?.photoUrl && <PersonIcon />}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={checkIn.member?.name}
                  secondary={new Date(checkIn.checkedInAt).toLocaleString("pt-BR")}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      </div>
    </div>
  );
};

export default MemberCheckIn;
