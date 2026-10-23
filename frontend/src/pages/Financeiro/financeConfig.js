import React from "react";
import Chip from "@material-ui/core/Chip";
import Avatar from "@material-ui/core/Avatar";
import ImageIcon from "@material-ui/icons/Image";
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
  { field: "whatsapp", label: "WhatsApp" },
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
  {
    name: "whatsapp",
    label: "WhatsApp",
    gridSize: 6,
    helperText: "Número usado pra disparo de cobrança/lembrete automático.",
  },
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

export const PRODUCT_TYPE_OPTIONS = [
  { value: "product", label: "Produto" },
  { value: "service", label: "Serviço" },
  { value: "weapon", label: "Arma" },
  { value: "ammunition", label: "Munição / Insumo" },
  { value: "accessory", label: "Acessórios" },
  { value: "hunting_fishing", label: "Caça & Pesca" },
];

export const PRODUCT_TYPE_LABELS = PRODUCT_TYPE_OPTIONS.reduce((acc, opt) => {
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
// Serviço não é mercadoria — NCM é classificação fiscal de bem físico
// (Nomenclatura Comum do Mercosul), e "Controlar estoque" não faz sentido
// pra algo que não tem unidade física guardada (ex. "Renovação de CRAF",
// "Filiação") — pedido do cliente: painel de Serviço "tem que ser
// diferente do de Produto", sem esses campos de mercadoria no meio.
const isNotService = (values) => values.type !== "service";
// Pedido do cliente (clube de tiro): cadastro de Produto do tipo Arma/
// Munição é só dado do produto + especificação técnica — nada de fiscal/
// tributo/IVA2027/referência genérica de outro sistema ali. Confirmado
// contra 2 notas fiscais reais (arma e munição): só os campos de ICMS/
// CSOSN/IBPT (que a nota de verdade usa, sem equivalente na Venda) ficam;
// o resto desaparece pra esse tipo. Ver docs/MANUAL_TECNICO.md, seção 184.
const isNotServiceAndNotWeaponAmmo = (values) =>
  isNotService(values) && !isWeaponOrAmmunition(values);
const hasStockControlAndNotWeaponAmmo = (values) =>
  hasStockControl(values) && !isWeaponOrAmmunition(values);

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

export const WEAPON_STATUS_OPTIONS = [
  { value: "in_stock", label: "Em estoque" },
  { value: "sold", label: "Vendida" },
  { value: "maintenance", label: "Em manutenção" },
  { value: "decommissioned", label: "Baixada / Inutilizada" },
];

// Aba "2 - Dados Fiscais" do Produto (v2.3.167) — modelo exato do sistema
// de referência que o cliente mandou (print de tela), confirmado contra 4
// notas fiscais reais (venda a consumidor + 3 compras de fornecedor). Ver
// FinanceProduct.ts e docs/MANUAL_TECNICO.md, seção 145.
const icmsExemptOn = (values) => !!values.icmsExempt;
const icmsSubstitutionOff = (values) => !values.icmsSubstitution;

// Origem da mercadoria (Sefaz) — tabela oficial completa.
const ICMS_ORIGIN_OPTIONS = [
  { value: "0", label: "0 - Nacional, exceto as indicadas nos códigos 3 a 5" },
  { value: "1", label: "1 - Estrangeira - Importação direta" },
  { value: "2", label: "2 - Estrangeira - Adquirida no mercado interno" },
  { value: "3", label: "3 - Nacional, Conteúdo de Importação superior a 40%" },
  { value: "4", label: "4 - Nacional, produção conforme processos produtivos básicos" },
  { value: "5", label: "5 - Nacional, Conteúdo de Importação inferior ou igual a 40%" },
  { value: "6", label: "6 - Estrangeira - Importação direta, sem similar nacional" },
  { value: "7", label: "7 - Estrangeira - Adquirida no mercado interno, sem similar nacional" },
  { value: "8", label: "8 - Nacional, Conteúdo de Importação superior a 70%" },
];

// CSOSN (Simples Nacional) — tabela oficial completa (NT 2015/003).
const CSOSN_OPTIONS = [
  { value: "101", label: "101 - Tributada c/ permissão de crédito" },
  { value: "102", label: "102 - Tributada s/ permissão de crédito" },
  { value: "103", label: "103 - Isenção (faixa de receita bruta)" },
  { value: "201", label: "201 - Tributada c/ crédito e c/ cobrança do ICMS por ST" },
  { value: "202", label: "202 - Tributada s/ crédito e c/ cobrança do ICMS por ST" },
  { value: "203", label: "203 - Isenção (faixa de receita) e c/ cobrança do ICMS por ST" },
  { value: "300", label: "300 - Imune" },
  { value: "400", label: "400 - Não tributada pelo Simples Nacional" },
  { value: "500", label: "500 - ICMS cobrado anteriormente por ST ou antecipação" },
  { value: "900", label: "900 - Outros" },
];

const ICMS_BC_MODALITY_OPTIONS = [
  { value: "0", label: "0 - Margem Valor Agregado (%)" },
  { value: "1", label: "1 - Pauta (valor)" },
  { value: "2", label: "2 - Preço Tabelado Máx. (valor)" },
  { value: "3", label: "3 - Valor da Operação" },
];

const ICMS_ST_BC_MODALITY_OPTIONS = [
  { value: "", label: "—" },
  { value: "0", label: "0 - Preço tabelado ou máximo sugerido" },
  { value: "1", label: "1 - Lista Negativa (valor)" },
  { value: "2", label: "2 - Lista Positiva (valor)" },
  { value: "3", label: "3 - Lista Neutra (valor)" },
  { value: "4", label: "4 - Margem Valor Agregado (%)" },
  { value: "5", label: "5 - Pauta (valor)" },
  { value: "6", label: "6 - Valor da Operação" },
];

export const financeProductColumns = [
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
  { name: "photoUrl", type: "photo", gridSize: 12 },
  { name: "name", label: "Nome do produto/serviço", gridSize: 8 },
  { name: "type", label: "Tipo", type: "select", options: PRODUCT_TYPE_OPTIONS, defaultValue: "product", gridSize: 4 },
  { name: "sku", label: "SKU / Código", gridSize: 4 },
  { name: "unit", label: "Unidade (UN, KG, H...)", defaultValue: "UN", gridSize: 4 },
  { name: "ncm", label: "NCM (uso futuro fiscal)", gridSize: 4, visibleWhen: isNotService },
  { name: "price", label: "Preço de venda (R$)", type: "number", step: "0.01", defaultValue: "0", gridSize: 6 },
  { name: "costPrice", label: "Preço de custo (R$)", type: "number", step: "0.01", defaultValue: "0", gridSize: 6 },
  {
    name: "taxRate",
    label: "Alíquota de imposto (%) — usada no dashboard de lucro",
    type: "number",
    step: "0.01",
    defaultValue: "0",
    gridSize: 6,
    visibleWhen: isNotServiceAndNotWeaponAmmo,
  },
  { name: "controlStock", label: "Controlar estoque", type: "switch", gridSize: 6, visibleWhen: isNotService },
  {
    type: "sectionTitle",
    label: "Reforma Tributária (IVA 2027)",
    helperText: "Só tem efeito depois de ativado em Configuração Fiscal — preenchimento preventivo.",
    visibleWhen: isNotServiceAndNotWeaponAmmo,
  },
  {
    name: "ivaEducationReduction",
    label: "Serviço de educação/treinamento com redução de 60%",
    type: "switch",
    defaultValue: false,
    gridSize: 12,
    disabledWhen: reform2027Disabled,
    visibleWhen: isNotServiceAndNotWeaponAmmo,
  },
  {
    name: "ivaCstCbs",
    label: "CST da CBS (IVA 2027)",
    gridSize: 6,
    disabledWhen: reform2027Disabled,
    visibleWhen: isNotServiceAndNotWeaponAmmo,
  },
  {
    name: "ivaCstIbs",
    label: "CST do IBS (IVA 2027)",
    gridSize: 6,
    disabledWhen: reform2027Disabled,
    visibleWhen: isNotServiceAndNotWeaponAmmo,
  },
  {
    name: "ivaCbsRate",
    label: "Alíquota estimada CBS % (IVA 2027)",
    type: "number",
    step: "0.01",
    defaultValue: "0",
    gridSize: 6,
    disabledWhen: reform2027Disabled,
    visibleWhen: isNotServiceAndNotWeaponAmmo,
  },
  {
    name: "ivaIbsRate",
    label: "Alíquota estimada IBS % (IVA 2027)",
    type: "number",
    step: "0.01",
    defaultValue: "0",
    gridSize: 6,
    disabledWhen: reform2027Disabled,
    visibleWhen: isNotServiceAndNotWeaponAmmo,
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

  {
    type: "sectionTitle",
    label: "Dados Gerais — Complementares",
    helperText: "Campos do sistema de referência do cliente que não existiam ainda aqui.",
    visibleWhen: isNotServiceAndNotWeaponAmmo,
  },
  { name: "barcodeGtin", label: "Cód. Barras (GTIN)", gridSize: 4, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "supplierCode", label: "Cód. Fornecedor", gridSize: 4, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "originalCode", label: "Código Original", gridSize: 4, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "similarProductCode", label: "Cód. Produto Similar", gridSize: 6, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "colorSizeFlavor", label: "Cor/Tamanho/Sabor", gridSize: 6, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "weight", label: "Peso", type: "number", step: "0.001", gridSize: 4, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "category", label: "Categoria", gridSize: 4, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "subcategory", label: "Subcategoria", gridSize: 4, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "packaging", label: "Embalagem", gridSize: 4, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "productFamily", label: "Família", gridSize: 4, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "storageLocation", label: "Local no Estoque/Armazenagem", gridSize: 4, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "priceTable2", label: "Tabela 2 (R$)", type: "number", step: "0.01", defaultValue: "0", gridSize: 6, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "priceTable3", label: "Tabela 3 (R$)", type: "number", step: "0.01", defaultValue: "0", gridSize: 6, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "priceTable4", label: "Tabela 4 (R$)", type: "number", step: "0.01", defaultValue: "0", gridSize: 6, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "priceTable5", label: "Tabela 5 (R$)", type: "number", step: "0.01", defaultValue: "0", gridSize: 6, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "reservedStock", label: "Estoq. Reserv.", type: "number", defaultValue: 0, gridSize: 4, visibleWhen: hasStockControlAndNotWeaponAmmo },
  { name: "idealStock", label: "Estoq. Ideal", type: "number", defaultValue: 0, gridSize: 4, visibleWhen: hasStockControlAndNotWeaponAmmo },
  { name: "stockByLot", label: "Por Lote", type: "number", defaultValue: 0, gridSize: 4, visibleWhen: hasStockControlAndNotWeaponAmmo },
  { name: "lotControl", label: "Controle por Lote", type: "switch", defaultValue: false, gridSize: 6, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "isComposite", label: "Produto Composto", type: "switch", defaultValue: false, gridSize: 6, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "isRawMaterial", label: "Matéria Prima", type: "switch", defaultValue: false, gridSize: 6, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "isEquipment", label: "Equipamento", type: "switch", defaultValue: false, gridSize: 6, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "soldByWeight", label: "Venda por KG", type: "switch", defaultValue: false, gridSize: 6, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "commissionRate", label: "Comissão (%)", type: "number", step: "0.01", defaultValue: "0", gridSize: 6, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "maxDiscountMargin", label: "Marg. Desc. (%)", type: "number", step: "0.01", defaultValue: "0", gridSize: 6, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "loyaltyPoints", label: "Pontos", type: "number", defaultValue: 0, gridSize: 6, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "redemptionPoints", label: "Pontos Troca", type: "number", defaultValue: 0, gridSize: 6, visibleWhen: isNotServiceAndNotWeaponAmmo },

  {
    type: "sectionTitle",
    label: "Fornecedor / Produção",
    visibleWhen: isNotService,
  },
  { name: "mainSupplierId", label: "Distribuidor / Fornecedor Principal", type: "asyncSelect", optionsResource: "suppliers", embeddedKey: "mainSupplier", gridSize: 12, visibleWhen: isNotService },
  { name: "productionLeadTime", label: "Prazo de Produção", gridSize: 6, visibleWhen: isNotService },
  { name: "designCode", label: "Código Desenho", gridSize: 6, visibleWhen: isNotService },
  { name: "productionScale", label: "Escala de Produção", gridSize: 6, visibleWhen: isNotService },
  { name: "manufacturerCnpj", label: "CNPJ do Fabricante", gridSize: 6, visibleWhen: isNotService },

  // -- Campos de arma/munição/insumo — só aparecem quando Tipo = Arma ou
  // Munição/Insumo (ver `visibleWhen`, checado em FinanceRecordModal). --
  { name: "brand", label: "Marca / Fabricante", gridSize: 6, visibleWhen: isWeaponOrAmmunition },
  { name: "model", label: "Modelo", gridSize: 6, visibleWhen: isWeapon },
  { name: "weaponType", label: "Tipo da arma", type: "select", options: WEAPON_TYPE_OPTIONS, gridSize: 6, visibleWhen: isWeapon },
  { name: "caliber", label: "Calibre nominal", gridSize: 6, visibleWhen: isWeaponOrAmmunition },
  { name: "cartridgeCapacity", label: "Capacidade de cartuchos", type: "number", gridSize: 6, visibleWhen: isWeapon },
  { name: "operatingMode", label: "Regime de funcionamento", type: "select", options: OPERATING_MODE_OPTIONS, gridSize: 6, visibleWhen: isWeapon },
  { name: "barrelCount", label: "Quantidade de canos", type: "number", defaultValue: 1, gridSize: 6, visibleWhen: isWeapon },
  { name: "barrelLength", label: "Comprimento do cano (cm)", type: "number", step: "0.1", gridSize: 6, visibleWhen: isWeapon },
  { name: "boreType", label: "Tipo de alma", type: "select", options: BORE_TYPE_OPTIONS, gridSize: 6, visibleWhen: isWeapon },
  { name: "kineticEnergyJ", label: "Energia cinética da munição (Joules)", type: "number", step: "0.1", gridSize: 6, visibleWhen: isWeaponOrAmmunition },
  { name: "useClassification", label: "Classificação de uso", type: "select", options: USE_CLASSIFICATION_OPTIONS, gridSize: 6, visibleWhen: isWeaponOrAmmunition },
  { name: "origin", label: "Procedência", type: "select", options: ORIGIN_OPTIONS, gridSize: 6, visibleWhen: isWeaponOrAmmunition },
  // Número de série, registro SIGMA/SINARM e situação da arma passaram a
  // ser por unidade física (sub-cadastro, v2.3.204) — pseudo-campo
  // "weaponUnits" (mesmo mecanismo de "photo"/"sectionTitle", renderizado
  // à parte em FinanceRecordModal.js via WeaponUnitsSection.js).
  { name: "weaponUnitsSection", type: "weaponUnits", gridSize: 12, visibleWhen: isWeapon },
  { name: "manufacturingLotNumber", label: "Número do lote de fabricação", gridSize: 6, visibleWhen: isAmmunition },
  { name: "packageBarcode", label: "Código de barras / embalagem", gridSize: 6, visibleWhen: isAmmunition },

  {
    type: "sectionTitle",
    label: "Dados Fiscais",
    helperText: "Confirmado contra notas fiscais reais do cliente — ver docs/MANUAL_TECNICO.md, seção 145.",
    visibleWhen: isNotService,
  },
  { name: "icmsExempt", label: "Produto Isento de ICMS", type: "switch", defaultValue: false, gridSize: 6, visibleWhen: isNotService },
  { name: "icmsSubstitution", label: "ICMS por Substituição Tributária", type: "switch", defaultValue: false, gridSize: 6, visibleWhen: isNotService },
  { name: "icmsOrigin", label: "Origem", type: "select", options: ICMS_ORIGIN_OPTIONS, defaultValue: "0", gridSize: 12, visibleWhen: isNotService },
  { name: "csosnContribuinte", label: "Tipo Tributação ICMS (Contribuinte)", type: "select", options: CSOSN_OPTIONS, defaultValue: "101", gridSize: 6, visibleWhen: isNotService },
  { name: "csosnNaoContribuinte", label: "Tipo Tributação ICMS (Não Contribuinte)", type: "select", options: CSOSN_OPTIONS, defaultValue: "102", gridSize: 6, visibleWhen: isNotService },
  { name: "icmsBcModality", label: "Modalidade de determinação da BC do ICMS", type: "select", options: ICMS_BC_MODALITY_OPTIONS, defaultValue: "3", gridSize: 6, visibleWhen: isNotService },
  {
    name: "icmsStBcModality",
    label: "Modalidade de determinação da BC do ICMS-ST",
    type: "select",
    options: ICMS_ST_BC_MODALITY_OPTIONS,
    gridSize: 6,
    visibleWhen: isNotService,
    disabledWhen: icmsSubstitutionOff,
  },
  { name: "icmsRate", label: "ICMS (%)", type: "number", step: "0.01", defaultValue: "0", gridSize: 4, visibleWhen: isNotService, disabledWhen: icmsExemptOn },
  { name: "icmsEcf", label: "ICMS ECF", gridSize: 4, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "icmsStRate", label: "ICMS ST (%)", type: "number", step: "0.01", defaultValue: "0", gridSize: 6, visibleWhen: isNotService, disabledWhen: icmsSubstitutionOff },
  { name: "icmsStMva", label: "IVA - ST (MVA %)", type: "number", step: "0.01", defaultValue: "0", gridSize: 6, visibleWhen: isNotService, disabledWhen: icmsSubstitutionOff },
  // Valor ICMS Desonerado (R$, v2.3.183, pedido do cliente) — campo já
  // existia como "ICMS Desoner. (%)" mas nunca tinha ido pro payload da
  // Focus NFe; reaproveitado como VALOR (R$), que é o que a Sefaz espera
  // (vICMSDeson) — "desoneração" não é uma alíquota, é um valor fixo
  // abatido. Ver FocusNFeService.buildItemIcms.
  { name: "icmsDesoneration", label: "Valor ICMS Desonerado (R$)", type: "number", step: "0.01", defaultValue: "0", gridSize: 4, visibleWhen: isNotService },
  { name: "taxableUnit", label: "Un. Medida Trib.", gridSize: 4, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "cfopPrincipal", label: "CFOP Principal (venda interna)", defaultValue: "5102", gridSize: 4, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "cfopOutState", label: "CFOP Fora UF (interestadual)", defaultValue: "6102", gridSize: 4, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "taxArticle", label: "Artigo", gridSize: 6, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "fiscalBenefitCode", label: "Cód. Benefício Fiscal", gridSize: 6, visibleWhen: isNotServiceAndNotWeaponAmmo },
  // "Valor Aproximado dos Tributos" (Lei da Transparência, v2.3.183) —
  // texto no rodapé da nota, manual (tabela do IBPT, atualizada a cada 6
  // meses por NCM — este sistema não calcula/valida, só usa o número
  // informado aqui). Deixa em branco/zero se não quiser usar.
  { name: "ibptRate", label: "Alíquota aprox. tributos - IBPT (%)", type: "number", step: "0.01", defaultValue: "0", gridSize: 6, visibleWhen: isNotService },
  { name: "ibptSource", label: "Fonte IBPT (código da tabela)", gridSize: 6, visibleWhen: isNotService },
  { name: "usesFcp", label: "Utilizar Alíq. de Fundo de Combate à Pobreza (FCP)", type: "switch", defaultValue: false, gridSize: 6, visibleWhen: isNotServiceAndNotWeaponAmmo },
  { name: "conditionalDiscountNfe", label: "Desconto Condicional na NFe/NFCe", type: "switch", defaultValue: false, gridSize: 6, visibleWhen: isNotServiceAndNotWeaponAmmo },

  { name: "active", label: "Ativo", type: "switch", defaultValue: true, gridSize: 6 },
  { name: "notes", label: "Observações", type: "textarea", gridSize: 12 },
];

// Entrando por um link de categoria específica do menu lateral (ex.: "Armas
// nacionais"), o botão "Novo(a) Produto" já abre com Tipo (e Procedência,
// quando for o caso) pré-selecionados pro contexto da tela — pedido do
// cliente pra não precisar escolher de novo algo que já está implícito em
// qual lista ele está. O campo continua um <select> completo (nenhuma opção
// removida): se o cliente quiser cadastrar outra coisa sem fechar o modal
// (ex.: abrir "Novo Produto" em Armas nacionais mas cadastrar a munição que
// acompanha), ele troca o Tipo ali mesmo e o registro salva na categoria
// escolhida, não na da tela onde abriu.
const PRODUCT_CATEGORY_DEFAULTS = {
  "": { type: "product" },
  product: { type: "product" },
  service: { type: "service" },
  "weapon:national": { type: "weapon", origin: "national" },
  "weapon:imported": { type: "weapon", origin: "imported" },
  ammunition: { type: "ammunition" },
  accessory: { type: "accessory" },
  hunting_fishing: { type: "hunting_fishing" },
};

export const getProductFieldsForCategory = (categoryParam) => {
  const defaults = PRODUCT_CATEGORY_DEFAULTS[categoryParam || ""] || { type: "product" };
  return financeProductFields.map((field) => {
    if (field.name === "type") return { ...field, defaultValue: defaults.type };
    if (field.name === "origin" && defaults.origin) {
      return { ...field, defaultValue: defaults.origin };
    }
    return field;
  });
};

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
      { value: "accessory", label: "Acessórios" },
      { value: "hunting_fishing", label: "Caça & Pesca" },
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
  // v2.3.189 — conta a receber de uma venda cancelada (ver SaleService.cancel)
  // passa pra esse status, em vez de continuar "Pendente"/"Recebido" como se
  // a cobrança ainda valesse.
  { value: "cancelled", label: "Cancelado" },
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
      if (r.status === "cancelled") return <StatusChip label="Cancelado" color="#6b7280" />;
      if (r.status === "received") return <StatusChip label="Recebido" color="#10b981" />;
      if (isOverdue(r)) return <StatusChip label="Vencido" color="#ef4444" />;
      return <StatusChip label="Pendente" color="#f59e0b" />;
    },
  },
];

export const financeReceivableFields = [
  {
    name: "_servicePicker",
    type: "serviceSelect",
    label: "Buscar serviço (preenche Descrição/Valor)",
    fillFields: { description: "name", value: "value" },
    gridSize: 12,
  },
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

// Campos fiscais da Venda pedidos pelo contador do cliente (v2.3.166) — ver
// comentário completo (e os códigos Sefaz usados) em Sale.ts/
// FocusNFeService.ts. Vivem aqui (não em SaleModal.js) só pra manter as
// listas de opção no mesmo lugar dos outros `_OPTIONS` deste módulo.
export const SALE_OPERATION_TYPE_OPTIONS = [
  { value: "internal", label: "Interna (mesmo estado)" },
  { value: "interstate", label: "Interestadual" },
  { value: "foreign", label: "Exterior" },
];

export const SALE_CONSUMER_PRESENCE_OPTIONS = [
  { value: "0", label: "0 - Não se aplica" },
  { value: "1", label: "1 - Presencial" },
  { value: "2", label: "2 - Não Pres. (Internet)" },
  { value: "3", label: "3 - Não Pres. (TeleAt.)" },
  { value: "5", label: "5 - Pres. Fora Estabelec." },
  { value: "9", label: "9 - Não Pres. (outros)" },
];

export const SALE_INTERMEDIARY_TYPE_OPTIONS = [
  { value: "none", label: "Sem operação" },
  { value: "own_site", label: "Sem intermediador (Site Próprio)" },
  { value: "marketplace", label: "Site ou Plataforma de Terceiros (marketplace)" },
];

export const SALE_FINAL_CONSUMER_TYPE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "final", label: "Final" },
];

export const SALE_RECIPIENT_TYPE_OPTIONS = [
  { value: "customer", label: "Cliente" },
  { value: "supplier", label: "Fornecedor" },
];

export const SALE_IE_INDICATOR_OPTIONS = [
  { value: "contributor", label: "Contribuinte" },
  { value: "non_contributor", label: "Não contribuinte" },
  { value: "exempt", label: "Contribuinte Isento" },
];

// Forma de pagamento — lista exatamente como o contador passou (duas
// opções, "À vista" e "Dinheiro", mapeiam pro mesmo código Sefaz "01" no
// backend; ver PAYMENT_METHOD_CODES em FocusNFeService.ts).
export const SALE_PAYMENT_METHOD_OPTIONS = [
  { value: "", label: "—" },
  { value: "cash_upfront", label: "À vista" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "debit_card", label: "Cartão de Débito" },
  { value: "money", label: "Dinheiro" },
  { value: "imported_xml", label: "Importado do XML" },
  { value: "pix", label: "PIX" },
  { value: "no_payment", label: "Sem pagamento" },
];

// "Finalidade da Emissão" + "Dados de Transporte" (v2.3.168) — tela de
// emissão de NF-e do sistema de referência do cliente. Ver comentário de
// confiança em FocusNFeService.ts (`ISSUANCE_PURPOSE_CODES`).
export const SALE_ISSUANCE_PURPOSE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "complementary", label: "Complementar" },
  { value: "adjustment", label: "Ajuste" },
  { value: "return", label: "Devolução" },
  { value: "credit_note", label: "NF Crédito" },
  { value: "debit_note", label: "NF Débito" },
];

// modFrete (Sefaz) — "9" (sem frete) é o padrão de venda de balcão.
export const SALE_FREIGHT_RESPONSIBILITY_OPTIONS = [
  { value: "0", label: "0 - Contratação por Conta do Emitente" },
  { value: "1", label: "1 - Contratação por Conta do Destinatário" },
  { value: "2", label: "2 - Contratação por Conta de Terceiros" },
  { value: "3", label: "3 - Transp. Próprio por Conta do Emitente" },
  { value: "4", label: "4 - Transp. Próprio por Conta do Destinatário" },
  { value: "9", label: "9 - Sem Frete" },
];
