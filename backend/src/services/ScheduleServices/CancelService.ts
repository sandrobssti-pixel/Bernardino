import Schedule from "../../models/Schedule";
import AppError from "../../errors/AppError";

const CancelService = async (
  id: string | number,
  companyId: number
): Promise<Schedule> => {
  const schedule = await Schedule.findOne({
    where: { id, companyId }
  });

  if (!schedule) {
    throw new AppError("ERR_NO_SCHEDULE_FOUND", 404);
  }

  if (!["PENDENTE", "AGENDADA"].includes(schedule.status)) {
    throw new AppError("ERR_SCHEDULE_CANNOT_BE_CANCELLED");
  }

  await schedule.update({ status: "CANCELADA" });
  await schedule.reload();

  return schedule;
};

export default CancelService;
