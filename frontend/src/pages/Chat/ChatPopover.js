import React, {
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { makeStyles } from "@material-ui/core/styles";
import toastError from "../../errors/toastError";
import Popover from "@material-ui/core/Popover";
import ForumIcon from "@material-ui/icons/Forum";
import {
  Badge,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
} from "@material-ui/core";
import api from "../../services/api";
import { isArray } from "lodash";
// import { SocketContext } from "../../context/Socket/SocketContext";
import { useDate } from "../../hooks/useDate";
import { AuthContext } from "../../context/Auth/AuthContext";

import notifySound from "../../assets/chat_notify.mp3";
import { i18n } from "../../translate/i18n";

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
    width: "calc(100% - 12px)",
    transition: "background 0.12s ease",
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
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_CHATS") {
    const chats = action.payload;
    const newChats = [];
    const updatedState = [...state];

    if (isArray(chats)) {
      chats.forEach((chat) => {
        const chatIndex = updatedState.findIndex((u) => u.id === chat.id);
        if (chatIndex !== -1) {
          updatedState[chatIndex] = chat;
        } else {
          newChats.push(chat);
        }
      });
    }

    return [...updatedState, ...newChats];
  }

  if (action.type === "UPDATE_CHATS") {
    const chat = action.payload;
    const chatIndex = state.findIndex((u) => u.id === chat.id);

    if (chatIndex !== -1) {
      const updated = [...state];
      updated[chatIndex] = chat;
      return updated;
    }
    return [chat, ...state];
  }

  if (action.type === "DELETE_CHAT") {
    const chatId = action.payload;
    return state.filter((u) => u.id !== chatId);
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

const getNotificationApi = () => {
  if (typeof window === "undefined") return undefined;
  return window.Notification;
};

const getNotificationPermission = () => {
  const NotificationApi = getNotificationApi();
  return NotificationApi?.permission || "unsupported";
};

export default function ChatPopover() {
  const classes = useStyles();

//   const socketManager = useContext(SocketContext);
  const { user, socket, isAuth } = useContext(AuthContext);


  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchParam] = useState("");
  const [chats, dispatch] = useReducer(reducer, []);
  const [invisible, setInvisible] = useState(true);
  const { datetimeToClient } = useDate();
  const audioRef = useRef(null);
  const soundAlertRef = useRef();
  const isMountedRef = useRef(true);

  const requestNotificationPermissionSafe = () => {
    const NotificationApi = getNotificationApi();
    if (!NotificationApi) return Promise.resolve("default");

    return new Promise((resolve) => {
      let resolved = false;
      const finalize = (permission) => {
        if (resolved) return;
        resolved = true;
        resolve(permission || NotificationApi.permission || "default");
      };

      try {
        const maybePromise = NotificationApi.requestPermission((permission) => finalize(permission));
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise
            .then((permission) => finalize(permission))
            .catch(() => finalize(NotificationApi.permission));
        } else {
          setTimeout(() => finalize(NotificationApi.permission), 600);
        }
      } catch (_) {
        finalize(NotificationApi.permission);
      }
    });
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    soundAlertRef.current = () => {
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio(notifySound);
        }
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      } catch (_) {}
    };

    const permission = getNotificationPermission();
    if (permission === "unsupported") {
      console.log("This browser doesn't support notifications");
    } else if (permission === "default") {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || "");
      const isStandalone = window.navigator.standalone === true;
      if (!(isIOS && isStandalone)) {
        requestNotificationPermissionSafe();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAuth) return;
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam, isAuth]);

  useEffect(() => {
    if (!isAuth || !user?.companyId) return;
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      fetchChats();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, pageNumber, isAuth, user?.companyId]);

  useEffect(() => {
    if (user.companyId && isAuth) {

      const companyId = user.companyId;
//    const socket = socketManager.GetSocket();

      const onCompanyChatPopover = (data) => {
        if (data?.chat?.id && !isUserInChat(data.chat, user.id)) {
          return;
        }
        if (data.action === "new-message") {
          dispatch({ type: "CHANGE_CHAT", payload: data });
          if (data.newMessage.senderId !== user.id) {
            soundAlertRef.current?.();
          }
        }
        if (data.action === "update") {
          dispatch({ type: "CHANGE_CHAT", payload: data });
        }
      }

      socket.on(`company-${companyId}-chat`, onCompanyChatPopover);

      return () => {
        socket.off(`company-${companyId}-chat`, onCompanyChatPopover);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuth]);


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

  const fetchChats = async () => {
    if (!isAuth || !user?.companyId) return;
    try {
      const { data } = await api.get("/chats/", {
        params: { searchParam, pageNumber },
      });
      if (isMountedRef.current) {
        dispatch({ type: "LOAD_CHATS", payload: data.records });
        setHasMore(data.hasMore);
        setLoading(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        toastError(err);
        setLoading(false);
      }
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
    if (getNotificationPermission() === "default") {
      requestNotificationPermissionSafe();
    }
    setAnchorEl(event.currentTarget);
    setInvisible(true);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const goToMessages = (chat) => {
    window.location.href = `/chats/${chat.uuid}`;
  };

  const open = Boolean(anchorEl);
  const id = open ? "simple-popover" : undefined;

  return (
    <div>
      <IconButton
        aria-describedby={id}
        variant="contained"
        color={invisible ? "default" : "inherit"}
        onClick={handleClick}
        style={{ color: "white" }}
      >
        <Badge
          color="secondary"
          variant="dot"
          overlap="rectangular"
          invisible={invisible}
        >
          <ForumIcon />
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
            {isArray(chats) &&
              chats.map((item, key) => (
                <ListItem
                  key={key}
                  className={classes.listItem}
                  onClick={() => goToMessages(item)}
                  button
                >
                  <ListItemText
                    primary={item.lastMessage}
                    secondary={
                      <>
                        <Typography component="span" style={{ fontSize: 11.5, opacity: 0.6 }}>
                          {datetimeToClient(item.updatedAt)}
                        </Typography>
                        <span style={{ marginTop: 4, display: "block" }}></span>
                      </>
                    }
                  />
                </ListItem>
              ))}
            {isArray(chats) && chats.length === 0 && (
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
