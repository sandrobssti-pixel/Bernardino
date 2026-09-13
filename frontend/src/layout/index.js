import React, { useState, useContext, useEffect } from "react";
import clsx from "clsx";

import {
  makeStyles,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Divider,
  MenuItem,
  IconButton,
  Menu,
  useTheme,
  useMediaQuery,
  Avatar,
  Badge,
  withStyles,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@material-ui/core";

import MenuIcon from "@material-ui/icons/Menu";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import CachedIcon from "@material-ui/icons/Cached";

import MainListItems from "./MainListItems";
import NotificationsPopOver from "../components/NotificationsPopOver";
import NotificationsVolume from "../components/NotificationsVolume";
import UserModal from "../components/UserModal";
import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import { i18n } from "../translate/i18n";
import toastError from "../errors/toastError";
import AnnouncementsPopover from "../components/AnnouncementsPopover";
import TopAnnouncementBanner from "../components/TopAnnouncementBanner";
import ChatPopover from "../pages/Chat/ChatPopover";

import { useDate } from "../hooks/useDate";
import UserLanguageSelector from "../components/UserLanguageSelector";

import ColorModeContext from "./themeContext";
import Brightness4Icon from "@material-ui/icons/Brightness4";
import Brightness7Icon from "@material-ui/icons/Brightness7";
import { getBackendUrl } from "../config";
import useSettings from "../hooks/useSettings";
import VersionControl from "../components/VersionControl";
import api from "../services/api";

// logos (fallbacks)
import logo from "../assets/logo.png";
import logoDark from "../assets/logo-black.png";

const backendUrl = getBackendUrl();
const drawerWidth = 228;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    height: "var(--app-height, 100vh)",
    overflow: "hidden",
    opacity: 0,
    animation: "$fadeIn 0.4s ease forwards",
    [theme.breakpoints.down("sm")]: {
      height: "var(--app-height, 100vh)",
      transform: "translateY(var(--app-offset-top, 0px))",
    },
    backgroundColor: theme.palette.fancyBackground,
    "& .MuiButton-outlinedPrimary": {
      color: theme.palette.primary,
      border:
        theme.mode === "light"
          ? "1px solid rgba(0 124 102)"
          : "1px solid rgba(255, 255, 255, 0.5)",
    },
    "& .MuiTab-textColorPrimary.Mui-selected": {
      color: theme.palette.primary,
    },
  },
  "@keyframes fadeIn": {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },

  chip: { background: "red", color: "white" },
  avatar: { width: "100%" },

  toolbar: {
    paddingRight: 14,
    paddingLeft: 10,
    color: "#ffffff",
    background:
      theme.mode === "light"
        ? `linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 60%), ${theme.palette.barraSuperior}`
        : `linear-gradient(180deg, rgba(139,123,255,0.16) 0%, rgba(34,211,238,0) 60%), ${theme.palette.barraSuperior}`,
    gap: theme.spacing(1),
    overflow: "visible",
    minHeight: 56,
    borderBottom: "1px solid rgba(0, 0, 0, 0.1)",
    boxShadow: "0 2px 14px -2px rgba(15, 23, 42, 0.3)",
    [theme.breakpoints.down("sm")]: {
      paddingRight: theme.spacing(1),
      paddingLeft: theme.spacing(0.75),
      minHeight: 50,
      gap: theme.spacing(0.5),
      display: "flex",
      alignItems: "center",
      flexWrap: "nowrap",
    },
  },

  // SCROLLER HORIZONTAL (ícones)
  topbarScroller: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.75),
    flex: "1 1 0%",
    minWidth: 0,
    maxWidth: "100%",
    flexWrap: "nowrap",

    // DESKTOP: alinhar à direita
    justifyContent: "flex-end",
    overflowX: "visible",

    // cada filho não encolhe => gera overflow quando somar mais que a largura
    "& > *": { flex: "0 0 auto" },

    // MOBILE: alinhar à esquerda + scroll horizontal invisível
    [theme.breakpoints.down("sm")]: {
      justifyContent: "flex-start",
      overflowX: "auto",
      overflowY: "hidden",
      WebkitOverflowScrolling: "touch",
      touchAction: "pan-x",
      overscrollBehaviorX: "contain",
      msOverflowStyle: "none",
      scrollbarWidth: "none",
      "&::-webkit-scrollbar": { display: "none" },
    },
  },
  topbarGreetingCard: {
    display: "flex",
    alignItems: "center",
    minHeight: 34,
    padding: "5px 14px",
    borderRadius: 9,
    background: "rgba(255, 255, 255, 0.12)",
    border: "1px solid rgba(255, 255, 255, 0.16)",
    backdropFilter: "blur(10px)",
    [theme.breakpoints.down("sm")]: { display: "none" },
  },
  topbarGreetingText: {
    fontSize: 12.5,
    fontWeight: 500,
    color: "rgba(255, 255, 255, 0.85)",
    letterSpacing: "0.012em",
    whiteSpace: "nowrap",
    lineHeight: 1.4,
    "& b": {
      color: "#ffffff",
      fontWeight: 700,
    },
  },
  topbarActionsCard: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    padding: "3px 5px",
    borderRadius: 11,
    background: "rgba(255, 255, 255, 0.1)",
    border: "1px solid rgba(255, 255, 255, 0.14)",
    backdropFilter: "blur(10px)",
  },
  topbarActionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    minWidth: "auto",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background-color 0.15s ease, color 0.15s ease, transform 0.12s ease",
    background: "transparent",
    color: "rgba(255, 255, 255, 0.82)",
    padding: 5,
    "&:hover": {
      background: "rgba(255, 255, 255, 0.18)",
      color: "#ffffff",
      transform: "translateY(-1px)",
    },
    "&:active": {
      transform: "translateY(0)",
    },
    "& .MuiSvgIcon-root": {
      fontSize: "1.1rem",
    },
  },
  topbarActionWrapper: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    "& .MuiIconButton-root, & .MuiButton-root": {
      width: 32,
      height: 32,
      minWidth: "auto",
      borderRadius: 8,
      padding: 5,
      color: "rgba(255, 255, 255, 0.82)",
      background: "transparent",
      transition: "background-color 0.15s ease, color 0.15s ease, transform 0.12s ease",
      "&:hover": {
        background: "rgba(255, 255, 255, 0.18)",
        color: "#ffffff",
        transform: "translateY(-1px)",
      },
      "&:active": {
        transform: "translateY(0)",
      },
    },
  },

  toolbarIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundSize: "cover",
    padding: "0 10px 0 16px",
    minHeight: 56,
    borderBottom:
      theme.mode === "light"
        ? "1px solid rgba(15, 23, 42, 0.05)"
        : "1px solid rgba(148,163,184,0.08)",
    [theme.breakpoints.down("sm")]: { minHeight: 50 },
  },
  collapseButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    color: theme.mode === "light" ? "#94a3b8" : "#7d8aa0",
    transition: "background-color 0.15s ease, color 0.15s ease",
    "&:hover": {
      backgroundColor:
        theme.mode === "light"
          ? "rgba(15, 23, 42, 0.05)"
          : "rgba(248, 250, 252, 0.08)",
      color: theme.mode === "light" ? "#1e293b" : "#f1f5f9",
    },
    "& .MuiSvgIcon-root": { fontSize: "1.15rem" },
  },

  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    [theme.breakpoints.down("sm")]: {
      // Some espaço pro cabeçalho do sistema quando o teclado abre sobre o
      // chat do ticket no mobile, sobrando mais altura pra ver a conversa
      // (classe "kb-open-chat" é controlada por TicketsAdvanced/index.js).
      "body.kb-open-chat &": {
        display: "none",
      },
    },
  },
  appBarShift: {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    // no mobile, não desloca a barra ao abrir o drawer temporário
    [theme.breakpoints.down("sm")]: {
      marginLeft: 0,
      width: "100%",
    },
  },

  menuButtonHidden: { display: "none" },

  title: {
    flexGrow: 0,
    fontSize: 13,
    color: "#ffffff",
    marginLeft: theme.spacing(1),
    [theme.breakpoints.down("sm")]: { display: "none" },
  },
  menuToggleButton: {
    color: "rgba(255, 255, 255, 0.9)",
    transition: "background-color 0.15s ease, color 0.15s ease",
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.16)",
      color: "#ffffff",
    },
  },

  drawerPaper: {
    position: "relative",
    whiteSpace: "nowrap",
    width: drawerWidth,
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    overflowX: "hidden",
    overflowY: "hidden",
    backgroundColor: theme.palette.background.paper,
    boxShadow:
      theme.mode === "light"
        ? "1px 0 0 rgba(15, 23, 42, 0.06), 6px 0 24px -12px rgba(15, 23, 42, 0.12)"
        : "1px 0 0 rgba(148, 163, 184, 0.08), 6px 0 24px -12px rgba(0, 0, 0, 0.5)",
  },
  drawerPaperClose: {
    overflowX: "hidden",
    overflowY: "hidden",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    width: theme.spacing(6),
    [theme.breakpoints.up("sm")]: { width: theme.spacing(8) },
  },

  appBarSpacer: {
    minHeight: 56,
    [theme.breakpoints.down("sm")]: {
      "body.kb-open-chat &": {
        minHeight: 0,
      },
    },
  },

  content: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    position: "relative",
    ...theme.scrollbarStyles,
  },
  topAnnouncementSticky: {
    position: "sticky",
    top: 0,
    zIndex: 30,
    background: theme.palette.fancyBackground,
    paddingTop: theme.spacing(0.5),
  },

  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },

  containerWithScroll: {
    flex: 1,
    overflowY: "scroll",
    overflowX: "hidden",
    ...theme.scrollbarStyles,
    borderRadius: "8px",
    border: "2px solid transparent",
    "&::-webkit-scrollbar": { display: "none" },
    "-ms-overflow-style": "none",
    "scrollbar-width": "none",
  },

  logoImg: {
    display: "block",
    margin: 0,
    height: 34,
    maxWidth: 150,
    objectFit: "contain",
    objectPosition: "left center",
  },
  hideLogo: { display: "none" },

  avatar2: {
    width: 30,
    height: 30,
    cursor: "pointer",
    borderRadius: "50%",
    border: "1.5px solid rgba(255, 255, 255, 0.6)",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    "&:hover": {
      borderColor: "rgba(255, 255, 255, 0.95)",
      boxShadow: "0 0 0 3px rgba(255, 255, 255, 0.2)",
    },
  },

  compressIconButton: {
    [theme.breakpoints.down("sm")]: { padding: 6 },
  },
}));

const StyledBadge = withStyles((theme) => ({
  badge: {
    backgroundColor: "#44b700",
    color: "#44b700",
    boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
    "&::after": {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      borderRadius: "50%",
      animation: "$ripple 1.2s infinite ease-in-out",
      border: "1px solid currentColor",
      content: '""',
    },
  },
  "@keyframes ripple": {
    "0%": { transform: "scale(.8)", opacity: 1 },
    "100%": { transform: "scale(2.4)", opacity: 0 },
  },
}))(Badge);

const LoggedInLayout = ({ children }) => {
  const classes = useStyles();
  const [userToken, setUserToken] = useState("disabled");
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [systemVersion, setSystemVersion] = useState("-");
  const [companyName, setCompanyName] = useState("Whaticket");
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { handleLogout, loading, isAuth } = useContext(AuthContext);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVariant, setDrawerVariant] = useState("permanent");
  const { user, socket } = useContext(AuthContext);

  const theme = useTheme();
  const { colorMode } = useContext(ColorModeContext);
  const greaterThenSm = useMediaQuery(theme.breakpoints.up("sm"));
  const isTouchDevice = useMediaQuery("(pointer: coarse)");
  const useTemporaryDrawer = isTouchDevice || !greaterThenSm;

  const [volume, setVolume] = useState(() => {
    try {
      const storedVolume = localStorage.getItem("notificationVolume");
      const legacyVolume = localStorage.getItem("volume");
      const parsed = Number(storedVolume ?? legacyVolume ?? 1);
      return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 1;
    } catch (e) {
      return 1;
    }
  });
  const [notificationSound, setNotificationSound] = useState(
    () => {
      try {
        return localStorage.getItem("notificationSound") || "classic";
      } catch (e) {
        return "classic";
      }
    }
  );
  const [notificationMuted, setNotificationMuted] = useState(
    () => {
      try {
        return localStorage.getItem("notificationMuted") === "true";
      } catch (e) {
        return false;
      }
    }
  );
  const [notificationGroupMuted, setNotificationGroupMuted] = useState(
    () => {
      try {
        return localStorage.getItem("notificationGroupMuted") === "true";
      } catch (e) {
        return false;
      }
    }
  );
  const { dateToClient } = useDate();
  const [profileUrl, setProfileUrl] = useState(null);
  const [birthdayModalOpen, setBirthdayModalOpen] = useState(false);
  const [birthdayData, setBirthdayData] = useState({ users: [], contacts: [] });

  const settings = useSettings();

  useEffect(() => {
    try {
      localStorage.setItem("notificationVolume", String(volume));
      // mantém retrocompatibilidade com partes legadas que ainda leem "volume"
      localStorage.setItem("volume", String(volume));
    } catch (e) {}
  }, [volume]);

  useEffect(() => {
    try {
      localStorage.setItem("notificationSound", notificationSound);
    } catch (e) {}
  }, [notificationSound]);

  useEffect(() => {
    try {
      localStorage.setItem("notificationMuted", String(notificationMuted));
    } catch (e) {}
  }, [notificationMuted]);

  useEffect(() => {
    try {
      localStorage.setItem("notificationGroupMuted", String(notificationGroupMuted));
    } catch (e) {}
  }, [notificationGroupMuted]);

  useEffect(() => {
    if (!isAuth || !user?.id) return;
    let active = true;
    const getSetting = async () => {
      try {
        await settings.get("wtV");
        if (active) {
          setUserToken("disabled");
        }
      } catch (error) {
        // Ao deslogar, a API pode responder 401 antes do redirect para /login.
        // Não tratamos isso como erro fatal de tela.
        const isExpectedCancel =
          error?.message === "Logout in progress" ||
          error?.code === "ERR_CANCELED" ||
          error?.name === "CanceledError";
        if (error?.response?.status !== 401 && !isExpectedCancel) {
          console.error("Erro ao carregar setting wtV", error);
        }
      }
    };
    getSetting();
    return () => {
      active = false;
    };
  }, [isAuth, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (useTemporaryDrawer) {
      setDrawerVariant("temporary");
      setDrawerOpen(false);
    } else {
      setDrawerVariant("permanent");
      setDrawerOpen(user.defaultMenu !== "closed");
    }
  }, [useTemporaryDrawer, user.defaultMenu]);

  useEffect(() => {
    if (user.defaultTheme === "dark" && theme.mode === "light") {
      colorMode.toggleColorMode();
    }
  }, [colorMode, theme.mode, user.defaultTheme]);

  useEffect(() => {
    const companyId = user.companyId;
    const userId = user.id;
    if (companyId) {
      const ImageUrl = user.profileImage;
      if (ImageUrl !== undefined && ImageUrl !== null)
        setProfileUrl(`${backendUrl}/public/avatar/${ImageUrl}`);
      else setProfileUrl(`${process.env.FRONTEND_URL}/nopicture.png`);

      const onCompanyAuthLayout = (data) => {
        if (data.user.id === +userId) {
          toastError("Sua conta foi acessada em outro computador.");
          setTimeout(() => {
            try {
              localStorage.clear();
            } catch (e) {
              console.warn("localStorage.clear failed:", e);
            }
            window.location.reload();
          }, 1000);
        }
      };

      socket.on(`company-${companyId}-auth`, onCompanyAuthLayout);

      socket.emit("userStatus");
      const interval = setInterval(() => {
        socket.emit("userStatus");
      }, 1000 * 60 * 5);

      return () => {
        socket.off(`company-${companyId}-auth`, onCompanyAuthLayout);
        clearInterval(interval);
      };
    }
  }, [socket]);

  useEffect(() => {
    if (!isAuth || !user?.id || !user?.companyId) return;

    const run = async () => {
      try {
        const todayKey = new Date().toISOString().slice(0, 10);
        const seenKey = `birthday-modal-seen:${user.companyId}:${user.id}:${todayKey}`;
        if (localStorage.getItem(seenKey) === "1") return;

        const { data } = await api.get("/birthdays/today");
        const payload = data?.data || { users: [], contacts: [] };
        const userBirthday = (payload.users || []).find(u => Number(u.id) === Number(user.id));

        if (userBirthday) {
          setBirthdayData({
            users: payload.users || [],
            contacts: payload.contacts || []
          });
          setBirthdayModalOpen(true);
          localStorage.setItem(seenKey, "1");
        }
      } catch (error) {
        // não interrompe o fluxo da aplicação caso a API de aniversário falhe
      }
    };

    const timer = setTimeout(run, 900);
    return () => clearTimeout(timer);
  }, [isAuth, user?.id, user?.companyId]);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
    setMenuOpen(true);
  };
  const handleCloseMenu = () => {
    setAnchorEl(null);
    setMenuOpen(false);
  };
  const handleOpenUserModal = () => {
    setUserModalOpen(true);
    handleCloseMenu();
  };
  const handleOpenAboutModal = async () => {
    handleCloseMenu();
    setAboutModalOpen(true);

    try {
      const [{ data: versionData }, publicAppName] = await Promise.all([
        api.get("/version"),
        settings.getPublicSetting("appName"),
      ]);

      setSystemVersion(versionData?.version || "-");
      setCompanyName(String(publicAppName || "").trim() || "Whaticket");
    } catch (error) {
      // O modal continua disponível mesmo se uma das informações não puder ser carregada.
      console.error("Erro ao carregar informações sobre o sistema:", error);
    }
  };
  const handleClickLogout = () => {
    handleCloseMenu();
    handleLogout();
  };
  const handleRefreshPage = () => window.location.reload(false);

  if (loading) return <BackdropLoading />;

  // src da logo com fallback ao tema
  const logoSrc =
    theme.mode === "light"
      ? (typeof theme.calculatedLogoLight === "function"
          ? theme.calculatedLogoLight()
          : logo)
      : (typeof theme.calculatedLogoDark === "function"
          ? theme.calculatedLogoDark()
          : logoDark);

  return (
    <div className={classes.root}>
      <Drawer
        variant={drawerVariant}
        className={drawerOpen ? classes.drawerPaper : classes.drawerPaperClose}
        classes={{
          paper: clsx(classes.drawerPaper, !drawerOpen && classes.drawerPaperClose),
        }}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <div className={classes.toolbarIcon}>
          {/* Logo visível no Drawer */}
          <img
            src={logoSrc}
            alt="logo"
            className={drawerOpen ? classes.logoImg : classes.hideLogo}
          />
          {drawerOpen && (
            <IconButton
              className={classes.collapseButton}
              onClick={() => setDrawerOpen(!drawerOpen)}
            >
              <ChevronLeftIcon />
            </IconButton>
          )}
        </div>
        <List className={classes.containerWithScroll}>
          <MainListItems
            collapsed={!drawerOpen}
            drawerClose={useTemporaryDrawer ? () => setDrawerOpen(false) : undefined}
          />
        </List>
        <Divider />
      </Drawer>

      <AppBar
        position="fixed"
        className={clsx(classes.appBar, drawerOpen && classes.appBarShift)}
        color="inherit"
      >
        <Toolbar variant="dense" className={classes.toolbar}>
          {/* Esquerda: botão do menu */}
          <IconButton
            edge="start"
            aria-label="open drawer"
            style={{ flexShrink: 0 }}
            className={clsx(
              classes.menuToggleButton,
              drawerOpen && classes.menuButtonHidden
            )}
            onClick={() => setDrawerOpen(!drawerOpen)}
          >
            <MenuIcon />
          </IconButton>

          {/* Título (desktop apenas) */}
          <div className={classes.title}>
            <div className={classes.topbarGreetingCard}>
              <span className={classes.topbarGreetingText}>
                {greaterThenSm && user?.profile === "admin" && user?.company?.dueDate ? (
                  <>
                    {i18n.t("mainDrawer.appBar.user.message")} <b>{user.name}</b>,{" "}
                    {i18n.t("mainDrawer.appBar.user.messageEnd")} <b>{user?.company?.name}</b>! (
                    {i18n.t("mainDrawer.appBar.user.active")} {dateToClient(user?.company?.dueDate)})
                  </>
                ) : (
                  <>
                    {i18n.t("mainDrawer.appBar.user.message")} <b>{user.name}</b>,{" "}
                    {i18n.t("mainDrawer.appBar.user.messageEnd")} <b>{user?.company?.name}</b>!
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Direita: Ícones no scroller */}
          <div className={classes.topbarScroller}>
            <div className={classes.topbarActionsCard}>
              {userToken === "enabled" && user?.companyId === 1 && (
                <Chip className={classes.chip} label={i18n.t("mainDrawer.appBar.user.token")} />
              )}

              <div className={classes.topbarActionWrapper}>
                <VersionControl />
              </div>
              <div className={classes.topbarActionWrapper}>
                <UserLanguageSelector />
              </div>

              <IconButton
                onClick={colorMode.toggleColorMode}
                className={classes.topbarActionButton}
              >
                  {theme.mode === "dark" ? (
                    <Brightness7Icon />
                  ) : (
                    <Brightness4Icon />
                  )}
              </IconButton>

              <div className={classes.topbarActionWrapper}>
                <NotificationsVolume
                  setVolume={setVolume}
                  volume={volume}
                  notificationSound={notificationSound}
                  setNotificationSound={setNotificationSound}
                  notificationMuted={notificationMuted}
                  setNotificationMuted={setNotificationMuted}
                  notificationGroupMuted={notificationGroupMuted}
                  setNotificationGroupMuted={setNotificationGroupMuted}
                />
              </div>

              <IconButton
                onClick={handleRefreshPage}
                aria-label={i18n.t("mainDrawer.appBar.refresh")}
                color="inherit"
                className={classes.topbarActionButton}
              >
                <CachedIcon />
              </IconButton>

              {user.id && (
                <div className={classes.topbarActionWrapper}>
                  <NotificationsPopOver
                    volume={volume}
                    notificationSound={notificationSound}
                    notificationMuted={notificationMuted}
                    notificationGroupMuted={notificationGroupMuted}
                  />
                </div>
              )}

              <div className={classes.topbarActionWrapper}>
                <AnnouncementsPopover />
              </div>
              <div className={classes.topbarActionWrapper}>
                <ChatPopover />
              </div>

              <div className={classes.topbarActionWrapper}>
                <StyledBadge
                  overlap="circular"
                  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                  variant="dot"
                  onClick={handleMenu}
                >
                  <Avatar alt="Multi100" className={classes.avatar2} src={profileUrl} />
                </StyledBadge>
              </div>
            </div>

            {/* Menu do usuário */}
            <UserModal
              open={userModalOpen}
              onClose={() => setUserModalOpen(false)}
              onImageUpdate={(newProfileUrl) => setProfileUrl(newProfileUrl)}
              userId={user?.id}
            />
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              getContentAnchorEl={null}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              open={menuOpen}
              onClose={handleCloseMenu}
            >
              <MenuItem onClick={handleOpenUserModal}>{i18n.t("mainDrawer.appBar.user.profile")}</MenuItem>
              <MenuItem onClick={handleOpenAboutModal}>{i18n.t("mainDrawer.appBar.user.about")}</MenuItem>
              <MenuItem onClick={handleClickLogout}>{i18n.t("mainDrawer.appBar.user.logout")}</MenuItem>
            </Menu>

            <Dialog
              open={aboutModalOpen}
              onClose={() => setAboutModalOpen(false)}
              maxWidth="xs"
              fullWidth
            >
              <DialogTitle>{i18n.t("mainDrawer.appBar.about.title")}</DialogTitle>
              <DialogContent dividers>
                <Typography variant="body1" gutterBottom>
                  <strong>{i18n.t("mainDrawer.appBar.about.company")}:</strong> {companyName}
                </Typography>
                <Typography variant="body1">
                  <strong>{i18n.t("mainDrawer.appBar.about.version")}:</strong> {systemVersion}
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setAboutModalOpen(false)} color="primary">
                  {i18n.t("mainDrawer.appBar.about.close")}
                </Button>
              </DialogActions>
            </Dialog>

            <Dialog
              open={birthdayModalOpen}
              onClose={() => setBirthdayModalOpen(false)}
              maxWidth="sm"
              fullWidth
            >
              <DialogTitle>Parabéns, {user?.name}! 🎂</DialogTitle>
              <DialogContent dividers>
                <p style={{ marginTop: 0 }}>
                  Hoje é o seu aniversário. Desejamos um excelente dia para você.
                </p>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() => setBirthdayModalOpen(false)}
                  color="primary"
                  variant="contained"
                >
                  Fechar
                </Button>
              </DialogActions>
            </Dialog>
          </div>
        </Toolbar>
      </AppBar>

      <main className={classes.content}>
        <div className={classes.appBarSpacer} />
        <div className={classes.topAnnouncementSticky}>
          <TopAnnouncementBanner />
        </div>
        {children ? children : null}
      </main>
    </div>
  );
};

export default LoggedInLayout;
