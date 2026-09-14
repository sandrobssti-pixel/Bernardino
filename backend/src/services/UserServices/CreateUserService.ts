import * as Yup from "yup";

import AppError from "../../errors/AppError";
import { SerializeUser } from "../../helpers/SerializeUser";
import User from "../../models/User";
import Plan from "../../models/Plan";
import Company from "../../models/Company";
import { col, fn, where } from "sequelize";

interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  queueIds?: number[];
  companyId?: number;
  profile?: string;
  startWork?: string;
  endWork?: string;
  whatsappId?: number;
  allTicket?: string;
  defaultTheme?: string;
  defaultMenu?: string;
  allowGroup?: boolean;
  allHistoric?: string;
  allUserChat?: string;
  userClosePendingTicket?: string;
  canDeleteTickets?: string;
  showDashboard?: string;
  defaultTicketsManagerWidth?: number;
  allowRealTime?: string;
  allowConnections?: string;
  canViewAllContacts?: boolean; // << adicionado
  financialAccess?: boolean;
  blockMultipleLogins?: boolean;
  birthDate?: Date | string | null;
  super?: boolean; // << Master (somente honrado se o solicitante já for super)
}

interface Response {
  email: string;
  name: string;
  id: number;
  profile: string;
}

const normalizeBirthDate = (value?: Date | string | null): string | null => {
  if (!value) return null;
  if (typeof value === "string") {
    return value.split("T")[0];
  }
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const CreateUserService = async ({
  email,
  password,
  name,
  queueIds = [],
  companyId,
  profile = "admin",
  startWork,
  endWork,
  whatsappId,
  allTicket,
  defaultTheme,
  defaultMenu,
  allowGroup,
  allHistoric,
  allUserChat,
  userClosePendingTicket,
  canDeleteTickets,
  showDashboard,
  defaultTicketsManagerWidth = 550,
  allowRealTime,
  allowConnections,
  canViewAllContacts,
  financialAccess,
  blockMultipleLogins = true,
  birthDate,
  super: isSuperUser = false
}: CreateUserRequest): Promise<Response> => {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (companyId !== undefined) {
    const company = await Company.findOne({
      where: {
        id: companyId
      },
      include: [{ model: Plan, as: "plan" }]
    });

    if (company !== null) {
      const usersCount = await User.count({
        where: {
          companyId
        }
      });

      if (usersCount >= company.plan.users) {
        throw new AppError(
          `Número máximo de usuários já alcançado: ${usersCount}`
        );
      }
    }
  }

  const schema = Yup.object().shape({
    name: Yup.string().required().min(2),
    allHistoric: Yup.string(),
    email: Yup.string()
      .email()
      .required()
      .test(
        "Check-email",
        "An user with this email already exists.",
        async value => {
          if (!value) return false;
          const emailExists = await User.findOne({
            where: where(
              fn("LOWER", col("User.email")),
              String(value).toLowerCase()
            )
          });
          return !emailExists;
        }
      ),
    password: Yup.string().required().min(5),
    birthDate: Yup.date()
      .nullable()
      .transform((curr, orig) => (orig === "" ? null : curr))
      .max(new Date(), "Data de nascimento não pode ser no futuro")
  });

  try {
    await schema.validate({ email: normalizedEmail, password, name, birthDate });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const parsedBirthDate = normalizeBirthDate(birthDate);

  const user = await User.create(
    {
      email,
      password,
      name,
      companyId,
      profile,
      startWork,
      endWork,
      whatsappId: whatsappId || null,
      allTicket,
      defaultTheme,
      defaultMenu,
      allowGroup,
      allHistoric,
      allUserChat,
      userClosePendingTicket,
      canDeleteTickets,
      showDashboard,
      defaultTicketsManagerWidth,
      allowRealTime,
      allowConnections,
      canViewAllContacts: !!canViewAllContacts, // << persistência do novo campo
      financialAccess: !!financialAccess,
      blockMultipleLogins: !!blockMultipleLogins,
      birthDate: parsedBirthDate,
      super: !!isSuperUser
    },
    { include: ["queues", "company"] }
  );

  await user.$set("queues", queueIds);

  await user.reload();

  const serializedUser = SerializeUser(user);

  return serializedUser;
};

export default CreateUserService;
