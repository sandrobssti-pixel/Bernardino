import api from "../../services/api";

// Cadastro de Serviço (v2.3.175) — catálogo simples (código, nome, valor,
// condições de pagamento, descrição, foto), SEM nada fiscal/tributário e
// SEM SKU (pedido do cliente). NÃO é um módulo pago/gated: qualquer usuário
// autenticado usa, mesmo padrão de Tags/Filas. Serve de referência pro
// Despachante Bélico buscar os serviços do cliente — ver
// WeaponDispatchClientModal (fetchServiceOptions) e docs/MANUAL_TECNICO.md.
const useServices = () => {
  const list = async (params) => {
    const { data } = await api.get("/services", { params });
    return data;
  };

  const save = async (payload) => {
    const { data } = await api.post("/services", payload);
    return data;
  };

  const update = async (id, payload) => {
    const { data } = await api.put(`/services/${id}`, payload);
    return data;
  };

  const remove = async (id) => {
    const { data } = await api.delete(`/services/${id}`);
    return data;
  };

  // Foto do serviço — só depois do registro já existir (precisa de um id
  // pra saber em qual pasta/registro gravar). Mesmo padrão de
  // finance.products.uploadPhoto.
  const uploadPhoto = async (id, file) => {
    const formData = new FormData();
    formData.append("photo", file);
    const { data } = await api.post(`/services/${id}/photo`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  };

  return { list, save, update, remove, uploadPhoto };
};

export default useServices;
