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
import useFinance from "../../hooks/useFinance";
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
// revisão humana antes de qualquer obrigação financeira ser registrada.
// "Lançar em Contas a Pagar" — também manual, mesma filosofia — gera UMA
// conta consolidada por competência (líquido + FGTS de todos os
// funcionários, mais o líquido do pró-labore de todos os sócios), só
// visível se a empresa tiver o módulo Financeiro (add-on independente
// do RH). Pró-labore dos Sócios calculado numa seção separada abaixo —
// INSS de contribuinte individual (11% fixo), não a tabela de CLT.
// 13º Salário numa terceira seção, ANUAL (não mensal, seletor de ano
// próprio) — INSS/IRRF sobre o valor integral do 13º, separado do
// salário mensal (tributação exclusiva na fonte), só CLT/Menor
// Aprendiz.
const PayrollPanel = () => {
  const classes = useStyles();
  const payroll = usePayroll();
  const finance = useFinance();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [skipped, setSkipped] = useState([]);
  // Lançamento em Contas a Pagar (pedido do cliente desde a Fase 2) —
  // cruza com o módulo Financeiro, que é um add-on independente do RH
  // (uma empresa pode ter RH sem ter Financeiro contratado).
  const [financialAccess, setFinancialAccess] = useState(null);
  const [launchStatus, setLaunchStatus] = useState(null);
  const [launching, setLaunching] = useState(false);
  // Pró-labore dos Sócios — INSS de contribuinte individual (alíquota
  // fixa 11%) + IRRF pela mesma tabela de CLT. Tabela própria
  // (PayrollPartnerEntry), separada da Folha de Funcionários.
  const [partnerEntries, setPartnerEntries] = useState([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [calculatingPartners, setCalculatingPartners] = useState(false);
  const [skippedPartners, setSkippedPartners] = useState([]);
  // 13º Salário — ANUAL (não mensal, usa só o seletor de Ano acima,
  // independente do mês escolhido). Tabela própria (Payroll13thSalary).
  const [thirteenthYear, setThirteenthYear] = useState(currentYear);
  const [thirteenthEntries, setThirteenthEntries] = useState([]);
  const [loadingThirteenth, setLoadingThirteenth] = useState(false);
  const [calculatingThirteenth, setCalculatingThirteenth] = useState(false);
  const [skippedThirteenth, setSkippedThirteenth] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const access = await finance.getAccess();
        setFinancialAccess(access);
      } catch (err) {
        setFinancialAccess({ planHasModule: false, hasAccess: false });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const fetchLaunchStatus = async (m, y) => {
    try {
      const status = await payroll.expenseLaunch.show({ competencyMonth: m, competencyYear: y });
      setLaunchStatus(status);
    } catch (err) {
      setLaunchStatus(null);
    }
  };

  const fetchPartnerEntries = async (m, y) => {
    setLoadingPartners(true);
    try {
      const data = await payroll.partners.list({ competencyMonth: m, competencyYear: y });
      setPartnerEntries(data.records || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingPartners(false);
    }
  };

  useEffect(() => {
    fetchEntries(month, year);
    fetchPartnerEntries(month, year);
    if (financialAccess?.hasAccess) fetchLaunchStatus(month, year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, financialAccess]);

  const fetchThirteenthEntries = async (y) => {
    setLoadingThirteenth(true);
    try {
      const data = await payroll.thirteenthSalary.list({ year: y });
      setThirteenthEntries(data.records || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingThirteenth(false);
    }
  };

  useEffect(() => {
    fetchThirteenthEntries(thirteenthYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thirteenthYear]);

  const handleLaunchExpense = async () => {
    setLaunching(true);
    try {
      const status = await payroll.expenseLaunch.launch({ competencyMonth: month, competencyYear: year });
      setLaunchStatus(status);
      toast.success("Folha lançada em Contas a Pagar.");
    } catch (err) {
      toastError(err);
    } finally {
      setLaunching(false);
    }
  };

  const handleCalculatePartnersAll = async () => {
    setCalculatingPartners(true);
    setSkippedPartners([]);
    try {
      const result = await payroll.partners.calculateAll({ competencyMonth: month, competencyYear: year });
      setSkippedPartners(result.skipped || []);
      toast.success(
        `Pró-labore calculado: ${result.entries.length} sócio(s)${
          result.skipped.length ? `, ${result.skipped.length} pulado(s)` : ""
        }.`
      );
      fetchPartnerEntries(month, year);
    } catch (err) {
      toastError(err);
    } finally {
      setCalculatingPartners(false);
    }
  };

  const handleCalculateThirteenthAll = async () => {
    setCalculatingThirteenth(true);
    setSkippedThirteenth([]);
    try {
      const result = await payroll.thirteenthSalary.calculateAll({ year: thirteenthYear });
      setSkippedThirteenth(result.skipped || []);
      toast.success(
        `13º calculado: ${result.entries.length} funcionário(s)${
          result.skipped.length ? `, ${result.skipped.length} pulado(s)` : ""
        }.`
      );
      fetchThirteenthEntries(thirteenthYear);
    } catch (err) {
      toastError(err);
    } finally {
      setCalculatingThirteenth(false);
    }
  };

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
        {financialAccess?.hasAccess && (
          <Tooltip
            title={
              entries.length === 0 && partnerEntries.length === 0
                ? "Calcule a folha (ou o pró-labore dos sócios) deste mês antes de lançar em Contas a Pagar"
                : "Gera (ou resincroniza) UMA conta a pagar consolidada com o total de líquido + FGTS de funcionários e o líquido do pró-labore dos sócios desta competência"
            }
          >
            <span>
              <Button
                variant="outlined"
                color="primary"
                onClick={handleLaunchExpense}
                disabled={launching || (entries.length === 0 && partnerEntries.length === 0)}
              >
                {launching
                  ? <CircularProgress size={20} />
                  : launchStatus
                  ? "Resincronizar Contas a Pagar"
                  : "Lançar em Contas a Pagar"}
              </Button>
            </span>
          </Tooltip>
        )}
      </Box>

      {financialAccess?.hasAccess && launchStatus && (
        <Box mb={2}>
          <Chip
            size="small"
            label={`Já lançado em Contas a Pagar: ${formatToCurrency(launchStatus.totalValue)}${
              launchStatus.financeExpense?.status === "paid" ? " (pago)" : " (pendente)"
            }`}
            style={{ backgroundColor: "#10b981", color: "#fff" }}
          />
        </Box>
      )}

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

      <Box mt={4} mb={2}>
        <Typography variant="h6" gutterBottom>
          Pró-labore dos Sócios
        </Typography>
        <Typography variant="caption" color="textSecondary" paragraph>
          Calcula INSS (contribuinte individual, alíquota fixa de 11% —
          diferente da tabela progressiva de CLT) e IRRF (mesma tabela
          mensal de CLT) sobre o pró-labore de cada sócio ativo.
          Sócio não tem FGTS nem desconto de VT. O IRRF aqui não abate
          dedução por dependente (sócio não tem cadastro de
          dependentes) — fica um pouco acima do valor real só pra quem
          tem dependentes, nunca abaixo.
        </Typography>
        <Box className={classes.toolbar}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCalculatePartnersAll}
            disabled={calculatingPartners}
          >
            {calculatingPartners ? <CircularProgress size={20} /> : "Calcular pró-labore do mês"}
          </Button>
        </Box>

        {skippedPartners.length > 0 && (
          <Box mb={2}>
            <Typography variant="body2" color="error">
              {skippedPartners.length} sócio(s) não puderam ser calculados:
            </Typography>
            {skippedPartners.map((s) => (
              <Chip
                key={s.partnerId}
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
                <TableCell>Sócio</TableCell>
                <TableCell align="right">Pró-labore</TableCell>
                <TableCell align="right">INSS (11%)</TableCell>
                <TableCell align="right">IRRF</TableCell>
                <TableCell align="right">Redução Lei 15.270</TableCell>
                <TableCell align="right">Líquido</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingPartners ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : partnerEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="textSecondary">
                      Nenhum pró-labore calculado pra essa competência ainda.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                partnerEntries.map((entry) => {
                  const missingProlabore = !entry.prolaboreSnapshot;
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        {entry.partner?.name || "—"}
                        {missingProlabore && (
                          <Tooltip title="Sócio sem Pró-labore cadastrado — valores zerados">
                            <Warning
                              fontSize="small"
                              color="error"
                              style={{ marginLeft: 6, verticalAlign: "middle" }}
                            />
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell align="right">{formatToCurrency(entry.prolaboreSnapshot || 0)}</TableCell>
                      <TableCell align="right">{formatToCurrency(entry.inssValue || 0)}</TableCell>
                      <TableCell align="right">{formatToCurrency(entry.irrfValue || 0)}</TableCell>
                      <TableCell align="right">{formatToCurrency(entry.irrfReductionValue || 0)}</TableCell>
                      <TableCell align="right">
                        <strong>{formatToCurrency(entry.netValue || 0)}</strong>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Paper>
      </Box>

      <Box mt={4} mb={2}>
        <Typography variant="h6" gutterBottom>
          13º Salário
        </Typography>
        <Typography variant="caption" color="textSecondary" paragraph>
          Calcula o 13º de todos os funcionários CLT/Menor Aprendiz
          elegíveis no ano escolhido (avos proporcionais aos meses
          trabalhados — fração ≥ 15 dias conta como mês integral,
          inclusive pra quem foi admitido ou desligado durante o ano).
          INSS e IRRF incidem sobre o valor INTEGRAL do 13º, calculados
          separado do salário mensal normal (tributação exclusiva na
          fonte) — 1ª parcela (até 30/11) é metade do valor, sem
          desconto; 2ª parcela (até 20/12) traz o restante, já com
          INSS/IRRF descontados.
        </Typography>
        <Box className={classes.toolbar}>
          <FormControl variant="outlined" size="small" style={{ minWidth: 100 }}>
            <InputLabel>Ano</InputLabel>
            <Select value={thirteenthYear} onChange={(e) => setThirteenthYear(e.target.value)} label="Ano">
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
            onClick={handleCalculateThirteenthAll}
            disabled={calculatingThirteenth}
          >
            {calculatingThirteenth ? <CircularProgress size={20} /> : "Calcular 13º do ano"}
          </Button>
        </Box>

        {skippedThirteenth.length > 0 && (
          <Box mb={2}>
            <Typography variant="body2" color="error">
              {skippedThirteenth.length} funcionário(s) não puderam ser calculados:
            </Typography>
            {skippedThirteenth.map((s) => (
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
                <TableCell align="right">Avos</TableCell>
                <TableCell align="right">13º Bruto</TableCell>
                <TableCell align="right">INSS</TableCell>
                <TableCell align="right">IRRF</TableCell>
                <TableCell align="right">Redução Lei 15.270</TableCell>
                <TableCell align="right">1ª Parcela</TableCell>
                <TableCell align="right">2ª Parcela</TableCell>
                <TableCell align="right">Líquido</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingThirteenth ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : thirteenthEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="textSecondary">
                      Nenhum 13º calculado pra esse ano ainda.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                thirteenthEntries.map((entry) => {
                  const missingSalary = !entry.grossSalarySnapshot;
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
                      <TableCell align="right">{entry.monthsWorked}/12</TableCell>
                      <TableCell align="right">{formatToCurrency(entry.grossValue || 0)}</TableCell>
                      <TableCell align="right">{formatToCurrency(entry.inssValue || 0)}</TableCell>
                      <TableCell align="right">{formatToCurrency(entry.irrfValue || 0)}</TableCell>
                      <TableCell align="right">{formatToCurrency(entry.irrfReductionValue || 0)}</TableCell>
                      <TableCell align="right">{formatToCurrency(entry.firstInstallmentValue || 0)}</TableCell>
                      <TableCell align="right">{formatToCurrency(entry.secondInstallmentValue || 0)}</TableCell>
                      <TableCell align="right">
                        <strong>{formatToCurrency(entry.netValue || 0)}</strong>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Paper>
      </Box>
    </Box>
  );
};

export default PayrollPanel;
