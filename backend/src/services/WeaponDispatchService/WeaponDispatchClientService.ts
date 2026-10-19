import { Op, Sequelize } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import WeaponDispatchClient from "../../models/WeaponDispatchClient";
import WeaponDispatchGovPasswordAccessLog from "../../models/WeaponDispatchGovPasswordAccessLog";
import { encryptSecret, decryptSecret } from "../../utils/weaponDispatchCrypto";

interface ListRequest {
  companyId: number;
  searchParam?: string;
  pageNumber?: string | number;
}

interface ListResponse {
  records: WeaponDispatchClient[];
  count: number;
  hasMore: boolean;
}

interface ClientData {
  name: string;
  cpf?: string;
  email?: string;
  whatsapp?: string;
  notes?: string;
  contactId?: number | null;
}

const clientSchema = Yup.object().shape({
  name: Yup.string().required("ERR_WEAPON_DISPATCH_CLIENT_INVALID_NAME").min(2)
});

// Nunca selecionar `govBrPasswordEncrypted` numa listagem/show genérico —
// só `getGovPassword` (abaixo) tem permissão de ler esse valor, e só
// depois de gravar o acesso em auditoria.
const PUBLIC_ATTRIBUTES = {
  exclude: ["govBrPasswordEncrypted"]
};

export const list = async ({
  companyId,
  searchParam = "",
  pageNumber = "1"
}: ListRequest): Promise<ListResponse> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const whereCondition: any = { companyId };

  if (searchParam) {
    whereCondition[Op.or] = [
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("WeaponDispatchClient.name")),
        "LIKE",
        `%${searchParam.toLowerCase().trim()}%`
      ),
      { cpf: { [Op.like]: `%${searchParam.trim()}%` } },
      { whatsapp: { [Op.like]: `%${searchParam.trim()}%` } }
    ];
  }

  const { count, rows: records } = await WeaponDispatchClient.findAndCountAll({
    where: whereCondition,
    attributes: PUBLIC_ATTRIBUTES,
    limit,
    offset,
    order: [["name", "ASC"]]
  });

  return { records, count, hasMore: count > offset + records.length };
};

export const show = async (
  id: string | number,
  companyId: number
): Promise<WeaponDispatchClient> => {
  const record = await WeaponDispatchClient.findOne({
    where: { id, companyId },
    attributes: PUBLIC_ATTRIBUTES
  });

  if (!record) {
    throw new AppError("ERR_WEAPON_DISPATCH_CLIENT_NOT_FOUND", 404);
  }

  return record;
};

export const create = async (
  data: ClientData,
  companyId: number
): Promise<WeaponDispatchClient> => {
  try {
    await clientSchema.validate(data);
  } catch (err) {
    throw new AppError(err.message);
  }

  const record = await WeaponDispatchClient.create({ ...data, companyId } as any);
  return show(record.id, companyId);
};

export const update = async (
  id: string | number,
  data: ClientData,
  companyId: number
): Promise<WeaponDispatchClient> => {
  try {
    await clientSchema.validate(data);
  } catch (err) {
    throw new AppError(err.message);
  }

  const record = await WeaponDispatchClient.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_WEAPON_DISPATCH_CLIENT_NOT_FOUND", 404);
  }

  await record.update(data);
  return show(id, companyId);
};

export const remove = async (id: string | number, companyId: number): Promise<void> => {
  const record = await WeaponDispatchClient.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_WEAPON_DISPATCH_CLIENT_NOT_FOUND", 404);
  }
  await record.destroy();
};

// Grava a senha do gov.br do cliente, SEMPRE cifrada (nunca em texto puro
// — pedido explícito do cliente, era assim no Notion antes). Não é
// auditado como "acesso" (é uma ESCRITA, não leitura do valor existente).
export const setGovPassword = async (
  id: string | number,
  companyId: number,
  plainPassword: string
): Promise<void> => {
  const record = await WeaponDispatchClient.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_WEAPON_DISPATCH_CLIENT_NOT_FOUND", 404);
  }
  if (!plainPassword || !plainPassword.trim()) {
    throw new AppError("ERR_WEAPON_DISPATCH_CLIENT_INVALID_PASSWORD", 400);
  }

  await record.update({
    govBrPasswordEncrypted: encryptSecret(plainPassword),
    govBrPasswordUpdatedAt: new Date()
  });
};

// Único jeito permitido de ler a senha decifrada — grava em
// WeaponDispatchGovPasswordAccessLog ANTES de devolver o valor, nunca
// depois (se o decrypt falhar, melhor não ter registrado um acesso que
// não aconteceu; mas aqui o registro vem primeiro de propósito: queremos
// saber que ALGUÉM TENTOU acessar, mesmo que o valor decifre errado por
// chave trocada/corrompida).
export const getGovPassword = async (
  id: string | number,
  companyId: number,
  accessedByUserId: number,
  reason?: string
): Promise<string> => {
  const record = await WeaponDispatchClient.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_WEAPON_DISPATCH_CLIENT_NOT_FOUND", 404);
  }
  if (!record.govBrPasswordEncrypted) {
    throw new AppError("ERR_WEAPON_DISPATCH_CLIENT_NO_PASSWORD_SAVED", 404);
  }

  await WeaponDispatchGovPasswordAccessLog.create({
    clientId: record.id,
    accessedByUserId,
    reason: reason || null,
    accessedAt: new Date()
  } as any);

  return decryptSecret(record.govBrPasswordEncrypted);
};
