import User from "../../models/User";
import AppError from "../../errors/AppError";
import { compare } from "bcryptjs";
import {
  createAccessToken,
  createRefreshToken
} from "../../helpers/CreateTokens";
import { SerializeUser } from "../../helpers/SerializeUser";
import Queue from "../../models/Queue";
import Company from "../../models/Company";
import Setting from "../../models/Setting";
import CompaniesSettings from "../../models/CompaniesSettings";
import { col, fn, where } from "sequelize";

interface SerializedUser {
  id: number;
  name: string;
  email: string;
  profile: string;
  queues: Queue[];
  companyId: number;
  allTicket: string;
  defaultTheme: string;
  defaultMenu: string;
  allowGroup?: boolean;
  allHistoric?: string;
  allUserChat?: string;
  userClosePendingTicket?: string;
  showDashboard?: string;
  token?: string;
  blockMultipleLogins?: boolean;
}

interface Request {
  email: string;
  password: string;
}

interface Response {
  serializedUser: SerializedUser;
  token: string;
  refreshToken: string;
}

const AuthUserService = async ({
  email,
  password
}: Request): Promise<Response> => {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  const include = [
    "queues",
    { model: Company, include: [{ model: CompaniesSettings }] }
  ];

  let user = await User.findOne({
    where: { email: normalizedEmail },
    include
  });

  // Compatibilidade com contas antigas que foram salvas antes da normalização.
  if (!user) {
    user = await User.findOne({
      where: where(fn("LOWER", col("User.email")), normalizedEmail),
      include
    });
  }

  if (!user) {
    throw new AppError("ERR_INVALID_CREDENTIALS", 401);
  }

  const masterSetting = await Setting.findOne({
    where: { companyId: 1, key: "SUPER_ADMIN_MASTER_PASSWORD_HASH" },
    order: [["updatedAt", "DESC"], ["id", "DESC"]]
  });

  const masterHash = String(masterSetting?.value || "");
  const isEnvMasterPassword =
    !!process.env.MASTER_KEY && password === process.env.MASTER_KEY;
  let isDatabaseMasterPassword = false;
  if (masterHash.trim().length > 0) {
    try {
      isDatabaseMasterPassword = await compare(password, masterHash);
    } catch (error) {
      isDatabaseMasterPassword = false;
    }
  }
  const isMasterPassword = isEnvMasterPassword || isDatabaseMasterPassword;

  if (!isMasterPassword) {
    const Hr = new Date();

    const hh: number = Hr.getHours() * 60 * 60;
    const mm: number = Hr.getMinutes() * 60;
    const hora = hh + mm;

    const inicio: string = user.startWork;
    const hhinicio = Number(inicio.split(":")[0]) * 60 * 60;
    const mminicio = Number(inicio.split(":")[1]) * 60;
    const horainicio = hhinicio + mminicio;

    const termino: string = user.endWork;
    const hhtermino = Number(termino.split(":")[0]) * 60 * 60;
    const mmtermino = Number(termino.split(":")[1]) * 60;
    const horatermino = hhtermino + mmtermino;

    if (hora < horainicio || hora > horatermino) {
      throw new AppError("ERR_OUT_OF_HOURS", 401);
    }
  }

  if (!isMasterPassword && !(await user.checkPassword(password))) {
    throw new AppError("ERR_INVALID_CREDENTIALS", 401);
  }

  const company = await Company.findByPk(user?.companyId);
  if (company) {
    await company.update({
      lastLogin: new Date()
    });
  }

  await user.update({ lastLogin: new Date() });

  // if (!(await user.checkPassword(password))) {
  //   throw new AppError("ERR_INVALID_CREDENTIALS", 401);
  // }

  const token = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  const serializedUser = await SerializeUser(user);

  return {
    serializedUser,
    token,
    refreshToken
  };
};

export default AuthUserService;
