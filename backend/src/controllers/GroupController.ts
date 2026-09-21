import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import GetGroupInfoService from "../services/ContactServices/GetGroupInfoService";
import UpdateGroupInfoService from "../services/ContactServices/UpdateGroupInfoService";
import UpdateGroupParticipantsService from "../services/ContactServices/UpdateGroupParticipantsService";
import GetGroupInviteLinkService from "../services/ContactServices/GetGroupInviteLinkService";
import GetGroupPhotoService from "../services/ContactServices/GetGroupPhotoService";
import ListWhatsappGroupsService from "../services/WbotServices/ListWhatsappGroupsService";

export const listAll = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const groups = await ListWhatsappGroupsService({ whatsappId, companyId });

  return res.status(200).json(groups);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  const groupInfo = await GetGroupInfoService({ contactId, companyId });

  return res.status(200).json(groupInfo);
};

export const photo = async (req: Request, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  const result = await GetGroupPhotoService({ contactId, companyId });

  return res.status(200).json(result);
};

export const updateInfo = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;
  const { subject, description } = req.body;

  const contact = await UpdateGroupInfoService({
    contactId,
    companyId,
    subject,
    description
  });

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-contact`, {
    action: "update",
    contact
  });

  return res.status(200).json(contact);
};

export const updateParticipants = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;
  const { participants, action } = req.body;

  const contact = await UpdateGroupParticipantsService({
    contactId,
    companyId,
    participants,
    action
  });

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-contact`, {
    action: "update",
    contact
  });

  return res.status(200).json(contact);
};

export const getInviteLink = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  const result = await GetGroupInviteLinkService({
    contactId,
    companyId,
    revoke: false
  });

  return res.status(200).json(result);
};

export const revokeInviteLink = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  const result = await GetGroupInviteLinkService({
    contactId,
    companyId,
    revoke: true
  });

  return res.status(200).json(result);
};
