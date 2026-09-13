import * as Yup from "yup";
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import User from "../../models/User";
import sequelize from "../../database";
import CompaniesSettings from "../../models/CompaniesSettings";

interface CompanyData {
  name: string;
  phone?: string;
  email?: string;
  status?: boolean;
  planId?: number;
  dueDate?: string;
  recurrence?: string;
  document?: string;
  paymentMethod?: string;
  password?: string;
  companyUserName?: string;
}

const CreateCompanyService = async (
  companyData: CompanyData
): Promise<Company> => {
  const {
    name,
    phone,
    password,
    email,
    status,
    planId,
    dueDate,
    recurrence,
    document,
    paymentMethod,
    companyUserName
  } = companyData;

  const companySchema = Yup.object().shape({
    name: Yup.string()
      .min(2, "ERR_COMPANY_INVALID_NAME")
      .required("ERR_COMPANY_INVALID_NAME")
  });

  try {
    await companySchema.validate({ name });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const normalizePhone = (value?: string): string =>
    String(value || "").replace(/\D/g, "");

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPhone = normalizePhone(phone);

  const duplicatedFields: string[] = [];
  let staleUserWithSameEmail: User | null = null;

  const companyWithSameName = await Company.findOne({
    where: { name: { [Op.iLike]: name.trim() } }
  });

  if (companyWithSameName) {
    duplicatedFields.push("nome");
  }

  if (normalizedEmail) {
    const [companyWithSameEmail, userWithSameEmail] = await Promise.all([
      Company.findOne({
        where: { email: { [Op.iLike]: normalizedEmail } }
      }),
      User.findOne({
        where: { email: { [Op.iLike]: normalizedEmail } }
      })
    ]);

    if (userWithSameEmail && userWithSameEmail.companyId == null && !userWithSameEmail.super) {
      staleUserWithSameEmail = userWithSameEmail;
    }

    if (companyWithSameEmail || (userWithSameEmail && !staleUserWithSameEmail)) {
      duplicatedFields.push("e-mail");
    }
  }

  if (normalizedPhone) {
    const companiesWithPhone = await Company.findAll({
      attributes: ["id", "phone"],
      where: {
        phone: {
          [Op.ne]: null
        }
      }
    });

    const hasPhoneConflict = companiesWithPhone.some(company =>
      normalizePhone(company.phone) === normalizedPhone
    );

    if (hasPhoneConflict) {
      duplicatedFields.push("telefone");
    }
  }

  if (duplicatedFields.length === 1) {
    throw new AppError(
      `Já existe um cadastro com este ${duplicatedFields[0]}.`
    );
  }

  if (duplicatedFields.length > 1) {
    const lastField = duplicatedFields[duplicatedFields.length - 1];
    const otherFields = duplicatedFields.slice(0, -1).join(", ");
    throw new AppError(
      `Já existe um cadastro com este ${otherFields} e ${lastField}.`
    );
  }

  const t = await sequelize.transaction();

  try {
    if (staleUserWithSameEmail) {
      await staleUserWithSameEmail.destroy({ transaction: t });
    }

    const company = await Company.create({
      name,
      phone,
      email: normalizedEmail,
      status,
      planId,
      dueDate,
      recurrence,
      document,
      paymentMethod
    },
      { transaction: t }
    );

    const user = await User.create({
      name: companyUserName ? companyUserName : name,
      email: company.email,
      password: password ? password : "mudar123",
      profile: "admin",
      companyId: company.id
    },
      { transaction: t }
    );

    const settings = await CompaniesSettings.create({
          companyId: company.id,
          hoursCloseTicketsAuto: "9999999999",
          chatBotType: "text",
          acceptCallWhatsapp: "enabled",
          userRandom: "enabled",
          sendGreetingMessageOneQueues: "enabled",
          sendSignMessage: "enabled",
          sendFarewellWaitingTicket: "disabled",
          userRating: "disabled",
          sendGreetingAccepted: "enabled",
          CheckMsgIsGroup: "enabled",
          sendQueuePosition: "disabled",
          scheduleType: "disabled",
          acceptAudioMessageContact: "enabled",
          sendMsgTransfTicket:"disabled",
          enableLGPD: "disabled",
          requiredTag: "disabled",
          lgpdDeleteMessage: "disabled",
          lgpdHideNumber: "disabled",
          lgpdConsent: "disabled",
          lgpdLink:"",
          lgpdMessage:"",
          AcceptAudioMessageContactMessage: "Infelizmente não conseguimos escutar nem enviar áudios por este canal de atendimento, por favor, envie uma mensagem de texto.",
          createdAt: new Date(),
          updatedAt: new Date(),
          closeTicketOnTransfer: false,
          DirectTicketsToWallets: false
    },{ transaction: t })
    
    await t.commit();

    return company;
  } catch (error: any) {
    await t.rollback();
    if (error instanceof AppError) {
      throw error;
    }
    if (error?.name === "SequelizeUniqueConstraintError") {
      const field = error.errors?.[0]?.path;
      if (field === "name") {
        throw new AppError("Já existe um cadastro com este nome.");
      }
      if (field === "email") {
        throw new AppError("Já existe um cadastro com este e-mail.");
      }
    }
    throw new AppError("Não foi possível criar a empresa!");
  }
};

export default CreateCompanyService;
