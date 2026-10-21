import moment from "moment";
import formatToCurrency from "./formatToCurrency";

// Helpers de formatação compartilhados pelo módulo Financeiro (telas de
// cadastro, listas e o Painel com gráficos) — ver docs/MANUAL_TECNICO.md,
// seção 6.2.
export const money = (value) => formatToCurrency(Number(value) || 0);

export const formatDateBR = (value) => (value ? moment(value).format("DD/MM/YYYY") : "—");

// Endereço completo do emitente, mesmo formato da nota fiscal real que o
// cliente mandou de referência (ex.: "RUA ESPATODEAS ROXAS, 298 - JARDIM
// DAS MARGARIDAS - SALVADOR - BA - CEP: 41502-445") — monta a partir do
// endereço já cadastrado em Configuração Fiscal (FiscalConfig), nunca
// fixo no código (sistema multiempresa). Mesma lógica que já existia
// isolada em FinancePainel.js, compartilhada aqui (v2.3.184) porque
// passou a ser usada também nos relatórios de Serviços/Clientes/
// Fornecedores/Produtos/Contas e no Termo de Cautela do Serviço Armaria.
export const buildEmitterAddressLine = (config) => {
  if (!config) return "";
  const parts = [];
  if (config.emitterStreet) {
    parts.push(`${config.emitterStreet}${config.emitterNumber ? `, ${config.emitterNumber}` : ""}`);
  }
  if (config.emitterNeighborhood) parts.push(config.emitterNeighborhood);
  const cityState = [config.emitterCity, config.emitterState].filter(Boolean).join(" - ");
  if (cityState) parts.push(cityState);
  let line = parts.join(" - ");
  if (config.emitterZipCode) {
    line = line ? `${line} - CEP: ${config.emitterZipCode}` : `CEP: ${config.emitterZipCode}`;
  }
  return line;
};
