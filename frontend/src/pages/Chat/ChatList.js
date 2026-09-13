import React from "react";
import {
  Avatar,
  Box,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
  makeStyles,
} from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    height: "100%",
    overflow: "hidden",
    borderRadius: 0,
    minHeight: 0,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(15, 23, 42, 0.45)"
        : "rgba(248, 250, 255, 0.95)",
  },
  sectionHeader: {
    padding: theme.spacing(1.2, 1.4, 1),
    borderBottom: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? "rgba(15, 23, 42, 0.78)"
        : "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(244,248,255,0.92) 100%)",
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: "0.88rem",
    color: theme.palette.text.primary,
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
  },
  chatList: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    ...theme.scrollbarStyles,
    padding: theme.spacing(0.8),
  },
  listItem: {
    cursor: "pointer",
    borderRadius: 12,
    marginBottom: 6,
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(148, 163, 184, 0.2)"
        : "rgba(203, 213, 225, 0.7)"
    }`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(15, 23, 42, 0.35)"
        : "rgba(255,255,255,0.9)",
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(51, 65, 85, 0.45)"
          : "rgba(219, 234, 254, 0.38)",
    },
  },
  userMetaRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  presenceDot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    display: "inline-block",
    border: "1px solid rgba(255,255,255,0.6)",
    boxShadow: "0 0 0 2px rgba(15,23,42,0.08)",
  },
  presenceOnline: {
    backgroundColor: "#22c55e",
  },
  presenceOffline: {
    backgroundColor: "#94a3b8",
  },
  presenceText: {
    fontSize: "0.72rem",
  },
  listItemActive: {
    cursor: "pointer",
    borderRadius: 12,
    marginBottom: 6,
    border: `1px solid ${
      theme.palette.type === "dark" ? "rgba(96, 165, 250, 0.4)" : "rgba(59, 130, 246, 0.35)"
    }`,
    background:
      theme.palette.type === "dark"
        ? "linear-gradient(135deg, rgba(30,58,138,0.3) 0%, rgba(37,99,235,0.25) 100%)"
        : "linear-gradient(135deg, rgba(219,234,254,0.75) 0%, rgba(191,219,254,0.45) 100%)",
    boxShadow:
      theme.palette.type === "dark"
        ? "0 8px 18px rgba(2, 6, 23, 0.42)"
        : "0 8px 18px rgba(30, 64, 175, 0.14)",
  },
  avatar: {
    width: 34,
    height: 34,
    fontSize: "0.84rem",
    fontWeight: 700,
    backgroundColor: theme.palette.type === "dark" ? "#1d4ed8" : "#2563eb",
  },
  unreadChip: {
    marginLeft: 6,
    height: 20,
    minWidth: 20,
    fontWeight: 700,
    fontSize: "0.72rem",
  },
  emptyState: {
    padding: theme.spacing(2),
    textAlign: "center",
    color: theme.palette.text.secondary,
    fontSize: "0.82rem",
  },
}));

const getInitials = (name) => {
  const safe = String(name || "").trim();
  if (!safe) return "?";
  const parts = safe.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export default function ChatList({
  users,
  currentUserId,
  selectedUserId,
  chatByUserId,
  handleSelectUser,
}) {
  const classes = useStyles();

  return (
    <div className={classes.mainContainer}>
      <div className={classes.sectionHeader}>
        <Typography className={classes.sectionTitle}>Usuários</Typography>
        <Typography className={classes.sectionSubtitle}>
          {Array.isArray(users) ? `${users.length} usuários disponíveis` : "Carregando usuários..."}
        </Typography>
      </div>
      <div className={classes.chatList}>
        <List disablePadding>
          {Array.isArray(users) &&
            users.map((chatUser) => {
              const userId = Number(chatUser.id);
              const existingChat = chatByUserId?.[userId];
              const chatMembership = Array.isArray(existingChat?.users)
                ? existingChat.users.find((u) => Number(u.userId) === Number(currentUserId))
                : null;
              const unreadCount = Number(chatMembership?.unreads || 0);
              const isActive = Number(selectedUserId) === userId;
              const isOnline = Boolean(chatUser.online);

              return (
                <ListItem
                  key={userId}
                  onClick={() => handleSelectUser(chatUser)}
                  className={isActive ? classes.listItemActive : classes.listItem}
                  button
                >
                  <ListItemAvatar>
                    <Avatar className={classes.avatar}>{getInitials(chatUser.name)}</Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <>
                        {chatUser.name}
                        {unreadCount > 0 && (
                          <Chip
                            size="small"
                            className={classes.unreadChip}
                            label={unreadCount}
                            color="secondary"
                          />
                        )}
                      </>
                    }
                    secondary={
                      <div className={classes.userMetaRow}>
                        <span
                          className={`${classes.presenceDot} ${
                            isOnline ? classes.presenceOnline : classes.presenceOffline
                          }`}
                        />
                        <Typography
                          component="span"
                          className={classes.presenceText}
                          color="textSecondary"
                        >
                          {isOnline ? "Online" : "Offline"}
                        </Typography>
                        <Typography
                          component="span"
                          style={{
                            fontSize: "0.74rem",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: 170,
                            display: "inline-block",
                          }}
                          color="textSecondary"
                        >
                          {existingChat?.lastMessage ? `• ${existingChat.lastMessage}` : ""}
                        </Typography>
                      </div>
                    }
                    primaryTypographyProps={{ noWrap: true, style: { fontWeight: 600 } }}
                    secondaryTypographyProps={{ component: "div" }}
                  />
                </ListItem>
              );
            })}
          {(!Array.isArray(users) || users.length === 0) && (
            <Box className={classes.emptyState}>Nenhum usuário interno encontrado.</Box>
          )}
        </List>
      </div>
    </div>
  );
}
