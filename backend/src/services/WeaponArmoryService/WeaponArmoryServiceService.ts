import { Op, Sequelize } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import WeaponArmoryService from "../../models/WeaponArmoryService";

interface ListRequest {
  companyId: number;
  searchParam?: string;
  pageNumber?: string | number;
}

interface ListResponse {
  records: WeaponArmoryService[];
  count: number;
  hasMore: boolean;
}

interface ServiceData {
  contactId?: number | null;
  clientName: string;
  clientCpf?: string;
  clientRg?: string;
  clientProfession?: string;
  clientAddress?: string;
  clientPhone?: string;
  clientEmail?: string;
  weaponType?: string;
  weaponBrand?: string;
  weaponModel?: string;
  weaponCaliber?: string;
  weaponSerialNumber?: string;
  weaponCapacity?: string;
  weaponFinish?: string;
  weaponCountryOfOrigin?: string;
  accessoriesMagazineQty?: string;
  accessoriesCase?: boolean;
  accessoriesHolster?: boolean;
  accessoriesOther?: string;
  crafNumber?: string;
  crafExpiry?: Date | null;
  trafficGuideNumber?: string;
  trafficGuideExpiry?: Date | null;
  trafficGuideIssuer?: string;
  authorizationType?: string;
  authorizationNumber?: string;
  authorizationExpiry?: Date | null;
  serviceRequested?: string;
  defectReported?: string;
  conservationState?: string;
  workPerformedDescription?: string;
  status?: string;
  receivedAt?: Date | null;
  returnedAt?: Date | null;
}

const serviceSchema = Yup.object().shape({
  clientName: Yup.string().required("ERR_WEAPON_ARMORY_INVALID_CLIENT_NAME").min(2)
});

export const list = async ({
  companyId,
  searchParam = "",
  pageNumber = "1"
}: ListRequest): Promise<ListResponse> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const whereCondition: any = { companyId };

  if (searchParam) {
    const term = searchParam.trim();
    whereCondition[Op.or] = [
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("WeaponArmoryService.clientName")),
        "LIKE",
        `%${term.toLowerCase()}%`
      ),
      { clientCpf: { [Op.like]: `%${term}%` } },
      { weaponSerialNumber: { [Op.like]: `%${term}%` } }
    ];
  }

  const { count, rows: records } = await WeaponArmoryService.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["createdAt", "DESC"]]
  });

  return { records, count, hasMore: count > offset + records.length };
};

export const show = async (
  id: string | number,
  companyId: number
): Promise<WeaponArmoryService> => {
  const record = await WeaponArmoryService.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_WEAPON_ARMORY_NOT_FOUND", 404);
  }
  return record;
};

export const create = async (
  data: ServiceData,
  companyId: number
): Promise<WeaponArmoryService> => {
  try {
    await serviceSchema.validate(data);
  } catch (err) {
    throw new AppError(err.message);
  }

  const record = await WeaponArmoryService.create({
    ...data,
    receivedAt: data.receivedAt || new Date(),
    companyId
  } as any);
  return record;
};

export const update = async (
  id: string | number,
  data: Partial<ServiceData>,
  companyId: number
): Promise<WeaponArmoryService> => {
  const record = await show(id, companyId);

  try {
    await serviceSchema.validate({ ...record.toJSON(), ...data });
  } catch (err) {
    throw new AppError(err.message);
  }

  await record.update(data);
  return record;
};

export const remove = async (id: string | number, companyId: number): Promise<void> => {
  const record = await show(id, companyId);
  await record.destroy();
};

// Fotos antes/depois — appende nova(s) URL(s) no array já salvo (JSON em
// TEXT, ver WeaponArmoryService.ts). `stage` decide qual das duas colunas.
export const addPhotos = async (
  id: string | number,
  companyId: number,
  stage: "before" | "after",
  newUrls: string[]
): Promise<string[]> => {
  const record = await show(id, companyId);
  const field = stage === "after" ? "photosAfter" : "photosBefore";

  let current: string[] = [];
  try {
    current = JSON.parse((record as any)[field] || "[]");
  } catch {
    current = [];
  }

  const updated = [...current, ...newUrls];
  await record.update({ [field]: JSON.stringify(updated) } as any);
  return updated;
};

export const removePhoto = async (
  id: string | number,
  companyId: number,
  stage: "before" | "after",
  url: string
): Promise<string[]> => {
  const record = await show(id, companyId);
  const field = stage === "after" ? "photosAfter" : "photosBefore";

  let current: string[] = [];
  try {
    current = JSON.parse((record as any)[field] || "[]");
  } catch {
    current = [];
  }

  const updated = current.filter((u) => u !== url);
  await record.update({ [field]: JSON.stringify(updated) } as any);
  return updated;
};
