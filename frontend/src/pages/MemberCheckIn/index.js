import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import { useHistory } from "react-router-dom";
import Webcam from "react-webcam";
import { toast } from "react-toastify";

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
import RoomIcon from "@material-ui/icons/Room";
import ThumbUpIcon from "@material-ui/icons/ThumbUp";
import ThumbDownIcon from "@material-ui/icons/ThumbDown";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import Link from "@material-ui/core/Link";
import Divider from "@material-ui/core/Divider";

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
  pendingBox: {
    marginTop: theme.spacing(3),
    padding: theme.spacing(2),
    maxWidth: 1100,
    marginLeft: "auto",
    marginRight: "auto",
  },
  pendingItem: {
    display: "flex",
    gap: theme.spacing(2),
    alignItems: "flex-start",
    padding: theme.spacing(1.5, 0),
  },
  logbookThumb: {
    width: 90,
    height: 90,
    borderRadius: 8,
    objectFit: "cover",
    flexShrink: 0,
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
  const routerHistory = useHistory();
  const { user } = useContext(AuthContext);
  const members = useMembers();
  const webcamRef = useRef(null);
  const [access, setAccess] = useState(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [pending, setPending] = useState([]);
  const [validatingId, setValidatingId] = useState(null);

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

  // Fila de revisão — entradas de habitualidade enviadas pelo associado
  // pelo Portal (foto do livro + geolocalização), aguardando o Admin
  // confirmar se a localização bate com o endereço do clube. Nunca
  // mostra check-ins só de kiosk (sem foto do livro) — esses não são
  // "habitualidade", já ficam registrados sem precisar de validação.
  const fetchPending = useCallback(async () => {
    try {
      const data = await members.listPendingHabitualidade({ pageNumber: 1 });
      setPending(data.records || []);
    } catch (err) {
      // informativo, mesma lógica do fetchHistory acima
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (access?.hasAccess) {
      fetchHistory();
      fetchPending();
    }
  }, [access, fetchHistory, fetchPending]);

  const handleValidate = async (id, validationStatus) => {
    setValidatingId(id);
    try {
      await members.validateCheckIn(id, validationStatus);
      setPending((prev) => prev.filter((item) => item.id !== id));
      toast.success(
        validationStatus === "valid"
          ? "Entrada de habitualidade confirmada."
          : "Entrada de habitualidade rejeitada."
      );
    } catch (err) {
      toastError(err);
    }
    setValidatingId(null);
  };

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
            <Button
              size="small"
              startIcon={<ArrowBackIcon />}
              onClick={() => routerHistory.push("/members")}
            >
              Voltar para Gerenciador CAC
            </Button>
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
      <Box display="flex" justifyContent="center" mb={1}>
        <Button
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={() => routerHistory.push("/members")}
        >
          Voltar para Gerenciador CAC
        </Button>
      </Box>
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

      {pending.length > 0 && (
        <Paper className={classes.pendingBox}>
          <Typography variant="subtitle1" gutterBottom>
            Habitualidades pendentes de validação
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Confirme se a localização enviada pelo associado bate com o
            endereço do clube antes de aprovar.
          </Typography>
          <List>
            {pending.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <Divider component="li" />}
                <li className={classes.pendingItem} style={{ listStyle: "none" }}>
                  <img
                    src={item.logbookPhotoUrl}
                    alt="Foto do livro"
                    className={classes.logbookThumb}
                  />
                  <Box flex={1}>
                    <Typography variant="body1">{item.member?.name}</Typography>
                    <Typography variant="caption" color="textSecondary" display="block">
                      {new Date(item.checkedInAt).toLocaleString("pt-BR")}
                    </Typography>
                    {item.distanceMeters != null && (
                      <Typography variant="caption" style={{ color: "#c62828", display: "block" }}>
                        {`${Math.round(item.distanceMeters)}m do clube — fora do raio configurado`}
                      </Typography>
                    )}
                    {item.latitude != null && item.longitude != null && (
                      <Link
                        href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        <RoomIcon fontSize="small" />
                        Ver localização no mapa
                      </Link>
                    )}
                  </Box>
                  <Box display="flex" gridGap={8}>
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      startIcon={<ThumbUpIcon />}
                      disabled={validatingId === item.id}
                      onClick={() => handleValidate(item.id, "valid")}
                    >
                      Confirmar
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ThumbDownIcon />}
                      disabled={validatingId === item.id}
                      onClick={() => handleValidate(item.id, "invalid")}
                    >
                      Rejeitar
                    </Button>
                  </Box>
                </li>
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}
    </div>
  );
};

export default MemberCheckIn;
