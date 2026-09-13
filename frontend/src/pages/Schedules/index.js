import React, { useState, useEffect, useReducer, useCallback, useContext, useMemo } from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import MainHeader from "../../components/MainHeader";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
// import MessageModal from "../../components/MessageModal"
import ScheduleModal from "../../components/ScheduleModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import moment from "moment";
// import { SocketContext } from "../../context/Socket/SocketContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePlans from "../../hooks/usePlans";
import { Calendar, momentLocalizer } from "react-big-calendar";
import "moment/locale/pt-br";
import "react-big-calendar/lib/css/react-big-calendar.css";
import SearchIcon from "@material-ui/icons/Search";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import BlockIcon from "@material-ui/icons/Block";
import AddIcon from "@material-ui/icons/Add";
import EventAvailableIcon from "@material-ui/icons/EventAvailable";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import AccessTimeIcon from "@material-ui/icons/AccessTime";
import useMediaQuery from "@material-ui/core/useMediaQuery";

import "./Schedules.css";

// Defina a função getUrlParam antes de usá-la
function getUrlParam(paramName) {
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get(paramName);
}

const localizer = momentLocalizer(moment);
const CALENDAR_RECURRENCE_HORIZON_MONTHS = 12;

const isBusinessDay = (dateMoment) => {
  const day = dateMoment.day();
  return day >= 1 && day <= 5;
};

const adjustByBusinessDayRule = (dateMoment, tipoDias) => {
  const adjusted = dateMoment.clone();
  if (tipoDias === 5 && !isBusinessDay(adjusted)) {
    while (!isBusinessDay(adjusted)) adjusted.subtract(1, "day");
  }
  if (tipoDias === 6 && !isBusinessDay(adjusted)) {
    while (!isBusinessDay(adjusted)) adjusted.add(1, "day");
  }
  return adjusted;
};

const addOccurrenceInterval = (baseMoment, intervalo, valorIntervalo) => {
  const value = Number(valorIntervalo) || 0;
  if (value <= 0) return baseMoment.clone();

  switch (Number(intervalo)) {
    case 1:
      return baseMoment.clone().add(value, "days");
    case 2:
      return baseMoment.clone().add(value, "weeks");
    case 3:
      return baseMoment.clone().add(value, "months");
    case 4:
      return baseMoment.clone().add(value, "minutes");
    default:
      return baseMoment.clone();
  }
};

const buildCalendarEvents = (schedules, isMobile, onDelete, onEdit, onCancel) => {
  const horizon = moment().add(CALENDAR_RECURRENCE_HORIZON_MONTHS, "months");
  const events = [];

  schedules.forEach((schedule) => {
    const baseDate = moment(schedule.sendAt);
    if (!baseDate.isValid()) return;
    const status = String(schedule?.status || "").toUpperCase();
    const isSent = status === "ENVIADA";
    const isCancelled = status === "CANCELADA";
    const canCancel = !isSent && !isCancelled;
    const eventVariant = isSent ? "sent" : isCancelled ? "cancelled" : "pending";
    const sentDate = moment(schedule?.sentAt);
    const hasValidSentDate = sentDate.isValid();

    const titleContent = (eventKey, isVirtual = false, sentEvent = false) =>
      isMobile ? `${sentEvent ? "✓" : isCancelled ? "✕" : "🕒"} ${schedule?.contact?.name || "Agendamento"}${isVirtual ? " (Rec.)" : ""}` : (
        <div key={eventKey} className="event-container">
          {sentEvent ? (
            <CheckCircleOutlineIcon style={{ fontSize: 14, flexShrink: 0 }} />
          ) : isCancelled ? (
            <BlockIcon style={{ fontSize: 14, flexShrink: 0 }} />
          ) : (
            <AccessTimeIcon style={{ fontSize: 14, flexShrink: 0 }} />
          )}
          <div className="event-title">
            {schedule?.contact?.name}
            {isVirtual ? " (Rec.)" : ""}
          </div>
          {canCancel && !isVirtual && (
            <BlockIcon
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onCancel(schedule.id);
              }}
              className="cancel-icon"
              titleAccess={i18n.t("schedules.buttons.cancel")}
            />
          )}
          <DeleteOutlineIcon
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDelete(schedule.id);
            }}
            className="delete-icon"
          />
          <EditIcon
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onEdit(schedule);
            }}
            className="edit-icon"
          />
        </div>
      );

    events.push({
      id: `${schedule.id}-base`,
      title: titleContent(`${schedule.id}-base`, false, isSent),
      eventVariant,
      schedule,
      start: baseDate.toDate(),
      end: baseDate.toDate(),
    });

    // For recurring schedules, keep a visual history of the last sent occurrence.
    if (!isSent && !isCancelled && hasValidSentDate) {
      events.push({
        id: `${schedule.id}-sent-history`,
        title: titleContent(`${schedule.id}-sent-history`, false, true),
        eventVariant: "sent",
        schedule,
        start: sentDate.toDate(),
        end: sentDate.toDate(),
      });
    }

    if (isCancelled) return;

    const valorIntervalo = Number(schedule.valorIntervalo) || 0;
    if (valorIntervalo <= 0) return;

    const maxRuns = Number(schedule.enviarQuantasVezes) || 0;
    const currentRuns = Number(schedule.contadorEnvio) || 0;
    const remainingRuns = Math.max(maxRuns - currentRuns, 0);
    if (remainingRuns <= 0) return;

    let cursor = baseDate.clone();
    for (let i = 0; i < remainingRuns; i += 1) {
      cursor = addOccurrenceInterval(cursor, schedule.intervalo, valorIntervalo);
      cursor = adjustByBusinessDayRule(cursor, Number(schedule.tipoDias));
      if (cursor.isAfter(horizon)) break;

      events.push({
        id: `${schedule.id}-rec-${i + 1}`,
        title: titleContent(`${schedule.id}-rec-${i + 1}`, true, false),
        eventVariant,
        schedule,
        start: cursor.toDate(),
        end: cursor.toDate(),
      });
    }
  });

  return events;
};

var defaultMessages = {
  date: "Data",
  time: "Hora",
  event: "Evento",
  allDay: "Dia Todo",
  week: "Semana",
  work_week: "Agendamentos",
  day: "Dia",
  month: "Mês",
  previous: "Anterior",
  next: "Próximo",
  yesterday: "Ontem",
  tomorrow: "Amanhã",
  today: "Hoje",
  agenda: "Agenda",
  noEventsInRange: "Não há agendamentos no período.",
  showMore: function showMore(total) {
    return "+" + total + " mais";
  }
};

const reducer = (state, action) => {
  if (action.type === "LOAD_SCHEDULES") {
    const schedules = action.payload;
    const newSchedules = [];

    schedules.forEach((schedule) => {
      const scheduleIndex = state.findIndex((s) => s.id === schedule.id);
      if (scheduleIndex !== -1) {
        state[scheduleIndex] = schedule;
      } else {
        newSchedules.push(schedule);
      }
    });

    return [...state, ...newSchedules];
  }

  if (action.type === "UPDATE_SCHEDULES") {
    const schedule = action.payload;
    const scheduleIndex = state.findIndex((s) => s.id === schedule.id);

    if (scheduleIndex !== -1) {
      state[scheduleIndex] = schedule;
      return [...state];
    } else {
      return [schedule, ...state];
    }
  }

  if (action.type === "DELETE_SCHEDULE") {
    const scheduleId = action.payload;

    const scheduleIndex = state.findIndex((s) => s.id === scheduleId);
    if (scheduleIndex !== -1) {
      state.splice(scheduleIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    padding: theme.spacing(2),
    height: "calc(100% - 48px)",
    display: "flex",
    flexDirection: "column",
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
    },
  },
  pageHeader: {
    width: "100%",
    marginBottom: theme.spacing(1.5),
    padding: theme.spacing(2),
    borderRadius: 16,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow:
      theme.mode === "light"
        ? "0 4px 24px rgba(15, 23, 42, 0.08)"
        : "0 4px 24px rgba(0, 0, 0, 0.35)",
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1.5),
      borderRadius: 12,
    },
  },
  headerTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(1.75),
    gap: theme.spacing(1),
    [theme.breakpoints.down("xs")]: {
      flexWrap: "wrap",
      marginBottom: theme.spacing(1.25),
    },
  },
  headerIdentity: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    minWidth: 0,
  },
  headerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 13,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #fd6f8e 0%, #f63d68 100%)",
    color: "#ffffff",
    boxShadow: "0 6px 16px rgba(246, 61, 104, 0.32)",
    flexShrink: 0,
  },
  pageHeaderTitle: {
    fontWeight: 700,
    letterSpacing: -0.2,
    fontSize: "1.15rem",
    lineHeight: 1.25,
    color: theme.palette.text.primary,
    [theme.breakpoints.down("sm")]: {
      fontSize: "1.05rem",
    },
  },
  pageHeaderSubtitle: {
    marginTop: 2,
    color: theme.palette.text.secondary,
    fontSize: "0.775rem",
    lineHeight: 1.4,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexShrink: 0,
  },
  searchRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    [theme.breakpoints.down("xs")]: {
      flexDirection: "column",
      alignItems: "stretch",
    },
  },
  searchFieldWrap: {
    flex: 1,
    minWidth: 0,
  },
  searchField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 10,
      backgroundColor:
        theme.mode === "light" ? "#f8fafc" : theme.palette.background.default,
      transition: "box-shadow 0.18s ease",
      "&:hover": {
        boxShadow: "0 0 0 3px rgba(37,99,235,0.06)",
      },
      "&.Mui-focused": {
        boxShadow: "0 0 0 3px rgba(37,99,235,0.12)",
      },
    },
    "& .MuiInputBase-input": {
      fontSize: "0.83rem",
      paddingTop: 12,
      paddingBottom: 12,
    },
  },
  actionButton: {
    minHeight: 40,
    borderRadius: 10,
    fontWeight: 700,
    fontSize: "0.78rem",
    padding: theme.spacing(0.7, 1.5),
    letterSpacing: 0.1,
    boxShadow: "0 4px 12px rgba(7, 64, 171, 0.2)",
    "&:hover": {
      boxShadow: "0 6px 18px rgba(7, 64, 171, 0.28)",
    },
  },
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflow: "hidden",
    ...theme.scrollbarStyles,
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "0 12px 26px rgba(17, 24, 39, 0.09)",
    [theme.breakpoints.down("sm")]: {
      overflow: "auto",
      padding: theme.spacing(0.5),
    },
  },
  calendarWrap: {
    height: "100%",
    minHeight: 580,
    padding: theme.spacing(1),
    borderRadius: 14,
    backgroundColor: theme.mode === "light" ? "#f1f5f9" : "#0b1220",
    border: `1px solid ${theme.palette.divider}`,
    "& .rbc-calendar": {
      fontSize: "0.82rem",
      color: theme.palette.text.primary,
      fontFamily: "inherit",
    },
    // Dark mode overrides (light mode handled by Schedules.css)
    ...(theme.mode === "dark" && {
      "& .rbc-month-view, & .rbc-time-view": {
        background: "#111b2e !important",
        border: "1px solid rgba(148,163,184,0.15) !important",
      },
      "& .rbc-agenda-view table.rbc-agenda-table": {
        border: "1px solid rgba(148,163,184,0.15) !important",
      },
      "& .rbc-header": {
        backgroundColor: "#0d1626 !important",
        color: "rgba(148,163,184,0.85) !important",
        borderBottom: "1px solid rgba(148,163,184,0.12) !important",
      },
      "& .rbc-header + .rbc-header": {
        borderLeft: "1px solid rgba(148,163,184,0.1) !important",
      },
      "& .rbc-month-row + .rbc-month-row": {
        borderTop: "1px solid rgba(148,163,184,0.08) !important",
      },
      "& .rbc-day-bg + .rbc-day-bg": {
        borderLeft: "1px solid rgba(148,163,184,0.08) !important",
      },
      "& .rbc-today": {
        backgroundColor: "rgba(79,70,229,0.12) !important",
      },
      "& .rbc-off-range-bg": {
        backgroundColor: "rgba(2,6,23,0.4) !important",
      },
      "& .rbc-off-range .rbc-button-link": {
        color: "rgba(148,163,184,0.3) !important",
      },
      "& .rbc-date-cell .rbc-button-link": {
        color: "rgba(148,163,184,0.75) !important",
      },
      "& .rbc-today .rbc-button-link": {
        color: "#fff !important",
      },
      "& .rbc-toolbar": {
        backgroundColor: "rgba(15,23,42,0.8) !important",
        border: "1px solid rgba(148,163,184,0.15) !important",
      },
      "& .rbc-toolbar button": {
        color: "rgba(226,232,240,0.85) !important",
      },
      "& .rbc-toolbar button:hover": {
        backgroundColor: "rgba(99,102,241,0.15) !important",
      },
      "& .rbc-toolbar button.rbc-active": {
        background: "#4f46e5 !important",
        color: "#fff !important",
      },
      "& .rbc-timeslot-group": {
        borderBottom: "1px solid rgba(148,163,184,0.07) !important",
      },
      "& .rbc-time-content": {
        borderTop: "1px solid rgba(148,163,184,0.1) !important",
      },
      "& .rbc-time-slot": {
        color: "rgba(148,163,184,0.5) !important",
      },
      "& .rbc-time-header": {
        background: "#0d1626 !important",
        borderBottom: "1px solid rgba(148,163,184,0.1) !important",
      },
      "& .rbc-time-header-content": {
        borderLeft: "1px solid rgba(148,163,184,0.1) !important",
      },
      "& .rbc-time-content > * + * > *": {
        borderLeft: "1px solid rgba(148,163,184,0.08) !important",
      },
      "& .rbc-agenda-view table.rbc-agenda-table thead > tr > th": {
        backgroundColor: "#0d1626 !important",
        color: "rgba(148,163,184,0.7) !important",
        borderBottom: "1px solid rgba(148,163,184,0.12) !important",
      },
      "& .rbc-agenda-view table.rbc-agenda-table tbody > tr > td": {
        borderBottom: "1px solid rgba(148,163,184,0.07) !important",
        color: "rgba(226,232,240,0.85) !important",
      },
      "& .rbc-agenda-view table.rbc-agenda-table tbody > tr > td + td": {
        borderLeft: "1px solid rgba(148,163,184,0.07) !important",
      },
      "& .rbc-agenda-date-cell": {
        color: "rgba(226,232,240,0.9) !important",
      },
      "& .rbc-agenda-time-cell": {
        color: "rgba(148,163,184,0.65) !important",
      },
      "& .rbc-agenda-view table.rbc-agenda-table tbody > tr:hover > td": {
        backgroundColor: "rgba(99,102,241,0.07) !important",
      },
      "& .rbc-overlay": {
        background: "#111b2e !important",
        border: "1px solid rgba(148,163,184,0.2) !important",
        boxShadow: "0 16px 40px rgba(0,0,0,0.5) !important",
      },
    }),
    [theme.breakpoints.down("sm")]: {
      minHeight: 470,
      padding: theme.spacing(0.5),
      overflowX: "auto",
      "& .rbc-calendar": {
        minWidth: 680,
      },
    },
  },
  calendarToolbar: {
    "& .rbc-event": {
      background:
        theme.mode === "light"
          ? "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important"
          : "linear-gradient(135deg, #818cf8 0%, #6366f1 100%) !important",
      boxShadow:
        theme.mode === "light"
          ? "0 2px 6px rgba(79,70,229,0.25) !important"
          : "0 2px 6px rgba(99,102,241,0.35) !important",
    },
  },
}));

const Schedules = () => {
  const classes = useStyles();
  const history = useHistory();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  //   const socketManager = useContext(SocketContext);
  const { user, socket } = useContext(AuthContext);


  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [deletingSchedule, setDeletingSchedule] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [cancellingSchedule, setCancellingSchedule] = useState(null);
  const [cancelConfirmModalOpen, setCancelConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [schedules, dispatch] = useReducer(reducer, []);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [contactId, setContactId] = useState(+getUrlParam("contactId"));
  const [calendarView, setCalendarView] = useState("month");

  const { getPlanCompany } = usePlans();

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useSchedules) {
        toast.error("Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando.");
        setTimeout(() => {
          history.push(`/`)
        }, 1000);
      }
    }
    fetchData();
  }, [user, history, getPlanCompany]);

  const fetchSchedules = useCallback(async () => {
    try {
      const { data } = await api.get("/schedules", {
        params: { searchParam, pageNumber },
      });

      dispatch({ type: "LOAD_SCHEDULES", payload: data.schedules });
      setHasMore(data.hasMore);
      setLoading(false);
    } catch (err) {
      toastError(err);
    }
  }, [searchParam, pageNumber]);

  const handleOpenScheduleModalFromContactId = useCallback(() => {
    if (contactId) {
      handleOpenScheduleModal();
    }
  }, [contactId]);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setCalendarView("month");
  }, [isMobile]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      fetchSchedules();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [
    searchParam,
    pageNumber,
    contactId,
    fetchSchedules,
    handleOpenScheduleModalFromContactId,
  ]);

  useEffect(() => {
    // handleOpenScheduleModalFromContactId();
    // const socket = socketManager.GetSocket(user.companyId, user.id);


    const onCompanySchedule = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_SCHEDULES", payload: data.schedule });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_SCHEDULE", payload: +data.scheduleId });
      }
    }

    socket.on(`company${user.companyId}-schedule`, onCompanySchedule)

    return () => {
      socket.off(`company${user.companyId}-schedule`, onCompanySchedule)
    };
  }, [socket, user.companyId]);

  const cleanContact = () => {
    setContactId("");
  };

  const handleOpenScheduleModal = () => {
    setSelectedSchedule(null);
    setScheduleModalOpen(true);
  };

  const handleCloseScheduleModal = () => {
    setSelectedSchedule(null);
    setScheduleModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditSchedule = (schedule) => {
    setSelectedSchedule(schedule);
    setScheduleModalOpen(true);
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      await api.delete(`/schedules/${scheduleId}`);
      toast.success(i18n.t("schedules.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingSchedule(null);
    setSearchParam("");
    setPageNumber(1);

    dispatch({ type: "RESET" });
    setPageNumber(1);
    await fetchSchedules();
  };

  const handleOpenCancelSchedule = (scheduleId) => {
    setCancellingSchedule({ id: scheduleId });
    setCancelConfirmModalOpen(true);
  };

  const handleCancelSchedule = async (scheduleId) => {
    try {
      await api.post(`/schedules/${scheduleId}/cancel`);
      toast.success(i18n.t("schedules.toasts.cancelled"));
    } catch (err) {
      toastError(err);
    }
    setCancellingSchedule(null);
    setCancelConfirmModalOpen(false);
    await fetchSchedules();
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  const calendarEvents = useMemo(() => {
    return buildCalendarEvents(
      schedules,
      isMobile,
      handleDeleteSchedule,
      (schedule) => {
        handleEditSchedule(schedule);
        setScheduleModalOpen(true);
      },
      handleOpenCancelSchedule
    );
  }, [schedules, isMobile]);

  return (
    <div className={classes.pageRoot}>
      <ConfirmationModal
        title={
          deletingSchedule &&
          `${i18n.t("schedules.confirmationModal.deleteTitle")}`
        }
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={() => handleDeleteSchedule(deletingSchedule.id)}
      >
        {i18n.t("schedules.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <ConfirmationModal
        title={
          cancellingSchedule &&
          `${i18n.t("schedules.confirmationModal.cancelTitle")}`
        }
        open={cancelConfirmModalOpen}
        onClose={() => setCancelConfirmModalOpen(false)}
        onConfirm={() => handleCancelSchedule(cancellingSchedule.id)}
      >
        {i18n.t("schedules.confirmationModal.cancelMessage")}
      </ConfirmationModal>
      {scheduleModalOpen && (
        <ScheduleModal
          open={scheduleModalOpen}
          onClose={handleCloseScheduleModal}
          reload={fetchSchedules}
          // aria-labelledby="form-dialog-title"
          scheduleId={
            selectedSchedule ? selectedSchedule.id : null
          }
          contactId={contactId}
          cleanContact={cleanContact}
        />
      )}
      <MainHeader>
        <Paper elevation={0} className={classes.pageHeader} style={{ width: "100%" }}>
          {/* Identidade + ações */}
          <div className={classes.headerTopRow}>
            <div className={classes.headerActions}>
            </div>
          </div>
          {/* Busca */}
          <div className={classes.searchRow}>
            <div className={classes.searchFieldWrap}>
              <TextField
                fullWidth
                placeholder={i18n.t("contacts.searchPlaceholder")}
                type="search"
                value={searchParam}
                onChange={handleSearch}
                variant="outlined"
                className={classes.searchField}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon style={{ color: "gray", fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
            </div>
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenScheduleModal}
              className={classes.actionButton}
              startIcon={<AddIcon />}
            >
              {i18n.t("schedules.buttons.add")}
            </Button>
          </div>
        </Paper>
      </MainHeader>
      <Paper className={classes.mainPaper} variant="outlined" onScroll={handleScroll}>
        <div className={`${classes.calendarWrap} schedule-calendar`}>
          <Calendar
            messages={defaultMessages}
            formats={{
              agendaDateFormat: "DD/MM ddd",
              weekdayFormat: "dddd"
            }}
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            view={calendarView}
            onView={setCalendarView}
            views={["month", "week", "day", "agenda"]}
            onSelectEvent={(event) => {
              if (event?.schedule) {
                handleEditSchedule(event.schedule);
              }
            }}
            tooltipAccessor={(event) => event?.schedule?.contact?.name || "Agendamento"}
            eventPropGetter={(event) => {
              if (event?.eventVariant === "sent") {
                return {
                  className: "schedule-event-sent",
                  style: {
                    background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                    boxShadow: "0 2px 6px rgba(22,163,74,0.28)",
                    color: "#fff",
                    border: "none",
                  },
                };
              }
              if (event?.eventVariant === "cancelled") {
                return {
                  className: "schedule-event-cancelled",
                  style: {
                    background: "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)",
                    boxShadow: "0 2px 6px rgba(100,116,139,0.28)",
                    color: "#fff",
                    border: "none",
                    textDecoration: "line-through",
                  },
                };
              }
              return {
                className: "schedule-event-pending",
                style: {
                  background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  boxShadow: "0 2px 6px rgba(79,70,229,0.25)",
                  color: "#fff",
                  border: "none",
                },
              };
            }}
            style={{ height: "100%" }}
            className={classes.calendarToolbar}
          />
        </div>
      </Paper>
    </div>
  );
};

export default Schedules;
