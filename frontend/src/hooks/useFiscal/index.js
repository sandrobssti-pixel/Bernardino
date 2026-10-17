import api from "../../services/api";

// Módulo fiscal (Fase 3 — ver docs/MANUAL_TECNICO.md, seção 6.2): venda com
// itens (Sale/SaleItem) e emissão de NF-e/NFC-e/NFS-e via gateway (Focus
// NFe). Add-on separado do Financeiro (Plan.useFiscal, v2.3.23) — sempre
// exige o Financeiro também ativo, mas o Master pode vender um plano com um
// e sem o outro.
const useFiscal = () => {
  const getAccess = async () => {
    const { data } = await api.get("/fiscal/access");
    return data;
  };

  const config = {
    show: async () => {
      const { data } = await api.get("/fiscal/config");
      return data;
    },
    update: async (data) => {
      const { data: responseData } = await api.put("/fiscal/config", data);
      return responseData;
    },
    gateways: async () => {
      const { data } = await api.get("/fiscal/gateways");
      return data;
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
    // `force` (v2.3.143, admin-only — backend ignora se não for): bypassa a
    // trava que impede excluir venda com nota fiscal de Produção. Usado só
    // na seleção em massa, com confirmação extra (ver SaleList.js).
    remove: async (id, force = false) => {
      const { data } = await api.delete(`/sales/${id}`, { params: force ? { force: true } : undefined });
      return data;
    },
    // Importação de vendas históricas via planilha (migração de ERP,
    // v2.3.116) — registra vendas que já têm nota fiscal emitida no sistema
    // anterior, sem chamar o gateway e sem mexer em estoque.
    importSpreadsheet: async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/sales/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
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
    correctionLetter: async (id, text) => {
      const { data } = await api.post(`/fiscal-documents/${id}/correction-letter`, { text });
      return data;
    },
    sendEmail: async (id, emails) => {
      const { data } = await api.post(`/fiscal-documents/${id}/send-email`, { emails });
      return data;
    },
    // Resposta é o PDF em binário, não JSON — pede o blob direto do axios.
    previewDanfe: async (saleId) => {
      const { data } = await api.post(`/sales/${saleId}/fiscal-documents/preview`, null, {
        responseType: "blob",
      });
      return data;
    },
    // Exclui de verdade um documento de teste (Homologação) — o backend
    // recusa (ERR_FISCAL_DOCUMENT_CANNOT_DELETE_PRODUCTION) se for um
    // documento de Produção, nota fiscal real (v2.3.118).
    remove: async (id) => {
      const { data } = await api.delete(`/fiscal-documents/${id}`);
      return data;
    },
  };

  const numbering = {
    list: async () => {
      const { data } = await api.get("/fiscal/numbering/invalidations");
      return data;
    },
    invalidate: async (data) => {
      const { data: responseData } = await api.post("/fiscal/numbering/invalidations", data);
      return responseData;
    },
  };

  return { getAccess, config, sales, fiscalDocuments, numbering };
};

export default useFiscal;
