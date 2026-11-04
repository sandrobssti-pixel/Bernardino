import React from "react";
import Chip from "@material-ui/core/Chip";

// Painel de Desempenho (RH — Fase 3 de 3, ver docs/MANUAL_TECNICO.md) —
// avaliações do gestor, OKRs, feedback 1:1 e matriz de prontidão pra
// promoção. TABELA ÚNICA pros 4 tipos (`recordType`), campos
// condicionados por `visibleWhen` — mesmo padrão já usado em
// `employeeConfig.js` pros 4 regimes de trabalho.

export const RECORD_TYPE_OPTIONS = [
  { value: "evaluation", label: "Avaliação de Desempenho" },
  { value: "okr", label: "OKR (Objetivos e Resultados-Chave)" },
  { value: "feedback_1_1", label: "Feedback 1:1" },
  { value: "promotion_readiness", label: "Matriz de Prontidão pra Promoção" },
];

const RATING_OPTIONS = [
  { value: "1", label: "1 - Insatisfatório" },
  { value: "2", label: "2 - Abaixo do esperado" },
  { value: "3", label: "3 - Dentro do esperado" },
  { value: "4", label: "4 - Acima do esperado" },
  { value: "5", label: "5 - Excepcional" },
];

export const READINESS_LEVEL_OPTIONS = [
  { value: "not_ready", label: "Não pronto" },
  { value: "developing", label: "Em desenvolvimento" },
  { value: "ready_soon", label: "Pronto em breve" },
  { value: "ready_now", label: "Pronto agora" },
];

const READINESS_LEVEL_LABELS = Object.fromEntries(READINESS_LEVEL_OPTIONS.map((o) => [o.value, o.label]));
const READINESS_LEVEL_COLORS = {
  not_ready: "#6b7280",
  developing: "#f59e0b",
  ready_soon: "#3b82f6",
  ready_now: "#10b981",
};

const isEvaluation = (values) => values.recordType === "evaluation";
const isOkr = (values) => values.recordType === "okr";
const isFeedback = (values) => values.recordType === "feedback_1_1";
const isPromotionReadiness = (values) => values.recordType === "promotion_readiness";

const summaryFor = (r) => {
  if (r.recordType === "evaluation") return `Nota geral: ${r.overallRating ?? "—"}`;
  if (r.recordType === "okr") return r.objective ? r.objective.slice(0, 60) : "—";
  if (r.recordType === "feedback_1_1") return r.topics ? r.topics.slice(0, 60) : "—";
  if (r.recordType === "promotion_readiness") return r.targetRole ? `Alvo: ${r.targetRole}` : "—";
  return "—";
};

export const performanceRecordColumns = [
  {
    field: "recordType",
    label: "Tipo",
    render: (r) => RECORD_TYPE_OPTIONS.find((o) => o.value === r.recordType)?.label || r.recordType,
  },
  { field: "recordDate", label: "Data" },
  { field: "summary", label: "Resumo", render: summaryFor },
  {
    field: "readinessLevel",
    label: "Prontidão",
    render: (r) =>
      r.recordType === "promotion_readiness" && r.readinessLevel ? (
        <Chip
          size="small"
          label={READINESS_LEVEL_LABELS[r.readinessLevel] || r.readinessLevel}
          style={{ backgroundColor: READINESS_LEVEL_COLORS[r.readinessLevel] || "#6b7280", color: "#fff" }}
        />
      ) : (
        "—"
      ),
  },
];

export const performanceRecordFields = [
  { name: "recordType", label: "Tipo de registro", type: "select", options: RECORD_TYPE_OPTIONS, gridSize: 6 },
  { name: "recordDate", label: "Data", type: "date", gridSize: 6 },

  // Avaliação de Desempenho.
  { name: "overallRating", label: "Nota geral", type: "select", options: RATING_OPTIONS, gridSize: 4, visibleWhen: isEvaluation },
  { name: "strengths", label: "Pontos fortes", type: "textarea", gridSize: 12, visibleWhen: isEvaluation },
  { name: "improvementAreas", label: "Pontos de melhoria", type: "textarea", gridSize: 12, visibleWhen: isEvaluation },
  { name: "goals", label: "Metas pro próximo período", type: "textarea", gridSize: 12, visibleWhen: isEvaluation },

  // OKR.
  { name: "objective", label: "Objetivo", type: "textarea", gridSize: 12, visibleWhen: isOkr },
  { name: "keyResult1", label: "Resultado-chave 1", gridSize: 8, visibleWhen: isOkr },
  { name: "kr1Progress", label: "Progresso (%)", type: "number", gridSize: 4, visibleWhen: isOkr },
  { name: "keyResult2", label: "Resultado-chave 2", gridSize: 8, visibleWhen: isOkr },
  { name: "kr2Progress", label: "Progresso (%)", type: "number", gridSize: 4, visibleWhen: isOkr },
  { name: "keyResult3", label: "Resultado-chave 3", gridSize: 8, visibleWhen: isOkr },
  { name: "kr3Progress", label: "Progresso (%)", type: "number", gridSize: 4, visibleWhen: isOkr },
  { name: "overallProgress", label: "Progresso geral do OKR (%)", type: "number", gridSize: 6, visibleWhen: isOkr },

  // Feedback 1:1.
  { name: "topics", label: "Assuntos conversados", type: "textarea", gridSize: 12, visibleWhen: isFeedback },
  { name: "actionItems", label: "Combinados / próximos passos", type: "textarea", gridSize: 12, visibleWhen: isFeedback },
  { name: "nextMeetingDate", label: "Próxima conversa", type: "date", gridSize: 6, visibleWhen: isFeedback },

  // Matriz de Prontidão pra Promoção.
  { name: "targetRole", label: "Cargo-alvo da promoção", gridSize: 12, visibleWhen: isPromotionReadiness },
  { name: "technicalSkillScore", label: "Competência técnica", type: "select", options: RATING_OPTIONS, gridSize: 6, visibleWhen: isPromotionReadiness },
  { name: "leadershipScore", label: "Liderança", type: "select", options: RATING_OPTIONS, gridSize: 6, visibleWhen: isPromotionReadiness },
  { name: "communicationScore", label: "Comunicação", type: "select", options: RATING_OPTIONS, gridSize: 6, visibleWhen: isPromotionReadiness },
  { name: "resultsScore", label: "Resultados entregues", type: "select", options: RATING_OPTIONS, gridSize: 6, visibleWhen: isPromotionReadiness },
  { name: "readinessLevel", label: "Nível de prontidão", type: "select", options: READINESS_LEVEL_OPTIONS, gridSize: 12, visibleWhen: isPromotionReadiness },

  // Comum a todos os tipos.
  { name: "notes", label: "Observações gerais", type: "textarea", gridSize: 12 },
];
