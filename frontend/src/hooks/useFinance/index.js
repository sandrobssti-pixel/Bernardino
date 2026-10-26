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
    // Dashboard de lucro (v2.3.117) — devolve { enabled: false } quando a
    // empresa ainda não está com a Focus NFe em modo Produção (pedido do
    // cliente: só mostrar esse relatório depois que a emissão "for de
    // verdade", não com venda de teste em Homologação).
    profitDashboard: async () => {
      const { data } = await api.get("/finance/reports/profit-dashboard");
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

  // Gerar cobrança (Pix/boleto) via gateway — Mercado Pago e/ou Asaas, em
  // Contas a Receber. `provider` só é obrigatório quando os dois gateways
  // estão ligados ao mesmo tempo (ver FinancePaymentConfigPanel/
  // FinanceRecordModal) — com um só ligado, o backend resolve sozinho.
  // Separado de `makeResource` porque não é um verbo genérico de CRUD (os
  // outros cadastros não têm isso).
  const receivables = {
    ...makeResource("receivables"),
    generatePix: async (id, provider) => {
      const { data } = await api.post(`/finance/receivables/${id}/pix`, { provider });
      return data;
    },
    generateBoleto: async (id, provider) => {
      const { data } = await api.post(`/finance/receivables/${id}/boleto`, { provider });
      return data;
    },
  };

  // Configuração do gateway de cobrança (token Mercado Pago etc.) — um
  // registro por empresa, mesmo padrão de get/upsert já usado em
  // Configuração Fiscal (não é uma lista).
  const paymentConfig = {
    show: async () => {
      const { data } = await api.get("/finance/payment-config");
      return data;
    },
    update: async (payload) => {
      const { data } = await api.put("/finance/payment-config", payload);
      return data;
    },
  };

  // Cobrança via gateway é um add-on SEPARADO do Financeiro (Plan.usePayment,
  // mesmo padrão de useFiscal) — o Master decide, por plano, se o cliente
  // paga por esse serviço. Usado pra mostrar/esconder a aba Configuração de
  // Pagamento e os botões "Gerar Pix"/"Gerar boleto" em Contas a Receber.
  const getPaymentAccess = async () => {
    const { data } = await api.get("/finance/payment-access");
    return data;
  };

  return {
    getAccess,
    getCustomerByContact,
    linkContactAsCustomer,
    customers: makeResource("customers"),
    suppliers: makeResource("suppliers"),
    products: {
      ...makeResource("products"),
      // Foto do produto (v2.3.167) — só depois do produto já existir (o
      // record precisa de um id pra saber em qual pasta gravar).
      uploadPhoto: async (id, file) => {
        const formData = new FormData();
        formData.append("photo", file);
        const { data } = await api.post(`/finance/products/${id}/photo`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        return data;
      },
      // Unidades físicas de arma (número de série) — sub-cadastro do
      // Produto/SKU, v2.3.205 (Etapa 1). Ver docs/MANUAL_TECNICO.md,
      // seção 184.
      weaponUnits: {
        list: async (productId) => {
          const { data } = await api.get(`/finance/products/${productId}/weapon-units`);
          return data;
        },
        save: async (productId, data) => {
          const { data: responseData } = await api.post(
            `/finance/products/${productId}/weapon-units`,
            data
          );
          return responseData;
        },
        // Cadastro em lote (colar lista, uma série por linha).
        saveBulk: async (productId, serialNumbers) => {
          const { data } = await api.post(
            `/finance/products/${productId}/weapon-units/bulk`,
            { serialNumbers }
          );
          return data;
        },
        update: async (productId, id, data) => {
          const { data: responseData } = await api.put(
            `/finance/products/${productId}/weapon-units/${id}`,
            data
          );
          return responseData;
        },
        remove: async (productId, id) => {
          const { data } = await api.delete(`/finance/products/${productId}/weapon-units/${id}`);
          return data;
        },
        // Busca por nome do modelo, SKU ou número de série.
        search: async (searchParam) => {
          const { data } = await api.get("/finance/weapon-units/search", {
            params: { searchParam },
          });
          return data;
        },
      },
      // Caixinhas pequenas de munição (lote + ID/código de barras) —
      // sub-cadastro do Produto/SKU (a "caixa cheia"), v2.3.223.
      ammoVolumes: {
        list: async (productId) => {
          const { data } = await api.get(`/finance/products/${productId}/ammo-volumes`);
          return data;
        },
        save: async (productId, data) => {
          const { data: responseData } = await api.post(
            `/finance/products/${productId}/ammo-volumes`,
            data
          );
          return responseData;
        },
        // Cadastro em lote (uma remessa de caixa cheia vira várias
        // caixinhas de uma vez — mesmo lote, colar só os IDs).
        saveBulk: async (productId, { lotNumber, defaultUnitQuantity, lines }) => {
          const { data } = await api.post(
            `/finance/products/${productId}/ammo-volumes/bulk`,
            { lotNumber, defaultUnitQuantity, lines }
          );
          return data;
        },
        update: async (productId, id, data) => {
          const { data: responseData } = await api.put(
            `/finance/products/${productId}/ammo-volumes/${id}`,
            data
          );
          return responseData;
        },
        remove: async (productId, id) => {
          const { data } = await api.delete(`/finance/products/${productId}/ammo-volumes/${id}`);
          return data;
        },
      },
    },
    expenses: makeResource("expenses"),
    receivables,
    paymentConfig,
    getPaymentAccess,
    reports,
  };
};

export default useFinance;
