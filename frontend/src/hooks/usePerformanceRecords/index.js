import api from "../../services/api";

// Painel de Desempenho (RH — Fase 3 de 3, ver docs/MANUAL_TECNICO.md) —
// avaliações, OKRs, feedback 1:1 e matriz de prontidão pra promoção.
// Acesso restrito por funcionário (Admin/Master ou gestor daquele
// funcionário específico) — `listEmployees` já devolve só quem o
// usuário logado pode ver.
const usePerformanceRecords = () => {
  const listEmployees = async () => {
    const { data } = await api.get("/performance-records/employees");
    return data;
  };

  const list = async (params) => {
    const { data } = await api.get("/performance-records", { params });
    return data;
  };

  const save = async (payload) => {
    const { data } = await api.post("/performance-records", payload);
    return data;
  };

  const update = async (id, payload) => {
    const { data } = await api.put(`/performance-records/${id}`, payload);
    return data;
  };

  const remove = async (id) => {
    const { data } = await api.delete(`/performance-records/${id}`);
    return data;
  };

  return { listEmployees, list, save, update, remove };
};

export default usePerformanceRecords;
