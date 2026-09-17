import React, { useState, useEffect } from "react";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import FinanceRecordList from "../FinanceRecordList";

// CRUD de Regras de SLA (ver docs/MANUAL_TECNICO.md) — reaproveita o
// componente genérico já usado no módulo Financeiro. Embutido dentro do
// "Painel" (MomentsUser) via um diálogo de configurações.
const SupervisorSlaRulesPanel = ({ supervisorPanel }) => {
  const [queues, setQueues] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/queue");
        setQueues(Array.isArray(data) ? data : data?.queues || []);
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);

  const columns = [
    { field: "name", label: "Nome" },
    { field: "riskMinutes", label: "Risco de atraso (min)" },
    { field: "overdueMinutes", label: "Fora do prazo (min)" },
    {
      field: "queue",
      label: "Fila",
      render: (record) => record.queue?.name || "Padrão (todas as filas)",
    },
  ];

  const fields = [
    { name: "name", label: "Nome da regra", gridSize: 12 },
    { name: "riskMinutes", label: "Risco de atraso (minutos)", type: "number", defaultValue: 15, gridSize: 6 },
    { name: "overdueMinutes", label: "Fora do prazo (minutos)", type: "number", defaultValue: 20, gridSize: 6 },
    {
      name: "queueId",
      label: "Fila (vazio = padrão da empresa)",
      type: "select",
      gridSize: 12,
      options: [
        { value: "", label: "Padrão (todas as filas)" },
        ...queues.map((q) => ({ value: q.id, label: q.name })),
      ],
    },
  ];

  return (
    <FinanceRecordList
      title="Regra de SLA"
      resource={supervisorPanel.slaRules}
      columns={columns}
      fields={fields}
    />
  );
};

export default SupervisorSlaRulesPanel;
