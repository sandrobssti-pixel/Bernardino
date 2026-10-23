import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import servicePhotoUpload from "../config/servicePhotoUpload";
import uploadConfig from "../config/upload";

import * as ServiceController from "../controllers/ServiceController";

const serviceRoutes = Router();
const photoUpload = multer(servicePhotoUpload);
const spreadsheetUpload = multer(uploadConfig);

// Cadastro de Serviço (v2.3.175) — sem controle de acesso por plano de
// propósito (pedido do cliente: "não coloca o módulo serviços como
// módulo separado") — qualquer usuário autenticado da empresa pode
// usar, mesmo padrão de Tags/Filas (sem add-on próprio).
serviceRoutes.get("/services", isAuth, ServiceController.index);
// Planilha-modelo/importação (v2.3.179) — precisam vir ANTES de
// "/services/:id", senão "import-template" cairia na rota de :id.
serviceRoutes.get("/services/import-template", isAuth, ServiceController.importTemplate);
serviceRoutes.post(
  "/services/import",
  isAuth,
  spreadsheetUpload.array("file"),
  ServiceController.importServices
);
serviceRoutes.get("/services/:id", isAuth, ServiceController.show);
serviceRoutes.post("/services", isAuth, ServiceController.store);
serviceRoutes.put("/services/:id", isAuth, ServiceController.update);
serviceRoutes.delete("/services/:id", isAuth, ServiceController.remove);
serviceRoutes.post(
  "/services/:id/photo",
  isAuth,
  photoUpload.single("photo"),
  ServiceController.uploadPhoto
);

export default serviceRoutes;
