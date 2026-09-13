import React, { useMemo } from "react";
import { useHistory, useParams } from "react-router-dom";
import { Box, makeStyles } from "@material-ui/core";
import ChatBubbleOutlineIcon from "@material-ui/icons/ChatBubbleOutline";
import VpnKeyIcon from "@material-ui/icons/VpnKey";

import FlowBuilder from "../FlowBuilder";
import CampaignsPhrase from "../CampaignsPhrase";

const TAB_CONVERSATION = "conversation";
const TAB_CAMPAIGN = "campaign";

const useStyles = makeStyles((theme) => ({
  tabsWrap: {
    padding: theme.spacing(2, 3, 0),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1.5, 1.5, 0),
    },
  },
  pageTabs: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    width: "100%",
    padding: 0,
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(248,250,252,0.96)",
    boxShadow:
      theme.palette.type === "dark"
        ? "inset 0 1px 0 rgba(255,255,255,0.04)"
        : "0 3px 10px rgba(15,23,42,0.04)",
  },
  pageTabButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    padding: theme.spacing(1.6, 2),
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "0.92rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#475569",
    transition: "all 0.18s ease",
    position: "relative",
    textAlign: "center",
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.04)"
          : "rgba(255,255,255,0.7)",
      color: theme.palette.type === "dark" ? "#e2e8f0" : "#0f172a",
    },
  },
  pageTabButtonActive: {
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.08)",
    color: theme.palette.type === "dark" ? "#c7d2fe" : "#3730a3",
    "&::after": {
      content: "\"\"",
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 3,
      backgroundColor: theme.palette.type === "dark" ? "#818cf8" : "#4f46e5",
    },
  },
  pageTabsDivider: {
    padding: theme.spacing(0, 1),
    fontSize: "1rem",
    fontWeight: 700,
    color: theme.palette.type === "dark" ? "#475569" : "#94a3b8",
    userSelect: "none",
  },
}));

const FlowBuilderHub = () => {
  const classes = useStyles();
  const history = useHistory();
  const { tab } = useParams();

  const activeTab = useMemo(() => {
    if (tab === TAB_CAMPAIGN) return TAB_CAMPAIGN;
    if (tab === TAB_CONVERSATION || !tab) return TAB_CONVERSATION;
    return TAB_CONVERSATION;
  }, [tab]);

  const handleChangeTab = (nextTab) => {
    history.push(`/flowbuilders/${nextTab}`);
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      height="100%"
      width="100%"
      bgcolor="background.default"
    >
      <Box className={classes.tabsWrap}>
        <div className={classes.pageTabs}>
          <button
            type="button"
            className={`${classes.pageTabButton} ${
              activeTab === TAB_CONVERSATION ? classes.pageTabButtonActive : ""
            }`}
            onClick={() => handleChangeTab(TAB_CONVERSATION)}
          >
            <ChatBubbleOutlineIcon fontSize="small" />
            Fluxo de conversa
          </button>
          <span className={classes.pageTabsDivider}>|</span>
          <button
            type="button"
            className={`${classes.pageTabButton} ${
              activeTab === TAB_CAMPAIGN ? classes.pageTabButtonActive : ""
            }`}
            onClick={() => handleChangeTab(TAB_CAMPAIGN)}
          >
            <VpnKeyIcon fontSize="small" />
            Fluxo por palavra chave
          </button>
        </div>
      </Box>

      <Box flex={1} minHeight={0}>
        {activeTab === TAB_CAMPAIGN ? <CampaignsPhrase /> : <FlowBuilder />}
      </Box>
    </Box>
  );
};

export default FlowBuilderHub;
