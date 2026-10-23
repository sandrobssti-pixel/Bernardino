import path from "path";
import multer from "multer";
import fs from "fs";

const publicFolder = path.resolve(__dirname, "..", "..", "public");

// Upload da logomarca da empresa-cliente (v2.3.178) — usada no cabeçalho de
// relatórios impressos (ex.: Termo de Cautela do Serviço Armaria). Pasta
// por empresa (`:id` da rota, já validado pelo controller como a própria
// empresa do usuário ou Master) — mesmo padrão de
// weaponDispatchPhotoUpload.ts/servicePhotoUpload.ts.
export default {
  directory: publicFolder,
  storage: multer.diskStorage({
    destination: (req: any, _file, cb) => {
      const { id } = req.params;
      const folder = path.resolve(publicFolder, `company${id}`, "logo");

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
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("ERR_COMPANY_INVALID_LOGO_TYPE"));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
};
