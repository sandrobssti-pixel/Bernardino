import React, { useState, useEffect, useContext, useCallback, useMemo } from "react";
import ReactECharts from "echarts-for-react";

import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";

import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  kpiRow: {
    display: "flex",
    gap: theme.spacing(1.5),
    flexWrap: "wrap",
    marginBottom: theme.spacing(1.5),
  },
  kpiCard: {
    flex: "1 1 150px",
    padding: theme.spacing(1.5),
    borderRadius: 10,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  kpiValue: {
    fontSize: "1.5rem",
    fontWeight: 700,
  },
  kpiLabel: {
    fontSize: "0.72rem",
    color: theme.palette.text.secondary,
    textTransform: "uppercase",
    fontWeight: 600,
    letterSpacing: 0.3,
  },
  chartsRow: {
    display: "flex",
    gap: theme.spacing(1.5),
    flexWrap: "wrap",
    marginBottom: theme.spacing(1.5),
  },
  chartPaper: {
    flex: "1 1 280px",
    padding: theme.spacing(1.5),
    borderRadius: 10,
  },
}));

export const STATUS_META = {
  onTime: { label: "No prazo", color: "#10b981" },
  risk: { label: "Risco de atraso", color: "#f59e0b" },
  overdue: { label: "Fora do prazo", color: "#ef4444" },
};

export const formatElapsed = (minutes) => {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return `${h}h ${rest}min`;
};

// Visão geral do Painel Vigia (ver docs/MANUAL_TECNICO.md): cards de totais +
// dois gráficos ao vivo, pensado pra ser embutido dentro do "Painel"
// (MomentsUser) já existente, em vez de uma tela separada — o cliente pediu
// pra unificar tudo num lugar só.
const SupervisorOverviewPanel = ({ supervisorPanel }) => {
  const classes = useStyles();
  const { user, socket } = useContext(AuthContext);
  const [summary, setSummary] = useState(null);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await supervisorPanel.getSummary();
      setSummary(data);
    } catch (err) {
      toastError(err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 15000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  useEffect(() => {
    if (!socket || !user?.companyId) return;
    const companyId = user.companyId;
    const onNotification = () => fetchSummary();
    socket.on(`company-${companyId}-notification`, onNotification);
    return () => socket.off(`company-${companyId}-notification`, onNotification);
  }, [socket, user, fetchSummary]);

  const donutOption = useMemo(() => ({
    tooltip: { trigger: "item" },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    series: [{
      name: "Atendimentos",
      type: "pie",
      radius: ["45%", "70%"],
      center: ["50%", "42%"],
      label: { show: false },
      labelLine: { show: false },
      data: [
        { value: summary?.totalOnTime || 0, name: "No prazo", itemStyle: { color: STATUS_META.onTime.color } },
        { value: summary?.totalRisk || 0, name: "Risco de atraso", itemStyle: { color: STATUS_META.risk.color } },
        { value: summary?.totalOverdue || 0, name: "Fora do prazo", itemStyle: { color: STATUS_META.overdue.color } },
      ],
    }],
  }), [summary]);

  const byQueueOption = useMemo(() => {
    const rows = summary?.byQueue || [];
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 36, right: 12, top: 20, bottom: 40 },
      xAxis: { type: "category", data: rows.map((r) => r.queueName), axisLabel: { fontSize: 10 } },
      yAxis: { type: "value", minInterval: 1 },
      series: [
        { name: "No prazo", type: "bar", stack: "total", data: rows.map((r) => r.onTime), itemStyle: { color: STATUS_META.onTime.color } },
        { name: "Risco de atraso", type: "bar", stack: "total", data: rows.map((r) => r.risk), itemStyle: { color: STATUS_META.risk.color } },
        { name: "Fora do prazo", type: "bar", stack: "total", data: rows.map((r) => r.overdue), itemStyle: { color: STATUS_META.overdue.color } },
      ],
    };
  }, [summary]);

  if (!summary) return null;

  return (
    <Box mb={1.5}>
      <Box className={classes.kpiRow}>
        <Paper variant="outlined" className={classes.kpiCard}>
          <span className={classes.kpiLabel}>Atendimentos ativos</span>
          <span className={classes.kpiValue}>{summary.totalActive}</span>
        </Paper>
        <Paper variant="outlined" className={classes.kpiCard} style={{ borderColor: STATUS_META.risk.color }}>
          <span className={classes.kpiLabel}>Risco de atraso (SLA)</span>
          <span className={classes.kpiValue} style={{ color: STATUS_META.risk.color }}>{summary.totalRisk}</span>
        </Paper>
        <Paper variant="outlined" className={classes.kpiCard} style={{ borderColor: STATUS_META.overdue.color }}>
          <span className={classes.kpiLabel}>Fora do prazo (SLA)</span>
          <span className={classes.kpiValue} style={{ color: STATUS_META.overdue.color }}>{summary.totalOverdue}</span>
        </Paper>
        <Paper variant="outlined" className={classes.kpiCard}>
          <span className={classes.kpiLabel}>Tempo médio em aberto</span>
          <span className={classes.kpiValue}>{formatElapsed(summary.avgElapsedMinutes)}</span>
        </Paper>
      </Box>

      {summary.totalActive > 0 && (
        <Box className={classes.chartsRow}>
          <Paper variant="outlined" className={classes.chartPaper}>
            <Typography variant="subtitle2" gutterBottom>Distribuição por status (SLA)</Typography>
            <ReactECharts option={donutOption} style={{ height: 200 }} />
          </Paper>
          <Paper variant="outlined" className={classes.chartPaper}>
            <Typography variant="subtitle2" gutterBottom>Por fila</Typography>
            <ReactECharts option={byQueueOption} style={{ height: 200 }} />
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default SupervisorOverviewPanel;
