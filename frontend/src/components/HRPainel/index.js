import React, { useState, useEffect, useCallback } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import WorkOutlineIcon from "@material-ui/icons/WorkOutline";
import PeopleAltIcon from "@material-ui/icons/PeopleAlt";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import AssignmentIndIcon from "@material-ui/icons/AssignmentInd";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from "recharts";

import toastError from "../../errors/toastError";

// Painel de RH (Fase 5 — ver docs/MANUAL_TECNICO.md, seção 6.2), mesmo
// espírito visual do Painel Financeiro: cards de resumo + gráficos, seguindo
// a skill de dataviz do projeto. "Candidaturas por status" usa cor por
// IDENTIDADE (status é um conjunto fixo e pequeno de 5 valores conhecidos —
// mesma paleta já usada nos Chips de status em JobApplicationsPanel/
// JobApplicationDetailModal, nunca cíclica). "Candidaturas por vaga" usa um
// hue só (magnitude) em barras horizontais, porque o título da vaga é texto
// livre cadastrado pelo Admin — mesmo raciocínio já aplicado em "Despesas
// por categoria" no FinancePainel.
const STATUS_COLORS = {
  received: "#6b7280",
  screening: "#3b82f6",
  interview: "#8b5cf6",
  approved: "#10b981",
  rejected: "#ef4444",
};
const STATUS_LABELS = {
  received: "Recebida",
  screening: "Em triagem",
  interview: "Entrevista",
  approved: "Aprovada",
  rejected: "Reprovada",
};
const COLOR_JOB_POSTING = "#6366f1";

const useStyles = makeStyles((theme) => ({
  header: {
    marginBottom: theme.spacing(2),
  },
  cardsGrid: {
    marginBottom: theme.spacing(3),
  },
  card: {
    padding: theme.spacing(2),
    borderRadius: 12,
    height: "100%",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    backgroundColor: theme.palette.type === "light" ? "#eef2ff" : "#1e293b",
    "& svg": { color: "#6366f1", fontSize: 20 },
  },
  cardLabel: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  cardValue: {
    fontSize: "1.35rem",
    fontWeight: 700,
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
}));

const SummaryCard = ({ icon, label, value }) => {
  const classes = useStyles();
  return (
    <Paper className={classes.card} variant="outlined">
      <Box className={classes.cardIcon}>{icon}</Box>
      <Box>
        <Typography className={classes.cardLabel}>{label}</Typography>
        <Typography className={classes.cardValue}>{value}</Typography>
      </Box>
    </Paper>
  );
};

const HRPainel = ({ hr }) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hr.reports.summary();
      setSummary(data);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  }, [hr]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  if (loading) {
    return (
      <Box className={classes.loadingBox}>
        <CircularProgress />
      </Box>
    );
  }

  if (!summary) return null;

  const statusData = summary.applicationsByStatus.map((row) => ({
    ...row,
    label: STATUS_LABELS[row.status] || row.status,
    color: STATUS_COLORS[row.status] || "#6b7280",
  }));

  const jobPostingData = summary.applicationsByJobPosting;

  return (
    <div>
      <Box className={classes.header}>
        <Typography variant="h6">Painel de RH</Typography>
      </Box>

      <Grid container spacing={2} className={classes.cardsGrid}>
        <Grid item xs={6} sm={6} md={3}>
          <SummaryCard
            icon={<WorkOutlineIcon />}
            label="Vagas abertas"
            value={summary.openJobPostings}
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <SummaryCard
            icon={<PeopleAltIcon />}
            label="Total de candidaturas"
            value={summary.totalApplications}
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <SummaryCard
            icon={<AssignmentIndIcon />}
            label="Total de vagas"
            value={summary.totalJobPostings}
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <SummaryCard
            icon={<CheckCircleIcon />}
            label="Candidatos efetivados"
            value={summary.hiredCount}
          />
        </Grid>
      </Grid>

      <Paper className={classes.chartPaper} variant="outlined">
        <Typography className={classes.chartTitle}>Candidaturas por status</Typography>
        {summary.totalApplications === 0 ? (
          <Typography variant="body2" color="textSecondary">
            Nenhuma candidatura recebida ainda.
          </Typography>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={statusData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} width={40} />
              <Tooltip />
              <Bar dataKey="total" name="Candidaturas" radius={[4, 4, 0, 0]}>
                {statusData.map((row) => (
                  <Cell key={row.status} fill={row.color} />
                ))}
                <LabelList dataKey="total" position="top" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Paper>

      <Paper className={classes.chartPaper} variant="outlined">
        <Typography className={classes.chartTitle}>Candidaturas por vaga</Typography>
        {jobPostingData.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            Nenhuma candidatura recebida ainda.
          </Typography>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, jobPostingData.length * 46)}>
            <BarChart
              data={jobPostingData}
              layout="vertical"
              margin={{ top: 8, right: 40, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} domain={[0, (dataMax) => Math.ceil(dataMax * 1.2) || 1]} />
              <YAxis type="category" dataKey="title" width={160} />
              <Tooltip />
              <Bar dataKey="total" name="Candidaturas" fill={COLOR_JOB_POSTING} radius={[0, 4, 4, 0]}>
                <LabelList dataKey="total" position="right" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Paper>
    </div>
  );
};

export default HRPainel;
