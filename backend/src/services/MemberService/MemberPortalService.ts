import { sign } from "jsonwebtoken";
import { hash, compare } from "bcryptjs";
import AppError from "../../errors/AppError";
import authConfig from "../../config/auth";
import Member from "../../models/Member";
import MemberCheckIn from "../../models/MemberCheckIn";

// Portal do Associado — acesso próprio do associado (diferente do login
// de equipe/Admin do AtendeFlow), pedido explícito do cliente pra ele
// mesmo enviar a foto do livro físico + geolocalização na hora que
// assina. Ver docs/MANUAL_TECNICO.md.

// PIN gerado pelo Admin (EnsureMembersAccess, dentro da administração do
// clube) — mostrado em texto puro só UMA VEZ na resposta desta função,
// pro Admin repassar ao associado fora do sistema (presencialmente,
// WhatsApp). Depois disso, só o hash fica guardado — nem o próprio Admin
// consegue ver de novo, só gerar um novo (revoga o anterior).
export const generatePortalPin = async (
  memberId: string | number,
  companyId: number
): Promise<{ pin: string }> => {
  const member = await Member.findOne({ where: { id: memberId, companyId } });
  if (!member) {
    throw new AppError("ERR_MEMBER_NOT_FOUND", 404);
  }

  const pin = String(Math.floor(100000 + Math.random() * 900000));
  member.portalPinHash = await hash(pin, 8);
  member.portalPinSetAt = new Date();
  await member.save();

  return { pin };
};

interface LoginRequest {
  document: string;
  pin: string;
}

interface LoginResponse {
  token: string;
  member: {
    id: number;
    name: string;
    code: string;
    companyId: number;
    faceEnrolled: boolean;
    filiationValidUntil: Date | null;
  };
}

// "document" (CPF) não é único GLOBALMENTE no banco, só por empresa (um
// mesmo CPF pode legitimamente ser associado de dois clubes clientes
// diferentes) — limitação conhecida desta primeira versão: se o mesmo
// CPF + PIN coincidir em mais de uma empresa (extremamente raro, mas
// possível por coincidência de PIN), o login é recusado por ambiguidade
// em vez de arriscar logar na empresa errada. Ver docs/MANUAL_TECNICO.md.
export const login = async ({ document, pin }: LoginRequest): Promise<LoginResponse> => {
  const trimmedDocument = String(document || "").trim();
  if (!trimmedDocument || !pin) {
    throw new AppError("ERR_MEMBER_PORTAL_INVALID_CREDENTIALS", 401);
  }

  const candidates = await Member.findAll({
    where: { document: trimmedDocument },
    attributes: ["id", "name", "code", "companyId", "portalPinHash", "faceEnrolled", "filiationValidUntil"]
  });

  const matches: Member[] = [];
  for (const candidate of candidates) {
    if (!candidate.portalPinHash) continue;
    // eslint-disable-next-line no-await-in-loop
    if (await compare(pin, candidate.portalPinHash)) {
      matches.push(candidate);
    }
  }

  if (matches.length !== 1) {
    throw new AppError("ERR_MEMBER_PORTAL_INVALID_CREDENTIALS", 401);
  }

  const member = matches[0];
  const token = sign(
    { memberId: member.id, companyId: member.companyId, scope: "member" },
    authConfig.secret,
    { expiresIn: "12h" }
  );

  return {
    token,
    member: {
      id: member.id,
      name: member.name,
      code: member.code,
      companyId: member.companyId,
      faceEnrolled: member.faceEnrolled,
      filiationValidUntil: member.filiationValidUntil
    }
  };
};

const euclideanDistance = (a: number[], b: number[]): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
};

const MATCH_THRESHOLD = 0.6;

interface SubmitHabitualidadeRequest {
  memberId: number;
  companyId: number;
  descriptor?: number[];
  logbookPhotoUrl: string;
  latitude: number;
  longitude: number;
}

// Entrada de habitualidade — SEMPRE exige foto do livro + geolocalização
// (é o ponto central do pedido do cliente). Reconhecimento facial é uma
// camada extra de confirmação quando o associado já tem o rosto
// cadastrado (confirma que é ele mesmo segurando o celular, não só quem
// sabe o PIN) — se ainda não cadastrou o rosto, a entrada é aceita
// mesmo assim (cadastro de reconhecimento facial não é obrigatório pra
// usar o Portal, só um reforço quando existe).
export const submitHabitualidade = async ({
  memberId,
  companyId,
  descriptor,
  logbookPhotoUrl,
  latitude,
  longitude
}: SubmitHabitualidadeRequest): Promise<MemberCheckIn> => {
  if (!logbookPhotoUrl) {
    throw new AppError("ERR_MEMBER_LOGBOOK_PHOTO_REQUIRED");
  }
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude)
  ) {
    throw new AppError("ERR_MEMBER_GEOLOCATION_REQUIRED");
  }

  const member = await Member.findOne({
    where: { id: memberId, companyId },
    attributes: ["id", "faceDescriptor", "faceEnrolled"]
  });
  if (!member) {
    throw new AppError("ERR_MEMBER_NOT_FOUND", 404);
  }

  let matchDistance: number | undefined;
  if (member.faceEnrolled && member.faceDescriptor) {
    if (!Array.isArray(descriptor) || descriptor.length !== 128) {
      throw new AppError("ERR_MEMBER_INVALID_FACE_DESCRIPTOR");
    }
    const stored = JSON.parse(member.faceDescriptor);
    matchDistance = euclideanDistance(stored, descriptor);
    if (matchDistance > MATCH_THRESHOLD) {
      throw new AppError("ERR_MEMBER_FACE_MISMATCH");
    }
  }

  return MemberCheckIn.create({
    memberId,
    companyId,
    checkedInAt: new Date(),
    matchDistance,
    logbookPhotoUrl,
    latitude,
    longitude,
    validationStatus: "pending",
    source: "portal"
  } as any);
};
