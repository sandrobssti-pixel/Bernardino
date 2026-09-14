import api from "../../services/api";

// Módulo Financeiro completo (Fase 1 do roadmap — ver docs/MANUAL_TECNICO.md,
// seção 6.2): cadastros de clientes, fornecedores e produtos. É um add-on
// pago — o Master libera por plano (Plan.useFinancial) e o Admin de cada
// empresa libera, usuário a usuário, pra quem não é Admin (User.financialAccess).
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

  return {
    getAccess,
    customers: makeResource("customers"),
    suppliers: makeResource("suppliers"),
    products: makeResource("products"),
  };
};

export default useFinance;
