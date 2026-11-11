import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Member from "../../models/Member";
import MemberWeapon from "../../models/MemberWeapon";

// Arma PESSOAL do associado — ver comentário em MemberWeapon.ts. Toda
// operação exige o Member (dono da arma) já existir e pertencer à
// mesma empresa (companyId), mesmo cuidado multi-tenant do resto do
// módulo.
interface MemberWeaponData {
  usageType?: string;
  storageLocation?: string;
  brand?: string;
  model: string;
  weaponType?: string;
  caliber?: string;
  serialNumber?: string;
  sigmaRegistrationNumber?: string;
  crafValidUntil?: string | null;
  active?: boolean;
  notes?: string;
}

const weaponSchema = Yup.object().shape({
  model: Yup.string().min(1, "ERR_MEMBER_WEAPON_INVALID_MODEL").required("ERR_MEMBER_WEAPON_INVALID_MODEL")
});

const normalizeWeaponData = (data: MemberWeaponData): MemberWeaponData => ({
  ...data,
  crafValidUntil: data.crafValidUntil || null
});

const ensureMemberExists = async (memberId: string | number, companyId: number): Promise<void> => {
  const member = await Member.findOne({ where: { id: memberId, companyId } });
  if (!member) {
    throw new AppError("ERR_MEMBER_NOT_FOUND", 404);
  }
};

export const list = async (
  memberId: string | number,
  companyId: number
): Promise<MemberWeapon[]> => {
  await ensureMemberExists(memberId, companyId);

  return MemberWeapon.findAll({
    where: { memberId, companyId },
    order: [["createdAt", "ASC"]]
  });
};

export const create = async (
  memberId: string | number,
  data: MemberWeaponData,
  companyId: number
): Promise<MemberWeapon> => {
  await ensureMemberExists(memberId, companyId);
  data = normalizeWeaponData(data);

  try {
    await weaponSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const record = await MemberWeapon.create({
    ...data,
    memberId,
    companyId
  } as any);

  return record;
};

export const update = async (
  id: string | number,
  data: MemberWeaponData,
  companyId: number
): Promise<MemberWeapon> => {
  const record = await MemberWeapon.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_MEMBER_WEAPON_NOT_FOUND", 404);
  }

  data = normalizeWeaponData(data);

  try {
    await weaponSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await record.update(data);
  return record;
};

export const remove = async (id: string | number, companyId: number): Promise<void> => {
  const record = await MemberWeapon.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_MEMBER_WEAPON_NOT_FOUND", 404);
  }
  await record.destroy();
};
