import { openApi } from "../../services/api";

// Portal do Associado (Gerenciador CAC) — token PRÓPRIO do associado,
// separado do token de equipe/Admin do AtendeFlow (que vive no
// AuthContext/localStorage via outra chave). Usa `openApi` (sem
// interceptor de sessão de equipe) e anexa o Authorization manualmente
// em cada chamada autenticada, pra nunca arriscar misturar as duas
// sessões no mesmo navegador. Ver docs/MANUAL_TECNICO.md.
const TOKEN_KEY = "memberPortalToken";
const MEMBER_KEY = "memberPortalMember";

export const getMemberPortalToken = () => localStorage.getItem(TOKEN_KEY);

export const getMemberPortalMember = () => {
  try {
    const raw = localStorage.getItem(MEMBER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
};

export const clearMemberPortalSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(MEMBER_KEY);
};

const useMemberPortal = () => {
  const login = async ({ document, pin }) => {
    const { data } = await openApi.post("/member-portal/login", { document, pin });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(MEMBER_KEY, JSON.stringify(data.member));
    return data.member;
  };

  const logout = () => clearMemberPortalSession();

  // Foto do livro + geolocalização (sempre obrigatórios) + descritor
  // facial (opcional — só quando o associado já tem reconhecimento
  // facial cadastrado, ver faceEnrolled no retorno do login).
  const submitHabitualidade = async ({ logbookPhoto, latitude, longitude, descriptor }) => {
    const token = getMemberPortalToken();
    const formData = new FormData();
    formData.append("logbookPhoto", logbookPhoto);
    formData.append("latitude", latitude);
    formData.append("longitude", longitude);
    if (descriptor) {
      formData.append("descriptor", JSON.stringify(descriptor));
    }
    const { data } = await openApi.post("/member-portal/checkin", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${token}`,
      },
    });
    return data;
  };

  return { login, logout, submitHabitualidade };
};

export default useMemberPortal;
