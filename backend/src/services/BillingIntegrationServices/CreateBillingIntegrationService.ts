import * as Yup from "yup";
import AppError from "../../errors/AppError";
import BillingIntegration from "../../models/BillingIntegration";
import { normalizeJsonObject, sanitizeBillingIntegration } from "./utils";

interface Request {
  companyId: number;
  name: string;
  provider: string;
  isActive?: boolean;
  credentials?: unknown;
  settings?: unknown;
}

const CreateBillingIntegrationService = async ({
  companyId,
  name,
  provider,
  isActive = true,
  credentials,
  settings
}: Request): Promise<BillingIntegration> => {
  const normalizedProvider = String(provider || "").trim().toLowerCase();
  const normalizedName = String(name || "").trim();

  const schema = Yup.object().shape({
    name: Yup.string().required().min(2),
    provider: Yup.string().oneOf(["asaas", "sgp", "atlaz", "ixc", "hubsoft"]).required()
  });

  try {
    await schema.validate({
      name: normalizedName,
      provider: normalizedProvider
    });
  } catch (error: any) {
    throw new AppError(error.message, 400);
  }

  const duplicatedName = await BillingIntegration.findOne({
    where: {
      companyId,
      name: normalizedName
    }
  });

  if (duplicatedName) {
    throw new AppError("Já existe uma integração de cobrança com esse nome.", 409);
  }

  const duplicatedProvider = await BillingIntegration.findOne({
    where: {
      companyId,
      provider: normalizedProvider
    }
  });

  if (duplicatedProvider) {
    throw new AppError("Já existe uma configuração para esse provider.", 409);
  }

  const integration = await BillingIntegration.create({
    companyId,
    name: normalizedName,
    provider: normalizedProvider,
    isActive: Boolean(isActive),
    credentials: normalizeJsonObject(credentials),
    settings: normalizeJsonObject(settings)
  });

  return sanitizeBillingIntegration(integration) as BillingIntegration;
};

export default CreateBillingIntegrationService;
