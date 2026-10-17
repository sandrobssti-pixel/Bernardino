import axios from "axios";
import FiscalConfig from "../../models/FiscalConfig";

// API "Empresas" da Focus NFe — gerencia o CADASTRO da empresa em si
// (cpf_cnpj_contabilidade, dados de endereço, séries, etc.), diferente da
// API de emissão (FocusNFeService.ts, que manda cada nota). Autenticada com
// o token de CONTA/master (`focusAccountToken`), não com
// `gatewayTokenSandbox`/`gatewayTokenProduction`. Opera exclusivamente no
// host de produção, mesmo pra empresa que só emite em homologação — é
// cadastro, não documento fiscal (doc.focusnfe.com.br/reference/empresas).
const EMPRESAS_BASE_URL = "https://api.focusnfe.com.br";

// Hoje só existe pra sincronizar o escritório de contabilidade (rejeição
// Sefaz 487, ver FiscalConfigService.update) — reaproveitável pra
// qualquer outro campo de nível empresa que precise ser editado por aqui
// no futuro.
export const updateAccountingOffice = async (
  config: FiscalConfig,
  document: string
): Promise<{ ok: boolean; errorMessage: string }> => {
  if (!config.focusAccountToken || !config.focusCompanyId) {
    return {
      ok: false,
      errorMessage:
        "Token de conta ou ID da empresa na Focus não configurados — não foi possível sincronizar o escritório de contabilidade lá."
    };
  }

  try {
    await axios.put(
      `${EMPRESAS_BASE_URL}/v2/empresas/${config.focusCompanyId}`,
      { cpf_cnpj_contabilidade: (document || "").replace(/\D/g, "") },
      {
        auth: { username: config.focusAccountToken, password: "" },
        headers: { "Content-Type": "application/json" },
        timeout: 30000
      }
    );
    return { ok: true, errorMessage: "" };
  } catch (err: any) {
    return {
      ok: false,
      errorMessage:
        err?.response?.data?.mensagem || err?.message || "Falha ao sincronizar o escritório de contabilidade com a Focus NFe."
    };
  }
};
