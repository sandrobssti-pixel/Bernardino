import { Op } from "sequelize";
import User from "../../models/User";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Task from "../../models/Task";
import UpdateDeletedUserOpenTicketsStatus from "../../helpers/UpdateDeletedUserOpenTicketsStatus";

const DeleteUserService = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const user = await User.findOne({
    where: { id, companyId }
  });

  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  // Protege o super admin principal do sistema contra exclusão.
  const isProtectedSuperAdmin = Boolean(user.super) || Number(user.id) === 1;
  if (isProtectedSuperAdmin) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const userOpenTickets: Ticket[] = await user.$get("tickets", {
    where: { status: "open" }
  });

  if (userOpenTickets.length > 0) {
    UpdateDeletedUserOpenTicketsStatus(userOpenTickets, companyId);
  }

  const userTasksCount = await Task.count({
    where: {
      companyId,
      [Op.or]: [{ responsibleUserId: user.id }, { createdByUserId: user.id }]
    }
  });

  if (userTasksCount > 0) {
    throw new AppError("ERR_USER_HAS_TASKS", 400);
  }

  await user.destroy();
};

export default DeleteUserService;
