import { addMonths, format } from "date-fns";
import AppError from "../../errors/AppError";
import Member from "../../models/Member";
import MemberMembershipCharge from "../../models/MemberMembershipCharge";
import FinanceReceivable from "../../models/FinanceReceivable";
import * as FinanceReceivableService from "../FinanceService/FinanceReceivableService";
import * as FinanceCustomerService from "../FinanceService/FinanceCustomerService";

// Cobrança de filiação/anuidade do associado — reaproveita o módulo
// Financeiro que já existe (confirmado com o cliente), em vez de um
// controle de pagamento separado: gera uma Conta a Receber normal
// (FinanceReceivable), só "etiquetada" com o período que ela cobre
// (MemberMembershipCharge). Quando o cliente pede pra NÃO passar pela
// Venda fiscal completa (NF-e, CFOP etc. — não fazia sentido pra uma
// simples cobrança de anuidade), a cobrança é criada direto. Ver
// docs/MANUAL_TECNICO.md.

const DATE_FMT = "yyyy-MM-dd";

const ensureFinanceCustomer = async (member: Member, companyId: number): Promise<number> => {
  if (member.financeCustomerId) return member.financeCustomerId;

  const customer = await FinanceCustomerService.create(
    {
      name: member.name,
      document: member.document,
      email: member.email,
      phone: member.phone,
      whatsapp: member.whatsapp,
      zipCode: member.zipCode,
      street: member.street,
      number: member.number,
      complement: member.complement,
      neighborhood: member.neighborhood,
      city: member.city,
      state: member.state,
      contactId: member.contactId || null
    } as any,
    companyId
  );

  member.financeCustomerId = customer.id;
  await member.save();
  return customer.id;
};

interface GenerateChargeData {
  periodMonths?: number;
  value?: string;
  dueDate?: string;
  description?: string;
}

// Confirmado com o cliente: a validade estende a partir do VENCIMENTO
// anterior (não da data do pagamento) — "vale até o fim do período
// coberto pela última paga", igual ao texto da tela de referência. Pagar
// adiantado não faz o associado perder os dias que ainda tinha.
export const generateCharge = async (
  memberId: string | number,
  data: GenerateChargeData,
  companyId: number
): Promise<MemberMembershipCharge> => {
  const member = await Member.findOne({ where: { id: memberId, companyId } });
  if (!member) {
    throw new AppError("ERR_MEMBER_NOT_FOUND", 404);
  }

  const periodMonths = data.periodMonths || 12;
  const today = new Date();
  const currentValidUntil = member.filiationValidUntil ? new Date(member.filiationValidUntil) : null;
  const coverageStartDate = currentValidUntil && currentValidUntil > today ? currentValidUntil : today;
  const coverageEndDate = addMonths(coverageStartDate, periodMonths);

  const customerId = await ensureFinanceCustomer(member, companyId);

  const description =
    data.description ||
    `Filiação ${format(coverageStartDate, DATE_FMT)} a ${format(coverageEndDate, DATE_FMT)} — ${member.name}`;

  const receivable = await FinanceReceivableService.create(
    {
      description,
      value: data.value || "0",
      dueDate: data.dueDate || format(today, DATE_FMT),
      status: "pending",
      customerId
    } as any,
    companyId
  );

  return MemberMembershipCharge.create({
    memberId: member.id,
    receivableId: receivable.id,
    periodMonths,
    coverageStart: format(coverageStartDate, DATE_FMT),
    coverageEnd: format(coverageEndDate, DATE_FMT),
    companyId
  } as any);
};

export const list = async (
  memberId: string | number,
  companyId: number
): Promise<MemberMembershipCharge[]> => {
  const member = await Member.findOne({ where: { id: memberId, companyId } });
  if (!member) {
    throw new AppError("ERR_MEMBER_NOT_FOUND", 404);
  }

  return MemberMembershipCharge.findAll({
    where: { memberId, companyId },
    include: [{ model: FinanceReceivable, as: "receivable" }],
    order: [["coverageStart", "DESC"]]
  });
};

// Chamado pelo hook @AfterSave de FinanceReceivable (ver
// models/FinanceReceivable.ts) sempre que uma conta a receber vira
// "received" — único jeito confiável de pegar os 4 pontos diferentes do
// código que marcam uma conta como paga (confirmado por pesquisa: 2
// webhooks de gateway, 1 caminho de criação-já-paga, e o update genérico
// da tela), sem precisar duplicar essa lógica em cada um deles.
export const onReceivablePaid = async (receivable: FinanceReceivable): Promise<void> => {
  const charge = await MemberMembershipCharge.findOne({
    where: { receivableId: receivable.id }
  });
  if (!charge) return; // conta a receber comum, não é cobrança de filiação

  const member = await Member.findByPk(charge.memberId);
  if (!member) return;

  member.filiationValidUntil = charge.coverageEnd;
  if (member.status !== "active") {
    member.status = "active";
  }
  await member.save();
};
