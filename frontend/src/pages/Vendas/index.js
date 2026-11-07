import React, { useState, useEffect, useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";

import { AuthContext } from "../../context/Auth/AuthContext";
import useFinance from "../../hooks/useFinance";
import useFiscal from "../../hooks/useFiscal";
import FiscalSalesPanel from "../../components/FiscalSalesPanel";
import FiscalConfigPanel from "../../components/FiscalConfigPanel";

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
  tabs: {
    marginBottom: theme.spacing(2),
  },
}));

// Módulo Vendas (v2.3.257) — separado do Financeiro, com rota e item de
// menu lateral próprios, pra poder ser liberado por usuário INDEPENDENTE
// do Financeiro completo (User.salesAccess, além do já existente
// User.financialAccess, que continua dando acesso aqui também por
// compatibilidade — ver EnsureFiscalAccess.ts). Continua dependendo do
// módulo fiscal do PLANO estar ativo (Plan.useFinancial + Plan.useFiscal,
// nunca um sem o outro — Vendas usa os cadastros de cliente/produto que
// pertencem ao Financeiro). Reaproveita sem alteração os mesmos
// componentes que antes viviam dentro de Financeiro/index.js
// (FiscalSalesPanel/FiscalConfigPanel) — só mudou ONDE a tela é
// alcançada, não como funciona por dentro. Ver docs/MANUAL_TECNICO.md.
const Vendas = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const finance = useFinance();
  const fiscal = useFiscal();
  const [fiscalAccess, setFiscalAccess] = useState(null);
  const [tab, setTab] = useState("sales");

  useEffect(() => {
    (async () => {
      try {
        const access = await fiscal.getAccess();
        setFiscalAccess(access);
      } catch (err) {
        setFiscalAccess({ planHasModule: false, hasAccess: false });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!fiscalAccess) {
    return (
      <div className={classes.pageRoot}>
        <CircularProgress size={24} />
      </div>
    );
  }

  const hasAccess = user.super || !!fiscalAccess?.hasAccess;

  if (!hasAccess) {
    return (
      <div className={classes.pageRoot}>
        <Box className={classes.lockedBox}>
          <Typography variant="h6" gutterBottom>
            Módulo Vendas não disponível
          </Typography>
          <Typography variant="body2">
            {fiscalAccess?.planHasModule
              ? "Peça para o administrador da sua empresa liberar seu acesso ao módulo Vendas."
              : "Esse módulo é um add-on separado do plano contratado. Fale com o suporte para contratá-lo."}
          </Typography>
        </Box>
      </div>
    );
  }

  return (
    <div className={classes.pageRoot}>
      <Tabs
        className={classes.tabs}
        value={tab}
        onChange={(e, value) => setTab(value)}
        indicatorColor="primary"
        textColor="primary"
      >
        <Tab label="Vendas" value="sales" />
        <Tab label="Configuração Fiscal" value="fiscalConfig" />
      </Tabs>
      {tab === "sales" ? (
        <FiscalSalesPanel finance={finance} fiscal={fiscal} />
      ) : (
        <FiscalConfigPanel fiscal={fiscal} />
      )}
    </div>
  );
};

export default Vendas;
