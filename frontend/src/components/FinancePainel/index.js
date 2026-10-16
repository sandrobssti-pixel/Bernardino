import React, { useState, useEffect, useCallback } from "react";
import XLSX from "xlsx";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import Chip from "@material-ui/core/Chip";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import PrintIcon from "@material-ui/icons/Print";
import GetAppIcon from "@material-ui/icons/GetApp";
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
const COLOR_PROFIT = "#10b981";
const COLOR_COST = "#f59e0b";
const COLOR_TAX = "#ef4444";

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
      "#finance-painel-print-hide, #finance-painel-print-hide-excel": {
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
  const [stockHealth, setStockHealth] = useState(null);
  const [profitDashboard, setProfitDashboard] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, cashFlowData, categoryData, stockData, profitData] = await Promise.all([
        finance.reports.summary(),
        finance.reports.cashFlow(6),
        finance.reports.expensesByCategory(),
        finance.reports.stockHealth(),
        finance.reports.profitDashboard(),
      ]);
      setSummary(summaryData);
      setCashFlow(cashFlowData);
      setExpensesByCategory(categoryData);
      setStockHealth(stockData);
      setProfitDashboard(profitData);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exporta a tabela "lucro por produto" pro Excel (mesmo padrão já usado
  // em Reports/index.js — XLSX.utils.json_to_sheet + XLSX.writeFile).
  const handleExportProfitExcel = () => {
    if (!profitDashboard?.byProduct?.length) return;
    const rows = profitDashboard.byProduct.map((p) => ({
      Produto: p.name,
      SKU: p.sku || "",
      Quantidade: p.quantity,
      "Valor de compra (custo)": p.cost,
      Impostos: p.tax,
      "Valor de venda (bruto)": p.gross,
      "Lucro líquido": p.profit,
      "Margem (%)": Number(p.margin.toFixed(2)),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LucroPorProduto");
    XLSX.writeFile(wb, "lucro-por-produto.xlsx");
  };

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

      {stockHealth && (
        <Paper className={classes.chartPaper} variant="outlined">
          <Typography className={classes.chartTitle}>Situação do estoque</Typography>
          {stockHealth.trackedCount === 0 ? (
            <Typography variant="body2" color="textSecondary">
              Nenhum produto com controle de estoque habilitado ainda (cadastro de Produtos
              → "Controlar estoque").
            </Typography>
          ) : stockHealth.outOfStock.length === 0 && stockHealth.lowStock.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              Estoque saudável — nenhum dos {stockHealth.trackedCount} produto(s) com controle
              de estoque está zerado ou abaixo do mínimo configurado.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Produto</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell align="center">Estoque</TableCell>
                  <TableCell align="center">Mínimo</TableCell>
                  <TableCell>Situação</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...stockHealth.outOfStock, ...stockHealth.lowStock].map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.sku || "—"}</TableCell>
                    <TableCell align="center">{product.stockQuantity}</TableCell>
                    <TableCell align="center">{product.minStockQuantity || "—"}</TableCell>
                    <TableCell>
                      {product.stockQuantity <= 0 ? (
                        <Chip size="small" label="Zerado" style={{ backgroundColor: "#ef4444", color: "#fff" }} />
                      ) : (
                        <Chip size="small" label="Baixo" style={{ backgroundColor: "#f59e0b", color: "#fff" }} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>
      )}

      {profitDashboard && !profitDashboard.enabled && (
        <Paper className={classes.chartPaper} variant="outlined">
          <Typography className={classes.chartTitle}>Compra × imposto × venda × lucro</Typography>
          <Typography variant="body2" color="textSecondary">
            Esse painel aparece depois que a emissão de nota fiscal passar pra modo Produção na
            Configuração Fiscal — enquanto está em Homologação (testes), vendas não entram nessa
            conta de lucro.
          </Typography>
        </Paper>
      )}

      {profitDashboard?.enabled && (
        <Paper className={classes.chartPaper} variant="outlined">
          <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" style={{ gap: 8 }}>
            <Typography className={classes.chartTitle} style={{ marginBottom: 0 }}>
              Compra × imposto × venda × lucro
            </Typography>
            <Button
              id="finance-painel-print-hide-excel"
              size="small"
              variant="outlined"
              color="primary"
              startIcon={<GetAppIcon />}
              onClick={handleExportProfitExcel}
              disabled={!profitDashboard.byProduct.length}
            >
              Baixar Excel
            </Button>
          </Box>

          <Grid container spacing={2} style={{ margin: "16px 0" }}>
            <Grid item xs={6} sm={3}>
              <SummaryCard label="Comprado (custo)" value={profitDashboard.totals.cost} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <SummaryCard label="Impostos" value={profitDashboard.totals.tax} accent="#ef4444" />
            </Grid>
            <Grid item xs={6} sm={3}>
              <SummaryCard label="Vendido (bruto)" value={profitDashboard.totals.gross} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <SummaryCard
                label={`Lucro líquido (margem ${profitDashboard.totals.margin.toFixed(1)}%)`}
                value={profitDashboard.totals.profit}
                accent={profitDashboard.totals.profit < 0 ? "#ef4444" : "#10b981"}
              />
            </Grid>
          </Grid>

          {profitDashboard.monthly.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              Nenhuma venda confirmada com produto cadastrado ainda — o lucro é calculado a
              partir do custo/alíquota de imposto do produto no momento da venda.
            </Typography>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={profitDashboard.monthly} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="monthLabel" />
                <YAxis tickFormatter={(v) => money(v)} width={90} />
                <Tooltip formatter={currencyTooltipFormatter} />
                <Legend />
                <Bar dataKey="cost" name="Comprado (custo)" stackId="venda" fill={COLOR_COST} />
                <Bar dataKey="tax" name="Impostos" stackId="venda" fill={COLOR_TAX} />
                <Bar dataKey="profit" name="Lucro líquido" stackId="venda" fill={COLOR_PROFIT} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          <Typography className={classes.chartTitle} style={{ marginTop: 24 }}>
            Produtos por margem de lucro
          </Typography>
          {profitDashboard.byProduct.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              Nenhum produto com venda confirmada ainda.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Produto</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell align="center">Qtde vendida</TableCell>
                  <TableCell align="right">Custo</TableCell>
                  <TableCell align="right">Impostos</TableCell>
                  <TableCell align="right">Venda</TableCell>
                  <TableCell align="right">Lucro</TableCell>
                  <TableCell align="right">Margem</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {profitDashboard.byProduct.map((p) => (
                  <TableRow key={p.productId || p.name}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.sku || "—"}</TableCell>
                    <TableCell align="center">{p.quantity}</TableCell>
                    <TableCell align="right">{money(p.cost)}</TableCell>
                    <TableCell align="right">{money(p.tax)}</TableCell>
                    <TableCell align="right">{money(p.gross)}</TableCell>
                    <TableCell align="right" style={{ color: p.profit < 0 ? "#ef4444" : "#10b981", fontWeight: 600 }}>
                      {money(p.profit)}
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        size="small"
                        label={`${p.margin.toFixed(1)}%`}
                        style={{
                          backgroundColor: p.margin < 0 ? "#ef4444" : p.margin < 15 ? "#f59e0b" : "#10b981",
                          color: "#fff",
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>
      )}
    </div>
  );
};

export default FinancePainel;
