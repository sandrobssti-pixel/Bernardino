import { verify } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";
import authConfig from "../config/auth";

// Autenticação do Portal do Associado — SEPARADA de isAuth.ts (equipe/
// Admin do clube). Token tem formato DIFERENTE do token de equipe
// ({ memberId, companyId, scope: "member" } em vez de { id, profile,
// companyId }), então um token de um tipo nunca é aceito como o outro
// por engano — isAuth.ts não precisou de nenhuma mudança (o payload de
// membro não bate com o que ele espera, falha com erro, nunca autentica
// como equipe). Ver docs/MANUAL_TECNICO.md.
interface MemberTokenPayload {
  memberId: number;
  companyId: number;
  scope: string;
  iat: number;
  exp: number;
}

const isMemberAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const [, token] = authHeader.split(" ");

  try {
    const decoded = verify(token, authConfig.secret) as MemberTokenPayload;
    if (decoded.scope !== "member") {
      throw new AppError("ERR_SESSION_EXPIRED", 401);
    }

    (req as any).member = { id: decoded.memberId, companyId: decoded.companyId };
  } catch (err: any) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  return next();
};

export default isMemberAuth;
