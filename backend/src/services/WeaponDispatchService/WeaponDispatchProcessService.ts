import * as Yup from "yup";
import AppError from "../../errors/AppError";
import WeaponDispatchProcess from "../../models/WeaponDispatchProcess";
import WeaponDispatchStatusHistory from "../../models/WeaponDispatchStatusHistory";
import WeaponDispatchClient from "../../models/WeaponDispatchClient";
import {
  getDefaultStage,
  getTrackForProcessType,
  isValidStage,
  WeaponDispatchTrack
} from "./WeaponDispatchStageCatalog";

interface ListRequest {
  companyId: number;
  track?: WeaponDispatchTrack;
  clientId?: string | number;
}

interface ProcessData {
  type: string;
  clientId: number;
  priority?: number;
  isAffiliatedClub?: boolean;
  hasPsychTest?: boolean;
  hasShootingCert?: boolean;
  documentsComplete?: boolean;
  protocolNumber?: string;
  protocolDate?: Date | null;
  productOrService?: string;
  pendingReason?: string;
  observations?: string;
  driveUrl?: string;
  startedAt?: Date | null;
  assignedUserId?: number | null;
}

const processSchema = Yup.object().shape({
  type: Yup.string().required("ERR_WEAPON_DISPATCH_PROCESS_INVALID_TYPE"),
  clientId: Yup.number().required("ERR_WEAPON_DISPATCH_PROCESS_INVALID_CLIENT")
});

const INCLUDE = [{ model: WeaponDispatchClient, as: "client" }];

// Esteira (Kanban) — lista os processos da empresa, opcionalmente filtrando
// por trilha (pra renderizar uma coluna por `stage` dentro da trilha
// escolhida no frontend) e/ou por cliente (histórico de um cliente só).
export const list = async ({
  companyId,
  track,
  clientId
}: ListRequest): Promise<WeaponDispatchProcess[]> => {
  const whereCondition: any = { companyId };
  if (track) whereCondition.track = track;
  if (clientId) whereCondition.clientId = clientId;

  return WeaponDispatchProcess.findAll({
    where: whereCondition,
    include: INCLUDE,
    order: [
      ["priority", "DESC"],
      ["createdAt", "ASC"]
    ]
  });
};

export const show = async (
  id: string | number,
  companyId: number
): Promise<WeaponDispatchProcess> => {
  const record = await WeaponDispatchProcess.findOne({
    where: { id, companyId },
    include: INCLUDE
  });

  if (!record) {
    throw new AppError("ERR_WEAPON_DISPATCH_PROCESS_NOT_FOUND", 404);
  }

  return record;
};

export const create = async (
  data: ProcessData,
  companyId: number
): Promise<WeaponDispatchProcess> => {
  try {
    await processSchema.validate(data);
  } catch (err) {
    throw new AppError(err.message);
  }

  const client = await WeaponDispatchClient.findOne({
    where: { id: data.clientId, companyId }
  });
  if (!client) {
    throw new AppError("ERR_WEAPON_DISPATCH_CLIENT_NOT_FOUND", 404);
  }

  const track = getTrackForProcessType(data.type);
  const stage = getDefaultStage(track);

  const record = await WeaponDispatchProcess.create({
    ...data,
    track,
    stage,
    companyId
  } as any);

  await WeaponDispatchStatusHistory.create({
    processId: record.id,
    previousStage: null,
    newStage: stage,
    changedAt: new Date(),
    changedByUserId: null
  } as any);

  return show(record.id, companyId);
};

export const update = async (
  id: string | number,
  data: Partial<ProcessData>,
  companyId: number
): Promise<WeaponDispatchProcess> => {
  const record = await WeaponDispatchProcess.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_WEAPON_DISPATCH_PROCESS_NOT_FOUND", 404);
  }

  // `type`/`track` não mudam por aqui — trocar o tipo de processo depois
  // de criado (ex. de "CR" pra "GT") muda a esteira inteira por baixo, o
  // que exigiria decidir pra qual stage a nova trilha deveria começar;
  // não é um caso real pedido ainda, então fica bloqueado por enquanto
  // (criar um processo novo é o caminho certo quando isso acontecer).
  const { type, track, stage, ...safeData } = data as any;

  await record.update(safeData);
  return show(id, companyId);
};

export const remove = async (id: string | number, companyId: number): Promise<void> => {
  const record = await WeaponDispatchProcess.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_WEAPON_DISPATCH_PROCESS_NOT_FOUND", 404);
  }
  await record.destroy();
};

// Move o card na esteira — único jeito permitido de trocar `stage`
// (nunca direto por `update`, ver acima), porque toda troca precisa virar
// uma linha em WeaponDispatchStatusHistory. `changedByUserId` nulo = troca
// automática (robô de consulta de protocolo, fase de automação, ainda não
// implementada).
export const changeStage = async (
  id: string | number,
  newStage: string,
  companyId: number,
  changedByUserId: number | null
): Promise<WeaponDispatchProcess> => {
  const record = await WeaponDispatchProcess.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_WEAPON_DISPATCH_PROCESS_NOT_FOUND", 404);
  }

  if (!isValidStage(record.track as WeaponDispatchTrack, newStage)) {
    throw new AppError("ERR_WEAPON_DISPATCH_PROCESS_INVALID_STAGE", 400);
  }

  const previousStage = record.stage;
  if (previousStage === newStage) {
    return show(id, companyId);
  }

  await record.update({ stage: newStage });

  await WeaponDispatchStatusHistory.create({
    processId: record.id,
    previousStage,
    newStage,
    changedAt: new Date(),
    changedByUserId: changedByUserId || null
  } as any);

  // Notificação (WhatsApp/e-mail) pro cliente fica pra uma fase própria
  // (ver prompt original, seção 5) — WeaponDispatchStatusHistory já tem os
  // campos `notificationSent`/`notificationChannel` prontos pra quando
  // isso for implementado, sem precisar de migration nova.

  return show(id, companyId);
};
