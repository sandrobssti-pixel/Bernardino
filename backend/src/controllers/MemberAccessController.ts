import { Request, Response } from "express";
import { GetMembersAccessStatus } from "../services/MemberService/EnsureMembersAccess";

// Usado pelo frontend pra decidir se mostra o menu/página de Associados —
// mesmo padrão do FinanceAccessController/WeaponDispatchAccessController.
export const show = async (req: Request, res: Response): Promise<Response> => {
  const status = await GetMembersAccessStatus(req.user as any);
  return res.status(200).json(status);
};
