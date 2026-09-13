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
import GroupIcon from "@material-ui/icons/Group";

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
    width: 36,
    height: 36,
    backgroundColor: theme.palette.type === "dark" ? "#1e40af" : "#2563eb",
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

const getUnreadCount = (chat, currentUserId) => {
  const currentMember = Array.isArray(chat?.users)
    ? chat.users.find((item) => Number(item.userId) === Number(currentUserId))
    : null;
  return Number(currentMember?.unreads || 0);
};

const getMembersCount = (chat) => {
  const members = Array.isArray(chat?.users) ? chat.users : [];
  return members.length;
};

export default function ChatGroupList({
  groups,
  currentUserId,
  selectedChatId,
  handleSelectGroup,
}) {
  const classes = useStyles();

  return (
    <div className={classes.mainContainer}>
      <div className={classes.sectionHeader}>
        <Typography className={classes.sectionTitle}>Grupos</Typography>
        <Typography className={classes.sectionSubtitle}>
          {Array.isArray(groups) ? `${groups.length} grupos disponíveis` : "Carregando grupos..."}
        </Typography>
      </div>
      <div className={classes.chatList}>
        <List disablePadding>
          {Array.isArray(groups) &&
            groups.map((group) => {
              const unreadCount = getUnreadCount(group, currentUserId);
              const isActive = Number(selectedChatId) === Number(group.id);
              const membersCount = getMembersCount(group);

              return (
                <ListItem
                  key={group.id}
                  onClick={() => handleSelectGroup(group)}
                  className={isActive ? classes.listItemActive : classes.listItem}
                  button
                >
                  <ListItemAvatar>
                    <Avatar className={classes.avatar}>
                      <GroupIcon fontSize="small" />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <>
                        {group.title || "Grupo sem nome"}
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
                      <>
                        <Typography component="span" color="textSecondary" style={{ fontSize: "0.74rem" }}>
                          {membersCount} participantes
                        </Typography>
                        <Typography
                          component="span"
                          color="textSecondary"
                          style={{
                            fontSize: "0.74rem",
                            display: "block",
                            marginTop: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {group?.lastMessage || "Sem mensagens ainda"}
                        </Typography>
                      </>
                    }
                    primaryTypographyProps={{ noWrap: true, style: { fontWeight: 600 } }}
                    secondaryTypographyProps={{ component: "div" }}
                  />
                </ListItem>
              );
            })}
          {(!Array.isArray(groups) || groups.length === 0) && (
            <Box className={classes.emptyState}>Nenhum grupo interno criado ainda.</Box>
          )}
        </List>
      </div>
    </div>
  );
}
