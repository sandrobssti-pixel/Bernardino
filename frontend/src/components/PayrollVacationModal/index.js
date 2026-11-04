import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Grid,
  Box,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  CircularProgress,
} from "@material-ui/core";
import { DeleteOutline } from "@material-ui/icons";
import usePayroll from "../../hooks/usePayroll";
import toastError from "../../errors/toastError";
import formatToCurrency from "../../utils/formatToCurrency";
import { isCltOrApprentice } from "../../pages/Employees/employeeConfig";

// Férias Gozadas (RH) — UM registro por período aquisitivo, sem
// fracionamento nesta versão (um único gozo cobre o período inteiro:
// dias gozados + dias vendidos somam sempre os 30 dias de direito
// assumidos — o sistema não rastreia faltas injustificadas). Ver
// PayrollVacationService.ts e docs/MANUAL_TECNICO.md.
const emptyForm = { periodNumber: "", vacationStartDate: "", daysSold: "0" };

const PayrollVacationModal = ({ open, onClose, employee }) => {
  const payroll = usePayroll();
  const [records, setRecords] = useState([]);
  const [nextPendingPeriod, setNextPendingPeriod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [calculating, setCalculating] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const eligible = employee ? isCltOrApprentice({ workRegime: employee.workRegime }) : false;

  const fetchData = async () => {
    if (!employee?.id) return;
    setLoading(true);
    try {
      const data = await payroll.vacations.showByEmployee(employee.id);
      setRecords(data.records || []);
      setNextPendingPeriod(data.nextPendingPeriod);
      setForm((f) => ({ ...f, periodNumber: data.nextPendingPeriod ? String(data.nextPendingPeriod) : "" }));
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee?.id]);

  const handleClose = () => {
    setForm(emptyForm);
    setRecords([]);
    setNextPendingPeriod(null);
    onClose();
  };

  const handleCalculate = async () => {
    if (!form.periodNumber) {
      toast.warn("Informe o número do período aquisitivo.");
      return;
    }
    if (!form.vacationStartDate) {
      toast.warn("Informe a data de início das férias.");
      return;
    }
    setCalculating(true);
    try {
      await payroll.vacations.calculate({
        employeeId: employee.id,
        periodNumber: Number(form.periodNumber),
        vacationStartDate: form.vacationStartDate,
        daysSold: form.daysSold === "" ? 0 : Number(form.daysSold),
      });
      toast.success("Férias calculadas.");
      setForm((f) => ({ ...f, vacationStartDate: "", daysSold: "0" }));
      fetchData();
    } catch (err) {
      toastError(err);
    } finally {
      setCalculating(false);
    }
  };

  const handleRemove = async (id) => {
    setRemovingId(id);
    try {
      await payroll.vacations.remove(id);
      toast.success("Período de férias removido.");
      fetchData();
    } catch (err) {
      toastError(err);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Férias — {employee?.name}</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <CircularProgress size={24} />
        ) : !eligible ? (
          <Typography variant="body2" color="error">
            Férias só se aplica a CLT e Menor Aprendiz.
          </Typography>
        ) : (
          <>
            <Typography variant="caption" color="textSecondary" paragraph>
              Calcula o salário dos dias gozados + 1/3 constitucional (sofrem INSS/IRRF, diferente da férias
              indenizada na rescisão) e o abono pecuniário de dias vendidos, se houver (até 10 dias — o sistema
              assume sempre 30 dias de direito, sem rastrear faltas). Um único registro por período aquisitivo.
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={4}>
                <TextField
                  label="Período nº"
                  type="number"
                  value={form.periodNumber}
                  onChange={(e) => setForm((f) => ({ ...f, periodNumber: e.target.value }))}
                  variant="outlined"
                  size="small"
                  fullWidth
                />
              </Grid>
              <Grid item xs={5}>
                <TextField
                  label="Início das férias"
                  type="date"
                  value={form.vacationStartDate}
                  onChange={(e) => setForm((f) => ({ ...f, vacationStartDate: e.target.value }))}
                  variant="outlined"
                  size="small"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={3}>
                <TextField
                  label="Abono (dias)"
                  type="number"
                  value={form.daysSold}
                  onChange={(e) => setForm((f) => ({ ...f, daysSold: e.target.value }))}
                  variant="outlined"
                  size="small"
                  fullWidth
                  inputProps={{ min: 0, max: 10 }}
                />
              </Grid>
            </Grid>

            {nextPendingPeriod === null && records.length === 0 && (
              <Typography variant="caption" color="textSecondary" style={{ display: "block", marginTop: 8 }}>
                Nenhum período aquisitivo completo ainda (precisa de 12 meses de admissão).
              </Typography>
            )}

            <Box mt={2}>
              <Button variant="contained" color="primary" onClick={handleCalculate} disabled={calculating}>
                {calculating ? <CircularProgress size={20} /> : "Calcular férias"}
              </Button>
            </Box>

            <Box mt={3}>
              <Divider />
              <Typography variant="subtitle2" style={{ marginTop: 16 }} gutterBottom>
                Histórico
              </Typography>
              {records.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  Nenhum período de férias calculado ainda.
                </Typography>
              ) : (
                <List dense>
                  {records.map((r) => (
                    <ListItem key={r.id} divider>
                      <ListItemText
                        primary={`${r.periodNumber}º período (${r.periodStart} a ${r.periodEnd}) — ${formatToCurrency(
                          r.netValue
                        )}`}
                        secondary={`Gozo: ${r.vacationStartDate} a ${r.vacationEndDate} (${r.daysTaken} dias)${
                          r.daysSold > 0 ? ` · Abono: ${r.daysSold} dia(s) vendido(s)` : ""
                        }`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton size="small" onClick={() => handleRemove(r.id)} disabled={removingId === r.id}>
                          {removingId === r.id ? <CircularProgress size={16} /> : <DeleteOutline fontSize="small" />}
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PayrollVacationModal;
