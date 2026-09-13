import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useHistory } from "react-router-dom";
import { Grid, Tabs, Tab, makeStyles, Paper, CircularProgress, Box, Badge, Dialog } from "@material-ui/core";
import withWidth, { isWidthUp } from "@material-ui/core/withWidth";
import { has, isObject } from "lodash";

import ChatList from "./ChatList";
import ChatGroupList from "./ChatGroupList";
import ChatGroupForm from "./ChatGroupForm";
import ChatMessages from "./ChatMessages";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    padding: theme.spacing(1.5),
    height: "calc(100% - 48px)",
    overflowY: "hidden",
    background:
      theme.palette.type === "dark"
        ? "linear-gradient(180deg, #0a1220 0%, #101a2e 100%)"
        : "linear-gradient(180deg, #f7fbff 0%, #eef4ff 100%)",
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(0.8),
    },
  },
  contentShell: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    boxShadow:
      theme.palette.type === "dark"
        ? "0 16px 34px rgba(0, 0, 0, 0.38)"
        : "0 12px 26px rgba(17, 24, 39, 0.09)",
  },
  gridContainer: {
    display: "flex",
    flex: 1,
    height: "100%",
    background: theme.palette.background.paper,
    minHeight: 0,
  },
  gridItem: {
    height: "100%",
    minHeight: 0,
  },
  leftPanel: {
    display: "flex",
    flexDirection: "column",
    borderRight: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(15, 23, 42, 0.45)"
        : "rgba(248, 250, 255, 0.95)",
    minHeight: 0,
    [theme.breakpoints.up("md")]: {
      maxWidth: 360,
      flexBasis: 360,
    },
  },
  rightPanel: {
    display: "flex",
    flexDirection: "column",
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255, 255, 255, 0.01)"
        : "rgba(250, 252, 255, 0.95)",
    minHeight: 0,
    [theme.breakpoints.up("md")]: {
      flexBasis: "calc(100% - 360px)",
      maxWidth: "calc(100% - 360px)",
    },
  },
  leftPanelBody: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  gridItemTab: {
    height: "100%",
    width: "100%",
    minHeight: 0,
  },
  tabsRoot: {
    minHeight: 40,
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.02)"
        : "rgba(15, 23, 42, 0.015)",
    "& .MuiTabs-indicator": {
      height: 3,
      borderRadius: 3,
    },
    "& .MuiTab-root": {
      minHeight: 40,
      fontSize: "0.78rem",
      fontWeight: 600,
      textTransform: "none",
      minWidth: 0,
      flex: 1,
      maxWidth: "none",
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    },
  },
  loadingContainer: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
}));

const getOtherUserFromChat = (chat, currentUserId) => {
  if (!Array.isArray(chat?.users)) return null;
  const relation = chat.users.find((item) => Number(item.userId) !== Number(currentUserId));
  return relation?.user || null;
};

const isDirectChat = (chat) => {
  if (chat?.isGroup) return false;
  const members = Array.isArray(chat?.users) ? chat.users.map((u) => Number(u.userId)) : [];
  const unique = Array.from(new Set(members.filter(Boolean)));
  return unique.length === 2;
};

const isGroupChat = (chat) => Boolean(chat?.isGroup);

const isUserInChat = (chat, userId) => {
  const members = Array.isArray(chat?.users) ? chat.users : [];
  return members.some((member) => Number(member?.userId) === Number(userId));
};

const buildMessageKey = (message) => {
  if (message?.id) return `id:${message.id}`;
  const createdAt = String(message?.createdAt || "");
  const senderId = String(message?.senderId || "");
  const body = String(message?.message || "");
  return `fallback:${senderId}:${createdAt}:${body}`;
};

const mergeMessagesUnique = (current = [], incoming = []) => {
  const map = new Map();
  [...current, ...incoming].forEach((msg) => {
    if (!msg) return;
    map.set(buildMessageKey(msg), msg);
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
};

function Chat(props) {
  const classes = useStyles();
  const { user, socket } = useContext(AuthContext);
  const history = useHistory();
  const { id: chatUuidParam } = useParams();
  const scrollToBottomRef = useRef();
  const isMounted = useRef(true);
  const markReadInFlightRef = useRef(false);

  const [users, setUsers] = useState([]);
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState({});
  const [currentTargetUser, setCurrentTargetUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesPageInfo, setMessagesPageInfo] = useState({ hasMore: false });
  const [messagesPage, setMessagesPage] = useState(1);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState(false);
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [desktopTab, setDesktopTab] = useState(0);
  const [mobileTab, setMobileTab] = useState(0);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const chatByUserId = useMemo(() => {
    const map = {};
    for (const chat of chats) {
      if (!isDirectChat(chat)) continue;
      const targetUser = getOtherUserFromChat(chat, user.id);
      if (!targetUser?.id) continue;
      map[Number(targetUser.id)] = chat;
    }
    return map;
  }, [chats, user.id]);

  const groupChats = useMemo(
    () => chats.filter((chat) => isGroupChat(chat) && isUserInChat(chat, user.id)),
    [chats, user.id]
  );

  const unreadGroupCount = useMemo(
    () =>
      groupChats.reduce((total, chat) => {
        const currentMember = Array.isArray(chat?.users)
          ? chat.users.find((member) => Number(member.userId) === Number(user.id))
          : null;
        return total + (Number(currentMember?.unreads || 0) > 0 ? 1 : 0);
      }, 0),
    [groupChats, user.id]
  );

  const canManageCurrentGroup = Boolean(
    currentChat?.isGroup && Number(currentChat?.ownerId) === Number(user.id)
  );

  const upsertChat = (chatPayload) => {
    if (!chatPayload?.id) return;
    setChats((prev) => {
      const idx = prev.findIndex((c) => Number(c.id) === Number(chatPayload.id));
      if (idx === -1) return [chatPayload, ...prev];
      const copy = [...prev];
      copy.splice(idx, 1);
      return [chatPayload, ...copy];
    });
  };

  const findMessages = async (chatId, page = 1, reset = false) => {
    setLoadingMessages(true);
    try {
      const { data } = await api.get(`/chats/${chatId}/messages?pageNumber=${page}`);
      if (!isMounted.current) return;
      setMessagesPageInfo({ hasMore: data.hasMore });
      setMessagesPage(page + 1);
      setMessages((prev) => {
        const nextBase = reset ? [] : prev;
        return mergeMessagesUnique(nextBase, data.records || []);
      });
    } catch (_) {
    } finally {
      setLoadingMessages(false);
    }
  };

  const findChats = async () => {
    setLoadingChats(true);
    try {
      const { data } = await api.get("/chats");
      if (!isMounted.current) return [];
      const records = Array.isArray(data?.records) ? data.records : [];
      setChats(records);
      return records;
    } catch (_) {
      return [];
    } finally {
      setLoadingChats(false);
    }
  };

  const findUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data } = await api.get("/users/list");
      if (!isMounted.current) return;
      const list = Array.isArray(data) ? data : [];
      setUsers(list.filter((u) => Number(u.id) !== Number(user.id)));
    } catch (_) {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const ensureDirectChat = async (targetUser) => {
    const targetId = Number(targetUser.id);
    const cached = chatByUserId?.[targetId];
    if (cached?.id) return cached;

    const refreshed = await findChats();
    const existing = (Array.isArray(refreshed) ? refreshed : []).find((chat) => {
      if (!isDirectChat(chat)) return false;
      const members = Array.isArray(chat?.users) ? chat.users.map((u) => Number(u.userId)) : [];
      return members.includes(Number(user.id)) && members.includes(targetId);
    });
    if (existing?.id) return existing;

    const { data } = await api.post("/chats", {
      title: targetUser.name,
      isGroup: false,
      users: [{ id: targetUser.id, name: targetUser.name }],
    });
    upsertChat(data);
    return data;
  };

  const selectChat = async (chat, targetUser = null) => {
    if (!chat?.id) return;
    const resolvedTargetUser = isGroupChat(chat) ? null : (targetUser || getOtherUserFromChat(chat, user.id));
    setCurrentChat(chat);
    setCurrentTargetUser(resolvedTargetUser);
    setMessages([]);
    setMessagesPage(1);
    setMessagesPageInfo({ hasMore: false });
    setMobileTab(3);
    if (chat.uuid) {
      history.push(`/chats/${chat.uuid}`);
    }
    await findMessages(chat.id, 1, true);
    setTimeout(() => {
      if (typeof scrollToBottomRef.current === "function") {
        scrollToBottomRef.current();
      }
    }, 260);
  };

  const selectUser = async (targetUser) => {
    if (!targetUser?.id) return;
    const chat = await ensureDirectChat(targetUser);
    await selectChat(chat, targetUser);
  };

  const selectGroup = async (chat) => {
    if (!chat?.id) return;
    await selectChat(chat, null);
  };

  const createGroup = async ({ title, users: selectedUsers }) => {
    setCreatingGroup(true);
    try {
      const payload = {
        title,
        isGroup: true,
        users: selectedUsers.map((member) => ({ id: member.id, name: member.name })),
      };
      const { data } = await api.post("/chats", payload);
      upsertChat(data);
      setDesktopTab(1);
      await selectChat(data, null);
    } catch (err) {
      toastError(err);
    } finally {
      setCreatingGroup(false);
    }
  };

  const updateGroup = async ({ title, users: selectedUsers }) => {
    if (!currentChat?.id || !canManageCurrentGroup) return;
    setEditingGroup(true);
    try {
      const { data } = await api.put(`/chats/${currentChat.id}`, {
        title,
        users: selectedUsers.map((member) => ({ id: member.id, name: member.name })),
      });
      upsertChat(data);
      setCurrentChat(data);
      setGroupEditorOpen(false);
    } catch (err) {
      toastError(err);
    } finally {
      setEditingGroup(false);
    }
  };

  const deleteCurrentGroup = async () => {
    if (!currentChat?.id || !canManageCurrentGroup) return;
    setEditingGroup(true);
    try {
      await api.delete(`/chats/${currentChat.id}`);
      setCurrentChat({});
      setCurrentTargetUser(null);
      setMessages([]);
      setMessagesPage(1);
      setMessagesPageInfo({ hasMore: false });
      setGroupEditorOpen(false);
      setDesktopTab(1);
      setMobileTab(1);
      history.push("/chats");
    } catch (err) {
      toastError(err);
    } finally {
      setEditingGroup(false);
    }
  };

  const loadMoreMessages = async () => {
    if (loadingMessages || !currentChat?.id) return;
    await findMessages(currentChat.id, messagesPage, false);
  };

  const sendMessage = async (payload) => {
    if (!currentChat?.id) return;

    if (payload?.action === "mark-read") {
      await markChatAsRead(currentChat.id);
      return;
    }

    const text = String(payload?.text || "").trim();
    const file = payload?.file || null;
    const audioBlob = payload?.audioBlob || null;

    try {
      if (file || audioBlob) {
        const formData = new FormData();
        if (text) formData.append("message", text);
        if (file) {
          formData.append("file", file);
        } else if (audioBlob) {
          const audioName = payload?.audioFileName || `audio-${Date.now()}.webm`;
          const audioFile = new File([audioBlob], audioName, {
            type: audioBlob.type || "audio/webm",
          });
          formData.append("file", audioFile);
        }
        await api.post(`/chats/${currentChat.id}/messages`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post(`/chats/${currentChat.id}/messages`, { message: text });
      }
    } catch (_) {}
  };

  const markChatAsRead = async (chatId) => {
    if (!chatId || markReadInFlightRef.current) return;
    markReadInFlightRef.current = true;
    try {
      const { data } = await api.post(`/chats/${chatId}/read`);
      if (data?.id) upsertChat(data);
    } catch (_) {
    } finally {
      markReadInFlightRef.current = false;
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      await Promise.all([findUsers(), findChats()]);
    };
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!chatUuidParam || !Array.isArray(chats) || chats.length === 0) return;
    const chat = chats.find((c) => String(c.uuid) === String(chatUuidParam));
    if (!chat?.id) return;
    if (Number(currentChat?.id) === Number(chat.id)) return;
    const targetUser = isDirectChat(chat) ? getOtherUserFromChat(chat, user.id) : null;
    selectChat(chat, targetUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatUuidParam, chats]);

  useEffect(() => {
    const companyId = user.companyId;
    if (!companyId) return undefined;

    const onChatUser = (data) => {
      if (data?.record) upsertChat(data.record);
    };

    const onCompanyChat = (data) => {
      if (data?.action === "delete") {
        setChats((prev) => prev.filter((c) => Number(c.id) !== Number(data.id)));
        if (Number(currentChat?.id) === Number(data.id)) {
          setCurrentChat({});
          setCurrentTargetUser(null);
          setMessages([]);
          setMessagesPage(1);
          setMessagesPageInfo({ hasMore: false });
          history.push("/chats");
        }
        return;
      }

      if (data?.chat?.id && !isUserInChat(data.chat, user.id)) {
        return;
      }

      if (data?.chat?.id) {
        upsertChat(data.chat);
      }

      if (
        data?.action === "new-message" &&
        Number(data?.newMessage?.chatId) === Number(currentChat?.id)
      ) {
        setMessages((prev) => mergeMessagesUnique(prev, [data.newMessage]));
        if (Number(data?.newMessage?.senderId) !== Number(user.id)) {
          void markChatAsRead(currentChat.id);
        }
        if (typeof scrollToBottomRef.current === "function") {
          setTimeout(() => scrollToBottomRef.current(), 120);
        }
      }
    };

    const onCurrentChat = (data) => {
      if (data?.chat?.id && isUserInChat(data.chat, user.id)) {
        upsertChat(data.chat);
      }
    };

    const onCompanyUser = (data) => {
      if (data?.action === "update" && data?.user?.id) {
        setUsers((prev) =>
          prev.map((item) =>
            Number(item.id) === Number(data.user.id)
              ? { ...item, ...data.user }
              : item
          )
        );
      }
      if (data?.action === "create" && data?.user?.id) {
        setUsers((prev) => {
          const exists = prev.some((item) => Number(item.id) === Number(data.user.id));
          if (exists || Number(data.user.id) === Number(user.id)) return prev;
          return [...prev, data.user];
        });
      }
      if (data?.action === "delete" && data?.userId) {
        setUsers((prev) => prev.filter((item) => Number(item.id) !== Number(data.userId)));
      }
    };

    socket.on(`company-${companyId}-chat-user-${user.id}`, onChatUser);
    socket.on(`company-${companyId}-chat`, onCompanyChat);
    socket.on(`company-${companyId}-user`, onCompanyUser);
    if (isObject(currentChat) && has(currentChat, "id")) {
      socket.on(`company-${companyId}-chat-${currentChat.id}`, onCurrentChat);
    }

    return () => {
      socket.off(`company-${companyId}-chat-user-${user.id}`, onChatUser);
      socket.off(`company-${companyId}-chat`, onCompanyChat);
      socket.off(`company-${companyId}-user`, onCompanyUser);
      if (isObject(currentChat) && has(currentChat, "id")) {
        socket.off(`company-${companyId}-chat-${currentChat.id}`, onCurrentChat);
      }
    };
  }, [socket, user, currentChat, history]);

  const renderLeftPanelContent = (tabValue) => {
    if (tabValue === 0) {
      return (
        <ChatList
          users={users}
          currentUserId={user.id}
          selectedUserId={currentTargetUser?.id}
          chatByUserId={chatByUserId}
          handleSelectUser={selectUser}
        />
      );
    }

    if (tabValue === 1) {
      return (
        <ChatGroupList
          groups={groupChats}
          currentUserId={user.id}
          selectedChatId={currentChat?.id}
          handleSelectGroup={selectGroup}
        />
      );
    }

    return (
      <ChatGroupForm
        users={users}
        loading={creatingGroup}
        onSubmit={createGroup}
      />
    );
  };

  const groupsTabLabel = (
    <Badge color="secondary" variant="dot" invisible={unreadGroupCount === 0}>
      <span>Grupos</span>
    </Badge>
  );

  const renderMessagesPanel = () => (
    isObject(currentChat) && has(currentChat, "id") ? (
      <ChatMessages
        chat={currentChat}
        targetUser={currentTargetUser}
        scrollToBottomRef={scrollToBottomRef}
        pageInfo={messagesPageInfo}
        messages={messages}
        loading={loadingMessages}
        handleSendMessage={sendMessage}
        handleLoadMore={loadMoreMessages}
        canManageGroup={canManageCurrentGroup}
        onEditGroup={() => setGroupEditorOpen(true)}
      />
    ) : (
      <Box className={classes.loadingContainer}>Selecione um usuário ou grupo para começar.</Box>
    )
  );

  const renderGrid = () => (
    <Grid className={classes.gridContainer} container>
      <Grid className={`${classes.gridItem} ${classes.leftPanel}`} md={4} item>
        <Tabs
          value={desktopTab}
          indicatorColor="primary"
          textColor="primary"
          onChange={(e, v) => setDesktopTab(v)}
          className={classes.tabsRoot}
          variant="fullWidth"
        >
          <Tab label="Usuários" />
          <Tab label={groupsTabLabel} />
          <Tab label="Novo Grupo" />
        </Tabs>
        <div className={classes.leftPanelBody}>{renderLeftPanelContent(desktopTab)}</div>
      </Grid>
      <Grid className={`${classes.gridItem} ${classes.rightPanel}`} md={8} item style={{ flexGrow: 1 }}>
        {renderMessagesPanel()}
      </Grid>
    </Grid>
  );

  const renderMobileTab = () => (
    <Grid className={classes.gridContainer} container>
      <Grid md={12} item>
        <Tabs
          value={mobileTab}
          indicatorColor="primary"
          textColor="primary"
          onChange={(e, v) => setMobileTab(v)}
          className={classes.tabsRoot}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Usuários" />
          <Tab label={groupsTabLabel} />
          <Tab label="Novo Grupo" />
          <Tab label="Mensagens" />
        </Tabs>
      </Grid>
      {mobileTab === 0 && (
        <Grid className={classes.gridItemTab} md={12} item>
          {renderLeftPanelContent(0)}
        </Grid>
      )}
      {mobileTab === 1 && (
        <Grid className={classes.gridItemTab} md={12} item>
          {renderLeftPanelContent(1)}
        </Grid>
      )}
      {mobileTab === 2 && (
        <Grid className={classes.gridItemTab} md={12} item>
          {renderLeftPanelContent(2)}
        </Grid>
      )}
      {mobileTab === 3 && (
        <Grid className={classes.gridItemTab} md={12} item>
          {renderMessagesPanel()}
        </Grid>
      )}
    </Grid>
  );

  const loadingBootstrap = loadingUsers || loadingChats;
  const editableUsers = Array.isArray(currentChat?.users)
    ? currentChat.users
        .filter((member) => Number(member.userId) !== Number(user.id))
        .map((member) => member.user)
        .filter(Boolean)
    : [];

  return (
    <div className={classes.pageRoot}>
      <Paper className={classes.contentShell}>
        {loadingBootstrap ? (
          <Box className={classes.loadingContainer}>
            <CircularProgress size={28} />
          </Box>
        ) : isWidthUp("md", props.width) ? (
          renderGrid()
        ) : (
          renderMobileTab()
        )}
      </Paper>
      <Dialog
        open={groupEditorOpen && canManageCurrentGroup}
        onClose={() => setGroupEditorOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <ChatGroupForm
          users={users}
          loading={editingGroup}
          mode="edit"
          initialTitle={currentChat?.title || ""}
          initialUsers={editableUsers}
          onSubmit={updateGroup}
          onCancel={() => setGroupEditorOpen(false)}
          onDelete={deleteCurrentGroup}
        />
      </Dialog>
    </div>
  );
}

export default withWidth()(Chat);
