import api from "../../services/api";

// Módulo Financeiro completo (ver docs/MANUAL_TECNICO.md, seção 6.2): Fase 1
// — cadastros de clientes, fornecedores e produtos; Fase 2 — contas a
// pagar/receber e relatórios. É um add-on pago — o Master libera por plano
// (Plan.useFinancial) e o Admin de cada empresa libera, usuário a usuário,
// pra quem não é Admin (User.financialAccess).
const useFinance = () => {
  const getAccess = async () => {
    const { data } = await api.get("/finance/access");
    return data;
  };

  const makeResource = (basePath) => ({
    list: async (params) => {
      const { data } = await api.get(`/finance/${basePath}`, { params });
      return data;
    },
    save: async (data) => {
      const { data: responseData } = await api.post(`/finance/${basePath}`, data);
      return responseData;
    },
    update: async (id, data) => {
      const { data: responseData } = await api.put(`/finance/${basePath}/${id}`, data);
      return responseData;
    },
    remove: async (id) => {
      const { data } = await api.delete(`/finance/${basePath}/${id}`);
      return data;
    },
  });

  // Fase 2 (Financeiro operacional) — relatórios são só leitura, então não
  // usam makeResource (que assume list/save/update/remove de um CRUD).
  const reports = {
    summary: async () => {
      const { data } = await api.get("/finance/reports/summary");
      return data;
    },
    cashFlow: async (months = 6) => {
      const { data } = await api.get("/finance/reports/cashflow", { params: { months } });
      return data;
    },
    expensesByCategory: async () => {
      const { data } = await api.get("/finance/reports/expenses-by-category");
      return data;
    },
  };

  return {
    getAccess,
    customers: makeResource("customers"),
    suppliers: makeResource("suppliers"),
    products: makeResource("products"),
    expenses: makeResource("expenses"),
    receivables: makeResource("receivables"),
    reports,
  };
};

export default useFinance;
