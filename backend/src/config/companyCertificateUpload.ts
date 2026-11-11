import multer from "multer";

// Upload do certificado digital (.pfx/.p12) da entidade — diferente de
// todo outro upload deste projeto (foto/documento/PDF): o arquivo NUNCA
// toca o disco em texto puro. Guardado em memória só até
// CompanyCertificateService.upload criptografar e salvar no banco (ver
// docs/MANUAL_TECNICO.md) — por isso `storage: multer.memoryStorage()`,
// não `diskStorage` como os outros uploads deste projeto.
export default {
  storage: multer.memoryStorage(),
  fileFilter: (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = ["application/x-pkcs12", "application/octet-stream"];
    const hasValidExtension = /\.(pfx|p12)$/i.test(file.originalname);
    if (allowed.includes(file.mimetype) || hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error("ERR_COMPANY_CERTIFICATE_INVALID_FILE"));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB — um .pfx é tipicamente poucos KB
  }
};
