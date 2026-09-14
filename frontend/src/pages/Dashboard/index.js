import React, { useContext, useEffect, useMemo, useState, useRef } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Typography,
  Select,
  MenuItem,
  FormControl,
  IconButton,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress
} from "@mui/material";
import {
  AccessTime,
  QueryStats,
  TrendingUp,
  TrendingDown,
  Call,
  CheckCircle,
  Star,
  GpsFixed,
  Refresh,
  Message,
  People,
  SentimentVerySatisfied,
  SentimentNeutral,
  SentimentVeryDissatisfied,
  DateRange
} from "@mui/icons-material";
import { isArray } from "lodash";
import { toast } from "react-toastify";
import ReactECharts from "echarts-for-react";
import { useTheme as useThemeV4 } from "@material-ui/core/styles";

import { AuthContext } from "../../context/Auth/AuthContext";
import useDashboard from "../../hooks/useDashboard";
import ForbiddenPage from "../../components/ForbiddenPage";
import api from "../../services/api";
import { useHistory } from "react-router-dom";
import UserModal from "../../components/UserModal";
import TransferTicketModalCustom from "../../components/TransferTicketModalCustom";
import SubscriptionDueBanner from "../../components/SubscriptionDueBanner";

const getDashboardColors = (isDark) => ({
  textPrimary: isDark ? "#e6edf8" : "#0f172a",
  textSecondary: isDark ? "#a9b6cc" : "#475569",
  background: isDark ? "#0b1220" : "#f3f4f6",
  surface: isDark ? "#111b2e" : "#ffffff",
  elevated: isDark ? "#17233a" : "#f9fafb",
  border: isDark ? "rgba(148, 163, 184, 0.2)" : "#e5e7eb",
  divider: isDark ? "rgba(148, 163, 184, 0.12)" : "#f3f4f6"
});

const MetricCard = ({ icon, iconBg, title, value, subtitle, trend, trendValue, badge, badgeColor, badgeBg }) => {
  const themeV4 = useThemeV4();
  const colors = getDashboardColors(themeV4.mode === "dark");

  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp sx={{ fontSize: 12, color: '#10b981' }} />;
    if (trend === 'down') return <TrendingDown sx={{ fontSize: 12, color: '#ef4444' }} />;
    return <TrendingUp sx={{ fontSize: 12, color: '#6b7280' }} />;
  };

  const getTrendColor = () => {
    if (trend === 'up') return '#10b981';
    if (trend === 'down') return '#ef4444';
    return '#6b7280';
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          borderColor: themeV4.mode === "dark" ? "#334155" : "#d1d5db"
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ 
          width: 32, 
          height: 32, 
          borderRadius: 1, 
          backgroundColor: iconBg, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          {icon}
        </Box>
        {badge && (
          <Chip 
            label={badge} 
            size="small" 
            sx={{ 
              backgroundColor: badgeBg, 
              color: badgeColor, 
              fontSize: '0.625rem', 
              fontWeight: 600,
              height: 20
            }} 
          />
        )}
      </Box>
      <Box sx={{ mb: 0.5 }}>
        <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: colors.textPrimary, lineHeight: 1.2 }}>
          {value}
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: colors.textSecondary }}>
          {title}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
        {getTrendIcon()}
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: getTrendColor(), ml: 0.5 }}>
          {trendValue}
        </Typography>
        {subtitle && (
          <Typography sx={{ fontSize: '0.75rem', color: colors.textSecondary, ml: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

const ChartContainer = ({ title, subtitle, children, actions }) => {
  const themeV4 = useThemeV4();
  const colors = getDashboardColors(themeV4.mode === "dark");

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
        overflow: 'hidden'
      }}
    >
      <Box sx={{ p: 2.5, borderBottom: `1px solid ${colors.divider}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: colors.textPrimary }}>
              {title}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: colors.textSecondary }}>
              {subtitle}
            </Typography>
          </Box>
          {actions && <Box>{actions}</Box>}
        </Box>
      </Box>
      <Box sx={{ p: 2.5 }}>
        {children}
      </Box>
    </Paper>
  );
};

const formatDateYmd = (date) => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
};

const getPeriodDates = (period, customRange = {}) => {
  const now = new Date();
  const endDate = new Date(now);
  let startDate = new Date(now);

  if (period === "today") {
    return {
      date_from: formatDateYmd(startDate),
      date_to: formatDateYmd(endDate)
    };
  }

  if (period === "custom") {
    const dateFrom = customRange?.date_from;
    const dateTo = customRange?.date_to;
    if (!dateFrom || !dateTo || dateFrom > dateTo) return null;
    return { date_from: dateFrom, date_to: dateTo };
  }

  if (period === "30days") {
    startDate.setDate(startDate.getDate() - 29);
  } else {
    startDate.setDate(startDate.getDate() - 6);
  }

  return {
    date_from: formatDateYmd(startDate),
    date_to: formatDateYmd(endDate)
  };
};

const getLastMonthsRanges = (total = 6) => {
  const formatter = new Intl.DateTimeFormat("pt-BR", { month: "short" });
  return Array.from({ length: total }).map((_, idx) => {
    const offset = total - 1 - idx;
    const base = new Date();
    base.setMonth(base.getMonth() - offset, 1);

    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);

    return {
      label: formatter.format(start).replace(".", "").replace(/^./, (c) => c.toUpperCase()),
      date_from: formatDateYmd(start),
      date_to: formatDateYmd(end)
    };
  });
};

const formatDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return "-";

  const diffMs = Math.max(0, new Date(endDate).getTime() - new Date(startDate).getTime());
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
};

const formatDateKey = (date) => formatDateYmd(date);

const parsePtBrDate = (value) => {
  if (!value || typeof value !== "string") return null;
  const [day, month, year] = value.split("/");
  if (!day || !month || !year) return null;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

const Dashboard = () => {
  const history = useHistory();
  const themeV4 = useThemeV4();
  const primary = themeV4?.palette?.primary?.main || "#1976d2";
  const primaryDark = themeV4?.palette?.primary?.dark || primary;
  const isDarkMode = themeV4.mode === "dark";
  const dashboardColors = useMemo(() => getDashboardColors(isDarkMode), [isDarkMode]);
  const {
    textPrimary: DASHBOARD_TEXT_PRIMARY,
    textSecondary: DASHBOARD_TEXT_SECONDARY,
    background: DASHBOARD_BACKGROUND,
    surface: DASHBOARD_SURFACE,
    elevated: DASHBOARD_ELEVATED,
    border: DASHBOARD_BORDER
  } = dashboardColors;

  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [counters, setCounters] = useState({});
  const [attendants, setAttendants] = useState([]);
  const [ticketsSeries, setTicketsSeries] = useState({ labels: [], values: [] });
  const [activities, setActivities] = useState([]);
  const [npsEvolution, setNpsEvolution] = useState({ labels: [], values: [] });
  const [volumeView, setVolumeView] = useState("weekly");
  const [period, setPeriod] = useState("7days");
  const [customDateFrom, setCustomDateFrom] = useState(() => {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return formatDateYmd(start);
  });
  const [customDateTo, setCustomDateTo] = useState(() => formatDateYmd(new Date()));
  const [selectedAttendant, setSelectedAttendant] = useState(null);
  const [attendantDetailsOpen, setAttendantDetailsOpen] = useState(false);
  const [attendantDetailsLoading, setAttendantDetailsLoading] = useState(false);
  const [attendantMoments, setAttendantMoments] = useState([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [transferTicketModalOpen, setTransferTicketModalOpen] = useState(false);
  const [selectedActivityTicket, setSelectedActivityTicket] = useState(null);

  const { user } = useContext(AuthContext);
  const { find } = useDashboard();

  const volumeChartRef = useRef(null);
  const statusChartRef = useRef(null);
  const npsDonutChartRef = useRef(null);
  const npsEvolutionChartRef = useRef(null);
  const attendantsPerformanceChartRef = useRef(null);
  const attendantsLoadChartRef = useRef(null);

  const loadDashboard = async () => {
    const params = getPeriodDates(period, {
      date_from: customDateFrom,
      date_to: customDateTo
    });
    if (!params) return;

    setLoading(true);
    try {
      const [dashboardRes, momentsRes] = await Promise.all([
        find(params),
        api.get("/dashboard/moments", {
          params: {
            dateStart: params.date_from,
            dateEnd: params.date_to,
            showAll: true
          }
        })
      ]);

      setCounters(dashboardRes?.counters || {});
      setAttendants(isArray(dashboardRes?.attendants) ? dashboardRes.attendants : []);

      const rows = isArray(momentsRes?.data) ? momentsRes.data : [];
      setActivities(rows.slice(0, 5));
    } catch {
      toast.error("Nao foi possivel carregar os dados do dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const loadNpsHistory = async () => {
    try {
      const npsHistoryRes = await Promise.all(
        getLastMonthsRanges(6).map((monthRange) =>
          find({
            date_from: monthRange.date_from,
            date_to: monthRange.date_to
          })
        )
      );
      const monthRanges = getLastMonthsRanges(6);
      setNpsEvolution({
        labels: monthRanges.map((m) => m.label),
        values: npsHistoryRes.map((item) => Number(item?.counters?.npsScore || 0))
      });
    } catch {
      // silently fail — NPS chart will show empty data
    }
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customDateFrom, customDateTo, user.companyId]);

  useEffect(() => {
    if (tab === "nps") {
      loadNpsHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, period, customDateFrom, customDateTo, user.companyId]);

  const handleViewAttendant = async (attendant) => {
    const attendantId = Number(attendant?.id);
    if (!attendantId) {
      toast.info("Não foi possível abrir detalhes: atendente sem ID válido.");
      return;
    }

    const params = getPeriodDates(period, {
      date_from: customDateFrom,
      date_to: customDateTo
    }) || {};

    setSelectedAttendant(attendant);
    setAttendantDetailsOpen(true);
    setAttendantDetailsLoading(true);
    setAttendantMoments([]);

    try {
      const { data } = await api.get("/dashboard/moments", {
        params: {
          showAll: true,
          userId: attendantId,
          dateStart: params?.date_from,
          dateEnd: params?.date_to
        }
      });
      setAttendantMoments(isArray(data) ? data : []);
    } catch {
      toast.error("Não foi possível carregar os detalhes do atendente.");
      setAttendantMoments([]);
    } finally {
      setAttendantDetailsLoading(false);
    }
  };

  const handleEditAttendant = (attendant) => {
    const attendantId = Number(attendant?.id);
    if (!attendantId) {
      toast.info("Não foi possível editar: atendente sem ID válido.");
      return;
    }
    setSelectedUserId(attendantId);
    setUserModalOpen(true);
  };

  const handleCloseUserModal = () => {
    setUserModalOpen(false);
    setSelectedUserId(null);
    loadDashboard();
  };

  const handleViewActivityTicket = (ticket) => {
    if (!ticket?.uuid) {
      toast.info("Não foi possível abrir este ticket porque o identificador não foi encontrado.");
      return;
    }

    history.push(`/tickets/${ticket.uuid}`);
  };

  const handleOpenTransferTicketModal = (ticket) => {
    if (!ticket?.id) {
      toast.info("Não foi possível transferir este ticket porque o identificador não foi encontrado.");
      return;
    }

    setSelectedActivityTicket(ticket);
    setTransferTicketModalOpen(true);
  };

  const handleCloseTransferTicketModal = () => {
    setTransferTicketModalOpen(false);
    setSelectedActivityTicket(null);
  };

  const loadVolumeChart = async () => {
    try {
      const today = new Date();
      const todayYmd = formatDateYmd(today);

      if (volumeView === "daily") {
        const { data } = await api.get("/dashboard/ticketsDay", {
          params: {
            initialDate: todayYmd,
            finalDate: todayYmd,
            companyId: user.companyId
          }
        });

        const raw = isArray(data?.data) ? data.data : [];
        const map = new Map();
        raw.forEach((item) => {
          const hour = Number(item?.horario);
          map.set(hour, Number(item?.total || 0));
        });

        const labels = Array.from({ length: 24 }).map((_, h) => `${String(h).padStart(2, "0")}h`);
        const values = Array.from({ length: 24 }).map((_, h) => map.get(h) || 0);
        setTicketsSeries({ labels, values });
        return;
      }

      if (volumeView === "weekly") {
        const start = new Date(today);
        start.setDate(today.getDate() - 6);
        const { data } = await api.get("/dashboard/ticketsDay", {
          params: {
            initialDate: formatDateYmd(start),
            finalDate: todayYmd,
            companyId: user.companyId
          }
        });

        const raw = isArray(data?.data) ? data.data : [];
        const map = new Map();
        raw.forEach((item) => {
          const parsed = parsePtBrDate(item?.data);
          if (parsed) map.set(formatDateKey(parsed), Number(item?.total || 0));
        });

        const labels = [];
        const values = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          const weekLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
            .format(d)
            .replace(".", "")
            .replace(/^./, (c) => c.toUpperCase());
          labels.push(weekLabel);
          values.push(map.get(formatDateKey(d)) || 0);
        }
        setTicketsSeries({ labels, values });
        return;
      }

      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const { data } = await api.get("/dashboard/ticketsDay", {
        params: {
          initialDate: formatDateYmd(monthStart),
          finalDate: todayYmd,
          companyId: user.companyId
        }
      });

      const raw = isArray(data?.data) ? data.data : [];
      const map = new Map();
      raw.forEach((item) => {
        const parsed = parsePtBrDate(item?.data);
        if (parsed) map.set(parsed.getDate(), Number(item?.total || 0));
      });

      const lastDay = today.getDate();
      const labels = Array.from({ length: lastDay }).map((_, idx) => String(idx + 1));
      const values = Array.from({ length: lastDay }).map((_, idx) => map.get(idx + 1) || 0);
      setTicketsSeries({ labels, values });
    } catch {
      setTicketsSeries({ labels: [], values: [] });
    }
  };

  useEffect(() => {
    loadVolumeChart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volumeView, user.companyId]);

  const metrics = useMemo(() => {
    const supportHappening = Number(counters?.supportHappening || 0);
    const supportPending = Number(counters?.supportPending || 0);
    const supportFinished = Number(counters?.supportFinished || 0);

    const totalAttendances = supportHappening + supportPending + supportFinished;

    return {
      supportHappening,
      supportPending,
      supportFinished,
      totalAttendances,
      avgSupportTime: Number(counters?.avgSupportTime || 0),
      avgWaitTime: Number(counters?.avgWaitTime || 0),
      withRating: Number(counters?.withRating || 0),
      waitRating: Number(counters?.waitRating || 0),
      activeTickets: Number(counters?.activeTickets || 0),
      npsScore: Number(counters?.npsScore || 0),
      npsPromotersPerc: Number(counters?.npsPromotersPerc || 0),
      npsPassivePerc: Number(counters?.npsPassivePerc || 0),
      npsDetractorsPerc: Number(counters?.npsDetractorsPerc || 0),
      percRating: Math.round(Number(counters?.percRating || 0)),
      waitingRate: totalAttendances > 0 ? Math.round((supportPending / totalAttendances) * 100) : 0,
      finishedRate: totalAttendances > 0 ? Math.round((supportFinished / totalAttendances) * 100) : 0,
      happeningRate: totalAttendances > 0 ? Math.round((supportHappening / totalAttendances) * 100) : 0
    };
  }, [counters]);

  const ranking = useMemo(() => {
    if (!attendants.length) return [];

    return [...attendants]
      .sort((a, b) => Number(b?.tickets || 0) - Number(a?.tickets || 0))
      .slice(0, 7)
      .map((agent) => ({
        name: agent?.name || "-",
        tickets: Number(agent?.tickets || 0)
      }));
  }, [attendants]);

  // Chart options
  const volumeChartOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ticketsSeries.labels,
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#6b7280', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#6b7280', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f3f4f6' } }
    },
    series: [{
      name: 'Atendimentos',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      showSymbol: true,
      symbolSize: 7,
      data: ticketsSeries.values,
      itemStyle: { color: '#6366f1', borderWidth: 2, borderColor: '#fff' },
      lineStyle: { width: 3, color: '#6366f1' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(99, 102, 241, 0.3)' },
            { offset: 1, color: 'rgba(99, 102, 241, 0.05)' }
          ]
        }
      }
    }]
  }), [ticketsSeries]);

  const npsDonutChartOption = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151' }
    },
    series: [{
      name: 'NPS',
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '50%'],
      data: [
        { value: metrics.npsPromotersPerc, name: 'Promotores', itemStyle: { color: '#10b981' } },
        { value: metrics.npsPassivePerc, name: 'Neutros', itemStyle: { color: '#f59e0b' } },
        { value: metrics.npsDetractorsPerc, name: 'Detratores', itemStyle: { color: '#ef4444' } }
      ],
      label: { show: false },
      labelLine: { show: false }
    }]
  }), [metrics]);

  const npsEvolutionChartOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: npsEvolution.labels,
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#6b7280', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#6b7280', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f3f4f6' } }
    },
    series: [{
      name: 'NPS',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 4,
      data: npsEvolution.values,
      itemStyle: { color: '#10b981', borderWidth: 2, borderColor: '#fff' },
      lineStyle: { width: 2, color: '#10b981' }
    }]
  }), [npsEvolution]);

  const attendantsPerformanceChartOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ranking.map(r => r.name),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#6b7280', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#6b7280', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f3f4f6' } }
    },
    series: [{
      name: 'Tickets',
      type: 'bar',
      data: ranking.map(r => r.tickets),
      itemStyle: { color: '#6366f1' }
    }]
  }), [ranking]);

  const attendantsLoadChartOption = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151' }
    },
    series: [{
      name: 'Carga',
      type: 'pie',
      radius: '70%',
      data: attendants.slice(0, 5).map(attendant => ({
        value: attendant.tickets || 0,
        name: attendant.name || 'Desconhecido'
      })),
      itemStyle: {
        color: function(params) {
          const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
          return colors[params.dataIndex % colors.length];
        }
      }
    }]
  }), [attendants]);

  const statusChartOption = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151' }
    },
    legend: {
      orient: 'horizontal',
      bottom: '0%',
      itemGap: 20,
      textStyle: { fontSize: 11, color: '#6b7280' }
    },
    series: [{
      name: 'Status',
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '45%'],
      data: [
        { value: metrics.supportHappening, name: 'Em atendimento', itemStyle: { color: '#3b82f6' } },
        { value: metrics.supportPending, name: 'Aguardando', itemStyle: { color: '#f59e0b' } },
        { value: metrics.supportFinished, name: 'Finalizados', itemStyle: { color: '#10b981' } }
      ],
      label: { show: false },
      labelLine: { show: false }
    }]
  }), [metrics]);

  const formatTime = (minutes) => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const exportToExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(
        attendants.map(attendant => ({
          'Atendente': attendant.name || '-',
          'Tickets': attendant.tickets || 0,
          'Status': attendant.online ? 'Online' : 'Offline',
          'T.M. Atendimento': formatTime(Number(attendant.avgSupportTime || 0)),
          'Satisfação': Number(attendant.rating || 0)
        }))
      );
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Atendentes");
      XLSX.writeFile(workbook, "atendentes_dashboard.xlsx");
      toast.success("Dados exportados com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar dados.");
    }
  };

  if (user.profile === "user" && user.showDashboard === "disabled") {
    return <ForbiddenPage />;
  }

  return (
    <Box
      sx={{
        minHeight: "calc(100% - 48px)",
        py: { xs: 1, md: 2 },
        px: { xs: 1, md: 2 },
        backgroundColor: DASHBOARD_BACKGROUND,
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      }}
    >
      <SubscriptionDueBanner />

      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          mb: 2,
          p: 2,
          borderRadius: 2,
          color: DASHBOARD_TEXT_PRIMARY,
          backgroundColor: DASHBOARD_SURFACE,
          border: `1px solid ${DASHBOARD_BORDER}`
        }}
      >
        <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: DASHBOARD_TEXT_PRIMARY }}>
                Dashboard
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: DASHBOARD_TEXT_SECONDARY }}>
                Visão geral do sistema
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
            {period === "custom" && (
              <>
                <TextField
                  size="small"
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  sx={{ width: { xs: '100%', sm: 150 } }}
                  inputProps={{ max: customDateTo }}
                />
                <TextField
                  size="small"
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  sx={{ width: { xs: '100%', sm: 150 } }}
                  inputProps={{ min: customDateFrom }}
                />
              </>
            )}
            <FormControl size="small">
              <Select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                sx={{ 
                  fontSize: '0.875rem',
                  minWidth: 120,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: DASHBOARD_BORDER
                  }
                }}
              >
                <MenuItem value="7days">Últimos 7 dias</MenuItem>
                <MenuItem value="30days">Últimos 30 dias</MenuItem>
                <MenuItem value="today">Hoje</MenuItem>
                <MenuItem value="custom">Personalizado</MenuItem>
              </Select>
            </FormControl>
            
            <IconButton
              sx={{ border: `1px solid ${DASHBOARD_BORDER}` }}
              onClick={() => {
                loadDashboard();
                loadVolumeChart();
                if (tab === "nps") loadNpsHistory();
              }}
              disabled={loading}
            >
              <Refresh sx={{ fontSize: 16, color: '#6b7280' }} />
            </IconButton>
          </Box>
        </Box>
      </Paper>

      {/* Tabs Navigation */}
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          mb: 2,
          p: 0.5,
          borderRadius: 2,
          backgroundColor: DASHBOARD_SURFACE,
          border: `1px solid ${DASHBOARD_BORDER}`
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button
            onClick={() => setTab("overview")}
            sx={{
              flex: 1,
              textTransform: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              py: 1,
              px: 2,
              borderRadius: 1.5,
              backgroundColor: tab === 'overview' ? primary : 'transparent',
              color: tab === 'overview' ? 'white' : DASHBOARD_TEXT_SECONDARY,
              border: tab === 'overview' ? `1px solid ${primary}` : `1px solid transparent`,
              '&:hover': {
                backgroundColor: tab === 'overview' ? primaryDark : DASHBOARD_ELEVATED
              }
            }}
            startIcon={<QueryStats sx={{ fontSize: 16 }} />}
          >
            Visão Geral
          </Button>
          <Button
            onClick={() => setTab("nps")}
            sx={{
              flex: 1,
              textTransform: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              py: 1,
              px: 2,
              borderRadius: 1.5,
              backgroundColor: tab === 'nps' ? primary : 'transparent',
              color: tab === 'nps' ? 'white' : DASHBOARD_TEXT_SECONDARY,
              border: tab === 'nps' ? `1px solid ${primary}` : `1px solid transparent`,
              '&:hover': {
                backgroundColor: tab === 'nps' ? primaryDark : DASHBOARD_ELEVATED
              }
            }}
            startIcon={<Star sx={{ fontSize: 16 }} />}
          >
            NPS
          </Button>
          <Button
            onClick={() => setTab("attendants")}
            sx={{
              flex: 1,
              textTransform: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              py: 1,
              px: 2,
              borderRadius: 1.5,
              backgroundColor: tab === 'attendants' ? primary : 'transparent',
              color: tab === 'attendants' ? 'white' : DASHBOARD_TEXT_SECONDARY,
              border: tab === 'attendants' ? `1px solid ${primary}` : `1px solid transparent`,
              '&:hover': {
                backgroundColor: tab === 'attendants' ? primaryDark : DASHBOARD_ELEVATED
              }
            }}
            startIcon={<People sx={{ fontSize: 16 }} />}
          >
            Atendentes
          </Button>
        </Box>
      </Paper>

      {/* Tab Content: Overview */}
      {tab === "overview" && (
        <Box>
          {/* 8 KPI Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                icon={<Call sx={{ fontSize: 16, color: '#2563eb' }} />}
                iconBg="#dbeafe"
                title="Em atendimento"
                value={metrics.supportHappening}
                subtitle="vs. ontem"
                trend="up"
                trendValue={`${metrics.happeningRate}% do total`}
                badge="Ao vivo"
                badgeColor="#2563eb"
                badgeBg="#dbeafe"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                icon={<AccessTime sx={{ fontSize: 16, color: '#d97706' }} />}
                iconBg="#fef3c7"
                title="Aguardando"
                value={metrics.supportPending}
                subtitle="vs. ontem"
                trend="down"
                trendValue={`${metrics.waitingRate}% do total`}
                badge="Fila"
                badgeColor="#d97706"
                badgeBg="#fef3c7"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                icon={<CheckCircle sx={{ fontSize: 16, color: '#059669' }} />}
                iconBg="#d1fae5"
                title="Finalizados"
                value={metrics.supportFinished}
                subtitle="vs. ontem"
                trend="up"
                trendValue={`${metrics.finishedRate}% do total`}
                badge="Hoje"
                badgeColor="#059669"
                badgeBg="#d1fae5"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                icon={<Star sx={{ fontSize: 16, color: '#7c3aed' }} />}
                iconBg="#ede9fe"
                title="Satisfação"
                value={`${metrics.npsScore}%`}
                subtitle="vs. mês"
                trend="up"
                trendValue={`${metrics.withRating} avaliações`}
                badge="NPS"
                badgeColor="#7c3aed"
                badgeBg="#ede9fe"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                icon={<AccessTime sx={{ fontSize: 16, color: '#4f46e5' }} />}
                iconBg="#e0e7ff"
                title="Espera média"
                value={formatTime(metrics.avgWaitTime)}
                trend="up"
                trendValue={`${Math.round(metrics.avgWaitTime)} min`}
                badge="Tempo"
                badgeColor="#4f46e5"
                badgeBg="#e0e7ff"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                icon={<GpsFixed sx={{ fontSize: 16, color: '#047857' }} />}
                iconBg="#d1fae5"
                title="Resolução"
                value={`${metrics.finishedRate}%`}
                trend="up"
                trendValue={`${metrics.supportFinished} finalizados`}
                badge="Meta"
                badgeColor="#047857"
                badgeBg="#d1fae5"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                icon={<Message sx={{ fontSize: 16, color: '#06b6d4' }} />}
                iconBg="#cffafe"
                title="Tickets ativos"
                value={metrics.activeTickets}
                trend="neutral"
                trendValue={`${metrics.totalAttendances} no período`}
                badge="Hoje"
                badgeColor="#06b6d4"
                badgeBg="#cffafe"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                icon={<People sx={{ fontSize: 16, color: '#ec4899' }} />}
                iconBg="#fce7f3"
                title="Atendentes"
                value={attendants.length}
                trend="up"
                trendValue={`${attendants.length ? Math.round((attendants.filter((item) => item?.online).length / attendants.length) * 100) : 0}% online`}
                badge="Online"
                badgeColor="#ec4899"
                badgeBg="#fce7f3"
              />
            </Grid>
          </Grid>

          {/* Charts Row */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <ChartContainer
                title="Volume de Atendimentos"
                subtitle="Período selecionado"
                actions={
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      onClick={() => setVolumeView("daily")}
                      sx={{
                        fontSize: '0.75rem',
                        color: volumeView === "daily" ? "white" : '#6b7280',
                        backgroundColor: volumeView === "daily" ? primary : "transparent",
                        '&:hover': { backgroundColor: volumeView === "daily" ? primaryDark : DASHBOARD_ELEVATED }
                      }}
                    >
                      Diário
                    </Button>
                    <Button
                      size="small"
                      onClick={() => setVolumeView("weekly")}
                      sx={{
                        fontSize: '0.75rem',
                        color: volumeView === "weekly" ? "white" : '#6b7280',
                        backgroundColor: volumeView === "weekly" ? primary : "transparent",
                        '&:hover': { backgroundColor: volumeView === "weekly" ? primaryDark : DASHBOARD_ELEVATED }
                      }}
                    >
                      Semanal
                    </Button>
                    <Button
                      size="small"
                      onClick={() => setVolumeView("monthly")}
                      sx={{
                        fontSize: '0.75rem',
                        color: volumeView === "monthly" ? "white" : '#6b7280',
                        backgroundColor: volumeView === "monthly" ? primary : "transparent",
                        '&:hover': { backgroundColor: volumeView === "monthly" ? primaryDark : DASHBOARD_ELEVATED }
                      }}
                    >
                      Mensal
                    </Button>
                  </Box>
                }
              >
                {!ticketsSeries.values.length && (
                  <Typography sx={{ fontSize: '0.75rem', color: '#6b7280', mb: 1 }}>
                    Sem dados para o período/granularidade selecionados.
                  </Typography>
                )}
                <ReactECharts option={volumeChartOption} style={{ height: 250 }} ref={volumeChartRef} />
              </ChartContainer>
            </Grid>
            <Grid item xs={12} md={6}>
              <ChartContainer
                title="Distribuição de Status"
                subtitle="Tempo real"
              >
                <ReactECharts option={statusChartOption} style={{ height: 250 }} ref={statusChartRef} />
              </ChartContainer>
            </Grid>
          </Grid>

          {/* Activity Table */}
          <ChartContainer
            title="Atividades Recentes"
                subtitle="Últimas atualizações"
            actions={<Button size="small" sx={{ fontSize: '0.75rem', color: '#4f46e5' }} onClick={() => { loadDashboard(); loadVolumeChart(); }}>Atualizar</Button>}
          >
            <TableContainer>
              <Table>
                <TableHead sx={{ backgroundColor: DASHBOARD_ELEVATED }}>
                  <TableRow>
                    <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Atendente</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Cliente</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Status</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Tempo</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activities.length ? activities.map((ticket) => {
                    const userName = ticket?.user?.name || "Sem atendente";
                    const contactName = ticket?.contact?.name || "Sem contato";
                    const channelName = ticket?.queue?.name || "Canal não informado";
                    const status = ticket?.status || "pending";
                    const statusLabel = status === "open"
                      ? "Em atendimento"
                      : status === "pending"
                      ? "Aguardando"
                      : status === "closed"
                      ? "Finalizado"
                      : status;
                    const statusStyle = status === "open"
                      ? { backgroundColor: '#d1fae5', color: '#059669' }
                      : status === "pending"
                      ? { backgroundColor: '#fef3c7', color: '#d97706' }
                      : { backgroundColor: '#e5e7eb', color: '#374151' };

                    return (
                      <TableRow key={ticket.id} sx={{ '&:hover': { backgroundColor: DASHBOARD_ELEVATED } }}>
                        <TableCell sx={{ py: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 24, height: 24, backgroundColor: '#dbeafe', fontSize: '0.625rem' }}>
                              {userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: DASHBOARD_TEXT_PRIMARY }}>{userName}</Typography>
                              <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                {ticket?.user ? "Online" : "Sem usuário"}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Box>
                            <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: DASHBOARD_TEXT_PRIMARY }}>{contactName}</Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>{channelName}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Chip label={statusLabel} size="small" sx={{ fontSize: '0.75rem', ...statusStyle }} />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.875rem', color: '#6b7280', py: 1.5 }}>
                          {formatDuration(ticket?.createdAt, ticket?.updatedAt)}
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Button
                            size="small"
                            sx={{ fontSize: '0.75rem', color: '#4f46e5', mr: 1 }}
                            onClick={() => handleViewActivityTicket(ticket)}
                          >
                            Ver
                          </Button>
                          <Button
                            size="small"
                            sx={{ fontSize: '0.75rem', color: '#6b7280' }}
                            onClick={() => handleOpenTransferTicketModal(ticket)}
                          >
                            Transferir
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ py: 2, textAlign: "center", color: "#6b7280" }}>
                        Nenhuma atividade no período selecionado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </ChartContainer>

        </Box>
      )}

      {/* Tab Content: NPS */}
      {tab === "nps" && (
        <Box>
          {/* NPS Header Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <ChartContainer title="NPS Geral" subtitle="Índice de satisfação">
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ 
                    fontSize: '3rem', 
                    fontWeight: 800, 
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 2
                  }}>
                    {metrics.npsScore}
                  </Typography>
                  <ReactECharts option={npsDonutChartOption} style={{ height: 200 }} ref={npsDonutChartRef} />
                  <Typography sx={{ fontSize: '0.75rem', color: '#6b7280', mt: 2 }}>
                    Índice calculado por promotores - detratores no período
                  </Typography>
                </Box>
              </ChartContainer>
            </Grid>
            <Grid item xs={12} md={8}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: `1px solid ${DASHBOARD_BORDER}`,
                      backgroundColor: DASHBOARD_SURFACE,
                      textAlign: 'center',
                      height: '100%'
                    }}
                  >
                    <Box sx={{ 
                      width: 48, 
                      height: 48, 
                      backgroundColor: '#d1fae5', 
                      borderRadius: 1, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 1.5
                    }}>
                      <SentimentVerySatisfied sx={{ fontSize: 24, color: '#059669' }} />
                    </Box>
                    <Typography sx={{ fontSize: '2rem', fontWeight: 700, color: '#059669', mb: 0.5 }}>
                      {metrics.npsPromotersPerc}%
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: DASHBOARD_TEXT_PRIMARY, mb: 0.5 }}>
                      Promotores
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      Clientes satisfeitos
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: `1px solid ${DASHBOARD_BORDER}`,
                      backgroundColor: DASHBOARD_SURFACE,
                      textAlign: 'center',
                      height: '100%'
                    }}
                  >
                    <Box sx={{ 
                      width: 48, 
                      height: 48, 
                      backgroundColor: '#fef3c7', 
                      borderRadius: 1, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 1.5
                    }}>
                      <SentimentNeutral sx={{ fontSize: 24, color: '#d97706' }} />
                    </Box>
                    <Typography sx={{ fontSize: '2rem', fontWeight: 700, color: '#d97706', mb: 0.5 }}>
                      {metrics.npsPassivePerc}%
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: DASHBOARD_TEXT_PRIMARY, mb: 0.5 }}>
                      Neutros
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      Clientes passivos
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: `1px solid ${DASHBOARD_BORDER}`,
                      backgroundColor: DASHBOARD_SURFACE,
                      textAlign: 'center',
                      height: '100%'
                    }}
                  >
                    <Box sx={{ 
                      width: 48, 
                      height: 48, 
                      backgroundColor: '#fee2e2', 
                      borderRadius: 1, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 1.5
                    }}>
                      <SentimentVeryDissatisfied sx={{ fontSize: 24, color: '#dc2626' }} />
                    </Box>
                    <Typography sx={{ fontSize: '2rem', fontWeight: 700, color: '#dc2626', mb: 0.5 }}>
                      {metrics.npsDetractorsPerc}%
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: DASHBOARD_TEXT_PRIMARY, mb: 0.5 }}>
                      Detratores
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      Clientes insatisfeitos
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* NPS Metrics Row */}
              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={12} sm={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      border: `1px solid ${DASHBOARD_BORDER}`,
                      backgroundColor: DASHBOARD_SURFACE
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>Aguardando avaliação</Typography>
                      <AccessTime sx={{ fontSize: 16, color: '#6b7280' }} />
                    </Box>
                    <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: DASHBOARD_TEXT_PRIMARY }}>
                      {metrics.waitRating}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      border: `1px solid ${DASHBOARD_BORDER}`,
                      backgroundColor: DASHBOARD_SURFACE
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>Com avaliação</Typography>
                      <CheckCircle sx={{ fontSize: 16, color: '#059669' }} />
                    </Box>
                    <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: DASHBOARD_TEXT_PRIMARY }}>
                      {metrics.withRating}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      border: `1px solid ${DASHBOARD_BORDER}`,
                      backgroundColor: DASHBOARD_SURFACE
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>Taxa de avaliação</Typography>
                      <TrendingUp sx={{ fontSize: 16, color: '#059669' }} />
                    </Box>
                    <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: DASHBOARD_TEXT_PRIMARY }}>
                      {metrics.percRating}%
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Grid>
          </Grid>

          {/* NPS Evolution Chart */}
          <ChartContainer
            title="Evolução do NPS"
            subtitle="Últimos 6 meses"
            actions={<Button size="small" sx={{ fontSize: '0.75rem', color: '#4f46e5' }}>Exportar</Button>}
          >
            <ReactECharts option={npsEvolutionChartOption} style={{ height: 300 }} ref={npsEvolutionChartRef} />
          </ChartContainer>
        </Box>
      )}

      {/* Tab Content: Attendants */}
      {tab === "attendants" && (
        <Box>
          {/* Atendentes Header Metrics */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                icon={<AccessTime sx={{ fontSize: 16, color: '#2563eb' }} />}
                iconBg="#dbeafe"
                title="T.M. espera"
                value={formatTime(metrics.avgWaitTime)}
                badge="Tempo"
                badgeColor="#2563eb"
                badgeBg="#dbeafe"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                icon={<Call sx={{ fontSize: 16, color: '#059669' }} />}
                iconBg="#d1fae5"
                title="T.M. atendimento"
                value={formatTime(metrics.avgSupportTime)}
                badge="Atendimento"
                badgeColor="#059669"
                badgeBg="#d1fae5"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                icon={<People sx={{ fontSize: 16, color: '#7c3aed' }} />}
                iconBg="#ede9fe"
                title="Atendentes online"
                value={attendants.filter((item) => item?.online).length}
                badge="Online"
                badgeColor="#7c3aed"
                badgeBg="#ede9fe"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                icon={<DateRange sx={{ fontSize: 16, color: '#d97706' }} />}
                iconBg="#fef3c7"
                title="Total atendentes"
                value={attendants.length}
                badge="Período"
                badgeColor="#d97706"
                badgeBg="#fef3c7"
              />
            </Grid>
          </Grid>

          {/* Atendentes Performance Charts */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <ChartContainer
                title="Performance dos Atendentes"
                subtitle="Tickets por atendente"
                actions={<Button size="small" sx={{ fontSize: '0.75rem', color: '#4f46e5' }}>Ver todos</Button>}
              >
                <ReactECharts option={attendantsPerformanceChartOption} style={{ height: 300 }} ref={attendantsPerformanceChartRef} />
              </ChartContainer>
            </Grid>
            <Grid item xs={12} md={6}>
              <ChartContainer
                title="Distribuição de Carga"
                subtitle="Balanceamento de atendimentos"
              >
                <ReactECharts option={attendantsLoadChartOption} style={{ height: 300 }} ref={attendantsLoadChartRef} />
              </ChartContainer>
            </Grid>
          </Grid>

          {/* Attendants Table */}
          <ChartContainer
            title="Status dos Atendentes"
            subtitle="Visão detalhada da equipe"
            actions={
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" sx={{ fontSize: '0.75rem', color: '#4f46e5' }} onClick={exportToExcel}>
                  Exportar
                </Button>
                <Button size="small" sx={{ fontSize: '0.75rem', color: '#4f46e5' }} onClick={loadDashboard}>
                  Atualizar
                </Button>
              </Box>
            }
          >
            <TableContainer>
              <Table id="grid-attendants">
                <TableHead sx={{ backgroundColor: DASHBOARD_ELEVATED }}>
                  <TableRow>
                    <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Atendente</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Status</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Tickets</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>T.M. Atendimento</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Satisfação</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {attendants.slice(0, 5).map((attendant, index) => (
                    <TableRow key={index} sx={{ '&:hover': { backgroundColor: DASHBOARD_ELEVATED } }}>
                      <TableCell sx={{ py: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 32, height: 32, backgroundColor: '#dbeafe', fontSize: '0.75rem' }}>
                            {attendant.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </Avatar>
                          <Box>
                            <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: DASHBOARD_TEXT_PRIMARY }}>
                              {attendant.name || '-'}
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: '#059669' }}>
                              {attendant.online ? "Online" : "Offline"}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        <Chip 
                          label={Number(attendant.tickets || 0) > 0 ? "Em atendimento" : "Sem tickets"}
                          size="small" 
                          sx={{
                            fontSize: '0.75rem',
                            backgroundColor: Number(attendant.tickets || 0) > 0 ? '#d1fae5' : '#e5e7eb',
                            color: Number(attendant.tickets || 0) > 0 ? '#059669' : '#374151'
                          }} 
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.875rem', color: DASHBOARD_TEXT_PRIMARY, py: 1.5 }}>
                        {attendant.tickets || 0}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.875rem', color: DASHBOARD_TEXT_PRIMARY, py: 1.5 }}>
                        {formatTime(Number(attendant.avgSupportTime || 0))}
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: '#059669' }}>
                            {Number(attendant.rating || 0).toFixed(1)}
                          </Typography>
                          <Star sx={{ fontSize: 12, color: '#fbbf24' }} />
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        <Button
                          size="small"
                          sx={{ fontSize: '0.75rem', color: '#4f46e5', mr: 1 }}
                          onClick={() => handleViewAttendant(attendant)}
                        >
                          Ver
                        </Button>
                        <Button
                          size="small"
                          sx={{ fontSize: '0.75rem', color: '#6b7280' }}
                          onClick={() => handleEditAttendant(attendant)}
                        >
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </ChartContainer>

          <Dialog
            open={attendantDetailsOpen}
            onClose={() => setAttendantDetailsOpen(false)}
            fullWidth
            maxWidth="md"
          >
            <DialogTitle>
              Detalhes do atendente {selectedAttendant?.name ? `- ${selectedAttendant.name}` : ""}
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 2 }}>
                <Typography sx={{ fontSize: "0.875rem" }}>
                  <strong>Status:</strong> {selectedAttendant?.online ? "Online" : "Offline"}
                </Typography>
                <Typography sx={{ fontSize: "0.875rem" }}>
                  <strong>Tickets:</strong> {selectedAttendant?.tickets || 0}
                </Typography>
                <Typography sx={{ fontSize: "0.875rem" }}>
                  <strong>T.M. Atendimento:</strong> {formatTime(Number(selectedAttendant?.avgSupportTime || 0))}
                </Typography>
                <Typography sx={{ fontSize: "0.875rem" }}>
                  <strong>Satisfação:</strong> {Number(selectedAttendant?.rating || 0).toFixed(1)}
                </Typography>
              </Box>

              {attendantDetailsLoading ? (
                <Box sx={{ py: 4, textAlign: "center" }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Cliente</TableCell>
                        <TableCell>Canal</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Início</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {attendantMoments.length ? attendantMoments.slice(0, 20).map((ticket) => (
                        <TableRow key={ticket.id}>
                          <TableCell>{ticket?.contact?.name || "-"}</TableCell>
                          <TableCell>{ticket?.queue?.name || "-"}</TableCell>
                          <TableCell>{ticket?.status || "-"}</TableCell>
                          <TableCell>{ticket?.createdAt ? new Date(ticket.createdAt).toLocaleString("pt-BR") : "-"}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={4} sx={{ textAlign: "center", color: "#6b7280" }}>
                            Nenhum ticket encontrado para este atendente no período selecionado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setAttendantDetailsOpen(false)} sx={{ color: "#6b7280" }}>
                Fechar
              </Button>
              <Button
                onClick={() => history.push("/tickets")}
                sx={{ color: "#4f46e5" }}
              >
                Abrir Tickets
              </Button>
            </DialogActions>
          </Dialog>

          <UserModal
            open={userModalOpen}
            onClose={handleCloseUserModal}
            userId={selectedUserId}
          />
        </Box>
      )}
      {transferTicketModalOpen && selectedActivityTicket && (
        <TransferTicketModalCustom
          modalOpen={transferTicketModalOpen}
          onClose={handleCloseTransferTicketModal}
          ticketid={selectedActivityTicket.id}
          ticket={selectedActivityTicket}
        />
      )}
    </Box>
  );
};

export default Dashboard;
