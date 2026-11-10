import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import memberPhotoUpload from "../config/memberPhotoUpload";

import * as MemberAccessController from "../controllers/MemberAccessController";
import * as MemberController from "../controllers/MemberController";
import * as MemberFaceController from "../controllers/MemberFaceController";

const memberRoutes = Router();
const photoUpload = multer(memberPhotoUpload);

// Associados — cadastro de membros/filiados, módulo add-on genérico
// (Plan.useMembers). Ver docs/MANUAL_TECNICO.md.
memberRoutes.get("/members/access", isAuth, MemberAccessController.show);

memberRoutes.get("/members", isAuth, MemberController.index);
// Vínculo Contato <-> Associado (aba CAC do ContactModal) — precisa vir
// ANTES de "/members/:id", senão "by-contact"/"link-contact" seriam lidos
// como o :id da rota genérica.
memberRoutes.get(
  "/members/by-contact/:contactId",
  isAuth,
  MemberController.showByContact
);
memberRoutes.post(
  "/members/link-contact/:contactId",
  isAuth,
  MemberController.linkFromContact
);
// Controle de Acesso (reconhecimento facial) — "/members/checkins" (GET,
// sem :id) precisa vir ANTES de "/members/:id" (GET), senão "checkins"
// seria lido como o :id da rota genérica (mesmo motivo de
// by-contact/link-contact acima).
memberRoutes.get("/members/checkins", isAuth, MemberFaceController.listCheckIns);
memberRoutes.get("/members/:id", isAuth, MemberController.show);
memberRoutes.post("/members", isAuth, MemberController.store);
memberRoutes.put("/members/:id", isAuth, MemberController.update);
memberRoutes.delete("/members/:id", isAuth, MemberController.remove);
memberRoutes.post(
  "/members/:id/photo",
  isAuth,
  photoUpload.single("photo"),
  MemberController.uploadPhoto
);

// Decreto nº 11.615/2023, art. 38, §5º, III (redação dada pelo Decreto
// nº 12.345/2024). Descritor é calculado no navegador; o backend só
// guarda/compara números.
memberRoutes.post("/members/checkin", isAuth, MemberFaceController.checkIn);
memberRoutes.post(
  "/members/:id/face-descriptor",
  isAuth,
  MemberFaceController.setFaceDescriptor
);

export default memberRoutes;
