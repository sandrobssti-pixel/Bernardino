import api, { openApi } from "../../services/api";

// Módulo de RH/recrutamento (Fase 5 — ver docs/MANUAL_TECNICO.md, seção
// 6.2): vagas públicas + candidaturas com anexo de currículo + efetivação.
// Add-on independente do Financeiro/Fiscal (Plan.useHR). As chamadas
// "públicas" (página de vagas, sem login) usam `openApi` (sem
// withCredentials/interceptor de sessão) — a mesma instância já usada em
// Login/Signup — pra não arriscar efeito colateral de auth numa página
// aberta a candidatos anônimos.
const useHR = () => {
  const getAccess = async () => {
    const { data } = await api.get("/hr/access");
    return data;
  };

  const jobPostings = {
    list: async (params) => {
      const { data } = await api.get("/job-postings", { params });
      return data;
    },
    show: async (id) => {
      const { data } = await api.get(`/job-postings/${id}`);
      return data;
    },
    save: async (data) => {
      const { data: responseData } = await api.post("/job-postings", data);
      return responseData;
    },
    update: async (id, data) => {
      const { data: responseData } = await api.put(`/job-postings/${id}`, data);
      return responseData;
    },
    remove: async (id) => {
      const { data } = await api.delete(`/job-postings/${id}`);
      return data;
    },
  };

  const jobApplications = {
    list: async (params) => {
      const { data } = await api.get("/job-applications", { params });
      return data;
    },
    show: async (id) => {
      const { data } = await api.get(`/job-applications/${id}`);
      return data;
    },
    update: async (id, data) => {
      const { data: responseData } = await api.put(`/job-applications/${id}`, data);
      return responseData;
    },
    remove: async (id) => {
      const { data } = await api.delete(`/job-applications/${id}`);
      return data;
    },
    hire: async (id) => {
      const { data } = await api.post(`/job-applications/${id}/hire`);
      return data;
    },
  };

  // Público — página de vagas da empresa (sem login).
  const publicJobs = {
    list: async (companyId) => {
      const { data } = await openApi.get(`/public/job-postings/${companyId}`);
      return data;
    },
    show: async (companyId, id) => {
      const { data } = await openApi.get(`/public/job-postings/${companyId}/${id}`);
      return data;
    },
    apply: async (companyId, id, formData) => {
      const { data } = await openApi.post(
        `/public/job-postings/${companyId}/${id}/apply`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return data;
    },
  };

  return { getAccess, jobPostings, jobApplications, publicJobs };
};

export default useHR;
