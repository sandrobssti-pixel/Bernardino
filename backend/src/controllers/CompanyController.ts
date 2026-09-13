import { verify } from "jsonwebtoken";
import authConfig from "../config/auth";
import * as Yup from "yup";
import { Request, Response } from "express";
// import { getIO } from "../libs/socket";
import AppError from "../errors/AppError";
import Company from "../models/Company";

import ListCompaniesService from "../services/CompanyService/ListCompaniesService";
import CreateCompanyService from "../services/CompanyService/CreateCompanyService";
import UpdateCompanyService from "../services/CompanyService/UpdateCompanyService";
import ShowCompanyService from "../services/CompanyService/ShowCompanyService";
import UpdateSchedulesService from "../services/CompanyService/UpdateSchedulesService";
import DeleteCompanyService from "../services/CompanyService/DeleteCompanyService";
import FindAllCompaniesService from "../services/CompanyService/FindAllCompaniesService";
import ShowPlanCompanyService from "../services/CompanyService/ShowPlanCompanyService";
import User from "../models/User";
import Contact from "../models/Contact";
import Whatsapp from "../models/Whatsapp";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import Invoices from "../models/Invoices";
import { Op } from "sequelize";
import ListCompaniesPlanService from "../services/CompanyService/ListCompaniesPlanService";
import GetCompanyStorageUsageService from "../services/CompanyService/GetCompanyStorageUsageService";
import ListOrphanCompanyFoldersService from "../services/CompanyService/ListOrphanCompanyFoldersService";
import DeleteOrphanCompanyFoldersService from "../services/CompanyService/DeleteOrphanCompanyFoldersService";

interface TokenPayload {
  id: string;
  username: string;
  profile: string;
  companyId: number;
  iat: number;
  exp: number;
}

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

type CompanyData = {
  name: string;
  id?: number;
  phone?: string;
  email?: string;
  password?: string;
  status?: boolean;
  planId?: number;
  campaignsEnabled?: boolean;
  dueDate?: string;
  recurrence?: string;
  document?: string;
  paymentMethod?: string;
};

type SchedulesData = {
  schedules?: [];
  holidaySchedules?: [];
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const decoded = verify(token, authConfig.secret);
  const { id, profile, companyId } = decoded as TokenPayload;
  const company = await Company.findByPk(companyId);
  const requestUser = await User.findByPk(id);

  if (requestUser.super === true) {
    const { companies, count, hasMore } = await ListCompaniesService({
      searchParam,
      pageNumber
    });

    return res.json({ companies, count, hasMore });

  } else {
    const { companies, count, hasMore } = await ListCompaniesService({
      searchParam: company.name,
      pageNumber
    });
    return res.json({ companies, count, hasMore });

  }

};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const newCompany: CompanyData = req.body;

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    password: Yup.string().required().min(5)
  });

  try {
    await schema.validate(newCompany);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const company = await CreateCompanyService(newCompany);

  return res.status(200).json(company);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const decoded = verify(token, authConfig.secret);
  const { id: requestUserId, profile, companyId } = decoded as TokenPayload;
  const requestUser = await User.findByPk(requestUserId);

  if (requestUser.super === true) {
    const company = await ShowCompanyService(id);
    return res.status(200).json(company);
  } else if (id !== companyId.toString()) {
    return res.status(400).json({ error: "Você não possui permissão para acessar este recurso!" });
  } else if (id === companyId.toString()) {
    const company = await ShowCompanyService(id);
    return res.status(200).json(company);
  }
};

export const list = async (req: Request, res: Response): Promise<Response> => {

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const decoded = verify(token, authConfig.secret);
  const { id, profile, companyId } = decoded as TokenPayload;
  const requestUser = await User.findByPk(id);

  if (requestUser.super === true) {
    const companies: Company[] = await FindAllCompaniesService();
    return res.status(200).json(companies);
  } else {
    const companies: Company[] = await FindAllCompaniesService();
    let company = [];

    for (let i = 0; i < companies.length; i++) {
      const id = companies[i].id;

      if (id === companyId) {
        company.push(companies[i])
        return res.status(200).json(company);
      }
    }
  }

};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {

  const companyData: CompanyData = req.body;

  const schema = Yup.object().shape({
    name: Yup.string()
  });

  try {
    await schema.validate(companyData);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const { id } = req.params;

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const decoded = verify(token, authConfig.secret);
  const { id: requestUserId, profile, companyId } = decoded as TokenPayload;
  const requestUser = await User.findByPk(requestUserId);

  if (requestUser.super === true) {
    const company = await UpdateCompanyService({ id, ...companyData });
    return res.status(200).json(company);
  } else if (String(companyData?.id) !== id || String(companyId) !== id) {
    return res.status(400).json({ error: "Você não possui permissão para acessar este recurso!" });
  } else {
    const company = await UpdateCompanyService({ id, ...companyData });
    return res.status(200).json(company);
  }

};

export const updateSchedules = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { schedules, holidaySchedules }: SchedulesData = req.body;
  const { id } = req.params;

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const decoded = verify(token, authConfig.secret);
  const { id: requestUserId, profile, companyId } = decoded as TokenPayload;
  const requestUser = await User.findByPk(requestUserId);

  if (requestUser.super === true) {
    const company = await UpdateSchedulesService({ id, schedules, holidaySchedules });
    return res.status(200).json(company);
  } else if (companyId.toString() !== id) {
    return res.status(400).json({ error: "Você não possui permissão para acessar este recurso!" });
  } else {
    const company = await UpdateSchedulesService({ id, schedules, holidaySchedules });
    return res.status(200).json(company);
  }

};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const decoded = verify(token, authConfig.secret);
  const { id: requestUserId, profile, companyId } = decoded as TokenPayload;
  const requestUser = await User.findByPk(requestUserId);

  if (requestUser.super === true) {
    const company = await DeleteCompanyService(id);
    return res.status(200).json(company);
  } else {
    return res.status(400).json({ error: "Você não possui permissão para acessar este recurso!" });
  }

};

export const listPlan = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const decoded = verify(token, authConfig.secret);
  const { id: requestUserId, profile, companyId } = decoded as TokenPayload;
  const requestUser = await User.findByPk(requestUserId);

  if (requestUser.super === true) {
    const company = await ShowPlanCompanyService(id);
    return res.status(200).json(company);
  } else if (companyId.toString() !== id) {
    return res.status(400).json({ error: "Você não possui permissão para acessar este recurso!" });
  } else {
    const company = await ShowPlanCompanyService(id);
    return res.status(200).json(company);
  }

};

export const indexPlan = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const decoded = verify(token, authConfig.secret);
  const { id, profile, companyId } = decoded as TokenPayload;
  // const company = await Company.findByPk(companyId);
  const requestUser = await User.findByPk(id);

  if (requestUser.super === true) {
    const companies = await ListCompaniesPlanService();
    return res.json({ companies });
  } else {
    return res.status(400).json({ error: "Você não possui permissão para acessar este recurso!" });
  }

};

export const storageUsage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const companyIdFromRoute = Number(id);

  if (!Number.isInteger(companyIdFromRoute) || companyIdFromRoute <= 0) {
    throw new AppError("ERR_INVALID_COMPANY_ID", 400);
  }

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const decoded = verify(token, authConfig.secret);
  const { id: requestUserId, companyId } = decoded as TokenPayload;
  const requestUser = await User.findByPk(requestUserId);

  if (!requestUser) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  if (requestUser.super !== true && companyIdFromRoute !== companyId) {
    return res.status(400).json({
      error: "Você não possui permissão para acessar este recurso!"
    });
  }

  const usage = await GetCompanyStorageUsageService(companyIdFromRoute);
  return res.status(200).json(usage);
};

export const listOrphanPublicFolders = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id: requestUserId } = req.user;
  const requestUser = await User.findByPk(requestUserId);

  if (!requestUser || requestUser.super !== true) {
    return res.status(400).json({
      error: "Você não possui permissão para acessar este recurso!"
    });
  }

  const folders = await ListOrphanCompanyFoldersService();
  return res.status(200).json({ folders });
};

export const deleteOrphanPublicFolders = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id: requestUserId } = req.user;
  const requestUser = await User.findByPk(requestUserId);

  if (!requestUser || requestUser.super !== true) {
    return res.status(400).json({
      error: "Você não possui permissão para acessar este recurso!"
    });
  }

  const { companyIds } = req.body;
  const result = await DeleteOrphanCompanyFoldersService({ companyIds });

  return res.status(200).json(result);
};

export const stats = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const companyIdFromRoute = Number(id);

  if (!Number.isInteger(companyIdFromRoute) || companyIdFromRoute <= 0) {
    throw new AppError("ERR_INVALID_COMPANY_ID", 400);
  }

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const decoded = verify(token, authConfig.secret);
  const { id: requestUserId, companyId } = decoded as TokenPayload;
  const requestUser = await User.findByPk(requestUserId);

  if (!requestUser) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  if (requestUser.super !== true && companyIdFromRoute !== companyId) {
    return res.status(400).json({
      error: "Você não possui permissão para acessar este recurso!"
    });
  }

  const [contacts, users, channels, messages, ticketsOpen, ticketsPending, ticketsClosed] =
    await Promise.all([
      Contact.count({ where: { companyId: companyIdFromRoute } }),
      User.count({ where: { companyId: companyIdFromRoute } }),
      Whatsapp.count({ where: { companyId: companyIdFromRoute } }),
      Message.count({ where: { companyId: companyIdFromRoute } }),
      Ticket.count({ where: { companyId: companyIdFromRoute, status: "open" } }),
      Ticket.count({ where: { companyId: companyIdFromRoute, status: "pending" } }),
      Ticket.count({ where: { companyId: companyIdFromRoute, status: "closed" } })
    ]);

  const [paidValueRaw, openValueRaw] = await Promise.all([
    Invoices.sum("value", { where: { companyId: companyIdFromRoute, status: "paid" } }),
    Invoices.sum("value", { where: { companyId: companyIdFromRoute, status: { [Op.ne]: "paid" } } })
  ]);

  return res.status(200).json({
    contacts,
    users,
    channels,
    messages,
    tickets: {
      total: ticketsOpen + ticketsPending + ticketsClosed,
      open: ticketsOpen,
      pending: ticketsPending,
      closed: ticketsClosed
    },
    invoices: {
      paidValue: Number(paidValueRaw || 0),
      openValue: Number(openValueRaw || 0)
    }
  });
};
