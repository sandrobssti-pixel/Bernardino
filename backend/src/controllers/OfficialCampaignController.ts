import { Request, Response } from "express";
import * as Yup from "yup";
import { getIO } from "../libs/socket";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import WhatsAppOfficialTemplate from "../models/WhatsAppOfficialTemplate";
import CreateService from "../services/OfficialCampaignService/CreateService";
import DeleteService from "../services/OfficialCampaignService/DeleteService";
import ListService from "../services/OfficialCampaignService/ListService";
import ShowService from "../services/OfficialCampaignService/ShowService";
import UpdateService from "../services/OfficialCampaignService/UpdateService";
import { CancelService } from "../services/OfficialCampaignService/CancelService";
import { RestartService } from "../services/OfficialCampaignService/RestartService";
import {
  assertOfficialTemplateSupported,
  getComponentPlaceholderMaxIndex,
  getHeaderFormat,
  isMediaHeaderFormat
} from "../utils/officialTemplate";

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  whatsappId?: string;
  contactListName?: string;
  scheduledDate?: string;
};

type StoreData = {
  name: string;
  status: string;
  scheduledAt: string;
  contactListId: number;
  whatsappId: number;
  templateIdMeta: string;
  headerVariables?: string[];
  bodyVariables?: string[];
  headerMediaUrl?: string;
  statusTicket?: string;
};

const loadValidatedTemplate = async (
  companyId: number,
  whatsappId: number,
  templateIdMeta: string
) => {
  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, companyId }
  });

  if (!whatsapp) {
    throw new AppError("Conexao oficial nao encontrada", 404);
  }

  if (String(whatsapp.channel || "").toLowerCase() !== "whatsapp_oficial") {
    throw new AppError("A conexao escolhida nao pertence a API Oficial", 400);
  }

  const template = await WhatsAppOfficialTemplate.findOne({
    where: { whatsappId, templateIdMeta: String(templateIdMeta) }
  });

  if (!template) {
    throw new AppError("Template oficial nao encontrado para a conexao selecionada", 404);
  }

  if (String(template.status || "").toUpperCase() !== "APPROVED") {
    throw new AppError(
      `Template indisponivel para envio. Status atual: ${template.status}`,
      400
    );
  }

  const components = Array.isArray(template.components) ? template.components : [];
  assertOfficialTemplateSupported(components);

  return { whatsapp, template, components };
};

const validateTemplateVariables = ({
  components,
  headerVariables,
  bodyVariables,
  headerMediaUrl
}: {
  components: any[];
  headerVariables?: string[];
  bodyVariables?: string[];
  headerMediaUrl?: string;
}) => {
  const headerFormat = getHeaderFormat(components);
  const expectedBody = getComponentPlaceholderMaxIndex(components, "BODY");
  const safeBody = Array.isArray(bodyVariables) ? bodyVariables : [];

  if (isMediaHeaderFormat(headerFormat)) {
    if (!String(headerMediaUrl || "").trim()) {
      throw new AppError(
        `Este template exige uma URL de midia (${headerFormat}) no header.`,
        400
      );
    }
  } else {
    const expectedHeader = getComponentPlaceholderMaxIndex(components, "HEADER");
    const safeHeader = Array.isArray(headerVariables) ? headerVariables : [];

    if (expectedHeader > 0 && safeHeader.length < expectedHeader) {
      throw new AppError(
        `Variaveis insuficientes para o header. Esperado: ${expectedHeader}, recebido: ${safeHeader.length}`,
        400
      );
    }
  }

  if (expectedBody > 0 && safeBody.length < expectedBody) {
    throw new AppError(
      `Variaveis insuficientes para o body. Esperado: ${expectedBody}, recebido: ${safeBody.length}`,
      400
    );
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const {
    searchParam,
    pageNumber,
    status,
    whatsappId,
    contactListName,
    scheduledDate
  } = req.query as IndexQuery;

  const result = await ListService({
    companyId,
    searchParam,
    pageNumber,
    status,
    whatsappId,
    contactListName,
    scheduledDate
  });

  return res.json(result);
};

export const uploadHeaderMedia = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const file = req.file as Express.Multer.File | undefined;

  if (!file) {
    throw new AppError("Nenhum arquivo enviado", 400);
  }

  const url = `${process.env.BACKEND_URL}/public/company${companyId}/${file.filename}`;

  return res.status(200).json({ url });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = req.body as StoreData;

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    contactListId: Yup.number().required(),
    whatsappId: Yup.number().required(),
    templateIdMeta: Yup.string().required()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const { template, components } = await loadValidatedTemplate(
    companyId,
    Number(data.whatsappId),
    data.templateIdMeta
  );

  validateTemplateVariables({
    components,
    headerVariables: data.headerVariables,
    bodyVariables: data.bodyVariables,
    headerMediaUrl: data.headerMediaUrl
  });

  const record = await CreateService({
    ...data,
    companyId,
    templateName: template.name,
    templateLanguage: template.language,
    templateCategory: template.category,
    templateComponents: components
  });

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-official-campaign`, {
    action: "create",
    record
  });

  return res.status(200).json(record);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const record = await ShowService(req.params.id);
  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = req.body as StoreData;

  const { template, components } = await loadValidatedTemplate(
    companyId,
    Number(data.whatsappId),
    data.templateIdMeta
  );

  validateTemplateVariables({
    components,
    headerVariables: data.headerVariables,
    bodyVariables: data.bodyVariables,
    headerMediaUrl: data.headerMediaUrl
  });

  const record = await UpdateService({
    ...data,
    id: req.params.id,
    companyId,
    templateName: template.name,
    templateLanguage: template.language,
    templateCategory: template.category,
    templateComponents: components
  });

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-official-campaign`, {
    action: "update",
    record
  });

  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  await DeleteService(req.params.id);

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-official-campaign`, {
    action: "delete",
    id: req.params.id
  });

  return res.status(200).json({ message: "Official campaign deleted" });
};

export const cancel = async (req: Request, res: Response): Promise<Response> => {
  await CancelService(+req.params.id);
  return res.status(204).json({ message: "Cancelamento realizado" });
};

export const restart = async (req: Request, res: Response): Promise<Response> => {
  await RestartService(+req.params.id);
  return res.status(204).json({ message: "Reinicio realizado" });
};
