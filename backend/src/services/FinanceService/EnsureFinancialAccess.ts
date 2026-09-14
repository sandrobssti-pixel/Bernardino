import Company from "../../models/Company";
import Plan from "../../models/Plan";

interface RequestUser {
  companyId: number;
  profile: string;
  super?: boolean;
  financialAccess?: boolean;
}

// Módulo Financeiro completo é um add-on pago (ver docs/MANUAL_TECNICO.md,
// seção 6.2): só existe se o plano da empresa incluir (Plan.useFinancial).
// Dentro de uma empresa que tem o módulo, Admin sempre tem acesso; um
// usuário comum ("user") só se o Admin da empresa liberou (User.financialAccess).
// O Master tem acesso a todas as funcionalidades do sistema — inclusive esta
// — independente do plano da própria empresa dele (companyId 1); os dados
// continuam isolados por companyId, então isso nunca dá acesso aos cadastros
// financeiros de uma empresa-cliente real, só aos do próprio ambiente dele.
interface AccessStatus {
  planHasModule: boolean;
  hasAccess: boolean;
}

// Usado pela tela (menu/tabs do Financeiro) pra decidir o que mostrar: se o
// plano não tem o módulo, mostra "fale com o Master"; se tem mas o usuário
// não foi liberado, mostra "peça pro seu Admin liberar".
export const GetFinancialAccessStatus = async (
  user: RequestUser
): Promise<AccessStatus> => {
  if (!user) return { planHasModule: false, hasAccess: false };
  if (user.super) return { planHasModule: true, hasAccess: true };

  const company = await Company.findByPk(user.companyId, {
    include: [{ model: Plan, as: "plan", attributes: ["useFinancial"] }]
  });

  const planHasModule = !!(company as any)?.plan?.useFinancial;
  if (!planHasModule) return { planHasModule: false, hasAccess: false };

  const hasAccess = user.profile === "admin" || !!user.financialAccess;
  return { planHasModule: true, hasAccess };
};

const EnsureFinancialAccess = async (user: RequestUser): Promise<boolean> => {
  const { hasAccess } = await GetFinancialAccessStatus(user);
  return hasAccess;
};

export default EnsureFinancialAccess;
