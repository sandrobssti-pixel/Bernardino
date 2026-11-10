import api from "../../services/api";

// Módulo Associados (cadastro de membros/filiados, reconhecimento facial e
// check-in com geolocalização — genérico, não específico de clube de tiro)
// — add-on independente (Plan.useMembers), mesmo padrão de
// useFinance/useWeaponDispatch. Ver docs/MANUAL_TECNICO.md.
const useMembers = () => {
  const getAccess = async () => {
    const { data } = await api.get("/members/access");
    return data;
  };

  const list = async (params) => {
    const { data } = await api.get("/members", { params });
    return data;
  };

  const show = async (id) => {
    const { data } = await api.get(`/members/${id}`);
    return data;
  };

  const save = async (payload) => {
    const { data } = await api.post("/members", payload);
    return data;
  };

  const update = async (id, payload) => {
    const { data } = await api.put(`/members/${id}`, payload);
    return data;
  };

  const remove = async (id) => {
    const { data } = await api.delete(`/members/${id}`);
    return data;
  };

  // Foto do associado — só depois do registro já existir, mesmo padrão de
  // finance.products.uploadPhoto/services.uploadPhoto. Essa foto também
  // alimenta o enrollment de reconhecimento facial (fase futura).
  const uploadPhoto = async (id, file) => {
    const formData = new FormData();
    formData.append("photo", file);
    const { data } = await api.post(`/members/${id}/photo`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  };

  return { getAccess, list, show, save, update, remove, uploadPhoto };
};

export default useMembers;
