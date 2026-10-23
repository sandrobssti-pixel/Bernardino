import path from "path";
import multer from "multer";
import fs from "fs";

const publicFolder = path.resolve(__dirname, "..", "..", "public");

// Upload das fotos antes/depois do Serviço Armaria (v2.3.178) — mesmo
// padrão de servicePhotoUpload.ts/weaponDispatchPhotoUpload.ts, mas usado
// com `.array(...)` no lugar de `.single(...)` (ver weaponArmoryRoutes.ts)
// porque aqui são VÁRIAS fotos por vez, não uma só.
export default {
  directory: publicFolder,
  storage: multer.diskStorage({
    destination: (req: any, _file, cb) => {
      const { companyId } = req.user;
      const folder = path.resolve(publicFolder, `company${companyId}`, "weapon-armory-photos");

      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        fs.chmodSync(folder, 0o777);
      }
      return cb(null, folder);
    },
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/\//g, "-").replace(/\s+/g, "_");
      const fileName = `${Date.now()}_${Math.round(Math.random() * 1e6)}_${safeName}`;
      return cb(null, fileName);
    }
  }),
  fileFilter: (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("ERR_WEAPON_ARMORY_INVALID_PHOTO_TYPE"));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB por arquivo
    files: 10 // até 10 fotos por envio
  }
};
