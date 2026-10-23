import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import weaponArmoryPhotoUpload from "../config/weaponArmoryPhotoUpload";

import * as WeaponArmoryAccessController from "../controllers/WeaponArmoryAccessController";
import * as WeaponArmoryServiceController from "../controllers/WeaponArmoryServiceController";

const weaponArmoryRoutes = Router();
const photosUpload = multer(weaponArmoryPhotoUpload);

// Serviço Armaria — recebimento de arma pra manutenção/conserto (Termo de
// Cautela). Ver docs/MANUAL_TECNICO.md.
weaponArmoryRoutes.get(
  "/weapon-armory/access",
  isAuth,
  WeaponArmoryAccessController.show
);

weaponArmoryRoutes.get(
  "/weapon-armory/services",
  isAuth,
  WeaponArmoryServiceController.index
);
// Precisa vir ANTES de "/weapon-armory/services/:id", senão "lookup" cai
// na rota de :id.
weaponArmoryRoutes.get(
  "/weapon-armory/services/lookup",
  isAuth,
  WeaponArmoryServiceController.lookup
);
weaponArmoryRoutes.get(
  "/weapon-armory/services/:id",
  isAuth,
  WeaponArmoryServiceController.show
);
weaponArmoryRoutes.post(
  "/weapon-armory/services",
  isAuth,
  WeaponArmoryServiceController.store
);
weaponArmoryRoutes.put(
  "/weapon-armory/services/:id",
  isAuth,
  WeaponArmoryServiceController.update
);
weaponArmoryRoutes.delete(
  "/weapon-armory/services/:id",
  isAuth,
  WeaponArmoryServiceController.remove
);
weaponArmoryRoutes.post(
  "/weapon-armory/services/:id/photos",
  isAuth,
  photosUpload.array("photos", 10),
  WeaponArmoryServiceController.uploadPhotos
);
weaponArmoryRoutes.delete(
  "/weapon-armory/services/:id/photos",
  isAuth,
  WeaponArmoryServiceController.removePhoto
);

export default weaponArmoryRoutes;
