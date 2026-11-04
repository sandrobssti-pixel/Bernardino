import React from "react";
import Avatar from "@material-ui/core/Avatar";
import Chip from "@material-ui/core/Chip";
import ImageIcon from "@material-ui/icons/Image";

// Cadastro de Sócios (RH, ver docs/MANUAL_TECNICO.md). Sócio NÃO é
// Funcionário — sem regime CLT/PJ/Estagiário/Menor Aprendiz, sem
// vínculo empregatício. Mesmo padrão de tela/config declarativa de
// pages/Employees/employeeConfig.js. `prolaboreValue` é só cadastro —
// não entra ainda no motor de cálculo de folha (ver
// backend/src/services/CompanyPartnerService/CompanyPartnerService.ts).

export const PARTNER_STATUS_OPTIONS = [
  { value: "active", label: "Ativo" },
  { value: "withdrawn", label: "Retirado da sociedade" },
];

const PARTNER_STATUS_COLORS = { active: "primary", withdrawn: "default" };

export const companyPartnerColumns = [
  {
    field: "photoUrl",
    label: "",
    render: (r) => (
      <Avatar src={r.photoUrl || undefined} style={{ width: 32, height: 32 }}>
        {!r.photoUrl && <ImageIcon fontSize="small" />}
      </Avatar>
    ),
  },
  { field: "name", label: "Nome" },
  {
    field: "ownershipPercentage",
    label: "Participação",
    render: (r) => (r.ownershipPercentage != null ? `${r.ownershipPercentage}%` : "—"),
  },
  {
    field: "isAdministrator",
    label: "Administrador",
    render: (r) => (r.isAdministrator ? "Sim" : "Não"),
  },
  {
    field: "partnerStatus",
    label: "Status",
    render: (r) => (
      <Chip
        size="small"
        label={PARTNER_STATUS_OPTIONS.find((o) => o.value === r.partnerStatus)?.label || r.partnerStatus}
        color={PARTNER_STATUS_COLORS[r.partnerStatus] || "default"}
        variant={r.partnerStatus === "active" ? "default" : "outlined"}
      />
    ),
  },
];

export const companyPartnerFields = [
  { name: "photoUrl", type: "photo", gridSize: 12 },
  { name: "name", label: "Nome completo", gridSize: 8 },
  { name: "partnerStatus", label: "Status na sociedade", type: "select", options: PARTNER_STATUS_OPTIONS, defaultValue: "active", gridSize: 4 },

  // --- Documentos ---
  { name: "cpf", label: "CPF", gridSize: 4 },
  { name: "rg", label: "RG", gridSize: 4 },

  // --- Contato ---
  { name: "email", label: "E-mail", gridSize: 6 },
  { name: "phone", label: "Telefone", gridSize: 6 },

  // --- Endereço ---
  { name: "zipCode", label: "CEP", gridSize: 3 },
  { name: "street", label: "Rua", gridSize: 6 },
  { name: "number", label: "Número", gridSize: 3 },
  { name: "complement", label: "Complemento", gridSize: 4 },
  { name: "neighborhood", label: "Bairro", gridSize: 4 },
  { name: "city", label: "Cidade", gridSize: 4 },
  { name: "state", label: "UF", gridSize: 4 },

  // --- Dados bancários ---
  { name: "bankName", label: "Banco", gridSize: 4 },
  { name: "bankAgency", label: "Agência", gridSize: 4 },
  { name: "bankAccount", label: "Conta", gridSize: 4 },
  { name: "bankAccountType", label: "Tipo de conta", type: "select", options: [
      { value: "checking", label: "Conta Corrente" },
      { value: "savings", label: "Poupança" },
    ], gridSize: 6 },
  { name: "pixKey", label: "Chave PIX", gridSize: 6 },

  // --- Sociedade ---
  { name: "partnershipStartDate", label: "Data de entrada na sociedade", type: "date", gridSize: 4 },
  { name: "partnershipEndDate", label: "Data de saída da sociedade", type: "date", gridSize: 4 },
  { name: "ownershipPercentage", label: "Participação societária (%)", type: "number", step: "0.01", gridSize: 4 },
  { name: "isAdministrator", label: "Sócio-administrador", type: "switch", defaultValue: false, gridSize: 6 },
  {
    name: "prolaboreValue",
    label: "Valor do Pró-labore (R$)",
    type: "currency",
    gridSize: 6,
  },
];
