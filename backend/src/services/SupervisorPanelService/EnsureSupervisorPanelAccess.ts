import Company from "../../models/Company";
import Plan from "../../models/Plan";

interface RequestUser {
  companyId: number;
  profile: string;
  super?: boolean;
  supervisorPanelAccess?: boolean;
}

interface AccessStatus {
  planHasModule: boolean;
  hasAccess: boolean;
}

// Painel Vigia é um add-on (ver docs/MANUAL_TECNICO.md): só existe se o
// plano da empresa incluir (Plan.useSupervisorPanel). Dentro de uma empresa
// que tem o módulo, Admin sempre tem acesso; um usuário comum ("user") só se
// o Admin da empresa liberou (User.supervisorPanelAccess). O Master tem
// acesso a todas as funcionalidades do sistema, independente do plano do
// próprio ambiente dele — mesmo padrão do EnsureFinancialAccess/EnsureHRAccess.
export const GetSupervisorPanelAccessStatus = async (
  user: RequestUser
): Promise<AccessStatus> => {
  if (!user) return { planHasModule: false, hasAccess: false };
  if (user.super) return { planHasModule: true, hasAccess: true };

  const company = await Company.findByPk(user.companyId, {
    include: [{ model: Plan, as: "plan", attributes: ["useSupervisorPanel"] }]
  });

  const planHasModule = !!(company as any)?.plan?.useSupervisorPanel;
  if (!planHasModule) return { planHasModule: false, hasAccess: false };

  const hasAccess = user.profile === "admin" || !!user.supervisorPanelAccess;
  return { planHasModule: true, hasAccess };
};

const EnsureSupervisorPanelAccess = async (
  user: RequestUser
): Promise<boolean> => {
  const { hasAccess } = await GetSupervisorPanelAccessStatus(user);
  return hasAccess;
};

export default EnsureSupervisorPanelAccess;
