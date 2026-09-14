import React, { useState, useEffect, useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";

import { AuthContext } from "../../context/Auth/AuthContext";
import GlobalConfig from "../GlobalConfig";
import useFinance from "../../hooks/useFinance";
import FinanceRecordList from "../../components/FinanceRecordList";
import {
  financeCustomerColumns,
  financeCustomerFields,
  financeSupplierColumns,
  financeSupplierFields,
  financeProductColumns,
  financeProductFields,
} from "./financeConfig";

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
}));

// Módulo Financeiro completo (Fase 1 — clientes/fornecedores/produtos):
// add-on pago pra empresas-clientes, ver docs/MANUAL_TECNICO.md, seção 6.2.
// A assinatura do AtendeFlow (plano/vigência/cobrança com a Confianza
// Technologies) não vive mais aqui — ficou em Configurações > Assinatura.
//
// O Master tem acesso a todas as funcionalidades do sistema (inclusive este
// módulo, no próprio ambiente dele) — por isso, além do Painel SaaS
// (cobrança de todas as empresas-clientes, exclusivo dele), ele também vê
// as abas Clientes/Fornecedores/Produtos, operando só nos dados da própria
// empresa dele (companyId 1) — nunca nos de uma empresa-cliente real.
const Financeiro = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const finance = useFinance();
  const [financeAccess, setFinanceAccess] = useState(null);
  const [financeTab, setFinanceTab] = useState(user.super ? "saas" : "customers");

  useEffect(() => {
    (async () => {
      try {
        const access = await finance.getAccess();
        setFinanceAccess(access);
      } catch (err) {
        setFinanceAccess({ planHasModule: false, hasAccess: false });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (user.super) {
    return (
      <div className={classes.pageRoot}>
        <Tabs
          value={financeTab}
          onChange={(e, v) => setFinanceTab(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          style={{ marginBottom: 16 }}
        >
          <Tab value="saas" label="Painel SaaS" />
          <Tab value="customers" label="Clientes" />
          <Tab value="suppliers" label="Fornecedores" />
          <Tab value="products" label="Produtos" />
        </Tabs>

        {financeTab === "saas" && <GlobalConfig />}
        {financeTab === "customers" && (
          <FinanceRecordList
            title="Cliente"
            resource={finance.customers}
            columns={financeCustomerColumns}
            fields={financeCustomerFields}
          />
        )}
        {financeTab === "suppliers" && (
          <FinanceRecordList
            title="Fornecedor"
            resource={finance.suppliers}
            columns={financeSupplierColumns}
            fields={financeSupplierFields}
          />
        )}
        {financeTab === "products" && (
          <FinanceRecordList
            title="Produto"
            resource={finance.products}
            columns={financeProductColumns}
            fields={financeProductFields}
          />
        )}
      </div>
    );
  }

  if (financeAccess === null) {
    return (
      <div className={classes.pageRoot}>
        <Box display="flex" justifyContent="center" my={6}>
          <CircularProgress />
        </Box>
      </div>
    );
  }

  if (!financeAccess.hasAccess) {
    return (
      <div className={classes.pageRoot}>
        <Box className={classes.lockedBox}>
          <Typography variant="h6" gutterBottom>
            Módulo Financeiro não disponível
          </Typography>
          <Typography variant="body2">
            {financeAccess.planHasModule
              ? "Peça para o administrador da sua empresa liberar seu acesso ao módulo Financeiro."
              : "Esse módulo é um add-on separado do plano contratado. Fale com o suporte para contratá-lo."}
          </Typography>
        </Box>
      </div>
    );
  }

  return (
    <div className={classes.pageRoot}>
      <Tabs
        value={financeTab}
        onChange={(e, v) => setFinanceTab(v)}
        indicatorColor="primary"
        textColor="primary"
        variant="scrollable"
        scrollButtons="auto"
        style={{ marginBottom: 16 }}
      >
        <Tab value="customers" label="Clientes" />
        <Tab value="suppliers" label="Fornecedores" />
        <Tab value="products" label="Produtos" />
      </Tabs>

      {financeTab === "customers" && (
        <FinanceRecordList
          title="Cliente"
          resource={finance.customers}
          columns={financeCustomerColumns}
          fields={financeCustomerFields}
        />
      )}

      {financeTab === "suppliers" && (
        <FinanceRecordList
          title="Fornecedor"
          resource={finance.suppliers}
          columns={financeSupplierColumns}
          fields={financeSupplierFields}
        />
      )}

      {financeTab === "products" && (
        <FinanceRecordList
          title="Produto"
          resource={finance.products}
          columns={financeProductColumns}
          fields={financeProductFields}
        />
      )}
    </div>
  );
};

export default Financeiro;
