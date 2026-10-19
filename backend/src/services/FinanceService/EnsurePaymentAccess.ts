import Company from "../../models/Company";
import Plan from "../../models/Plan";

interface RequestUser {
  companyId: number;
  profile: string;
  super?: boolean;
  financialAccess?: boolean;
}

interface AccessStatus {
  planHasModule: boolean;
  hasAccess: boolean;
}

// Cobrança via gateway (Pix/boleto, Mercado Pago/Asaas) é um add-on
// SEPARADO do Financeiro (Plan.usePayment), mesmo padrão de
// EnsureFiscalAccess — sempre EXIGE o Financeiro também ativo
// (Plan.useFinancial), já que a cobrança é gerada a partir de uma Conta a
// Receber, que pertence ao próprio Financeiro. Dentro de uma empresa que
// tem os dois módulos, Admin sempre tem acesso; um usuário comum só se o
// Admin da empresa liberou (mesmo campo User.financialAccess usado pelo
// Financeiro/Fiscal — não há um flag por-usuário separado pro pagamento).
// Master tem acesso total, isolado por companyId.
export const GetPaymentAccessStatus = async (
  user: RequestUser
): Promise<AccessStatus> => {
  if (!user) return { planHasModule: false, hasAccess: false };
  if (user.super) return { planHasModule: true, hasAccess: true };

  const company = await Company.findByPk(user.companyId, {
    include: [{ model: Plan, as: "plan", attributes: ["useFinancial", "usePayment"] }]
  });

  const plan = (company as any)?.plan;
  const planHasModule = !!(plan?.useFinancial && plan?.usePayment);
  if (!planHasModule) return { planHasModule: false, hasAccess: false };

  const hasAccess = user.profile === "admin" || !!user.financialAccess;
  return { planHasModule: true, hasAccess };
};

const EnsurePaymentAccess = async (user: RequestUser): Promise<boolean> => {
  const { hasAccess } = await GetPaymentAccessStatus(user);
  return hasAccess;
};

export default EnsurePaymentAccess;
