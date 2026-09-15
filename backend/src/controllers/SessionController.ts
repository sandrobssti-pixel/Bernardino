import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { getIO } from "../libs/socket";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { col, fn, Op, where } from "sequelize";

import AuthUserService from "../services/UserServices/AuthUserService";
import {
  SendRefreshToken,
  getRefreshTokenClearCookieOptions
} from "../helpers/SendRefreshToken";
import { RefreshTokenService } from "../services/AuthServices/RefreshTokenService";
import FindUserFromToken from "../services/AuthServices/FindUserFromToken";
import User from "../models/User";
import PushSubscription from "../models/PushSubscription";
// 🔹 CORRIGIDO: import default em vez de named
import GetGlobalConfig from "../helpers/GetGlobalConfig";

export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const email = String(req.body?.email || "").trim().toLowerCase();

  console.log("Forgot password request received:", { email });

  let user = await User.findOne({ where: { email } });

  // Compatibilidade com contas antigas que foram salvas antes da normalização.
  if (!user) {
    user = await User.findOne({
      where: where(fn("LOWER", col("User.email")), email)
    });
  }
  if (!user) {
    console.warn("No user found for email:", email);
    throw new AppError("E-mail não encontrado.", 404);
  }

  const token = crypto.randomBytes(32).toString("hex");
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  user.passwordResetToken = token;
  user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  await user.save();

  console.log("Password reset token generated:", {
    userId: user.id,
    email,
    token,
    expires: user.passwordResetExpires
  });

  // 🔹 Buscar config global (empresa admin ou .env)
  const {
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    smtpFrom
  } = await GetGlobalConfig();

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(smtpPort) || 587,
    secure: smtpSecure === "true",
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  try {
    await transporter.sendMail({
      from: smtpFrom || smtpUser,
      to: email,
      subject: "Redefinição de Senha",
      text: `Clique no link para redefinir sua senha: ${resetUrl}`
    });
    console.log("Password reset email sent to:", email);
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    throw new AppError("Erro ao enviar e-mail de redefinição.", 500);
  }

  return res.status(200).json({ message: "E-mail enviado com sucesso." });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { email, password } = req.body;

  const { token, serializedUser, refreshToken } = await AuthUserService({
    email,
    password
  });

  SendRefreshToken(res, refreshToken, req);

  const io = getIO();
  if (serializedUser.blockMultipleLogins !== false) {
    io.of(serializedUser.companyId.toString()).emit(
      `company-${serializedUser.companyId}-auth`,
      {
        action: "update",
        user: {
          id: serializedUser.id,
          email: serializedUser.email,
          companyId: serializedUser.companyId,
          token: serializedUser.token
        }
      }
    );
  }

  return res.status(200).json({
    token,
    user: serializedUser
  });
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const token: string = req.cookies.jrt;

  if (!token) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const { user, newToken, refreshToken } = await RefreshTokenService(
    req,
    res,
    token
  );

  SendRefreshToken(res, refreshToken, req);

  return res.json({ token: newToken, user });
};

export const me = async (req: Request, res: Response): Promise<Response> => {
  const token: string = req.cookies.jrt;
  const user = await FindUserFromToken(token);
  const { id, profile, super: superAdmin } = user;

  if (!token) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  return res.json({ id, profile, super: superAdmin });
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id, companyId } = req.user;
  const endpoint = req.body?.endpoint;

  if (id) {
    const user = await User.findByPk(id);
    await user.update({ online: false });

    await PushSubscription.destroy({
      where: {
        companyId,
        [Op.or]: [
          { userId: id },
          ...(endpoint ? [{ endpoint }] : [])
        ]
      }
    });
  }
  res.clearCookie("jrt", getRefreshTokenClearCookieOptions());

  return res.send();
};

export const resetPassword = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { token, newPassword } = req.body;

  console.log("Reset password request received:", {
    token,
    newPassword: "***"
  }); // Hide password in logs

  const user = await User.findOne({
    where: {
      passwordResetToken: token,
      passwordResetExpires: { [Op.gt]: new Date() }
    }
  });

  if (!user) {
    console.warn("No user found for token:", token);
    // Check if token exists but is expired or invalid
    const userWithToken = await User.findOne({
      where: { passwordResetToken: token }
    });
    if (userWithToken) {
      console.warn("Token found but expired or invalid:", {
        token,
        expires: userWithToken.passwordResetExpires
      });
    }
    throw new AppError("Token inválido ou expirado.", 400);
  }

  console.log("User found for password reset:", {
    userId: user.id,
    email: user.email
  });

  user.password = newPassword;
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  await user.save();

  console.log("Password reset successful for user:", user.id);

  return res.status(200).json({ message: "Senha redefinida com sucesso." });
};
