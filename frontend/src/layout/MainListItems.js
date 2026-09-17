import React, { useCallback, useContext, useEffect, useReducer, useRef, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { makeStyles, fade } from "@material-ui/core/styles";
import moment from "moment";
import useHelps from "../hooks/useHelps";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import Divider from "@material-ui/core/Divider";
import Badge from "@material-ui/core/Badge";
import Collapse from "@material-ui/core/Collapse";
import List from "@material-ui/core/List";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";
import Chip from "@material-ui/core/Chip";
import MenuBookIcon from "@material-ui/icons/MenuBook";

import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import DashboardOutlinedIcon from "@material-ui/icons/DashboardOutlined";
import SettingsOutlinedIcon from "@material-ui/icons/SettingsOutlined";
import PeopleAltOutlinedIcon from "@material-ui/icons/PeopleAltOutlined";
import ContactPhoneOutlinedIcon from "@material-ui/icons/ContactPhoneOutlined";
import AccountTreeOutlinedIcon from "@material-ui/icons/AccountTreeOutlined";
import FlashOnIcon from "@material-ui/icons/FlashOn";
import AssignmentTurnedInIcon from "@material-ui/icons/AssignmentTurnedIn";
import HelpOutlineIcon from "@material-ui/icons/HelpOutline";
import CodeRoundedIcon from "@material-ui/icons/CodeRounded";
import ViewKanban from "@mui/icons-material/ViewKanban";
import Schedule from "@material-ui/icons/Schedule";
import LocalOfferIcon from "@material-ui/icons/LocalOffer";
import EventAvailableIcon from "@material-ui/icons/EventAvailable";
import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import PeopleIcon from "@material-ui/icons/People";
import ListIcon from "@material-ui/icons/ListAlt";
import AnnouncementIcon from "@material-ui/icons/Announcement";
import CakeIcon from "@material-ui/icons/Cake";
import ForumIcon from "@material-ui/icons/Forum";
import LocalAtmIcon from "@material-ui/icons/LocalAtm";
import WorkOutlineIcon from "@material-ui/icons/WorkOutline";
import {
  AllInclusive,
  AttachFile,
  Dashboard,
  Description,
  DeviceHubOutlined
} from "@material-ui/icons";

// NOVO ÍCONE PARA CONEXÕES
import SignalCellularConnectedNoInternet4BarIcon from "@material-ui/icons/SignalCellularConnectedNoInternet4Bar";

import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../context/Auth/AuthContext";
import { useActiveMenu } from "../context/ActiveMenuContext";

import { Can } from "../components/Can";

import { isArray } from "lodash";
import api from "../services/api";
import toastError from "../errors/toastError";
import usePlans from "../hooks/usePlans";
import useVersion from "../hooks/useVersion";
import { i18n } from "../translate/i18n";
import { Webhook } from "@mui/icons-material";

// Cor de cada ícone do menu
const iconColors = {
  dashboard: "#155eef",
  tickets: "#0e9384",
  messages: "#f79009",
  tasks: "#7a5af8",
  kanban: "#0ba5ec",
  contacts: "#12b76a",
  schedules: "#f63d68",
  tags: "#f67021",
  chats: "#6172f3",
  helps: "#0284c7",
  campaigns: "#d92d20",
  flowbuilder: "#7a5af8",
  announcements: "#dc6803",
  api: "#087443",
  users: "#444ce7",
  queues: "#0e9384",
  prompts: "#9e77ed",
  integrations: "#ef6820",
  connections: "#475467",
  files: "#1570ef",
  financial: "#039855",
  settings: "#363f72",
  companies: "#026aa2",
  globalConfig: "#6941c6",
  server: "#0f766e",
  birthday: "#e11d48",
  default: "#155eef",
};

const useStyles = makeStyles((theme) => ({
  menuRoot: {
    padding: "4px 10px 12px",
  },
  listItem: {
    position: "relative",
    height: 34,
    marginBottom: 2,
    borderRadius: 8,
    paddingLeft: 10,
    paddingRight: 10,
    transition: "background-color 0.15s ease, color 0.15s ease",
    "&:hover": {
      backgroundColor:
        theme.mode === "light"
          ? "rgba(15, 23, 42, 0.045)"
          : "rgba(248, 250, 252, 0.06)",
      "& $iconWrap": {
        color: theme.mode === "light" ? "#1e293b" : "#f1f5f9",
      },
    },
  },
  listItemIconOnly: {
    justifyContent: "center",
    paddingLeft: 4,
    paddingRight: 4,
  },
  listItemCompact: {
    height: 30,
    marginBottom: 1,
    marginLeft: 10,
    marginRight: 4,
    paddingLeft: 8,
  },
  listItemActive: {
    backgroundColor: fade(
      theme.palette.primary.main,
      theme.mode === "light" ? 0.1 : 0.2
    ),
    "&:hover": {
      backgroundColor: fade(
        theme.palette.primary.main,
        theme.mode === "light" ? 0.14 : 0.26
      ),
    },
    "& $listItemLabel": {
      fontWeight: 600,
      color: theme.palette.primary.main,
    },
    "& $iconWrap": {
      color: theme.palette.primary.main,
    },
  },
  listItemIcon: {
    minWidth: 34,
  },
  listItemIconOnlyWrap: {
    minWidth: "auto",
    margin: 0,
  },
  listItemText: {
    margin: 0,
  },
  listItemWrapper: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  listItemLabel: {
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: "0.005em",
    color: theme.mode === "light" ? "#3f4a5c" : "#cbd5e1",
    lineHeight: 1.15,
  },
  iconWrap: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 20,
    height: 20,
    color: theme.mode === "light" ? "#8792a2" : "#7d8aa0",
    transition: "color 0.15s ease",
    "& .MuiSvgIcon-root": {
      fontSize: "1.2rem",
    },
  },
  sectionDivider: {
    margin: "10px 10px 8px",
    opacity: theme.mode === "light" ? 0.6 : 0.3,
  },
  listSubheader: {
    marginBottom: 4,
    paddingLeft: 12,
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: theme.mode === "light" ? "#98a2b3" : "#7d8aa0",
    lineHeight: "18px",
    background: "transparent",
  },
  submenuSection: {
    margin: "0 0 4px",
    padding: 0,
  },
  groupExpandIcon: {
    color: theme.mode === "light" ? "#98a2b3" : "#7d8aa0",
    fontSize: "1.05rem",
  },
  versionWrap: {
    padding: "12px 14px 8px",
    textAlign: "center",
  },
  versionChip: {
    background: "var(--primaryColor, #155eef)",
    border: "1px solid rgba(255, 255, 255, 0.28)",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "0.7rem",
    letterSpacing: "0.04em",
  },
  navBadge: {
    top: 2,
    right: -6,
    backgroundColor: theme.mode === "light" ? "#ef4444" : "#f87171",
    color: "#ffffff",
    fontWeight: 700,
    minWidth: 18,
    height: 18,
    fontSize: "0.64rem",
    lineHeight: "18px",
    padding: "0 5px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
  },
  navBadgeDot: {
    top: 4,
    right: -2,
    minWidth: 10,
    height: 10,
    borderRadius: "50%",
    backgroundColor: theme.mode === "light" ? "#ef4444" : "#f87171",
    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
  },
}));

function ListItemLink(props) {
  const {
    icon,
    primary,
    to,
    href,
    tooltip,
    showBadge,
    badgeContent,
    badgeDot,
    iconKey,
    small
  } = props;
  const classes = useStyles();
  const { activeMenu } = useActiveMenu();
  const location = useLocation();
  const isActive = !href && (activeMenu === to || location.pathname === to);
  const iconColor = iconColors[iconKey] || iconColors.default;

  // Para links externos (ex.: manual técnico) renderiza uma <a> normal em vez
  // do RouterLink, já que essa navegação não é interna à SPA.
  const renderLink = React.useMemo(
    () =>
      href
        ? React.forwardRef((itemProps, ref) => (
            <a href={href} target="_blank" rel="noopener noreferrer" ref={ref} {...itemProps} />
          ))
        : React.forwardRef((itemProps, ref) => (
            <RouterLink to={to} ref={ref} {...itemProps} />
          )),
    [to, href]
  );

  const isIconOnly = !!tooltip;
  const resolvedBadgeContent = badgeContent ?? (showBadge && !badgeDot ? "!" : null);
  const hasBadge = Boolean(badgeDot ? showBadge : (resolvedBadgeContent !== null && resolvedBadgeContent !== undefined && resolvedBadgeContent !== 0));

  const ConditionalTooltip = ({ children, tooltipEnabled }) =>
    tooltipEnabled ? (
      <Tooltip
        placement="right"
        arrow
        title={
          <Typography style={{ fontWeight: 700, fontSize: "0.9rem" }}>
            {primary}
          </Typography>
        }
      >
        {children}
      </Tooltip>
    ) : (
      children
    );

  return (
    <ConditionalTooltip tooltipEnabled={!!tooltip}>
      <li className={classes.listItemWrapper}>
        <ListItem
          button
          component={renderLink}
          className={`${classes.listItem} ${
            isActive ? classes.listItemActive : ""
          } ${small ? classes.listItemCompact : ""} ${
            isIconOnly ? classes.listItemIconOnly : ""
          }`}
        >
          {icon ? (
            <ListItemIcon
              className={`${classes.listItemIcon} ${
                isIconOnly ? classes.listItemIconOnlyWrap : ""
              }`}
            >
              {hasBadge ? (
                <Badge
                  badgeContent={resolvedBadgeContent}
                  variant={badgeDot ? "dot" : "standard"}
                  color="error"
                  overlap="circular"
                  classes={{ badge: badgeDot ? classes.navBadgeDot : classes.navBadge }}
                >
                  <span className={classes.iconWrap} style={{ color: iconColor }}>
                    {icon}
                  </span>
                </Badge>
              ) : (
                <span className={classes.iconWrap} style={{ color: iconColor }}>
                  {icon}
                </span>
              )}
            </ListItemIcon>
          ) : null}
          {!isIconOnly && (
            <ListItemText
              className={classes.listItemText}
              primary={
                <Typography className={classes.listItemLabel}>
                  {primary}
                </Typography>
              }
            />
          )}
        </ListItem>
      </li>
    </ConditionalTooltip>
  );
}

const reducer = (state, action) => {
  if (action.type === "LOAD_CHATS") {
    const chats = action.payload;
    const newChats = [];

    if (isArray(chats)) {
      chats.forEach((chat) => {
        const chatIndex = state.findIndex((u) => u.id === chat.id);
        if (chatIndex !== -1) {
          state[chatIndex] = chat;
        } else {
          newChats.push(chat);
        }
      });
    }

    return [...state, ...newChats];
  }

  if (action.type === "UPDATE_CHATS") {
    const chat = action.payload;
    const chatIndex = state.findIndex((u) => u.id === chat.id);

    if (chatIndex !== -1) {
      state[chatIndex] = chat;
      return [...state];
    } else {
      return [chat, ...state];
    }
  }

  if (action.type === "DELETE_CHAT") {
    const chatId = action.payload;

    const chatIndex = state.findIndex((u) => u.id === chatId);
    if (chatIndex !== -1) {
      state.splice(chatIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }

  if (action.type === "CHANGE_CHAT") {
    const payloadChat = action.payload?.chat;
    if (!payloadChat?.id) return state;
    const chatIndex = state.findIndex((chat) => Number(chat.id) === Number(payloadChat.id));
    if (chatIndex !== -1) {
      const copy = [...state];
      copy[chatIndex] = payloadChat;
      return copy;
    }
    return [payloadChat, ...state];
  }
};

const isUserInChat = (chat, userId) => {
  const members = Array.isArray(chat?.users) ? chat.users : [];
  return members.some((member) => Number(member?.userId) === Number(userId));
};

const MainListItems = ({ collapsed, drawerClose }) => {
  const classes = useStyles();
  const { whatsApps } = useContext(WhatsAppsContext);
  const { user, socket, isAuth } = useContext(AuthContext);
  const { setActiveMenu } = useActiveMenu();
  const location = useLocation();

  const [connectionWarning, setConnectionWarning] = useState(false);
  const [openCampaignSubmenu, setOpenCampaignSubmenu] = useState(false);
  const [openDashboardSubmenu, setOpenDashboardSubmenu] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [showKanban, setShowKanban] = useState(false);
  const [showOpenAi, setShowOpenAi] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);

  const [showSchedules, setShowSchedules] = useState(false);
  const [showInternalChat, setShowInternalChat] = useState(false);
  const [showExternalApi, setShowExternalApi] = useState(false);
  const [hasTicketUnread, setHasTicketUnread] = useState(false);
  const [hasTaskNotification, setHasTaskNotification] = useState(false);

  const [invisible, setInvisible] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam] = useState("");
  const [chats, dispatch] = useReducer(reducer, []);
  const [version, setVersion] = useState(false);
  const unreadRefreshTimeout = useRef(null);
  const fetchingUnreadCount = useRef(false);
  const fetchingTaskNotification = useRef(false);
  const taskNotificationInterval = useRef(null);
  const { list } = useHelps();
  const [hasHelps, setHasHelps] = useState(false);

  const handleDrawerCloseOnLinkClick = useCallback(
    (event) => {
      if (!drawerClose) return;

      const clickedElement = event.target;
      if (!(clickedElement instanceof Element)) return;

      const clickedLink = clickedElement.closest("a[href]");
      if (clickedLink) {
        drawerClose();
      }
    },
    [drawerClose]
  );

  useEffect(() => {
    if (!isAuth || !user?.id) return;
    let active = true;
    async function checkHelps() {
      try {
        const helps = await list();
        if (active) {
          setHasHelps(helps.length > 0);
        }
      } catch (error) {
        if (error?.response?.status !== 401) {
          console.error("Erro ao carregar helps", error);
        }
      }
    }
    checkHelps();
    return () => {
      active = false;
    };
  }, [isAuth, user?.id]);

  const isManagementActive =
    location.pathname === "/" ||
    location.pathname.startsWith("/reports") ||
    location.pathname.startsWith("/moments") ||
    location.pathname.startsWith("/server-metrics");

  const isCampaignRouteActive =
    location.pathname === "/campaigns" ||
    location.pathname.startsWith("/contact-lists") ||
    location.pathname.startsWith("/campaigns-config");

  const isFlowbuilderRouteActive =
    location.pathname.startsWith("/flowbuilders") ||
    location.pathname.startsWith("/flowbuilder");

  const isSubscriptionExpired =
    user?.company?.id !== 1 &&
    Boolean(user?.company?.dueDate) &&
    moment(user.company.dueDate).isValid() &&
    moment().isSameOrAfter(moment(user.company.dueDate), "day");

  useEffect(() => {
    if (location.pathname.startsWith("/tickets")) {
      setActiveMenu("/tickets");
    } else {
      setActiveMenu("");
    }
  }, [location, setActiveMenu]);

  const { getPlanCompany } = usePlans();

  const { getVersion } = useVersion();

  useEffect(() => {
    let active = true;
    async function fetchVersion() {
      try {
        const _version = await getVersion();
        if (active) {
          setVersion(_version.version);
        }
      } catch (error) {
        if (error?.response?.status !== 401) {
          console.error("Erro ao carregar versão", error);
        }
      }
    }
    fetchVersion();
    return () => {
      active = false;
    };
  }, [getVersion]);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    if (!isAuth || !user?.companyId) return;
    let active = true;
    async function fetchData() {
      try {
        const companyId = user.companyId;
        const planConfigs = await getPlanCompany(undefined, companyId);
        if (!active) return;

        // O Master tem acesso a todas as funcionalidades do sistema
        // (precisa conseguir usar/testar tudo), independente do que o plano
        // da própria empresa dele (o "esqueleto", companyId 1) tem
        // habilitado — isso nunca dá acesso a dados de outra empresa, só ao
        // que já é dele mesmo (tudo continua escopado por companyId).
        if (user.super) {
          setShowCampaigns(true);
          setShowKanban(true);
          setShowOpenAi(true);
          setShowIntegrations(true);
          setShowSchedules(true);
          setShowInternalChat(true);
          setShowExternalApi(true);
        } else {
          // Empresa sem plano vinculado (dado legado — ver
          // docs/MANUAL_TECNICO.md sobre o bug de "não aparece o plano"):
          // `planConfigs.plan` vem `null` nesse caso, e acessar
          // `.useCampaigns` direto quebrava com TypeError em TODA página
          // (o menu lateral monta em qualquer tela), não só na assinatura.
          const plan = planConfigs?.plan;
          setShowCampaigns(!!plan?.useCampaigns);
          setShowKanban(!!plan?.useKanban);
          setShowOpenAi(!!plan?.useOpenAi);
          setShowIntegrations(!!plan?.useIntegrations);
          setShowSchedules(!!plan?.useSchedules);
          setShowInternalChat(!!plan?.useInternalChat);
          setShowExternalApi(!!plan?.useExternalApi);
        }
      } catch (error) {
        if (error?.response?.status !== 401) {
          console.error("Erro ao carregar plano", error);
        }
      }
    }
    fetchData();
    return () => {
      active = false;
    };
  }, [getPlanCompany, isAuth, user?.companyId]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchChats();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    if (user.id) {
      const companyId = user.companyId;
      const onCompanyChatMainListItems = (data) => {
        if (data?.chat?.id && !isUserInChat(data.chat, user.id)) {
          return;
        }
        if (data.action === "new-message") {
          dispatch({ type: "CHANGE_CHAT", payload: data });
        }
        if (data.action === "update") {
          dispatch({ type: "CHANGE_CHAT", payload: data });
        }
      };

      socket.on(`company-${companyId}-chat`, onCompanyChatMainListItems);
      return () => {
        socket.off(`company-${companyId}-chat`, onCompanyChatMainListItems);
      };
    }
  }, [socket]);

  const fetchTicketUnreadCount = useCallback(async () => {
    if (!user?.companyId || fetchingUnreadCount.current) return;

    fetchingUnreadCount.current = true;
    try {
      const { data } = await api.get("/tickets", {
        params: {
          searchParam: "",
          pageNumber: 1,
          showAll: "false",
          withUnreadMessages: "true",
          sortTickets: "DESC"
        },
      });

      setHasTicketUnread(Number(data?.count || 0) > 0);
    } catch (error) {
      console.error("Erro ao carregar contagem de mensagens não lidas", error);
    } finally {
      fetchingUnreadCount.current = false;
    }
  }, [user?.companyId]);

  const scheduleFetchTicketUnreadCount = useCallback(() => {
    if (unreadRefreshTimeout.current) return;
    unreadRefreshTimeout.current = setTimeout(() => {
      unreadRefreshTimeout.current = null;
      fetchTicketUnreadCount();
    }, 300);
  }, [fetchTicketUnreadCount]);

  const fetchTaskNotification = useCallback(async () => {
    if (!user?.id || !user?.companyId || fetchingTaskNotification.current) return;

    fetchingTaskNotification.current = true;
    try {
      const { data } = await api.get("/tasks");
      const tasks = Array.isArray(data) ? data : [];
      const hasUnreadLikeTask = tasks.some((task) => {
        const isAssignedToMe = Number(task?.responsibleUserId) === Number(user.id);
        const isCreatedByAnother = Number(task?.createdByUserId) !== Number(user.id);
        const status = String(task?.status || "").toLowerCase();
        const isActiveStatus = status !== "complete" && status !== "rejected";
        return isAssignedToMe && isCreatedByAnother && isActiveStatus;
      });
      setHasTaskNotification(hasUnreadLikeTask);
    } catch (error) {
      console.error("Erro ao carregar indicador de tarefas", error);
    } finally {
      fetchingTaskNotification.current = false;
    }
  }, [user?.id, user?.companyId]);

  useEffect(() => {
    fetchTicketUnreadCount();
  }, [fetchTicketUnreadCount]);

  useEffect(() => {
    fetchTaskNotification();
  }, [fetchTaskNotification]);

  useEffect(() => {
    if (!user?.id || !user?.companyId) return;

    if (taskNotificationInterval.current) {
      clearInterval(taskNotificationInterval.current);
    }

    taskNotificationInterval.current = setInterval(() => {
      fetchTaskNotification();
    }, 30000);

    return () => {
      if (taskNotificationInterval.current) {
        clearInterval(taskNotificationInterval.current);
      }
    };
  }, [fetchTaskNotification, user?.id, user?.companyId]);

  useEffect(() => {
    const companyId = user.companyId;
    if (!companyId) return;

    const onCompanyTicketMainListItems = (data) => {
      if (["updateUnread", "update", "delete"].includes(data?.action)) {
        scheduleFetchTicketUnreadCount();
      }
    };

    const onCompanyAppMessageMainListItems = (data) => {
      if (["create", "update", "delete"].includes(data?.action)) {
        scheduleFetchTicketUnreadCount();
      }
    };

    socket.on(`company-${companyId}-ticket`, onCompanyTicketMainListItems);
    socket.on(`company-${companyId}-appMessage`, onCompanyAppMessageMainListItems);

    return () => {
      socket.off(`company-${companyId}-ticket`, onCompanyTicketMainListItems);
      socket.off(`company-${companyId}-appMessage`, onCompanyAppMessageMainListItems);
    };
  }, [socket, user.companyId, scheduleFetchTicketUnreadCount]);

  useEffect(() => {
    return () => {
      if (unreadRefreshTimeout.current) {
        clearTimeout(unreadRefreshTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    let unreadsCount = 0;
    if (chats.length > 0) {
      for (let chat of chats) {
        const users = Array.isArray(chat?.users) ? chat.users : [];
        for (let chatUser of users) {
          if (chatUser.userId === user.id) {
            unreadsCount += chatUser.unreads;
          }
        }
      }
    }
    if (unreadsCount > 0) {
      setInvisible(false);
    } else {
      setInvisible(true);
    }
  }, [chats, user.id]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (whatsApps.length > 0) {
        const offlineWhats = whatsApps.filter((whats) => {
          const channel = String(whats?.channel || "").toLowerCase();

          // API Oficial: considera problema apenas quando faltam dados mínimos de vínculo.
          if (channel === "whatsapp_oficial") {
            const hasOfficialBinding =
              Boolean(whats?.waba_webhook_id) &&
              Boolean(String(whats?.token || "").trim()) &&
              Boolean(String(whats?.phone_number_id || "").trim());
            return !hasOfficialBinding;
          }

          // Conexões QR (Baileys/wuzAPI): mantém regra atual por status de sessão.
          return (
            whats.status === "qrcode" ||
            whats.status === "PAIRING" ||
            whats.status === "DISCONNECTED" ||
            whats.status === "TIMEOUT" ||
            whats.status === "OPENING"
          );
        });
        if (offlineWhats.length > 0) {
          setConnectionWarning(true);
        } else {
          setConnectionWarning(false);
        }
      }
    }, 2000);
    return () => clearTimeout(delayDebounceFn);
  }, [whatsApps]);

  const fetchChats = async () => {
    try {
      const { data } = await api.get("/chats/", {
        params: { searchParam, pageNumber },
      });
      dispatch({ type: "LOAD_CHATS", payload: data.records });
    } catch (err) {
      toastError(err);
    }
  };

  if (isSubscriptionExpired) {
    // "Minha assinatura" mudou de lugar (v2.3.14): agora fica em
    // Configurações, não no módulo Financeiro (que virou operacional da
    // própria empresa — cadastros de clientes/fornecedores/produtos).
    // Configurações é bloqueada pro profile "user" (ForbiddenPage), então só
    // o Admin (quem trata de cobrança) recebe o link — o funcionário comum
    // só vê um aviso, sem link morto.
    if (user.profile !== "admin") {
      return (
        <div className={classes.menuRoot}>
          <Typography
            variant="body2"
            style={{ padding: 16, color: "#991b1b", fontSize: "0.8rem" }}
          >
            Assinatura da empresa vencida. Fale com o administrador do sistema.
          </Typography>
        </div>
      );
    }
    return (
      <div onClick={handleDrawerCloseOnLinkClick} className={classes.menuRoot}>
        <ListItemLink
          to="/settings?tab=subscription"
          primary="Assinatura"
          icon={<LocalAtmIcon />}
          iconKey="financial"
          tooltip={collapsed}
        />
      </div>
    );
  }

  return (
    <div onClick={handleDrawerCloseOnLinkClick} className={classes.menuRoot}>
      <Can
        role={
          (user.profile === "user" && user.showDashboard === "enabled") ||
          user.allowRealTime === "enabled"
            ? "admin"
            : user.profile
        }
        perform={"drawer-admin-items:view"}
        yes={() => (
          <>
            <Tooltip
              placement="right"
              arrow
              title={
                collapsed ? (
                  <Typography
                    style={{ fontWeight: 700, fontSize: "0.9rem" }}
                  >
                    {i18n.t("mainDrawer.listItems.management")}
                  </Typography>
                ) : (
                  ""
                )
              }
            >
              <ListItem
                dense
                button
                className={`${classes.listItem} ${
                  isManagementActive ? classes.listItemActive : ""
                } ${collapsed ? classes.listItemIconOnly : ""}`}
                onClick={() =>
                  setOpenDashboardSubmenu((prev) => !prev)
                }
              >
                <ListItemIcon
                  className={`${classes.listItemIcon} ${
                    collapsed ? classes.listItemIconOnlyWrap : ""
                  }`}
                >
                  <span
                    className={classes.iconWrap}
                    style={{ color: iconColors.dashboard }}
                  >
                    <Dashboard />
                  </span>
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    className={classes.listItemText}
                    primary={
                      <Typography className={classes.listItemLabel}>
                        {i18n.t("mainDrawer.listItems.management")}
                      </Typography>
                    }
                  />
                )}
                {!collapsed &&
                  (openDashboardSubmenu ? (
                    <ExpandLessIcon className={classes.groupExpandIcon} />
                  ) : (
                    <ExpandMoreIcon className={classes.groupExpandIcon} />
                  ))}
              </ListItem>
            </Tooltip>
            <Collapse
              in={openDashboardSubmenu}
              timeout="auto"
              unmountOnExit
              className={classes.submenuSection}
            >
              <Can
                role={
                  user.profile === "user" &&
                  user.showDashboard === "enabled"
                    ? "admin"
                    : user.profile
                }
                perform={"drawer-admin-items:view"}
                yes={() => (
                  <>
                    <ListItemLink
                      small
                      to="/"
                      primary="Dashboard"
                      icon={<DashboardOutlinedIcon />}
                      iconKey="dashboard"
                      tooltip={collapsed}
                    />
                    <ListItemLink
                      small
                      to="/reports"
                      primary={i18n.t(
                        "mainDrawer.listItems.reports"
                      )}
                      icon={<Description />}
                      iconKey="dashboard"
                      tooltip={collapsed}
                    />
                  </>
                )}
              />
              {(user.profile !== "user" ||
                user.allowRealTime === "enabled") && (
                <ListItemLink
                  small
                  to="/moments"
                  primary={i18n.t("mainDrawer.listItems.chatsTempoReal")}
                  icon={<ForumIcon />}
                  iconKey="dashboard"
                  tooltip={collapsed}
                />
              )}
            </Collapse>
          </>
        )}
      />
      <ListItemLink
        to="/tickets"
        primary={i18n.t("mainDrawer.listItems.tickets")}
        icon={<WhatsAppIcon />}
        iconKey="tickets"
        showBadge={hasTicketUnread}
        badgeDot
        tooltip={collapsed}
      />

      <ListItemLink
        to="/quick-messages"
        primary={i18n.t("mainDrawer.listItems.quickMessages")}
        icon={<FlashOnIcon />}
        iconKey="messages"
        tooltip={collapsed}
      />

      <ListItemLink
        to="/todolist"
        primary={i18n.t("todo.task")}
        icon={<AssignmentTurnedInIcon />}
        iconKey="tasks"
        showBadge={hasTaskNotification}
        badgeDot
        tooltip={collapsed}
      />

      {showKanban && (
        <>
          <ListItemLink
            to="/kanban"
            primary={i18n.t("mainDrawer.listItems.kanban")}
            icon={<ViewKanban />}
            iconKey="kanban"
            tooltip={collapsed}
          />
        </>
      )}

      <ListItemLink
        to="/contacts"
        primary={i18n.t("mainDrawer.listItems.contacts")}
        icon={<ContactPhoneOutlinedIcon />}
        iconKey="contacts"
        tooltip={collapsed}
      />

      {showSchedules && (
        <>
          <ListItemLink
            to="/schedules"
            primary={i18n.t("mainDrawer.listItems.schedules")}
            icon={<Schedule />}
            iconKey="schedules"
            tooltip={collapsed}
          />
        </>
      )}

      <ListItemLink
        to="/tags"
        primary={i18n.t("mainDrawer.listItems.tags")}
        icon={<LocalOfferIcon />}
        iconKey="tags"
        tooltip={collapsed}
      />

      {showInternalChat && (
        <>
          <ListItemLink
            to="/chats"
            primary={i18n.t("mainDrawer.listItems.chats")}
            icon={
              <Badge
                color="secondary"
                variant="dot"
                overlap="rectangular"
                invisible={invisible}
              >
                <ForumIcon />
              </Badge>
            }
            iconKey="chats"
            tooltip={collapsed}
          />
        </>
      )}

      {hasHelps && (
        <ListItemLink
          to="/helps"
          primary={i18n.t("mainDrawer.listItems.helps")}
          icon={<HelpOutlineIcon />}
          iconKey="helps"
          tooltip={collapsed}
        />
      )}

      <Can
        role={
          user.profile === "user" &&
          user.allowConnections === "enabled"
            ? "admin"
            : user.profile
        }
        perform="dashboard:view"
        yes={() => (
          <>
            {!collapsed && (
              <>
                <Divider className={classes.sectionDivider} />
                <ListSubheader inset className={classes.listSubheader}>
                  {i18n.t("mainDrawer.listItems.administration")}
                </ListSubheader>
              </>
            )}
            {showCampaigns && (
              <Can
                role={user.profile}
                perform="dashboard:view"
                yes={() => (
                  <>
                    <Tooltip
                      placement="right"
                      arrow
                      title={
                        collapsed ? (
                          <Typography
                            style={{
                              fontWeight: 700,
                              fontSize: "0.9rem",
                            }}
                          >
                            {i18n.t(
                              "mainDrawer.listItems.campaigns"
                            )}
                          </Typography>
                        ) : (
                          ""
                        )
                      }
                    >
                      <ListItem
                        dense
                        button
                        className={`${classes.listItem} ${
                          isCampaignRouteActive
                            ? classes.listItemActive
                            : ""
                        } ${collapsed ? classes.listItemIconOnly : ""}`}
                        onClick={() =>
                          setOpenCampaignSubmenu((prev) => !prev)
                        }
                      >
                        <ListItemIcon
                          className={`${classes.listItemIcon} ${
                            collapsed ? classes.listItemIconOnlyWrap : ""
                          }`}
                        >
                          <span
                            className={classes.iconWrap}
                            style={{ color: iconColors.campaigns }}
                          >
                            <EventAvailableIcon />
                          </span>
                        </ListItemIcon>
                        {!collapsed && (
                          <ListItemText
                            className={classes.listItemText}
                            primary={
                              <Typography className={classes.listItemLabel}>
                                {i18n.t(
                                  "mainDrawer.listItems.campaigns"
                                )}
                              </Typography>
                            }
                          />
                        )}
                        {!collapsed &&
                          (openCampaignSubmenu ? (
                            <ExpandLessIcon
                              className={classes.groupExpandIcon}
                            />
                          ) : (
                            <ExpandMoreIcon
                              className={classes.groupExpandIcon}
                            />
                          ))}
                      </ListItem>
                    </Tooltip>
                    <Collapse
                      in={openCampaignSubmenu}
                      timeout="auto"
                      unmountOnExit
                      className={classes.submenuSection}
                    >
                      <List dense component="div" disablePadding>
                        <ListItemLink
                          to="/campaigns"
                          primary={i18n.t(
                            "campaigns.subMenus.list"
                          )}
                          icon={<ListIcon />}
                          iconKey="campaigns"
                          tooltip={collapsed}
                        />
                        <ListItemLink
                          to="/contact-lists"
                          primary={i18n.t(
                            "campaigns.subMenus.listContacts"
                          )}
                          icon={<PeopleIcon />}
                          iconKey="campaigns"
                          tooltip={collapsed}
                        />
                        <ListItemLink
                          to="/campaigns-config"
                          primary={i18n.t(
                            "campaigns.subMenus.settings"
                          )}
                          icon={<SettingsOutlinedIcon />}
                          iconKey="campaigns"
                          tooltip={collapsed}
                        />
                      </List>
                    </Collapse>
                  </>
                )}
              />
            )}

            <Can
              role={user.profile}
              perform="dashboard:view"
              yes={() => (
                <ListItemLink
                  to="/flowbuilders/conversation"
                  primary={i18n.t(
                    "mainDrawer.listItems.flowbuilder"
                  )}
                  icon={<Webhook />}
                  iconKey="flowbuilder"
                  tooltip={collapsed}
                />
              )}
            />

            {user.super && (
              <ListItemLink
                to="/announcements"
                primary={i18n.t(
                  "mainDrawer.listItems.annoucements"
                )}
                icon={<AnnouncementIcon />}
                iconKey="announcements"
                tooltip={collapsed}
              />
            )}

            {showExternalApi && (
              <>
                <Can
                  role={user.profile}
                  perform="dashboard:view"
                  yes={() => (
                    <ListItemLink
                      to="/messages-api"
                      primary={i18n.t(
                        "mainDrawer.listItems.messagesAPI"
                      )}
                      icon={<CodeRoundedIcon />}
                      iconKey="api"
                      tooltip={collapsed}
                    />
                  )}
                />
              </>
            )}
            <Can
              role={user.profile}
              perform="dashboard:view"
              yes={() => (
                <ListItemLink
                  to="/users"
                  primary={i18n.t("mainDrawer.listItems.users")}
                  icon={<PeopleAltOutlinedIcon />}
                  iconKey="users"
                  tooltip={collapsed}
                />
              )}
            />
            <Can
              role={user.profile}
              perform="dashboard:view"
              yes={() => (
                <ListItemLink
                  to="/birthday-settings"
                  primary={i18n.t("mainDrawer.listItems.birthdaySettings")}
                  icon={<CakeIcon />}
                  iconKey="birthday"
                  tooltip={collapsed}
                />
              )}
            />
            <Can
              role={user.profile}
              perform="dashboard:view"
              yes={() => (
                <ListItemLink
                  to="/queues"
                  primary={i18n.t("mainDrawer.listItems.queues")}
                  icon={<AccountTreeOutlinedIcon />}
                  iconKey="queues"
                  tooltip={collapsed}
                />
              )}
            />

            {showOpenAi && (
              <Can
                role={user.profile}
                perform="dashboard:view"
                yes={() => (
                  <ListItemLink
                    to="/prompts"
                    primary={i18n.t(
                      "mainDrawer.listItems.prompts"
                    )}
                    icon={<AllInclusive />}
                    iconKey="prompts"
                    tooltip={collapsed}
                  />
                )}
              />
            )}

            {showIntegrations && (
              <Can
                role={user.profile}
                perform="dashboard:view"
                yes={() => (
                  <ListItemLink
                    to="/queue-integration"
                    primary={i18n.t(
                      "mainDrawer.listItems.queueIntegration"
                    )}
                    icon={<DeviceHubOutlined />}
                    iconKey="integrations"
                    tooltip={collapsed}
                  />
                )}
              />
            )}
            <Can
              role={
                user.profile === "user" &&
                user.allowConnections === "enabled"
                  ? "admin"
                  : user.profile
              }
              perform={"drawer-admin-items:view"}
              yes={() => (
                <ListItemLink
                  to="/connections"
                  primary={i18n.t(
                    "mainDrawer.listItems.connections"
                  )}
                  icon={
                    <SignalCellularConnectedNoInternet4BarIcon />
                  }
                  iconKey="connections"
                  showBadge={connectionWarning}
                  tooltip={collapsed}
                />
              )}
            />
            {user.super && (
              <ListItemLink
                to="/allConnections"
                primary={i18n.t("mainDrawer.listItems.allConnections")}
                icon={<SignalCellularConnectedNoInternet4BarIcon />}
                iconKey="connections"
                tooltip={collapsed}
              />
            )}
            <Can
              role={user.profile}
              perform="dashboard:view"
              yes={() => (
                <ListItemLink
                  to="/files"
                  primary={i18n.t("mainDrawer.listItems.files")}
                  icon={<AttachFile />}
                  iconKey="files"
                  tooltip={collapsed}
                />
              )}
            />
            <Can
              role={user.profile}
              perform="dashboard:view"
              yes={() => (
                <ListItemLink
                  to="/financeiro"
                  primary={i18n.t(
                    "mainDrawer.listItems.financeiro"
                  )}
                  icon={<LocalAtmIcon />}
                  iconKey="financial"
                  tooltip={collapsed}
                />
              )}
            />
            <Can
              role={user.profile}
              perform="dashboard:view"
              yes={() => (
                <ListItemLink
                  to="/rh"
                  primary={i18n.t(
                    "mainDrawer.listItems.rh"
                  )}
                  icon={<WorkOutlineIcon />}
                  iconKey="rh"
                  tooltip={collapsed}
                />
              )}
            />
            <Can
              role={user.profile}
              perform="dashboard:view"
              yes={() => (
                <ListItemLink
                  to="/attendance-schedule"
                  primary={i18n.t(
                    "mainDrawer.listItems.attendanceSchedule"
                  )}
                  icon={<EventAvailableIcon />}
                  iconKey="schedules"
                  tooltip={collapsed}
                />
              )}
            />
            <Can
              role={user.profile}
              perform="dashboard:view"
              yes={() => (
                <ListItemLink
                  to="/settings"
                  primary={i18n.t(
                    "mainDrawer.listItems.settings"
                  )}
                  icon={<SettingsOutlinedIcon />}
                  iconKey="settings"
                  tooltip={collapsed}
                />
              )}
            />

            {/* Painel SaaS não é mais um item de menu separado: o Master acessa
                as mesmas telas de cobrança/planos pelo item "Financeiro" acima
                (que, pra quem é Master, mostra o Painel SaaS em vez da fatura
                de uma empresa-cliente). */}

            <Divider className={classes.sectionDivider} />
            <ListItemLink
              href={`${window.location.origin}/manual/MANUAL_TECNICO.md`}
              primary="Manual técnico"
              icon={<MenuBookIcon />}
              iconKey="default"
              tooltip={collapsed}
            />
            <div className={classes.versionWrap}>
              <Chip
                size="small"
                label={version ? `AtendeFlow v${version}` : "AtendeFlow"}
                className={classes.versionChip}
              />
            </div>
          </>
        )}
      />
    </div>
  );
};

export default MainListItems;
