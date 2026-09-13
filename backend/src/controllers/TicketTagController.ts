import { Request, Response } from "express";
import AppError from "../errors/AppError";
import TicketTag from '../models/TicketTag';
import Tag from '../models/Tag'
import { getIO } from "../libs/socket";
import Ticket from "../models/Ticket";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import logger from "../utils/logger";

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId, tagId } = req.params;
  const { companyId } = req.user;

  try {
    // Evita duplicata caso a associação já exista (race condition no drag)
    const existing = await TicketTag.findOne({ where: { ticketId, tagId } });
    if (!existing) {
      await TicketTag.create({ ticketId, tagId });
    }

    const ticket = await ShowTicketService(ticketId, companyId);

    const io = getIO();
    io.of(String(companyId))
      .emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket
      });

    return res.status(201).json({ ticketId, tagId });
  } catch (error) {
    logger.error(`TicketTagController.store error: ticketId=${ticketId} tagId=${tagId}`, error);
    return res.status(500).json({ error: 'Failed to store ticket tag.' });
  }
};

/*
export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;

  console.log("remove");
  console.log(req.params);

  try {
    await TicketTag.destroy({ where: { ticketId } });
    return res.status(200).json({ message: 'Ticket tags removed successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to remove ticket tags.' });
  }
};
*/
export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;

  try {
    // Busca todas as tags kanban associadas ao ticket
    const ticketTags = await TicketTag.findAll({ where: { ticketId } });
    const tagIds = ticketTags.map((tt) => tt.tagId);

    if (tagIds.length > 0) {
      const tagsWithKanbanOne = await Tag.findAll({
        where: { id: tagIds, kanban: 1 },
      });

      const kanbanTagIds = tagsWithKanbanOne.map((tag) => tag.id);

      // Guard explícito: evita WHERE tagId IN () que causa SQL inválido no Sequelize 5
      if (kanbanTagIds.length > 0) {
        await TicketTag.destroy({ where: { ticketId, tagId: kanbanTagIds } });
      }
    }

    const ticket = await ShowTicketService(ticketId, companyId);

    const io = getIO();
    io.of(String(companyId))
      .emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket
      });

    return res.status(200).json({ message: 'Ticket tags removed successfully.' });
  } catch (error) {
    logger.error(`TicketTagController.remove error: ticketId=${ticketId}`, error);
    return res.status(500).json({ error: 'Failed to remove ticket tags.' });
  }
};