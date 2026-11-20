import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Chip from "@material-ui/core/Chip";

import { useWorkspace } from "../../context/Workspace";

const useStyles = makeStyles((theme) => ({
  bar: {
    display: "flex",
    gap: theme.spacing(1),
    alignItems: "center",
    padding: theme.spacing(0.5, 1),
    borderBottom: `1px solid ${theme.palette.divider}`,
    overflowX: "auto",
  },
  chip: {
    fontWeight: 600,
  },
}));

// Barra de abas do Multi-Telas (v2.3.324) — só aparece quando existe
// pelo menos 1 aba extra aberta explicitamente (ver
// context/Workspace). Quem nunca usa o botão "abrir em nova aba" nunca
// vê essa barra — tela continua idêntica a antes da feature.
const WorkspaceTabBar = () => {
  const classes = useStyles();
  const { tabs, activeTabId, closeTab, setActiveTab } = useWorkspace();

  if (tabs.length === 0) return null;

  return (
    <Box className={classes.bar}>
      <Chip
        className={classes.chip}
        label="Principal"
        color={activeTabId === null ? "primary" : "default"}
        onClick={() => setActiveTab(null)}
        variant={activeTabId === null ? "default" : "outlined"}
      />
      {tabs.map((tab) => (
        <Chip
          key={tab.id}
          className={classes.chip}
          label={tab.label}
          color={activeTabId === tab.id ? "primary" : "default"}
          variant={activeTabId === tab.id ? "default" : "outlined"}
          onClick={() => setActiveTab(tab.id)}
          onDelete={() => closeTab(tab.id)}
        />
      ))}
    </Box>
  );
};

export default WorkspaceTabBar;
