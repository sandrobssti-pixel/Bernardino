import React, { useState, useEffect, useContext } from "react";
import { useLocation } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";

import { AuthContext } from "../../context/Auth/AuthContext";
import GlobalConfig from "../GlobalConfig";
import useFinance from "../../hooks/useFinance";
import useFiscal from "../../hooks/useFiscal";
import useServices from "../../hooks/useServices";
import FinanceRecordList from "../../components/FinanceRecordList";
import FinancePainel from "../../components/FinancePainel";
import FiscalConfigPanel from "../../components/FiscalConfigPanel";
import FinancePaymentConfigPanel from "../../components/FinancePaymentConfigPanel";
import FiscalSalesPanel from "../../components/FiscalSalesPanel";
import {
  financeCustomerColumns,
  financeCustomerFields,
  financeSupplierColumns,
  financeSupplierFields,
  financeProductColumns,
  financeProductFilters,
  getProductFieldsForCategory,
  financeExpenseColumns,
  financeExpenseFields,
  financeExpenseFilters,
  financeReceivableColumns,
  financeReceivableFields,
  financeReceivableFilters,
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

// Módulo Financeiro completo: add-on pago pra empresas-clientes, ver
// docs/MANUAL_TECNICO.md, seção 6.2. Fase 1 — clientes/fornecedores/
// produtos; Fase 2 — painel com gráficos, contas a pagar/receber. A
// assinatura do AtendeFlow (plano/vigência/cobrança com a Confianza
// Technologies) não vive mais aqui — ficou em Configurações > Assinatura.
//
// O Master tem acesso a todas as funcionalidades do sistema (inclusive este
// módulo, no próprio ambiente dele) — por isso, além do Painel SaaS
// (cobrança de todas as empresas-clientes, exclusivo dele), ele também vê
// as mesmas abas operacionais que um Admin normal, operando só nos dados da
// própria empresa dele (companyId 1) — nunca nos de uma empresa-cliente real.
const Financeiro = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const finance = useFinance();
  const fiscal = useFiscal();
  const services = useServices();
  const [financeAccess, setFinanceAccess] = useState(null);
  // Fiscal (Vendas/Configuração Fiscal) é um add-on SEPARADO do Financeiro
  // (Plan.useFiscal, v2.3.23) — o Master pode vender um plano com Financeiro
  // mas sem Fiscal, então precisa de um gate próprio (não basta financeAccess).
  const [fiscalAccess, setFiscalAccess] = useState(null);
  // Flag global da Reforma Tributária 2027 (IVA) — vem da Configuração
  // Fiscal, mas também é usada aqui pra desabilitar os campos novos de
  // Cliente/Produto enquanto estiver off (ver FinanceRecordModal
  // `disabledWhen`/`context`). Só busca quando a empresa tem acesso ao
  // módulo fiscal — sem ele, fica sempre `false` (campos ficam
  // desabilitados, que é o padrão seguro).
  const [reform2027Enabled, setReform2027Enabled] = useState(false);
  // Endereço do emitente pro cabeçalho impresso do Painel Financeiro — vem
  // do mesmo fetch que já existia aqui (reform2027Enabled), sem chamada
  // extra. Só busca quando a empresa tem acesso ao Fiscal (ver aviso em
  // FiscalConfigService.show: evitar criar uma linha de config fiscal vazia
  // pra empresa que só abre o Financeiro, sem usar o módulo fiscal).
  const [fiscalConfig, setFiscalConfig] = useState(null);
  // Cobrança via gateway (Pix/boleto) é um add-on SEPARADO do Financeiro
  // (Plan.usePayment, mesmo padrão de fiscalAccess acima) — o Master decide
  // por plano se o cliente paga por esse serviço extra.
  const [paymentAccess, setPaymentAccess] = useState(null);
  const [financeTab, setFinanceTab] = useState(user.super ? "saas" : "painel");
  const location = useLocation();

  // Navegação pelo menu lateral (MainListItems.js > Financeiro > ...) manda
  // a aba certa via query string (`?tab=products&type=weapon:national`), já
  // que essa página inteira é uma SPA sem rotas por aba — sem isso, os links
  // do menu lateral sempre caíam na mesma aba padrão. Continua funcionando
  // normal se a página for aberta direto em "/financeiro" (sem query),
  // porque `tab` vem `null` e o estado inicial acima prevalece.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get("tab");
    if (tabParam) {
      setFinanceTab(tabParam);
    }
  }, [location.search]);

  const productTypeParam = new URLSearchParams(location.search).get("type") || "";

  useEffect(() => {
    (async () => {
      try {
        const access = await finance.getAccess();
        setFinanceAccess(access);
      } catch (err) {
        setFinanceAccess({ planHasModule: false, hasAccess: false });
      }
      try {
        const access = await fiscal.getAccess();
        setFiscalAccess(access);
        if (access?.hasAccess) {
          const config = await fiscal.config.show();
          setReform2027Enabled(!!config?.reform2027Enabled);
          setFiscalConfig(config);
        }
      } catch (err) {
        setFiscalAccess({ planHasModule: false, hasAccess: false });
      }
      try {
        const access = await finance.getPaymentAccess();
        setPaymentAccess(access);
      } catch (err) {
        setPaymentAccess({ planHasModule: false, hasAccess: false });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showFiscalTabs = user.super || !!fiscalAccess?.hasAccess;
  const showPaymentTab = user.super || !!paymentAccess?.hasAccess;
  const financeRecordContext = { reform2027Enabled };

  const renderPanel = () => {
    if (financeTab === "painel") {
      return <FinancePainel finance={finance} company={user.company} fiscalConfig={fiscalConfig} />;
    }
    if (financeTab === "expenses") {
      return (
        <FinanceRecordList
          key={financeTab}
          title="Conta a pagar"
          resource={finance.expenses}
          columns={financeExpenseColumns}
          fields={financeExpenseFields}
          filters={financeExpenseFilters}
          finance={finance}
        />
      );
    }
    if (financeTab === "receivables") {
      return (
        <FinanceRecordList
          key={financeTab}
          title="Conta a receber"
          resource={finance.receivables}
          columns={financeReceivableColumns}
          fields={financeReceivableFields}
          filters={financeReceivableFilters}
          finance={finance}
          services={services}
          enablePayments={showPaymentTab}
        />
      );
    }
    if (financeTab === "paymentConfig") {
      if (!showPaymentTab) {
        return (
          <Box className={classes.lockedBox}>
            <Typography variant="h6" gutterBottom>
              Cobrança via gateway não disponível
            </Typography>
            <Typography variant="body2">
              {paymentAccess?.planHasModule
                ? "Peça para o administrador da sua empresa liberar seu acesso."
                : "Esse serviço é um add-on separado do plano contratado. Fale com o suporte para contratá-lo."}
            </Typography>
          </Box>
        );
      }
      return <FinancePaymentConfigPanel key={financeTab} finance={finance} />;
    }
    if (financeTab === "sales" || financeTab === "fiscalConfig") {
      if (!showFiscalTabs) {
        return (
          <Box className={classes.lockedBox}>
            <Typography variant="h6" gutterBottom>
              Módulo fiscal não disponível
            </Typography>
            <Typography variant="body2">
              {fiscalAccess?.planHasModule
                ? "Peça para o administrador da sua empresa liberar seu acesso ao módulo fiscal."
                : "Esse módulo é um add-on separado do plano contratado. Fale com o suporte para contratá-lo."}
            </Typography>
          </Box>
        );
      }
      if (financeTab === "sales") {
        return <FiscalSalesPanel key={financeTab} finance={finance} fiscal={fiscal} />;
      }
      return <FiscalConfigPanel key={financeTab} fiscal={fiscal} />;
    }
    if (financeTab === "customers") {
      return (
        <FinanceRecordList
          key={financeTab}
          title="Cliente"
          resource={finance.customers}
          columns={financeCustomerColumns}
          fields={financeCustomerFields}
          allowImport
          allowTemplateDownload
          templateFilename="modelo-importacao-clientes.xlsx"
          context={financeRecordContext}
        />
      );
    }
    if (financeTab === "suppliers") {
      return (
        <FinanceRecordList
          key={financeTab}
          title="Fornecedor"
          resource={finance.suppliers}
          columns={financeSupplierColumns}
          fields={financeSupplierFields}
          allowImport
        />
      );
    }
    if (financeTab === "products") {
      return (
        <FinanceRecordList
          key={`products-${productTypeParam}`}
          title="Produto"
          resource={finance.products}
          columns={financeProductColumns}
          fields={getProductFieldsForCategory(productTypeParam)}
          // Dropdown "Tipo" só aparece quando a tela abriu sem categoria
          // definida (link "Todos os produtos", ou "/financeiro" direto) —
          // chegando por um link de categoria específica do menu lateral
          // (Armas nacionais, Munições/Insumos etc.), já está dentro do
          // painel daquela categoria, não faz sentido oferecer escolher
          // outra ali (pedido do cliente).
          filters={productTypeParam ? [] : financeProductFilters}
          initialFilterValues={{ type: productTypeParam }}
          allowImport
          allowTemplateDownload
          templateFilename="modelo-importacao-produtos.xlsx"
          context={financeRecordContext}
          enablePhotoUpload
          // Faltava — sem isso, `FinanceRecordModal` não tinha acesso a
          // `finance.suppliers` (campo "Distribuidor/Fornecedor
          // Principal" nunca retornava resultado nenhum ao buscar) nem a
          // `finance.products.weaponUnits` (seção "Armas deste modelo"
          // quebrava ao tentar listar/salvar unidade). Bug relatado pelo
          // cliente: "quando digita fornecedor não aparece os
          // cadastrados". Ver docs/MANUAL_TECNICO.md, seção 188.
          finance={finance}
        />
      );
    }
    if (financeTab === "saas") {
      return <GlobalConfig />;
    }
    return null;
  };

  if (!user.super) {
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
  }

  return (
    <div className={classes.pageRoot}>
      <div className={classes.content}>{renderPanel()}</div>
    </div>
  );
};

export default Financeiro;
