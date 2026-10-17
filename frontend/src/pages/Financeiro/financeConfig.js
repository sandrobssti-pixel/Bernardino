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

const IVA_TAXPAYER_PROFILE_OPTIONS = [
  { value: "B2C", label: "B2C — Pessoa física" },
  { value: "B2B", label: "B2B — Empresa" },
  { value: "B2G", label: "B2G — Órgão público" },
];

// Reforma Tributária 2027 (CBS/IBS) — campos ficam desabilitados enquanto
// a chave global (Configuração Fiscal) não for ativada. `context` vem de
// `Financeiro/index.js` (lido da Configuração Fiscal uma vez, repassado
// até aqui via `FinanceRecordList`/`FinanceRecordModal`).
const reform2027Disabled = (values, context) => !context?.reform2027Enabled;

export const financeCustomerFields = [
  { name: "name", label: "Nome do cliente", gridSize: 8 },
  { name: "documentType", label: "Tipo de documento", type: "select", options: DOCUMENT_TYPE_OPTIONS, gridSize: 4 },
  { name: "document", label: "CPF/CNPJ", gridSize: 6 },
  { name: "email", label: "E-mail", gridSize: 6 },
  { name: "phone", label: "Telefone", gridSize: 6 },
  { name: "active", label: "Cliente ativo", type: "switch", defaultValue: true, gridSize: 6 },
  ...ADDRESS_FIELDS,
  { name: "notes", label: "Observações", type: "textarea", gridSize: 12 },
  {
    type: "sectionTitle",
    label: "Reforma Tributária (IVA 2027)",
    helperText: "Só tem efeito depois de ativado em Configuração Fiscal.",
  },
  {
    name: "ivaTaxpayerProfile",
    label: "Perfil do destinatário (IVA 2027)",
    type: "select",
    options: IVA_TAXPAYER_PROFILE_OPTIONS,
    defaultValue: "B2C",
    gridSize: 6,
    disabledWhen: reform2027Disabled,
  },
  {
    name: "ivaGovExempt",
    label: "Órgão público isento (edital) — IVA 2027",
    type: "switch",
    defaultValue: false,
    gridSize: 6,
    disabledWhen: reform2027Disabled,
  },
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
  { value: "weapon", label: "Arma" },
  { value: "ammunition", label: "Munição / Insumo" },
];

const PRODUCT_TYPE_LABELS = PRODUCT_TYPE_OPTIONS.reduce((acc, opt) => {
  acc[opt.value] = opt.label;
  return acc;
}, {});

// Cadastro de armas/munições/insumos controlados (clube de tiro, loja de
// armas, armaria: Taurus, CBC, Glock, Imbramun...) — extensão do Produto
// existente em vez de entidades dedicadas (decisão do cliente). Normas de
// referência: Decreto 11.615/2023, Decreto 12.345/2024, Estatuto do
// Desarmamento (Lei 10.826/2003). Ver docs/MANUAL_TECNICO.md.
//
// IMPORTANTE: estes campos ajudam a documentar o cadastro, mas a
// classificação final de uso permitido/restrito e o cumprimento das normas
// citadas são responsabilidade do usuário/especialista legal — não há
// validação automática de conformidade aqui.
const WEAPON_TYPES = ["weapon"];
const AMMUNITION_TYPES = ["ammunition"];
const WEAPON_OR_AMMUNITION_TYPES = [...WEAPON_TYPES, ...AMMUNITION_TYPES];

const isWeapon = (values) => WEAPON_TYPES.includes(values.type);
const isAmmunition = (values) => AMMUNITION_TYPES.includes(values.type);
const isWeaponOrAmmunition = (values) => WEAPON_OR_AMMUNITION_TYPES.includes(values.type);
const hasStockControl = (values) => !!values.controlStock;

const WEAPON_TYPE_OPTIONS = [
  { value: "pistol", label: "Pistola" },
  { value: "revolver", label: "Revólver" },
  { value: "rifle", label: "Fuzil" },
  { value: "carbine", label: "Carabina" },
  { value: "shotgun", label: "Espingarda" },
  { value: "submachine_gun", label: "Submetralhadora" },
  { value: "other", label: "Outro" },
];

const OPERATING_MODE_OPTIONS = [
  { value: "semi_automatic", label: "Semiautomática" },
  { value: "repeating", label: "Repetição (ação manual)" },
  { value: "single_action", label: "Ação simples" },
  { value: "double_action", label: "Ação dupla" },
  { value: "automatic", label: "Automática (uso restrito)" },
  { value: "other", label: "Outro" },
];

const BORE_TYPE_OPTIONS = [
  { value: "smooth", label: "Lisa" },
  { value: "rifled", label: "Raiada" },
];

const USE_CLASSIFICATION_OPTIONS = [
  { value: "permitted", label: "Permitido" },
  { value: "restricted", label: "Restrito" },
];

const ORIGIN_OPTIONS = [
  { value: "national", label: "Nacional" },
  { value: "imported", label: "Importada" },
];

const WEAPON_STATUS_OPTIONS = [
  { value: "in_stock", label: "Em estoque" },
  { value: "sold", label: "Vendida" },
  { value: "maintenance", label: "Em manutenção" },
  { value: "decommissioned", label: "Baixada / Inutilizada" },
];

export const financeProductColumns = [
  { field: "name", label: "Nome" },
  { field: "type", label: "Tipo", render: (r) => PRODUCT_TYPE_LABELS[r.type] || "Produto" },
  {
    field: "caliberOrPrice",
    label: "Calibre / Preço",
    render: (r) =>
      r.type === "weapon" || r.type === "ammunition"
        ? r.caliber || "—"
        : `R$ ${r.price}`,
  },
  { field: "stockQuantity", label: "Estoque", render: (r) => (r.controlStock ? r.stockQuantity : "—") },
  { field: "active", label: "Status", render: (r) => <ActiveChip active={r.active} /> },
];

export const financeProductFields = [
  { name: "name", label: "Nome do produto/serviço", gridSize: 8 },
  { name: "type", label: "Tipo", type: "select", options: PRODUCT_TYPE_OPTIONS, defaultValue: "product", gridSize: 4 },
  { name: "sku", label: "SKU / Código", gridSize: 4 },
  { name: "unit", label: "Unidade (UN, KG, H...)", defaultValue: "UN", gridSize: 4 },
  { name: "ncm", label: "NCM (uso futuro fiscal)", gridSize: 4 },
  { name: "price", label: "Preço de venda (R$)", type: "number", step: "0.01", defaultValue: "0", gridSize: 6 },
  { name: "costPrice", label: "Preço de custo (R$)", type: "number", step: "0.01", defaultValue: "0", gridSize: 6 },
  {
    name: "taxRate",
    label: "Alíquota de imposto (%) — usada no dashboard de lucro",
    type: "number",
    step: "0.01",
    defaultValue: "0",
    gridSize: 6,
  },
  { name: "controlStock", label: "Controlar estoque", type: "switch", gridSize: 6 },
  {
    type: "sectionTitle",
    label: "Reforma Tributária (IVA 2027)",
    helperText: "Só tem efeito depois de ativado em Configuração Fiscal — preenchimento preventivo.",
  },
  {
    name: "ivaEducationReduction",
    label: "Serviço de educação/treinamento com redução de 60%",
    type: "switch",
    defaultValue: false,
    gridSize: 12,
    disabledWhen: reform2027Disabled,
  },
  {
    name: "ivaCstCbs",
    label: "CST da CBS (IVA 2027)",
    gridSize: 6,
    disabledWhen: reform2027Disabled,
  },
  {
    name: "ivaCstIbs",
    label: "CST do IBS (IVA 2027)",
    gridSize: 6,
    disabledWhen: reform2027Disabled,
  },
  {
    name: "ivaCbsRate",
    label: "Alíquota estimada CBS % (IVA 2027)",
    type: "number",
    step: "0.01",
    defaultValue: "0",
    gridSize: 6,
    disabledWhen: reform2027Disabled,
  },
  {
    name: "ivaIbsRate",
    label: "Alíquota estimada IBS % (IVA 2027)",
    type: "number",
    step: "0.01",
    defaultValue: "0",
    gridSize: 6,
    disabledWhen: reform2027Disabled,
  },
  { name: "stockQuantity", label: "Quantidade em estoque", type: "number", defaultValue: 0, gridSize: 6, visibleWhen: hasStockControl },
  {
    name: "minStockQuantity",
    label: "Estoque mínimo (aviso no painel, 0 = sem aviso)",
    type: "number",
    defaultValue: 0,
    gridSize: 6,
    visibleWhen: hasStockControl,
  },

  // -- Campos de arma/munição/insumo — só aparecem quando Tipo = Arma ou
  // Munição/Insumo (ver `visibleWhen`, checado em FinanceRecordModal). --
  { name: "brand", label: "Marca / Fabricante", gridSize: 6, visibleWhen: isWeaponOrAmmunition },
  { name: "model", label: "Modelo", gridSize: 6, visibleWhen: isWeapon },
  { name: "weaponType", label: "Tipo da arma", type: "select", options: WEAPON_TYPE_OPTIONS, gridSize: 6, visibleWhen: isWeapon },
  { name: "caliber", label: "Calibre nominal", gridSize: 6, visibleWhen: isWeaponOrAmmunition },
  { name: "serialNumber", label: "Número de série", gridSize: 6, visibleWhen: isWeapon, requiredWhen: isWeapon },
  { name: "cartridgeCapacity", label: "Capacidade de cartuchos", type: "number", gridSize: 6, visibleWhen: isWeapon },
  { name: "operatingMode", label: "Regime de funcionamento", type: "select", options: OPERATING_MODE_OPTIONS, gridSize: 6, visibleWhen: isWeapon },
  { name: "barrelCount", label: "Quantidade de canos", type: "number", defaultValue: 1, gridSize: 6, visibleWhen: isWeapon },
  { name: "barrelLength", label: "Comprimento do cano (cm)", type: "number", step: "0.1", gridSize: 6, visibleWhen: isWeapon },
  { name: "boreType", label: "Tipo de alma", type: "select", options: BORE_TYPE_OPTIONS, gridSize: 6, visibleWhen: isWeapon },
  { name: "kineticEnergyJ", label: "Energia cinética da munição (Joules)", type: "number", step: "0.1", gridSize: 6, visibleWhen: isWeaponOrAmmunition },
  { name: "useClassification", label: "Classificação de uso", type: "select", options: USE_CLASSIFICATION_OPTIONS, gridSize: 6, visibleWhen: isWeaponOrAmmunition },
  { name: "origin", label: "Procedência", type: "select", options: ORIGIN_OPTIONS, gridSize: 6, visibleWhen: isWeaponOrAmmunition },
  { name: "sigmaRegistrationNumber", label: "Nº de registro SIGMA/SINARM", gridSize: 6, visibleWhen: isWeapon },
  { name: "weaponStatus", label: "Situação da arma", type: "select", options: WEAPON_STATUS_OPTIONS, gridSize: 6, visibleWhen: isWeapon },
  { name: "manufacturingLotNumber", label: "Número do lote de fabricação", gridSize: 6, visibleWhen: isAmmunition },
  { name: "packageBarcode", label: "Código de barras / embalagem", gridSize: 6, visibleWhen: isAmmunition },

  { name: "active", label: "Ativo", type: "switch", defaultValue: true, gridSize: 6 },
  { name: "notes", label: "Observações", type: "textarea", gridSize: 12 },
];

// Segmentação de produtos por tipo (produto/serviço/arma/munição) na
// listagem — o dado já vem segmentado desde a importação (`type` do
// FinanceProduct), só faltava o filtro aqui pra visualizar separado em
// vez de tudo misturado numa lista só (v2.3.133).
// "Armas nacionais"/"Armas importadas" não são um `type` próprio do
// cadastro — são `type="weapon"` cruzado com `origin` ("Procedência",
// campo que já existe no formulário). O valor "weapon:national"/
// "weapon:imported" (dois pontos) é resolvido no backend
// (FinanceProductService.list) em vez de criar um segundo select só pra
// isso (v2.3.134).
export const financeProductFilters = [
  {
    name: "type",
    label: "Tipo",
    options: [
      { value: "", label: "Todos" },
      { value: "product", label: "Produto" },
      { value: "weapon:national", label: "Armas nacionais" },
      { value: "weapon:imported", label: "Armas importadas" },
      { value: "ammunition", label: "Munições/Insumos" },
      { value: "service", label: "Serviço" },
    ],
  },
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
  { name: "value", label: "Valor (R$)", type: "number", step: "0.01", defaultValue: "0", gridSize: 4 },
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
  { name: "value", label: "Valor (R$)", type: "number", step: "0.01", defaultValue: "0", gridSize: 4 },
  { name: "status", label: "Status", type: "select", options: RECEIVABLE_STATUS_OPTIONS, defaultValue: "pending", gridSize: 4 },
  { name: "dueDate", label: "Vencimento", type: "date", gridSize: 6 },
  { name: "receivedDate", label: "Data de recebimento", type: "date", gridSize: 6 },
  { name: "customerId", label: "Cliente", type: "asyncSelect", optionsResource: "customers", gridSize: 12 },
  { name: "notes", label: "Observações", type: "textarea", gridSize: 12 },
];

export const financeReceivableFilters = [
  { name: "status", label: "Status", options: [{ value: "", label: "Todos" }, ...RECEIVABLE_STATUS_OPTIONS] },
];
