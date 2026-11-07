import moment from "moment";

// Filtro de período (Hoje/Semana/Mês/Personalizado) reaproveitado em todo
// lugar que filtra lista por data (Vendas, Contas a Pagar/Receber) —
// resolve o preset pra um par startDate/endDate ("YYYY-MM-DD") que o
// backend já sabe filtrar. "custom" usa as datas digitadas pelo usuário
// direto, sem conversão. Antes vivia só em SaleList/index.js.
export const PERIOD_OPTIONS = [
  { value: "", label: "Todo o período" },
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
  { value: "custom", label: "Período personalizado" },
];

export const resolvePeriodRange = (preset, customStart, customEnd) => {
  if (preset === "today") {
    const today = moment().format("YYYY-MM-DD");
    return { startDate: today, endDate: today };
  }
  if (preset === "week") {
    return {
      startDate: moment().startOf("week").format("YYYY-MM-DD"),
      endDate: moment().endOf("week").format("YYYY-MM-DD"),
    };
  }
  if (preset === "month") {
    return {
      startDate: moment().startOf("month").format("YYYY-MM-DD"),
      endDate: moment().endOf("month").format("YYYY-MM-DD"),
    };
  }
  if (preset === "custom") {
    return { startDate: customStart || undefined, endDate: customEnd || undefined };
  }
  return {};
};
