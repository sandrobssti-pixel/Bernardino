import AppError from "../../errors/AppError";
import Notification from "../../models/Notification";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import User from "../../models/User";

interface RequestUser {
  id: number;
  companyId: number;
  profile: string;
  super?: boolean;
  supervisorPanelAccess?: boolean;
}

const includeTicketContact = [
  {
    model: Ticket,
    as: "ticket",
    attributes: ["id", "uuid", "status"],
    include: [{ model: Contact, as: "contact", attributes: ["id", "name", "number"] }]
  },
  { model: User, as: "user", attributes: ["id", "name"] }
];

const isSupervisor = (user: RequestUser): boolean =>
  !!user.super || user.profile === "admin" || !!user.supervisorPanelAccess;

export const list = async (user: RequestUser): Promise<Notification[]> => {
  const where = isSupervisor(user)
    ? { companyId: user.companyId }
    : { companyId: user.companyId, userId: user.id };

  return Notification.findAll({
    where,
    include: includeTicketContact,
    order: [["createdAt", "DESC"]],
    limit: 100
  });
};

export const create = async (data: {
  type: string;
  title: string;
  message: string;
  userId?: number | null;
  ticketId?: number | null;
  companyId: number;
}): Promise<Notification> => {
  const record = await Notification.create(data as any);
  return Notification.findByPk(record.id, { include: includeTicketContact });
};

export const remove = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const record = await Notification.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_NOTIFICATION_NOT_FOUND", 404);
  }
  await record.destroy();
};

export const removeAll = async (companyId: number): Promise<void> => {
  await Notification.destroy({ where: { companyId } });
};
