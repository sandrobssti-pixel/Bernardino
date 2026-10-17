import XLSX from "xlsx";
import { head } from "lodash";
import moment from "moment";
import Sale from "../../models/Sale";
import SaleItem from "../../models/SaleItem";
import FiscalDocument from "../../models/FiscalDocument";
import FinanceCustomer from "../../models/FinanceCustomer";
import FinanceProduct from "../../models/FinanceProduct";
import FinanceReceivable from "../../models/FinanceReceivable";

// Importação de vendas históricas já faturadas no sistema anterior do
// cliente (migração de ERP — pedido do cliente, v2.3.116) — formato
// "Relatório de Notas" (Consulta de Notas Fiscais - Analítico), um
// relatório de posição FIXA de coluna, parecido com o "Relatório de
// Produtos" (`parseGunStoreReport` em FinanceImportService.ts), mas com
// bloco de tamanho VARIÁVEL por nota (depende de quantos itens ela tem),
// então é parseado por reconhecimento de padrão linha a linha (máquina de
// estados), não por offset fixo. Ver docs/MANUAL_TECNICO.md.
//
// ⚠️ Diferente de uma venda nova: essas vendas JÁ aconteceram e JÁ têm nota
// fiscal de verdade emitida no sistema anterior — a importação só
// REGISTRA o que já existe (número da nota, itens, cliente), nunca chama o
// gateway (Focus NFe) pra emitir nada novo. Também NUNCA mexe em estoque
// (`FinanceProduct.stockQuantity`) — confirmado com o cliente: só venda
// lançada a partir de agora desconta estoque, histórico não.
//
// A v2.3.139 chegou a adicionar (e a v2.3.140 removeu) um opt-in de baixa
// de estoque na tela — foi usado uma única vez pras notas 492/493
// (emitidas direto no painel da Focus, fora do AtendeFlow) e o cliente
// pediu pra tirar de novo, pra não ficar como opção permanente arriscando
// baixa duplicada em importação futura. O ajuste daquelas duas notas
// específicas foi feito manualmente no cadastro dos produtos.

const NOTE_COL = { NUMBER: 0, DATE: 3, CUSTOMER: 4, DOCUMENT: 11, STATUS: 12, TOTAL: 36 };
const ITEM_COL = { SKU: 1, DESCRIPTION: 5, NCM: 14, CFOP: 17, UNIT: 20, UNIT_PRICE: 24, QUANTITY: 29, TOTAL: 34 };

const KNOWN_STATUSES = new Set(["Aprovada", "Cancelada", "NF-e Rejeitado"]);

// Pedido do cliente: importa as 3 situações, cada uma com o equivalente
// mais próximo no nosso modelo. "NF-e Rejeitado" vira venda confirmada
// (a mercadoria foi vendida de verdade) mas com o FiscalDocument marcado
// como erro (a nota em si nunca foi validada pela Sefaz).
const STATUS_MAP: Record<string, { sale: string; doc: string }> = {
  Aprovada: { sale: "confirmed", doc: "authorized" },
  Cancelada: { sale: "cancelled", doc: "cancelled" },
  "NF-e Rejeitado": { sale: "confirmed", doc: "error" }
};

// Esse relatório usa separador de milhar "," e decimal "." (formato
// americano, ex. "5,100.00") — diferente do `parseBrazilianDecimal` já
// usado nos outros importadores (que espera o formato brasileiro inverso),
// não dá pra reaproveitar aquele helper aqui.
const parseUsNumber = (raw: unknown): number => {
  const n = parseFloat(String(raw ?? "").replace(/,/g, "").trim());
  return Number.isNaN(n) ? 0 : n;
};

interface ParsedNoteItem {
  sku: string;
  description: string;
  ncm: string;
  cfop: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface ParsedNote {
  number: string;
  date: string;
  customerName: string;
  customerDocument: string;
  status: string;
  totalValue: number;
  items: ParsedNoteItem[];
}

const isHeaderRow = (row: any[]): boolean => {
  const number = String(row[NOTE_COL.NUMBER] ?? "").trim();
  const date = String(row[NOTE_COL.DATE] ?? "").trim();
  const status = String(row[NOTE_COL.STATUS] ?? "").trim();
  return /^\d+$/.test(number) && date.includes("/") && KNOWN_STATUSES.has(status);
};

const isItemRow = (row: any[]): boolean =>
  String(row[ITEM_COL.SKU] ?? "").trim() !== "" && String(row[ITEM_COL.DESCRIPTION] ?? "").trim() !== "";

const isSummaryRow = (row: any[]): boolean =>
  String(row[NOTE_COL.NUMBER] ?? "").trim().startsWith("Qtde Produtos:");

export const parseNotesReport = (filePath: string): ParsedNote[] => {
  const workbook = XLSX.readFile(filePath);
  const worksheet = head(Object.values(workbook.Sheets)) as any;
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" });

  const notes: ParsedNote[] = [];
  let current: ParsedNote | null = null;

  for (const row of rows) {
    if (isHeaderRow(row)) {
      if (current) notes.push(current);
      current = {
        number: String(row[NOTE_COL.NUMBER]).trim(),
        date: String(row[NOTE_COL.DATE]).trim(),
        customerName: String(row[NOTE_COL.CUSTOMER] ?? "").trim(),
        customerDocument: String(row[NOTE_COL.DOCUMENT] ?? "").replace(/\D/g, ""),
        status: String(row[NOTE_COL.STATUS]).trim(),
        totalValue: parseUsNumber(row[NOTE_COL.TOTAL]),
        items: []
      };
      continue;
    }

    if (current && isItemRow(row)) {
      const quantity = parseUsNumber(row[ITEM_COL.QUANTITY]);
      const unitPrice = parseUsNumber(row[ITEM_COL.UNIT_PRICE]);
      current.items.push({
        sku: String(row[ITEM_COL.SKU]).trim(),
        description: String(row[ITEM_COL.DESCRIPTION]).trim(),
        ncm: String(row[ITEM_COL.NCM] ?? "").trim(),
        cfop: String(row[ITEM_COL.CFOP] ?? "").trim(),
        unit: String(row[ITEM_COL.UNIT] ?? "UN").trim() || "UN",
        quantity,
        unitPrice,
        totalPrice: parseUsNumber(row[ITEM_COL.TOTAL]) || quantity * unitPrice
      });
      continue;
    }

    // `isSummaryRow`/linhas em branco/rodapé de página não precisam de
    // ação — só não devem ser confundidas com header/item (já garantido
    // pelas checagens acima, que não capturam essas linhas).
  }

  if (current) notes.push(current);

  return notes;
};

export type SaleImportSummary = {
  total: number;
  created: number;
  skipped: number;
  errors: string[];
};

const findOrCreateCustomer = async (
  name: string,
  document: string,
  companyId: number
): Promise<FinanceCustomer | null> => {
  if (!name) return null;

  const where: any = document ? { companyId, document } : { companyId, name };
  const existing = await FinanceCustomer.findOne({ where });
  if (existing) return existing;

  const documentType = document.length === 14 ? "cnpj" : "cpf";
  return FinanceCustomer.create({ name, document, documentType, companyId } as any);
};

export const importSales = async (
  companyId: number,
  file: Express.Multer.File
): Promise<SaleImportSummary> => {
  console.log(`[SaleImportService] importSales: iniciando, arquivo=${file.path}`);

  const notes = parseNotesReport(file.path);
  const summary: SaleImportSummary = { total: notes.length, created: 0, skipped: 0, errors: [] };

  for (const note of notes) {
    try {
      // Idempotente: reimportar a mesma planilha não duplica — já existe
      // um FiscalDocument marcado como importado com esse número de nota.
      const existingDoc = await FiscalDocument.findOne({
        where: { companyId, number: note.number, externalRef: `legado-nf-${note.number}` }
      });
      if (existingDoc) {
        summary.skipped += 1;
        continue;
      }

      const statusInfo = STATUS_MAP[note.status];
      if (!statusInfo) {
        summary.skipped += 1;
        summary.errors.push(`Nota ${note.number}: status "${note.status}" não reconhecido.`);
        continue;
      }

      const saleDate = moment(note.date, "DD/MM/YYYY HH:mm:ss");
      const customer = await findOrCreateCustomer(note.customerName, note.customerDocument, companyId);

      const sale = await Sale.create({
        saleDate: saleDate.isValid() ? saleDate.format("YYYY-MM-DD") : null,
        status: statusInfo.sale,
        totalValue: String(note.totalValue),
        notes: `Importado do sistema anterior — Nº NF ${note.number}`,
        customerId: customer?.id || null,
        companyId
      } as any);

      if (note.items.length > 0) {
        const itemRows = await Promise.all(
          note.items.map(async item => {
            const product = item.sku
              ? await FinanceProduct.findOne({ where: { companyId, sku: item.sku } })
              : null;
            return {
              saleId: sale.id,
              productId: product?.id || null,
              description: item.description,
              sku: item.sku,
              ncm: item.ncm,
              cfop: item.cfop || "5102",
              unit: item.unit,
              quantity: String(item.quantity),
              unitPrice: String(item.unitPrice),
              totalPrice: String(item.totalPrice)
            };
          })
        );
        await SaleItem.bulkCreate(itemRows as any);
      }

      await FiscalDocument.create({
        type: "nfe",
        status: statusInfo.doc,
        externalRef: `legado-nf-${note.number}`,
        number: note.number,
        errorMessage: statusInfo.doc === "error" ? "Importado do sistema anterior — nota rejeitada pela Sefaz." : "",
        issuedAt: saleDate.isValid() ? saleDate.toDate() : null,
        saleId: sale.id,
        companyId
      } as any);

      // Venda já estava fechada/recebida no sistema anterior — gera a
      // conta a receber já como "recebida" (pedido do cliente), pro
      // histórico financeiro ficar completo. Só pra venda "confirmed"
      // (Aprovada/Rejeitado) — "cancelled" não gera receita nenhuma.
      if (statusInfo.sale === "confirmed") {
        const receivable = await FinanceReceivable.create({
          description: `Venda #${sale.id} (importada) - Nº NF ${note.number}${customer ? ` - ${customer.name}` : ""}`,
          value: String(note.totalValue),
          dueDate: saleDate.isValid() ? saleDate.format("YYYY-MM-DD") : null,
          receivedDate: saleDate.isValid() ? saleDate.format("YYYY-MM-DD") : null,
          status: "received",
          customerId: customer?.id || null,
          companyId
        } as any);
        await sale.update({ receivableId: receivable.id });
      }

      summary.created += 1;
    } catch (err: any) {
      summary.skipped += 1;
      summary.errors.push(`Nota ${note.number}: ${err.message}`);
    }
  }

  console.log(`[SaleImportService] importSales: concluído ${JSON.stringify({ ...summary, errors: summary.errors.length })}`);
  return summary;
};
