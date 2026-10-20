import api from "../../services/api";

// Serviço Armaria (v2.3.178) — recebimento de arma pra manutenção/conserto
// (Termo de Cautela). Add-on independente do Despachante Bélico
// (Plan.useWeaponArmory), mesmo padrão de useWeaponDispatch.
const useWeaponArmory = () => {
  const getAccess = async () => {
    const { data } = await api.get("/weapon-armory/access");
    return data;
  };

  const services = {
    list: async (params) => {
      const { data } = await api.get("/weapon-armory/services", { params });
      return data;
    },
    show: async (id) => {
      const { data } = await api.get(`/weapon-armory/services/${id}`);
      return data;
    },
    // Busca combinada em Contatos (Atendimento) + Clientes (Financeiro) —
    // mesma lógica já usada no Despachante Bélico. Ver
    // WeaponDispatchClientService.lookupPerson.
    lookup: async (searchParam) => {
      const { data } = await api.get("/weapon-armory/services/lookup", {
        params: { searchParam },
      });
      return data;
    },
    save: async (payload) => {
      const { data } = await api.post("/weapon-armory/services", payload);
      return data;
    },
    update: async (id, payload) => {
      const { data } = await api.put(`/weapon-armory/services/${id}`, payload);
      return data;
    },
    remove: async (id) => {
      const { data } = await api.delete(`/weapon-armory/services/${id}`);
      return data;
    },
    // Fotos antes/depois — vários arquivos por vez, `stage` decide qual
    // array (ver WeaponArmoryServiceController.uploadPhotos).
    uploadPhotos: async (id, files, stage) => {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("photos", file));
      formData.append("stage", stage);
      const { data } = await api.post(`/weapon-armory/services/${id}/photos`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    removePhoto: async (id, stage, url) => {
      const { data } = await api.delete(`/weapon-armory/services/${id}/photos`, {
        data: { stage, url },
      });
      return data;
    },
  };

  return { getAccess, services };
};

export default useWeaponArmory;
