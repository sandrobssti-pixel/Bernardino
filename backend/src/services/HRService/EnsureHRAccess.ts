import Company from "../../models/Company";
import Plan from "../../models/Plan";

interface RequestUser {
  companyId: number;
  profile: string;
  super?: boolean;
  hrAccess?: boolean;
}

interface AccessStatus {
  planHasModule: boolean;
  hasAccess: boolean;
}

// Módulo de RH/recrutamento (Fase 5, ver docs/MANUAL_TECNICO.md, seção 6.2)
// é um add-on independente do Financeiro/Fiscal (Plan.useHR) — não exige
// nenhum dos outros módulos ativos. Dentro de uma empresa que tem o módulo,
// Admin sempre tem acesso; um usuário comum só se o Admin liberou
// (User.hrAccess). Master tem acesso total, isolado por companyId.
export const GetHRAccessStatus = async (
  user: RequestUser
): Promise<AccessStatus> => {
  if (!user) return { planHasModule: false, hasAccess: false };
  if (user.super) return { planHasModule: true, hasAccess: true };

  const company = await Company.findByPk(user.companyId, {
    include: [{ model: Plan, as: "plan", attributes: ["useHR"] }]
  });

  const planHasModule = !!(company as any)?.plan?.useHR;
  if (!planHasModule) return { planHasModule: false, hasAccess: false };

  const hasAccess = user.profile === "admin" || !!user.hrAccess;
  return { planHasModule: true, hasAccess };
};

const EnsureHRAccess = async (user: RequestUser): Promise<boolean> => {
  const { hasAccess } = await GetHRAccessStatus(user);
  return hasAccess;
};

export default EnsureHRAccess;
