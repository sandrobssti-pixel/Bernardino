import api from "../../services/api";

// Módulo fiscal (Fase 3 — ver docs/MANUAL_TECNICO.md, seção 6.2): venda com
// itens (Sale/SaleItem) e emissão de NF-e/NFC-e/NFS-e via gateway (Focus
// NFe). Mesmo add-on/gate de acesso do Financeiro (Plan.useFinancial já
// cobre "fiscal" — ver comentário no model Plan) — por isso não tem um
// getAccess próprio, reaproveita o de useFinance().
const useFiscal = () => {
  const config = {
    show: async () => {
      const { data } = await api.get("/fiscal/config");
      return data;
    },
    update: async (data) => {
      const { data: responseData } = await api.put("/fiscal/config", data);
      return responseData;
    },
  };

  const sales = {
    list: async (params) => {
      const { data } = await api.get("/sales", { params });
      return data;
    },
    show: async (id) => {
      const { data } = await api.get(`/sales/${id}`);
      return data;
    },
    save: async (data) => {
      const { data: responseData } = await api.post("/sales", data);
      return responseData;
    },
    update: async (id, data) => {
      const { data: responseData } = await api.put(`/sales/${id}`, data);
      return responseData;
    },
    confirm: async (id) => {
      const { data } = await api.post(`/sales/${id}/confirm`);
      return data;
    },
    cancel: async (id) => {
      const { data } = await api.post(`/sales/${id}/cancel`);
      return data;
    },
    remove: async (id) => {
      const { data } = await api.delete(`/sales/${id}`);
      return data;
    },
  };

  const fiscalDocuments = {
    list: async (saleId) => {
      const { data } = await api.get(`/sales/${saleId}/fiscal-documents`);
      return data;
    },
    emit: async (saleId, type) => {
      const { data } = await api.post(`/sales/${saleId}/fiscal-documents`, { type });
      return data;
    },
    refreshStatus: async (id) => {
      const { data } = await api.post(`/fiscal-documents/${id}/refresh-status`);
      return data;
    },
    cancel: async (id, justification) => {
      const { data } = await api.post(`/fiscal-documents/${id}/cancel`, { justification });
      return data;
    },
  };

  return { config, sales, fiscalDocuments };
};

export default useFiscal;
