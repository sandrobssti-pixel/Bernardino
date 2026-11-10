import path from "path";
import multer from "multer";
import fs from "fs";

const publicFolder = path.resolve(__dirname, "..", "..", "public");

// Upload da foto do livro físico de registro (com a assinatura do
// associado) — Portal do Associado, enviado pelo próprio associado
// autenticado (`req.member`, não `req.user` — rota passa por
// `isMemberAuth`, não `isAuth`). Mesmo padrão de memberPhotoUpload.ts,
// só a origem do companyId que muda. Ver docs/MANUAL_TECNICO.md.
export default {
  directory: publicFolder,
  storage: multer.diskStorage({
    destination: (req: any, _file, cb) => {
      const { companyId } = req.member;
      const folder = path.resolve(publicFolder, `company${companyId}`, "member-logbook-photos");

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
      cb(new Error("ERR_MEMBER_INVALID_PHOTO_TYPE"));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
};
