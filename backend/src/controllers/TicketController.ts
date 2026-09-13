import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import Ticket from "../models/Ticket";
import AppError from "../errors/AppError";

import CreateTicketService from "../services/TicketServices/CreateTicketService";
import DeleteTicketService from "../services/TicketServices/DeleteTicketService";
import ListTicketsService from "../services/TicketServices/ListTicketsService";
import ShowTicketUUIDService from "../services/TicketServices/ShowTicketFromUUIDService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import ListTicketsServiceKanban from "../services/TicketServices/ListTicketsServiceKanban";

import CreateLogTicketService from "../services/TicketServices/CreateLogTicketService";
import ShowLogTicketService from "../services/TicketServices/ShowLogTicketService";
import FindOrCreateATicketTrakingService from "../services/TicketServices/FindOrCreateATicketTrakingService";
import ListTicketsServiceReport from "../services/TicketServices/ListTicketsServiceReport";
import BulkDeleteClosedTicketsService from "../services/TicketServices/BulkDeleteClosedTicketsService";
import ResolveClosedTicketIdsService from "../services/TicketServices/ResolveClosedTicketIdsService";
import ShowUserService from "../services/UserServices/ShowUserService";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import { Mutex } from "async-mutex";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  status: string;
  date?: string;
  dateStart?: string;
  dateEnd?: string;
  updatedAt?: string;
  showAll: string;
  withUnreadMessages?: string;
  queueIds?: string;
  tags?: string;
  users?: string;
  whatsapps: string;
  statusFilter: string;
  isGroup?: string;
  sortTickets?: string;
  searchOnMessages?: string;
};

type IndexQueryReport = {
  searchParam: string;
  contactId: string;
  whatsappId: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  queueIds: string;
  tags: string;
  kanbanTags: string;
  users: string;
  page: string;
  pageSize: string;
  onlyRated: string;
  includeGroups: string;
};


interface TicketData {
  contactId: number;
  status: string;
  queueId: number;
  userId: number;
  kanbanValue?: number | string | null;
  sendFarewellMessage?: boolean;
  whatsappId?: string;
}

type BulkDeleteClosedBody = {
  dateStart?: string;
  dateEnd?: string;
  limit?: number | string;
  queueIds?: number[];
  showAll?: string;
  whatsappIds?: number[];
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const {
    pageNumber,
    status,
    date,
    dateStart,
    dateEnd,
    updatedAt,
    searchParam,
    showAll,
    queueIds: queueIdsStringified,
    tags: tagIdsStringified,
    users: userIdsStringified,
    withUnreadMessages,
    whatsapps: whatsappIdsStringified,
    statusFilter: statusStringfied,
    sortTickets,
    searchOnMessages
  } = req.query as IndexQuery;

  const userId = Number(req.user.id);
  const { companyId } = req.user;

  let queueIds: number[] = [];
  let tagsIds: number[] = [];
  let usersIds: number[] = [];
  let whatsappIds: number[] = [];
  let statusFilters: string[] = [];

  if (queueIdsStringified) {
    queueIds = JSON.parse(queueIdsStringified);
  }

  if (tagIdsStringified) {
    tagsIds = JSON.parse(tagIdsStringified);
  }

  if (userIdsStringified) {
    usersIds = JSON.parse(userIdsStringified);
  }

  if (whatsappIdsStringified) {
    whatsappIds = JSON.parse(whatsappIdsStringified);
  }

  if (statusStringfied) {
    statusFilters = JSON.parse(statusStringfied);
  }

  const { tickets, count, hasMore } = await ListTicketsService({
    searchParam,
    tags: tagsIds,
    users: usersIds,
    pageNumber,
    status,
    date,
    dateStart,
    dateEnd,
    updatedAt,
    showAll,
    userId,
    queueIds,
    withUnreadMessages,
    whatsappIds,
    statusFilters,
    companyId,
    sortTickets,
    searchOnMessages
  });

  return res.status(200).json({ tickets, count, hasMore });
};

export const report = async (req: Request, res: Response): Promise<Response> => {
  const {
    searchParam,
    contactId,
    whatsappId: whatsappIdsStringified,
    dateFrom,
    dateTo,
    status: statusStringified,
    queueIds: queueIdsStringified,
    tags: tagIdsStringified,
    kanbanTags: kanbanTagsStringified,
    users: userIdsStringified,
    page: pageNumber,
    pageSize,
    onlyRated,
    includeGroups
  } = req.query as IndexQueryReport;


  const userId = req.user.id;
  const { companyId } = req.user;

  let queueIds: number[] = [];
  let whatsappIds: string[] = [];
  let tagsIds: number[] = [];
  let kanbanTagIds: number[] = [];
  let usersIds: number[] = [];
  let statusIds: string[] = [];


  if (statusStringified) {
    statusIds = JSON.parse(statusStringified);
  }

  if (whatsappIdsStringified) {
    whatsappIds = JSON.parse(whatsappIdsStringified);
  }

  if (queueIdsStringified) {
    queueIds = JSON.parse(queueIdsStringified);
  }

  if (tagIdsStringified) {
    tagsIds = JSON.parse(tagIdsStringified);
  }

  if (kanbanTagsStringified) {
    kanbanTagIds = JSON.parse(kanbanTagsStringified);
  }

  if (userIdsStringified) {
    usersIds = JSON.parse(userIdsStringified);
  }

  const { tickets, totalTickets } = await ListTicketsServiceReport(
    companyId,
    {
      searchParam,
      queueIds,
      tags: tagsIds,
      kanbanTags: kanbanTagIds,
      users: usersIds,
      status: statusIds,
      dateFrom,
      dateTo,
      userId,
      contactId,
      whatsappId: whatsappIds,
      onlyRated: onlyRated,
      includeGroups
    },
    +pageNumber,

    +pageSize
  );

  return res.status(200).json({ tickets, totalTickets });
};

export const kanban = async (req: Request, res: Response): Promise<Response> => {
  const {
    pageNumber,
    status,
    date,
    dateStart,
    dateEnd,
    updatedAt,
    searchParam,
    showAll,
    queueIds: queueIdsStringified,
    tags: tagIdsStringified,
    users: userIdsStringified,
    withUnreadMessages
  } = req.query as IndexQuery;


  // A linha abaixo ainda é necessária para obter o companyId
  const { companyId } = req.user;

  let queueIds: number[] = [];
  let tagsIds: number[] = [];
  let usersIds: number[] = [];

  if (queueIdsStringified) {
    queueIds = JSON.parse(queueIdsStringified);
  }

  if (tagIdsStringified) {
    tagsIds = JSON.parse(tagIdsStringified);
  }

  if (userIdsStringified) {
    usersIds = JSON.parse(userIdsStringified);
  }

  const { tickets, count, hasMore } = await ListTicketsServiceKanban({
    searchParam,
    tags: tagsIds,
    users: usersIds,
    pageNumber,
    status,
    date,
    dateStart,
    dateEnd,
    updatedAt,
    showAll,
    // userId, // <<-- ALTERAÇÃO PRINCIPAL: REMOÇÃO DESTA LINHA
    queueIds,
    withUnreadMessages,
    companyId

  });

  return res.status(200).json({ tickets, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { contactId, status, queueId, whatsappId }: TicketData = req.body;
  const { companyId, id: authenticatedUserId } = req.user;

  const ticket = await CreateTicketService({
    contactId,
    status,
    userId: Number(authenticatedUserId),
    companyId,
    queueId,
    whatsappId
  });

  const io = getIO();
  io.of(String(companyId))
    // .to(ticket.status)
    .emit(`company-${companyId}-ticket`, {
      action: "update",
      ticket
    });

  return res.status(200).json(ticket);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { id: userId, companyId } = req.user;

  const contact = await ShowTicketService(ticketId, companyId);

  await CreateLogTicketService({
    userId,
    ticketId,
    type: "access"
  });

  return res.status(200).json(contact);
};

export const showLog = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { id: userId, companyId } = req.user;

  const log = await ShowLogTicketService({ ticketId, companyId });

  return res.status(200).json(log);
};

export const showFromUUID = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { uuid } = req.params;
  const { id: userId, companyId } = req.user;


  const ticket: Ticket = await ShowTicketUUIDService(uuid, companyId);

  if (
    ["whatsapp", "whatsapp_oficial"].includes(ticket.channel) &&
    ticket.whatsappId &&
    ticket.unreadMessages > 0
  ) {
    SetTicketMessagesAsRead(ticket);
  }
  await CreateLogTicketService({
    userId,
    ticketId: ticket.id,
    type: "access"
  });

  return res.status(200).json(ticket);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const ticketData: TicketData = req.body;
  const { companyId, id: loggedInUserId } = req.user;

  const mutex = new Mutex();
  const { ticket } = await mutex.runExclusive(async () => {
    const result = await UpdateTicketService({
      ticketData,
      ticketId,
      companyId,
      loggedInUserId: Number(loggedInUserId)
    });
    return result;
  });

  return res.status(200).json(ticket);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { id: userId, companyId, profile, canDeleteTickets } = req.user;

  if (profile !== "admin" && canDeleteTickets !== "enabled") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  // await ShowTicketService(ticketId, companyId);

  const ticket = await DeleteTicketService(ticketId, userId, companyId);

  const io = getIO();

  io.of(String(companyId))
    // .to(ticket.status)
    // .to(ticketId)
    // .to("notification")
    .emit(`company-${companyId}-ticket`, {
      action: "delete",
      ticketId: +ticketId
    });

  return res.status(200).json({ message: "ticket deleted" });
};

export const closeAll = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { status }: TicketData = req.body;
  const io = getIO();

  const { rows: tickets } = await Ticket.findAndCountAll({
    where: { companyId: companyId, status: status },
    order: [["updatedAt", "DESC"]]
  });

  tickets.forEach(async ticket => {

    const ticketData = {
      status: "closed",
      userId: ticket.userId || null,
      queueId: ticket.queueId || null,
      unreadMessages: 0,
      amountUsedBotQueues: 0,
      sendFarewellMessage: false
    };

    await UpdateTicketService({ ticketData, ticketId: ticket.id, companyId })

  });

  return res.status(200).json();
};

export const countClosed = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, id: userId, profile, canDeleteTickets } = req.user;

  if (profile !== "admin" && canDeleteTickets !== "enabled") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const {
    dateStart,
    dateEnd,
    queueIds = [],
    showAll = "false",
    whatsappIds = [],
    limit
  } = req.body as BulkDeleteClosedBody;

  const parsedLimit = Number(limit);

  const user = await ShowUserService(Number(userId), companyId);

  const ticketIds = await ResolveClosedTicketIdsService({
    companyId,
    user,
    queueIds: Array.isArray(queueIds) ? queueIds.map(id => Number(id)).filter(Number.isFinite) : [],
    showAll,
    whatsappIds: Array.isArray(whatsappIds)
      ? whatsappIds.map(id => Number(id)).filter(Number.isFinite)
      : [],
    dateStart,
    dateEnd,
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined,
    requireDateRange: true
  });

  return res.status(200).json({ count: ticketIds.length });
};

export const bulkDeleteClosed = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, id: userId, profile, canDeleteTickets } = req.user;

  if (profile !== "admin" && canDeleteTickets !== "enabled") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const {
    dateStart,
    dateEnd,
    queueIds = [],
    showAll = "false",
    whatsappIds = [],
    limit
  } = req.body as BulkDeleteClosedBody;

  const parsedLimit = Number(limit);

  const { deletedIds, deletedCount } = await BulkDeleteClosedTicketsService({
    companyId,
    userId: Number(userId),
    queueIds: Array.isArray(queueIds) ? queueIds.map(id => Number(id)).filter(Number.isFinite) : [],
    showAll,
    whatsappIds: Array.isArray(whatsappIds)
      ? whatsappIds.map(id => Number(id)).filter(Number.isFinite)
      : [],
    dateStart,
    dateEnd,
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined
  });

  const io = getIO();

  deletedIds.forEach(ticketId => {
    io.of(String(companyId)).emit(`company-${companyId}-ticket`, {
      action: "delete",
      ticketId
    });
  });

  return res.status(200).json({
    message: "closed tickets deleted",
    deletedCount
  });
};
