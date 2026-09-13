import React, { useEffect, useReducer, useState, useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";
import toastError from "../../errors/toastError";
import Popover from "@material-ui/core/Popover";
import AnnouncementIcon from "@material-ui/icons/Announcement";

import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";

import {
  Avatar,
  Badge,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Dialog,
  Paper,
  Typography,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  DialogContentText,
} from "@material-ui/core";
import api from "../../services/api";
import { isArray } from "lodash";
import moment from "moment";
// import { SocketContext } from "../../context/Socket/SocketContext";
// === Helper inline: transforma URLs em links clicáveis (MUI v4) ===
const LinkText = ({ text = "", variant = "body1", color = "textSecondary", style }) => {
  const { useTheme } = require("@material-ui/core/styles");
  const Typography = require("@material-ui/core/Typography").default;
  const theme = useTheme();
  const PRIMARY = theme?.palette?.primary?.main || "#1976d2";
  const urlRegex = /((https?:\/\/|www\.)[^\s)]+|mailto:[^\s)]+)/gi;

  const parts = [];
  let last = 0, m;
  while ((m = urlRegex.exec(text)) !== null) {
    const [raw] = m, start = m.index;
    if (start > last) parts.push(text.slice(last, start));
    const href = raw.startsWith("www.") ? `https://${raw}` : raw;
    parts.push(
      <a key={`${start}-${href}`} href={href} target="_blank" rel="noopener noreferrer nofollow"
         style={{ color: PRIMARY, textDecoration: "underline", wordBreak: "break-word" }}>
        {raw}
      </a>
    );
    last = start + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));

  const withBreaks = [];
  parts.forEach((p, idx) => {
    const chunks = typeof p === "string" ? p.split("\n") : [p];
    chunks.forEach((c, i) => {
      withBreaks.push(c);
      if (i < chunks.length - 1) withBreaks.push(<br key={`br-${idx}-${i}`} />);
    });
  });

  return (
    <Typography variant={variant} color={color} style={{ whiteSpace: "pre-line", ...style }}>
      {withBreaks}
    </Typography>
  );
};


const useStyles = makeStyles((theme) => ({
  popoverPaper: {
    borderRadius: 12,
    overflow: "hidden",
    border:
      theme.mode === "light"
        ? "1px solid rgba(0, 0, 0, 0.08)"
        : "1px solid rgba(148, 163, 184, 0.1)",
    boxShadow:
      theme.mode === "light"
        ? "0 4px 6px -2px rgba(0,0,0,0.04), 0 16px 40px -6px rgba(0,0,0,0.12)"
        : "0 4px 8px -2px rgba(0,0,0,0.35), 0 16px 40px -6px rgba(0,0,0,0.55)",
    background:
      theme.mode === "light"
        ? "#ffffff"
        : "#1a2234",
  },
  mainPaper: {
    flex: 1,
    maxHeight: 380,
    maxWidth: 440,
    minWidth: 300,
    padding: 0,
    overflowY: "auto",
    background: "transparent",
    border: "none",
    boxShadow: "none",
    ...theme.scrollbarStyles,
  },
  listItem: {
    borderRadius: 6,
    margin: "2px 6px",
    padding: "10px 12px",
    cursor: "pointer",
    transition: "background 0.12s ease",
    width: "calc(100% - 12px)",
    "&:hover": {
      background:
        theme.mode === "light"
          ? "rgba(0, 0, 0, 0.04)"
          : "rgba(255, 255, 255, 0.05)",
    },
  },
  emptyItem: {
    padding: "20px 16px",
    color:
      theme.mode === "light"
        ? "rgba(0,0,0,0.45)"
        : "rgba(226,232,240,0.4)",
  },
  dialogPaper: {
    borderRadius: 14,
    overflow: "hidden",
    border:
      theme.mode === "light"
        ? "1px solid rgba(0, 0, 0, 0.08)"
        : "1px solid rgba(148, 163, 184, 0.1)",
    boxShadow:
      theme.mode === "light"
        ? "0 8px 16px -4px rgba(0,0,0,0.08), 0 24px 48px -8px rgba(0,0,0,0.12)"
        : "0 8px 16px -4px rgba(0,0,0,0.4), 0 24px 48px -8px rgba(0,0,0,0.55)",
  },
  dialogTitle: {
    padding: "20px 24px 10px",
    "& h2": {
      fontSize: 16,
      fontWeight: 600,
      letterSpacing: "0.01em",
    },
  },
  dialogContent: {
    padding: "8px 24px 16px",
  },
  dialogActions: {
    padding: "12px 20px 16px",
    borderTop:
      theme.mode === "light"
        ? "1px solid rgba(0,0,0,0.06)"
        : "1px solid rgba(148,163,184,0.08)",
  },
}));

function AnnouncementDialog({ announcement, open, handleClose, dialogClasses }) {
  return (
    <Dialog
      open={open}
      onClose={() => handleClose()}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      PaperProps={{ className: dialogClasses?.dialogPaper }}
    >
      <DialogTitle id="alert-dialog-title" className={dialogClasses?.dialogTitle}>
        {announcement.title}
      </DialogTitle>
      <DialogContent className={dialogClasses?.dialogContent}>
        {announcement.mediaPath && (
          <div
            style={{
              borderRadius: 8,
              overflow: "hidden",
              margin: "0 auto 20px",
              textAlign: "center",
              width: "95%",
              height: 280,
              backgroundRepeat: "no-repeat",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <img
              alt="announcement image"
              src={announcement.mediaPath}
              style={{ width: "95%", height: "100%", objectFit: "cover" }}
            />
          </div>
        )}
        <LinkText text={announcement.text || ""} />
      </DialogContent>
      <DialogActions className={dialogClasses?.dialogActions}>
        <Button onClick={() => handleClose()} color="primary" autoFocus variant="contained" disableElevation>
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const reducer = (state, action) => {
  if (action.type === "LOAD_ANNOUNCEMENTS") {
    const announcements = action.payload;
    const newAnnouncements = [];
    const updatedState = [...state];

    if (isArray(announcements)) {
      announcements.forEach((announcement) => {
        const announcementIndex = updatedState.findIndex(
          (u) => u.id === announcement.id
        );
        if (announcementIndex !== -1) {
          updatedState[announcementIndex] = announcement;
        } else {
          newAnnouncements.push(announcement);
        }
      });
    }

    return [...updatedState, ...newAnnouncements];
  }

  if (action.type === "UPDATE_ANNOUNCEMENTS") {
    const announcement = action.payload;
    const announcementIndex = state.findIndex((u) => u.id === announcement.id);

    if (announcementIndex !== -1) {
      const updated = [...state];
      updated[announcementIndex] = announcement;
      return updated;
    }
    return [announcement, ...state];
  }

  if (action.type === "DELETE_ANNOUNCEMENT") {
    const announcementId = action.payload;
    return state.filter((u) => u.id !== announcementId);
  }

  if (action.type === "RESET") {
    return [];
  }
};

export default function AnnouncementsPopover() {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchParam] = useState("");
  const [announcements, dispatch] = useReducer(reducer, []);
  const [invisible, setInvisible] = useState(false);
  const [announcement, setAnnouncement] = useState({});
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
//   const socketManager = useContext(SocketContext);
  const { user, socket, isAuth } = useContext(AuthContext);
  const isMountedRef = React.useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);


  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    if (!isAuth || !user?.companyId) return;
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      fetchAnnouncements();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, pageNumber, isAuth, user?.companyId]);

  useEffect(() => {
    if (isAuth && user.companyId) {
      const companyId = user.companyId;
//    const socket = socketManager.GetSocket();

      const onCompanyAnnouncement = (data) => {
        if (data.action === "update" || data.action === "create") {
          dispatch({ type: "UPDATE_ANNOUNCEMENTS", payload: data.record });
          setInvisible(false);
        }
        if (data.action === "delete") {
          dispatch({ type: "DELETE_ANNOUNCEMENT", payload: +data.id });
        }
      };
      socket.on(`company-announcement`, onCompanyAnnouncement);

      return () => {
        socket.off(`company-announcement`, onCompanyAnnouncement);
      };
    }
  }, [user, isAuth]);

  const fetchAnnouncements = async () => {
    if (!isAuth || !user?.companyId) return;
    try {
      const { data } = await api.get("/announcements/", {
        params: { searchParam, pageNumber, displayMode: "popover" },
      });
      if (!isMountedRef.current) return;
      dispatch({ type: "LOAD_ANNOUNCEMENTS", payload: data.records });
      setHasMore(data.hasMore);
      setLoading(false);
    } catch (err) {
      if (!isMountedRef.current) return;
      const isExpectedCancel =
        err?.message === "Logout in progress" ||
        err?.code === "ERR_CANCELED" ||
        err?.name === "CanceledError";
      if (err?.response?.status !== 401 && !isExpectedCancel) {
        toastError(err);
      }
      setLoading(false);
    }
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

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    setInvisible(true);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const borderPriority = (priority) => {
    if (priority === 1) {
      return "4px solid #b81111";
    }
    if (priority === 2) {
      return "4px solid orange";
    }
    if (priority === 3) {
      return "4px solid grey";
    }
  };


  const handleShowAnnouncementDialog = (record) => {
    setAnnouncement(record);
    setShowAnnouncementDialog(true);
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? "simple-popover" : undefined;

  return (
    <div>
      <AnnouncementDialog
        announcement={announcement}
        open={showAnnouncementDialog}
        handleClose={() => setShowAnnouncementDialog(false)}
        dialogClasses={classes}
      />
      <IconButton
        variant="contained"
        aria-describedby={id}
        onClick={handleClick}
        style={{ color: "white" }}
      >
        <Badge
          color="secondary"
          variant="dot"
          overlap="rectangular"
          invisible={invisible || announcements.length < 1}
        >
          <AnnouncementIcon />
        </Badge>
      </IconButton>
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        classes={{ paper: classes.popoverPaper }}
      >
        <Paper
          onScroll={handleScroll}
          className={classes.mainPaper}
          elevation={0}
        >
          <List
            component="nav"
            aria-label="main mailbox folders"
            style={{ padding: "6px 0" }}
          >
            {isArray(announcements) &&
              announcements.map((item, key) => (
                <ListItem
                  key={key}
                  className={classes.listItem}
                  style={{ borderLeft: borderPriority(item.priority) }}
                  onClick={() => handleShowAnnouncementDialog(item)}
                >
                  {item.mediaPath && (
                    <ListItemAvatar>
                      <Avatar src={item.mediaPath} />
                    </ListItemAvatar>
                  )}
                  <ListItemText
                    primary={item.title}
                    secondary={
                      <>
                        <Typography component="span" style={{ fontSize: 11.5, opacity: 0.6 }}>
                          {moment(item.createdAt).format("DD/MM/YYYY")}
                        </Typography>
                        <span style={{ marginTop: 4, display: "block" }}></span>
                        <LinkText text={item.text || ""} variant="body2" />
                      </>
                    }
                  />
                </ListItem>
              ))}
            {isArray(announcements) && announcements.length === 0 && (
              <ListItem className={classes.emptyItem}>
                <ListItemText primary={i18n.t("mainDrawer.appBar.notRegister")} />
              </ListItem>
            )}
          </List>
        </Paper>
      </Popover>
    </div>
  );
}
