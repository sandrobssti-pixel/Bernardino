import React, { useState, useEffect, useRef } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";

import { i18n } from "../../translate/i18n";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack
} from "@mui/material";

const useStyles = makeStyles(theme => {
  const dark = theme.palette.type === "dark";

  return {
  root: {
    display: "flex",
    flexWrap: "wrap"
  },

  dialogPaper: {
    borderRadius: 14,
    border: dark ? "1px solid rgba(148, 163, 184, 0.16)" : "1px solid rgba(17, 24, 39, 0.08)",
    boxShadow: dark ? "0 18px 60px rgba(0, 0, 0, 0.5)" : "0 18px 60px rgba(16, 24, 40, 0.18)",
    overflow: "hidden",
    background: dark ? "#1e293b" : undefined
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
    color: dark ? "#f1f5f9" : "#111827"
  },

  subtitle: {
    fontSize: 12.5,
    color: dark ? "rgba(226, 232, 240, 0.65)" : "#6B7280"
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: dark ? "1px solid rgba(148, 163, 184, 0.2)" : "1px solid rgba(17, 24, 39, 0.08)",
    background: dark ? "rgba(15, 23, 42, 0.5)" : undefined,
    color: dark ? "#e5e7eb" : undefined
  },

  dialogContent: {
    padding: 20,
    background: dark
      ? "linear-gradient(180deg, rgba(15,23,42,0.3) 0%, rgba(30,41,59,0.6) 55%)"
      : "linear-gradient(180deg, rgba(249,250,251,0.6) 0%, rgba(255,255,255,1) 100%)",

    "& .MuiOutlinedInput-root": {
      borderRadius: 12,
      backgroundColor: dark ? "rgba(15, 23, 42, 0.4)" : "#fff",
      color: dark ? "#f1f5f9" : undefined
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: dark ? "rgba(148, 163, 184, 0.24)" : undefined
    },
    "& .MuiInputLabel-root": {
      color: dark ? "rgba(226, 232, 240, 0.65)" : undefined
    }
  },

  dialogActions: {
    padding: "14px 20px",
    borderTop: dark ? "1px solid rgba(148, 163, 184, 0.16)" : "1px solid rgba(17, 24, 39, 0.06)",
    gap: 10
  },

  primaryButton: {
    borderRadius: 12,
    textTransform: "none"
  },

  secondaryButton: {
    borderRadius: 12,
    textTransform: "none"
  }
  };
});

const FlowBuilderConditionModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);
  const [rule, setRule] = useState();
  const [textDig, setTextDig] = useState();
  const [valueCondition, setValueCondition] = useState();

  const [labels, setLabels] = useState({
    title: "Adicionar condição ao fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    if (open === "edit") {
      setLabels({ title: "Editar condição", btn: "Salvar" });
      setTextDig(data.data.key);
      setRule(data.data.condition);
      setValueCondition(data.data.value);
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({ title: "Adicionar condição ao fluxo", btn: "Adicionar" });
      setTextDig();
      setRule();
      setValueCondition();
      setActiveModal(true);
    } else {
      setActiveModal(false);
    }
    return () => {
      isMounted.current = false;
    };
  }, [open, data]);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  const handleSaveContact = () => {
    if (open === "edit") {
      handleClose();
      onUpdate({
        ...data,
        data: { key: textDig, condition: rule, value: valueCondition }
      });
    } else if (open === "create") {
      handleClose();
      onSave({
        key: textDig,
        condition: rule,
        value: valueCondition
      });
    }
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={activeModal}
        onClose={handleClose}
        fullWidth
        maxWidth="md"
        scroll="paper"
        classes={{ paper: classes.dialogPaper }}
      >
        <DialogTitle className={classes.dialogTitle}>
          <div className={classes.titleWrapper}>
            <Typography className={classes.title}>{labels.title}</Typography>
            <Typography className={classes.subtitle}>
              Configure a lógica de condição
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
            <TextField
              label="Campo da condição"
              helperText="Digite apenas uma chave"
              variant="outlined"
              value={textDig || ""}
              onChange={e => setTextDig(e.target.value)}
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>Regra de validação</InputLabel>
              <Select
                value={rule || ""}
                label="Regra de validação"
                onChange={e => setRule(e.target.value)}
              >
                <MenuItem value={1}>==</MenuItem>
                <MenuItem value={2}>&gt;=</MenuItem>
                <MenuItem value={3}>&lt;=</MenuItem>
                <MenuItem value={4}>&lt;</MenuItem>
                <MenuItem value={5}>&gt;</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Valor da condição"
              variant="outlined"
              value={valueCondition || ""}
              onChange={e => setValueCondition(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>

        <DialogActions className={classes.dialogActions}>
          <Button
            onClick={handleClose}
            variant="outlined"
            className={classes.secondaryButton}
          >
            {i18n.t("contactModal.buttons.cancel")}
          </Button>
          <Button
            onClick={handleSaveContact}
            variant="contained"
            color="primary"
            className={classes.primaryButton}
          >
            {labels.btn}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default FlowBuilderConditionModal;
