import React, { useMemo, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { IconButton, Tooltip } from "@material-ui/core";
import { PeopleAlt, ExitToApp } from "@material-ui/icons";

import api from "../../services/api";
import useEmployees from "../../hooks/useEmployees";
import FinanceRecordList from "../../components/FinanceRecordList";
import EmployeeDependentsModal from "../../components/EmployeeDependentsModal";
import PayrollTerminationModal from "../../components/PayrollTerminationModal";
import { employeeColumns, employeeFields, WORK_REGIME_OPTIONS, CONTRACT_STATUS_OPTIONS } from "./employeeConfig";

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

// Cadastro de Funcionários (RH — Fase 1 de 3, ver docs/MANUAL_TECNICO.md).
// Funcionário NÃO tem login nem acesso ao sistema — é só um registro de
// dados de RH, acessado dentro da aba "Funcionários" do módulo RH (mesma
// trava useHR/hrAccess já usada por Vagas/Candidaturas, ver pages/RH).
// Reaproveita o mesmo par genérico FinanceRecordList/FinanceRecordModal já
// usado por Produtos/Serviços — o campo "Gestor/Supervisor responsável"
// (managerId) é um asyncSelect sobre `/users/list`, empacotado aqui num
// objeto no formato que o FinanceRecordModal espera do prop `finance`
// (`finance.users.list({searchParam}) => {records}`), sem precisar de um
// hook useFinance de verdade.
const Employees = () => {
  const classes = useStyles();
  const employees = useEmployees();
  const [dependentsTarget, setDependentsTarget] = useState(null);
  const [terminationTarget, setTerminationTarget] = useState(null);

  const userPickerResource = useMemo(
    () => ({
      users: {
        list: async ({ searchParam } = {}) => {
          const { data } = await api.get("/users/list");
          const term = (searchParam || "").toLowerCase().trim();
          const records = term
            ? data.filter((u) => (u.name || "").toLowerCase().includes(term))
            : data;
          return { records };
        },
      },
    }),
    []
  );

  return (
    <div className={classes.pageRoot}>
      <FinanceRecordList
        title="Funcionário"
        resource={employees}
        columns={employeeColumns}
        fields={employeeFields}
        filters={[
          { name: "workRegime", label: "Regime", options: [{ value: "", label: "Todos" }, ...WORK_REGIME_OPTIONS] },
          { name: "contractStatus", label: "Status", options: [{ value: "", label: "Todos" }, ...CONTRACT_STATUS_OPTIONS] },
        ]}
        finance={userPickerResource}
        enablePhotoUpload
        // Dependentes (RH — Fase 2) — usados no cálculo de IRRF da Folha
        // Mensal (ver components/PayrollPanel).
        rowActions={(record) => (
          <>
            <Tooltip title="Dependentes (IRRF)">
              <IconButton size="small" onClick={() => setDependentsTarget(record)}>
                <PeopleAlt fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Rescisão de Contrato">
              <IconButton size="small" onClick={() => setTerminationTarget(record)}>
                <ExitToApp fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      />
      {dependentsTarget && (
        <EmployeeDependentsModal
          open={!!dependentsTarget}
          employee={dependentsTarget}
          onClose={() => setDependentsTarget(null)}
        />
      )}
      {terminationTarget && (
        <PayrollTerminationModal
          open={!!terminationTarget}
          employee={terminationTarget}
          onClose={() => setTerminationTarget(null)}
        />
      )}
    </div>
  );
};

export default Employees;
