import React from "react";
import Avatar from "@material-ui/core/Avatar";
import ImageIcon from "@material-ui/icons/Image";

import { ActiveChip } from "../../components/FinanceRecordList";

// Cadastro de Serviço (v2.3.175) — catálogo simples usado como referência
// pelo Despachante Bélico (e por qualquer outro módulo que precise de
// serviços com valor/descrição). Propositalmente SEM campos fiscais/SKU —
// ver docs/MANUAL_TECNICO.md.
export const serviceColumns = [
  {
    field: "photoUrl",
    label: "",
    render: (r) => (
      <Avatar src={r.photoUrl || undefined} style={{ width: 32, height: 32 }}>
        {!r.photoUrl && <ImageIcon fontSize="small" />}
      </Avatar>
    ),
  },
  { field: "code", label: "Código" },
  { field: "name", label: "Nome do serviço" },
  { field: "value", label: "Valor (R$)" },
  { field: "active", label: "Status", render: (r) => <ActiveChip active={r.active} /> },
];

export const serviceFields = [
  { name: "photoUrl", type: "photo", gridSize: 12 },
  { name: "code", label: "Código do serviço", gridSize: 4 },
  { name: "name", label: "Nome do serviço", gridSize: 8 },
  { name: "value", label: "Valor (R$)", type: "number", step: "0.01", defaultValue: "0", gridSize: 6 },
  { name: "paymentTerms", label: "Condições de pagamento", gridSize: 6 },
  { name: "description", label: "Descrição do serviço", type: "textarea", gridSize: 12 },
  { name: "active", label: "Serviço ativo", type: "switch", defaultValue: true, gridSize: 6 },
];
