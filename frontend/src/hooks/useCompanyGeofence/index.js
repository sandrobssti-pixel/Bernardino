import api from "../../services/api";

// Coordenada + raio do clube — usado pra aprovar automaticamente a
// entrada de habitualidade (Gerenciador CAC, Fase 4). Admin-only. Ver
// docs/MANUAL_TECNICO.md.
const useCompanyGeofence = () => {
  const getSettings = async () => {
    const { data } = await api.get("/company/geofence");
    return data;
  };

  const updateSettings = async ({ latitude, longitude, radiusMeters }) => {
    const { data } = await api.put("/company/geofence", {
      latitude,
      longitude,
      radiusMeters,
    });
    return data;
  };

  const removeSettings = async () => {
    const { data } = await api.delete("/company/geofence");
    return data;
  };

  return { getSettings, updateSettings, removeSettings };
};

export default useCompanyGeofence;
