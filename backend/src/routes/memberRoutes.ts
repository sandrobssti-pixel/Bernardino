import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import memberPhotoUpload from "../config/memberPhotoUpload";
import memberDocumentUpload from "../config/memberDocumentUpload";

import * as MemberAccessController from "../controllers/MemberAccessController";
import * as MemberController from "../controllers/MemberController";
import * as MemberFaceController from "../controllers/MemberFaceController";
import * as MemberWeaponController from "../controllers/MemberWeaponController";
import * as MemberAddressController from "../controllers/MemberAddressController";
import * as MemberDocumentController from "../controllers/MemberDocumentController";
import * as MemberMembershipController from "../controllers/MemberMembershipController";

const memberRoutes = Router();
const photoUpload = multer(memberPhotoUpload);
const documentUpload = multer(memberDocumentUpload);

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
// Fila de revisão do Admin (entrada de habitualidade — foto do livro +
// geolocalização, enviada pelo Portal do Associado) — precisa vir antes
// de "/members/:id" pelo mesmo motivo de sempre.
memberRoutes.get(
  "/members/checkins/pending",
  isAuth,
  MemberFaceController.listPendingHabitualidade
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

// Decreto nº 11.615/2023, art. 38, §5º, III (redação dada pelo Decreto
// nº 12.345/2024). Descritor é calculado no navegador; o backend só
// guarda/compara números.
memberRoutes.post("/members/checkin", isAuth, MemberFaceController.checkIn);
memberRoutes.post(
  "/members/:id/face-descriptor",
  isAuth,
  MemberFaceController.setFaceDescriptor
);
memberRoutes.put(
  "/members/checkins/:id/validate",
  isAuth,
  MemberFaceController.validateCheckIn
);

// PIN de acesso ao Portal do Associado — gerado pelo Admin, dentro da
// administração do clube.
memberRoutes.post(
  "/members/:id/portal-pin",
  isAuth,
  MemberFaceController.generatePortalPin
);

// Arma PESSOAL do associado — diferente da armaria/estoque do clube
// (módulo Financeiro/WeaponArmory). "/members/weapons/:id" não colide
// com "/members/:id" nem com "/members/checkins*" — são literais de
// segmento diferentes, profundidade de rota diferente.
memberRoutes.get(
  "/members/:memberId/weapons",
  isAuth,
  MemberWeaponController.index
);
memberRoutes.post(
  "/members/:memberId/weapons",
  isAuth,
  MemberWeaponController.store
);
memberRoutes.put(
  "/members/weapons/:id",
  isAuth,
  MemberWeaponController.update
);
memberRoutes.delete(
  "/members/weapons/:id",
  isAuth,
  MemberWeaponController.remove
);

// Endereço ADICIONAL do associado (endereço principal continua nos
// campos de PUT /members/:id) — mesmo cuidado de ordem de rota do
// bloco de armas acima.
memberRoutes.get(
  "/members/:memberId/addresses",
  isAuth,
  MemberAddressController.index
);
memberRoutes.post(
  "/members/:memberId/addresses",
  isAuth,
  MemberAddressController.store
);
memberRoutes.put(
  "/members/addresses/:id",
  isAuth,
  MemberAddressController.update
);
memberRoutes.delete(
  "/members/addresses/:id",
  isAuth,
  MemberAddressController.remove
);

// Checklist de documentos do associado (CPF, RG, CNH, CR, CRAF por
// arma, certidões, documentos avulsos) — mesmo cuidado de ordem de
// rota dos blocos acima.
memberRoutes.get(
  "/members/:memberId/documents",
  isAuth,
  MemberDocumentController.index
);
memberRoutes.post(
  "/members/:memberId/documents",
  isAuth,
  documentUpload.single("file"),
  MemberDocumentController.store
);
memberRoutes.delete(
  "/members/documents/:id",
  isAuth,
  MemberDocumentController.remove
);

// Cobrança de filiação/anuidade — reaproveita o módulo Financeiro que já
// existe (Venda/Conta a Receber), confirmado com o cliente.
memberRoutes.get(
  "/members/:memberId/membership-charges",
  isAuth,
  MemberMembershipController.index
);
memberRoutes.post(
  "/members/:memberId/membership-charges",
  isAuth,
  MemberMembershipController.store
);

export default memberRoutes;
