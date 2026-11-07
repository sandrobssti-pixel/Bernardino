import { verify } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";
import authConfig from "../config/auth";

import { getIO } from "../libs/socket";
import ShowUserService from "../services/UserServices/ShowUserService";
import { updateUser } from "../helpers/updateUser";
// import { moment} from "moment-timezone"

interface TokenPayload {
  id: string;
  username: string;
  profile: string;
  companyId: number;
  iat: number;
  exp: number;
}

const isAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  // const check = await verifyHelper();

  // if (!check) {
  //   throw new AppError("ERR_SYSTEM_INVALID", 401);
  // }

  const [, token] = authHeader.split(" ");

  try {
    const decoded = verify(token, authConfig.secret);
    const { id, profile, companyId } = decoded as TokenPayload;

    updateUser(id, companyId);

    const fullUser = await ShowUserService(id, companyId);
    const _baseUser: any = { id, profile, companyId };
    _baseUser.super = !!fullUser.super;
    _baseUser.canViewAllContacts = !!fullUser.canViewAllContacts;
    _baseUser.canDeleteTickets = String(fullUser.canDeleteTickets || "disabled");
    _baseUser.allowConnections = String(fullUser.allowConnections || "enabled");
    _baseUser.allowImport = String(fullUser.allowImport || "disabled");
    _baseUser.financialAccess = !!fullUser.financialAccess;
    // v2.3.257 — `hrAccess` nunca tinha sido copiado aqui: toda checagem
    // de permissão do backend (EnsureHRAccess etc.) usa ESTE `req.user`,
    // não o model completo — então `user.hrAccess` sempre chegava
    // `undefined` em QUALQUER requisição de um usuário não-admin, mesmo
    // com o campo marcado no banco. Na prática, conceder "Módulo RH" pra
    // um usuário comum nunca funcionou de verdade (bug real, achado ao
    // investigar o mesmo sintoma relatado pro Financeiro).
    _baseUser.hrAccess = !!fullUser.hrAccess;
    _baseUser.salesAccess = !!fullUser.salesAccess;
    req.user = _baseUser;
  } catch (err: any) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  return next();
};

export default isAuth;
