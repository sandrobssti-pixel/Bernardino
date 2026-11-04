import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Typography,
  Grid,
  Box,
  Divider,
  CircularProgress,
} from "@material-ui/core";
import usePayroll from "../../hooks/usePayroll";
import toastError from "../../errors/toastError";
import formatToCurrency from "../../utils/formatToCurrency";
import { isCltOrApprentice } from "../../pages/Employees/employeeConfig";
import ConfirmationModal from "../ConfirmationModal";

// Rescisão de Contrato (RH) — UM registro por funcionário. Calcular
// também registra oficialmente o desligamento (atualiza
// Employee.terminationDate/contractStatus), por isso o botão passa por
// uma confirmação explícita. Ver PayrollTerminationService.ts e
// docs/MANUAL_TECNICO.md.
const TERMINATION_TYPE_OPTIONS = [
  { value: "dismissal_without_cause", label: "Dispensa sem justa causa" },
  { value: "resignation", label: "Pedido de demissão" },
  { value: "dismissal_with_cause", label: "Dispensa por justa causa" },
  { value: "mutual_agreement", label: "Rescisão por acordo (art. 484-A)" },
];

const emptyForm = {
  terminationType: "dismissal_without_cause",
  terminationDate: "",
  noticeWorked: false,
  fgtsBalanceOverride: "",
};

const PayrollTerminationModal = ({ open, onClose, employee, onChanged }) => {
  const payroll = usePayroll();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [calculating, setCalculating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const eligible = employee ? isCltOrApprentice({ workRegime: employee.workRegime }) : false;

  const fetchRecord = async () => {
    if (!employee?.id) return;
    setLoading(true);
    try {
      const data = await payroll.termination.show(employee.id);
      setRecord(data || null);
      if (data) {
        setForm({
          terminationType: data.terminationType,
          terminationDate: String(data.terminationDate).slice(0, 10),
          noticeWorked: !!data.noticeWorked,
          fgtsBalanceOverride: data.fgtsBalanceUsed != null ? String(data.fgtsBalanceUsed) : "",
        });
      } else {
        setForm({ ...emptyForm, terminationDate: employee.terminationDate ? String(employee.terminationDate).slice(0, 10) : "" });
      }
    } catch (err) {
      setRecord(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee?.id]);

  const handleClose = () => {
    setForm(emptyForm);
    setRecord(null);
    onClose();
  };

  const handleCalculate = async () => {
    if (!form.terminationDate) {
      toast.warn("Informe a data de desligamento.");
      return;
    }
    setCalculating(true);
    try {
      const data = await payroll.termination.calculate({
        employeeId: employee.id,
        terminationType: form.terminationType,
        terminationDate: form.terminationDate,
        noticeWorked: form.noticeWorked,
        fgtsBalanceOverride: form.fgtsBalanceOverride === "" ? undefined : Number(form.fgtsBalanceOverride),
      });
      setRecord(data);
      setForm((f) => ({ ...f, fgtsBalanceOverride: String(data.fgtsBalanceUsed) }));
      toast.success("Rescisão calculada. O funcionário foi marcado como Desligado.");
      onChanged?.();
    } catch (err) {
      toastError(err);
    } finally {
      setCalculating(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await payroll.termination.remove(record.id);
      setRecord(null);
      toast.success("Rescisão removida.");
      onChanged?.();
    } catch (err) {
      toastError(err);
    } finally {
      setRemoving(false);
      setRemoveConfirmOpen(false);
    }
  };

  const renderResult = () => {
    if (!record) return null;
    return (
      <Box mt={3}>
        <Divider />
        <Box mt={2}>
          <Typography variant="subtitle2" gutterBottom>
            Verbas rescisórias
          </Typography>
          <Grid container spacing={1}>
            <ResultRow
              label={`Saldo de salário (${record.balanceSalaryDays} dia(s))`}
              value={record.balanceSalaryGross}
              detail={`INSS ${formatToCurrency(record.balanceSalaryInss)} · IRRF ${formatToCurrency(record.balanceSalaryIrrf)}`}
            />
            <ResultRow
              label={`Aviso prévio (${record.noticeDays} dia(s)${form.noticeWorked ? ", trabalhado" : ", indenizado"})`}
              value={record.noticeValue}
            />
            <ResultRow
              label={`13º proporcional (${record.thirteenthMonthsWorked}/12)`}
              value={record.thirteenthGrossValue}
              detail={`INSS ${formatToCurrency(record.thirteenthInssValue)} · IRRF ${formatToCurrency(record.thirteenthIrrfValue)}`}
            />
            <ResultRow
              label={`Férias proporcionais + 1/3 (${record.vacationMonthsWorked}/12)`}
              value={Number(record.vacationGrossValue) + Number(record.vacationBonusValue)}
              detail={`Férias ${formatToCurrency(record.vacationGrossValue)} · 1/3 ${formatToCurrency(record.vacationBonusValue)}`}
            />
            <ResultRow
              label={`Multa do FGTS (${(Number(record.fgtsFineRate) * 100).toFixed(0)}% sobre ${formatToCurrency(record.fgtsBalanceUsed)})`}
              value={record.fgtsFineValue}
            />
          </Grid>
          <Box mt={1} display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1">Líquido total</Typography>
            <Typography variant="h6" color="primary">
              {formatToCurrency(record.netValue)}
            </Typography>
          </Box>
          <Typography variant="caption" color="textSecondary">
            Saldo de FGTS sugerido pelo sistema: {formatToCurrency(record.fgtsSystemCalculatedBalance)} — soma só o
            que o próprio sistema já calculou pra este funcionário (Folha Mensal + 13º), não o extrato oficial da
            Caixa. Ajuste o campo "Saldo de FGTS" abaixo se souber o valor real antes de recalcular.
          </Typography>
        </Box>
      </Box>
    );
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Rescisão de Contrato — {employee?.name}</DialogTitle>
        <DialogContent dividers>
          {loading ? (
            <CircularProgress size={24} />
          ) : !eligible ? (
            <Typography variant="body2" color="error">
              Rescisão só se aplica a CLT e Menor Aprendiz.
            </Typography>
          ) : (
            <>
              <Typography variant="caption" color="textSecondary" paragraph>
                Calcula saldo de salário, aviso prévio, 13º e férias proporcionais e a multa do FGTS. Calcular
                também registra oficialmente o desligamento do funcionário (data e status). Recalcular atualiza o
                mesmo registro, não duplica.
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={7}>
                  <FormControl variant="outlined" size="small" fullWidth>
                    <InputLabel>Tipo de rescisão</InputLabel>
                    <Select
                      value={form.terminationType}
                      onChange={(e) => setForm((f) => ({ ...f, terminationType: e.target.value }))}
                      label="Tipo de rescisão"
                    >
                      {TERMINATION_TYPE_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={5}>
                  <TextField
                    label="Data de desligamento"
                    type="date"
                    value={form.terminationDate}
                    onChange={(e) => setForm((f) => ({ ...f, terminationDate: e.target.value }))}
                    variant="outlined"
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={7}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.noticeWorked}
                        onChange={(e) => setForm((f) => ({ ...f, noticeWorked: e.target.checked }))}
                        color="primary"
                      />
                    }
                    label="Aviso prévio trabalhado"
                  />
                </Grid>
                <Grid item xs={12} sm={5}>
                  <TextField
                    label="Saldo de FGTS (editável)"
                    type="number"
                    value={form.fgtsBalanceOverride}
                    onChange={(e) => setForm((f) => ({ ...f, fgtsBalanceOverride: e.target.value }))}
                    variant="outlined"
                    size="small"
                    fullWidth
                    placeholder="Sugestão do sistema"
                  />
                </Grid>
              </Grid>

              <Box mt={2}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => setConfirmOpen(true)}
                  disabled={calculating}
                >
                  {calculating ? <CircularProgress size={20} /> : record ? "Recalcular rescisão" : "Calcular rescisão"}
                </Button>
                {record && (
                  <Button
                    style={{ marginLeft: 8 }}
                    color="secondary"
                    onClick={() => setRemoveConfirmOpen(true)}
                    disabled={removing}
                  >
                    Remover rescisão
                  </Button>
                )}
              </Box>

              {renderResult()}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <ConfirmationModal
        title="Calcular rescisão?"
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          handleCalculate();
        }}
      >
        Isso marca {employee?.name} como Desligado e grava a data informada como data de desligamento. Pode ser
        recalculado depois, mas o status do funcionário muda imediatamente.
      </ConfirmationModal>

      <ConfirmationModal
        title="Remover esta rescisão?"
        open={removeConfirmOpen}
        onClose={() => setRemoveConfirmOpen(false)}
        onConfirm={handleRemove}
      >
        Remove só o registro de verbas rescisórias. O funcionário continua marcado como Desligado (isso não é
        desfeito automaticamente) — ajuste o cadastro do funcionário à parte, se precisar reverter.
      </ConfirmationModal>
    </>
  );
};

const ResultRow = ({ label, value, detail }) => (
  <Grid item xs={12}>
    <Box display="flex" justifyContent="space-between">
      <Typography variant="body2">{label}</Typography>
      <Typography variant="body2">
        <strong>{formatToCurrency(value)}</strong>
      </Typography>
    </Box>
    {detail && (
      <Typography variant="caption" color="textSecondary">
        {detail}
      </Typography>
    )}
  </Grid>
);

export default PayrollTerminationModal;
