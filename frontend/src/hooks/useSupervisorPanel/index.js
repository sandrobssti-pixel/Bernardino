import api from "../../services/api";

// Painel Vigia (ver docs/MANUAL_TECNICO.md): monitoramento em tempo real de
// atrasos/risco de atraso no atendimento. Add-on liberado por plano
// (Plan.useSupervisorPanel) + por usuário (User.supervisorPanelAccess),
// mesmo padrão do useFinance/useHR.
const useSupervisorPanel = () => {
  const getAccess = async () => {
    const { data } = await api.get("/supervisor-panel/access");
    return data;
  };

  const getLive = async () => {
    const { data } = await api.get("/supervisor-panel/live");
    return data;
  };

  const getSummary = async () => {
    const { data } = await api.get("/supervisor-panel/summary");
    return data;
  };

  const sendMessage = async ({ ticketId, userId, message }) => {
    const { data } = await api.post("/supervisor-panel/message", {
      ticketId,
      userId,
      message,
    });
    return data;
  };

  const slaRules = {
    list: async (params) => {
      const { data } = await api.get("/sla-rules", { params });
      return { records: data };
    },
    save: async (data) => {
      const { data: responseData } = await api.post("/sla-rules", data);
      return responseData;
    },
    update: async (id, data) => {
      const { data: responseData } = await api.put(`/sla-rules/${id}`, data);
      return responseData;
    },
    remove: async (id) => {
      const { data } = await api.delete(`/sla-rules/${id}`);
      return data;
    },
  };

  const getNotifications = async () => {
    const { data } = await api.get("/notifications");
    return data;
  };

  const deleteNotification = async (id) => {
    const { data } = await api.delete(`/notifications/${id}`);
    return data;
  };

  const clearNotifications = async () => {
    const { data } = await api.delete("/notifications/all");
    return data;
  };

  return {
    getAccess,
    getLive,
    getSummary,
    sendMessage,
    slaRules,
    getNotifications,
    deleteNotification,
    clearNotifications,
  };
};

export default useSupervisorPanel;
