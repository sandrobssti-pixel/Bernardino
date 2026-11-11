import path from "path";
import multer from "multer";
import fs from "fs";

const publicFolder = path.resolve(__dirname, "..", "..", "public");

// Upload de documento do checklist do associado (CPF, RG, CNH, CR,
// CRAF, certidões...) — diferente de memberPhotoUpload.ts (só imagem):
// aqui também aceita PDF, já que certidão/protocolo normalmente é PDF.
export default {
  directory: publicFolder,
  storage: multer.diskStorage({
    destination: (req: any, _file, cb) => {
      const { companyId } = req.user;
      const folder = path.resolve(publicFolder, `company${companyId}`, "member-documents");

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
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("ERR_MEMBER_INVALID_DOCUMENT_TYPE"));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
};
