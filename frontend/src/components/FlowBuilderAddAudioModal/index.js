import React, { useState, useEffect, useRef } from "react";

import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import CircularProgress from "@material-ui/core/CircularProgress";
import CloseIcon from "@material-ui/icons/Close";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { Checkbox, Stack } from "@mui/material";

const useStyles = makeStyles(() => ({
  dialogPaper: {
    borderRadius: 14,
    border: "1px solid rgba(17, 24, 39, 0.08)",
    boxShadow: "0 18px 60px rgba(16, 24, 40, 0.18)",
    overflow: "hidden"
  },

  dialogTitle: {
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },

  titleWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 2
  },

  title: {
    fontSize: 16,
    fontWeight: 600,
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont",
    color: "#111827"
  },

  subtitle: {
    fontSize: 12.5,
    color: "#6B7280"
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid rgba(17, 24, 39, 0.08)"
  },

  dialogContent: {
    padding: 20,
    background:
      "linear-gradient(180deg, rgba(249,250,251,0.6) 0%, rgba(255,255,255,1) 100%)"
  },

  dialogActions: {
    padding: "14px 20px",
    borderTop: "1px solid rgba(17, 24, 39, 0.06)",
    gap: 10
  },

  primaryButton: {
    borderRadius: 12,
    textTransform: "none",
    boxShadow: "0 6px 18px rgba(59, 130, 246, 0.25)"
  },

  secondaryButton: {
    borderRadius: 12,
    textTransform: "none"
  },

  uploadButton: {
    borderRadius: 12,
    textTransform: "none",
    backgroundColor: "#ba8d1a",
    boxShadow: "none",
    color: "#fff"
  },

  buttonProgress: {
    color: green[500]
  }
}));

const FlowBuilderAddAudioModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState(false);
  const [preview, setPreview] = useState();
  const [labels, setLabels] = useState({
    title: "Adicionar audio ao fluxo",
    btn: "Adicionar"
  });
  const [medias, setMedias] = useState([]);

  useEffect(() => {
    if (open === "edit") {
      setLabels({ title: "Editar audio", btn: "Salvar" });
      setPreview(
        process.env.REACT_APP_BACKEND_URL + "/public/" + data.data.url
      );
      setRecord(data.data.record);
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({ title: "Adicionar audio ao fluxo", btn: "Adicionar" });
      setActiveModal(true);
    } else {
      setActiveModal(false);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  // ---------- FIX: lógica unificada de salvar ----------
  const uploadAudio = async formData => {
    const { data: res } = await api.post("/flowbuilder/audio", formData);
    return res.name;
  };

  const handleSaveContact = async () => {
    // EDIT
    if (open === "edit") {
      // se usuário anexou novo arquivo, faz upload
      if (medias.length > 0) {
        try {
          setLoading(true);
          const formData = new FormData();
          formData.append("fromMe", true);
          medias.forEach(media => formData.append("medias", media));
          const newUrl = await uploadAudio(formData);
          onUpdate({ ...data, data: { url: newUrl, record } });
          toast.success("Áudio alterado com sucesso!");
        } catch (err) {
          toastError(err);
        } finally {
          setLoading(false);
          handleClose();
        }
      } else {
        // sem novo arquivo → só metadados
        onUpdate({ ...data, data: { ...data.data, record } });
        handleClose();
      }
      return;
    }

    // CREATE (original + compress)
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("fromMe", true);
      medias.forEach(media => formData.append("medias", media));
      const newUrl = await uploadAudio(formData);
      onSave({ url: newUrl, record });
      toast.success("Audio adicionada com sucesso!");
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
      setMedias([]);
      setPreview();
      handleClose();
    }
  };
  // ---------- /FIX -------------------------------------

  const handleChangeMedias = e => {
    if (!e.target.files) return;
    if (e.target.files[0].size > 5000000) {
      toast.error("Arquivo é muito grande! 5MB máximo");
      return;
    }
    const selectedMedias = Array.from(e.target.files);
    setPreview(URL.createObjectURL(e.target.files[0]));
    setMedias(selectedMedias);
  };

  return (
    <Dialog
      open={activeModal}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      scroll="paper"
      classes={{ paper: classes.dialogPaper }}
    >
      <DialogTitle className={classes.dialogTitle}>
        <div className={classes.titleWrapper}>
          <Typography className={classes.title}>{labels.title}</Typography>
          <Typography className={classes.subtitle}>
            Configure o áudio que será enviado no fluxo
          </Typography>
        </div>

        <IconButton
          onClick={handleClose}
          className={classes.closeButton}
          size="small"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent className={classes.dialogContent} dividers>
        <Stack spacing={2}>
          {preview && (
            <Stack alignItems="center">
              <audio controls>
                <source src={preview} type="audio/mp3" />
                seu navegador não suporta HTML5
              </audio>
            </Stack>
          )}

          {preview && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <Checkbox
                checked={record}
                onChange={() => setRecord(old => !old)}
              />
              <Stack justifyContent="center">
                <Typography>Enviar como audio gravado na hora</Typography>
              </Stack>
            </Stack>
          )}

          {!loading && (
            <Button
              variant="contained"
              component="label"
              className={classes.uploadButton}
            >
              Enviar audio
              <input
                type="file"
                accept="audio/ogg, audio/mp3"
                hidden
                onChange={handleChangeMedias}
                disabled={loading}
              />
            </Button>
          )}

          {loading && (
            <Stack justifyContent="center" alignSelf="center">
              <CircularProgress className={classes.buttonProgress} />
            </Stack>
          )}
        </Stack>
      </DialogContent>

      <DialogActions className={classes.dialogActions}>
        {!loading && (
          <>
            <Button
              onClick={() => {
                handleClose();
                setMedias([]);
                setPreview();
              }}
              variant="outlined"
              className={classes.secondaryButton}
            >
              {i18n.t("contactModal.buttons.cancel")}
            </Button>
            <Button
              type="submit"
              color="primary"
              variant="contained"
              className={classes.primaryButton}
              disabled={loading}
              onClick={handleSaveContact}
            >
              {labels.btn}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default FlowBuilderAddAudioModal;
