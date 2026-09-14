import React from "react";
import { ActiveChip } from "../../components/FinanceRecordList";

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
