import React from "react";
import Chip from "@material-ui/core/Chip";
import moment from "moment";
import { ActiveChip } from "../../components/FinanceRecordList";
import { money, formatDateBR } from "../../utils/financeFormat";

// Configuração declarativa das colunas (tabela) e campos (modal de
// cadastro/edição) dos cadastros do módulo Financeiro — Fase 1 do roadmap.
// Ver docs/MANUAL_TECNICO.md, seção 6.2.

// CPF/CNPJ (Brasil) e RUC — Registro Único de Contribuyentes (Paraguai).
const DOCUMENT_TYPE_OPTIONS = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "ruc", label: "RUC (Paraguai)" },
];

const ADDRESS_FIELDS = [
  { name: "zipCode", label: "CEP", gridSize: 4 },
  { name: "street", label: "Rua", gridSize: 8 },
  { name: "number", label: "Número", gridSize: 4 },
  { name: "complement", label: "Complemento", gridSize: 8 },
  { name: "neighborhood", label: "Bairro", gridSize: 6 },
  { name: "city", label: "Cidade", gridSize: 4 },
  { name: "state", label: "UF", gridSize: 2 },
];

export const financeCustomerColumns = [
  { field: "name", label: "Nome" },
  { field: "document", label: "CPF/CNPJ" },
  { field: "email", label: "E-mail" },
  { field: "phone", label: "Telefone" },
  { field: "active", label: "Status", render: (r) => <ActiveChip active={r.active} /> },
];

export const financeCustomerFields = [
  { name: "name", label: "Nome do cliente", gridSize: 8 },
  { name: "documentType", label: "Tipo de documento", type: "select", options: DOCUMENT_TYPE_OPTIONS, gridSize: 4 },
  { name: "document", label: "CPF/CNPJ", gridSize: 6 },
  { name: "email", label: "E-mail", gridSize: 6 },
  { name: "phone", label: "Telefone", gridSize: 6 },
  { name: "active", label: "Cliente ativo", type: "switch", defaultValue: true, gridSize: 6 },
  ...ADDRESS_FIELDS,
  { name: "notes", label: "Observações", type: "textarea", gridSize: 12 },
];

export const financeSupplierColumns = [
  { field: "name", label: "Nome / Razão social" },
  { field: "document", label: "CPF/CNPJ" },
  { field: "contactName", label: "Contato" },
  { field: "phone", label: "Telefone" },
  { field: "active", label: "Status", render: (r) => <ActiveChip active={r.active} /> },
];

export const financeSupplierFields = [
  { name: "name", label: "Nome / Razão social", gridSize: 8 },
  { name: "documentType", label: "Tipo de documento", type: "select", options: DOCUMENT_TYPE_OPTIONS, gridSize: 4 },
  { name: "document", label: "CPF/CNPJ", gridSize: 6 },
  { name: "contactName", label: "Pessoa de contato", gridSize: 6 },
  { name: "email", label: "E-mail", gridSize: 6 },
  { name: "phone", label: "Telefone", gridSize: 6 },
  { name: "active", label: "Fornecedor ativo", type: "switch", defaultValue: true, gridSize: 6 },
  ...ADDRESS_FIELDS,
  { name: "notes", label: "Observações", type: "textarea", gridSize: 12 },
];

const PRODUCT_TYPE_OPTIONS = [
  { value: "product", label: "Produto" },
  { value: "service", label: "Serviço" },
];

export const financeProductColumns = [
  { field: "name", label: "Nome" },
  { field: "type", label: "Tipo", render: (r) => (r.type === "service" ? "Serviço" : "Produto") },
  { field: "price", label: "Preço (R$)" },
  { field: "stockQuantity", label: "Estoque", render: (r) => (r.controlStock ? r.stockQuantity : "—") },
  { field: "active", label: "Status", render: (r) => <ActiveChip active={r.active} /> },
];

export const financeProductFields = [
  { name: "name", label: "Nome do produto/serviço", gridSize: 8 },
  { name: "type", label: "Tipo", type: "select", options: PRODUCT_TYPE_OPTIONS, defaultValue: "product", gridSize: 4 },
  { name: "sku", label: "SKU / Código", gridSize: 4 },
  { name: "unit", label: "Unidade (UN, KG, H...)", defaultValue: "UN", gridSize: 4 },
  { name: "ncm", label: "NCM (uso futuro fiscal)", gridSize: 4 },
  { name: "price", label: "Preço de venda (R$)", defaultValue: "0", gridSize: 6 },
  { name: "costPrice", label: "Preço de custo (R$)", defaultValue: "0", gridSize: 6 },
  { name: "controlStock", label: "Controlar estoque", type: "switch", gridSize: 6 },
  { name: "stockQuantity", label: "Quantidade em estoque", type: "number", defaultValue: 0, gridSize: 6 },
  { name: "active", label: "Ativo", type: "switch", defaultValue: true, gridSize: 6 },
  { name: "notes", label: "Observações", type: "textarea", gridSize: 12 },
];

// ---------------------------------------------------------------------------
// Fase 2 — Financeiro operacional (custos, contas a pagar/receber). Ver
// docs/MANUAL_TECNICO.md, seção 6.2.
// ---------------------------------------------------------------------------

const COST_TYPE_OPTIONS = [
  { value: "fixed", label: "Fixo" },
  { value: "variable", label: "Variável" },
];

const EXPENSE_STATUS_OPTIONS = [
  { value: "pending", label: "Pendente" },
  { value: "paid", label: "Pago" },
];

const RECEIVABLE_STATUS_OPTIONS = [
  { value: "pending", label: "Pendente" },
  { value: "received", label: "Recebido" },
];

// Vencido = ainda pendente e a data de vencimento já passou — usado tanto na
// tabela quanto pra decidir a cor do chip de status.
const isOverdue = (record) =>
  record.status === "pending" &&
  record.dueDate &&
  moment(record.dueDate).isBefore(moment(), "day");

const StatusChip = ({ label, color }) => (
  <Chip size="small" label={label} style={{ backgroundColor: color, color: "#fff", fontWeight: 600 }} />
);

export const financeExpenseColumns = [
  { field: "description", label: "Descrição" },
  { field: "category", label: "Categoria" },
  {
    field: "costType",
    label: "Tipo",
    render: (r) => (r.costType === "fixed" ? "Fixo" : "Variável"),
  },
  { field: "value", label: "Valor", render: (r) => money(r.value) },
  { field: "dueDate", label: "Vencimento", render: (r) => formatDateBR(r.dueDate) },
  { field: "supplier", label: "Fornecedor", render: (r) => r.supplier?.name || "—" },
  {
    field: "status",
    label: "Status",
    render: (r) => {
      if (r.status === "paid") return <StatusChip label="Pago" color="#10b981" />;
      if (isOverdue(r)) return <StatusChip label="Vencido" color="#ef4444" />;
      return <StatusChip label="Pendente" color="#f59e0b" />;
    },
  },
];

export const financeExpenseFields = [
  { name: "description", label: "Descrição", gridSize: 8 },
  { name: "category", label: "Categoria", defaultValue: "Outros", gridSize: 4 },
  { name: "costType", label: "Tipo de custo", type: "select", options: COST_TYPE_OPTIONS, defaultValue: "variable", gridSize: 4 },
  { name: "value", label: "Valor (R$)", defaultValue: "0", gridSize: 4 },
  { name: "status", label: "Status", type: "select", options: EXPENSE_STATUS_OPTIONS, defaultValue: "pending", gridSize: 4 },
  { name: "dueDate", label: "Vencimento", type: "date", gridSize: 6 },
  { name: "paymentDate", label: "Data de pagamento", type: "date", gridSize: 6 },
  { name: "supplierId", label: "Fornecedor", type: "asyncSelect", optionsResource: "suppliers", gridSize: 12 },
  { name: "notes", label: "Observações", type: "textarea", gridSize: 12 },
];

export const financeExpenseFilters = [
  { name: "status", label: "Status", options: [{ value: "", label: "Todos" }, ...EXPENSE_STATUS_OPTIONS] },
];

export const financeReceivableColumns = [
  { field: "description", label: "Descrição" },
  { field: "value", label: "Valor", render: (r) => money(r.value) },
  { field: "dueDate", label: "Vencimento", render: (r) => formatDateBR(r.dueDate) },
  { field: "customer", label: "Cliente", render: (r) => r.customer?.name || "—" },
  {
    field: "status",
    label: "Status",
    render: (r) => {
      if (r.status === "received") return <StatusChip label="Recebido" color="#10b981" />;
      if (isOverdue(r)) return <StatusChip label="Vencido" color="#ef4444" />;
      return <StatusChip label="Pendente" color="#f59e0b" />;
    },
  },
];

export const financeReceivableFields = [
  { name: "description", label: "Descrição", gridSize: 8 },
  { name: "value", label: "Valor (R$)", defaultValue: "0", gridSize: 4 },
  { name: "status", label: "Status", type: "select", options: RECEIVABLE_STATUS_OPTIONS, defaultValue: "pending", gridSize: 4 },
  { name: "dueDate", label: "Vencimento", type: "date", gridSize: 6 },
  { name: "receivedDate", label: "Data de recebimento", type: "date", gridSize: 6 },
  { name: "customerId", label: "Cliente", type: "asyncSelect", optionsResource: "customers", gridSize: 12 },
  { name: "notes", label: "Observações", type: "textarea", gridSize: 12 },
];

export const financeReceivableFilters = [
  { name: "status", label: "Status", options: [{ value: "", label: "Todos" }, ...RECEIVABLE_STATUS_OPTIONS] },
];
