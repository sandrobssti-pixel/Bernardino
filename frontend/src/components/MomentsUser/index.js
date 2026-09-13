import React, { Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";

import { AuthContext } from "../../context/Auth/AuthContext";
import {
  AccessTime,
  Fullscreen,
  FullscreenExit,
  ReportProblem,
  Tv,
  VisibilityOutlined
} from "@mui/icons-material";
import { toast } from "react-toastify";
import {
  Avatar,
  Box,
  CardHeader,
  Chip,
  IconButton,
  List,
  ListItem,
  Paper,
  Tooltip,
  Typography,
  makeStyles
} from "@material-ui/core";
import { format, isSameDay, parseISO } from "date-fns";

const DEFAULT_REFRESH_INTERVAL_MS = 2 * 60 * 1000;
const TV_REFRESH_INTERVAL_MS = 45 * 1000;

const SLA_WARNING_MIN = 15;
const SLA_DANGER_MIN = 40;

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";

  return {
    wrapper: {
      display: "flex",
      flexDirection: "column",
      flex: 1,
      minHeight: 0,
      width: "100%"
    },
    toolbar: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing(1),
      padding: theme.spacing(1.2, 1.4),
      borderRadius: 12,
      border: `1px solid ${isDark ? "rgba(148,163,184,0.22)" : "#dbe4ef"}`,
      background: isDark
        ? "linear-gradient(120deg, rgba(23,34,52,0.9) 0%, rgba(16,24,39,0.9) 100%)"
        : "linear-gradient(120deg, #f8fbff 0%, #f2f7ff 100%)",
      marginBottom: theme.spacing(1.1)
    },
    toolbarMetrics: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: theme.spacing(0.8),
      [theme.breakpoints.down("sm")]: {
        width: "100%"
      }
    },
    metricChip: {
      borderRadius: 8,
      fontWeight: 700,
      fontSize: "0.75rem",
      border: `1px solid ${isDark ? "rgba(148,163,184,0.22)" : "#dbe7f4"}`,
      color: isDark ? "#dbeafe" : "#1e3a8a",
      backgroundColor: isDark ? "rgba(30,64,175,0.2)" : "#eaf2ff"
    },
    toolbarActions: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(0.5),
      [theme.breakpoints.down("sm")]: {
        width: "100%",
        justifyContent: "flex-end"
      }
    },
    actionButton: {
      border: `1px solid ${isDark ? "rgba(148,163,184,0.3)" : "#d8e2ef"}`,
      borderRadius: 8,
      color: isDark ? "#e2e8f0" : "#334155",
      backgroundColor: isDark ? "rgba(15,23,42,0.45)" : "#ffffff"
    },
    container: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
      gap: theme.spacing(1.2),
      overflowY: "auto",
      paddingRight: theme.spacing(0.5),
      ...theme.scrollbarStyles,
      [theme.breakpoints.down("sm")]: {
        gridTemplateColumns: "1fr",
        gap: theme.spacing(1),
        paddingRight: 0
      }
    },
    column: {
      minWidth: 0,
      borderRadius: 12,
      border: `1px solid ${isDark ? "rgba(148,163,184,0.2)" : "#dfe7f1"}`,
      backgroundColor: isDark ? "#0f172a" : "#ffffff",
      boxShadow: isDark
        ? "0 12px 24px rgba(2, 6, 23, 0.45)"
        : "0 12px 24px rgba(15, 23, 42, 0.08)",
      display: "flex",
      flexDirection: "column",
      minHeight: 290,
      maxHeight: "calc(100vh - 260px)",
      [theme.breakpoints.down("sm")]: {
        maxHeight: "none",
        minHeight: 220
      }
    },
    columnHeader: {
      padding: theme.spacing(1.1),
      borderBottom: `1px solid ${isDark ? "rgba(148,163,184,0.18)" : "#e6edf6"}`,
      background: isDark
        ? "linear-gradient(140deg, rgba(30,41,59,0.92) 0%, rgba(15,23,42,0.92) 100%)"
        : "linear-gradient(140deg, #f4f8ff 0%, #eef4ff 100%)"
    },
    columnBody: {
      overflowY: "auto",
      ...theme.scrollbarStyles,
      padding: theme.spacing(0.4, 0.6, 0.8),
      [theme.breakpoints.down("sm")]: {
        maxHeight: "52vh"
      }
    },
    pendingIcon: {
      color: "#eab308",
      fontSize: 20
    },
    userName: {
      color: isDark ? "#f1f5f9" : "#0f172a",
      fontSize: "0.95rem",
      fontWeight: 700,
      lineHeight: 1.2
    },
    userSubtitle: {
      color: isDark ? "#94a3b8" : "#475569",
      fontSize: "0.78rem",
      fontWeight: 600,
      marginTop: 1
    },
    ticketRow: {
      borderRadius: 10,
      border: `1px solid ${isDark ? "rgba(148,163,184,0.18)" : "#e5ebf3"}`,
      backgroundColor: isDark ? "#111d33" : "#fbfdff",
      marginBottom: theme.spacing(0.8),
      paddingLeft: theme.spacing(0.5),
      overflow: "hidden"
    },
    ticketRowContent: {
      borderLeft: "4px solid transparent",
      borderRadius: 8,
      paddingLeft: theme.spacing(0.7),
      width: "100%",
      minWidth: 0
    },
    contactName: {
      color: isDark ? "#e2e8f0" : "#0f172a",
      fontSize: "0.86rem",
      fontWeight: 700,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: 220
      ,
      [theme.breakpoints.down("sm")]: {
        maxWidth: 170
      }
    },
    lastMessage: {
      color: isDark ? "#b8c4d7" : "#334155",
      fontSize: "0.78rem",
      marginTop: 2,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: 260
      ,
      [theme.breakpoints.down("sm")]: {
        maxWidth: 190
      }
    },
    ticketMeta: {
      display: "flex",
      gap: theme.spacing(0.5),
      marginTop: theme.spacing(0.6),
      flexWrap: "wrap"
    },
    tag: {
      height: 20,
      borderRadius: 6,
      fontWeight: 700,
      fontSize: "0.64rem"
    },
    timestamp: {
      color: isDark ? "#94a3b8" : "#64748b",
      fontSize: "0.72rem",
      fontWeight: 700,
      marginBottom: 2
    },
    rightSide: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: theme.spacing(0.4),
      minWidth: 118,
      flexShrink: 0,
      [theme.breakpoints.down("sm")]: {
        minWidth: 102
      }
    },
    slaChip: {
      maxWidth: "100%",
      "& .MuiChip-label": {
        paddingLeft: 7,
        paddingRight: 7,
        fontWeight: 700,
        fontSize: "0.66rem"
      }
    },
    eyeButton: {
      padding: 4
    },
    userTitleWrap: {
      display: "flex",
      alignItems: "center",
      gap: 8
    },
    userStatusDot: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      display: "inline-block",
      boxShadow: "0 0 0 2px rgba(148,163,184,0.2)"
    },
    userStatusText: {
      color: isDark ? "#94a3b8" : "#64748b",
      fontSize: "0.72rem",
      fontWeight: 600
    },
    emptyText: {
      color: isDark ? "#8ca0bc" : "#7b8ba1",
      textAlign: "center",
      marginTop: theme.spacing(4),
      fontSize: "0.86rem"
    }
  };
});

const getMinutesWithoutResponse = (ticket) => {
  const rawDate = ticket?.updatedAt || ticket?.lastMessageAt || ticket?.createdAt;
  if (!rawDate) return 0;
  const parsedDate = parseISO(rawDate);
  if (Number.isNaN(parsedDate.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - parsedDate.getTime()) / 60000));
};

const getSlaConfig = (minutes) => {
  if (minutes >= SLA_DANGER_MIN) {
    return {
      label: `Fora do prazo ${minutes}m`,
      color: "#ef4444",
      bg: "rgba(239,68,68,0.12)",
      border: "rgba(239,68,68,0.35)",
      level: 3
    };
  }

  if (minutes >= SLA_WARNING_MIN) {
    return {
      label: `Risco de atraso ${minutes}m`,
      color: "#d97706",
      bg: "rgba(245,158,11,0.14)",
      border: "rgba(245,158,11,0.35)",
      level: 2
    };
  }

  return {
    label: `Dentro do prazo ${minutes}m`,
    color: "#16a34a",
    bg: "rgba(34,197,94,0.14)",
    border: "rgba(34,197,94,0.35)",
    level: 1
  };
};

const sortByPriority = (tickets = []) => {
  return [...tickets].sort((a, b) => {
    const aMinutes = getMinutesWithoutResponse(a);
    const bMinutes = getMinutesWithoutResponse(b);
    return bMinutes - aMinutes;
  });
};

const formatTicketDate = (rawDate) => {
  if (!rawDate) return "--";
  const parsed = parseISO(rawDate);
  if (Number.isNaN(parsed.getTime())) return "--";

  return isSameDay(parsed, new Date())
    ? format(parsed, "HH:mm")
    : format(parsed, "dd/MM/yyyy");
};

const trimText = (value, maxLength) => {
  const text = String(value || "").trim();
  if (!text) return "Sem mensagem";
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
};

const getInitials = (name) => {
  const normalized = String(name || "").trim();
  if (!normalized) return "AT";

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
};

const DashboardManage = () => {
  const classes = useStyles();
  const history = useHistory();
  const { user, socket } = useContext(AuthContext);

  const [tickets, setTickets] = useState([]);
  const [tvMode, setTvMode] = useState(false);

  const companyId = user.companyId;
  const socketDebounceRef = useRef(null);

  const fetchMoments = useCallback(async () => {
    try {
      const { data } = await api.get("/usersMoments");
      setTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.response?.status !== 500) {
        toastError(err);
      } else {
        toast.error(`${i18n.t("frontEndErrors.getUsers")}`);
      }
    }
  }, []);

  const debouncedFetchMoments = useCallback(() => {
    if (socketDebounceRef.current) return;
    socketDebounceRef.current = setTimeout(() => {
      socketDebounceRef.current = null;
      fetchMoments();
    }, 3000);
  }, [fetchMoments]);

  useEffect(() => {
    fetchMoments();
  }, [fetchMoments]);

  useEffect(() => {
    const onAppMessage = (data) => {
      if (data.action === "create" || data.action === "update" || data.action === "delete") {
        debouncedFetchMoments();
      }
    };

    socket.on(`company-${companyId}-ticket`, onAppMessage);
    socket.on(`company-${companyId}-appMessage`, onAppMessage);

    return () => {
      socket.off(`company-${companyId}-ticket`, onAppMessage);
      socket.off(`company-${companyId}-appMessage`, onAppMessage);
      if (socketDebounceRef.current) {
        clearTimeout(socketDebounceRef.current);
        socketDebounceRef.current = null;
      }
    };
  }, [socket, companyId, debouncedFetchMoments]);

  useEffect(() => {
    const intervalMs = tvMode ? TV_REFRESH_INTERVAL_MS : DEFAULT_REFRESH_INTERVAL_MS;
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchMoments();
      }
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [fetchMoments, tvMode]);

  useEffect(() => {
    const onFullScreenChange = () => {
      if (!document.fullscreenElement) {
        setTvMode(false);
      }
    };

    document.addEventListener("fullscreenchange", onFullScreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullScreenChange);
  }, []);

  const groupedTickets = useMemo(() => {
    const pending = sortByPriority(
      tickets.filter((ticket) => !ticket.user && !ticket.userId)
    );

    const mapByUser = tickets
      .filter((ticket) => Boolean(ticket.user) || Boolean(ticket.userId))
      .reduce((acc, ticket) => {
        const fallbackUser = ticket.user || {
          id: ticket.userId,
          name:
            ticket.userId === user.id
              ? user.name
              : `Atendente #${ticket.userId}`,
          online: false,
          profileImage: null
        };
        const userId = fallbackUser.id;
        if (!userId) return acc;

        if (!acc[userId]) {
          acc[userId] = {
            user: fallbackUser,
            tickets: []
          };
        }

        acc[userId].tickets.push(ticket);
        return acc;
      }, {});

    const grouped = Object.values(mapByUser)
      .map((group) => ({
        ...group,
        tickets: sortByPriority(group.tickets),
        maxPriorityMinutes: getMinutesWithoutResponse(sortByPriority(group.tickets)[0])
      }))
      .sort((a, b) => b.maxPriorityMinutes - a.maxPriorityMinutes);

    return {
      pending,
      grouped
    };
  }, [tickets, user.id, user.name]);

  const metrics = useMemo(() => {
    const all = tickets || [];
    const warningCount = all.filter((ticket) => {
      const minutes = getMinutesWithoutResponse(ticket);
      return minutes >= SLA_WARNING_MIN && minutes < SLA_DANGER_MIN;
    }).length;

    const dangerCount = all.filter((ticket) => getMinutesWithoutResponse(ticket) >= SLA_DANGER_MIN)
      .length;

    return {
      total: all.length,
      pending: groupedTickets.pending.length,
      inSla: all.length - warningCount - dangerCount,
      warning: warningCount,
      danger: dangerCount
    };
  }, [tickets, groupedTickets.pending.length]);

  const toggleTvMode = async () => {
    try {
      if (!tvMode) {
        await document.documentElement.requestFullscreen?.();
        setTvMode(true);
        return;
      }

      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      setTvMode(false);
    } catch {
      toast.error("Não foi possível alternar o modo TV neste navegador.");
    }
  };

  const renderTicket = (ticket) => {
    const minutes = getMinutesWithoutResponse(ticket);
    const sla = getSlaConfig(minutes);
    const queueColor = ticket?.queue?.color || "#64748b";

    return (
      <List key={ticket.id} style={{ paddingTop: 0 }}>
        <ListItem dense button className={classes.ticketRow}>
          <Box className={classes.ticketRowContent} style={{ borderLeftColor: sla.color, width: "100%" }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" style={{ width: "100%", minWidth: 0 }}>
              <Box style={{ minWidth: 0 }}>
                <Box className={classes.contactName}>{trimText(ticket?.contact?.name, 28)}</Box>
                <Typography className={classes.lastMessage}>{trimText(ticket?.lastMessage, 42)}</Typography>
                <Box className={classes.ticketMeta}>
                  <Chip
                    label={String(ticket?.whatsapp?.name || "Sem conexão")}
                    size="small"
                    className={classes.tag}
                    style={{ backgroundColor: "#1d4ed8", color: "#fff" }}
                  />
                  <Chip
                    label={String(ticket?.queue?.name || "Sem fila")}
                    size="small"
                    className={classes.tag}
                    style={{ backgroundColor: queueColor, color: "#fff" }}
                  />
                </Box>
              </Box>

              <Box className={classes.rightSide}>
                <Typography className={classes.timestamp}>{formatTicketDate(ticket?.updatedAt)}</Typography>
                <Chip
                  label={sla.label}
                  size="small"
                  icon={<AccessTime style={{ fontSize: 13, color: sla.color }} />}
                  className={`${classes.tag} ${classes.slaChip}`}
                  style={{
                    color: sla.color,
                    backgroundColor: sla.bg,
                    border: `1px solid ${sla.border}`
                  }}
                />
                {(user.profile === "admin" || ticket.userId === user.id) && (
                  <Tooltip title="Acessar Ticket">
                    <IconButton
                      size="small"
                      onClick={() => history.push(`/tickets/${ticket.uuid}`)}
                      className={`${classes.actionButton} ${classes.eyeButton}`}
                    >
                      <VisibilityOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          </Box>
        </ListItem>
      </List>
    );
  };

  const renderUserColumn = (group) => (
    <Paper elevation={0} className={classes.column} key={`user-${group.user.id}`}>
      <Box className={classes.columnHeader}>
        <CardHeader
          style={{ padding: 0 }}
          avatar={
            <Avatar
              style={{
                background: "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)",
                color: "#fff",
                fontWeight: 800
              }}
            >
              {getInitials(group?.user?.name)}
            </Avatar>
          }
          title={(
            <Box className={classes.userTitleWrap}>
              <Typography className={classes.userName}>{group?.user?.name || "Atendente"}</Typography>
              <span
                className={classes.userStatusDot}
                style={{ backgroundColor: group?.user?.online ? "#22c55e" : "#94a3b8" }}
              />
            </Box>
          )}
          subheader={(
            <Box>
              <Typography className={classes.userSubtitle}>
                Atendimentos: {group.tickets.length}
              </Typography>
              <Typography className={classes.userStatusText}>
                {group?.user?.online ? "Online" : "Offline"}
              </Typography>
            </Box>
          )}
        />
      </Box>
      <Box className={classes.columnBody}>
        {group.tickets.length > 0 ? (
          group.tickets.map(renderTicket)
        ) : (
          <Typography className={classes.emptyText}>Sem tickets para este atendente.</Typography>
        )}
      </Box>
    </Paper>
  );

  const renderPendingColumn = () => (
    <Paper elevation={0} className={classes.column} key="pending-column">
      <Box className={classes.columnHeader}>
        <CardHeader
          style={{ padding: 0 }}
          avatar={
            <Avatar
              style={{
                background: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
                color: "#fff",
                boxShadow: "0 6px 16px rgba(249,115,22,0.35)"
              }}
            >
              <ReportProblem className={classes.pendingIcon} style={{ color: "#fff" }} />
            </Avatar>
          }
          title={(
            <Box display="flex" alignItems="center" gridGap={6}>
              <Typography className={classes.userName}>Pendentes</Typography>
              <ReportProblem className={classes.pendingIcon} />
            </Box>
          )}
          subheader={<Typography className={classes.userSubtitle}>Atendimentos: {groupedTickets.pending.length}</Typography>}
        />
      </Box>
      <Box className={classes.columnBody}>
        {groupedTickets.pending.length > 0 ? (
          groupedTickets.pending.map(renderTicket)
        ) : (
          <Typography className={classes.emptyText}>Sem tickets pendentes.</Typography>
        )}
      </Box>
    </Paper>
  );

  return (
    <Fragment>
      <Box className={classes.wrapper}>
        <Paper elevation={0} className={classes.toolbar}>
          <Box className={classes.toolbarMetrics}>
            <Chip label={`Total: ${metrics.total}`} className={classes.metricChip} size="small" />
            <Chip label={`Pendentes: ${metrics.pending}`} className={classes.metricChip} size="small" />
            <Chip
              label={`Dentro do prazo: ${metrics.inSla}`}
              className={classes.metricChip}
              size="small"
              style={{
                color: "#166534",
                backgroundColor: "rgba(34,197,94,0.16)",
                borderColor: "rgba(34,197,94,0.35)"
              }}
            />
            <Chip
              label={`Risco de atraso: ${metrics.warning}`}
              size="small"
              className={classes.metricChip}
              style={{ color: "#b45309", backgroundColor: "rgba(245,158,11,0.16)", borderColor: "rgba(245,158,11,0.3)" }}
            />
            <Chip
              label={`Fora do prazo: ${metrics.danger}`}
              size="small"
              className={classes.metricChip}
              style={{ color: "#b91c1c", backgroundColor: "rgba(239,68,68,0.16)", borderColor: "rgba(239,68,68,0.3)" }}
            />
          </Box>

          <Box className={classes.toolbarActions}>
            <Tooltip title="Ordenação por prioridade (mais antigo primeiro)">
              <Chip size="small" label="Prioridade: SLA" className={classes.metricChip} />
            </Tooltip>
            <Tooltip title={tvMode ? "Sair do modo TV" : "Ativar modo TV"}>
              <IconButton size="small" className={classes.actionButton} onClick={toggleTvMode}>
                <Tv fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={tvMode ? "Sair da tela cheia" : "Entrar em tela cheia"}>
              <IconButton size="small" className={classes.actionButton} onClick={toggleTvMode}>
                {tvMode ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>

        <Box className={classes.container}>
          {renderPendingColumn()}
          {groupedTickets.grouped.map(renderUserColumn)}
        </Box>
      </Box>
    </Fragment>
  );
};

export default DashboardManage;
