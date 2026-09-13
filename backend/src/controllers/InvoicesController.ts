import * as Yup from "yup";
import { Request, Response } from "express";
import AppError from "../errors/AppError";
import Invoices from "../models/Invoices";
import User from "../models/User";

import FindAllInvoiceService from "../services/InvoicesService/FindAllInvoiceService";
import ListInvoicesServices from "../services/InvoicesService/ListInvoicesServices";
import ShowInvoceService from "../services/InvoicesService/ShowInvoiceService";
import UpdateInvoiceService from "../services/InvoicesService/UpdateInvoiceService";
import DeleteInvoiceService from "../services/InvoicesService/DeleteInvoiceService";
import CreateInvoiceService from "../services/InvoicesService/CreateInvoiceService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

type StoreInvoiceData = {
  companyId: number;
  dueDate: string;
  detail: string;
  status: string;
  value: number;
  users: number;
  connections: number;
  queues: number;
  useWhatsapp: boolean;
  useFacebook: boolean;
  useInstagram: boolean;
  useCampaigns: boolean;
  useSchedules: boolean;
  useInternalChat: boolean;
  useExternalApi: boolean;
  linkInvoice: string;
};

type UpdateInvoiceData = {
  status: string;
  id?: string;
  dueDate?: string;
};


export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;

  const { invoices, count, hasMore } = await ListInvoicesServices({
    searchParam,
    pageNumber
  });

  return res.json({ invoices, count, hasMore });
};


export const show = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;

  const invoice = await ShowInvoceService(id);

  return res.status(200).json(invoice);
};


export const store = async (req: Request, res: Response): Promise<Response> => {
  const newPlan: StoreInvoiceData = req.body;

  const plan = await CreateInvoiceService(newPlan);

  return res.status(200).json(plan);
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id } = req.user;
  const requestCompanyId = req.query.companyId
    ? Number(req.query.companyId)
    : companyId;

  const requestUser = await User.findByPk(id);
  if (!requestUser) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  const targetCompanyId =
    requestUser.super === true && requestCompanyId
      ? requestCompanyId
      : companyId;

  const invoice: Invoices[] = await FindAllInvoiceService(targetCompanyId);

  return res.status(200).json(invoice);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const InvoiceData: UpdateInvoiceData = req.body;
  const { id: routeId } = req.params;

  const schema = Yup.object().shape({
    name: Yup.string()
  });

  try {
    await schema.validate(InvoiceData);
  } catch (err) {
    throw new AppError(err.message);
  }

  const { id, status, dueDate } = InvoiceData;
  const invoiceId = id || routeId;

  const plan = await UpdateInvoiceService({
    id: invoiceId,
    status,
    dueDate

  });

  // const io = getIO();
  // io.of(companyId.toString())
  // .emit("plan", {
  //   action: "update",
  //   plan
  // });

  return res.status(200).json(plan);
};
export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;

  const invoice = await DeleteInvoiceService(id);

  return res.status(200).json(invoice);
}; 
