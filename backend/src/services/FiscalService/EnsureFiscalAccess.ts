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

// Módulo fiscal (Vendas com itens, emissão de NF-e/NFC-e/NFS-e — Fase 3, ver
// docs/MANUAL_TECNICO.md, seção 6.2) é um add-on separado do Financeiro
// (Plan.useFiscal), mas sempre EXIGE o Financeiro também ativo
// (Plan.useFinancial) — Vendas usa os cadastros de cliente/produto que
// pertencem ao Financeiro, não faz sentido ter um sem o outro. Dentro de
// uma empresa que tem os dois módulos, Admin sempre tem acesso; um usuário
// comum só se o Admin da empresa liberou (mesmo campo User.financialAccess
// usado pelo Financeiro — não há um flag por-usuário separado pro fiscal).
// Master tem acesso total, isolado por companyId, igual ao Financeiro.
export const GetFiscalAccessStatus = async (
  user: RequestUser
): Promise<AccessStatus> => {
  if (!user) return { planHasModule: false, hasAccess: false };
  if (user.super) return { planHasModule: true, hasAccess: true };

  const company = await Company.findByPk(user.companyId, {
    include: [{ model: Plan, as: "plan", attributes: ["useFinancial", "useFiscal"] }]
  });

  const plan = (company as any)?.plan;
  const planHasModule = !!(plan?.useFinancial && plan?.useFiscal);
  if (!planHasModule) return { planHasModule: false, hasAccess: false };

  const hasAccess = user.profile === "admin" || !!user.financialAccess;
  return { planHasModule: true, hasAccess };
};

const EnsureFiscalAccess = async (user: RequestUser): Promise<boolean> => {
  const { hasAccess } = await GetFiscalAccessStatus(user);
  return hasAccess;
};

export default EnsureFiscalAccess;
