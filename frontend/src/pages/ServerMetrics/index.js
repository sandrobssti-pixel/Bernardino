import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Container,
  Grid,
  Paper,
  Typography
} from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import StorageIcon from "@material-ui/icons/Storage";
import MemoryIcon from "@material-ui/icons/Memory";
import AccessTimeIcon from "@material-ui/icons/AccessTime";
import DnsIcon from "@material-ui/icons/Dns";
import CloudQueueIcon from "@material-ui/icons/CloudQueue";
import DeveloperBoardIcon from "@material-ui/icons/DeveloperBoard";
import WarningIcon from "@material-ui/icons/Warning";

import ForbiddenPage from "../../components/ForbiddenPage";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  root: {
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    background:
      theme.mode === "light"
        ? "linear-gradient(180deg, #f6faff 0%, #eef4ff 100%)"
        : "linear-gradient(180deg, #0b1324 0%, #0f1a30 100%)"
  },
  pageContainer: {
    width: "100%",
    maxWidth: "100%",
    padding: theme.spacing(2),
    height: "calc(100% - 48px)",
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1)
    }
  },
  contentWrapper: {
    width: "100%",
    maxWidth: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column"
  },
  pageBody: {
    ...theme.scrollbarStyles,
    overflowY: "auto",
    flex: 1,
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.mode === "light" ? "0 16px 36px rgba(15, 23, 42, 0.08)" : "0 16px 36px rgba(0, 0, 0, 0.35)",
    padding: theme.spacing(2)
  },
  card: {
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(2),
    height: "100%"
  },
  metricValue: {
    fontWeight: 700,
    color: theme.palette.text.primary,
    fontSize: "1.35rem"
  },
  metricLabel: {
    fontWeight: 600,
    color: theme.palette.text.secondary,
    fontSize: "0.77rem",
    textTransform: "uppercase",
    letterSpacing: "0.04em"
  },
  iconBadge: {
    width: 34,
    height: 34,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    color: "#1d4ed8"
  },
  sectionTitle: {
    fontWeight: 700,
    color: theme.palette.text.primary,
    marginBottom: theme.spacing(1),
    fontSize: "0.92rem"
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(0.65, 0),
    borderBottom: `1px dashed ${theme.palette.divider}`,
    "&:last-child": {
      borderBottom: "none"
    }
  },
  rowLabel: {
    color: theme.palette.text.secondary,
    fontSize: "0.78rem"
  },
  rowValue: {
    color: theme.palette.text.primary,
    fontWeight: 600,
    fontSize: "0.8rem",
    textAlign: "right"
  },
  diskWarning: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
    padding: theme.spacing(0.75, 1.25),
    borderRadius: 8,
    backgroundColor: "rgba(217, 45, 32, 0.10)",
    border: "1px solid rgba(217, 45, 32, 0.35)"
  },
  diskWarningText: {
    fontSize: "0.77rem",
    fontWeight: 600,
    color: "#b91c1c",
    lineHeight: 1.4
  },
  versionStatusOk: {
    color: "#039855",
    fontWeight: 700,
    fontSize: "0.8rem"
  },
  versionStatusWarning: {
    color: "#d92d20",
    fontWeight: 700,
    fontSize: "0.8rem"
  },
  updateLink: {
    color: theme.palette.primary.main,
    fontWeight: 700,
    fontSize: "0.8rem",
    textDecoration: "none",
    "&:hover": {
      textDecoration: "underline"
    }
  }
}));

const formatBytes = (bytes) => {
  const num = Number(bytes || 0);
  if (!num) return "0 B";

  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(num) / Math.log(1024)), sizes.length - 1);
  const value = num / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
};

const formatSeconds = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds || 0)));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  return `${minutes}m ${secs}s`;
};

const normalizeVersion = (value) =>
  String(value || "")
    .trim()
    .replace(/^v/i, "")
    .toLowerCase();

const ServerMetrics = ({ embedded = false, hideAccessCheck = false, extraCards = null }) => {
  const classes = useStyles();
  const theme = useTheme();
  const { user } = useContext(AuthContext);

  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    if (!user?.super) return;

    let mounted = true;

    const fetchMetrics = async () => {
      if (!mounted) return;

      try {
        const { data } = await api.get("/server-metrics");
        if (mounted) {
          setMetrics(data);
        }
      } catch (error) {
        if (mounted) {
          toastError(error);
        }
      }
    };

    fetchMetrics();
    const timer = setInterval(fetchMetrics, 15000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [user?.super]);

  const statusData = useMemo(() => {
    const redisStatus = metrics?.redis?.status || "offline";
    return {
      server: metrics?.status || "offline",
      redis: redisStatus,
      redisColor: redisStatus === "online" ? "#039855" : redisStatus === "degraded" ? "#f79009" : "#d92d20"
    };
  }, [metrics]);

  const wuzapiData = useMemo(() => {
    const data = metrics?.wuzapi || {};
    const status = String(data?.status || "not_configured");
    const color =
      status === "online" ? "#039855" : status === "offline" ? "#d92d20" : "#f79009";
    const installedVersion = data?.details?.version || null;
    const latestVersion = data?.details?.latestVersion || null;
    const isVersionMatch =
      !!installedVersion &&
      !!latestVersion &&
      normalizeVersion(installedVersion) === normalizeVersion(latestVersion);
    const shouldShowUpdateLink =
      !!latestVersion &&
      (!installedVersion || normalizeVersion(installedVersion) !== normalizeVersion(latestVersion));

    return {
      status,
      color,
      baseUrl: data?.baseUrl || "-",
      details: data?.details || {},
      installedVersion,
      latestVersion,
      isVersionMatch,
      shouldShowUpdateLink
    };
  }, [metrics]);

  if (!hideAccessCheck && !user?.super) {
    return <ForbiddenPage />;
  }

  const metricsContent = (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6} md={4}>
        <Paper elevation={0} className={classes.card}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography className={classes.metricLabel}>Status servidor</Typography>
            <Avatar className={classes.iconBadge}><StorageIcon fontSize="small" /></Avatar>
          </Box>
          <Typography className={classes.metricValue}>{String(statusData.server).toUpperCase()}</Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <Paper elevation={0} className={classes.card}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography className={classes.metricLabel}>Uptime servidor</Typography>
            <Avatar className={classes.iconBadge}><AccessTimeIcon fontSize="small" /></Avatar>
          </Box>
          <Typography className={classes.metricValue}>{formatSeconds(metrics?.uptimeSeconds)}</Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <Paper elevation={0} className={classes.card}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography className={classes.metricLabel}>Hora servidor</Typography>
            <Avatar className={classes.iconBadge}><DnsIcon fontSize="small" /></Avatar>
          </Box>
          <Typography className={classes.metricValue}>
            {metrics?.serverTime ? new Date(metrics.serverTime).toLocaleString("pt-BR") : "-"}
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper elevation={0} className={classes.card}>
          <Typography className={classes.sectionTitle}>Informações gerais</Typography>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Hostname</Typography><Typography className={classes.rowValue}>{metrics?.general?.hostname || "-"}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Plataforma</Typography><Typography className={classes.rowValue}>{metrics?.general?.platform || "-"}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Kernel / Release</Typography><Typography className={classes.rowValue}>{metrics?.general?.release || "-"}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Arquitetura</Typography><Typography className={classes.rowValue}>{metrics?.general?.arch || "-"}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Node</Typography><Typography className={classes.rowValue}>{metrics?.general?.nodeVersion || "-"}</Typography></Box>
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper elevation={0} className={classes.card}>
          <Typography className={classes.sectionTitle}>Memória</Typography>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Total</Typography><Typography className={classes.rowValue}>{formatBytes(metrics?.memory?.total)}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Em uso</Typography><Typography className={classes.rowValue}>{formatBytes(metrics?.memory?.used)}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Livre</Typography><Typography className={classes.rowValue}>{formatBytes(metrics?.memory?.free)}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Uso (%)</Typography><Typography className={classes.rowValue}>{Number(metrics?.memory?.usedPercent || 0).toFixed(1)}%</Typography></Box>
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper elevation={0} className={classes.card}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography className={classes.sectionTitle}>CPU</Typography>
            <MemoryIcon style={{ color: theme.palette.primary.main }} />
          </Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Modelo</Typography><Typography className={classes.rowValue}>{metrics?.cpu?.model || "-"}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Núcleos</Typography><Typography className={classes.rowValue}>{metrics?.cpu?.cores || 0}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Load 1m</Typography><Typography className={classes.rowValue}>{Number(metrics?.cpu?.loadAverage1m || 0).toFixed(2)}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Load 5m</Typography><Typography className={classes.rowValue}>{Number(metrics?.cpu?.loadAverage5m || 0).toFixed(2)}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Load 15m</Typography><Typography className={classes.rowValue}>{Number(metrics?.cpu?.loadAverage15m || 0).toFixed(2)}</Typography></Box>
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper elevation={0} className={classes.card}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography className={classes.sectionTitle}>Disco e Redis</Typography>
            <DeveloperBoardIcon style={{ color: theme.palette.primary.main }} />
          </Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Disco (mount)</Typography><Typography className={classes.rowValue}>{metrics?.disk?.mount || "/"}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Disco total</Typography><Typography className={classes.rowValue}>{formatBytes(metrics?.disk?.total)}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Disco usado</Typography><Typography className={classes.rowValue}>{formatBytes(metrics?.disk?.used)} ({Number(metrics?.disk?.usedPercent || 0).toFixed(0)}%)</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Disco livre</Typography><Typography className={classes.rowValue}>{formatBytes(metrics?.disk?.free)}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Redis status</Typography><Box display="flex" alignItems="center" style={{ gap: 8 }}><CloudQueueIcon style={{ color: statusData.redisColor, fontSize: 16 }} /><Typography className={classes.rowValue}>{String(statusData.redis).toUpperCase()}</Typography></Box></Box>
          {Number(metrics?.disk?.usedPercent || 0) >= 80 && (
            <Box className={classes.diskWarning}>
              <WarningIcon style={{ color: "#b91c1c", fontSize: 18, flexShrink: 0 }} />
              <Typography className={classes.diskWarningText}>
                Atenção: disco com {Number(metrics.disk.usedPercent).toFixed(0)}% de uso. Considere liberar espaço para evitar falhas.
              </Typography>
            </Box>
          )}
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper elevation={0} className={classes.card}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography className={classes.sectionTitle}>WuzAPI</Typography>
            <CloudQueueIcon style={{ color: wuzapiData.color, fontSize: 18 }} />
          </Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Status</Typography><Typography className={classes.rowValue}>{String(wuzapiData.status).toUpperCase()}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>URL</Typography><Typography className={classes.rowValue}>{wuzapiData.baseUrl}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Versão instalada</Typography><Typography className={classes.rowValue}>{wuzapiData.installedVersion || "-"}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Versão atual</Typography><Typography className={classes.rowValue}>{wuzapiData.latestVersion || "-"}</Typography></Box>
          {wuzapiData.latestVersion ? (
            <Box className={classes.row}>
              <Typography className={classes.rowLabel}>Atualização</Typography>
              {wuzapiData.isVersionMatch ? (
                <Typography className={classes.versionStatusOk}>Atualizado</Typography>
              ) : (
                <Typography className={classes.versionStatusWarning}>Desatualizado</Typography>
              )}
            </Box>
          ) : null}
          {wuzapiData.shouldShowUpdateLink ? (
            <Box className={classes.row}>
              <Typography className={classes.rowLabel}>Como atualizar</Typography>
              <Typography
                component="a"
                href={wuzapiData.details?.updateGuideUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={classes.updateLink}
              >
                Abrir documentação
              </Typography>
            </Box>
          ) : null}
          <Box className={classes.row}><Typography className={classes.rowLabel}>Uptime</Typography><Typography className={classes.rowValue}>{wuzapiData.details?.uptime || "-"}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Conexões ativas</Typography><Typography className={classes.rowValue}>{wuzapiData.details?.activeConnections ?? "-"}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Usuários totais</Typography><Typography className={classes.rowValue}>{wuzapiData.details?.totalUsers ?? "-"}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Usuários conectados</Typography><Typography className={classes.rowValue}>{wuzapiData.details?.connectedUsers ?? "-"}</Typography></Box>
          <Box className={classes.row}><Typography className={classes.rowLabel}>Usuários logados</Typography><Typography className={classes.rowValue}>{wuzapiData.details?.loggedInUsers ?? "-"}</Typography></Box>
          {wuzapiData.details?.message ? <Box className={classes.row}><Typography className={classes.rowLabel}>Mensagem</Typography><Typography className={classes.rowValue}>{wuzapiData.details.message}</Typography></Box> : null}
        </Paper>
      </Grid>
      {extraCards}
    </Grid>
  );

  if (embedded) {
    return metricsContent;
  }

  return (
    <div className={classes.root}>
      <Container maxWidth={false} className={classes.pageContainer}>
        <div className={classes.contentWrapper}>
          <Paper className={classes.pageBody} elevation={0}>
            {metricsContent}
          </Paper>
        </div>
      </Container>
    </div>
  );
};

export default ServerMetrics;
