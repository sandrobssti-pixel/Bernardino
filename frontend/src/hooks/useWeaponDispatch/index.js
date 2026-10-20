import api from "../../services/api";

// Módulo Despachante Bélico (CAC/Posse-Porte/Militar) — ver
// docs/MANUAL_TECNICO.md. Add-on independente do Financeiro
// (Plan.useWeaponDispatch), mesmo padrão de useHR/useFinance.
const useWeaponDispatch = () => {
  const getAccess = async () => {
    const { data } = await api.get("/weapon-dispatch/access");
    return data;
  };

  const catalog = async () => {
    const { data } = await api.get("/weapon-dispatch/catalog");
    return data;
  };

  const clients = {
    list: async (params) => {
      const { data } = await api.get("/weapon-dispatch/clients", { params });
      return data;
    },
    show: async (id) => {
      const { data } = await api.get(`/weapon-dispatch/clients/${id}`);
      return data;
    },
    // Busca combinada em Contatos (Atendimento) + Clientes (Financeiro) —
    // pra preencher a ficha de "Novo cliente" sem recadastrar quem já
    // existe num dos dois. Ver WeaponDispatchClientService.lookupPerson.
    lookup: async (searchParam) => {
      const { data } = await api.get("/weapon-dispatch/clients/lookup", {
        params: { searchParam },
      });
      return data;
    },
    save: async (payload) => {
      const { data } = await api.post("/weapon-dispatch/clients", payload);
      return data;
    },
    update: async (id, payload) => {
      const { data } = await api.put(`/weapon-dispatch/clients/${id}`, payload);
      return data;
    },
    remove: async (id) => {
      const { data } = await api.delete(`/weapon-dispatch/clients/${id}`);
      return data;
    },
    // Upload da foto — só depois do cliente já existir (precisa de um id
    // pra saber em qual pasta/registro gravar). Ver
    // WeaponDispatchClientController.uploadPhoto.
    uploadPhoto: async (id, file) => {
      const formData = new FormData();
      formData.append("photo", file);
      const { data } = await api.post(`/weapon-dispatch/clients/${id}/photo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    setGovPassword: async (id, password) => {
      const { data } = await api.put(`/weapon-dispatch/clients/${id}/gov-password`, { password });
      return data;
    },
    getGovPassword: async (id, reason) => {
      const { data } = await api.post(`/weapon-dispatch/clients/${id}/gov-password/reveal`, { reason });
      return data;
    },
  };

  const processes = {
    list: async (params) => {
      const { data } = await api.get("/weapon-dispatch/processes", { params });
      return data;
    },
    show: async (id) => {
      const { data } = await api.get(`/weapon-dispatch/processes/${id}`);
      return data;
    },
    save: async (payload) => {
      const { data } = await api.post("/weapon-dispatch/processes", payload);
      return data;
    },
    update: async (id, payload) => {
      const { data } = await api.put(`/weapon-dispatch/processes/${id}`, payload);
      return data;
    },
    remove: async (id) => {
      const { data } = await api.delete(`/weapon-dispatch/processes/${id}`);
      return data;
    },
    changeStage: async (id, stage) => {
      const { data } = await api.put(`/weapon-dispatch/processes/${id}/stage`, { stage });
      return data;
    },
  };

  return { getAccess, catalog, clients, processes };
};

export default useWeaponDispatch;
