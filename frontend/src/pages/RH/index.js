import React, { useState, useEffect, useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";

import { AuthContext } from "../../context/Auth/AuthContext";
import useHR from "../../hooks/useHR";
import HRPainel from "../../components/HRPainel";
import JobPostingList from "../../components/JobPostingList";
import JobApplicationsPanel from "../../components/JobApplicationsPanel";

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    padding: theme.spacing(2),
    height: "calc(100% - 48px)",
    overflowY: "auto",
    ...theme.scrollbarStyles,
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
    },
  },
  layoutRow: {
    display: "flex",
    flex: 1,
    gap: theme.spacing(2),
    alignItems: "flex-start",
    [theme.breakpoints.down("xs")]: {
      flexDirection: "column",
    },
  },
  sideTabs: {
    borderRight: `1px solid ${theme.palette.divider}`,
    minWidth: 180,
    flexShrink: 0,
    [theme.breakpoints.down("xs")]: {
      width: "100%",
      borderRight: "none",
      borderBottom: `1px solid ${theme.palette.divider}`,
    },
  },
  sideTab: {
    minHeight: 48,
    alignItems: "flex-start",
    textAlign: "left",
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.85rem",
    paddingLeft: theme.spacing(2),
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  lockedBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    flex: 1,
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
}));

// Módulo de RH/recrutamento (Fase 5 — ver docs/MANUAL_TECNICO.md, seção
// 6.2): vagas + candidaturas (com anexo de currículo, via página pública
// /vagas/:companyId) + efetivação (transforma um candidato em usuário do
// sistema). Add-on independente do Financeiro/Fiscal (Plan.useHR) — mesmo
// padrão de acesso: menu sempre visível pro Admin, página mostra bloqueio
// se o plano não incluir o módulo (diferente das abas Fiscal dentro do
// Financeiro, que ficam totalmente escondidas).
const RH = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const hr = useHR();
  const [hrAccess, setHrAccess] = useState(null);
  const [tab, setTab] = useState("painel");

  useEffect(() => {
    (async () => {
      try {
        const access = await hr.getAccess();
        setHrAccess(access);
      } catch (err) {
        setHrAccess({ planHasModule: false, hasAccess: false });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user.super) {
    if (hrAccess === null) {
      return (
        <div className={classes.pageRoot}>
          <Box display="flex" justifyContent="center" my={6}>
            <CircularProgress />
          </Box>
        </div>
      );
    }

    if (!hrAccess.hasAccess) {
      return (
        <div className={classes.pageRoot}>
          <Box className={classes.lockedBox}>
            <Typography variant="h6" gutterBottom>
              Módulo de RH não disponível
            </Typography>
            <Typography variant="body2">
              {hrAccess.planHasModule
                ? "Peça para o administrador da sua empresa liberar seu acesso ao módulo de RH."
                : "Esse módulo é um add-on separado do plano contratado. Fale com o suporte para contratá-lo."}
            </Typography>
          </Box>
        </div>
      );
    }
  }

  return (
    <div className={classes.pageRoot}>
      <div className={classes.layoutRow}>
        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          orientation="vertical"
          variant="scrollable"
          indicatorColor="primary"
          textColor="primary"
          className={classes.sideTabs}
        >
          <Tab className={classes.sideTab} value="painel" label="Painel RH" />
          <Tab className={classes.sideTab} value="jobPostings" label="Vagas" />
          <Tab className={classes.sideTab} value="applications" label="Candidaturas" />
        </Tabs>

        <div className={classes.content}>
          {tab === "painel" && <HRPainel hr={hr} />}
          {tab === "jobPostings" && <JobPostingList hr={hr} companyId={user.companyId} />}
          {tab === "applications" && <JobApplicationsPanel hr={hr} />}
        </div>
      </div>
    </div>
  );
};

export default RH;
