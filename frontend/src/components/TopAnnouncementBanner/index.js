import React, { useCallback, useContext, useEffect, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  root: {
    marginBottom: theme.spacing(1.25),
    borderRadius: 12,
    padding: theme.spacing(1.1, 1.6),
    display: "flex",
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    textAlign: "left",
    gap: theme.spacing(1.2),
    boxShadow: "0 8px 20px rgba(2, 6, 23, 0.18)",
    border: "1px solid rgba(255,255,255,0.18)",
    [theme.breakpoints.down("sm")]: {
      flexDirection: "column",
      alignItems: "center",
      gap: theme.spacing(0.5),
      padding: theme.spacing(1, 1.1),
      textAlign: "center",
    },
  },
  title: {
    fontSize: 13.5,
    fontWeight: 800,
    letterSpacing: 0.2,
    whiteSpace: "nowrap",
    [theme.breakpoints.down("sm")]: {
      whiteSpace: "normal",
    },
  },
  text: {
    fontSize: 13,
    fontWeight: 700,
    opacity: 0.95,
    lineHeight: 1.4,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    maxWidth: 1200,
  },
}));

const getTextColorFromHex = (hexColor) => {
  const hex = (hexColor || "").replace("#", "");
  if (hex.length !== 6) return "#ffffff";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111827" : "#ffffff";
};

const TopAnnouncementBanner = () => {
  const classes = useStyles();
  const { user, socket, isAuth } = useContext(AuthContext);
  const [banner, setBanner] = useState(null);
  const isMountedRef = React.useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchBanner = useCallback(async () => {
    if (!isAuth || !user?.companyId) return;
    try {
      const { data } = await api.get("/announcements", {
        params: {
          pageNumber: 1,
          searchParam: "",
          displayMode: "topbar",
        },
      });
      const [firstBanner] = data?.records || [];
      if (!isMountedRef.current) return;
      setBanner(firstBanner || null);
    } catch (err) {
      if (!isMountedRef.current) return;
      const isExpectedCancel =
        err?.message === "Logout in progress" ||
        err?.code === "ERR_CANCELED" ||
        err?.name === "CanceledError";
      if (err?.response?.status !== 401 && !isExpectedCancel) {
        toastError(err);
      }
    }
  }, [isAuth, user?.companyId]);

  useEffect(() => {
    if (!isAuth || !user?.companyId) return undefined;
    fetchBanner();

    const interval = setInterval(() => {
      fetchBanner();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchBanner, isAuth, user?.companyId]);

  useEffect(() => {
    if (!isAuth || !user?.companyId) return undefined;

    const onCompanyAnnouncement = () => {
      fetchBanner();
    };

    socket.on("company-announcement", onCompanyAnnouncement);

    return () => {
      socket.off("company-announcement", onCompanyAnnouncement);
    };
  }, [fetchBanner, socket, user?.companyId, isAuth]);

  if (!banner) return null;

  const backgroundColor = banner.backgroundColor || "#0f766e";
  const textColor = getTextColorFromHex(backgroundColor);

  return (
    <div
      className={classes.root}
      style={{ backgroundColor, color: textColor }}
      role="status"
      aria-live="polite"
    >
      <div className={classes.title}>{banner.title}</div>
      <div className={classes.text}>{banner.text}</div>
    </div>
  );
};

export default TopAnnouncementBanner;
