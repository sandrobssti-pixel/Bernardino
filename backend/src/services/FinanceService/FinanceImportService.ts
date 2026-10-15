import { head } from "lodash";
import XLSX from "xlsx";
import logger from "../../utils/logger";
import FinanceProduct from "../../models/FinanceProduct";
import FinanceCustomer from "../../models/FinanceCustomer";
import FinanceSupplier from "../../models/FinanceSupplier";
import * as FinanceProductService from "./FinanceProductService";
import * as FinanceCustomerService from "./FinanceCustomerService";
import * as FinanceSupplierService from "./FinanceSupplierService";

// Importação de Produtos/Clientes/Fornecedores do módulo Financeiro via
// planilha Excel — decisão confirmada com o cliente: detecção automática
// de coluna pelo nome do cabeçalho (sem tela de mapeamento manual), e
// duplicata (mesmo SKU/nome ou CPF/CNPJ/nome) atualiza o registro já
// existente em vez de criar um segundo. Mesmo padrão de leitura de
// planilha já usado em `ContactListService/ImportContacts.ts` (aliases de
// cabeçalho normalizados), reescrito aqui com helpers próprios porque os
// campos/entidades são completamente diferentes. Ver docs/MANUAL_TECNICO.md.

const normalizeHeader = (value: unknown): string =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

const getRowValueByAliases = (row: Record<string, any>, aliases: string[]): any => {
  const aliasesSet = new Set(aliases.map(normalizeHeader));
  for (const [key, value] of Object.entries(row || {})) {
    if (aliasesSet.has(normalizeHeader(key))) return value;
  }
  return undefined;
};

type FieldMapping = {
  field: string;
  aliases: string[];
  transform?: (raw: any) => any;
};

export type ImportSummary = {
  total: number;
  created: number;
  updated: number;
  invalid: number;
  errors: string[];
};

const readRows = (filePath: string): Record<string, any>[] => {
  const workbook = XLSX.readFile(filePath);
  const worksheet = head(Object.values(workbook.Sheets)) as any;
  return XLSX.utils.sheet_to_json(worksheet, { header: 0, defval: "" });
};

const mapRow = (
  row: Record<string, any>,
  mappings: FieldMapping[]
): Record<string, any> => {
  const data: Record<string, any> = {};
  mappings.forEach(({ field, aliases, transform }) => {
    const raw = getRowValueByAliases(row, aliases);
    if (raw === undefined || raw === null || String(raw).trim() === "") return;
    const value = transform ? transform(raw) : String(raw).trim();
    if (value === undefined) return;
    data[field] = value;
  });
  return data;
};

const toNumberOrUndefined = (raw: any): number | undefined => {
  const parsed = Number(String(raw).replace(",", "."));
  return Number.isNaN(parsed) ? undefined : parsed;
};

const toIntOrUndefined = (raw: any): number | undefined => {
  const parsed = parseInt(String(raw).replace(/\D/g, ""), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const buildLabelTransform = (labelMap: Record<string, string>) => (raw: any): string => {
  const normalized = normalizeHeader(raw);
  return labelMap[normalized] || String(raw).trim();
};

const DOCUMENT_ALIASES = ["cpf", "cnpj", "documento", "cpfcnpj", "ruc"];
const EMAIL_ALIASES = ["email", "e-mail"];
const PHONE_ALIASES = ["telefone", "celular", "fone", "whatsapp", "contato"];
const ADDRESS_MAPPINGS: FieldMapping[] = [
  { field: "zipCode", aliases: ["cep", "zipcode"] },
  { field: "street", aliases: ["rua", "logradouro", "street", "endereco"] },
  { field: "number", aliases: ["numero", "número", "numberaddress", "num"] },
  { field: "complement", aliases: ["complemento", "complement"] },
  { field: "neighborhood", aliases: ["bairro", "neighborhood"] },
  { field: "city", aliases: ["cidade", "city", "municipio"] },
  { field: "state", aliases: ["uf", "estado", "state"] }
];

const PRODUCT_TYPE_LABEL_MAP: Record<string, string> = {
  produto: "product",
  product: "product",
  servico: "service",
  service: "service",
  arma: "weapon",
  weapon: "weapon",
  municao: "ammunition",
  municaoinsumo: "ammunition",
  insumo: "ammunition",
  ammunition: "ammunition"
};

// ---------------------------------------------------------------------------
// Produtos (inclui arma/munição/insumo — ver Fase 6 do roadmap)
// ---------------------------------------------------------------------------

const PRODUCT_MAPPINGS: FieldMapping[] = [
  { field: "name", aliases: ["nome", "name", "produto", "descricao"] },
  { field: "type", aliases: ["tipo", "type"], transform: buildLabelTransform(PRODUCT_TYPE_LABEL_MAP) },
  { field: "sku", aliases: ["sku", "codigo", "cod"] },
  { field: "unit", aliases: ["unidade", "un", "unit"] },
  { field: "ncm", aliases: ["ncm"] },
  { field: "price", aliases: ["preco", "precovenda", "valor", "valorvenda", "price"] },
  { field: "costPrice", aliases: ["precocusto", "custo", "valorcusto", "costprice"] },
  {
    field: "stockQuantity",
    aliases: ["estoque", "quantidadeemestoque", "qtdestoque", "stockquantity"],
    transform: toNumberOrUndefined
  },
  { field: "brand", aliases: ["marca", "fabricante", "brand"] },
  { field: "model", aliases: ["modelo", "model"] },
  { field: "weaponType", aliases: ["tipodaarma", "weapontype"] },
  { field: "caliber", aliases: ["calibre", "calibrenominal", "caliber"] },
  { field: "serialNumber", aliases: ["numerodeserie", "nserie", "serial", "numeroserie", "serialnumber"] },
  {
    field: "cartridgeCapacity",
    aliases: ["capacidadedecartuchos", "capacidadecartuchos"],
    transform: toIntOrUndefined
  },
  { field: "operatingMode", aliases: ["regimedefuncionamento", "regimefuncionamento"] },
  { field: "barrelCount", aliases: ["quantidadedecanos", "qtdcanos"], transform: toIntOrUndefined },
  { field: "barrelLength", aliases: ["comprimentodocano", "comprimentocano"], transform: toNumberOrUndefined },
  { field: "boreType", aliases: ["tipodealma", "alma"] },
  {
    field: "kineticEnergyJ",
    aliases: ["energiacineticadamunicao", "energiacinetica", "joules"],
    transform: toNumberOrUndefined
  },
  { field: "useClassification", aliases: ["classificacaodeuso", "classificacao"] },
  { field: "sigmaRegistrationNumber", aliases: ["sigma", "sinarm", "registrosigma", "numerosigma"] },
  { field: "origin", aliases: ["procedencia", "origin"] },
  { field: "weaponStatus", aliases: ["situacao", "situacaodaarma"] },
  { field: "manufacturingLotNumber", aliases: ["lote", "lotefabricacao", "numerodolote"] },
  { field: "packageBarcode", aliases: ["codigodebarras", "barcode", "codigoembalagem"] },
  { field: "notes", aliases: ["observacoes", "obs", "notes"] }
];

// ---------------------------------------------------------------------------
// "Relatório de Produtos" de ERP de loja de armas (ex.: Procfy) — formato
// FIXO e bem diferente de uma planilha comum: cabeçalho não é a primeira
// linha (linhas acima têm nome/endereço da empresa e título do relatório),
// usa células mescladas (o texto de "Nome Produto" fica deslocado uma
// coluna em relação à célula de dado real), repete o cabeçalho a cada
// página, e tem uma linha de rodapé ("Emissão:"/"Página:") entre blocos.
// Detectado automaticamente pela presença do cabeçalho "Cód. Produto" —
// se não achar, cai pro importador genérico por alias de cabeçalho.
//
// Mapeamento de colunas (fixo, por posição — índice 0 = coluna A):
// A=Cód.Produto(SKU) D=Nome Produto L=Categoria P=Qtde. S=Tabela 1(preço)
// V=Ativo(S/N) X=Controla Est.(S/N) AC=Un. AE=NCM AG=Cod.Forne. AM=Custo Un.
// Ver docs/MANUAL_TECNICO.md.
const GUN_STORE_REPORT_COL = {
  SKU: 0,
  NAME: 3,
  CATEGORY: 11,
  QTY: 15,
  PRICE: 18,
  ACTIVE: 21,
  CONTROL_STOCK: 23,
  UNIT: 28,
  NCM: 30,
  COST: 38
};

// Números em formato pt-BR ("3.000,00", "R$ 7,80") OU já em formato
// programático com ponto decimal ("6797.64", a coluna "Custo Un." deste
// relatório vem assim) — remove tudo que não é dígito/vírgula/ponto/sinal
// primeiro, depois decide o separador decimal pela presença de vírgula.
const parseBrazilianDecimal = (raw: any): number | undefined => {
  const cleaned = String(raw ?? "").replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) return undefined;
  let normalized = cleaned;
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(normalized);
  return Number.isNaN(n) ? undefined : n;
};

// Marca: busca textual simples (lista de marcas conhecidas no mercado
// brasileiro de armas/munição) na descrição do produto — funciona bem
// quando a marca aparece explícita (ex. "MUN CBC...", "PISTOLA GLOCK...").
// NÃO tenta reconhecer por código de modelo (ex. "G2C" = Taurus) — fora do
// escopo combinado com o cliente ("só se tiver no arquivo"); produto cuja
// descrição não cita a marca fica em branco pra preencher manual.
const KNOWN_BRANDS = [
  "TAURUS", "CBC", "GLOCK", "IMBRAMUN", "IMBEL", "ROSSI", "BRAZTECH",
  "BERETTA", "SIG SAUER", "SIG", "COLT", "SMITH & WESSON", "S&W",
  "WALTHER", "MOSSBERG", "WINCHESTER", "REMINGTON", "SAVAGE", "RUGER",
  "HECKLER & KOCH", "FN", "BOITO", "CZ"
];

const extractBrandFromName = (name: string): string | undefined => {
  const upper = name.toUpperCase();
  for (const brand of KNOWN_BRANDS) {
    if (upper.includes(brand)) return brand === "S&W" ? "SMITH & WESSON" : brand;
  }
  return undefined;
};

// Calibre: só padrões de alta confiança (evita marcar um código de modelo
// ou comprimento de cano como se fosse calibre) — notação com ponto
// (".38TPC", ".380"), com X (handgun/rifle, "9X19"), bitola de espingarda
// ("12/70"), "MM" explícito, ou sufixo de cartucho conhecido colado no
// número ("380ACP", "38SPL", "22RL", "357MAG").
const CALIBER_PATTERNS = [
  /\.\d{2,3}\s?(?:ACP|TPC|SPL|MAG|AUTO|LUGER|S&W)?/,
  /\b\d{1,2}X\d{1,2}\b/,
  /\b\d{1,2}\/\d{2,3}\b/,
  /\b\d{1,2}\s?MM\b/,
  /\b\d{2,3}\s?(?:ACP|TPC|SPL|MAG|AUTO|LUGER|RL|LR|GA|S&W)\b/
];

const extractCaliberFromName = (name: string): string | undefined => {
  const upper = name.toUpperCase();
  for (const pattern of CALIBER_PATTERNS) {
    const match = upper.match(pattern);
    if (match) return match[0].trim();
  }
  return undefined;
};

// Categoria do relatório -> type/weaponType do FinanceProduct (Fase 6).
const WEAPON_CATEGORY_MAP: Record<string, string> = {
  pistola: "pistol",
  revolver: "revolver",
  fuzil: "rifle",
  rifle: "rifle",
  carabina: "carbine",
  espingarda: "shotgun",
  submetralhadora: "submachine_gun",
  arma: ""
};
const AMMO_CATEGORIES = new Set(["municao", "espoleta", "cartela", "polvora", "insumo"]);

const categorizeFromReportCategory = (rawCategory: string): { type: string; weaponType?: string } => {
  const normalized = normalizeHeader(rawCategory);
  if (normalized in WEAPON_CATEGORY_MAP) {
    const weaponType = WEAPON_CATEGORY_MAP[normalized];
    return weaponType ? { type: "weapon", weaponType } : { type: "weapon" };
  }
  if (AMMO_CATEGORIES.has(normalized)) {
    return { type: "ammunition" };
  }
  return { type: "product" };
};

const parseGunStoreReport = (filePath: string): Record<string, any>[] | null => {
  const workbook = XLSX.readFile(filePath);
  const worksheet = head(Object.values(workbook.Sheets)) as any;
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: true }) as any[][];

  const headerRowIndex = rows.findIndex(
    (row) => String(row[GUN_STORE_REPORT_COL.SKU] || "").trim() === "Cód. Produto"
  );

  if (headerRowIndex === -1) {
    // Diagnóstico temporário (v2.3.100): se a detecção falhar, loga o que
    // de fato está em cada uma das 15 primeiras linhas da coluna A, pra
    // achar a diferença exata (acento/espaço/encoding) em vez de adivinhar
    // — já aconteceu de bater em teste local e falhar em produção sem
    // explicação aparente. Ver docs/MANUAL_TECNICO.md.
    const firstColumnSample = rows.slice(0, 15).map((row, idx) => ({
      row: idx,
      value: row?.[GUN_STORE_REPORT_COL.SKU]
    }));
    logger.info(
      `[FinanceImportService] parseGunStoreReport: cabeçalho "Cód. Produto" não encontrado. ` +
        `xlsx version=${(XLSX as any).version}. Primeiras linhas da coluna A: ${JSON.stringify(firstColumnSample)}`
    );
    return null;
  }

  const records: Record<string, any>[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const sku = String(row[GUN_STORE_REPORT_COL.SKU] || "").trim();
    // Pula linha em branco, cabeçalho repetido (próxima página) e rodapé
    // ("Emissão: .../Página: ...") entre blocos de produto.
    if (!sku || sku === "Cód. Produto" || /^emiss/i.test(sku)) continue;

    const name = String(row[GUN_STORE_REPORT_COL.NAME] || "").trim();
    if (!name) continue;

    const category = String(row[GUN_STORE_REPORT_COL.CATEGORY] || "").trim();
    const { type, weaponType } = categorizeFromReportCategory(category);

    const data: Record<string, any> = {
      name,
      sku,
      type,
      unit: String(row[GUN_STORE_REPORT_COL.UNIT] || "UN").trim() || "UN",
      ncm: String(row[GUN_STORE_REPORT_COL.NCM] || "").trim(),
      active: String(row[GUN_STORE_REPORT_COL.ACTIVE] || "").trim().toUpperCase() !== "N",
      controlStock: String(row[GUN_STORE_REPORT_COL.CONTROL_STOCK] || "").trim().toUpperCase() === "S"
    };
    if (weaponType) data.weaponType = weaponType;

    const price = parseBrazilianDecimal(row[GUN_STORE_REPORT_COL.PRICE]);
    if (price !== undefined) data.price = String(price);
    const costPrice = parseBrazilianDecimal(row[GUN_STORE_REPORT_COL.COST]);
    if (costPrice !== undefined) data.costPrice = String(costPrice);
    const stockQuantity = parseBrazilianDecimal(row[GUN_STORE_REPORT_COL.QTY]);
    if (stockQuantity !== undefined) data.stockQuantity = stockQuantity;

    const brand = extractBrandFromName(name);
    if (brand) data.brand = brand;
    if (type === "weapon" || type === "ammunition") {
      const caliber = extractCaliberFromName(name);
      if (caliber) data.caliber = caliber;
    }

    records.push(data);
  }

  return records;
};

const upsertProductRecord = async (
  data: Record<string, any>,
  companyId: number,
  summary: ImportSummary
): Promise<void> => {
  if (!data.name) {
    summary.invalid += 1;
    return;
  }
  summary.total += 1;

  try {
    const sku = data.sku ? String(data.sku).trim() : "";
    const where: any = sku ? { companyId, sku } : { companyId, name: data.name };
    const existing = await FinanceProduct.findOne({ where });

    if (existing) {
      await FinanceProductService.update(existing.id, data as any, companyId);
      summary.updated += 1;
    } else {
      await FinanceProductService.create(data as any, companyId);
      summary.created += 1;
    }
  } catch (err: any) {
    summary.invalid += 1;
    summary.errors.push(`${data.name}: ${err.message}`);
  }
};

export const importProducts = async (
  companyId: number,
  file: Express.Multer.File
): Promise<ImportSummary> => {
  const summary: ImportSummary = { total: 0, created: 0, updated: 0, invalid: 0, errors: [] };

  const gunStoreRecords = parseGunStoreReport(file.path);
  const records = gunStoreRecords ?? readRows(file.path).map((row) => mapRow(row, PRODUCT_MAPPINGS));

  for (const data of records) {
    await upsertProductRecord(data, companyId, summary);
  }

  return summary;
};

// ---------------------------------------------------------------------------
// Clientes / Fornecedores — mesmos campos, dedup por documento (CPF/CNPJ) ou
// nome quando o documento não vier preenchido na planilha.
// ---------------------------------------------------------------------------

const buildPersonMappings = (extra: FieldMapping[] = []): FieldMapping[] => [
  { field: "name", aliases: ["nome", "name", "razaosocial", "cliente", "fornecedor"] },
  { field: "document", aliases: DOCUMENT_ALIASES, transform: (raw) => String(raw).replace(/\D/g, "") || String(raw).trim() },
  {
    field: "documentType",
    aliases: ["tipodedocumento", "tipodocumento"],
    transform: (raw) => {
      const normalized = normalizeHeader(raw);
      if (normalized === "cnpj") return "cnpj";
      if (normalized === "ruc") return "ruc";
      return "cpf";
    }
  },
  { field: "email", aliases: EMAIL_ALIASES },
  { field: "phone", aliases: PHONE_ALIASES },
  ...ADDRESS_MAPPINGS,
  { field: "notes", aliases: ["observacoes", "obs", "notes"] },
  ...extra
];

const CUSTOMER_MAPPINGS = buildPersonMappings();
const SUPPLIER_MAPPINGS = buildPersonMappings([
  { field: "contactName", aliases: ["pessoadecontato", "contato", "contactname"] }
]);

// Documento (CPF/CNPJ) sem máscara tem 11 ou 14 dígitos — quando a planilha
// não traz uma coluna de tipo de documento, infere pelo tamanho em vez de
// deixar sempre como "cpf" (default do modelo), que erraria pra toda
// importação de fornecedor (maioria PJ/CNPJ).
const inferDocumentType = (data: Record<string, any>): string | undefined => {
  if (data.documentType) return undefined;
  const digits = String(data.document || "").replace(/\D/g, "");
  if (digits.length === 14) return "cnpj";
  if (digits.length === 11) return "cpf";
  return undefined;
};

export const importCustomers = async (
  companyId: number,
  file: Express.Multer.File
): Promise<ImportSummary> => {
  const rows = readRows(file.path);
  const summary: ImportSummary = { total: 0, created: 0, updated: 0, invalid: 0, errors: [] };

  for (const row of rows) {
    const data = mapRow(row, CUSTOMER_MAPPINGS);
    if (!data.name) {
      summary.invalid += 1;
      continue;
    }
    summary.total += 1;

    const inferredType = inferDocumentType(data);
    if (inferredType) data.documentType = inferredType;

    try {
      const document = data.document ? String(data.document).trim() : "";
      const where: any = document ? { companyId, document } : { companyId, name: data.name };
      const existing = await FinanceCustomer.findOne({ where });

      if (existing) {
        await FinanceCustomerService.update(existing.id, data as any, companyId);
        summary.updated += 1;
      } else {
        await FinanceCustomerService.create(data as any, companyId);
        summary.created += 1;
      }
    } catch (err: any) {
      summary.invalid += 1;
      summary.errors.push(`${data.name}: ${err.message}`);
    }
  }

  return summary;
};

export const importSuppliers = async (
  companyId: number,
  file: Express.Multer.File
): Promise<ImportSummary> => {
  const rows = readRows(file.path);
  const summary: ImportSummary = { total: 0, created: 0, updated: 0, invalid: 0, errors: [] };

  for (const row of rows) {
    const data = mapRow(row, SUPPLIER_MAPPINGS);
    if (!data.name) {
      summary.invalid += 1;
      continue;
    }
    summary.total += 1;

    const inferredType = inferDocumentType(data);
    if (inferredType) data.documentType = inferredType;

    try {
      const document = data.document ? String(data.document).trim() : "";
      const where: any = document ? { companyId, document } : { companyId, name: data.name };
      const existing = await FinanceSupplier.findOne({ where });

      if (existing) {
        await FinanceSupplierService.update(existing.id, data as any, companyId);
        summary.updated += 1;
      } else {
        await FinanceSupplierService.create(data as any, companyId);
        summary.created += 1;
      }
    } catch (err: any) {
      summary.invalid += 1;
      summary.errors.push(`${data.name}: ${err.message}`);
    }
  }

  return summary;
};
