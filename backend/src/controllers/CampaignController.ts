import { Request, Response } from "express";
import fs from "fs";
import { head } from "lodash";
import path from "path";
import * as Yup from "yup";
import { getIO } from "../libs/socket";

import CreateService from "../services/CampaignService/CreateService";
import DeleteService from "../services/CampaignService/DeleteService";
import FindService from "../services/CampaignService/FindService";
import ListService from "../services/CampaignService/ListService";
import ShowService from "../services/CampaignService/ShowService";
import UpdateService from "../services/CampaignService/UpdateService";

import Campaign from "../models/Campaign";

import AppError from "../errors/AppError";
import Contact from "../models/Contact";
import ContactList from "../models/ContactList";
import ContactListItem from "../models/ContactListItem";
import Ticket from "../models/Ticket";
import { CancelService } from "../services/CampaignService/CancelService";
import { RestartService } from "../services/CampaignService/RestartService";
import ContactTag from "../models/ContactTag";
import CheckContactNumber from "../services/WbotServices/CheckNumber";


type IndexQuery = {
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  whatsappId?: string;
  contactListName?: string;
  scheduledDate?: string;
  companyId: string | number;
};

type StoreData = {
  name: string;
  status: string;
  confirmation: boolean;
  scheduledAt: string;
  companyId: number;
  contactListId: number;
  tagListId: number | string;
  userId: number | string;
  queueId: number | string;
  statusTicket: string;
  openTicket: string;
  fileListId?: number; // CÓDIGO NOVO ADICIONADO
  whatsappId?: number | string | null;
};

type FindParams = {
  companyId: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const {
    searchParam,
    pageNumber,
    status,
    whatsappId,
    contactListName,
    scheduledDate
  } = req.query as IndexQuery;
  const { companyId } = req.user;

  const { records, count, hasMore } = await ListService({
    searchParam,
    pageNumber,
    status,
    whatsappId,
    contactListName,
    scheduledDate,
    companyId
  });

  return res.json({ records, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = req.body as StoreData;

  const schema = Yup.object().shape({
    name: Yup.string().required()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  // "Lista de Contato" e "Tag" são exclusivas na tela — se as duas vierem
  // preenchidas (ex.: valor de tag esquecido de uma tentativa anterior no
  // formulário), a Lista de Contato SEMPRE tem prioridade: é o campo que o
  // usuário mais provavelmente escolheu por último, e ignorar silenciosamente
  // a lista/grupo escolhido pra usar a tag enviava a campanha pro destinatário
  // errado (bug real relatado pelo cliente — mandou pra um grupo e foi pra
  // uma tag de fornecedores). Ver docs/MANUAL_TECNICO.md.
  if (typeof data.tagListId === 'number' && !data.contactListId) {

    const tagId = data.tagListId;
    const campanhaNome = data.name;

    async function createContactListFromTag(tagId: number) {

      const currentDate = new Date();
      const formattedDate = currentDate.toISOString();

      try {
        const contactTags = await ContactTag.findAll({ where: { tagId } });
        const contactIds = contactTags.map((contactTag) => contactTag.contactId);

        const contacts = await Contact.findAll({ where: { id: contactIds } });

        const randomName = `${campanhaNome} | TAG: ${tagId} - ${formattedDate}` // Implement your own function to generate a random name
        const contactList = await ContactList.create({ name: randomName, companyId: companyId });

        const { id: contactListId } = contactList;

        const contactListItems = await Promise.all(
          contacts.map(async contact => {
            let normalizedNumber = String(contact.number || "")
              .split("@")[0]
              .replace(/[^\d-]/g, "");
            let isWhatsappValid = false;

            try {
              const response = await CheckContactNumber(
                normalizedNumber,
                Number(companyId),
                !!contact.isGroup
              );
              normalizedNumber = String(response || "")
                .split("@")[0]
                .replace(/[^\d-]/g, "");
              isWhatsappValid = true;
            } catch (error) {
              isWhatsappValid = false;
            }

            return {
              name: contact.name,
              number: normalizedNumber,
              email: contact.email,
              contactListId,
              companyId,
              isWhatsappValid,
              isGroup: contact.isGroup,
              lid: (contact as any).lid || null,
              jid: (contact as any).jid || null
            };
          })
        );

        await ContactListItem.bulkCreate(contactListItems);

        // Return the ContactList ID
        return contactListId;
      } catch (error) {
        console.error('Error creating contact list:', error);
        throw error;
      }
    }


    createContactListFromTag(tagId)
      .then(async (contactListId) => {
        const record = await CreateService({
          ...data,
          companyId,
          contactListId: contactListId,
        });
        const io = getIO();
        io.of(String(companyId))
          .emit(`company-${companyId}-campaign`, {
            action: "create",
            record
          });
        return res.status(200).json(record);
      })
      .catch((error) => {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Error creating contact list' });
      });

  } else { // SAI DO CHECK DE TAG

    const record = await CreateService({
      ...data,
      companyId
    });

    const io = getIO();
    io.of(String(companyId))
      .emit(`company-${companyId}-campaign`, {
        action: "create",
        record
      });

    return res.status(200).json(record);
  }
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;

  const record = await ShowService(id);

  return res.status(200).json(record);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const data = req.body as StoreData;
  const { companyId } = req.user;

  const schema = Yup.object().shape({
    name: Yup.string().required()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const { id } = req.params;

  const record = await UpdateService({
    ...data,
    id
  });

  const io = getIO();
  io.of(String(companyId))
    .emit(`company-${companyId}-campaign`, {
      action: "update",
      record
    });

  return res.status(200).json(record);
};

export const cancel = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;

  await CancelService(+id);

  return res.status(204).json({ message: "Cancelamento realizado" });
};

export const restart = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;

  await RestartService(+id);

  return res.status(204).json({ message: "Reinício dos disparos" });
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  await DeleteService(id);

  const io = getIO();
  io.of(String(companyId))
    .emit(`company-${companyId}-campaign`, {
      action: "delete",
      id
    });

  return res.status(200).json({ message: "Campaign deleted" });
};

export const findList = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const params = req.query as FindParams;
  const records: Campaign[] = await FindService(params);

  return res.status(200).json(records);
};

export const mediaUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const files = req.files as Express.Multer.File[];
  const file = head(files);

  try {
    const campaign = await Campaign.findByPk(id);
    campaign.mediaPath = file.filename;
    campaign.mediaName = file.originalname;
    await campaign.save();
    return res.send({ mensagem: "Mensagem enviada" });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};

export const deleteMedia = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  try {
    const campaign = await Campaign.findByPk(id);
    const filePath = path.resolve("public", `company${companyId}`, campaign.mediaPath);
    const fileExists = fs.existsSync(filePath);
    if (fileExists) {
      fs.unlinkSync(filePath);
    }

    campaign.mediaPath = null;
    campaign.mediaName = null;
    await campaign.save();
    return res.send({ mensagem: "Arquivo excluído" });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};
