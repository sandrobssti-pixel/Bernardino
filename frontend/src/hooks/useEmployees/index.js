import api from "../../services/api";

// Cadastro de Funcionários (RH — Fase 1 de 3, ver docs/MANUAL_TECNICO.md).
// Funcionário NÃO tem login nem acesso ao sistema — é só um registro de
// dados de RH. Mesmo formato de hook de recurso já usado por useServices
// (list/save/update/remove/uploadPhoto), consumido pelo
// FinanceRecordList/FinanceRecordModal genéricos (ver
// frontend/src/pages/Employees/index.js).
const useEmployees = () => {
  const list = async (params) => {
    const { data } = await api.get("/employees", { params });
    return data;
  };

  const show = async (id) => {
    const { data } = await api.get(`/employees/${id}`);
    return data;
  };

  const save = async (payload) => {
    const { data } = await api.post("/employees", payload);
    return data;
  };

  const update = async (id, payload) => {
    const { data } = await api.put(`/employees/${id}`, payload);
    return data;
  };

  const remove = async (id) => {
    const { data } = await api.delete(`/employees/${id}`);
    return data;
  };

  // Foto do funcionário — só depois do registro já existir. Mesmo padrão
  // de useServices.uploadPhoto.
  const uploadPhoto = async (id, file) => {
    const formData = new FormData();
    formData.append("photo", file);
    const { data } = await api.post(`/employees/${id}/photo-upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  };

  // Dependentes do Funcionário (RH — Fase 2) — usados pra dedução do
  // IRRF na Folha Mensal (ver usePayroll).
  const dependents = {
    list: async (employeeId) => {
      const { data } = await api.get(`/employees/${employeeId}/dependents`);
      return data;
    },
    save: async (employeeId, payload) => {
      const { data } = await api.post(`/employees/${employeeId}/dependents`, payload);
      return data;
    },
    update: async (employeeId, id, payload) => {
      const { data } = await api.put(`/employees/${employeeId}/dependents/${id}`, payload);
      return data;
    },
    remove: async (employeeId, id) => {
      const { data } = await api.delete(`/employees/${employeeId}/dependents/${id}`);
      return data;
    },
  };

  return { list, show, save, update, remove, uploadPhoto, dependents };
};

export default useEmployees;
