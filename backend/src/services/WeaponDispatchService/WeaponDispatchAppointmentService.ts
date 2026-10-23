import * as Yup from "yup";
import AppError from "../../errors/AppError";
import WeaponDispatchAppointment from "../../models/WeaponDispatchAppointment";
import WeaponDispatchProcess from "../../models/WeaponDispatchProcess";

interface AppointmentData {
  type: string;
  scheduledAt: Date;
  status?: string;
  observations?: string;
  processId: number;
}

const appointmentSchema = Yup.object().shape({
  type: Yup.string()
    .oneOf(["psychTest", "shootingTest"], "ERR_WEAPON_DISPATCH_APPOINTMENT_INVALID_TYPE")
    .required("ERR_WEAPON_DISPATCH_APPOINTMENT_INVALID_TYPE"),
  scheduledAt: Yup.date().required("ERR_WEAPON_DISPATCH_APPOINTMENT_INVALID_DATE"),
  processId: Yup.number().required("ERR_WEAPON_DISPATCH_APPOINTMENT_INVALID_PROCESS")
});

// Reconfirma que o processo pertence à mesma empresa do usuário autenticado
// antes de qualquer leitura/escrita — mesmo padrão de reconferência de
// companyId usado no resto do projeto (ver skill atendeflow-dev seção 4),
// já que WeaponDispatchAppointment não tem `companyId` próprio (chega
// através do processo).
const ensureProcessBelongsToCompany = async (
  processId: number,
  companyId: number
): Promise<void> => {
  const process = await WeaponDispatchProcess.findOne({
    where: { id: processId, companyId }
  });
  if (!process) {
    throw new AppError("ERR_WEAPON_DISPATCH_PROCESS_NOT_FOUND", 404);
  }
};

export const listByProcess = async (
  processId: string | number,
  companyId: number
): Promise<WeaponDispatchAppointment[]> => {
  await ensureProcessBelongsToCompany(Number(processId), companyId);

  return WeaponDispatchAppointment.findAll({
    where: { processId },
    order: [["scheduledAt", "ASC"]]
  });
};

export const create = async (
  data: AppointmentData,
  companyId: number
): Promise<WeaponDispatchAppointment> => {
  try {
    await appointmentSchema.validate(data);
  } catch (err) {
    throw new AppError(err.message);
  }

  await ensureProcessBelongsToCompany(data.processId, companyId);

  return WeaponDispatchAppointment.create({ ...data } as any);
};

export const update = async (
  id: string | number,
  data: Partial<AppointmentData>,
  companyId: number
): Promise<WeaponDispatchAppointment> => {
  const record = await WeaponDispatchAppointment.findOne({ where: { id } });
  if (!record) {
    throw new AppError("ERR_WEAPON_DISPATCH_APPOINTMENT_NOT_FOUND", 404);
  }

  await ensureProcessBelongsToCompany(record.processId, companyId);

  await record.update(data);
  return record;
};

export const remove = async (id: string | number, companyId: number): Promise<void> => {
  const record = await WeaponDispatchAppointment.findOne({ where: { id } });
  if (!record) {
    throw new AppError("ERR_WEAPON_DISPATCH_APPOINTMENT_NOT_FOUND", 404);
  }

  await ensureProcessBelongsToCompany(record.processId, companyId);

  await record.destroy();
};
