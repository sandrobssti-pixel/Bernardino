import AppError from "../../errors/AppError";
import Company from "../../models/Company";

type ScheduleData = {
  id: number | string;
  schedules?: [];
  holidaySchedules?: [];
};

const UpdateSchedulesService = async ({
  id,
  schedules,
  holidaySchedules
}: ScheduleData): Promise<Company> => {
  const company = await Company.findByPk(id);

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const payload: Partial<Company> & {
    schedules?: [];
    holidaySchedules?: [];
  } = {};

  if (schedules !== undefined) {
    payload.schedules = schedules;
  }

  if (holidaySchedules !== undefined) {
    payload.holidaySchedules = holidaySchedules;
  }

  await company.update(payload);

  return company;
};

export default UpdateSchedulesService;
