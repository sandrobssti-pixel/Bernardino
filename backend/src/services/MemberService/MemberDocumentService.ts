import AppError from "../../errors/AppError";
import Member from "../../models/Member";
import MemberWeapon from "../../models/MemberWeapon";
import MemberDocument from "../../models/MemberDocument";

// Checklist de documentos do associado — ver comentário em
// MemberDocument.ts. Tipos "multi" (ver MULTIPLE_DOCUMENT_TYPES) sempre
// criam uma linha nova; os demais (um slot fixo por tipo) substituem a
// linha existente quando já há uma pro mesmo (memberId, documentType[,
// weaponId]) — "Substituir" na tela é uma chamada normal de upload, o
// upsert acontece aqui, não no frontend.
const MULTIPLE_DOCUMENT_TYPES = ["other_documents", "loose_documents"];

interface UploadData {
  documentType: string;
  weaponId?: number | null;
  label?: string;
  fileUrl: string;
  fileName: string;
}

const ensureMemberExists = async (memberId: string | number, companyId: number): Promise<void> => {
  const member = await Member.findOne({ where: { id: memberId, companyId } });
  if (!member) {
    throw new AppError("ERR_MEMBER_NOT_FOUND", 404);
  }
};

const ensureWeaponBelongsToMember = async (
  weaponId: number,
  memberId: string | number,
  companyId: number
): Promise<void> => {
  const weapon = await MemberWeapon.findOne({ where: { id: weaponId, memberId, companyId } });
  if (!weapon) {
    throw new AppError("ERR_MEMBER_WEAPON_NOT_FOUND", 404);
  }
};

export const list = async (
  memberId: string | number,
  companyId: number
): Promise<MemberDocument[]> => {
  await ensureMemberExists(memberId, companyId);

  return MemberDocument.findAll({
    where: { memberId, companyId },
    order: [["uploadedAt", "DESC"]]
  });
};

export const upload = async (
  memberId: string | number,
  data: UploadData,
  companyId: number
): Promise<MemberDocument> => {
  await ensureMemberExists(memberId, companyId);

  if (!data.documentType) {
    throw new AppError("ERR_MEMBER_DOCUMENT_TYPE_REQUIRED");
  }
  if (data.weaponId) {
    await ensureWeaponBelongsToMember(data.weaponId, memberId, companyId);
  }

  const isMultiple = MULTIPLE_DOCUMENT_TYPES.includes(data.documentType);

  if (!isMultiple) {
    const whereCondition: any = { memberId, companyId, documentType: data.documentType };
    whereCondition.weaponId = data.weaponId || null;

    const existing = await MemberDocument.findOne({ where: whereCondition });
    if (existing) {
      await existing.update({
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        uploadedAt: new Date()
      });
      return existing;
    }
  }

  return MemberDocument.create({
    memberId,
    companyId,
    documentType: data.documentType,
    weaponId: data.weaponId || null,
    label: data.label || "",
    fileUrl: data.fileUrl,
    fileName: data.fileName,
    uploadedAt: new Date()
  } as any);
};

export const remove = async (id: string | number, companyId: number): Promise<void> => {
  const record = await MemberDocument.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_MEMBER_DOCUMENT_NOT_FOUND", 404);
  }
  await record.destroy();
};
