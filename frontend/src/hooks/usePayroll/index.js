import api from "../../services/api";

// Folha Mensal (RH — Fase 2 de 3, ver docs/MANUAL_TECNICO.md) — cálculo
// de INSS/IRRF/FGTS/VT por competência (mês/ano), persistido por
// funcionário. Recalcular a mesma competência atualiza o registro
// existente (upsert no backend), não duplica.
const usePayroll = () => {
  const list = async (params) => {
    const { data } = await api.get("/payroll-entries", { params });
    return data;
  };

  const calculate = async ({ employeeId, competencyMonth, competencyYear }) => {
    const { data } = await api.post("/payroll-entries/calculate", {
      employeeId,
      competencyMonth,
      competencyYear,
    });
    return data;
  };

  const calculateAll = async ({ competencyMonth, competencyYear }) => {
    const { data } = await api.post("/payroll-entries/calculate-all", {
      competencyMonth,
      competencyYear,
    });
    return data;
  };

  const remove = async (id) => {
    const { data } = await api.delete(`/payroll-entries/${id}`);
    return data;
  };

  // Lançamento da Folha Mensal em Contas a Pagar (uma conta consolidada
  // por competência) — ver PayrollExpenseService.ts no backend.
  const expenseLaunch = {
    show: async ({ competencyMonth, competencyYear }) => {
      const { data } = await api.get("/payroll-entries/expense-launch", {
        params: { competencyMonth, competencyYear },
      });
      return data;
    },
    launch: async ({ competencyMonth, competencyYear }) => {
      const { data } = await api.post("/payroll-entries/expense-launch", {
        competencyMonth,
        competencyYear,
      });
      return data;
    },
  };

  // Folha de pró-labore dos Sócios — INSS de contribuinte individual
  // (alíquota fixa 11%, não a tabela de CLT) + IRRF pela mesma tabela de
  // CLT. Ver PayrollPartnerEntryService.ts no backend.
  const partners = {
    list: async (params) => {
      const { data } = await api.get("/payroll-partner-entries", { params });
      return data;
    },
    calculate: async ({ partnerId, competencyMonth, competencyYear }) => {
      const { data } = await api.post("/payroll-partner-entries/calculate", {
        partnerId,
        competencyMonth,
        competencyYear,
      });
      return data;
    },
    calculateAll: async ({ competencyMonth, competencyYear }) => {
      const { data } = await api.post("/payroll-partner-entries/calculate-all", {
        competencyMonth,
        competencyYear,
      });
      return data;
    },
    remove: async (id) => {
      const { data } = await api.delete(`/payroll-partner-entries/${id}`);
      return data;
    },
  };

  // 13º Salário — ANUAL (não mensal). INSS/IRRF sobre o valor integral,
  // separado do salário mensal. Ver Payroll13thSalaryService.ts no
  // backend.
  const thirteenthSalary = {
    list: async (params) => {
      const { data } = await api.get("/payroll-13th-salaries", { params });
      return data;
    },
    calculate: async ({ employeeId, year }) => {
      const { data } = await api.post("/payroll-13th-salaries/calculate", { employeeId, year });
      return data;
    },
    calculateAll: async ({ year }) => {
      const { data } = await api.post("/payroll-13th-salaries/calculate-all", { year });
      return data;
    },
    remove: async (id) => {
      const { data } = await api.delete(`/payroll-13th-salaries/${id}`);
      return data;
    },
  };

  // Rescisão de Contrato — UM registro por funcionário. Calcular
  // também atualiza Employee.terminationDate/contractStatus como
  // efeito colateral. Ver PayrollTerminationService.ts no backend.
  const termination = {
    show: async (employeeId) => {
      const { data } = await api.get(`/payroll-terminations/employee/${employeeId}`);
      return data;
    },
    calculate: async ({ employeeId, terminationType, terminationDate, noticeWorked, fgtsBalanceOverride }) => {
      const { data } = await api.post("/payroll-terminations/calculate", {
        employeeId,
        terminationType,
        terminationDate,
        noticeWorked,
        fgtsBalanceOverride,
      });
      return data;
    },
    remove: async (id) => {
      const { data } = await api.delete(`/payroll-terminations/${id}`);
      return data;
    },
  };

  // Férias Gozadas — UM registro por PERÍODO AQUISITIVO (não por ano
  // civil). Diferente da férias proporcional da Rescisão: aqui o
  // salário dos dias gozados + 1/3 SOFREM INSS/IRRF. Abono pecuniário
  // (venda de até 1/3) é isento de INSS/IRRF, mas o 1/3 sobre o abono
  // sofre IRRF (posição da Receita, Solução de Consulta COSIT
  // 209/2021). Ver PayrollVacationService.ts no backend.
  const vacations = {
    showByEmployee: async (employeeId) => {
      const { data } = await api.get(`/payroll-vacations/employee/${employeeId}`);
      return data;
    },
    calculate: async ({ employeeId, periodNumber, vacationStartDate, daysSold }) => {
      const { data } = await api.post("/payroll-vacations/calculate", {
        employeeId,
        periodNumber,
        vacationStartDate,
        daysSold,
      });
      return data;
    },
    remove: async (id) => {
      const { data } = await api.delete(`/payroll-vacations/${id}`);
      return data;
    },
  };

  // Administração das tabelas de INSS/IRRF — só Master (`user.super`).
  // Nunca edita uma versão existente, só cadastra uma nova.
  const tables = {
    listInss: async () => {
      const { data } = await api.get("/payroll/inss-tables");
      return data;
    },
    createInss: async (payload) => {
      const { data } = await api.post("/payroll/inss-tables", payload);
      return data;
    },
    listIrrf: async () => {
      const { data } = await api.get("/payroll/irrf-tables");
      return data;
    },
    createIrrf: async (payload) => {
      const { data } = await api.post("/payroll/irrf-tables", payload);
      return data;
    },
  };

  return { list, calculate, calculateAll, remove, expenseLaunch, partners, thirteenthSalary, termination, vacations, tables };
};

export default usePayroll;
