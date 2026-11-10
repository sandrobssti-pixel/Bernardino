import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import memberPhotoUpload from "../config/memberPhotoUpload";

import * as MemberAccessController from "../controllers/MemberAccessController";
import * as MemberController from "../controllers/MemberController";

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

export default memberRoutes;
