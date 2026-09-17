import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from "react";
import { toast } from "react-toastify";
import ReactECharts from "echarts-for-react";

import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Chip from "@material-ui/core/Chip";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import Grid from "@material-ui/core/Grid";
import SendIcon from "@material-ui/icons/Send";

import { AuthContext } from "../../context/Auth/AuthContext";
import useSupervisorPanel from "../../hooks/useSupervisorPanel";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import FinanceRecordList from "../../components/FinanceRecordList";

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    padding: theme.spacing(2),
    height: "calc(100% - 48px)",
    overflowY: "auto",
    ...theme.scrollbarStyles,
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
    },
  },
  lockedBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    flex: 1,
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  kpiRow: {
    display: "flex",
    gap: theme.spacing(2),
    flexWrap: "wrap",
    marginBottom: theme.spacing(2),
  },
  kpiCard: {
    flex: "1 1 160px",
    padding: theme.spacing(2),
    borderRadius: 12,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  kpiValue: {
    fontSize: "1.8rem",
    fontWeight: 700,
  },
  kpiLabel: {
    fontSize: "0.78rem",
    color: theme.palette.text.secondary,
    textTransform: "uppercase",
    fontWeight: 600,
    letterSpacing: 0.3,
  },
  chartsRow: {
    display: "flex",
    gap: theme.spacing(2),
    flexWrap: "wrap",
    marginBottom: theme.spacing(2),
  },
  chartPaper: {
    flex: "1 1 320px",
    padding: theme.spacing(2),
    borderRadius: 12,
  },
  tablePaper: {
    borderRadius: 12,
    overflowX: "auto",
  },
  onlineDot: {
    display: "inline-block",
    width: 9,
    height: 9,
    borderRadius: "50%",
    marginRight: 6,
  },
}));

const STATUS_META = {
  onTime: { label: "No prazo", color: "#10b981" },
  risk: { label: "Risco de atraso", color: "#f59e0b" },
  overdue: { label: "Fora do prazo", color: "#ef4444" },
};

const formatElapsed = (minutes) => {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return `${h}h ${rest}min`;
};

const SendMessageDialog = ({ open, onClose, onSend, ticketLabel }) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await onSend(message.trim());
      setMessage("");
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Mensagem para o atendente</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {ticketLabel}
        </Typography>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={3}
          variant="outlined"
          placeholder="Ex.: confirme o CPF do cliente antes de fechar o atendimento"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={sending}>Cancelar</Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<SendIcon />}
          onClick={handleSend}
          disabled={sending || !message.trim()}
        >
          Enviar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const LivePanel = ({ supervisorPanel }) => {
  const classes = useStyles();
  const { user, socket } = useContext(AuthContext);
  const [live, setLive] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messageTarget, setMessageTarget] = useState(null);
  const [, forceTick] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [liveData, summaryData] = await Promise.all([
        supervisorPanel.getLive(),
        supervisorPanel.getSummary(),
      ]);
      setLive(liveData);
      setSummary(summaryData);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Cronômetro visual (recalcula o tempo decorrido a cada minuto sem
  // precisar esperar o próximo polling de 15s).
  useEffect(() => {
    const tick = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const companyId = user.companyId;
    const onNotification = () => fetchData();
    socket.on(`company-${companyId}-notification`, onNotification);
    return () => socket.off(`company-${companyId}-notification`, onNotification);
  }, [socket, user, fetchData]);

  const donutOption = useMemo(() => ({
    tooltip: { trigger: "item" },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    series: [{
      name: "Atendimentos",
      type: "pie",
      radius: ["45%", "70%"],
      center: ["50%", "45%"],
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
      grid: { left: 40, right: 16, top: 24, bottom: 40 },
      xAxis: { type: "category", data: rows.map((r) => r.queueName), axisLabel: { fontSize: 10 } },
      yAxis: { type: "value", minInterval: 1 },
      series: [
        { name: "No prazo", type: "bar", stack: "total", data: rows.map((r) => r.onTime), itemStyle: { color: STATUS_META.onTime.color } },
        { name: "Risco de atraso", type: "bar", stack: "total", data: rows.map((r) => r.risk), itemStyle: { color: STATUS_META.risk.color } },
        { name: "Fora do prazo", type: "bar", stack: "total", data: rows.map((r) => r.overdue), itemStyle: { color: STATUS_META.overdue.color } },
      ],
    };
  }, [summary]);

  const handleSendMessage = async (message) => {
    try {
      await supervisorPanel.sendMessage({
        ticketId: messageTarget.ticketId,
        userId: messageTarget.userId,
        message,
      });
      toast.success("Mensagem enviada ao atendente.");
    } catch (err) {
      toastError(err);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" my={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div>
      <SendMessageDialog
        open={!!messageTarget}
        onClose={() => setMessageTarget(null)}
        onSend={handleSendMessage}
        ticketLabel={messageTarget ? `Para ${messageTarget.userName || "atendente"} — ${messageTarget.contactName}` : ""}
      />

      <Box className={classes.kpiRow}>
        <Paper variant="outlined" className={classes.kpiCard}>
          <span className={classes.kpiLabel}>Atendimentos ativos</span>
          <span className={classes.kpiValue}>{summary?.totalActive ?? 0}</span>
        </Paper>
        <Paper variant="outlined" className={classes.kpiCard} style={{ borderColor: STATUS_META.risk.color }}>
          <span className={classes.kpiLabel}>Risco de atraso</span>
          <span className={classes.kpiValue} style={{ color: STATUS_META.risk.color }}>{summary?.totalRisk ?? 0}</span>
        </Paper>
        <Paper variant="outlined" className={classes.kpiCard} style={{ borderColor: STATUS_META.overdue.color }}>
          <span className={classes.kpiLabel}>Fora do prazo</span>
          <span className={classes.kpiValue} style={{ color: STATUS_META.overdue.color }}>{summary?.totalOverdue ?? 0}</span>
        </Paper>
        <Paper variant="outlined" className={classes.kpiCard}>
          <span className={classes.kpiLabel}>Tempo médio em aberto</span>
          <span className={classes.kpiValue}>{formatElapsed(summary?.avgElapsedMinutes || 0)}</span>
        </Paper>
      </Box>

      <Box className={classes.chartsRow}>
        <Paper variant="outlined" className={classes.chartPaper}>
          <Typography variant="subtitle2" gutterBottom>Distribuição por status</Typography>
          <ReactECharts option={donutOption} style={{ height: 240 }} />
        </Paper>
        <Paper variant="outlined" className={classes.chartPaper}>
          <Typography variant="subtitle2" gutterBottom>Por fila</Typography>
          <ReactECharts option={byQueueOption} style={{ height: 240 }} />
        </Paper>
      </Box>

      <Paper className={classes.tablePaper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Atendente</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell>Fila</TableCell>
              <TableCell>Tempo</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ação</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {live.map((row) => (
              <TableRow key={row.ticketId}>
                <TableCell>
                  <span
                    className={classes.onlineDot}
                    style={{ backgroundColor: row.userOnline ? "#22c55e" : "#9ca3af" }}
                  />
                  {row.userName || "Sem atendente"}
                </TableCell>
                <TableCell>
                  {row.contactName}
                  <br />
                  <Typography variant="caption" color="textSecondary">{row.contactNumber}</Typography>
                </TableCell>
                <TableCell>{row.queueName || "Sem fila"}</TableCell>
                <TableCell>{formatElapsed(row.elapsedMinutes)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={STATUS_META[row.status].label}
                    style={{ backgroundColor: STATUS_META[row.status].color, color: "#fff", fontWeight: 600 }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Mandar mensagem ao atendente">
                    <span>
                      <IconButton
                        size="small"
                        disabled={!row.userId}
                        onClick={() => setMessageTarget(row)}
                      >
                        <SendIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {live.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">Nenhum atendimento em aberto no momento.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </div>
  );
};

const SlaRulesPanel = ({ supervisorPanel }) => {
  const [queues, setQueues] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/queue");
        setQueues(Array.isArray(data) ? data : data?.queues || []);
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);

  const columns = [
    { field: "name", label: "Nome" },
    { field: "riskMinutes", label: "Risco de atraso (min)" },
    { field: "overdueMinutes", label: "Fora do prazo (min)" },
    {
      field: "queue",
      label: "Fila",
      render: (record) => record.queue?.name || "Padrão (todas as filas)",
    },
  ];

  const fields = [
    { name: "name", label: "Nome da regra", gridSize: 12 },
    { name: "riskMinutes", label: "Risco de atraso (minutos)", type: "number", defaultValue: 15, gridSize: 6 },
    { name: "overdueMinutes", label: "Fora do prazo (minutos)", type: "number", defaultValue: 20, gridSize: 6 },
    {
      name: "queueId",
      label: "Fila (vazio = padrão da empresa)",
      type: "select",
      gridSize: 12,
      options: [
        { value: "", label: "Padrão (todas as filas)" },
        ...queues.map((q) => ({ value: q.id, label: q.name })),
      ],
    },
  ];

  return (
    <FinanceRecordList
      title="Regra de SLA"
      resource={supervisorPanel.slaRules}
      columns={columns}
      fields={fields}
    />
  );
};

const SupervisorPanel = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const supervisorPanel = useSupervisorPanel();
  const [access, setAccess] = useState(null);
  const [tab, setTab] = useState("live");

  useEffect(() => {
    (async () => {
      try {
        const data = await supervisorPanel.getAccess();
        setAccess(data);
      } catch (err) {
        setAccess({ planHasModule: false, hasAccess: false });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user.super) {
    if (access === null) {
      return (
        <div className={classes.pageRoot}>
          <Box display="flex" justifyContent="center" my={6}>
            <CircularProgress />
          </Box>
        </div>
      );
    }

    if (!access.hasAccess) {
      return (
        <div className={classes.pageRoot}>
          <Box className={classes.lockedBox}>
            <Typography variant="h6" gutterBottom>Painel Vigia não disponível</Typography>
            <Typography variant="body2">
              {access.planHasModule
                ? "Peça para o administrador da sua empresa liberar seu acesso ao Painel Vigia."
                : "Esse módulo é um add-on separado do plano contratado. Fale com o suporte para contratá-lo."}
            </Typography>
          </Box>
        </div>
      );
    }
  }

  return (
    <div className={classes.pageRoot}>
      <Tabs
        value={tab}
        onChange={(e, v) => setTab(v)}
        indicatorColor="primary"
        textColor="primary"
        style={{ marginBottom: 16 }}
      >
        <Tab value="live" label="Ao vivo" />
        <Tab value="rules" label="Regras de SLA" />
      </Tabs>

      {tab === "live" && <LivePanel supervisorPanel={supervisorPanel} />}
      {tab === "rules" && <SlaRulesPanel supervisorPanel={supervisorPanel} />}
    </div>
  );
};

export default SupervisorPanel;
