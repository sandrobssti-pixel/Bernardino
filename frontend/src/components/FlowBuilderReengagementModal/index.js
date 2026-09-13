import React, { useEffect, useState } from "react";

import { toast } from "react-toastify";
import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import AddIcon from "@material-ui/icons/Add";
import { Stack, Switch, Divider } from "@mui/material";
import { styled } from "@mui/material/styles";

// Toggle no estilo iOS (recipe oficial do MUI), reaproveitando o Switch já
// usado no resto do projeto, só com a aparência trocada.
const IOSSwitch = styled((props) => (
  <Switch disableRipple {...props} />
))(() => ({
  width: 38,
  height: 22,
  padding: 0,
  "& .MuiSwitch-switchBase": {
    padding: 2,
    "&.Mui-checked": {
      transform: "translateX(16px)",
      color: "#fff",
      "& + .MuiSwitch-track": {
        backgroundColor: "#34C759",
        opacity: 1,
        border: 0
      }
    }
  },
  "& .MuiSwitch-thumb": {
    boxSizing: "border-box",
    width: 18,
    height: 18,
    boxShadow: "0 1px 3px rgba(0,0,0,0.25)"
  },
  "& .MuiSwitch-track": {
    borderRadius: 22 / 2,
    backgroundColor: "#E5E5EA",
    opacity: 1
  }
}));

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
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },

  titleWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 1
  },

  title: {
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont",
    color: dark ? "#f1f5f9" : "#111827"
  },

  subtitle: {
    fontSize: 12,
    color: dark ? "rgba(226, 232, 240, 0.65)" : "#6B7280"
  },

  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    border: dark ? "1px solid rgba(148, 163, 184, 0.2)" : "1px solid rgba(17, 24, 39, 0.08)",
    background: dark ? "rgba(15, 23, 42, 0.5)" : undefined,
    color: dark ? "#e5e7eb" : undefined
  },

  dialogContent: {
    padding: 14,
    background: dark
      ? "linear-gradient(180deg, rgba(15,23,42,0.3) 0%, rgba(30,41,59,0.6) 55%)"
      : "linear-gradient(180deg, rgba(249,250,251,0.6) 0%, rgba(255,255,255,1) 100%)",
    "& .MuiOutlinedInput-root": {
      borderRadius: 10,
      backgroundColor: dark ? "rgba(15, 23, 42, 0.4)" : "#fff",
      color: dark ? "#f1f5f9" : undefined
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: dark ? "rgba(148, 163, 184, 0.24)" : undefined
    },
    "& .MuiOutlinedInput-input": {
      padding: "10px 12px"
    }
  },

  dialogActions: {
    padding: "10px 16px",
    borderTop: dark ? "1px solid rgba(148, 163, 184, 0.16)" : "1px solid rgba(17, 24, 39, 0.06)",
    gap: 8,
    background: dark ? "rgba(15, 23, 42, 0.4)" : undefined
  },

  primaryButton: {
    borderRadius: 10,
    textTransform: "none",
    boxShadow: "0 6px 18px rgba(59, 130, 246, 0.25)"
  },

  secondaryButton: {
    borderRadius: 10,
    textTransform: "none"
  },

  toggleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },

  toggleRow_text: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    minWidth: 0
  },

  toggleRow_label: {
    fontSize: 13,
    fontWeight: 600,
    color: dark ? "#f1f5f9" : "#111827"
  },

  toggleRow_desc: {
    fontSize: 11,
    color: dark ? "rgba(226, 232, 240, 0.65)" : "#6B7280"
  },

  stepCard: {
    border: dark ? "1px solid rgba(148, 163, 184, 0.16)" : "1px solid rgba(17, 24, 39, 0.08)",
    background: dark ? "rgba(15, 23, 42, 0.35)" : undefined,
    borderRadius: 10,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    position: "relative"
  },

  stepHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },

  stepHeaderLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: dark ? "#f1f5f9" : "#111827"
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: dark ? "rgba(226, 232, 240, 0.75)" : "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.3
  }
  };
});

// O backend (FlowReengagementSettings.ts) só entende minutos. As unidades
// (minutos/horas/dias) existem só aqui na tela, para facilitar o preenchimento
// — convertidas na hora de salvar/carregar.
const UNIT_TO_MINUTES = { minutes: 1, hours: 60, days: 60 * 24 };

const UNIT_OPTIONS = [
  { value: "minutes", label: "Minutos" },
  { value: "hours", label: "Horas" },
  { value: "days", label: "Dias" }
];

const minutesToDisplay = totalMinutes => {
  const m = Number(totalMinutes) || 0;
  if (m > 0 && m % UNIT_TO_MINUTES.days === 0) {
    return { value: m / UNIT_TO_MINUTES.days, unit: "days" };
  }
  if (m > 0 && m % UNIT_TO_MINUTES.hours === 0) {
    return { value: m / UNIT_TO_MINUTES.hours, unit: "hours" };
  }
  return { value: m, unit: "minutes" };
};

const displayToMinutes = (value, unit) =>
  (Number(value) || 0) * (UNIT_TO_MINUTES[unit] || 1);

const emptyStep = () => ({ value: 5, unit: "minutes", message: "" });

const TimeUnitField = ({ value, unit, onChangeValue, onChangeUnit, label = "Tempo" }) => (
  <Stack direction="row" spacing={1}>
    <TextField
      label={label}
      type="number"
      value={value}
      onChange={e => onChangeValue(e.target.value)}
      variant="outlined"
      margin="dense"
      inputProps={{ min: 1 }}
      style={{ maxWidth: 110 }}
    />
    <TextField
      select
      label="Unidade"
      value={unit}
      onChange={e => onChangeUnit(e.target.value)}
      variant="outlined"
      margin="dense"
      style={{ maxWidth: 130 }}
    >
      {UNIT_OPTIONS.map(option => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  </Stack>
);

const ToggleRow = ({ classes, label, description, checked, onChange }) => (
  <div className={classes.toggleRow}>
    <div className={classes.toggleRow_text}>
      <Typography className={classes.toggleRow_label}>{label}</Typography>
      {description && (
        <Typography className={classes.toggleRow_desc}>{description}</Typography>
      )}
    </div>
    <IOSSwitch checked={checked} onChange={onChange} />
  </div>
);

// Formato aceito/salvo em FlowBuilder.flow.settings.reengagement, espelhando
// backend/src/helpers/FlowReengagementSettings.ts.
const FlowBuilderReengagementModal = ({ open, settings, onClose, onSave }) => {
  const classes = useStyles();

  const [enabled, setEnabled] = useState(false);
  const [steps, setSteps] = useState([emptyStep()]);
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(false);
  const [autoCloseValue, setAutoCloseValue] = useState(30);
  const [autoCloseUnit, setAutoCloseUnit] = useState("minutes");

  useEffect(() => {
    if (!open) return;
    setEnabled(Boolean(settings?.enabled));
    setSteps(
      settings?.steps?.length
        ? settings.steps.map(step => ({
            ...minutesToDisplay(step.minutes),
            message: step.message || ""
          }))
        : [emptyStep()]
    );
    setAutoCloseEnabled(Boolean(settings?.autoClose?.enabled));
    const autoCloseDisplay = minutesToDisplay(settings?.autoClose?.minutes || 30);
    setAutoCloseValue(autoCloseDisplay.value);
    setAutoCloseUnit(autoCloseDisplay.unit);
  }, [open, settings]);

  const handleClose = () => {
    onClose();
  };

  const handleAddStep = () => {
    setSteps(old => [...old, emptyStep()]);
  };

  const handleRemoveStep = index => {
    setSteps(old => old.filter((_, i) => i !== index));
  };

  const handleStepChange = (index, field, value) => {
    setSteps(old =>
      old.map((step, i) => (i === index ? { ...step, [field]: value } : step))
    );
  };

  const handleSave = () => {
    if (enabled) {
      if (!steps.length) {
        return toast.error("Adicione ao menos uma mensagem de follow-up");
      }
      for (const step of steps) {
        if (displayToMinutes(step.value, step.unit) < 1) {
          return toast.error("Informe um tempo de espera válido em todos os passos");
        }
        if (!String(step.message || "").trim()) {
          return toast.error("Preencha o texto da mensagem em todos os passos");
        }
      }
      if (autoCloseEnabled && displayToMinutes(autoCloseValue, autoCloseUnit) < 1) {
        return toast.error("Informe um tempo válido para o fechamento automático");
      }
    }

    onSave({
      reengagement: {
        enabled,
        steps: steps.map(step => ({
          minutes: displayToMinutes(step.value, step.unit),
          message: String(step.message || "").trim()
        })),
        autoClose: {
          enabled: autoCloseEnabled,
          minutes: displayToMinutes(autoCloseValue, autoCloseUnit)
        }
      }
    });
    handleClose();
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="sm"
        scroll="paper"
        classes={{ paper: classes.dialogPaper }}
      >
        <DialogTitle className={classes.dialogTitle}>
          <div className={classes.titleWrapper}>
            <Typography className={classes.title}>Follow-up automático</Typography>
            <Typography className={classes.subtitle}>
              Lembretes quando o contato parar de responder no fluxo
            </Typography>
          </div>

          <IconButton onClick={handleClose} className={classes.closeButton} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent className={classes.dialogContent} dividers>
          <Stack spacing={1.5}>
            <ToggleRow
              classes={classes}
              label="Ativar follow-up"
              description="Só atua quando o contato para em uma pergunta ou menu do fluxo"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
            />

            <Divider />

            <Typography className={classes.sectionLabel}>Sequência de mensagens</Typography>

            {steps.map((step, index) => (
              <div className={classes.stepCard} key={index}>
                <div className={classes.stepHeader}>
                  <Typography className={classes.stepHeaderLabel}>
                    Passo {index + 1}
                  </Typography>
                  {steps.length > 1 && (
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveStep(index)}
                      aria-label="Remover passo"
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  )}
                </div>
                <TimeUnitField
                  label="Esperar"
                  value={step.value}
                  unit={step.unit}
                  onChangeValue={v => handleStepChange(index, "value", v)}
                  onChangeUnit={v => handleStepChange(index, "unit", v)}
                />
                <TextField
                  label="Mensagem"
                  value={step.message}
                  onChange={e => handleStepChange(index, "message", e.target.value)}
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  multiline
                  minRows={2}
                  placeholder="Ex: Ainda está por aí? 😊"
                />
              </div>
            ))}

            <Button
              onClick={handleAddStep}
              startIcon={<AddIcon />}
              className={classes.secondaryButton}
              variant="outlined"
              size="small"
              style={{ alignSelf: "flex-start" }}
            >
              Adicionar passo
            </Button>

            <Divider />

            <Typography className={classes.sectionLabel}>Fechamento automático</Typography>

            <ToggleRow
              classes={classes}
              label="Encerrar ticket automaticamente"
              description="Se o contato continuar sem responder após o último passo"
              checked={autoCloseEnabled}
              onChange={e => setAutoCloseEnabled(e.target.checked)}
            />

            {autoCloseEnabled && (
              <>
                <TimeUnitField
                  label="Esperar"
                  value={autoCloseValue}
                  unit={autoCloseUnit}
                  onChangeValue={setAutoCloseValue}
                  onChangeUnit={setAutoCloseUnit}
                />
                <Typography className={classes.toggleRow_desc}>
                  Contados a partir do último passo enviado
                </Typography>
              </>
            )}
          </Stack>
        </DialogContent>

        <DialogActions className={classes.dialogActions}>
          <Button onClick={handleClose} variant="outlined" className={classes.secondaryButton}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            color="primary"
            variant="contained"
            className={classes.primaryButton}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default FlowBuilderReengagementModal;
