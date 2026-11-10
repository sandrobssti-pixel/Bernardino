import api from "../../services/api";

// Gerenciador CAC (cadastro de associados/atiradores, reconhecimento
// facial e check-in com geolocalização — nome neutro, pensado pra
// qualquer clube de tiro cliente) — add-on independente
// (Plan.useMembers), mesmo padrão de useFinance/useWeaponDispatch. Ver
// docs/MANUAL_TECNICO.md.
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

  // Vínculo Contato <-> Associado — usado pela aba "Gerenciador CAC" do
  // ContactModal (mesmo padrão de finance.getCustomerByContact/
  // linkContactAsCustomer).
  const getByContact = async (contactId) => {
    const { data } = await api.get(`/members/by-contact/${contactId}`);
    return data;
  };

  const linkFromContact = async (contactId) => {
    const { data } = await api.post(`/members/link-contact/${contactId}`);
    return data;
  };

  // Foto do associado — só depois do registro já existir, mesmo padrão de
  // finance.products.uploadPhoto/services.uploadPhoto. Essa foto também
  // alimenta o enrollment de reconhecimento facial (ver faceRecognition.js).
  const uploadPhoto = async (id, file) => {
    const formData = new FormData();
    formData.append("photo", file);
    const { data } = await api.post(`/members/${id}/photo`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  };

  // Controle de Acesso (reconhecimento facial) — descritor é calculado no
  // navegador (ver utils/faceRecognition.js); aqui só envia/recebe os
  // números, nunca a imagem.
  const setFaceDescriptor = async (id, descriptor) => {
    const { data } = await api.post(`/members/${id}/face-descriptor`, { descriptor });
    return data;
  };

  const checkIn = async (descriptor) => {
    const { data } = await api.post("/members/checkin", { descriptor });
    return data;
  };

  const listCheckIns = async (params) => {
    const { data } = await api.get("/members/checkins", { params });
    return data;
  };

  return {
    getAccess,
    list,
    show,
    save,
    update,
    remove,
    uploadPhoto,
    getByContact,
    linkFromContact,
    setFaceDescriptor,
    checkIn,
    listCheckIns,
  };
};

export default useMembers;
