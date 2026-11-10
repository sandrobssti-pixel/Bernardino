import React from "react";
import Avatar from "@material-ui/core/Avatar";
import Chip from "@material-ui/core/Chip";
import PersonIcon from "@material-ui/icons/Person";

// Cadastro de Associados (módulo add-on genérico — Plan.useMembers): quem é
// filiado/sócio/aluno da empresa. "category" é texto livre de propósito
// (não enum fixo) — cada empresa define suas próprias categorias
// ("atirador", "sócio", "aluno"...). Ver docs/MANUAL_TECNICO.md.
const STATUS_LABELS = {
  pending: "Pendente",
  active: "Ativo",
  inactive: "Inativo",
};

const STATUS_COLORS = {
  pending: "default",
  active: "primary",
  inactive: "secondary",
};

export const STATUS_OPTIONS = [
  { value: "pending", label: "Pendente" },
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
];

export const StatusChip = ({ status }) => (
  <Chip
    size="small"
    label={STATUS_LABELS[status] || status}
    color={STATUS_COLORS[status] || "default"}
  />
);

export const memberColumns = [
  {
    field: "photoUrl",
    label: "",
    render: (r) => (
      <Avatar src={r.photoUrl || undefined} style={{ width: 32, height: 32 }}>
        {!r.photoUrl && <PersonIcon fontSize="small" />}
      </Avatar>
    ),
  },
  { field: "code", label: "Código" },
  { field: "name", label: "Nome" },
  { field: "document", label: "CPF" },
  { field: "category", label: "Categoria" },
  { field: "status", label: "Status", render: (r) => <StatusChip status={r.status} /> },
];

export const memberFields = [
  { name: "photoUrl", type: "photo", gridSize: 12 },
  { name: "code", label: "Código", gridSize: 4, disabledWhen: () => true },
  { name: "name", label: "Nome completo", gridSize: 8 },
  { name: "document", label: "CPF", gridSize: 4 },
  { name: "rg", label: "RG", gridSize: 4 },
  { name: "birthDate", label: "Data de nascimento", type: "date", gridSize: 4 },
  { name: "email", label: "E-mail", gridSize: 6 },
  { name: "phone", label: "Telefone", gridSize: 6 },
  { name: "whatsapp", label: "WhatsApp", gridSize: 6 },
  { name: "category", label: "Categoria (ex.: atirador, sócio, aluno)", gridSize: 6 },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: STATUS_OPTIONS,
    defaultValue: "pending",
    gridSize: 12,
  },
  { name: "zipCode", label: "CEP", gridSize: 3 },
  { name: "street", label: "Rua", gridSize: 6 },
  { name: "number", label: "Número", gridSize: 3 },
  { name: "complement", label: "Complemento", gridSize: 4 },
  { name: "neighborhood", label: "Bairro", gridSize: 4 },
  { name: "city", label: "Cidade", gridSize: 4 },
  { name: "state", label: "UF", gridSize: 4 },
  { name: "notes", label: "Observações", type: "textarea", gridSize: 12 },
];
