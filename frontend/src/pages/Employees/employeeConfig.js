import React from "react";
import Avatar from "@material-ui/core/Avatar";
import Chip from "@material-ui/core/Chip";
import ImageIcon from "@material-ui/icons/Image";

// Cadastro de Funcionários (RH — Fase 1 de 3, ver docs/MANUAL_TECNICO.md).
// Funcionário NÃO tem login nem acesso ao sistema — é só um registro de
// dados de RH. Tabela larga: os campos específicos de cada regime
// (CLT/PJ/Estagiário/Menor Aprendiz) ficam todos aqui, mostrados só quando
// `workRegime` combina (`visibleWhen`) — mesmo padrão já usado em
// Produto/Serviço (ver pages/Financeiro/financeConfig.js).

export const WORK_REGIME_OPTIONS = [
  { value: "clt", label: "CLT" },
  { value: "pj", label: "PJ (Prestador de Serviços)" },
  { value: "intern", label: "Estagiário" },
  { value: "young_apprentice", label: "Menor Aprendiz" },
];

export const CONTRACT_STATUS_OPTIONS = [
  { value: "active", label: "Ativo" },
  { value: "leave", label: "Afastado" },
  { value: "terminated", label: "Desligado" },
];

const BANK_ACCOUNT_TYPE_OPTIONS = [
  { value: "checking", label: "Conta Corrente" },
  { value: "savings", label: "Poupança" },
];

// Banco de horas — pedido do cliente: a política decide se o saldo de
// horas é remunerado em dinheiro, viram folga (sem dinheiro envolvido),
// ou se nem existe banco e a empresa paga a hora extra direto.
export const OVERTIME_POLICY_OPTIONS = [
  { value: "hour_bank_paid", label: "Banco de horas remunerado" },
  { value: "hour_bank_time_off", label: "Banco de horas por folga (não remunerado)" },
  { value: "paid_overtime", label: "Pagar hora extra diretamente (sem banco)" },
];

const WORK_REGIME_LABELS = Object.fromEntries(WORK_REGIME_OPTIONS.map((o) => [o.value, o.label]));
const CONTRACT_STATUS_COLORS = { active: "primary", leave: "default", terminated: "default" };

const isCltOrApprentice = (values) => values.workRegime === "clt" || values.workRegime === "young_apprentice";
const isPj = (values) => values.workRegime === "pj";
const isIntern = (values) => values.workRegime === "intern";
// Valor em dinheiro só faz sentido quando a política envolve pagamento
// (banco remunerado ou hora extra paga direto) — folga não remunerada não
// tem valor, só saldo de horas.
const hasOvertimeValue = (values) =>
  isCltOrApprentice(values) &&
  (values.overtimePolicy === "hour_bank_paid" || values.overtimePolicy === "paid_overtime");
// Saldo de horas só faz sentido quando existe banco de horas de verdade
// (remunerado ou por folga) — "pagar hora extra direto" não acumula saldo.
const hasOvertimeBalance = (values) =>
  isCltOrApprentice(values) &&
  (values.overtimePolicy === "hour_bank_paid" || values.overtimePolicy === "hour_bank_time_off");

export const employeeColumns = [
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
    field: "workRegime",
    label: "Regime",
    render: (r) => WORK_REGIME_LABELS[r.workRegime] || r.workRegime,
  },
  {
    field: "roleOrCompany",
    label: "Cargo / Razão Social",
    render: (r) => r.role || r.companyName || (r.workRegime === "intern" ? r.course : "") || "—",
  },
  { field: "manager", label: "Gestor", render: (r) => r.manager?.name || "—" },
  {
    field: "contractStatus",
    label: "Status",
    render: (r) => (
      <Chip
        size="small"
        label={CONTRACT_STATUS_OPTIONS.find((o) => o.value === r.contractStatus)?.label || r.contractStatus}
        color={CONTRACT_STATUS_COLORS[r.contractStatus] || "default"}
        variant={r.contractStatus === "active" ? "default" : "outlined"}
      />
    ),
  },
];

export const employeeFields = [
  { name: "photoUrl", type: "photo", gridSize: 12 },
  { name: "name", label: "Nome completo", gridSize: 8 },
  { name: "workRegime", label: "Regime de trabalho", type: "select", options: WORK_REGIME_OPTIONS, defaultValue: "clt", gridSize: 4 },
  { name: "contractStatus", label: "Status do contrato", type: "select", options: CONTRACT_STATUS_OPTIONS, defaultValue: "active", gridSize: 4 },
  {
    name: "managerId",
    label: "Gestor / Supervisor responsável",
    type: "asyncSelect",
    optionsResource: "users",
    embeddedKey: "manager",
    gridSize: 8,
  },

  // --- Documentos ---
  { name: "cpf", label: "CPF", gridSize: 4 },
  { name: "rg", label: "RG", gridSize: 4 },
  { name: "pisPasep", label: "PIS/PASEP", gridSize: 4 },
  { name: "voterTitle", label: "Título de Eleitor", gridSize: 4 },

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
  { name: "bankAccountType", label: "Tipo de conta", type: "select", options: BANK_ACCOUNT_TYPE_OPTIONS, gridSize: 6 },
  { name: "pixKey", label: "Chave PIX", gridSize: 6 },

  // --- CLT / Menor Aprendiz ---
  { name: "ctps", label: "Carteira de Trabalho (CTPS)", gridSize: 4, visibleWhen: isCltOrApprentice },
  { name: "ctpsSeries", label: "Série / UF da CTPS", gridSize: 4, visibleWhen: isCltOrApprentice },
  { name: "role", label: "Cargo / Função", gridSize: 4, visibleWhen: isCltOrApprentice },
  { name: "admissionDate", label: "Data de Admissão", type: "date", gridSize: 4, visibleWhen: isCltOrApprentice },
  { name: "terminationDate", label: "Data de Desligamento", type: "date", gridSize: 4, visibleWhen: isCltOrApprentice },
  { name: "grossSalary", label: "Salário Bruto (R$)", type: "currency", gridSize: 4, visibleWhen: isCltOrApprentice },
  { name: "weeklyHours", label: "Jornada Semanal (horas)", type: "number", step: "0.5", gridSize: 4, visibleWhen: isCltOrApprentice },
  { name: "transportVoucher", label: "Vale Transporte", type: "switch", defaultValue: false, gridSize: 4, visibleWhen: isCltOrApprentice },
  { name: "mealVoucher", label: "Vale Refeição", type: "switch", defaultValue: false, gridSize: 4, visibleWhen: isCltOrApprentice },
  {
    name: "mealVoucherValue",
    label: "Valor do Vale Refeição (R$)",
    type: "currency",
    gridSize: 4,
    visibleWhen: (values) => isCltOrApprentice(values) && !!values.mealVoucher,
  },

  // --- Benefícios (CLT / Menor Aprendiz) ---
  { name: "healthInsurance", label: "Plano de Saúde", type: "switch", defaultValue: false, gridSize: 4, visibleWhen: isCltOrApprentice },
  {
    name: "healthInsuranceValue",
    label: "Valor do Plano de Saúde (R$)",
    type: "currency",
    gridSize: 4,
    visibleWhen: (values) => isCltOrApprentice(values) && !!values.healthInsurance,
  },
  { name: "foodVoucher", label: "Vale Alimentação", type: "switch", defaultValue: false, gridSize: 4, visibleWhen: isCltOrApprentice },
  {
    name: "foodVoucherValue",
    label: "Valor do Vale Alimentação (R$)",
    type: "currency",
    gridSize: 4,
    visibleWhen: (values) => isCltOrApprentice(values) && !!values.foodVoucher,
  },

  // --- Banco de horas (CLT / Menor Aprendiz) ---
  {
    name: "overtimePolicy",
    label: "Banco de horas / hora extra",
    type: "select",
    options: OVERTIME_POLICY_OPTIONS,
    gridSize: 6,
    visibleWhen: isCltOrApprentice,
  },
  {
    name: "overtimeHourValue",
    label: "Valor da hora extra (R$)",
    type: "currency",
    gridSize: 3,
    visibleWhen: hasOvertimeValue,
  },
  {
    name: "overtimeHoursBalance",
    label: "Saldo atual do banco de horas",
    type: "number",
    step: "0.5",
    gridSize: 3,
    visibleWhen: hasOvertimeBalance,
  },

  // --- PJ ---
  { name: "companyName", label: "Razão Social", gridSize: 6, visibleWhen: isPj },
  { name: "cnpj", label: "CNPJ", gridSize: 6, visibleWhen: isPj },
  { name: "municipalRegistration", label: "Inscrição Municipal", gridSize: 6, visibleWhen: isPj },
  { name: "monthlyContractValue", label: "Valor do Contrato Mensal (R$)", type: "currency", gridSize: 6, visibleWhen: isPj },
  { name: "contractStartDate", label: "Início do Contrato", type: "date", gridSize: 6, visibleWhen: isPj },
  { name: "contractEndDate", label: "Fim do Contrato", type: "date", gridSize: 6, visibleWhen: isPj },
  { name: "contractScope", label: "Objeto do Contrato (escopo resumido)", type: "textarea", gridSize: 12, visibleWhen: isPj },

  // --- Estagiário ---
  { name: "school", label: "Instituição de Ensino", gridSize: 6, visibleWhen: isIntern },
  { name: "course", label: "Curso", gridSize: 6, visibleWhen: isIntern },
  { name: "stipendValue", label: "Valor da Bolsa-Auxílio (R$)", type: "currency", gridSize: 6, visibleWhen: isIntern },
  { name: "transportAidValue", label: "Valor do Auxílio Transporte (R$)", type: "currency", gridSize: 6, visibleWhen: isIntern },
  { name: "internshipStartDate", label: "Início do Estágio", type: "date", gridSize: 6, visibleWhen: isIntern },
  { name: "internshipEndDate", label: "Término do Estágio", type: "date", gridSize: 6, visibleWhen: isIntern },
  { name: "lifeInsurancePolicy", label: "Apólice de Seguro de Vida", gridSize: 6, visibleWhen: isIntern },
];
