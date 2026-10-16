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
    // Importação via planilha Excel (Fase 6) — detecção automática de
    // coluna no backend, duplicata (SKU/nome ou CPF-CNPJ/nome) atualiza o
    // registro já existente. Só implementado pra customers/suppliers/
    // products (`/finance/<basePath>/import`) — chamar em recursos sem
    // esse endpoint (expenses/receivables) dá 404.
    importSpreadsheet: async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post(`/finance/${basePath}/import`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    // Planilha-modelo pra download (só implementado pra customers/products,
    // `/finance/<basePath>/import-template`) — baixa o .xlsx com as colunas
    // que a importação reconhece, pra preencher e reimportar depois.
    downloadTemplate: async (filename) => {
      const { data } = await api.get(`/finance/${basePath}/import-template`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
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
    stockHealth: async () => {
      const { data } = await api.get("/finance/reports/stock-health");
      return data;
    },
  };

  // Vínculo Contato (Atendimento) <-> Cliente (Financeiro), pra virar uma
  // base só — o atendente marca um Contato já existente como cliente
  // financeiro em vez de cadastrar tudo de novo. Nome/telefone sempre vêm
  // do Contato; CPF/CNPJ/endereço só existem e só são editáveis aqui no
  // Financeiro. Ver docs/MANUAL_TECNICO.md.
  const getCustomerByContact = async (contactId) => {
    try {
      const { data } = await api.get(`/finance/customers/by-contact/${contactId}`);
      return data;
    } catch (err) {
      if (err.response?.status === 404) return null;
      throw err;
    }
  };

  const linkContactAsCustomer = async (contactId) => {
    const { data } = await api.post(`/finance/customers/link-contact/${contactId}`);
    return data;
  };

  return {
    getAccess,
    getCustomerByContact,
    linkContactAsCustomer,
    customers: makeResource("customers"),
    suppliers: makeResource("suppliers"),
    products: makeResource("products"),
    expenses: makeResource("expenses"),
    receivables: makeResource("receivables"),
    reports,
  };
};

export default useFinance;
