import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  makeStyles,
  useTheme,
} from "@material-ui/core";
import {
  Business,
  AccountTree,
  DevicesOther,
  InfoOutlined,
  AccessTime,
  Add,
  DeleteOutline,
  EditOutlined,
} from "@material-ui/icons";
import { toast } from "react-toastify";
import SchedulesForm from "../../components/SchedulesForm";
import HolidayScheduleModal from "../../components/HolidayScheduleModal";
import ForbiddenPage from "../../components/ForbiddenPage";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import useCompanies from "../../hooks/useCompanies";
import useQueues from "../../hooks/useQueues";
import useWhatsApps from "../../hooks/useWhatsApps";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    padding: theme.spacing(3),
    height: "calc(100% - 48px)",
    overflowY: "auto",
    ...theme.scrollbarStyles,
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1.5),
    },
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: theme.spacing(3),
    gap: theme.spacing(2),
    flexWrap: "wrap",
  },
  headerTitle: {
    fontWeight: 700,
    fontSize: "1.45rem",
    letterSpacing: "-0.3px",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
    lineHeight: 1.2,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: "0.82rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    fontWeight: 400,
  },

  // ── Page title card ─────────────────────────────────────────────────────
  titleCard: {
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    boxShadow:
      theme.palette.type === "dark"
        ? "0 1px 3px rgba(0,0,0,0.4)"
        : "0 1px 3px rgba(15,23,42,0.08)",
    marginBottom: theme.spacing(3),
    padding: theme.spacing(2, 2.5),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    flexWrap: "wrap",
  },
  titleCardLeft: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
  },
  titleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(99,102,241,0.15)"
        : "rgba(99,102,241,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // ── Status badge ────────────────────────────────────────────────────────
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "0.02em",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    flexShrink: 0,
  },
  statusActive: {
    backgroundColor: "rgba(34,197,94,0.10)",
    color: "#16a34a",
    border: "1px solid rgba(34,197,94,0.25)",
  },
  statusInactive: {
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(148,163,184,0.08)"
        : "rgba(148,163,184,0.1)",
    color: theme.palette.type === "dark" ? "#64748b" : "#94a3b8",
    border: "1px solid rgba(148,163,184,0.25)",
  },

  // ── Card base ────────────────────────────────────────────────────────────
  card: {
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    boxShadow:
      theme.palette.type === "dark"
        ? "0 1px 3px rgba(0,0,0,0.4)"
        : "0 1px 3px rgba(15,23,42,0.08)",
    marginBottom: theme.spacing(2),
  },
  cardBody: {
    padding: theme.spacing(2.5),
  },
  cardHeader: {
    padding: theme.spacing(2, 2.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    borderRadius: "12px 12px 0 0",
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(15,23,42,0.025)",
  },
  cardTitle: {
    fontWeight: 600,
    fontSize: "0.88rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
  },
  cardSubtitle: {
    fontSize: "0.75rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    marginTop: 2,
  },

  // ── Settings toggle row ─────────────────────────────────────────────────
  settingsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    flexWrap: "wrap",
  },
  settingTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  settingLabel: {
    fontWeight: 600,
    fontSize: "0.9rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
  },
  settingDesc: {
    fontSize: "0.78rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    marginTop: 2,
    lineHeight: 1.5,
    wordBreak: "break-word",
  },

  // ── iOS Switch ───────────────────────────────────────────────────────────
  switchWrap: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.75),
    flexShrink: 0,
  },
  switchLabel: {
    fontSize: "0.78rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    minWidth: 36,
    textAlign: "right",
    userSelect: "none",
  },
  iosSwitch: {
    width: 44,
    height: 26,
    padding: 0,
    margin: 0,
    "& .MuiSwitch-switchBase": {
      padding: 2,
      transition: theme.transitions.create("transform", { duration: 200 }),
      "&.Mui-checked": {
        transform: "translateX(18px)",
        color: "#fff",
        "& + .MuiSwitch-track": {
          backgroundColor: "#22c55e",
          opacity: 1,
          border: "none",
        },
      },
      "&.Mui-disabled": {
        "& .MuiSwitch-thumb": { opacity: 0.6 },
        "& + .MuiSwitch-track": { opacity: 0.4 },
      },
    },
    "& .MuiSwitch-thumb": {
      width: 22,
      height: 22,
      backgroundColor: "#fff",
      boxShadow: "0 1px 4px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(0,0,0,0.06)",
      transition: theme.transitions.create(["width"], { duration: 200 }),
    },
    "& .MuiSwitch-track": {
      borderRadius: 13,
      backgroundColor:
        theme.palette.type === "dark" ? "#52525b" : "#d4d4d8",
      opacity: 1,
      transition: theme.transitions.create("background-color", { duration: 300 }),
    },
  },

  // ── Divider ──────────────────────────────────────────────────────────────
  divider: {
    borderTop: `1px solid ${theme.palette.divider}`,
    margin: theme.spacing(2, 0),
  },

  // ── Section label ────────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: "0.72rem",
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    marginBottom: theme.spacing(1.25),
  },

  // ── Scope type tabs ──────────────────────────────────────────────────────
  scopeTabs: {
    display: "inline-flex",
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(15,23,42,0.03)",
    [theme.breakpoints.down("xs")]: {
      display: "flex",
      width: "100%",
    },
  },
  scopeTab: {
    padding: theme.spacing(0.75, 1.75),
    fontSize: "0.78rem",
    fontWeight: 500,
    cursor: "pointer",
    outline: "none",
    border: "none",
    borderRight: `1px solid ${theme.palette.divider}`,
    backgroundColor: "transparent",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    transition: "background-color 0.15s, color 0.15s",
    display: "flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
    "&:last-child": { borderRight: "none" },
    "&:hover:not(:disabled)": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.06)"
          : "rgba(15,23,42,0.05)",
    },
    [theme.breakpoints.down("xs")]: {
      flex: 1,
      justifyContent: "center",
    },
  },
  scopeTabActive: {
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(99,102,241,0.15)"
        : "rgba(99,102,241,0.08)",
    color: theme.palette.type === "dark" ? "#818cf8" : "#4f46e5",
    fontWeight: 600,
  },

  // ── Selector (queue / connection) ────────────────────────────────────────
  selectorWrap: {
    marginTop: theme.spacing(2),
    maxWidth: 400,
    [theme.breakpoints.down("xs")]: {
      maxWidth: "100%",
    },
  },

  // ── Legend strip ─────────────────────────────────────────────────────────
  legendStrip: {
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.02)"
        : "rgba(15,23,42,0.015)",
    padding: theme.spacing(1.25, 2),
    marginBottom: theme.spacing(2),
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    alignItems: "center",
  },
  legendInfoIcon: {
    fontSize: 15,
    color: theme.palette.type === "dark" ? "#475569" : "#94a3b8",
    flexShrink: 0,
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.75),
  },
  legendBadge: {
    display: "inline-flex",
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: "0.68rem",
    fontWeight: 600,
  },
  legendText: {
    fontSize: "0.75rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
  },
  pageTabs: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    width: "100%",
    marginBottom: theme.spacing(2),
    padding: 0,
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(248,250,252,0.96)",
    boxShadow:
      theme.palette.type === "dark"
        ? "inset 0 1px 0 rgba(255,255,255,0.04)"
        : "0 3px 10px rgba(15,23,42,0.04)",
    [theme.breakpoints.down("xs")]: {
      gridTemplateColumns: "1fr auto 1fr",
    },
  },
  pageTabButton: {
    width: "100%",
    padding: theme.spacing(1.6, 2),
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#475569",
    transition: "all 0.18s ease",
    position: "relative",
    textAlign: "center",
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.04)"
          : "rgba(255,255,255,0.7)",
      color: theme.palette.type === "dark" ? "#e2e8f0" : "#0f172a",
    },
  },
  pageTabButtonActive: {
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.08)",
    color: theme.palette.type === "dark" ? "#c7d2fe" : "#3730a3",
    "&::after": {
      content: "\"\"",
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 3,
      backgroundColor: theme.palette.type === "dark" ? "#818cf8" : "#4f46e5",
    },
  },
  pageTabsDivider: {
    padding: theme.spacing(0, 1),
    fontSize: "1rem",
    fontWeight: 700,
    color: theme.palette.type === "dark" ? "#475569" : "#94a3b8",
    userSelect: "none",
  },
  holidaysHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    flexWrap: "wrap",
  },
  holidaysEmpty: {
    border: `1px dashed ${theme.palette.divider}`,
    borderRadius: 10,
    padding: theme.spacing(3),
    textAlign: "center",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    fontSize: "0.85rem",
  },
  actionCell: {
    whiteSpace: "nowrap",
    width: 120,
  },
}));

// ── Data ────────────────────────────────────────────────────────────────────

const weekdays = [
  { weekday: "Segunda-feira", weekdayEn: "monday" },
  { weekday: "Terça-feira", weekdayEn: "tuesday" },
  { weekday: "Quarta-feira", weekdayEn: "wednesday" },
  { weekday: "Quinta-feira", weekdayEn: "thursday" },
  { weekday: "Sexta-feira", weekdayEn: "friday" },
  { weekday: "Sábado", weekdayEn: "saturday" },
  { weekday: "Domingo", weekdayEn: "sunday" },
];

const normalizeSchedules = (list = []) => {
  const safeList = Array.isArray(list) ? list.filter((item) => item && typeof item === "object") : [];
  return weekdays.map((day) => {
    const found = safeList.find((item) => item.weekdayEn === day.weekdayEn) || {};
    return {
      ...day,
      ...found,
      dayMode: found.dayMode || "hours",
      startTimeA: found.startTimeA || "",
      endTimeA: found.endTimeA || "",
      startTimeB: found.startTimeB || "",
      endTimeB: found.endTimeB || "",
    };
  });
};

const SCOPE_TABS = [
  { value: "company", label: "Por empresa", Icon: Business },
  { value: "connection", label: "Por conexão", Icon: DevicesOther },
  { value: "queue", label: "Por fila", Icon: AccountTree },
];

const buildStorageKey = (companyId, key) =>
  `attendanceSchedule:${companyId}:${key}`;

const normalizeHolidaySchedules = (list = []) =>
  (Array.isArray(list) ? list : [])
    .filter(item => item && typeof item === "object" && item.date)
    .map(item => ({
      id: item.id || `${item.date}-${item.startTimeA || "closed"}`,
      date: item.date,
      message: item.message || "",
      dayMode: item.dayMode || "closed",
      startTimeA: item.startTimeA || "",
      endTimeA: item.endTimeA || "",
      startTimeB: item.startTimeB || "",
      endTimeB: item.endTimeB || "",
    }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

const describeHolidayHours = holiday => {
  if (holiday.dayMode === "closed") {
    return "Fechado o dia todo";
  }

  if (holiday.startTimeB || holiday.endTimeB) {
    return `${holiday.startTimeA} - ${holiday.endTimeA} / ${holiday.startTimeB} - ${holiday.endTimeB}`;
  }

  return `${holiday.startTimeA} - ${holiday.endTimeA}`;
};

// ── Component ────────────────────────────────────────────────────────────────

const AttendanceSchedule = () => {
  const classes = useStyles();
  const theme = useTheme();
  const { user } = useContext(AuthContext);
  const { getAll, update: updateCompanySetting } = useCompanySettings();
  const { find, updateSchedules } = useCompanies();
  const { findAll: findAllQueues } = useQueues();
  const { whatsApps } = useWhatsApps();

  const [loadingInitial, setLoadingInitial] = useState(false);
  const [savingScope, setSavingScope] = useState(false);
  const [savingSchedules, setSavingSchedules] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [scheduleType, setScheduleType] = useState("company");
  const [activeTab, setActiveTab] = useState("hours");
  const [companySchedules, setCompanySchedules] = useState(normalizeSchedules([]));
  const [companyHolidaySchedules, setCompanyHolidaySchedules] = useState(normalizeHolidaySchedules([]));
  const [queueList, setQueueList] = useState([]);
  const [selectedQueueId, setSelectedQueueId] = useState("");
  const [queueData, setQueueData] = useState(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [connectionData, setConnectionData] = useState(null);
  const [outOfHoursMessage, setOutOfHoursMessage] = useState("");
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [savingHolidays, setSavingHolidays] = useState(false);
  const warnedRef = useRef({ base: false, queue: false, connection: false });

  useEffect(() => {
    const loadBase = async () => {
      setLoadingInitial(true);
      try {
        const [company, settings, queues] = await Promise.all([
          find(user.companyId),
          getAll(user.companyId),
          findAllQueues(),
        ]);
        setCompanySchedules(normalizeSchedules(company?.schedules || []));
        setCompanyHolidaySchedules(normalizeHolidaySchedules(company?.holidaySchedules || []));
        const scopedType = settings?.scheduleType || "disabled";
        setEnabled(scopedType !== "disabled");
        setScheduleType(scopedType === "disabled" ? "company" : scopedType);
        setQueueList(Array.isArray(queues) ? queues : []);

        const savedQueueId = localStorage.getItem(
          buildStorageKey(user.companyId, "selectedQueueId")
        );
        const savedConnectionId = localStorage.getItem(
          buildStorageKey(user.companyId, "selectedConnectionId")
        );
        if (savedQueueId) setSelectedQueueId(savedQueueId);
        if (savedConnectionId) setSelectedConnectionId(savedConnectionId);
      } catch (error) {
        if (!warnedRef.current.base) {
          toast.error("Erro ao carregar configurações de horário.");
          warnedRef.current.base = true;
        }
      } finally {
        setLoadingInitial(false);
      }
    };
    loadBase();
  }, [user.companyId]);

  useEffect(() => {
    if (!selectedQueueId) return;
    localStorage.setItem(
      buildStorageKey(user.companyId, "selectedQueueId"),
      String(selectedQueueId)
    );
  }, [selectedQueueId, user.companyId]);

  useEffect(() => {
    if (!selectedConnectionId) return;
    localStorage.setItem(
      buildStorageKey(user.companyId, "selectedConnectionId"),
      String(selectedConnectionId)
    );
  }, [selectedConnectionId, user.companyId]);

  const connectionList = useMemo(() => (Array.isArray(whatsApps) ? whatsApps : []), [whatsApps]);

  useEffect(() => {
    const run = async () => {
      if (!enabled || scheduleType !== "company") return;
      if (!Array.isArray(connectionList) || connectionList.length === 0) return;

      const defaultConnection =
        connectionList.find((item) => Boolean(item?.isDefault)) || connectionList[0];
      if (!defaultConnection?.id) return;

      try {
        const { data } = await api.get(`whatsapp-admin/${defaultConnection.id}?session=0`);
        setConnectionData(data);
        setOutOfHoursMessage(data?.outOfHoursMessage || "");
      } catch (error) {
        if (!warnedRef.current.connection) {
          toast.error("Erro ao carregar dados da conexão padrão.");
          warnedRef.current.connection = true;
        }
      }
    };
    run();
  }, [enabled, scheduleType, connectionList]);

  useEffect(() => {
    const run = async () => {
      if (scheduleType !== "queue" || !selectedQueueId) return;
      try {
        const { data } = await api.get(`/queue/${selectedQueueId}`);
        setQueueData(data);
        setOutOfHoursMessage(data?.outOfHoursMessage || "");
      } catch (error) {
        if (!warnedRef.current.queue) {
          toast.error("Erro ao carregar dados da fila.");
          warnedRef.current.queue = true;
        }
      }
    };
    run();
  }, [scheduleType, selectedQueueId]);

  useEffect(() => {
    const run = async () => {
      if (scheduleType !== "connection" || !selectedConnectionId) return;
      try {
        const { data } = await api.get(`whatsapp-admin/${selectedConnectionId}?session=0`);
        setConnectionData(data);
        setOutOfHoursMessage(data?.outOfHoursMessage || "");
      } catch (error) {
        if (!warnedRef.current.connection) {
          toast.error("Erro ao carregar dados da conexão.");
          warnedRef.current.connection = true;
        }
      }
    };
    run();
  }, [scheduleType, selectedConnectionId]);

  const updateScopeSetting = async (nextEnabled, nextType) => {
    setSavingScope(true);
    try {
      const resolvedType = nextEnabled ? nextType : "disabled";
      await updateCompanySetting({ column: "scheduleType", data: resolvedType });
      return true;
    } catch (error) {
      toast.error("Não foi possível salvar o tipo de horário.");
      return false;
    } finally {
      setSavingScope(false);
    }
  };

  const handleToggleEnabled = async (checked) => {
    const prevEnabled = enabled;
    setEnabled(checked);
    const ok = await updateScopeSetting(checked, scheduleType);
    if (!ok) {
      setEnabled(prevEnabled);
      return;
    }
    toast.success("Configuração de tipo de horário salva.");
  };

  const handleChangeScheduleType = async (value) => {
    const prevType = scheduleType;
    setScheduleType(value);
    if (!enabled) return;
    const ok = await updateScopeSetting(true, value);
    if (!ok) {
      setScheduleType(prevType);
      return;
    }
    toast.success("Configuração de tipo de horário salva.");
  };

  const handleSaveSchedules = async (schedules) => {
    setSavingSchedules(true);
    try {
      if (enabled && scheduleType === "company") {
        const company = await updateSchedules({ id: user.companyId, schedules });
        setCompanySchedules(normalizeSchedules(company?.schedules || schedules));
        if (connectionData?.id) {
          const payload = {
            ...connectionData,
            schedules: connectionData.schedules,
            outOfHoursMessage,
            queueIds: (connectionData.queues || []).map((q) => q.id),
          };
          await api.put(`/whatsapp/${connectionData.id}`, payload);
        }
      } else if (enabled && scheduleType === "queue" && queueData) {
        const payload = {
          ...queueData,
          schedules,
          outOfHoursMessage,
          userIds: (queueData.users || []).map((u) => u.id),
        };
        const { data } = await api.put(`/queue/${queueData.id}`, payload);
        setQueueData(data);
      } else if (enabled && scheduleType === "connection" && connectionData) {
        const payload = {
          ...connectionData,
          schedules,
          outOfHoursMessage,
          queueIds: (connectionData.queues || []).map((q) => q.id),
        };
        const { data } = await api.put(`/whatsapp/${connectionData.id}`, payload);
        setConnectionData(data);
      } else if (enabled && scheduleType === "queue" && !queueData) {
        toast.error("Selecione uma fila para salvar os horários.");
        return;
      } else if (enabled && scheduleType === "connection" && !connectionData) {
        toast.error("Selecione uma conexão para salvar os horários.");
        return;
      }
      toast.success("Horário de atendimento atualizado com sucesso.");
    } finally {
      setSavingSchedules(false);
    }
  };

  const handleOpenCreateHoliday = () => {
    setEditingHoliday(null);
    setHolidayModalOpen(true);
  };

  const handleEditHoliday = holiday => {
    setEditingHoliday(holiday);
    setHolidayModalOpen(true);
  };

  const handleDeleteHoliday = async holidayId => {
    const nextHolidaySchedules = activeHolidaySchedules.filter(item => item.id !== holidayId);
    await handleSaveHolidaySchedules(nextHolidaySchedules);
  };

  const handleSaveHoliday = async holiday => {
    const withoutCurrent = activeHolidaySchedules.filter(item => item.id !== holiday.id && item.date !== holiday.date);
    const nextHolidaySchedules = normalizeHolidaySchedules([...withoutCurrent, holiday]);
    await handleSaveHolidaySchedules(nextHolidaySchedules);
    setHolidayModalOpen(false);
    setEditingHoliday(null);
  };

  const handleSaveHolidaySchedules = async holidaySchedules => {
    setSavingHolidays(true);
    try {
      if (enabled && scheduleType === "company") {
        const company = await updateSchedules({
          id: user.companyId,
          holidaySchedules,
        });
        setCompanyHolidaySchedules(
          normalizeHolidaySchedules(company?.holidaySchedules || holidaySchedules)
        );
      } else if (enabled && scheduleType === "queue" && queueData) {
        const payload = {
          ...queueData,
          schedules: queueData.schedules,
          holidaySchedules,
          outOfHoursMessage,
          userIds: (queueData.users || []).map(u => u.id),
        };
        const { data } = await api.put(`/queue/${queueData.id}`, payload);
        setQueueData(data);
      } else if (enabled && scheduleType === "connection" && connectionData) {
        const payload = {
          ...connectionData,
          schedules: connectionData.schedules,
          holidaySchedules,
          outOfHoursMessage,
          queueIds: (connectionData.queues || []).map(q => q.id),
        };
        const { data } = await api.put(`/whatsapp/${connectionData.id}`, payload);
        setConnectionData(data);
      } else if (enabled && scheduleType === "queue" && !queueData) {
        toast.error("Selecione uma fila para salvar os feriados.");
        return;
      } else if (enabled && scheduleType === "connection" && !connectionData) {
        toast.error("Selecione uma conexão para salvar os feriados.");
        return;
      }

      toast.success("Feriados atualizados com sucesso.");
    } finally {
      setSavingHolidays(false);
    }
  };

  const activeSchedules =
    scheduleType === "company"
      ? companySchedules
      : scheduleType === "queue"
      ? normalizeSchedules(queueData?.schedules || [])
      : normalizeSchedules(connectionData?.schedules || []);

  const activeHolidaySchedules =
    scheduleType === "company"
      ? companyHolidaySchedules
      : scheduleType === "queue"
      ? normalizeHolidaySchedules(queueData?.holidaySchedules || [])
      : normalizeHolidaySchedules(connectionData?.holidaySchedules || []);

  if (user.profile === "user") return <ForbiddenPage />;

  const scopeDisabled = savingScope || loadingInitial || !enabled;

  return (
    <div className={classes.pageRoot}>

      {/* ── Page Title Card ── */}
      <div className={classes.titleCard}>
        <div className={classes.titleCardLeft}>
          <div className={classes.titleIconWrap}>
            <AccessTime style={{ fontSize: 20, color: theme.palette.type === "dark" ? "#818cf8" : "#4f46e5" }} />
          </div>
          <Typography className={classes.headerTitle}>Horário de Atendimento</Typography>
        </div>
        <span
          className={`${classes.statusBadge} ${enabled ? classes.statusActive : classes.statusInactive}`}
        >
          <span
            className={classes.statusDot}
            style={{ backgroundColor: enabled ? "#22c55e" : "#94a3b8" }}
          />
          {enabled ? "Ativo" : "Inativo"}
        </span>
      </div>

      <div className={classes.pageTabs}>
        <button
          type="button"
          className={`${classes.pageTabButton} ${
            activeTab === "hours" ? classes.pageTabButtonActive : ""
          }`}
          onClick={() => setActiveTab("hours")}
        >
          Horários
        </button>
        <span className={classes.pageTabsDivider}>|</span>
        <button
          type="button"
          className={`${classes.pageTabButton} ${
            activeTab === "holidays" ? classes.pageTabButtonActive : ""
          }`}
          onClick={() => setActiveTab("holidays")}
        >
          Feriados
        </button>
      </div>

      {/* ── Settings Card ── */}
      <div className={classes.card}>
        <div className={classes.cardBody}>

          {/* Toggle row */}
          <div className={classes.settingsRow}>
            <div className={classes.settingTextBlock}>
              <Typography className={classes.settingLabel}>Controle de horário</Typography>
              <Typography className={classes.settingDesc}>
                Ative para definir horários de atendimento e enviar mensagens automáticas fora do expediente
              </Typography>
            </div>
            <div className={classes.switchWrap}>
              <Typography className={classes.switchLabel}>
                {enabled ? "Ativo" : "Inativo"}
              </Typography>
              <Switch
                className={classes.iosSwitch}
                checked={enabled}
                onChange={(e) => handleToggleEnabled(e.target.checked)}
                disabled={savingScope || loadingInitial}
              />
            </div>
          </div>

          {/* Scope section */}
          {enabled && (
            <>
              <div className={classes.divider} />

              <Typography className={classes.sectionLabel}>Tipos de Horário</Typography>
              <div className={classes.scopeTabs}>
                {SCOPE_TABS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    className={`${classes.scopeTab} ${
                      scheduleType === value ? classes.scopeTabActive : ""
                    }`}
                    onClick={() => handleChangeScheduleType(value)}
                    disabled={scopeDisabled}
                  >
                    <Icon style={{ fontSize: 15 }} />
                    {label}
                  </button>
                ))}
              </div>

              {scheduleType === "connection" && (
                <div className={classes.selectorWrap}>
                  <FormControl fullWidth variant="outlined" size="small">
                    <InputLabel>Selecionar conexão</InputLabel>
                    <Select
                      value={selectedConnectionId}
                      onChange={(e) => setSelectedConnectionId(e.target.value)}
                      label="Selecionar conexão"
                    >
                      {connectionList.map((w) => (
                        <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </div>
              )}

              {scheduleType === "queue" && (
                <div className={classes.selectorWrap}>
                  <FormControl fullWidth variant="outlined" size="small">
                    <InputLabel>Selecionar fila</InputLabel>
                    <Select
                      value={selectedQueueId}
                      onChange={(e) => setSelectedQueueId(e.target.value)}
                      label="Selecionar fila"
                    >
                      {queueList.map((q) => (
                        <MenuItem key={q.id} value={q.id}>{q.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Legend strip ── */}
      {enabled && activeTab === "hours" && (
        <div className={classes.legendStrip}>
          <InfoOutlined className={classes.legendInfoIcon} />
          <div className={classes.legendItem}>
            <span
              className={classes.legendBadge}
              style={{
                backgroundColor: "rgba(34,197,94,0.1)",
                color: "#16a34a",
                border: "1px solid rgba(34,197,94,0.2)",
              }}
            >
              Aberto
            </span>
            <Typography className={classes.legendText}>Funcionamento 24h no dia</Typography>
          </div>
          <div className={classes.legendItem}>
            <span
              className={classes.legendBadge}
              style={{
                backgroundColor: "rgba(239,68,68,0.1)",
                color: "#dc2626",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              Fechado
            </span>
            <Typography className={classes.legendText}>Não atende no dia</Typography>
          </div>
          <div className={classes.legendItem}>
            <span
              className={classes.legendBadge}
              style={{
                backgroundColor: "rgba(99,102,241,0.1)",
                color: "#4f46e5",
                border: "1px solid rgba(99,102,241,0.2)",
              }}
            >
              Horário
            </span>
            <Typography className={classes.legendText}>Usa os intervalos A e B configurados</Typography>
          </div>
        </div>
      )}

      {/* ── Schedules form ── */}
      {enabled && activeTab === "hours" && (
        <div className={classes.card}>
          <div className={classes.cardHeader}>
            <Typography className={classes.cardTitle}>Horários por dia da semana</Typography>
          </div>
          <div className={classes.cardBody}>
            <SchedulesForm
              enableDayMode
              loading={savingSchedules}
              initialValues={activeSchedules}
              onSubmit={handleSaveSchedules}
              labelSaveButton="Salvar horários"
            />
          </div>
        </div>
      )}

      {/* ── Absence message ── */}
      {enabled && activeTab === "hours" && (
        <div className={classes.card} style={{ marginBottom: 0 }}>
          <div className={classes.cardHeader}>
            <Typography className={classes.cardTitle}>Mensagem de ausência</Typography>
          </div>
          <div className={classes.cardBody}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Ex: Olá! Nosso horário de atendimento é de segunda a sexta, das 8h às 18h. Retornaremos em breve."
              multiline
              minRows={3}
              value={outOfHoursMessage}
              onChange={(e) => setOutOfHoursMessage(e.target.value)}
            />
          </div>
        </div>
      )}

      {enabled && activeTab === "holidays" && (
        <div className={classes.card} style={{ marginBottom: 0 }}>
          <div className={classes.cardHeader}>
            <Typography className={classes.cardTitle}>Feriados</Typography>
            <Typography className={classes.cardSubtitle}>
              Cadastre dias específicos com fechamento total ou horários especiais.
            </Typography>
          </div>
          <div className={classes.cardBody}>
            <div className={classes.holidaysHeader}>
              <Typography className={classes.sectionLabel} style={{ marginBottom: 0 }}>
                Lista de feriados cadastrados
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Add />}
                onClick={handleOpenCreateHoliday}
                disabled={
                  savingHolidays ||
                  (scheduleType === "queue" && !queueData) ||
                  (scheduleType === "connection" && !connectionData)
                }
              >
                Adicionar feriado
              </Button>
            </div>

            {activeHolidaySchedules.length === 0 ? (
              <div className={classes.holidaysEmpty}>
                Nenhum feriado cadastrado para este escopo.
              </div>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Data</TableCell>
                    <TableCell>Horário de Funcionamento</TableCell>
                    <TableCell>Mensagem</TableCell>
                    <TableCell className={classes.actionCell}>Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activeHolidaySchedules.map(holiday => (
                    <TableRow key={holiday.id}>
                      <TableCell>{holiday.id}</TableCell>
                      <TableCell>{holiday.date}</TableCell>
                      <TableCell>{describeHolidayHours(holiday)}</TableCell>
                      <TableCell>{holiday.message || "-"}</TableCell>
                      <TableCell className={classes.actionCell}>
                        <IconButton
                          size="small"
                          onClick={() => handleEditHoliday(holiday)}
                          disabled={savingHolidays}
                        >
                          <EditOutlined fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteHoliday(holiday.id)}
                          disabled={savingHolidays}
                        >
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      )}

      <HolidayScheduleModal
        open={holidayModalOpen}
        onClose={() => {
          if (savingHolidays) return;
          setHolidayModalOpen(false);
          setEditingHoliday(null);
        }}
        onSubmit={handleSaveHoliday}
        initialData={editingHoliday}
        loading={savingHolidays}
      />

    </div>
  );
};

export default AttendanceSchedule;
