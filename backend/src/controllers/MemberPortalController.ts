import { Request, Response } from "express";
import AppError from "../errors/AppError";
import * as MemberPortalService from "../services/MemberService/MemberPortalService";

// Portal do Associado — login público (sem isAuth/isMemberAuth, é o
// próprio ponto de entrada) + check-in autenticado por token de membro
// (isMemberAuth, ver middleware/isMemberAuth.ts). Ver docs/MANUAL_TECNICO.md.
export const login = async (req: Request, res: Response): Promise<Response> => {
  const { document, pin } = req.body;
  const result = await MemberPortalService.login({ document, pin });
  return res.status(200).json(result);
};

export const submitHabitualidade = async (req: Request, res: Response): Promise<Response> => {
  const { id: memberId, companyId } = (req as any).member;
  const file = req.file as Express.Multer.File | undefined;

  if (!file) {
    throw new AppError("ERR_MEMBER_LOGBOOK_PHOTO_REQUIRED");
  }

  const latitude = parseFloat(req.body.latitude);
  const longitude = parseFloat(req.body.longitude);
  let descriptor: number[] | undefined;
  if (req.body.descriptor) {
    try {
      descriptor = JSON.parse(req.body.descriptor);
    } catch (err) {
      throw new AppError("ERR_MEMBER_INVALID_FACE_DESCRIPTOR");
    }
  }

  const logbookPhotoUrl = `${process.env.BACKEND_URL}/public/company${companyId}/member-logbook-photos/${encodeURIComponent(
    file.filename
  )}`;

  const record = await MemberPortalService.submitHabitualidade({
    memberId,
    companyId,
    descriptor,
    logbookPhotoUrl,
    latitude,
    longitude
  });

  return res.status(200).json(record);
};
