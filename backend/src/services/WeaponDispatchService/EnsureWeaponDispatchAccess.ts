import Company from "../../models/Company";
import Plan from "../../models/Plan";

interface RequestUser {
  companyId: number;
  profile: string;
  super?: boolean;
  weaponDispatchAccess?: boolean;
}

interface AccessStatus {
  planHasModule: boolean;
  hasAccess: boolean;
}

// Despachante Bélico (gestão de processo CAC/Posse-Porte/Militar) é um
// add-on independente do Financeiro/Fiscal (Plan.useWeaponDispatch) — não
// exige nenhum dos outros módulos ativos (mesmo padrão de
// EnsureHRAccess.ts). Dentro de uma empresa que tem o módulo, Admin sempre
// tem acesso; um usuário comum só se o Admin liberou
// (User.weaponDispatchAccess). Master tem acesso total, isolado por
// companyId.
export const GetWeaponDispatchAccessStatus = async (
  user: RequestUser
): Promise<AccessStatus> => {
  if (!user) return { planHasModule: false, hasAccess: false };
  if (user.super) return { planHasModule: true, hasAccess: true };

  const company = await Company.findByPk(user.companyId, {
    include: [{ model: Plan, as: "plan", attributes: ["useWeaponDispatch"] }]
  });

  const planHasModule = !!(company as any)?.plan?.useWeaponDispatch;
  if (!planHasModule) return { planHasModule: false, hasAccess: false };

  const hasAccess = user.profile === "admin" || !!user.weaponDispatchAccess;
  return { planHasModule: true, hasAccess };
};

const EnsureWeaponDispatchAccess = async (user: RequestUser): Promise<boolean> => {
  const { hasAccess } = await GetWeaponDispatchAccessStatus(user);
  return hasAccess;
};

export default EnsureWeaponDispatchAccess;
