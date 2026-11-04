import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  Box,
  Button,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Chip,
  CircularProgress,
  Tooltip,
} from "@material-ui/core";
import { Warning } from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import usePayroll from "../../hooks/usePayroll";
import toastError from "../../errors/toastError";
import formatToCurrency from "../../utils/formatToCurrency";
import { WORK_REGIME_OPTIONS } from "../../pages/Employees/employeeConfig";

const WORK_REGIME_LABELS = Object.fromEntries(WORK_REGIME_OPTIONS.map((o) => [o.value, o.label]));

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2),
  },
  toolbar: {
    display: "flex",
    gap: theme.spacing(2),
    alignItems: "center",
    marginBottom: theme.spacing(2),
    flexWrap: "wrap",
  },
  tablePaper: {
    overflowX: "auto",
  },
}));

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1];

// Folha de Pagamento (RH — Fase 2 de 3, ver docs/MANUAL_TECNICO.md) —
// cálculo de INSS/IRRF/FGTS/VT por competência (mês/ano), persistido
// (Folha Mensal). Botão manual "Calcular folha deste mês" — pedido
// explícito do cliente, sem geração automática/recorrente, pra manter
// revisão humana antes de qualquer obrigação financeira ser registrada
// (o lançamento em Contas a Pagar em si fica pra uma entrega futura).
const PayrollPanel = () => {
  const classes = useStyles();
  const payroll = usePayroll();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [skipped, setSkipped] = useState([]);

  const fetchEntries = async (m, y) => {
    setLoading(true);
    try {
      const data = await payroll.list({ competencyMonth: m, competencyYear: y });
      setEntries(data.records || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries(month, year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  const handleCalculateAll = async () => {
    setCalculating(true);
    setSkipped([]);
    try {
      const result = await payroll.calculateAll({ competencyMonth: month, competencyYear: year });
      setSkipped(result.skipped || []);
      toast.success(
        `Folha calculada: ${result.entries.length} funcionário(s)${
          result.skipped.length ? `, ${result.skipped.length} pulado(s)` : ""
        }.`
      );
      fetchEntries(month, year);
    } catch (err) {
      toastError(err);
    } finally {
      setCalculating(false);
    }
  };

  return (
    <Box className={classes.root}>
      <Typography variant="caption" color="textSecondary" paragraph>
        Calcula INSS, IRRF, FGTS e desconto de Vale Transporte (CLT e
        Menor Aprendiz) e o líquido do Estagiário (sem desconto) pra
        cada funcionário ativo. PJ não entra nesse cálculo. O resultado
        fica salvo por competência — recalcular o mesmo mês atualiza os
        valores, não duplica.
      </Typography>

      <Box className={classes.toolbar}>
        <FormControl variant="outlined" size="small" style={{ minWidth: 140 }}>
          <InputLabel>Mês</InputLabel>
          <Select value={month} onChange={(e) => setMonth(e.target.value)} label="Mês">
            {MONTHS.map((label, index) => (
              <MenuItem key={index + 1} value={index + 1}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl variant="outlined" size="small" style={{ minWidth: 100 }}>
          <InputLabel>Ano</InputLabel>
          <Select value={year} onChange={(e) => setYear(e.target.value)} label="Ano">
            {YEAR_OPTIONS.map((y) => (
              <MenuItem key={y} value={y}>
                {y}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          color="primary"
          onClick={handleCalculateAll}
          disabled={calculating}
        >
          {calculating ? <CircularProgress size={20} /> : "Calcular folha deste mês"}
        </Button>
      </Box>

      {skipped.length > 0 && (
        <Box mb={2}>
          <Typography variant="body2" color="error">
            {skipped.length} funcionário(s) não puderam ser calculados:
          </Typography>
          {skipped.map((s) => (
            <Chip
              key={s.employeeId}
              size="small"
              icon={<Warning fontSize="small" />}
              label={`${s.name}: ${s.reason}`}
              color="secondary"
              variant="outlined"
              style={{ margin: 4 }}
            />
          ))}
        </Box>
      )}

      <Paper className={classes.tablePaper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Funcionário</TableCell>
              <TableCell>Regime</TableCell>
              <TableCell align="right">Bruto</TableCell>
              <TableCell align="right">INSS</TableCell>
              <TableCell align="right">IRRF</TableCell>
              <TableCell align="right">Redução Lei 15.270</TableCell>
              <TableCell align="right">FGTS</TableCell>
              <TableCell align="right">Desc. VT</TableCell>
              <TableCell align="right">Líquido</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography variant="body2" color="textSecondary">
                    Nenhuma folha calculada pra essa competência ainda.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => {
                const missingSalary =
                  (entry.workRegimeSnapshot === "clt" || entry.workRegimeSnapshot === "young_apprentice") &&
                  !entry.grossSalarySnapshot;
                return (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {entry.employee?.name || "—"}
                      {missingSalary && (
                        <Tooltip title="Funcionário sem Salário Bruto cadastrado — valores zerados">
                          <Warning
                            fontSize="small"
                            color="error"
                            style={{ marginLeft: 6, verticalAlign: "middle" }}
                          />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>{WORK_REGIME_LABELS[entry.workRegimeSnapshot] || entry.workRegimeSnapshot}</TableCell>
                    <TableCell align="right">{formatToCurrency(entry.grossSalarySnapshot || 0)}</TableCell>
                    <TableCell align="right">{formatToCurrency(entry.inssValue || 0)}</TableCell>
                    <TableCell align="right">{formatToCurrency(entry.irrfValue || 0)}</TableCell>
                    <TableCell align="right">{formatToCurrency(entry.irrfReductionValue || 0)}</TableCell>
                    <TableCell align="right">{formatToCurrency(entry.fgtsValue || 0)}</TableCell>
                    <TableCell align="right">{formatToCurrency(entry.vtDiscount || 0)}</TableCell>
                    <TableCell align="right">
                      <strong>{formatToCurrency(entry.netSalary || 0)}</strong>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export default PayrollPanel;
