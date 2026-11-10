import { Router } from "express";
import multer from "multer";
import isMemberAuth from "../middleware/isMemberAuth";
import memberLogbookPhotoUpload from "../config/memberLogbookPhotoUpload";

import * as MemberPortalController from "../controllers/MemberPortalController";

const memberPortalRoutes = Router();
const logbookPhotoUpload = multer(memberLogbookPhotoUpload);

// Portal do Associado — acesso PRÓPRIO do associado (CPF + PIN gerado
// pelo Admin), separado do login de equipe/Admin do AtendeFlow. Rota de
// login é pública de propósito (é o ponto de entrada); as demais exigem
// o token de membro (isMemberAuth, não isAuth). Ver docs/MANUAL_TECNICO.md.
memberPortalRoutes.post("/member-portal/login", MemberPortalController.login);

memberPortalRoutes.post(
  "/member-portal/checkin",
  isMemberAuth,
  logbookPhotoUpload.single("logbookPhoto"),
  MemberPortalController.submitHabitualidade
);

export default memberPortalRoutes;
