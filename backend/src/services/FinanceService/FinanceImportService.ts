import { head } from "lodash";
import XLSX from "xlsx";
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

export const importProducts = async (
  companyId: number,
  file: Express.Multer.File
): Promise<ImportSummary> => {
  const rows = readRows(file.path);
  const summary: ImportSummary = { total: 0, created: 0, updated: 0, invalid: 0, errors: [] };

  for (const row of rows) {
    const data = mapRow(row, PRODUCT_MAPPINGS);
    if (!data.name) {
      summary.invalid += 1;
      continue;
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
