import React, { useState, useEffect, useCallback } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import PrintIcon from "@material-ui/icons/Print";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";

import toastError from "../../errors/toastError";
import { money } from "../../utils/financeFormat";

// Painel com gráficos do Financeiro (Fase 2 — ver docs/MANUAL_TECNICO.md,
// seção 6.2). Segue a skill de dataviz do projeto: paleta categórica
// validada, cor por identidade (nunca por rank), sem eixo duplo, rótulo
// direto sempre que a cor sozinha não tiver contraste suficiente.
//
// Cores fixas (não ciclam): Receitas = índigo, Despesas = vermelho — mesma
// paleta categórica já validada e usada no Dashboard/ChartDonut
// (['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']). Despesas por
// categoria usa um gráfico de barras horizontais de um hue só (magnitude,
// não identidade) em vez de um "gráfico de pizza multicor" — evita o
// problema de ter que atribuir cor pra um número não previsível de
// categorias (o cliente cadastra a categoria livremente).
const COLOR_INCOME = "#6366f1";
const COLOR_EXPENSE = "#ef4444";
const COLOR_CATEGORY = "#6366f1";

const useStyles = makeStyles((theme) => ({
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
  },
  cardsGrid: {
    marginBottom: theme.spacing(3),
  },
  card: {
    padding: theme.spacing(2),
    borderRadius: 12,
    height: "100%",
  },
  cardLabel: {
    fontSize: "0.78rem",
    color: theme.palette.text.secondary,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  cardValue: {
    fontSize: "1.35rem",
    fontWeight: 700,
    marginTop: theme.spacing(0.5),
  },
  chartPaper: {
    padding: theme.spacing(2.5),
    borderRadius: 12,
    marginBottom: theme.spacing(3),
  },
  chartTitle: {
    fontWeight: 700,
    marginBottom: theme.spacing(2),
  },
  loadingBox: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(6),
  },
  // Só a área do painel deve ir pro papel/PDF quando o usuário manda
  // imprimir — o resto da tela (menu lateral, abas, cabeçalho do app) fica
  // fora. Ver docs/MANUAL_TECNICO.md, seção 6.2, sobre a decisão por
  // window.print() + @media print em vez de gerar o PDF no servidor.
  "@global": {
    "@media print": {
      "body *": {
        visibility: "hidden",
      },
      "#finance-painel-print-area, #finance-painel-print-area *": {
        visibility: "visible",
      },
      "#finance-painel-print-area": {
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
      },
      "#finance-painel-print-hide": {
        display: "none",
      },
      // Se o mouse estiver sobre um gráfico no momento de imprimir, o
      // tooltip do recharts pode ficar "grudado" na página impressa —
      // esconde qualquer tooltip ativo, já que hover não faz sentido no
      // papel/PDF.
      ".recharts-tooltip-wrapper": {
        display: "none !important",
      },
    },
  },
}));

const SummaryCard = ({ label, value, accent }) => {
  const classes = useStyles();
  // Só destaca com a cor de alerta quando há de fato algo a alertar — um
  // "vencido" zerado não deveria chamar atenção como se fosse um problema.
  const showAccent = accent && Number(value) !== 0;
  return (
    <Paper className={classes.card} variant="outlined">
      <Typography className={classes.cardLabel}>{label}</Typography>
      <Typography className={classes.cardValue} style={showAccent ? { color: accent } : undefined}>
        {money(value)}
      </Typography>
    </Paper>
  );
};

const currencyTooltipFormatter = (value) => money(value);

const FinancePainel = ({ finance }) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [cashFlow, setCashFlow] = useState([]);
  const [expensesByCategory, setExpensesByCategory] = useState([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, cashFlowData, categoryData] = await Promise.all([
        finance.reports.summary(),
        finance.reports.cashFlow(6),
        finance.reports.expensesByCategory(),
      ]);
      setSummary(summaryData);
      setCashFlow(cashFlowData);
      setExpensesByCategory(categoryData);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <Box className={classes.loadingBox}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div id="finance-painel-print-area">
      <Box id="finance-painel-print-hide" className={classes.header}>
        <Typography variant="h6">Painel Financeiro</Typography>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<PrintIcon />}
          onClick={() => window.print()}
        >
          Imprimir / Exportar PDF
        </Button>
      </Box>

      {summary && (
        <Grid container spacing={2} className={classes.cardsGrid}>
          <Grid item xs={6} sm={4} md={3}>
            <SummaryCard label="A pagar (pendente)" value={summary.pendingExpenses} />
          </Grid>
          <Grid item xs={6} sm={4} md={3}>
            <SummaryCard label="A pagar (vencido)" value={summary.overdueExpenses} accent="#ef4444" />
          </Grid>
          <Grid item xs={6} sm={4} md={3}>
            <SummaryCard label="A receber (pendente)" value={summary.pendingReceivables} />
          </Grid>
          <Grid item xs={6} sm={4} md={3}>
            <SummaryCard label="A receber (vencido)" value={summary.overdueReceivables} accent="#ef4444" />
          </Grid>
          <Grid item xs={6} sm={4} md={3}>
            <SummaryCard label="Pago no mês" value={summary.paidThisMonth} />
          </Grid>
          <Grid item xs={6} sm={4} md={3}>
            <SummaryCard label="Recebido no mês" value={summary.receivedThisMonth} />
          </Grid>
          <Grid item xs={6} sm={4} md={3}>
            <SummaryCard
              label="Saldo previsto"
              value={summary.projectedBalance}
              accent={summary.projectedBalance < 0 ? "#ef4444" : "#10b981"}
            />
          </Grid>
        </Grid>
      )}

      <Paper className={classes.chartPaper} variant="outlined">
        <Typography className={classes.chartTitle}>
          Fluxo de caixa (últimos 6 meses)
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={cashFlow} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="monthLabel" />
            <YAxis tickFormatter={(v) => money(v)} width={90} />
            <Tooltip formatter={currencyTooltipFormatter} />
            <Legend />
            <Bar dataKey="income" name="Receitas" fill={COLOR_INCOME} radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="Despesas" fill={COLOR_EXPENSE} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Paper>

      <Paper className={classes.chartPaper} variant="outlined">
        <Typography className={classes.chartTitle}>Despesas por categoria</Typography>
        {expensesByCategory.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            Nenhuma despesa cadastrada ainda.
          </Typography>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, expensesByCategory.length * 46)}>
            <BarChart
              data={expensesByCategory}
              layout="vertical"
              margin={{ top: 8, right: 72, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              {/* Domínio com folga (+20%) — sem isso, o rótulo direto da
                  maior barra (a que chega mais perto do valor máximo) fica
                  cortado na borda do gráfico. */}
              <XAxis type="number" domain={[0, (dataMax) => Math.ceil(dataMax * 1.2)]} tickFormatter={(v) => money(v)} />
              <YAxis type="category" dataKey="category" width={120} />
              <Tooltip formatter={currencyTooltipFormatter} />
              <Bar dataKey="total" name="Total" fill={COLOR_CATEGORY} radius={[0, 4, 4, 0]}>
                <LabelList dataKey="total" position="right" formatter={money} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Paper>
    </div>
  );
};

export default FinancePainel;
