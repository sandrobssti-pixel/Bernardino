import { head } from "lodash";
import XLSX from "xlsx";
import Service from "../../models/Service";
import * as ServiceService from "./ServiceService";

// Importação de Serviços via planilha Excel — mesmo padrão (detecção
// automática de coluna por nome de cabeçalho, duplicata por nome atualiza
// o registro já existente) já usado em FinanceImportService.ts, mas
// reescrito aqui, self-contained e bem mais simples (só 5 campos, sem
// nada fiscal) — Serviço é propositalmente um módulo à parte do
// Financeiro (ver Service.ts). Ver docs/MANUAL_TECNICO.md.

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

type FieldMapping = { field: string; aliases: string[] };

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

const SERVICE_MAPPINGS: FieldMapping[] = [
  { field: "code", aliases: ["codigo", "código", "code"] },
  { field: "name", aliases: ["nome", "nomedoservico", "servico", "serviço", "name"] },
  { field: "value", aliases: ["valor", "valordoservico", "preco", "preço", "value"] },
  {
    field: "paymentTerms",
    aliases: ["condicoesdepagamento", "condicaodepagamento", "formadepagamento", "pagamento"]
  },
  { field: "description", aliases: ["descricao", "descrição", "description", "obs", "observacoes"] }
];

const mapRow = (row: Record<string, any>): Record<string, any> => {
  const data: Record<string, any> = {};
  SERVICE_MAPPINGS.forEach(({ field, aliases }) => {
    const raw = getRowValueByAliases(row, aliases);
    if (raw === undefined || raw === null || String(raw).trim() === "") return;
    data[field] = String(raw).trim();
  });
  return data;
};

export const importServices = async (
  companyId: number,
  file: Express.Multer.File
): Promise<ImportSummary> => {
  const summary: ImportSummary = { total: 0, created: 0, updated: 0, invalid: 0, errors: [] };
  const rows = readRows(file.path).map(mapRow);

  for (const data of rows) {
    if (!data.name) {
      summary.invalid += 1;
      continue;
    }
    summary.total += 1;

    try {
      const existing = await Service.findOne({ where: { companyId, name: data.name } });
      if (existing) {
        await ServiceService.update(existing.id, data as any, companyId);
        summary.updated += 1;
      } else {
        await ServiceService.create(data as any, companyId);
        summary.created += 1;
      }
    } catch (err: any) {
      summary.invalid += 1;
      summary.errors.push(`${data.name}: ${err.message}`);
    }
  }

  return summary;
};

const SERVICE_TEMPLATE_HEADERS = ["Código", "Nome do Serviço", "Valor", "Condições de Pagamento", "Descrição"];
const SERVICE_TEMPLATE_EXAMPLE = [
  "SRV-001",
  "Limpeza e manutenção preventiva",
  "150",
  "À vista ou Pix",
  "Linha de exemplo — pode apagar"
];

export const buildServiceTemplate = (): Buffer => {
  const worksheet = XLSX.utils.aoa_to_sheet([SERVICE_TEMPLATE_HEADERS, SERVICE_TEMPLATE_EXAMPLE]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
};
