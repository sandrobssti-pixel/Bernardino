import AppError from "../../errors/AppError";
import Member from "../../models/Member";
import MemberCheckIn from "../../models/MemberCheckIn";

// Limiar padrão do face-api.js (distância euclidiana entre dois
// descritores de 128 números) — abaixo disso, é considerado "a mesma
// pessoa". Mesmo valor usado pela biblioteca no navegador (FaceMatcher),
// pra manter consistência entre o que o operador vê no kiosk e o que o
// backend de fato aceita.
const MATCH_THRESHOLD = 0.6;

const euclideanDistance = (a: number[], b: number[]): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
};

// Descritor é calculado 100% no navegador (face-api.js, WebGL) — o
// backend nunca recebe nem processa a imagem em si, só guarda e compara
// os 128 números. Ver docs/MANUAL_TECNICO.md.
export const setFaceDescriptor = async (
  id: string | number,
  companyId: number,
  descriptor: number[]
): Promise<Member> => {
  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    throw new AppError("ERR_MEMBER_INVALID_FACE_DESCRIPTOR");
  }

  const record = await Member.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("ERR_MEMBER_NOT_FOUND", 404);
  }

  record.faceDescriptor = JSON.stringify(descriptor);
  record.faceEnrolled = true;
  await record.save();
  return record;
};

interface CheckInResult {
  matched: boolean;
  member?: Member;
  distance?: number;
}

// Compara o descritor capturado no kiosk contra TODOS os associados da
// empresa que já têm reconhecimento facial cadastrado, e devolve o mais
// parecido (se dentro do limiar). "Sem reconhecimento" é um resultado
// normal (pessoa não cadastrada, ou rosto não bateu) — devolve 200 com
// matched:false, não um erro HTTP, pra não misturar controle de fluxo
// esperado com exceção.
export const checkIn = async (
  companyId: number,
  descriptor: number[]
): Promise<CheckInResult> => {
  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    throw new AppError("ERR_MEMBER_INVALID_FACE_DESCRIPTOR");
  }

  const candidates = await Member.findAll({
    where: { companyId },
    attributes: ["id", "name", "code", "photoUrl", "status", "faceDescriptor"]
  });

  let best: { member: Member; distance: number } | null = null;

  for (const candidate of candidates) {
    if (!candidate.faceDescriptor) continue;
    let stored: number[];
    try {
      stored = JSON.parse(candidate.faceDescriptor);
    } catch (err) {
      continue;
    }
    if (!Array.isArray(stored) || stored.length !== 128) continue;

    const distance = euclideanDistance(stored, descriptor);
    if (!best || distance < best.distance) {
      best = { member: candidate, distance };
    }
  }

  if (!best || best.distance > MATCH_THRESHOLD) {
    return { matched: false };
  }

  await MemberCheckIn.create({
    memberId: best.member.id,
    companyId,
    checkedInAt: new Date(),
    matchDistance: best.distance
  } as any);

  // NUNCA devolver o "candidate" direto — ele foi buscado com
  // "faceDescriptor" no select (precisa pra calcular a distância) e esse
  // campo biométrico sensível não pode vazar na resposta HTTP. Monta um
  // objeto limpo só com o que a tela de check-in realmente usa.
  const { id, name, code, photoUrl, status } = best.member;
  return {
    matched: true,
    member: { id, name, code, photoUrl, status } as Member,
    distance: best.distance
  };
};

interface ListCheckInsRequest {
  companyId: number;
  memberId?: string | number;
  pageNumber?: string | number;
}

export const listCheckIns = async ({
  companyId,
  memberId,
  pageNumber = "1"
}: ListCheckInsRequest): Promise<{ records: MemberCheckIn[]; count: number; hasMore: boolean }> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const whereCondition: any = { companyId };
  if (memberId) whereCondition.memberId = memberId;

  const { count, rows: records } = await MemberCheckIn.findAndCountAll({
    where: whereCondition,
    include: [{ model: Member, as: "member", attributes: ["id", "name", "code", "photoUrl"] }],
    limit,
    offset,
    order: [["checkedInAt", "DESC"]]
  });

  return { records, count, hasMore: count > offset + records.length };
};
