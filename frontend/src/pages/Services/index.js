import React from "react";
import { makeStyles } from "@material-ui/core/styles";

import useServices from "../../hooks/useServices";
import FinanceRecordList from "../../components/FinanceRecordList";
import { serviceColumns, serviceFields } from "./servicesConfig";

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
}));

// Cadastro de Serviço (v2.3.175) — NÃO é um módulo pago/gated (pedido do
// cliente: "não coloca o módulo serviços como módulo separado"), fica
// sempre visível pra qualquer usuário autenticado, mesmo padrão de
// Tags/Filas. É o catálogo de referência que o Despachante Bélico usa pra
// buscar os serviços do cliente (Tipo de serviço). Ver docs/MANUAL_TECNICO.md.
const Services = () => {
  const classes = useStyles();
  const services = useServices();

  return (
    <div className={classes.pageRoot}>
      <FinanceRecordList
        title="Serviço"
        resource={services}
        columns={serviceColumns}
        fields={serviceFields}
        enablePhotoUpload
        allowImport
        allowTemplateDownload
        templateFilename="modelo-importacao-servicos.xlsx"
      />
    </div>
  );
};

export default Services;
