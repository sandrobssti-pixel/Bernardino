import * as Yup from "yup";
import AppError from "../../errors/AppError";
import BillingIntegration from "../../models/BillingIntegration";
import ShowBillingIntegrationRawService from "./ShowBillingIntegrationRawService";
import {
  isSecretKey,
  normalizeJsonObject,
  sanitizeBillingIntegration
} from "./utils";

interface Request {
  companyId: number;
  integrationId: string;
  integrationData: {
    name?: string;
    provider?: string;
    isActive?: boolean;
    credentials?: unknown;
    settings?: unknown;
  };
}

const UpdateBillingIntegrationService = async ({
  companyId,
  integrationId,
  integrationData
}: Request): Promise<BillingIntegration> => {
  const integration = await ShowBillingIntegrationRawService(integrationId, companyId);

  const normalizedProvider = integrationData.provider
    ? String(integrationData.provider).trim().toLowerCase()
    : integration.provider;
  const normalizedName = integrationData.name
    ? String(integrationData.name).trim()
    : integration.name;

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

  if (duplicatedName && Number(duplicatedName.id) !== Number(integration.id)) {
    throw new AppError("Já existe uma integração de cobrança com esse nome.", 409);
  }

  const duplicatedProvider = await BillingIntegration.findOne({
    where: {
      companyId,
      provider: normalizedProvider
    }
  });

  if (
    duplicatedProvider &&
    Number(duplicatedProvider.id) !== Number(integration.id)
  ) {
    throw new AppError("Já existe uma configuração para esse provider.", 409);
  }

  const incomingCredentials =
    typeof integrationData.credentials !== "undefined"
      ? normalizeJsonObject(integrationData.credentials)
      : undefined;
  const mergedCredentials =
    typeof incomingCredentials === "undefined"
      ? integration.credentials
      : {
          ...(integration.credentials || {}),
          ...Object.entries(incomingCredentials).reduce(
            (acc, [key, value]) => {
              if (isSecretKey(key) && !String(value || "").trim()) {
                return acc;
              }
              acc[key] = value;
              return acc;
            },
            {} as Record<string, unknown>
          )
        };

  await integration.update({
    name: normalizedName,
    provider: normalizedProvider,
    isActive:
      typeof integrationData.isActive === "boolean"
        ? integrationData.isActive
        : integration.isActive,
    credentials: mergedCredentials,
    settings:
      typeof integrationData.settings !== "undefined"
        ? normalizeJsonObject(integrationData.settings)
        : integration.settings
  });

  return sanitizeBillingIntegration(integration) as BillingIntegration;
};

export default UpdateBillingIntegrationService;
