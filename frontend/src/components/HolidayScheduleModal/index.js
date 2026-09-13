import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  makeStyles,
} from "@material-ui/core";
import ButtonWithSpinner from "../ButtonWithSpinner";

const useStyles = makeStyles((theme) => ({
  field: {
    width: "100%",
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
    },
  },
}));

const EMPTY_FORM = {
  id: "",
  date: "",
  message: "",
  scheduleMode: "closed",
  startTimeA: "",
  endTimeA: "",
  startTimeB: "",
  endTimeB: "",
};

const resolveFormFromInitialData = initialData => {
  if (!initialData) {
    return EMPTY_FORM;
  }

  const hasSecondPeriod = Boolean(initialData.startTimeB || initialData.endTimeB);

  return {
    id: initialData.id || "",
    date: initialData.date || "",
    message: initialData.message || "",
    scheduleMode:
      initialData.dayMode === "closed"
        ? "closed"
        : hasSecondPeriod
        ? "split"
        : "reduced",
    startTimeA: initialData.startTimeA || "",
    endTimeA: initialData.endTimeA || "",
    startTimeB: initialData.startTimeB || "",
    endTimeB: initialData.endTimeB || "",
  };
};

const HolidayScheduleModal = ({
  open,
  onClose,
  onSubmit,
  initialData,
  loading,
}) => {
  const classes = useStyles();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setForm(resolveFormFromInitialData(initialData));
    setErrors({});
  }, [initialData, open]);

  const title = useMemo(
    () => (initialData ? "Editar feriado" : "Adicionar feriado"),
    [initialData]
  );

  const handleChange = field => event => {
    setForm(prev => ({
      ...prev,
      [field]: event.target.value,
    }));
    setErrors(prev => ({
      ...prev,
      [field]: "",
    }));
  };

  const handleSave = () => {
    const nextErrors = {};

    if (!form.date) {
      nextErrors.date = "Informe a data do feriado.";
    }

    if (form.scheduleMode !== "closed") {
      if (!form.startTimeA || !form.endTimeA) {
        nextErrors.startTimeA = "Informe o primeiro período.";
      }
    }

    if (form.scheduleMode === "split") {
      if (!form.startTimeB || !form.endTimeB) {
        nextErrors.startTimeB = "Informe o segundo período.";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSubmit({
      id: form.id || `${Date.now()}`,
      date: form.date,
      message: form.message.trim(),
      dayMode: form.scheduleMode === "closed" ? "closed" : "hours",
      startTimeA: form.scheduleMode === "closed" ? "" : form.startTimeA,
      endTimeA: form.scheduleMode === "closed" ? "" : form.endTimeA,
      startTimeB: form.scheduleMode === "split" ? form.startTimeB : "",
      endTimeB: form.scheduleMode === "split" ? form.endTimeB : "",
    });
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              className={classes.field}
              label="Data do Feriado"
              type="date"
              variant="outlined"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={form.date}
              onChange={handleChange("date")}
              error={Boolean(errors.date)}
              helperText={errors.date}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              className={classes.field}
              label="Mensagem de Ausência"
              variant="outlined"
              size="small"
              multiline
              rows={3}
              value={form.message}
              onChange={handleChange("message")}
              placeholder="Mensagem enviada quando o feriado estiver fora de atendimento"
            />
          </Grid>

          <Grid item xs={12}>
            <FormControl variant="outlined" size="small" className={classes.field}>
              <InputLabel>Horário de Funcionamento</InputLabel>
              <Select
                value={form.scheduleMode}
                onChange={handleChange("scheduleMode")}
                label="Horário de Funcionamento"
              >
                <MenuItem value="closed">Fechado o dia todo</MenuItem>
                <MenuItem value="reduced">Horário Reduzido</MenuItem>
                <MenuItem value="split">Dois Períodos</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {form.scheduleMode !== "closed" && (
            <>
              <Grid item xs={12} sm={6}>
                <TextField
                  className={classes.field}
                  label="Abertura"
                  type="time"
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={form.startTimeA}
                  onChange={handleChange("startTimeA")}
                  error={Boolean(errors.startTimeA)}
                  helperText={errors.startTimeA}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  className={classes.field}
                  label="Fechamento"
                  type="time"
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={form.endTimeA}
                  onChange={handleChange("endTimeA")}
                />
              </Grid>
            </>
          )}

          {form.scheduleMode === "split" && (
            <>
              <Grid item xs={12} sm={6}>
                <TextField
                  className={classes.field}
                  label="Abertura da tarde"
                  type="time"
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={form.startTimeB}
                  onChange={handleChange("startTimeB")}
                  error={Boolean(errors.startTimeB)}
                  helperText={errors.startTimeB}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  className={classes.field}
                  label="Fechamento da tarde"
                  type="time"
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={form.endTimeB}
                  onChange={handleChange("endTimeB")}
                />
              </Grid>
            </>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <ButtonWithSpinner
          loading={loading}
          variant="contained"
          color="primary"
          onClick={handleSave}
        >
          Salvar
        </ButtonWithSpinner>
      </DialogActions>
    </Dialog>
  );
};

export default HolidayScheduleModal;
