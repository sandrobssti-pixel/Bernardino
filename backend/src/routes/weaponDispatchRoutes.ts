import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import weaponDispatchPhotoUpload from "../config/weaponDispatchPhotoUpload";

import * as WeaponDispatchAccessController from "../controllers/WeaponDispatchAccessController";
import * as WeaponDispatchClientController from "../controllers/WeaponDispatchClientController";
import * as WeaponDispatchProcessController from "../controllers/WeaponDispatchProcessController";
import * as WeaponDispatchAppointmentController from "../controllers/WeaponDispatchAppointmentController";

const weaponDispatchRoutes = Router();
const photoUpload = multer(weaponDispatchPhotoUpload);

// Despachante Bélico — gestão de processo CAC/Posse-Porte/Militar. Ver
// docs/MANUAL_TECNICO.md.
weaponDispatchRoutes.get(
  "/weapon-dispatch/access",
  isAuth,
  WeaponDispatchAccessController.show
);
weaponDispatchRoutes.get(
  "/weapon-dispatch/catalog",
  isAuth,
  WeaponDispatchProcessController.catalog
);

weaponDispatchRoutes.get(
  "/weapon-dispatch/clients",
  isAuth,
  WeaponDispatchClientController.index
);
// Precisa vir ANTES de "/weapon-dispatch/clients/:id", senão "lookup" cai
// na rota de :id.
weaponDispatchRoutes.get(
  "/weapon-dispatch/clients/lookup",
  isAuth,
  WeaponDispatchClientController.lookup
);
weaponDispatchRoutes.get(
  "/weapon-dispatch/clients/:id",
  isAuth,
  WeaponDispatchClientController.show
);
weaponDispatchRoutes.post(
  "/weapon-dispatch/clients",
  isAuth,
  WeaponDispatchClientController.store
);
weaponDispatchRoutes.put(
  "/weapon-dispatch/clients/:id",
  isAuth,
  WeaponDispatchClientController.update
);
weaponDispatchRoutes.delete(
  "/weapon-dispatch/clients/:id",
  isAuth,
  WeaponDispatchClientController.remove
);
weaponDispatchRoutes.put(
  "/weapon-dispatch/clients/:id/gov-password",
  isAuth,
  WeaponDispatchClientController.setGovPassword
);
weaponDispatchRoutes.post(
  "/weapon-dispatch/clients/:id/gov-password/reveal",
  isAuth,
  WeaponDispatchClientController.getGovPassword
);
weaponDispatchRoutes.post(
  "/weapon-dispatch/clients/:id/photo",
  isAuth,
  photoUpload.single("photo"),
  WeaponDispatchClientController.uploadPhoto
);

weaponDispatchRoutes.get(
  "/weapon-dispatch/processes",
  isAuth,
  WeaponDispatchProcessController.index
);
weaponDispatchRoutes.get(
  "/weapon-dispatch/processes/:id",
  isAuth,
  WeaponDispatchProcessController.show
);
weaponDispatchRoutes.post(
  "/weapon-dispatch/processes",
  isAuth,
  WeaponDispatchProcessController.store
);
weaponDispatchRoutes.put(
  "/weapon-dispatch/processes/:id",
  isAuth,
  WeaponDispatchProcessController.update
);
weaponDispatchRoutes.delete(
  "/weapon-dispatch/processes/:id",
  isAuth,
  WeaponDispatchProcessController.remove
);
weaponDispatchRoutes.put(
  "/weapon-dispatch/processes/:id/stage",
  isAuth,
  WeaponDispatchProcessController.changeStage
);

weaponDispatchRoutes.get(
  "/weapon-dispatch/processes/:processId/appointments",
  isAuth,
  WeaponDispatchAppointmentController.index
);
weaponDispatchRoutes.post(
  "/weapon-dispatch/appointments",
  isAuth,
  WeaponDispatchAppointmentController.store
);
weaponDispatchRoutes.put(
  "/weapon-dispatch/appointments/:id",
  isAuth,
  WeaponDispatchAppointmentController.update
);
weaponDispatchRoutes.delete(
  "/weapon-dispatch/appointments/:id",
  isAuth,
  WeaponDispatchAppointmentController.remove
);

export default weaponDispatchRoutes;
