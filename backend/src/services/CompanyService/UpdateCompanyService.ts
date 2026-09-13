import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import Setting from "../../models/Setting";
import User from "../../models/User";
import Invoices from "../../models/Invoices";
import { Op } from "sequelize";

interface CompanyData {
  name: string;
  id?: number | string;
  phone?: string;
  email?: string;
  status?: boolean;
  planId?: number;
  campaignsEnabled?: boolean;
  dueDate?: string;
  recurrence?: string;
  document?: string;
  paymentMethod?: string;
  password?: string;
}

const UpdateCompanyService = async (
  companyData: CompanyData
): Promise<Company> => {

  const company = await Company.findByPk(companyData.id);
  const previousDueDate = company?.dueDate ? String(company.dueDate) : "";
  const {
    name,
    phone,
    email,
    status,
    planId,
    campaignsEnabled,
    dueDate,
    recurrence,
    document,
    paymentMethod,
    password
  } = companyData;

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : email;
  const currentCompanyEmail = String(company.email || "").trim().toLowerCase();
  const shouldSyncUserEmail =
    typeof normalizedEmail === "string" &&
    normalizedEmail !== "" &&
    normalizedEmail !== currentCompanyEmail;
  const shouldSyncUserPassword =
    typeof password === "string" && password.trim() !== "";

  // Regra especial da empresa principal (super admin):
  // permite alterar somente o nome e o plano.
  if (Number(company.id) === 1) {
    const nextName = String(name || "").trim();
    if (!nextName) {
      throw new AppError("Nome da empresa é obrigatório.", 400);
    }
    const nextPlanId =
      planId !== undefined && planId !== null && `${planId}` !== ""
        ? Number(planId)
        : undefined;

    await company.update({
      name: nextName,
      ...(nextPlanId !== undefined ? { planId: nextPlanId } : {})
    });
    return company;
  }

  if (shouldSyncUserEmail || shouldSyncUserPassword) {
    const user = await User.findOne({
      where: {
        companyId: company.id
      },
      order: [
        ["super", "DESC"],
        ["profile", "ASC"],
        ["id", "ASC"]
      ]
    });

    if (!user) {
      throw new AppError("ERR_NO_USER_FOUND", 404)
    }

    if (shouldSyncUserEmail) {
      const duplicatedUser = await User.findOne({
        where: {
          email: {
            [Op.iLike]: normalizedEmail
          }
        }
      });

      if (duplicatedUser && duplicatedUser.id !== user.id) {
        if (duplicatedUser.companyId == null && !duplicatedUser.super) {
          await duplicatedUser.destroy();
        } else {
          throw new AppError("Já existe um cadastro com este e-mail.", 400);
        }
      }
    }

    await user.update({
      ...(shouldSyncUserEmail ? { email: normalizedEmail } : {}),
      ...(shouldSyncUserPassword ? { password } : {})
    });
  }


  await company.update({
    name,
    phone,
    email: normalizedEmail,
    status,
    planId,
    dueDate,
    recurrence,
    document,
    paymentMethod
  });

  const normalizeDatePrefix = (value?: string): string | null => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().split("T")[0];
  };

  const oldDueDatePrefix = normalizeDatePrefix(previousDueDate);
  const newDueDatePrefix = normalizeDatePrefix(dueDate);

  // Quando o vencimento da empresa muda manualmente, sincroniza a fatura em aberto
  // do vencimento anterior para evitar geração de fatura duplicada pelo cron.
  if (
    oldDueDatePrefix &&
    newDueDatePrefix &&
    oldDueDatePrefix !== newDueDatePrefix
  ) {
    const oldOpenInvoice = await Invoices.findOne({
      where: {
        companyId: company.id,
        status: {
          [Op.ne]: "paid"
        },
        dueDate: {
          [Op.like]: `${oldDueDatePrefix}%`
        }
      },
      order: [["id", "ASC"]]
    });

    if (oldOpenInvoice) {
      await oldOpenInvoice.update({
        dueDate: newDueDatePrefix
      });
    }
  }

  if (companyData.campaignsEnabled !== undefined) {
    const [setting, created] = await Setting.findOrCreate({
      where: {
        companyId: company.id,
        key: "campaignsEnabled"
      },
      defaults: {
        companyId: company.id,
        key: "campaignsEnabled",
        value: `${campaignsEnabled}`
      }
    });
    if (!created) {
      await setting.update({ value: `${campaignsEnabled}` });
    }
  }

  return company;
};

export default UpdateCompanyService;
