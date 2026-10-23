import Company from "../../models/Company";
import Plan from "../../models/Plan";

interface RequestUser {
  companyId: number;
  profile: string;
  super?: boolean;
  weaponArmoryAccess?: boolean;
}

interface AccessStatus {
  planHasModule: boolean;
  hasAccess: boolean;
}

// Serviço Armaria (recebimento de arma pra manutenção — termo de cautela,
// dados técnicos, fotos antes/depois, relatório final) é um add-on
// independente do Despachante Bélico (Plan.useWeaponArmory) — não exige
// nenhum dos outros módulos ativos, mesmo padrão de
// EnsureWeaponDispatchAccess.ts. Dentro de uma empresa que tem o módulo,
// Admin sempre tem acesso; um usuário comum só se o Admin liberou
// (User.weaponArmoryAccess). Master tem acesso total, isolado por
// companyId.
export const GetWeaponArmoryAccessStatus = async (
  user: RequestUser
): Promise<AccessStatus> => {
  if (!user) return { planHasModule: false, hasAccess: false };
  if (user.super) return { planHasModule: true, hasAccess: true };

  const company = await Company.findByPk(user.companyId, {
    include: [{ model: Plan, as: "plan", attributes: ["useWeaponArmory"] }]
  });

  const planHasModule = !!(company as any)?.plan?.useWeaponArmory;
  if (!planHasModule) return { planHasModule: false, hasAccess: false };

  const hasAccess = user.profile === "admin" || !!user.weaponArmoryAccess;
  return { planHasModule: true, hasAccess };
};

const EnsureWeaponArmoryAccess = async (user: RequestUser): Promise<boolean> => {
  const { hasAccess } = await GetWeaponArmoryAccessStatus(user);
  return hasAccess;
};

export default EnsureWeaponArmoryAccess;
