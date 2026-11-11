import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import companyCertificateUpload from "../config/companyCertificateUpload";

import * as CompanyCertificateController from "../controllers/CompanyCertificateController";

const companyCertificateRoutes = Router();
const certificateUpload = multer(companyCertificateUpload);

// Certificado digital A1 (.pfx/.p12) da entidade — usado pra assinar a
// Declaração de Filiação e outros documentos oficiais. Admin-only (ver
// CompanyCertificateController.ensureAccess). Ver docs/MANUAL_TECNICO.md.
companyCertificateRoutes.get(
  "/company/certificate",
  isAuth,
  CompanyCertificateController.show
);
companyCertificateRoutes.post(
  "/company/certificate",
  isAuth,
  certificateUpload.single("certificate"),
  CompanyCertificateController.store
);
companyCertificateRoutes.delete(
  "/company/certificate",
  isAuth,
  CompanyCertificateController.remove
);

export default companyCertificateRoutes;
