import Company from "../../models/Company";
import Plan from "../../models/Plan";

interface RequestUser {
  companyId: number;
  profile: string;
  super?: boolean;
  membersAccess?: boolean;
}

interface AccessStatus {
  planHasModule: boolean;
  hasAccess: boolean;
}

// Associados é um add-on independente do Financeiro/Despachante Bélico
// (Plan.useMembers) — mesmo padrão de EnsureWeaponDispatchAccess.ts. Dentro
// de uma empresa que tem o módulo, Admin sempre tem acesso; um usuário
// comum só se o Admin liberou (User.membersAccess). Master tem acesso
// total, isolado por companyId.
export const GetMembersAccessStatus = async (
  user: RequestUser
): Promise<AccessStatus> => {
  if (!user) return { planHasModule: false, hasAccess: false };
  if (user.super) return { planHasModule: true, hasAccess: true };

  const company = await Company.findByPk(user.companyId, {
    include: [{ model: Plan, as: "plan", attributes: ["useMembers"] }]
  });

  const planHasModule = !!(company as any)?.plan?.useMembers;
  if (!planHasModule) return { planHasModule: false, hasAccess: false };

  const hasAccess = user.profile === "admin" || !!user.membersAccess;
  return { planHasModule: true, hasAccess };
};

const EnsureMembersAccess = async (user: RequestUser): Promise<boolean> => {
  const { hasAccess } = await GetMembersAccessStatus(user);
  return hasAccess;
};

export default EnsureMembersAccess;
