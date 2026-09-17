import * as Yup from "yup";
import AppError from "../../errors/AppError";
import SlaRule from "../../models/SlaRule";
import Queue from "../../models/Queue";

interface SlaRuleData {
  name: string;
  riskMinutes?: number;
  overdueMinutes?: number;
  queueId?: number | null;
}

const slaRuleSchema = Yup.object().shape({
  name: Yup.string().required("ERR_SLA_RULE_INVALID_NAME").min(2),
  riskMinutes: Yup.number().positive("ERR_SLA_RULE_INVALID_RISK_MINUTES"),
  overdueMinutes: Yup.number().positive("ERR_SLA_RULE_INVALID_OVERDUE_MINUTES")
});

const includeQueue = [{ model: Queue, as: "queue", attributes: ["id", "name", "color"] }];

export const list = async (companyId: number): Promise<SlaRule[]> => {
  return SlaRule.findAll({
    where: { companyId },
    include: includeQueue,
    order: [["name", "ASC"]]
  });
};

export const show = async (
  id: string | number,
  companyId: number
): Promise<SlaRule> => {
  const record = await SlaRule.findOne({
    where: { id, companyId },
    include: includeQueue
  });

  if (!record) {
    throw new AppError("ERR_SLA_RULE_NOT_FOUND", 404);
  }

  return record;
};

// O select de fila no frontend manda "" pra "padrão da empresa" (sem fila
// específica) — precisa virar null antes de chegar na coluna INTEGER.
const sanitize = (data: SlaRuleData): SlaRuleData => ({
  ...data,
  queueId: data.queueId === ("" as any) || data.queueId === undefined ? null : data.queueId
});

export const create = async (
  data: SlaRuleData,
  companyId: number
): Promise<SlaRule> => {
  try {
    await slaRuleSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const record = await SlaRule.create({ ...sanitize(data), companyId } as any);
  return show(record.id, companyId);
};

export const update = async (
  id: string | number,
  data: SlaRuleData,
  companyId: number
): Promise<SlaRule> => {
  const record = await show(id, companyId);

  try {
    await slaRuleSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await record.update(sanitize(data));
  return show(id, companyId);
};

export const remove = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const record = await show(id, companyId);
  await record.destroy();
};
