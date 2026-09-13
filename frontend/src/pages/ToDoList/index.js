import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import AssignmentTurnedInIcon from "@material-ui/icons/AssignmentTurnedIn";
import SearchIcon from "@material-ui/icons/Search";
import AddIcon from "@material-ui/icons/Add";
import DeleteIcon from "@material-ui/icons/Delete";
import EditIcon from "@material-ui/icons/Edit";
import FileCopyIcon from "@material-ui/icons/FileCopy";
import HighlightOffIcon from "@material-ui/icons/HighlightOff";
import HourglassEmptyIcon from "@material-ui/icons/HourglassEmpty";
import PlayCircleFilledWhiteIcon from "@material-ui/icons/PlayCircleFilledWhite";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import CalendarTodayIcon from "@material-ui/icons/CalendarToday";
import PersonOutlineIcon from "@material-ui/icons/PersonOutline";
import AssignmentIcon from "@material-ui/icons/Assignment";
import SubjectIcon from "@material-ui/icons/Subject";
import FlagIcon from "@material-ui/icons/Flag";
import CommentIcon from "@material-ui/icons/Comment";
import SwapHorizIcon from "@material-ui/icons/SwapHoriz";

import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";

const PRIORITIES = [
  { value: "low", label: "🟢 Baixa", bg: "#dcfce7", text: "#166534" },
  { value: "medium", label: "🟡 Média", bg: "#fef3c7", text: "#92400e" },
  { value: "high", label: "🟠 Alta", bg: "#ffedd5", text: "#9a3412" },
  { value: "urgent", label: "🔴 Urgente", bg: "#fee2e2", text: "#991b1b" },
];

const DATE_FILTERS = [
  { value: "all", label: "Todas as datas" },
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
  { value: "overdue", label: "Atrasadas" },
];

const STATUS_META = {
  rejected: {
    label: "Recusadas",
    icon: HighlightOffIcon,
    accent: "#dc2626",
    light: "rgba(220, 38, 38, 0.08)",
  },
  pending: {
    label: "Aguardando Início",
    icon: HourglassEmptyIcon,
    accent: "#ca8a04",
    light: "rgba(202, 138, 4, 0.09)",
  },
  in_progress: {
    label: "Em Andamento",
    icon: PlayCircleFilledWhiteIcon,
    accent: "#2563eb",
    light: "rgba(37, 99, 235, 0.09)",
  },
  complete: {
    label: "Completa",
    icon: CheckCircleIcon,
    accent: "#16a34a",
    light: "rgba(22, 163, 74, 0.08)",
  },
};

const STATUS_ORDER = ["rejected", "pending", "in_progress", "complete"];

const priorityRank = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

const normalizeStartOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const toDateInputValue = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateBr = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
};

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    padding: theme.spacing(2),
    height: "calc(100% - 48px)",
    overflow: "hidden",
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
      height: "auto",
      minHeight: "calc(100% - 48px)",
      overflowY: "auto",
      overflowX: "hidden",
    },
    background:
      theme.mode === "light"
        ? "radial-gradient(850px 290px at -8% -15%, rgba(59,130,246,0.2), transparent 58%), radial-gradient(850px 300px at 110% -12%, rgba(16,185,129,0.14), transparent 60%)"
        : "linear-gradient(180deg, rgba(8,15,28,0.25) 0%, rgba(8,15,28,0.08) 100%)",
  },
  topCard: {
    borderRadius: 18,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "0 14px 32px rgba(15, 23, 42, 0.12)",
    background:
      theme.mode === "light"
        ? "linear-gradient(135deg, #ffffff 0%, #edf6ff 52%, #eefdf3 100%)"
        : "linear-gradient(145deg, rgba(15,23,42,0.95) 0%, rgba(17,24,39,0.95) 100%)",
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(1.25),
      marginBottom: theme.spacing(1),
      borderRadius: 14,
    },
  },
  topTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
    [theme.breakpoints.down("xs")]: {
      flexDirection: "column",
      alignItems: "flex-start",
    },
  },
  titleWrap: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  titleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    color: "#1e3a8a",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, rgba(59,130,246,0.18), rgba(37,99,235,0.24))",
  },
  titleText: {
    fontWeight: 800,
    fontSize: "1.15rem",
    letterSpacing: "0.01em",
    color: theme.palette.text.primary,
  },
  modalTopBar: {
    height: 5,
    background:
      "linear-gradient(90deg, var(--primaryColor, #2563eb) 0%, rgba(37,99,235,0.45) 100%)",
  },
  modalTitle: {
    fontWeight: 800,
    fontSize: "1rem",
    color: theme.palette.text.primary,
    paddingTop: theme.spacing(0.8),
    paddingBottom: theme.spacing(0.4),
  },
  modalContent: {
    background:
      theme.mode === "light"
        ? "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)"
        : "linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(17,24,39,0.92) 100%)",
  },
  inputIcon: {
    color: "var(--primaryColor, #2563eb)",
    opacity: 0.92,
    fontSize: 18,
  },
  filterField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 12,
      backgroundColor:
        theme.mode === "light" ? "rgba(255,255,255,0.86)" : "rgba(30,41,59,0.5)",
    },
    "& .MuiInputBase-input": {
      fontSize: "0.82rem",
      paddingTop: 12,
      paddingBottom: 12,
    },
    "& .MuiInputLabel-root": {
      fontSize: "0.8rem",
    },
  },
  addButton: {
    height: 42,
    minWidth: 150,
    borderRadius: 12,
    fontWeight: 800,
    letterSpacing: "0.01em",
    boxShadow: "0 12px 22px rgba(21, 94, 239, 0.24)",
    [theme.breakpoints.down("xs")]: {
      width: "100%",
    },
  },
  boardRoot: {
    flex: 1,
    minHeight: 0,
    height: "100%",
    overflowX: "auto",
    overflowY: "hidden",
    ...theme.scrollbarStyles,
    [theme.breakpoints.down("sm")]: {
      overflowX: "hidden",
      overflowY: "auto",
    },
  },
  boardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(290px, 1fr))",
    gap: theme.spacing(1.5),
    height: "100%",
    minWidth: 1180,
    alignItems: "stretch",
    [theme.breakpoints.down("md")]: {
      gridTemplateColumns: "repeat(2, minmax(260px, 1fr))",
      minWidth: 0,
      height: "auto",
      alignItems: "start",
    },
    [theme.breakpoints.down("xs")]: {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: theme.spacing(1),
    },
  },
  lane: {
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    background:
      theme.mode === "light"
        ? "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.95) 100%)"
        : "linear-gradient(180deg, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.7) 100%)",
    boxShadow: "0 12px 24px rgba(15, 23, 42, 0.10)",
    height: "100%",
    transition: "box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease",
    [theme.breakpoints.down("md")]: {
      height: "auto",
      minHeight: 260,
    },
  },
  laneDropActive: {
    transform: "translateY(-2px)",
    boxShadow: "0 18px 34px rgba(37, 99, 235, 0.20)",
    borderColor: "rgba(37, 99, 235, 0.45)",
  },
  laneHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    padding: theme.spacing(1.2, 1.2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  laneTitle: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.8),
    fontWeight: 800,
    fontSize: "0.85rem",
  },
  laneCount: {
    color: "#fff",
    fontWeight: 800,
    fontSize: "0.72rem",
    height: 24,
  },
  laneBody: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: theme.spacing(1.2),
    ...theme.scrollbarStyles,
    [theme.breakpoints.down("md")]: {
      minHeight: 120,
      maxHeight: "44vh",
    },
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(1),
      maxHeight: "52vh",
    },
  },
  card: {
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1.1),
    marginBottom: theme.spacing(1),
    background:
      theme.mode === "light"
        ? "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)"
        : "rgba(15,23,42,0.62)",
    boxShadow: "0 10px 20px rgba(15, 23, 42, 0.10)",
    cursor: "grab",
    transition: "all 0.18s ease",
    "&:hover": {
      transform: "translateY(-1px)",
      boxShadow: "0 14px 24px rgba(15, 23, 42, 0.14)",
    },
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(0.9),
      borderRadius: 12,
      marginBottom: theme.spacing(0.85),
    },
  },
  cardDragging: {
    transform: "scale(0.995)",
  },
  cardDropBefore: {
    boxShadow: "inset 0 2px 0 rgba(37, 99, 235, 0.85)",
  },
  cardDropAfter: {
    boxShadow: "inset 0 -2px 0 rgba(37, 99, 235, 0.85)",
  },
  cardTitle: {
    fontWeight: 700,
    fontSize: "0.88rem",
    color: theme.palette.text.primary,
    lineHeight: 1.28,
    marginBottom: theme.spacing(0.5),
    [theme.breakpoints.down("xs")]: {
      fontSize: "0.84rem",
    },
  },
  cardDescription: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    lineHeight: 1.35,
    marginBottom: theme.spacing(0.8),
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    [theme.breakpoints.down("xs")]: {
      fontSize: "0.72rem",
      marginBottom: theme.spacing(0.65),
    },
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.7),
    color: theme.palette.text.secondary,
    fontSize: "0.73rem",
    marginBottom: theme.spacing(0.6),
    [theme.breakpoints.down("xs")]: {
      fontSize: "0.69rem",
      marginBottom: theme.spacing(0.45),
    },
  },
  cardMetaSubtle: {
    fontSize: "0.68rem",
    color: theme.palette.text.secondary,
    opacity: 0.72,
    marginTop: theme.spacing(0.2),
    marginBottom: theme.spacing(0.45),
    [theme.breakpoints.down("xs")]: {
      fontSize: "0.64rem",
    },
  },
  badgesRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(0.8),
    marginTop: theme.spacing(0.7),
    [theme.breakpoints.down("xs")]: {
      marginTop: theme.spacing(0.5),
    },
  },
  priorityBadge: {
    fontWeight: 700,
    fontSize: "0.68rem",
    height: 22,
    [theme.breakpoints.down("xs")]: {
      fontSize: "0.64rem",
      height: 20,
    },
  },
  cardActions: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    border: `1px solid ${theme.palette.divider}`,
    [theme.breakpoints.down("xs")]: {
      width: 28,
      height: 28,
      borderRadius: 8,
    },
  },
  emptyText: {
    fontSize: "0.78rem",
    textAlign: "center",
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  modalPaper: {
    borderRadius: 14,
  },
}));

const isSameDragOverTarget = (a, b) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    String(a.status) === String(b.status) &&
    String(a.taskId) === String(b.taskId) &&
    String(a.position) === String(b.position)
  );
};

const ToDoList = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const [allTasks, setAllTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [dragTaskId, setDragTaskId] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const dragGhostRef = useRef(null);
  const dragDataRef = useRef({ taskId: null });
  const dragOverTargetRef = useRef(null);

  const [search, setSearch] = useState("");
  const [visibilityScope, setVisibilityScope] = useState("mine");
  const [selectedUserId, setSelectedUserId] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const [openModal, setOpenModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [moveMenuAnchorEl, setMoveMenuAnchorEl] = useState(null);
  const [moveMenuTaskId, setMoveMenuTaskId] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    responsibleUserId: "",
    priority: "medium",
    comments: "",
  });

  const isManager =
    Boolean(user?.super) || String(user?.profile || "").toLowerCase() === "admin";

  const buildPayload = (task, overrides = {}) => ({
    title: (overrides.title ?? task.title ?? "").trim(),
    description: (overrides.description ?? task.description ?? "").trim(),
    dueDate: overrides.dueDate ?? task.dueDate ?? "",
    responsibleUserId: overrides.responsibleUserId ?? task.responsibleUserId ?? user?.id,
    priority: overrides.priority ?? task.priority ?? "medium",
    comments: (overrides.comments ?? task.comments ?? "").trim(),
    status: overrides.status ?? task.status ?? "pending",
    sortOrder: Number.isFinite(Number(overrides.sortOrder ?? task.sortOrder))
      ? Number(overrides.sortOrder ?? task.sortOrder)
      : 0,
  });

  const fetchTasks = async () => {
    try {
      const { data } = await api.get("/tasks");
      setAllTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      setAllTasks([]);
    }
  };

  useEffect(() => {
    if (!user?.id) {
      setAllTasks([]);
      return;
    }
    fetchTasks();
  }, [user?.id]);

  useEffect(() => {
    if (!isManager) {
      setUsers(
        user?.id
          ? [{ id: String(user.id), name: user.name || "Meu usuário" }]
          : []
      );
      return;
    }

    const fetchUsers = async () => {
      try {
        const { data } = await api.get("/users/list");
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.users)
            ? data.users
            : [];
        const uniqueById = new Map();

        list.forEach((u) => {
          uniqueById.set(String(u.id), {
            id: String(u.id),
            name: u.name || `Usuário ${u.id}`,
          });
        });

        if (user?.id) {
          uniqueById.set(String(user.id), {
            id: String(user.id),
            name: user.name || "Meu usuário",
          });
        }

        setUsers(Array.from(uniqueById.values()));
      } catch (error) {
        setUsers(
          user?.id
            ? [{ id: String(user.id), name: user.name || "Meu usuário" }]
            : []
        );
      }
    };

    fetchUsers();
  }, [isManager, user]);

  useEffect(() => {
    if (!isManager && visibilityScope !== "mine") {
      setVisibilityScope("mine");
    }
    if (!isManager && selectedUserId !== "all") {
      setSelectedUserId("all");
    }
  }, [isManager, selectedUserId, visibilityScope]);

  useEffect(() => {
    if (!taskForm.responsibleUserId && user?.id) {
      setTaskForm((prev) => ({
        ...prev,
        responsibleUserId: String(user.id),
      }));
    }
  }, [taskForm.responsibleUserId, user]);

  const visibleBaseTasks = useMemo(() => {
    if (!user?.id) return [];

    if (!isManager) {
      return allTasks.filter(
        (task) => String(task.responsibleUserId) === String(user.id)
      );
    }

    if (visibilityScope === "mine") {
      return allTasks.filter(
        (task) => String(task.responsibleUserId) === String(user.id)
      );
    }

    return allTasks;
  }, [allTasks, isManager, user, visibilityScope]);

  const filteredTasks = useMemo(() => {
    const now = new Date();
    const todayStart = normalizeStartOfDay(now);
    const weekStart = normalizeStartOfDay(now);
    weekStart.setDate(todayStart.getDate() - todayStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return visibleBaseTasks.filter((task) => {
      if (isManager && visibilityScope === "all" && selectedUserId !== "all") {
        if (String(task.responsibleUserId) !== String(selectedUserId)) {
          return false;
        }
      }

      if (priorityFilter !== "all" && task.priority !== priorityFilter) {
        return false;
      }

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = [
          task.title,
          task.description,
          task.comments,
          task.responsibleUserName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!hay.includes(q)) {
          return false;
        }
      }

      if (dateFilter !== "all") {
        if (!task.dueDate) return false;
        const due = normalizeStartOfDay(task.dueDate);

        if (dateFilter === "today") {
          if (due.getTime() !== todayStart.getTime()) return false;
        }

        if (dateFilter === "week") {
          if (due < weekStart || due > weekEnd) return false;
        }

        if (dateFilter === "month") {
          if (
            due.getMonth() !== todayStart.getMonth() ||
            due.getFullYear() !== todayStart.getFullYear()
          ) {
            return false;
          }
        }

        if (dateFilter === "overdue") {
          if (!(due < todayStart && task.status !== "complete")) {
            return false;
          }
        }
      }

      return true;
    });
  }, [
    dateFilter,
    isManager,
    priorityFilter,
    search,
    selectedUserId,
    visibilityScope,
    visibleBaseTasks,
  ]);

  const tasksByStatus = useMemo(() => {
    const grouped = {
      rejected: [],
      pending: [],
      in_progress: [],
      complete: [],
    };

    filteredTasks.forEach((task) => {
      const key = grouped[task.status] ? task.status : "pending";
      grouped[key].push(task);
    });

    Object.keys(grouped).forEach((status) => {
      grouped[status].sort((a, b) => {
        const aSort = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : null;
        const bSort = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : null;
        if (aSort !== null || bSort !== null) {
          if (aSort === null) return 1;
          if (bSort === null) return -1;
          if (aSort !== bSort) return aSort - bSort;
        }
        const prioDiff = priorityRank[b.priority] - priorityRank[a.priority];
        if (prioDiff !== 0) return prioDiff;
        return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
      });
    });

    return grouped;
  }, [filteredTasks]);

  const resolvePriorityMeta = (value) => {
    return PRIORITIES.find((item) => item.value === value) || PRIORITIES[1];
  };

  const resolveUrgencyColorForLane = (tasks) => {
    if (!tasks.length) return "#64748b";
    const worst = tasks.reduce((acc, task) => {
      const rank = priorityRank[task.priority] || 1;
      return rank > acc ? rank : acc;
    }, 1);

    if (worst >= 4) return "#ef4444";
    if (worst === 3) return "#f97316";
    if (worst === 2) return "#eab308";
    return "#22c55e";
  };

  const openCreateModal = () => {
    setEditingTaskId(null);
    setTaskForm({
      title: "",
      description: "",
      dueDate: "",
      responsibleUserId: String(user?.id || ""),
      priority: "medium",
      comments: "",
    });
    setOpenModal(true);
  };

  const openEditModal = (task) => {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title || "",
      description: task.description || "",
      dueDate: toDateInputValue(task.dueDate),
      responsibleUserId: String(task.responsibleUserId || user?.id || ""),
      priority: task.priority || "medium",
      comments: task.comments || "",
    });
    setOpenModal(true);
  };

  const closeModal = () => {
    setOpenModal(false);
    setEditingTaskId(null);
  };

  const getCreatorName = (task) => {
    if (task?.createdByUserName) return task.createdByUserName;
    if (task?.createdByUserId) {
      const found = users.find((u) => String(u.id) === String(task.createdByUserId));
      if (found?.name) return found.name;
    }
    return "Usuário";
  };

  const saveTask = async () => {
    if (!taskForm.title.trim()) {
      return;
    }

    const responsibleId = isManager
      ? String(taskForm.responsibleUserId || user?.id || "")
      : String(user?.id || "");

    if (editingTaskId) {
      const target = allTasks.find((task) => String(task.id) === String(editingTaskId));
      if (!target) return;
      const payload = buildPayload(target, {
        title: taskForm.title,
        description: taskForm.description,
        dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : "",
        responsibleUserId: responsibleId,
        priority: taskForm.priority,
        comments: taskForm.comments,
      });
      const { data } = await api.put(`/tasks/${editingTaskId}`, payload);
      setAllTasks((prev) =>
        prev.map((task) => (String(task.id) === String(editingTaskId) ? data : task))
      );
      closeModal();
      return;
    }

    const payload = {
      title: taskForm.title.trim(),
      description: taskForm.description.trim(),
      dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : "",
      responsibleUserId: responsibleId,
      priority: taskForm.priority,
      comments: taskForm.comments.trim(),
      status: "pending",
      sortOrder:
        (allTasks
          .filter((task) => String(task.status || "pending") === "pending")
          .reduce((max, task) => {
            const current = Number(task.sortOrder);
            return Number.isFinite(current) ? Math.max(max, current) : max;
          }, -1) || 0) + 1,
    };

    const { data } = await api.post("/tasks", payload);
    setAllTasks((prev) => [data, ...prev]);
    closeModal();
  };

  const deleteTask = async (id) => {
    await api.delete(`/tasks/${id}`);
    setAllTasks((prev) => prev.filter((task) => task.id !== id));
  };

  const duplicateTask = async (task) => {
    const targetStatus = String(task.status || "pending");
    const nextSortOrder =
      (allTasks
        .filter((item) => String(item.status || "pending") === targetStatus)
        .reduce((max, item) => {
          const current = Number(item.sortOrder);
          return Number.isFinite(current) ? Math.max(max, current) : max;
        }, -1) || 0) + 1;
    const payload = buildPayload(task, {
      title: `${task.title} (cópia)`,
      sortOrder: nextSortOrder,
    });
    const { data } = await api.post("/tasks", payload);
    setAllTasks((prev) => [data, ...prev]);
  };

  const moveTaskToStatus = async (taskId, newStatus) => {
    if (!STATUS_META[newStatus]) return;

    const task = allTasks.find((item) => String(item.id) === String(taskId));
    if (!task) return;

    const nextSortOrder =
      (allTasks
        .filter((item) => String(item.status || "pending") === String(newStatus))
        .reduce((max, item) => {
          const current = Number(item.sortOrder);
          return Number.isFinite(current) ? Math.max(max, current) : max;
        }, -1) || 0) + 1;

    const { data } = await api.put(`/tasks/${taskId}`, buildPayload(task, {
      status: newStatus,
      sortOrder: nextSortOrder,
    }));

    setAllTasks((prev) =>
      prev.map((item) => (String(item.id) === String(taskId) ? data : item))
    );
  };

  const openMoveMenu = (event, taskId) => {
    setMoveMenuAnchorEl(event.currentTarget);
    setMoveMenuTaskId(taskId);
  };

  const closeMoveMenu = () => {
    setMoveMenuAnchorEl(null);
    setMoveMenuTaskId(null);
  };

  const handleMoveTask = async (status) => {
    if (!moveMenuTaskId) return;
    await moveTaskToStatus(moveMenuTaskId, status);
    closeMoveMenu();
  };

  const updateDragOverTarget = (nextTarget) => {
    if (isSameDragOverTarget(dragOverTargetRef.current, nextTarget)) return;
    dragOverTargetRef.current = nextTarget;
    setDragOverTarget(nextTarget);
  };

  const clearDrag = () => {
    dragDataRef.current = { taskId: null };
    setDragTaskId(null);
    dragOverTargetRef.current = null;
    setDragOverTarget(null);
    if (dragGhostRef.current && dragGhostRef.current.parentNode) {
      dragGhostRef.current.parentNode.removeChild(dragGhostRef.current);
    }
    dragGhostRef.current = null;
  };

  const handleCardDragStart = (event, task) => {
    dragDataRef.current = { taskId: task.id };
    setDragTaskId(task.id);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(task.id));
      const source = event.currentTarget;
      const rect = source.getBoundingClientRect();
      const ghost = source.cloneNode(true);
      ghost.style.position = "fixed";
      ghost.style.top = "-2000px";
      ghost.style.left = "-2000px";
      ghost.style.width = `${rect.width}px`;
      ghost.style.maxWidth = `${rect.width}px`;
      ghost.style.opacity = "1";
      ghost.style.transform = "none";
      ghost.style.pointerEvents = "none";
      ghost.style.zIndex = "9999";
      ghost.style.boxShadow = "0 18px 32px rgba(15, 23, 42, 0.24)";
      ghost.style.borderRadius = "14px";
      ghost.classList.remove(classes.cardDragging);
      document.body.appendChild(ghost);
      dragGhostRef.current = ghost;
      event.dataTransfer.setDragImage(ghost, 24, 24);
    }
  };

  const getDraggedTaskId = (event) => {
    const transferTaskId = event.dataTransfer?.getData("text/plain");
    return transferTaskId || dragDataRef.current.taskId || dragTaskId;
  };

  const buildLanes = (tasks) => {
    const lanes = {
      rejected: [],
      pending: [],
      in_progress: [],
      complete: [],
    };

    tasks.forEach((task) => {
      const key = lanes[task.status] ? task.status : "pending";
      lanes[key].push(task);
    });

    Object.keys(lanes).forEach((laneKey) => {
      lanes[laneKey].sort((a, b) => {
        const aSort = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : Number.MAX_SAFE_INTEGER;
        const bSort = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : Number.MAX_SAFE_INTEGER;
        if (aSort !== bSort) return aSort - bSort;
        const prioDiff = priorityRank[b.priority] - priorityRank[a.priority];
        if (prioDiff !== 0) return prioDiff;
        return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
      });
    });

    return lanes;
  };

  const reorderTask = (
    prevTasks,
    draggedTaskId,
    targetStatus,
    options = {}
  ) => {
    const { targetIndex, targetTaskId, position } = options;
    const lanes = buildLanes(prevTasks);
    const sourceStatus =
      STATUS_ORDER.find((laneKey) =>
        lanes[laneKey].some((task) => String(task.id) === String(draggedTaskId))
      ) || "pending";
    const safeTargetStatus = lanes[targetStatus] ? targetStatus : sourceStatus;
    const sourceList = lanes[sourceStatus];
    const destinationList = lanes[safeTargetStatus];

    const movingIndex = sourceList.findIndex((task) => String(task.id) === String(draggedTaskId));
    if (movingIndex < 0) return prevTasks;

    const [movingTask] = sourceList.splice(movingIndex, 1);

    let insertIndex = destinationList.length;
    if (typeof targetIndex === "number") {
      insertIndex = targetIndex;
    } else if (targetTaskId) {
      const anchorIndex = destinationList.findIndex(
        (task) => String(task.id) === String(targetTaskId)
      );
      if (anchorIndex >= 0) {
        insertIndex = anchorIndex + (position === "after" ? 1 : 0);
      }
    }

    if (sourceStatus === safeTargetStatus && movingIndex < insertIndex) {
      insertIndex -= 1;
    }
    insertIndex = Math.max(0, Math.min(insertIndex, destinationList.length));

    const noPositionChange =
      sourceStatus === safeTargetStatus && movingIndex === insertIndex;
    if (noPositionChange) {
      return prevTasks;
    }

    destinationList.splice(insertIndex, 0, movingTask);

    const now = new Date().toISOString();
    const sortOrderById = new Map();
    STATUS_ORDER.forEach((laneKey) => {
      lanes[laneKey].forEach((task, idx) => {
        sortOrderById.set(String(task.id), idx);
      });
    });

    return prevTasks.map((task) => {
      const id = String(task.id);
      if (!sortOrderById.has(id) && id !== String(movingTask.id)) return task;

      const updated = { ...task };
      if (id === String(movingTask.id)) {
        updated.status = safeTargetStatus;
        updated.updatedAt = now;
      }
      if (sortOrderById.has(id)) {
        updated.sortOrder = sortOrderById.get(id);
      }
      return updated;
    });
  };

  const persistReorderedTasks = async (prevTasks, nextTasks) => {
    const changed = nextTasks.filter((task) => {
      const prevTask = prevTasks.find((item) => String(item.id) === String(task.id));
      if (!prevTask) return false;
      return (
        String(prevTask.status || "pending") !== String(task.status || "pending") ||
        Number(prevTask.sortOrder) !== Number(task.sortOrder)
      );
    });

    await Promise.all(
      changed.map((task) => api.put(`/tasks/${task.id}`, buildPayload(task)))
    );
  };

  const handleDropInLane = async (event, status) => {
    event.preventDefault();
    const draggedTaskId = getDraggedTaskId(event);
    if (!draggedTaskId) return;

    const prevTasks = allTasks;
    const nextTasks = reorderTask(prevTasks, draggedTaskId, status);
    setAllTasks(nextTasks);
    try {
      await persistReorderedTasks(prevTasks, nextTasks);
    } catch (error) {
      setAllTasks(prevTasks);
    }
    clearDrag();
  };

  const handleCardDragOver = (event, status, targetTaskId) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    updateDragOverTarget({ status, taskId: String(targetTaskId), position });
  };

  const handleDropOnCard = async (event, status, targetTaskId) => {
    event.preventDefault();
    event.stopPropagation();
    const draggedTaskId = getDraggedTaskId(event);
    if (!draggedTaskId) return;

    const currentPosition = dragOverTargetRef.current?.position === "after" ? "after" : "before";

    const prevTasks = allTasks;
    const nextTasks = reorderTask(prevTasks, draggedTaskId, status, {
        targetTaskId,
        position: currentPosition,
      });
    setAllTasks(nextTasks);
    try {
      await persistReorderedTasks(prevTasks, nextTasks);
    } catch (error) {
      setAllTasks(prevTasks);
    }

    clearDrag();
  };

  const handleLaneDragOver = (event) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  };

  const handleLaneBodyDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    updateDragOverTarget(null);
  };

  const handleCardDragEnd = () => {
    clearDrag();
  };

  const safeSetTaskForm = (key, value) => {
    setTaskForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className={classes.pageRoot}>
      <Paper elevation={0} className={classes.topCard}>
        <div className={classes.topTitleRow}>
          <div className={classes.titleWrap}>
            <span className={classes.titleIcon}>
              <AssignmentTurnedInIcon />
            </span>
            <div>
              <Typography className={classes.titleText}>Tarefas</Typography>
            </div>
          </div>

          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            className={classes.addButton}
            onClick={openCreateModal}
          >
            Adicionar
          </Button>
        </div>

        <Grid container spacing={1}>
          <Grid item xs={12} md={3}>
            <TextField
              className={classes.filterField}
              fullWidth
              variant="outlined"
              size="small"
              label="Localizar"
              placeholder="Nome, descrição, comentário"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              InputProps={{
                startAdornment: <SearchIcon fontSize="small" style={{ marginRight: 8, opacity: 0.7 }} />,
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              className={classes.filterField}
              fullWidth
              select
              variant="outlined"
              size="small"
              label="Filtro"
              value={visibilityScope}
              onChange={(event) => setVisibilityScope(event.target.value)}
              disabled={!isManager}
            >
              <MenuItem value="mine">Minhas tarefas</MenuItem>
              {isManager && <MenuItem value="all">Todas tarefas</MenuItem>}
            </TextField>
          </Grid>

          {isManager ? (
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                className={classes.filterField}
                fullWidth
                select
                variant="outlined"
                size="small"
                label="Usuário"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                disabled={visibilityScope !== "all"}
              >
                <MenuItem value="all">Todos os usuários</MenuItem>
                {users.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          ) : (
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                className={classes.filterField}
                fullWidth
                variant="outlined"
                size="small"
                label="Usuário"
                value={user?.name || "Meu usuário"}
                disabled
              />
            </Grid>
          )}

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              className={classes.filterField}
              fullWidth
              select
              variant="outlined"
              size="small"
              label="Prioridade"
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
            >
              <MenuItem value="all">Todas</MenuItem>
              {PRIORITIES.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              className={classes.filterField}
              fullWidth
              select
              variant="outlined"
              size="small"
              label="Data"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
            >
              {DATE_FILTERS.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <div className={classes.boardRoot}>
        <div className={classes.boardGrid}>
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status];
            const Icon = meta.icon;
            const laneTasks = tasksByStatus[status];
            const laneBadgeColor = resolveUrgencyColorForLane(laneTasks);

            return (
              <Paper
                key={status}
                className={`${classes.lane} ${dragTaskId ? classes.laneDropActive : ""}`}
                onDragOver={handleLaneDragOver}
                onDrop={(event) => handleDropInLane(event, status)}
                style={{ borderTop: `4px solid ${meta.accent}` }}
              >
                <div className={classes.laneHeader} style={{ background: meta.light }}>
                  <Typography className={classes.laneTitle} style={{ color: meta.accent }}>
                    <Icon fontSize="small" />
                    {meta.label}
                  </Typography>
                  <div
                    className={classes.laneCount}
                    style={{
                      backgroundColor: laneBadgeColor,
                      borderRadius: 999,
                      minWidth: 24,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 8px",
                    }}
                  >
                    {laneTasks.length}
                  </div>
                </div>

                <div className={classes.laneBody} onDragOver={handleLaneBodyDragOver}>
                  {laneTasks.length === 0 ? (
                    <Typography className={classes.emptyText}>
                      Sem tarefas nesta coluna.
                    </Typography>
                  ) : (
                    laneTasks.map((task) => {
                      const priorityMeta = resolvePriorityMeta(task.priority);

                      return (
                        <div
                          key={task.id}
                          data-task-card="true"
                          className={`${classes.card} ${dragTaskId === task.id ? classes.cardDragging : ""} ${dragOverTarget?.taskId === String(task.id) && dragOverTarget?.position === "before" ? classes.cardDropBefore : ""} ${dragOverTarget?.taskId === String(task.id) && dragOverTarget?.position === "after" ? classes.cardDropAfter : ""}`}
                          draggable
                          onDragStart={(event) => handleCardDragStart(event, task)}
                          onDragOver={(event) => handleCardDragOver(event, status, task.id)}
                          onDrop={(event) => handleDropOnCard(event, status, task.id)}
                          onDragEnd={handleCardDragEnd}
                        >
                          <Typography className={classes.cardTitle}>{task.title}</Typography>

                            {task.description ? (
                              <Typography className={classes.cardDescription}>
                                {task.description}
                              </Typography>
                            ) : null}

                            <div className={classes.metaRow}>
                              <PersonOutlineIcon style={{ fontSize: 14 }} />
                              <span>{task.responsibleUserName || "Sem responsável"}</span>
                            </div>

                            <div className={classes.metaRow}>
                              <CalendarTodayIcon style={{ fontSize: 14 }} />
                              <span>Prazo: {formatDateBr(task.dueDate)}</span>
                            </div>
                            <Typography className={classes.cardMetaSubtle}>
                              Criada por: {getCreatorName(task)}
                            </Typography>

                            <div className={classes.badgesRow}>
                              {status !== "complete" ? (
                                <div
                                  className={classes.priorityBadge}
                                  style={{
                                    color: priorityMeta.text,
                                    backgroundColor: priorityMeta.bg,
                                    border: `1px solid ${priorityMeta.text}22`,
                                    borderRadius: 999,
                                    padding: "0 8px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                  }}
                                >
                                  {priorityMeta.label}
                                </div>
                              ) : (
                                <span />
                              )}

                              <div className={classes.cardActions}>
                                <Tooltip title="Editar">
                                  <IconButton
                                    className={classes.iconButton}
                                    onClick={() => openEditModal(task)}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Excluir">
                                  <IconButton
                                    className={classes.iconButton}
                                    onClick={() => deleteTask(task.id)}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Duplicar">
                                  <IconButton
                                    className={classes.iconButton}
                                    onClick={() => duplicateTask(task)}
                                  >
                                    <FileCopyIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Mover para">
                                  <IconButton
                                    className={classes.iconButton}
                                    onClick={(event) => openMoveMenu(event, task.id)}
                                  >
                                    <SwapHorizIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </div>
                            </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Paper>
            );
          })}
        </div>
      </div>

      <Menu
        anchorEl={moveMenuAnchorEl}
        keepMounted
        open={Boolean(moveMenuAnchorEl)}
        onClose={closeMoveMenu}
      >
        {STATUS_ORDER.map((status) => {
          const isCurrent =
            String(
              allTasks.find((task) => String(task.id) === String(moveMenuTaskId))?.status || "pending"
            ) === String(status);

          return (
            <MenuItem
              key={status}
              onClick={() => handleMoveTask(status)}
              disabled={isCurrent}
            >
              {STATUS_META[status]?.label || status}
            </MenuItem>
          );
        })}
      </Menu>

      <Dialog
        open={openModal}
        onClose={closeModal}
        fullWidth
        maxWidth="sm"
        classes={{ paper: classes.modalPaper }}
      >
        <div className={classes.modalTopBar} />
        <DialogTitle className={classes.modalTitle}>
          {editingTaskId ? "Editar tarefa" : "Nova tarefa"}
        </DialogTitle>

        <DialogContent dividers className={classes.modalContent}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nome"
                variant="outlined"
                size="small"
                value={taskForm.title}
                onChange={(event) => safeSetTaskForm("title", event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AssignmentIcon className={classes.inputIcon} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Descrição"
                variant="outlined"
                value={taskForm.description}
                onChange={(event) => safeSetTaskForm("description", event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SubjectIcon className={classes.inputIcon} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Data limite"
                type="date"
                variant="outlined"
                size="small"
                value={taskForm.dueDate}
                onChange={(event) => safeSetTaskForm("dueDate", event.target.value)}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarTodayIcon className={classes.inputIcon} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Usuário responsável"
                variant="outlined"
                size="small"
                value={isManager ? taskForm.responsibleUserId : String(user?.id || "")}
                onChange={(event) => safeSetTaskForm("responsibleUserId", event.target.value)}
                disabled={!isManager}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutlineIcon className={classes.inputIcon} />
                    </InputAdornment>
                  ),
                }}
              >
                {users.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Prioridade"
                variant="outlined"
                size="small"
                value={taskForm.priority}
                onChange={(event) => safeSetTaskForm("priority", event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <FlagIcon className={classes.inputIcon} />
                    </InputAdornment>
                  ),
                }}
              >
                {PRIORITIES.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Comentários"
                variant="outlined"
                value={taskForm.comments}
                onChange={(event) => safeSetTaskForm("comments", event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CommentIcon className={classes.inputIcon} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeModal}>Cancelar</Button>
          <Button
            color="primary"
            variant="contained"
            onClick={saveTask}
            disabled={!taskForm.title.trim()}
          >
            {editingTaskId ? "Salvar" : "Adicionar"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default ToDoList;
