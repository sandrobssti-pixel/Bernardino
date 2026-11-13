import React, { useState, useEffect, useRef, useCallback } from "react";
import { useHistory } from "react-router-dom";
import Webcam from "react-webcam";

import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";
import Box from "@material-ui/core/Box";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import Chip from "@material-ui/core/Chip";
import Divider from "@material-ui/core/Divider";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import RoomIcon from "@material-ui/icons/Room";
import PhotoCameraIcon from "@material-ui/icons/PhotoCamera";
import ExitToAppIcon from "@material-ui/icons/ExitToApp";

import useMemberPortal, { getMemberPortalMember, getMemberPortalToken } from "../../hooks/useMemberPortal";
import { computeFaceDescriptor } from "../../utils/faceRecognition";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  page: {
    minHeight: "100vh",
    backgroundColor: theme.palette.type === "light" ? "#f4f7fb" : theme.palette.background.default,
    padding: theme.spacing(3, 0),
  },
  paper: {
    padding: theme.spacing(3),
    borderRadius: 16,
  },
  stepBox: {
    padding: theme.spacing(2),
    borderRadius: 8,
    marginTop: theme.spacing(2),
  },
  video: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 8,
    margin: "0 auto",
    display: "block",
  },
  fileInput: {
    display: "none",
  },
  photoPreview: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 8,
    margin: "0 auto",
    display: "block",
  },
  successBox: {
    textAlign: "center",
    padding: theme.spacing(4),
  },
}));

// Portal do Associado — entrada de habitualidade: o próprio associado,
// pelo celular dele, anexa a foto do livro físico de presença (com a
// assinatura) + geolocalização no momento, mantendo também a biometria
// facial quando já cadastrada. O registro cai como MemberCheckIn com
// validationStatus "pending" — imutável a partir daqui (só o Admin do
// clube pode confirmar/rejeitar a validade pela localização, nunca o
// associado). Ver docs/MANUAL_TECNICO.md.
const MemberPortalCheckIn = () => {
  const classes = useStyles();
  const history = useHistory();
  const memberPortal = useMemberPortal();
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [member] = useState(() => getMemberPortalMember());
  const [logbookPhoto, setLogbookPhoto] = useState(null);
  const [logbookPhotoPreview, setLogbookPhotoPreview] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [locating, setLocating] = useState(false);
  const [descriptor, setDescriptor] = useState(null);
  const [capturingFace, setCapturingFace] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submittedRecord, setSubmittedRecord] = useState(null);

  useEffect(() => {
    if (!getMemberPortalToken() || !member) {
      history.replace("/portal/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogbookPhoto(file);
    setLogbookPhotoPreview(URL.createObjectURL(file));
  };

  const handleCaptureLocation = () => {
    setLocating(true);
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Seu navegador não suporta geolocalização.");
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setLocationError("Não foi possível obter sua localização — ative o GPS e permita o acesso.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleCaptureFace = useCallback(async () => {
    const video = webcamRef.current?.video;
    if (!video) return;
    setCapturingFace(true);
    try {
      const result = await computeFaceDescriptor(video);
      if (!result) {
        toastError("Nenhum rosto detectado — posicione o rosto na câmera e tente de novo.");
      } else {
        setDescriptor(result);
      }
    } catch (err) {
      toastError(err);
    }
    setCapturingFace(false);
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const record = await memberPortal.submitHabitualidade({
        logbookPhoto,
        latitude: location.latitude,
        longitude: location.longitude,
        descriptor: member?.faceEnrolled ? descriptor : undefined,
      });
      setSubmittedRecord(record);
      setDone(true);
    } catch (err) {
      toastError(err);
    }
    setSubmitting(false);
  };

  const handleLogout = () => {
    memberPortal.logout();
    history.replace("/portal/login");
  };

  if (!member) return null;

  if (done) {
    return (
      <div className={classes.page}>
        <Container maxWidth="sm">
          <Paper className={classes.paper}>
            <Box className={classes.successBox}>
              <CheckCircleIcon style={{ color: "#2e7d32", fontSize: 48 }} />
              <Typography variant="h6" gutterBottom>
                Registro enviado!
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {submittedRecord?.validationStatus === "valid"
                  ? "Sua entrada de habitualidade foi confirmada automaticamente — localização dentro do clube."
                  : "Sua entrada de habitualidade foi enviada e está aguardando a validação do administrador do clube."}
              </Typography>
              <Box mt={3}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setDone(false);
                    setSubmittedRecord(null);
                    setLogbookPhoto(null);
                    setLogbookPhotoPreview(null);
                    setLocation(null);
                    setDescriptor(null);
                  }}
                >
                  Enviar outro registro
                </Button>
              </Box>
            </Box>
          </Paper>
        </Container>
      </div>
    );
  }

  const canSubmit =
    !!logbookPhoto && !!location && (!member.faceEnrolled || !!descriptor);

  return (
    <div className={classes.page}>
      <Container maxWidth="sm">
        <Paper className={classes.paper}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6">Olá, {member.name}</Typography>
              <Typography variant="body2" color="textSecondary">
                Registrar entrada de habitualidade
              </Typography>
              <Typography variant="caption" color={member.filiationValidUntil ? "textSecondary" : "error"} style={{ display: "block", marginTop: 4 }}>
                {member.filiationValidUntil
                  ? `Filiação válida até ${new Date(`${member.filiationValidUntil}T00:00:00`).toLocaleDateString("pt-BR")}`
                  : "Filiação sem pagamento confirmado — procure a secretaria do clube."}
              </Typography>
            </Box>
            <Button size="small" startIcon={<ExitToAppIcon />} onClick={handleLogout}>
              Sair
            </Button>
          </Box>

          <Divider style={{ margin: "16px 0" }} />

          {member.faceEnrolled && (
            <Box className={classes.stepBox} bgcolor="action.hover">
              <Typography variant="subtitle2" gutterBottom>
                1. Reconhecimento facial
              </Typography>
              {!descriptor ? (
                <>
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    mirrored
                    className={classes.video}
                    videoConstraints={{ facingMode: "user" }}
                  />
                  <Box mt={1.5} textAlign="center">
                    <Button
                      variant="contained"
                      color="primary"
                      disabled={capturingFace}
                      onClick={handleCaptureFace}
                    >
                      {capturingFace ? "Capturando..." : "Capturar rosto"}
                    </Button>
                  </Box>
                </>
              ) : (
                <Chip
                  icon={<CheckCircleIcon />}
                  label="Rosto capturado"
                  color="primary"
                  onDelete={() => setDescriptor(null)}
                />
              )}
            </Box>
          )}

          <Box className={classes.stepBox} bgcolor="action.hover">
            <Typography variant="subtitle2" gutterBottom>
              {member.faceEnrolled ? "2." : "1."} Foto do livro de presença
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Envie a foto da página do livro com a sua assinatura.
            </Typography>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className={classes.fileInput}
              onChange={handlePhotoChange}
            />
            <Box mt={1.5} textAlign="center">
              {logbookPhotoPreview ? (
                <>
                  <img src={logbookPhotoPreview} alt="Foto do livro" className={classes.photoPreview} />
                  <Box mt={1}>
                    <Button size="small" onClick={() => fileInputRef.current?.click()}>
                      Trocar foto
                    </Button>
                  </Box>
                </>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<PhotoCameraIcon />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Tirar/escolher foto
                </Button>
              )}
            </Box>
          </Box>

          <Box className={classes.stepBox} bgcolor="action.hover">
            <Typography variant="subtitle2" gutterBottom>
              {member.faceEnrolled ? "3." : "2."} Localização
            </Typography>
            <Box mt={1} textAlign="center">
              {location ? (
                <Chip
                  icon={<RoomIcon />}
                  label={`Localização capturada (${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)})`}
                  color="primary"
                  onDelete={() => setLocation(null)}
                />
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<RoomIcon />}
                  disabled={locating}
                  onClick={handleCaptureLocation}
                >
                  {locating ? "Obtendo localização..." : "Capturar minha localização"}
                </Button>
              )}
              {locationError && (
                <Typography variant="caption" color="error" display="block" style={{ marginTop: 8 }}>
                  {locationError}
                </Typography>
              )}
            </Box>
          </Box>

          <Box mt={3} textAlign="center">
            <Button
              variant="contained"
              color="primary"
              size="large"
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
            >
              {submitting ? <CircularProgress size={24} /> : "Enviar registro"}
            </Button>
          </Box>
        </Paper>
      </Container>
    </div>
  );
};

export default MemberPortalCheckIn;
