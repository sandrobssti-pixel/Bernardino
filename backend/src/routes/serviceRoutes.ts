import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import servicePhotoUpload from "../config/servicePhotoUpload";

import * as ServiceController from "../controllers/ServiceController";

const serviceRoutes = Router();
const photoUpload = multer(servicePhotoUpload);

// Cadastro de Serviço (v2.3.175) — sem controle de acesso por plano de
// propósito (pedido do cliente: "não coloca o módulo serviços como
// módulo separado") — qualquer usuário autenticado da empresa pode
// usar, mesmo padrão de Tags/Filas (sem add-on próprio).
serviceRoutes.get("/services", isAuth, ServiceController.index);
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
