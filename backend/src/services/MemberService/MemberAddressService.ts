import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Member from "../../models/Member";
import MemberAddress from "../../models/MemberAddress";

// Endereço ADICIONAL do associado — ver comentário em MemberAddress.ts.
interface MemberAddressData {
  addressType?: string;
  description?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

const addressSchema = Yup.object().shape({
  zipCode: Yup.string().min(1, "ERR_MEMBER_ADDRESS_INVALID").required("ERR_MEMBER_ADDRESS_INVALID"),
  street: Yup.string().min(1, "ERR_MEMBER_ADDRESS_INVALID").required("ERR_MEMBER_ADDRESS_INVALID"),
  number: Yup.string().min(1, "ERR_MEMBER_ADDRESS_INVALID").required("ERR_MEMBER_ADDRESS_INVALID"),
  neighborhood: Yup.string().min(1, "ERR_MEMBER_ADDRESS_INVALID").required("ERR_MEMBER_ADDRESS_INVALID"),
  city: Yup.string().min(1, "ERR_MEMBER_ADDRESS_INVALID").required("ERR_MEMBER_ADDRESS_INVALID")
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
): Promise<MemberAddress[]> => {
  await ensureMemberExists(memberId, companyId);

  return MemberAddress.findAll({
    where: { memberId, companyId },
    order: [["createdAt", "ASC"]]
  });
};

export const create = async (
  memberId: string | number,
  data: MemberAddressData,
  companyId: number
): Promise<MemberAddress> => {
  await ensureMemberExists(memberId, companyId);

  try {
    await addressSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  return MemberAddress.create({
    ...data,
    memberId,
    companyId
  } as any);
};

export const update = async (
  id: string | number,
  data: MemberAddressData,
  companyId: number
): Promise<MemberAddress> => {
  const record = await MemberAddress.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_MEMBER_ADDRESS_NOT_FOUND", 404);
  }

  try {
    await addressSchema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await record.update(data);
  return record;
};

export const remove = async (id: string | number, companyId: number): Promise<void> => {
  const record = await MemberAddress.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_MEMBER_ADDRESS_NOT_FOUND", 404);
  }
  await record.destroy();
};
