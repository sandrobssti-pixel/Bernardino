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

  return { list, calculate, calculateAll, remove, tables };
};

export default usePayroll;
