import moment from "moment";
import formatToCurrency from "./formatToCurrency";

// Helpers de formatação compartilhados pelo módulo Financeiro (telas de
// cadastro, listas e o Painel com gráficos) — ver docs/MANUAL_TECNICO.md,
// seção 6.2.
export const money = (value) => formatToCurrency(Number(value) || 0);

export const formatDateBR = (value) => (value ? moment(value).format("DD/MM/YYYY") : "—");
