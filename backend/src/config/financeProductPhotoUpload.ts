import path from "path";
import multer from "multer";
import fs from "fs";

const publicFolder = path.resolve(__dirname, "..", "..", "public");

// Upload da foto do Produto (v2.3.167) — mesmo padrão de
// weaponDispatchPhotoUpload.ts (rota autenticada, usa req.user.companyId).
// Arquivo fica em public/company{id}/finance-product-photos/, servido
// estaticamente igual ao resto.
export default {
  directory: publicFolder,
  storage: multer.diskStorage({
    destination: (req: any, _file, cb) => {
      const { companyId } = req.user;
      const folder = path.resolve(publicFolder, `company${companyId}`, "finance-product-photos");

      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        fs.chmodSync(folder, 0o777);
      }
      return cb(null, folder);
    },
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/\//g, "-").replace(/\s+/g, "_");
      const fileName = `${Date.now()}_${safeName}`;
      return cb(null, fileName);
    }
  }),
  fileFilter: (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("ERR_FINANCE_PRODUCT_INVALID_PHOTO_TYPE"));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
};
