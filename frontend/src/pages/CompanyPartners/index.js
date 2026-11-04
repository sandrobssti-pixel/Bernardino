import React from "react";
import { makeStyles } from "@material-ui/core/styles";

import useCompanyPartners from "../../hooks/useCompanyPartners";
import FinanceRecordList from "../../components/FinanceRecordList";
import { companyPartnerColumns, companyPartnerFields, PARTNER_STATUS_OPTIONS } from "./companyPartnerConfig";

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

// Cadastro de Sócios (RH, ver docs/MANUAL_TECNICO.md). Sócio NÃO é
// Funcionário — não tem regime CLT/PJ/Estagiário/Menor Aprendiz, sem
// vínculo empregatício. Reaproveita o mesmo par genérico
// FinanceRecordList/FinanceRecordModal já usado por
// Produtos/Serviços/Funcionários. O valor do Pró-labore é só cadastro
// nesta entrega — NÃO entra no motor de cálculo de folha (Folha
// Mensal) até a tributação de INSS específica de sócio/pró-labore
// (contribuinte individual, diferente da tabela progressiva de CLT)
// ser pesquisada e confirmada.
const CompanyPartners = () => {
  const classes = useStyles();
  const partners = useCompanyPartners();

  return (
    <div className={classes.pageRoot}>
      <FinanceRecordList
        title="Sócio"
        resource={partners}
        columns={companyPartnerColumns}
        fields={companyPartnerFields}
        filters={[
          { name: "partnerStatus", label: "Status", options: [{ value: "", label: "Todos" }, ...PARTNER_STATUS_OPTIONS] },
        ]}
        enablePhotoUpload
      />
    </div>
  );
};

export default CompanyPartners;
