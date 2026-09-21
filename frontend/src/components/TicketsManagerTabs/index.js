import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@material-ui/core/styles";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";
import {
  makeStyles,
  Paper,
  InputBase,
  Tabs,
  Tab,
  Badge,
  IconButton,
  Typography,
  Grid,
  Tooltip,
  Switch,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  Checkbox,
  ListItemText,
} from "@material-ui/core";
import {
  Group,
  MoveToInbox as MoveToInboxIcon,
  CheckBox as CheckBoxIcon,
  MessageSharp as MessageSharpIcon,
  AccessTime as ClockIcon,
  Search as SearchIcon,
  Add as AddIcon,
  TextRotateUp,
  TextRotationDown,
  Apps as ChannelsIcon,
} from "@material-ui/icons";
import VisibilityIcon from "@material-ui/icons/Visibility";
import VisibilityOffIcon from "@material-ui/icons/VisibilityOff";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import FacebookIcon from "@material-ui/icons/Facebook";
import InstagramIcon from "@material-ui/icons/Instagram";
import ToggleButton from "@material-ui/lab/ToggleButton";

import { FilterAltOff, FilterAlt, PlaylistAddCheckOutlined, SmartToy as SmartToyIcon } from "@mui/icons-material";

import NewTicketModal from "../NewTicketModal";
import TicketsList from "../TicketsListCustom";
import TabPanel from "../TabPanel";
import { Can } from "../Can";
import TicketsQueueSelect from "../TicketsQueueSelect";
import { TagsFilter } from "../TagsFilter";
import { UsersFilter } from "../UsersFilter";
import { StatusFilter } from "../StatusFilter";
import { WhatsappsFilter } from "../WhatsappsFilter";
import { Button, Snackbar } from "@material-ui/core";

import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { QueueSelectedContext } from "../../context/QueuesSelected/QueuesSelectedContext";

import api from "../../services/api";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  ticketsWrapper: {
    position: "relative",
    display: "flex",
    height: "100%",
    flexDirection: "column",
    overflow: "hidden",
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: "transparent",
  },

  tabsHeader: {
    minWidth: "auto",
    width: "auto",
    borderRadius: 8,
    marginTop: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
    marginLeft: theme.spacing(0.5),
    marginRight: theme.spacing(0.5),
    // backgroundColor: "#eee",
    // backgroundColor: theme.palette.tabHeaderBackground,
  },

  settingsIcon: {
    alignSelf: "center",
    marginLeft: "auto",
    padding: theme.spacing(1),
  },

  tab: {
    minWidth: "auto",
    width: "auto",
    padding: theme.spacing(0.5, 1),
    borderRadius: 8,
    transition: "0.3s",
    borderColor: theme.mode === "light" ? "rgba(148,163,184,0.45)" : "rgba(148,163,184,0.25)",
    borderWidth: "1px",
    borderStyle: "solid",
    marginRight: theme.spacing(0.5),
    marginLeft: theme.spacing(0.5),

    [theme.breakpoints.down("lg")]: {
      fontSize: "0.9rem",
      padding: theme.spacing(0.4, 0.8),
      marginRight: theme.spacing(0.4),
      marginLeft: theme.spacing(0.4),
    },

    [theme.breakpoints.down("md")]: {
      fontSize: "0.8rem",
      padding: theme.spacing(0.3, 0.6),
      marginRight: theme.spacing(0.3),
      marginLeft: theme.spacing(0.3),
    },

    "&:hover": {
      backgroundColor: theme.mode === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)",
    },

    // "&$selected": {
    //   color: "#FFF",
    //   backgroundColor: theme.palette.primary.main,
    // },
  },

  tabPanelItem: {
    minWidth: "33%",
    fontSize: 10,
    marginLeft: 0,
    borderRadius: 8,
    minHeight: 36,
    textTransform: "none",
    fontWeight: 600,
    letterSpacing: "0.01em",
    transition: "background-color 0.18s ease, color 0.18s ease",
    color: theme.mode === "light" ? "#64748b" : "#94a3b8",
    border: "none",
    "& .MuiTab-wrapper": {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    "&.Mui-selected": {
      backgroundColor: theme.palette.background.paper,
      color: theme.mode === "light" ? theme.palette.primary.main : "#93c5fd",
      boxShadow: theme.mode === "light"
        ? "0 1px 2px rgba(15,23,42,0.08)"
        : "0 1px 2px rgba(0,0,0,0.25)",
    },
    "&:hover:not(.Mui-selected)": {
      backgroundColor:
        theme.mode === "light" ? "rgba(148,163,184,0.15)" : "rgba(148,163,184,0.1)",
    },
  },

  tabIndicator: {
    display: "none",
  },
  tabsBadge: {
    top: "-26%",
    right: "-10%",
    transform: "none",
    whiteSpace: "nowrap",
    borderRadius: "6px",
    padding: "0 5px",
    backgroundColor: theme.mode === "light" ? theme.palette.primary.main : "#3b82f6",
    color: "#ffffff",
    fontSize: "0.56rem",
    fontWeight: 700,
    letterSpacing: "0.03em",
  },
  ticketOptionsBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "transparent",
    border: "none",
    marginTop: theme.spacing(0.5),
    marginBottom: theme.spacing(0.75),
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    padding: theme.spacing(0.5, 0.75),
  },

  serachInputWrapper: {
    flex: 1,
    height: 40,
    background:
      theme.mode === "light"
        ? "#f1f5f9"
        : "rgba(148,163,184,0.1)",
    display: "flex",
    alignItems: "center",
    borderRadius: 12,
    padding: "2px 4px 2px 14px",
    border: "1px solid transparent",
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    transition: "background-color 0.18s ease, box-shadow 0.18s ease",
    "&:focus-within": {
      background: theme.palette.background.paper,
      boxShadow: theme.mode === "light"
        ? "0 0 0 3px rgba(37,99,235,0.12)"
        : "0 0 0 3px rgba(147,197,253,0.14)",
    },
  },

  searchIcon: {
    color: theme.mode === "light" ? "#64748b" : "#cbd5e1",
    marginRight: 6,
    alignSelf: "center",
  },

  searchInput: {
    flex: 1,
    border: "none",
    borderRadius: 10,
    fontSize: "0.8rem",
    color: theme.palette.text.primary,
  },
  iosSwitchRoot: {
    width: 36,
    height: 22,
    padding: 0,
    margin: "0 4px",
  },
  iosSwitchBase: {
    padding: 2,
    "&.Mui-checked": {
      transform: "translateX(14px)",
      color: "#fff",
      "& + .MuiSwitch-track": {
        backgroundColor: "#34c759",
        borderColor: "#34c759",
        opacity: 1,
      },
    },
  },
  iosSwitchThumb: {
    width: 18,
    height: 18,
    boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
    color: theme.mode === "light" ? "#fff" : "#cbd5e1",
  },
  iosSwitchTrack: {
    borderRadius: 22 / 2,
    border: `1px solid ${theme.mode === "light" ? "#d1d5db" : "#475569"}`,
    backgroundColor: theme.mode === "light" ? "#e5e7eb" : "#334155",
    opacity: 1,
    transition: theme.transitions.create(["background-color", "border"]),
  },

  badge: {
    // right: "-10px",
  },

  customBadge: {
    top: 1,
    right: -5,
    backgroundColor: theme.mode === "light" ? "#ef4444" : "#f87171",
    color: "#fff",
    fontWeight: 700,
    minWidth: 16,
    height: 16,
    fontSize: "0.58rem",
    lineHeight: "16px",
    padding: "0 4px",
  },
  tabBadgeWrap: {
    marginRight: theme.spacing(0.55),
    position: "relative",
  },

  show: {
    display: "block",
  },

  hide: {
    display: "none !important",
  },

  closeAllFab: {
    backgroundColor: "red",
    marginBottom: "4px",
    "&:hover": {
      backgroundColor: "darkred",
    },
  },

  speedDial: {
    position: "absolute",
    bottom: theme.spacing(1),
    right: theme.spacing(1),
    "& .MuiFab-root": {
      width: "40px",
      height: "40px",
      marginTop: "4px",
    },
    "& .MuiFab-label": {
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
  },

  snackbar: {
    display: "flex",
    justifyContent: "space-between",
    backgroundColor: theme.palette.primary.main,
    color: "white",
    borderRadius: 30,
    [theme.breakpoints.down("sm")]: {
      fontSize: "0.8em",
    },
    [theme.breakpoints.up("md")]: {
      fontSize: "1em",
    },
  },

  yesButton: {
    backgroundColor: "#FFF",
    color: "rgba(0, 100, 0, 1)",
    padding: "4px 4px",
    fontSize: "1em",
    fontWeight: "bold",
    textTransform: "uppercase",
    marginRight: theme.spacing(1),
    "&:hover": {
      backgroundColor: "darkGreen",
      color: "#FFF",
    },
    borderRadius: 30,
  },
  noButton: {
    backgroundColor: "#FFF",
    color: "rgba(139, 0, 0, 1)",
    padding: "4px 4px",
    fontSize: "1em",
    fontWeight: "bold",
    textTransform: "uppercase",
    "&:hover": {
      backgroundColor: "darkRed",
      color: "#FFF",
    },
    borderRadius: 30,
  },
  filterIcon: {
    marginRight: 2,
    alignSelf: "center",
    color: theme.mode === "light" ? "#475569" : "#e2e8f0",
    cursor: "pointer",
  },
  button: {
    height: 28,
    width: 28,
    border: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.3)" : "rgba(148,163,184,0.22)"}`,
    borderRadius: 8,
    marginRight: 0,
    backgroundColor: "transparent",
    transition: "all 0.15s ease",
    "&:hover": {
      backgroundColor: theme.palette.chat.listHover,
      borderColor: theme.mode === "light" ? "rgba(100,116,139,0.45)" : "rgba(148,163,184,0.4)",
    },
  },
  icon: {
    fontSize: 14,
    color: theme.mode === "light" ? "#64748b" : "#94a3b8",
  },
  buttonOpen: {
    backgroundColor: theme.mode === "light"
      ? `${theme.palette.primary.main}1f`
      : `${theme.palette.primary.main}38`,
    borderColor: theme.mode === "light" ? `${theme.palette.primary.main}80` : "rgba(147,197,253,0.5)",
    "& $icon": {
      color: theme.mode === "light" ? theme.palette.primary.main : "#93c5fd",
    },
  },
  statusTabs: {
    margin: theme.spacing(0, 1, 0.5),
    borderRadius: 10,
    overflowX: "hidden",
    border: "none",
    backgroundColor:
      theme.mode === "light" ? "#f1f5f9" : "rgba(148,163,184,0.1)",
    "& .MuiTabs-flexContainer": {
      padding: theme.spacing(0.4),
      gap: theme.spacing(0.25),
    },
    "& .MuiTabs-scroller": {
      overflowX: "hidden !important",
    },
    "& .MuiTabs-indicator": {
      display: "none",
    },
  },
  listPanel: {
    margin: theme.spacing(0, 1, 0.8),
    borderRadius: 10,
    border: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.1)"}`,
    backgroundColor:
      theme.mode === "light" ? "rgba(255,255,255,0.95)" : "rgba(15,23,42,0.82)",
    overflow: "hidden",
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  },
  statusTabLabel: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  statusTabIcon: {
    fontSize: 16,
  },
  statusTabTitle: {
    marginLeft: 6,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.01em",
  },
  filtersColumn: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(0.5),
    margin: theme.spacing(0, 1, 0.75),
  },
  filterItem: {
    minWidth: 0,
    "& .MuiAutocomplete-root": {
      width: "100%",
    },
    "& .MuiInputBase-root": {
      minHeight: 36,
    },
    "& .MuiInputBase-input": {
      fontSize: "0.76rem",
      paddingTop: 8,
      paddingBottom: 8,
    },
    "& .MuiInputLabel-outlined": {
      fontSize: "0.76rem",
      transform: "translate(14px, 11px) scale(1)",
    },
    "& .MuiInputLabel-outlined.MuiInputLabel-shrink": {
      transform: "translate(14px, -6px) scale(0.75)",
    },
  },
  compactFilterInput: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      backgroundColor:
        theme.mode === "light"
          ? "rgba(248,250,252,0.95)"
          : "rgba(30,41,59,0.9)",
    },
  },
  closedActionsBar: {
    margin: theme.spacing(0, 1, 0.8),
    padding: theme.spacing(0.5, 0.75),
    borderRadius: 10,
    border: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.1)"}`,
    backgroundColor:
      theme.mode === "light" ? "rgba(255,255,255,0.95)" : "rgba(15,23,42,0.82)",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  dangerButton: {
    textTransform: "none",
    borderRadius: 8,
    fontWeight: 500,
    fontSize: "0.76rem",
    lineHeight: 1.2,
    padding: theme.spacing(0.55, 1.2),
    minHeight: 30,
    borderColor: theme.mode === "light" ? "rgba(220,38,38,0.25)" : "rgba(248,113,113,0.25)",
    color: theme.mode === "light" ? "#b91c1c" : "#fca5a5",
    "&:hover": {
      borderColor: theme.mode === "light" ? "rgba(220,38,38,0.45)" : "rgba(248,113,113,0.45)",
      backgroundColor: theme.mode === "light" ? "rgba(220,38,38,0.06)" : "rgba(248,113,113,0.08)",
    },
  },
  modalFilters: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
    minWidth: 320,
    paddingTop: theme.spacing(0.5),
  },
  channelFilterGroup: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    marginRight: theme.spacing(1),
    paddingLeft: theme.spacing(1),
    borderLeft: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.35)" : "rgba(148,163,184,0.2)"}`,
  },
  channelFilterButton: {
    height: 28,
    width: 28,
    padding: 4,
    border: "none",
    borderRadius: "50%",
    backgroundColor: "transparent",
    transition: "background-color 0.15s ease",
    "&:hover": {
      backgroundColor: theme.palette.chat.listHover,
    },
  },
  channelFilterButtonActive: {
    backgroundColor: theme.mode === "light"
      ? `${theme.palette.primary.main}1f`
      : `${theme.palette.primary.main}38`,
  },
  channelFilterIcon: {
    fontSize: 16,
  },
  channelFilterMenuList: {
    paddingTop: 4,
    paddingBottom: 4,
  },
  channelFilterMenuItem: {
    minHeight: "auto",
    paddingTop: 4,
    paddingBottom: 4,
  },
  statusButtonsRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "nowrap",
    gap: 6,
  },
  modalHint: {
    fontSize: "0.78rem",
    color: theme.mode === "light" ? "#64748b" : "#94a3b8",
  },
}));

const QUEUE_FILTER_STORAGE_KEY = "ticketsQueueFilter";

const getStoredQueueIds = (userId) => {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`${QUEUE_FILTER_STORAGE_KEY}_${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    return null;
  }
};

const TicketsManagerTabs = () => {
  const theme = useTheme();
  const classes = useStyles();
  const history = useHistory();

  const [searchParam, setSearchParam] = useState("");
  const [tab, setTab] = useState("open");
  // const [tabOpen, setTabOpen] = useState("open");
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [showAllTickets, setShowAllTickets] = useState(false);
  const [sortTickets, setSortTickets] = useState(false);

  const searchInputRef = useRef();
  const [searchOnMessages, setSearchOnMessages] = useState(false);

  const { user } = useContext(AuthContext);
  const profile = String(user?.profile || "").toLowerCase();
  const allUserChat = String(user?.allUserChat || "").toLowerCase();
  const allowGroup = Boolean(user?.allowGroup);
  const userQueueIds = Array.isArray(user?.queues)
    ? user.queues.map((q) => q.id)
    : [];
  const { setSelectedQueuesMessage } = useContext(QueueSelectedContext);
  const { tabOpen, setTabOpen } = useContext(TicketsContext);

  const [openCount, setOpenCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [groupingCount, setGroupingCount] = useState(0);
  const [iaCount, setIaCount] = useState(0);

  const [selectedQueueIds, setSelectedQueueIds] = useState(() => {
    const storedQueueIds = getStoredQueueIds(user?.id);
    if (storedQueueIds) {
      const validQueueIds = storedQueueIds.filter((id) => userQueueIds.includes(id));
      if (validQueueIds.length > 0) {
        return validQueueIds;
      }
    }
    return userQueueIds;
  });
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [channelMenuAnchorEl, setChannelMenuAnchorEl] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedWhatsapp, setSelectedWhatsapp] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [forceSearch, setForceSearch] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [filter, setFilter] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [hoveredButton, setHoveredButton] = useState(null);
  const [isHoveredAll, setIsHoveredAll] = useState(false);
  const [isHoveredNew, setIsHoveredNew] = useState(false);
  const [isHoveredResolve, setIsHoveredResolve] = useState(false);
  const [isHoveredOpen, setIsHoveredOpen] = useState(false);
  const [isHoveredClosed, setIsHoveredClosed] = useState(false);
  const [isHoveredIa, setIsHoveredIa] = useState(false);
  const [isHoveredSort, setIsHoveredSort] = useState(false);

  const [isFilterActive, setIsFilterActive] = useState(false);
  const [closedBulkModalOpen, setClosedBulkModalOpen] = useState(false);
  const [closedBulkDeleteLoading, setClosedBulkDeleteLoading] = useState(false);
  const [closedBulkDateStart, setClosedBulkDateStart] = useState("");
  const [closedBulkDateEnd, setClosedBulkDateEnd] = useState("");
  const [closedBulkWhatsapps, setClosedBulkWhatsapps] = useState([]);
  const [closedBulkLimit, setClosedBulkLimit] = useState("");
  const [closedBulkCount, setClosedBulkCount] = useState(null);
  const [closedBulkCounting, setClosedBulkCounting] = useState(false);
  const [closedRefreshKey, setClosedRefreshKey] = useState(0);
  const canDeleteTickets = profile === "admin" || user?.canDeleteTickets === "enabled";
  const hiddenPanelStyle = useMemo(() => ({ width: 0, height: 0 }), []);

  useEffect(() => {
    setSelectedQueuesMessage(selectedQueueIds);
    if (user?.id) {
      try {
        localStorage.setItem(
          `${QUEUE_FILTER_STORAGE_KEY}_${user.id}`,
          JSON.stringify(selectedQueueIds)
        );
      } catch (err) {}
    }
  }, [selectedQueueIds, user?.id]);

  useEffect(() => {
    if (selectedQueueIds.length === 0 && userQueueIds.length > 0) {
      setSelectedQueueIds(userQueueIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userQueueIds.length]);

  useEffect(() => {
    if (profile === "admin" || allUserChat === "enabled") {
      setShowAllTickets(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "search") {
      searchInputRef.current?.focus();
    }
    setForceSearch((prevState) => !prevState);
  }, [tab]);

  // Atalho "Grupos" da barra lateral (MainListItems) faz
  // setTabOpen("group") antes de navegar pra cá — garante que a aba
  // principal volte pra "open" (onde a subaba de Grupos vive), mesmo se
  // o usuário estivesse em "Fechados"/"Busca" (ver docs/MANUAL_TECNICO.md).
  useEffect(() => {
    if (tabOpen === "group") {
      setTab("open");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabOpen]);

  const toggleChannelFilter = (channel) => {
    setSelectedChannels((prevState) =>
      prevState.includes(channel)
        ? prevState.filter((c) => c !== channel)
        : [...prevState, channel]
    );
  };

  let searchTimeout;

  const handleSearch = (e) => {
    const searchedTerm = e.target.value.toLowerCase();

    clearTimeout(searchTimeout);

    if (searchedTerm === "") {
      setSearchParam(searchedTerm);
      setForceSearch((prevState) => !prevState);
      // setFilter(false);
      setTab("open");
      return;
    } else if (tab !== "search") {
      handleFilter();
      setTab("search");
    }

    searchTimeout = setTimeout(() => {
      setSearchParam(searchedTerm);
      setForceSearch((prevState) => !prevState);
    }, 500);
  };

  const handleBack = () => {

    history.push("/tickets");
  };

  const handleChangeTab = (e, newValue) => {
    setTab(newValue);
  };

  const handleChangeTabOpen = (e, newValue) => {
    // if (newValue === "pending" || newValue === "group") {
    handleBack();
    // }

    setTabOpen(newValue);
  };

  const applyPanelStyle = useCallback(
    (status) => {
      if (tabOpen !== status) {
        return hiddenPanelStyle;
      }
      return undefined;
    },
    [hiddenPanelStyle, tabOpen]
  );

  const handleSnackbarOpen = () => {
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  const CloseAllTicket = async () => {
    try {
      const { data } = await api.post("/tickets/closeAll", {
        status: tabOpen,
        selectedQueueIds,
      });
      handleSnackbarClose();
    } catch (err) {
      console.log("Error: ", err);
    }
  };

  const handleCloseOrOpenTicket = (ticket) => {
    setNewTicketModalOpen(false);
    if (ticket !== undefined && ticket.uuid !== undefined) {
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  const handleSelectedTags = (selecteds) => {
    const tags = selecteds.map((t) => t.id);

    clearTimeout(searchTimeout);

    if (tags.length === 0) {
      setForceSearch((prevState) => !prevState);
    } else if (tab !== "search") {
      setTab("search");
    }

    searchTimeout = setTimeout(() => {
      setSelectedTags(tags);
      setForceSearch((prevState) => !prevState);
    }, 500);
  };

  const handleSelectedUsers = (selecteds) => {
    const users = selecteds.map((t) => t.id);

    clearTimeout(searchTimeout);

    if (users.length === 0) {
      setForceSearch((prevState) => !prevState);
    } else if (tab !== "search") {
      setTab("search");
    }
    searchTimeout = setTimeout(() => {
      setSelectedUsers(users);
      setForceSearch((prevState) => !prevState);
    }, 500);
  };

  const handleSelectedWhatsapps = (selecteds) => {
    const whatsapp = selecteds.map((t) => t.id);

    clearTimeout(searchTimeout);

    if (whatsapp.length === 0) {
      setForceSearch((prevState) => !prevState);
    } else if (tab !== "search") {
      setTab("search");
    }
    searchTimeout = setTimeout(() => {
      setSelectedWhatsapp(whatsapp);
      setForceSearch((prevState) => !prevState);
    }, 500);
  };

  const handleSelectedStatus = (selecteds) => {
    const statusFilter = selecteds.map((t) => t.status);

    clearTimeout(searchTimeout);

    if (statusFilter.length === 0) {
      setForceSearch((prevState) => !prevState);
    } else if (tab !== "search") {
      setTab("search");
    }

    searchTimeout = setTimeout(() => {
      setSelectedStatus(statusFilter);
      setForceSearch((prevState) => !prevState);
    }, 500);
  };

  const handleSelectedDate = (value) => {
    clearTimeout(searchTimeout);

    if (!value) {
      setForceSearch((prevState) => !prevState);
    } else if (tab !== "search") {
      setTab("search");
    }

    searchTimeout = setTimeout(() => {
      setSelectedDate(value);
      setForceSearch((prevState) => !prevState);
    }, 300);
  };

  const resetClosedBulkForm = () => {
    setClosedBulkDateStart("");
    setClosedBulkDateEnd("");
    setClosedBulkWhatsapps([]);
    setClosedBulkLimit("");
    setClosedBulkCount(null);
  };

  const handleOpenClosedBulkModal = () => {
    resetClosedBulkForm();
    setClosedBulkModalOpen(true);
  };

  const handleCloseClosedBulkModal = () => {
    if (closedBulkDeleteLoading) return;
    setClosedBulkModalOpen(false);
  };

  const handleClosedBulkDateStartChange = (value) => {
    setClosedBulkDateStart(value);
    setClosedBulkCount(null);
  };

  const handleClosedBulkDateEndChange = (value) => {
    setClosedBulkDateEnd(value);
    setClosedBulkCount(null);
  };

  const handleClosedBulkWhatsappsChange = (value) => {
    setClosedBulkWhatsapps(value);
    setClosedBulkCount(null);
  };

  const handleClosedBulkLimitChange = (value) => {
    setClosedBulkLimit(value);
    setClosedBulkCount(null);
  };

  const handleCalculateClosedBulk = async () => {
    if (!closedBulkDateStart || !closedBulkDateEnd) {
      toast.error(i18n.t("tickets.closed.dateRequired"));
      return;
    }

    if (closedBulkDateEnd < closedBulkDateStart) {
      toast.error(i18n.t("tickets.closed.invalidPeriod"));
      return;
    }

    setClosedBulkCounting(true);
    try {
      const whatsappIds = closedBulkWhatsapps.map(item => item.id);
      const { data } = await api.post("/tickets/closed/bulk-delete/count", {
        dateStart: closedBulkDateStart,
        dateEnd: closedBulkDateEnd,
        queueIds: selectedQueueIds,
        showAll: showAllTickets ? "true" : "false",
        whatsappIds,
        limit: closedBulkLimit ? Number(closedBulkLimit) : undefined
      });

      setClosedBulkCount(data?.count || 0);
    } catch (err) {
      toastError(err);
    } finally {
      setClosedBulkCounting(false);
    }
  };

  const handleBulkClosedDelete = async () => {
    if (!closedBulkDateStart || !closedBulkDateEnd) {
      toast.error(i18n.t("tickets.closed.dateRequired"));
      return;
    }

    if (closedBulkDateEnd < closedBulkDateStart) {
      toast.error(i18n.t("tickets.closed.invalidPeriod"));
      return;
    }

    if (closedBulkCount === null) {
      toast.error(i18n.t("tickets.closed.calculateRequired"));
      return;
    }

    setClosedBulkDeleteLoading(true);
    try {
      const whatsappIds = closedBulkWhatsapps.map(item => item.id);
      const { data } = await api.post("/tickets/closed/bulk-delete", {
        dateStart: closedBulkDateStart,
        dateEnd: closedBulkDateEnd,
        queueIds: selectedQueueIds,
        showAll: showAllTickets ? "true" : "false",
        whatsappIds,
        limit: closedBulkLimit ? Number(closedBulkLimit) : undefined
      });

      toast.success(
        data?.deletedCount > 0
          ? i18n.t("tickets.toasts.bulkDeleted", { count: data.deletedCount })
          : i18n.t("tickets.toasts.bulkDeletedEmpty")
      );

      setClosedBulkModalOpen(false);
      setClosedRefreshKey(prev => prev + 1);
    } catch (err) {
      toastError(err);
    } finally {
      setClosedBulkDeleteLoading(false);
    }
  };

  const handleFilter = () => {
    if (filter) {
      setFilter(false);
      setTab("open");
    } else setFilter(true);
    setTab("search");
  };

  const [open, setOpen] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);

  const handleVisibility = () => {
    setHidden((prevHidden) => !prevHidden);
  };

  const handleToggleShowAll = useCallback(() => {
    setShowAllTickets((prevState) => !prevState);
  }, []);

  const handleOpenCount = useCallback((val) => setOpenCount(val), []);
  const handlePendingCount = useCallback((val) => setPendingCount(val), []);
  const handleGroupingCount = useCallback((val) => setGroupingCount(val), []);
  const handleIaCount = useCallback((val) => setIaCount(val), []);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClosed = () => {
    setOpen(false);
  };

  const tooltipTitleStyle = {
    fontSize: "10px",
  };

  return (
    <>
      <Paper elevation={0} className={classes.ticketsWrapper}>
        <NewTicketModal
          modalOpen={newTicketModalOpen}
          onClose={(ticket) => {
            handleCloseOrOpenTicket(ticket);
          }}
        />
        <div className={classes.serachInputWrapper}>
        <SearchIcon className={classes.searchIcon} />
        <InputBase
          className={classes.searchInput}
          inputRef={searchInputRef}
          placeholder={i18n.t("tickets.search.placeholder")}
          type="search"
          onChange={handleSearch}
        />
        <Tooltip placement="top" title="Marque para pesquisar também nos conteúdos das mensagens (mais lento)">
          <div>
            <Switch
              disableRipple
              checked={searchOnMessages}
              onChange={(e) => { setSearchOnMessages(e.target.checked) }}
              classes={{
                root: classes.iosSwitchRoot,
                switchBase: classes.iosSwitchBase,
                thumb: classes.iosSwitchThumb,
                track: classes.iosSwitchTrack,
              }}
            />
          </div>
        </Tooltip>
        {/* <IconButton
          className={classes.filterIcon}
          color="primary"
          aria-label="upload picture"
          component="span"
          onClick={handleFilter}
        >
          <FilterListIcon />
        </IconButton> */}
        {/* <FilterListIcon
          className={classes.filterIcon}
          color="primary"
          aria-label="upload picture"
          component="span"
          onClick={handleFilter}
        /> */}
        <IconButton
          variant="contained"
          aria-label="filter"
          className={classes.filterIcon}
          onClick={() => {
            setIsFilterActive((prevState) => !prevState);
            handleFilter();
          }}
        >
          {isFilterActive ? (
            <FilterAlt className={classes.icon} />
          ) : (
            <FilterAltOff className={classes.icon} />
          )}
        </IconButton>
      </div>

      {filter === true && (
        <div className={classes.filtersColumn}>
          <div className={classes.filterItem}>
            <TagsFilter
              onFiltered={handleSelectedTags}
              className={classes.compactFilterInput}
              containerStyle={{ padding: 0 }}
              textFieldProps={{ size: "small" }}
            />
          </div>
          <div className={classes.filterItem}>
            <WhatsappsFilter
              onFiltered={handleSelectedWhatsapps}
              className={classes.compactFilterInput}
              containerStyle={{ padding: 0 }}
              textFieldProps={{ size: "small" }}
            />
          </div>
          <div className={classes.filterItem}>
            <StatusFilter
              onFiltered={handleSelectedStatus}
              className={classes.compactFilterInput}
              containerStyle={{ padding: 0 }}
              textFieldProps={{ size: "small" }}
            />
          </div>
          {profile === "admin" && (
            <div className={classes.filterItem}>
              <UsersFilter
                onFiltered={handleSelectedUsers}
                className={classes.compactFilterInput}
                containerStyle={{ padding: 0 }}
                textFieldProps={{ size: "small" }}
              />
            </div>
          )}
          <div className={classes.filterItem}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              type="date"
              label="Data"
              value={selectedDate}
              onChange={(e) => handleSelectedDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              className={classes.compactFilterInput}
            />
          </div>
        </div>
      )}

      {/* <Paper elevation={0} square className={classes.tabsHeader}>
        <Tabs
          value={tab}
          onChange={handleChangeTab}
          variant="fullWidth"
          textColor="primary"
          aria-label="icon label tabs example"
          classes={{ indicator: classes.tabIndicator }}
        >
          <Tab
            value={"open"}
            icon={<MoveToInboxIcon />}
            label={i18n.t("tickets.tabs.open.title")}
            classes={{ root: classes.tab }}
          />
          <Tab
            value={"closed"}
            icon={<CheckBoxIcon />}
            label={i18n.t("tickets.tabs.closed.title")}
            classes={{ root: classes.tab }}
          />
          <Tab
            value={"search"}
            icon={<SearchIcon />}
            label={i18n.t("tickets.tabs.search.title")}
            classes={{ root: classes.tab }}
          />
        </Tabs>
      </Paper> */}
      <Paper square elevation={0} className={classes.ticketOptionsBox}>
        <Grid container alignItems="center" justifyContent="space-between" wrap="nowrap">
          <Grid item>
            <div className={classes.statusButtonsRow}>
            <Can
              role={allUserChat === "enabled" && profile === "user" ? "admin" : profile}
              perform="tickets-manager:showall"
              yes={() => (
                <Badge
                  color="primary"
                  overlap="rectangular"
                  invisible={
                    !isHoveredAll ||
                    isHoveredNew ||
                    isHoveredResolve ||
                    isHoveredOpen ||
                    isHoveredClosed ||
                    isHoveredIa
                  }
                  badgeContent={"Todos"}
                  classes={{ badge: classes.tabsBadge }}
                >
                <ToggleButton
                  onMouseEnter={() => setIsHoveredAll(true)}
                  onMouseLeave={() => setIsHoveredAll(false)}
                  className={`${classes.button} ${showAllTickets ? classes.buttonOpen : ""}`}
                  value="uncheck"
                  selected={showAllTickets}
                  onChange={handleToggleShowAll}
                  >
                    {showAllTickets ? (
                      <VisibilityIcon className={classes.icon} />
                    ) : (
                      <VisibilityOffIcon className={classes.icon} />
                    )}
                  </ToggleButton>
                </Badge>
              )}
            />
            <Snackbar
              open={snackbarOpen}
              onClose={handleSnackbarClose}
              message={i18n.t("tickets.inbox.closedAllTickets")}
              ContentProps={{
                className: classes.snackbar,
              }}
              action={
                <>
                  <Button
                    className={classes.yesButton}
                    size="small"
                    onClick={CloseAllTicket}
                  >
                    {i18n.t("tickets.inbox.yes")}
                  </Button>
                  <Button
                    className={classes.noButton}
                    size="small"
                    onClick={handleSnackbarClose}
                  >
                    {i18n.t("tickets.inbox.no")}
                  </Button>
                </>
              }
            />
            <Badge
              color="primary"
              overlap="rectangular"
              invisible={
                isHoveredAll ||
                !isHoveredNew ||
                isHoveredResolve ||
                isHoveredOpen ||
                isHoveredClosed ||
                isHoveredIa
              }
              badgeContent={i18n.t("tickets.inbox.newTicket")}
              classes={{ badge: classes.tabsBadge }}
            >
              <IconButton
                onMouseEnter={() => setIsHoveredNew(true)}
                onMouseLeave={() => setIsHoveredNew(false)}
                className={classes.button}
                onClick={() => {
                  setNewTicketModalOpen(true);
                }}
              >
                <AddIcon className={classes.icon} />
              </IconButton>
            </Badge>
            {profile === "admin" && (
              <Badge
                color="primary"
                overlap="rectangular"
                invisible={
                  isHoveredAll ||
                  isHoveredNew ||
                  !isHoveredResolve ||
                  isHoveredOpen ||
                  isHoveredClosed ||
                  isHoveredIa
                }
                badgeContent={i18n.t("tickets.inbox.closedAll")}
                classes={{ badge: classes.tabsBadge }}
              >
                <IconButton
                  onMouseEnter={() => setIsHoveredResolve(true)}
                  onMouseLeave={() => setIsHoveredResolve(false)}
                  className={classes.button}
                  onClick={handleSnackbarOpen}
                >
                  <PlaylistAddCheckOutlined style={{ color: theme.mode === "light" ? "green" : "#FFF" }} />
                </IconButton>
              </Badge>
            )}
            <Badge
              // color="primary"
              overlap="rectangular"
              invisible={
                !(
                  tab === "open" &&
                  !isHoveredAll &&
                  !isHoveredNew &&
                  !isHoveredResolve &&
                  !isHoveredClosed &&
                  !isHoveredIa &&
                  !isHoveredSort
                ) && !isHoveredOpen
              }
              badgeContent={i18n.t("tickets.inbox.open")}
              classes={{ badge: classes.tabsBadge }}
            >
              <IconButton
                onMouseEnter={() => {
                  setIsHoveredOpen(true);
                  setHoveredButton("open");
                }}
                onMouseLeave={() => {
                  setIsHoveredOpen(false);
                  setHoveredButton(null);
                }}
                className={`${classes.button} ${tab === "open" ? classes.buttonOpen : ""}`}
                onClick={() => handleChangeTab(null, "open")}
              >
                <MoveToInboxIcon
                  style={{
                    color: isHoveredOpen
                      ? theme.mode === "light"
                        ? theme.palette.primary.main
                        : "#FFF"
                      : tab === "open"
                        ? theme.mode === "light"
                          ? theme.palette.primary.main
                          : "#FFF"
                        : "#aaa",
                  }}
                />
              </IconButton>
            </Badge>

            <Badge
              color="primary"
              overlap="rectangular"
              invisible={
                !(
                  tab === "closed" &&
                  !isHoveredAll &&
                  !isHoveredNew &&
                  !isHoveredResolve &&
                  !isHoveredOpen &&
                  !isHoveredIa &&
                  !isHoveredSort
                ) && !isHoveredClosed
              }
              badgeContent={i18n.t("tickets.inbox.resolverd")}
              classes={{ badge: classes.tabsBadge }}
            >
              <IconButton
                onMouseEnter={() => {
                  setIsHoveredClosed(true);
                  setHoveredButton("closed");
                }}
                onMouseLeave={() => {
                  setIsHoveredClosed(false);
                  setHoveredButton(null);
                }}
                className={`${classes.button} ${tab === "closed" ? classes.buttonOpen : ""}`}
                onClick={() => handleChangeTab(null, "closed")}
              >
                <CheckBoxIcon
                  style={{
                    color: isHoveredClosed
                      ? theme.mode === "light"
                        ? theme.palette.primary.main
                        : "#FFF"
                      : tab === "closed"
                        ? theme.mode === "light"
                          ? theme.palette.primary.main
                          : "#FFF"
                        : "#aaa",
                  }}
                />
              </IconButton>
            </Badge>
            <Badge
              color="primary"
              overlap="rectangular"
              invisible={
                !(
                  tab === "ia" &&
                  !isHoveredAll &&
                  !isHoveredNew &&
                  !isHoveredResolve &&
                  !isHoveredOpen &&
                  !isHoveredClosed &&
                  !isHoveredSort
                ) && !isHoveredIa
              }
              badgeContent="IA Respondendo"
              classes={{ badge: classes.tabsBadge }}
            >
              <IconButton
                onMouseEnter={() => {
                  setIsHoveredIa(true);
                  setHoveredButton("ia");
                }}
                onMouseLeave={() => {
                  setIsHoveredIa(false);
                  setHoveredButton(null);
                }}
                className={`${classes.button} ${tab === "ia" ? classes.buttonOpen : ""}`}
                onClick={() => handleChangeTab(null, "ia")}
              >
                <SmartToyIcon
                  style={{
                    fontSize: 20,
                    color: isHoveredIa
                      ? theme.mode === "light"
                        ? theme.palette.primary.main
                        : "#FFF"
                      : tab === "ia"
                        ? theme.mode === "light"
                          ? theme.palette.primary.main
                          : "#FFF"
                        : "#aaa",
                  }}
                />
              </IconButton>
            </Badge>
            {tab !== "closed" && tab !== "search" && tab !== "ia" && (
              <Badge
                color="primary"
                overlap="rectangular"
                invisible={
                  !isHoveredSort ||
                  isHoveredAll ||
                  isHoveredNew ||
                  isHoveredResolve ||
                  isHoveredOpen ||
                  isHoveredClosed ||
                  isHoveredIa
                }
                badgeContent={!sortTickets ? "Crescente" : "Decrescente"}
                classes={{ badge: classes.tabsBadge }}
              >
                <ToggleButton
                  onMouseEnter={() => setIsHoveredSort(true)}
                  onMouseLeave={() => setIsHoveredSort(false)}
                  className={`${classes.button} ${sortTickets ? classes.buttonOpen : ""}`}
                  value="uncheck"
                  selected={sortTickets}
                  onChange={() =>
                    setSortTickets((prevState) => !prevState)
                  }
                >
                  {!sortTickets ? (
                    <TextRotateUp style={{
                      color: sortTickets
                        ? theme.mode === "light"
                          ? theme.palette.primary.main
                          : "#FFF"
                        : "#aaa",
                    }} />
                  ) : (
                    <TextRotationDown style={{
                      color: sortTickets
                        ? theme.mode === "light"
                          ? theme.palette.primary.main
                          : "#FFF"
                        : "#aaa",
                    }} />
                  )}
                </ToggleButton>
              </Badge>
            )}
            </div>
          </Grid>
          <Grid item>
            <Grid container alignItems="center" wrap="nowrap">
              <Grid item>
                <div className={classes.channelFilterGroup}>
                  <Tooltip title={i18n.t("ticketsManager.channelFilter.tooltip")}>
                    <IconButton
                      size="small"
                      className={`${classes.channelFilterButton} ${selectedChannels.length > 0 ? classes.channelFilterButtonActive : ""}`}
                      onClick={(e) => setChannelMenuAnchorEl(e.currentTarget)}
                    >
                      <Badge
                        badgeContent={selectedChannels.length}
                        color="primary"
                        overlap="circular"
                        invisible={selectedChannels.length === 0}
                      >
                        <ChannelsIcon className={classes.channelFilterIcon} />
                      </Badge>
                    </IconButton>
                  </Tooltip>
                  <Menu
                    anchorEl={channelMenuAnchorEl}
                    open={Boolean(channelMenuAnchorEl)}
                    onClose={() => setChannelMenuAnchorEl(null)}
                    getContentAnchorEl={null}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                    MenuListProps={{ className: classes.channelFilterMenuList }}
                  >
                    <MenuItem
                      dense
                      className={classes.channelFilterMenuItem}
                      onClick={() => toggleChannelFilter("whatsapp")}
                    >
                      <Checkbox
                        size="small"
                        color="primary"
                        style={{ padding: 4 }}
                        checked={selectedChannels.includes("whatsapp")}
                      />
                      <WhatsAppIcon style={{ color: "#25D366", fontSize: 18, marginRight: 6 }} />
                      <ListItemText primary="WhatsApp" />
                    </MenuItem>
                    <MenuItem
                      dense
                      className={classes.channelFilterMenuItem}
                      onClick={() => toggleChannelFilter("facebook")}
                    >
                      <Checkbox
                        size="small"
                        color="primary"
                        style={{ padding: 4 }}
                        checked={selectedChannels.includes("facebook")}
                      />
                      <FacebookIcon style={{ color: "#3b5998", fontSize: 18, marginRight: 6 }} />
                      <ListItemText primary="Facebook" />
                    </MenuItem>
                    <MenuItem
                      dense
                      className={classes.channelFilterMenuItem}
                      onClick={() => toggleChannelFilter("instagram")}
                    >
                      <Checkbox
                        size="small"
                        color="primary"
                        style={{ padding: 4 }}
                        checked={selectedChannels.includes("instagram")}
                      />
                      <InstagramIcon style={{ color: "#e1306c", fontSize: 18, marginRight: 6 }} />
                      <ListItemText primary="Instagram" />
                    </MenuItem>
                  </Menu>
                </div>
              </Grid>
              <Grid item>
                <TicketsQueueSelect
                  selectedQueueIds={selectedQueueIds}
                  userQueues={user?.queues}
                  onChange={(values) => setSelectedQueueIds(values)}
                />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Paper>
      <TabPanel value={tab} name="open" className={classes.ticketsWrapper}>
        <Tabs
          value={tabOpen}
          onChange={handleChangeTabOpen}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
          className={classes.statusTabs}
        >
          {/* ATENDENDO */}
          <Tab
            label={
              <div className={classes.statusTabLabel}>
                  <Badge
                    overlap="rectangular"
                    className={classes.tabBadgeWrap}
                    classes={{ badge: classes.customBadge }}
                    badgeContent={openCount}
                    color="primary"
                  >
                    <MessageSharpIcon className={classes.statusTabIcon} />
                  </Badge>
                  <Typography className={classes.statusTabTitle}>
                    {i18n.t("ticketsList.assignedHeader")}
                  </Typography>
              </div>
            }
            value={"open"}
            name="open"
            classes={{ root: classes.tabPanelItem }}
          />

          {/* AGUARDANDO */}
          <Tab
            label={
              <div className={classes.statusTabLabel}>
                  <Badge
                    overlap="rectangular"
                    className={classes.tabBadgeWrap}
                    classes={{ badge: classes.customBadge }}
                    badgeContent={pendingCount}
                    color="primary"
                  >
                    <ClockIcon className={classes.statusTabIcon} />
                  </Badge>
                  <Typography className={classes.statusTabTitle}>
                    {i18n.t("ticketsList.pendingHeader")}
                  </Typography>
              </div>
            }
            value={"pending"}
            name="pending"
            classes={{ root: classes.tabPanelItem }}
          />

          {/* GRUPOS */}
          {allowGroup && (
            <Tab
              label={
                <div className={classes.statusTabLabel}>
                    <Badge
                      overlap="rectangular"
                      className={classes.tabBadgeWrap}
                      classes={{ badge: classes.customBadge }}
                      badgeContent={groupingCount}
                      color="primary"
                    >
                      <Group className={classes.statusTabIcon} />
                    </Badge>
                    <Typography className={classes.statusTabTitle}>
                      {i18n.t("ticketsList.groupingHeader")}
                    </Typography>
                </div>
              }
              value={"group"}
              name="group"
              classes={{ root: classes.tabPanelItem }}
            />
          )}
        </Tabs>

        <Paper className={classes.listPanel}>
          <TicketsList
            status="open"
            showAll={showAllTickets}
            sortTickets={sortTickets ? "ASC" : "DESC"}
            selectedQueueIds={selectedQueueIds}
            selectedChannels={selectedChannels}
            updateCount={handleOpenCount}
            style={applyPanelStyle("open")}
            setTabOpen={setTabOpen}
          />
          <TicketsList
            status="pending"
            selectedQueueIds={selectedQueueIds}
            selectedChannels={selectedChannels}
            sortTickets={sortTickets ? "ASC" : "DESC"}
            showAll={profile === "admin" || allUserChat === "enabled" ? showAllTickets : false}
            updateCount={handlePendingCount}
            style={applyPanelStyle("pending")}
            setTabOpen={setTabOpen}
          />
          {allowGroup && (
            <TicketsList
              status="group"
              showAll={showAllTickets}
              sortTickets={sortTickets ? "ASC" : "DESC"}
              selectedQueueIds={selectedQueueIds}
              selectedChannels={selectedChannels}
              updateCount={handleGroupingCount}
              style={applyPanelStyle("group")}
              setTabOpen={setTabOpen}
            />
          )}
        </Paper>
      </TabPanel>
      <TabPanel value={tab} name="closed" className={classes.ticketsWrapper}>
        {canDeleteTickets && (
          <Paper elevation={0} className={classes.closedActionsBar}>
            <Button
              variant="outlined"
              color="secondary"
              className={classes.dangerButton}
              onClick={handleOpenClosedBulkModal}
            >
              {i18n.t("tickets.closed.bulkDeleteButton")}
            </Button>
          </Paper>
        )}
        <TicketsList
          status="closed"
          showAll={showAllTickets}
          selectedQueueIds={selectedQueueIds}
          selectedChannels={selectedChannels}
          setTabOpen={setTabOpen}
          refreshKey={closedRefreshKey}
        />
      </TabPanel>
      <TabPanel value={tab} name="ia" className={classes.ticketsWrapper}>
        <TicketsList
          status="ia"
          showAll={showAllTickets}
          sortTickets={sortTickets ? "ASC" : "DESC"}
          selectedQueueIds={selectedQueueIds}
          selectedChannels={selectedChannels}
          updateCount={handleIaCount}
          setTabOpen={setTabOpen}
        />
      </TabPanel>
      <TabPanel value={tab} name="search" className={classes.ticketsWrapper}>
        {profile === "admin" && (
          <>
            <TicketsList
              statusFilter={selectedStatus}
              searchParam={searchParam}
              showAll={showAllTickets}
              tags={selectedTags}
              users={selectedUsers}
              selectedQueueIds={selectedQueueIds}
              selectedChannels={selectedChannels}
              whatsappIds={selectedWhatsapp}
              forceSearch={forceSearch}
              date={selectedDate}
              searchOnMessages={searchOnMessages}
              status="search"
            />
          </>
        )}

        {profile === "user" && (
          <TicketsList
            statusFilter={selectedStatus}
            searchParam={searchParam}
            showAll={false}
            tags={selectedTags}
            selectedQueueIds={selectedQueueIds}
            selectedChannels={selectedChannels}
            whatsappIds={selectedWhatsapp}
            forceSearch={forceSearch}
            date={selectedDate}
            searchOnMessages={searchOnMessages}
            status="search"
          />
        )}
      </TabPanel>
      </Paper>
      <Dialog
        open={closedBulkModalOpen}
        onClose={handleCloseClosedBulkModal}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{i18n.t("tickets.closed.bulkDeleteTitle")}</DialogTitle>
        <DialogContent dividers>
          <div className={classes.modalFilters}>
            <TextField
              label={i18n.t("tickets.closed.dateStart")}
              type="date"
              variant="outlined"
              size="small"
              value={closedBulkDateStart}
              onChange={(e) => handleClosedBulkDateStartChange(e.target.value)}
              InputLabelProps={{ shrink: true }}
              required
            />
            <TextField
              label={i18n.t("tickets.closed.dateEnd")}
              type="date"
              variant="outlined"
              size="small"
              value={closedBulkDateEnd}
              onChange={(e) => handleClosedBulkDateEndChange(e.target.value)}
              InputLabelProps={{ shrink: true }}
              required
            />
            <WhatsappsFilter
              onFiltered={handleClosedBulkWhatsappsChange}
              className={classes.compactFilterInput}
              containerStyle={{ padding: 0 }}
              textFieldProps={{ size: "small", label: i18n.t("tickets.closed.connectionFilter") }}
            />
            <TextField
              label={i18n.t("tickets.closed.limit")}
              type="number"
              variant="outlined"
              size="small"
              value={closedBulkLimit}
              onChange={(e) => handleClosedBulkLimitChange(e.target.value)}
              inputProps={{ min: 1 }}
              helperText={i18n.t("tickets.closed.limitHelp")}
            />
            <Button
              variant="outlined"
              color="primary"
              onClick={handleCalculateClosedBulk}
              disabled={closedBulkCounting || !closedBulkDateStart || !closedBulkDateEnd}
            >
              {closedBulkCounting
                ? i18n.t("tickets.closed.calculating")
                : i18n.t("tickets.closed.calculateButton")}
            </Button>
            {closedBulkCount !== null && (
              <Typography className={classes.modalHint}>
                {i18n.t("tickets.closed.calculateResult", { count: closedBulkCount })}
              </Typography>
            )}
            <Typography className={classes.modalHint}>
              {i18n.t("tickets.closed.bulkDeleteWarning")}
            </Typography>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseClosedBulkModal} disabled={closedBulkDeleteLoading}>
            {i18n.t("tickets.closed.cancel")}
          </Button>
          <Button
            onClick={handleBulkClosedDelete}
            color="secondary"
            variant="contained"
            disabled={
              closedBulkDeleteLoading ||
              !closedBulkDateStart ||
              !closedBulkDateEnd ||
              closedBulkCount === null ||
              closedBulkCount === 0
            }
          >
            {i18n.t("tickets.closed.confirmBulkDelete")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TicketsManagerTabs;
