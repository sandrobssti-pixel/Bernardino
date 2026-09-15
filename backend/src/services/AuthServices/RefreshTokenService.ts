import { verify } from "jsonwebtoken";
import { Request as Req, Response as Res } from "express";

import User from "../../models/User";
import AppError from "../../errors/AppError";
import ShowUserService from "../UserServices/ShowUserService";
import authConfig from "../../config/auth";
import {
  createAccessToken,
  createRefreshToken
} from "../../helpers/CreateTokens";
import { getRefreshTokenClearCookieOptions } from "../../helpers/SendRefreshToken";

interface RefreshTokenPayload {
  id: string;
  tokenVersion: number;
  companyId: number;
}

interface Response {
  user: User;
  newToken: string;
  refreshToken: string;
}

export const RefreshTokenService = async (
  req: Req,
  res: Res,
  token: string
): Promise<Response> => {
  try {
    const decoded = verify(token, authConfig.refreshSecret);
    const { id, tokenVersion, companyId } = decoded as RefreshTokenPayload;

    const user = await ShowUserService(id, companyId);

    if (user.tokenVersion !== tokenVersion) {
      res.clearCookie("jrt", getRefreshTokenClearCookieOptions(req));
      throw new AppError("ERR_SESSION_EXPIRED", 401);
    }

    const newToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    return { user, newToken, refreshToken };
  } catch (err) {
    res.clearCookie("jrt", getRefreshTokenClearCookieOptions(req));
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }
};
