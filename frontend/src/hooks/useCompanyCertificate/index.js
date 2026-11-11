import api from "../../services/api";

// Certificado digital A1 (.pfx/.p12) da entidade — usado pra assinar a
// Declaração de Filiação e outros documentos oficiais. Admin-only. Ver
// docs/MANUAL_TECNICO.md.
const useCompanyCertificate = () => {
  const getStatus = async () => {
    const { data } = await api.get("/company/certificate");
    return data;
  };

  const upload = async ({ file, password }) => {
    const formData = new FormData();
    formData.append("certificate", file);
    formData.append("password", password);
    const { data } = await api.post("/company/certificate", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  };

  const remove = async () => {
    const { data } = await api.delete("/company/certificate");
    return data;
  };

  return { getStatus, upload, remove };
};

export default useCompanyCertificate;
