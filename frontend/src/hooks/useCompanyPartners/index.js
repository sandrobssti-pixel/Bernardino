import api from "../../services/api";

// Cadastro de Sócios (RH, ver docs/MANUAL_TECNICO.md). Sócio NÃO é
// Funcionário — sem login nem acesso ao sistema, é só um registro de
// RH. Rota "/company-partners" (não "/partners") pra não colidir com
// o model `Partner` já existente no projeto (parceiro de
// indicação/comissão, outro conceito). Mesmo formato de hook de
// recurso já usado por useEmployees (list/save/update/remove/
// uploadPhoto), consumido pelo FinanceRecordList/FinanceRecordModal
// genéricos.
const useCompanyPartners = () => {
  const list = async (params) => {
    const { data } = await api.get("/company-partners", { params });
    return data;
  };

  const show = async (id) => {
    const { data } = await api.get(`/company-partners/${id}`);
    return data;
  };

  const save = async (payload) => {
    const { data } = await api.post("/company-partners", payload);
    return data;
  };

  const update = async (id, payload) => {
    const { data } = await api.put(`/company-partners/${id}`, payload);
    return data;
  };

  const remove = async (id) => {
    const { data } = await api.delete(`/company-partners/${id}`);
    return data;
  };

  // Foto do sócio — só depois do registro já existir. Mesmo padrão de
  // useEmployees.uploadPhoto.
  const uploadPhoto = async (id, file) => {
    const formData = new FormData();
    formData.append("photo", file);
    const { data } = await api.post(`/company-partners/${id}/photo-upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  };

  return { list, show, save, update, remove, uploadPhoto };
};

export default useCompanyPartners;
