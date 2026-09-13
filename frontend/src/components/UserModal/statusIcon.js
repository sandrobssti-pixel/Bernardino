import React from "react";
import { Tooltip, makeStyles } from "@material-ui/core";

const useStyles = makeStyles(() => ({
  wrapper: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  dotOnline: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: "#22c55e",
    boxShadow: "0 0 0 2px rgba(34,197,94,0.2)",
    position: "relative",
    "&::after": {
      content: '""',
      position: "absolute",
      inset: -3,
      borderRadius: "50%",
      backgroundColor: "rgba(34,197,94,0.25)",
      animation: "$pulse 1.8s ease-in-out infinite",
    },
  },
  dotOffline: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: "#94a3b8",
    boxShadow: "0 0 0 2px rgba(148,163,184,0.15)",
  },
  "@keyframes pulse": {
    "0%":   { transform: "scale(1)",   opacity: 0.7 },
    "50%":  { transform: "scale(1.8)", opacity: 0   },
    "100%": { transform: "scale(1)",   opacity: 0   },
  },
}));

const UserStatusIcon = ({ user }) => {
  const classes = useStyles();
  return user.online ? (
    <Tooltip title="Ativo" arrow>
      <span className={classes.wrapper}>
        <span className={classes.dotOnline} />
      </span>
    </Tooltip>
  ) : (
    <Tooltip title="Desativado" arrow>
      <span className={classes.wrapper}>
        <span className={classes.dotOffline} />
      </span>
    </Tooltip>
  );
};

export default UserStatusIcon;
