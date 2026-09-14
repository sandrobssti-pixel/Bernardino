import path from "path";
import multer from "multer";
import fs from "fs";

const publicFolder = path.resolve(__dirname, "..", "..", "public");

// Upload de currículo (Fase 5 — módulo de RH) — usado na rota PÚBLICA de
// candidatura (sem login), então não pode depender de `req.user.companyId`
// como o `config/upload.ts` genérico faz; usa `req.params.companyId` (vem
// da própria URL pública, ex.: /public/job-postings/:companyId/:id/apply).
// Arquivos ficam em public/company{id}/resumes/ — servidos estaticamente
// pela mesma rota /public já existente (ver app.ts).
export default {
  directory: publicFolder,
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const { companyId } = req.params;
      const folder = path.resolve(publicFolder, `company${companyId}`, "resumes");

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
  // Só aceita PDF/Word — currículo, não qualquer arquivo.
  fileFilter: (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("ERR_JOB_APPLICATION_INVALID_FILE_TYPE"));
    }
  },
  limits: {
    fileSize: 8 * 1024 * 1024 // 8MB
  }
};
