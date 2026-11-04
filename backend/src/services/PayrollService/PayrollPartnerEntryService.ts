import AppError from "../../errors/AppError";
import CompanyPartner from "../../models/CompanyPartner";
import PayrollPartnerEntry from "../../models/PayrollPartnerEntry";
import { calculatePartnerPayroll } from "./PayrollCalculationService";
import { validateCompetency, referenceDateFor } from "./PayrollEntryService";

// Folha de pró-labore dos Sócios (RH) — mesmo espírito de
// PayrollEntryService.ts (upsert por competência, batch que pula sócio
// inativo/com erro individual sem derrubar o lote), tabela própria
// (PayrollPartnerEntry) por sócio NÃO ser Funcionário — ver
// PayrollCalculationService.calculatePartnerPayroll e a migration de
// criação pro raciocínio completo.

interface CalculateRequest {
  companyId: number;
  partnerId: number | string;
  competencyMonth: number;
  competencyYear: number;
}

interface CalculateAllRequest {
  companyId: number;
  competencyMonth: number;
  competencyYear: number;
}

interface ListRequest {
  companyId: number;
  partnerId?: number | string;
  competencyMonth?: number | string;
  competencyYear?: number | string;
  pageNumber?: number | string;
}

interface ListResponse {
  records: PayrollPartnerEntry[];
  count: number;
  hasMore: boolean;
}

export const calculateAndSave = async ({
  companyId,
  partnerId,
  competencyMonth,
  competencyYear
}: CalculateRequest): Promise<PayrollPartnerEntry> => {
  validateCompetency(competencyMonth, competencyYear);

  const partner = await CompanyPartner.findOne({ where: { id: partnerId, companyId } });
  if (!partner) {
    throw new AppError("ERR_COMPANY_PARTNER_NOT_FOUND", 404);
  }

  const result = await calculatePartnerPayroll(partner, referenceDateFor(competencyMonth, competencyYear));

  const existing = await PayrollPartnerEntry.findOne({
    where: { partnerId: partner.id, competencyMonth, competencyYear, companyId }
  });

  const payload = {
    companyId,
    partnerId: partner.id,
    competencyMonth,
    competencyYear,
    prolaboreSnapshot: result.prolaboreValue,
    inssBase: result.inssBase,
    inssValue: result.inssValue,
    inssTableId: result.inssTableId,
    irrfBase: result.irrfBase,
    irrfValue: result.irrfValue,
    irrfReductionValue: result.irrfReductionValue,
    irrfTableId: result.irrfTableId,
    netValue: result.netValue,
    calculatedAt: new Date()
  };

  if (existing) {
    await existing.update(payload);
    return existing;
  }

  return PayrollPartnerEntry.create(payload as any);
};

// Calcula e grava o pró-labore de TODOS os sócios ATIVOS da empresa
// numa competência — pula sócio que der erro individual (ex.: sem
// pró-labore cadastrado não é erro, vira R$0,00; o try/catch é pra
// qualquer outro problema inesperado), retornando o motivo em
// `skipped` em vez de derrubar o lote inteiro (mesmo padrão de
// `PayrollEntryService.calculateAndSaveAll`).
export const calculateAndSaveAll = async ({
  companyId,
  competencyMonth,
  competencyYear
}: CalculateAllRequest): Promise<{
  entries: PayrollPartnerEntry[];
  skipped: Array<{ partnerId: number; name: string; reason: string }>;
}> => {
  validateCompetency(competencyMonth, competencyYear);

  const partners = await CompanyPartner.findAll({
    where: { companyId, partnerStatus: "active" }
  });

  const entries: PayrollPartnerEntry[] = [];
  const skipped: Array<{ partnerId: number; name: string; reason: string }> = [];

  for (const partner of partners) {
    try {
      const entry = await calculateAndSave({
        companyId,
        partnerId: partner.id,
        competencyMonth,
        competencyYear
      });
      entries.push(entry);
    } catch (err: any) {
      skipped.push({
        partnerId: partner.id,
        name: partner.name,
        reason: err?.message || "ERR_PAYROLL_PARTNER_CALCULATION_FAILED"
      });
    }
  }

  return { entries, skipped };
};

export const list = async ({
  companyId,
  partnerId,
  competencyMonth,
  competencyYear,
  pageNumber = "1"
}: ListRequest): Promise<ListResponse> => {
  const limit = 50;
  const offset = limit * (+pageNumber - 1);

  const whereCondition: any = { companyId };
  if (partnerId) whereCondition.partnerId = partnerId;
  if (competencyMonth) whereCondition.competencyMonth = competencyMonth;
  if (competencyYear) whereCondition.competencyYear = competencyYear;

  const { count, rows: records } = await PayrollPartnerEntry.findAndCountAll({
    where: whereCondition,
    include: [{ model: CompanyPartner, as: "partner", attributes: ["id", "name"] }],
    limit,
    offset,
    order: [
      ["competencyYear", "DESC"],
      ["competencyMonth", "DESC"],
      ["id", "ASC"]
    ]
  });

  return { records, count, hasMore: count > offset + records.length };
};

export const remove = async (id: string | number, companyId: number): Promise<void> => {
  const record = await PayrollPartnerEntry.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_PAYROLL_ENTRY_NOT_FOUND", 404);
  }
  await record.destroy();
};
