import express, { Request } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";
import * as PromptFilesController from "../controllers/PromptFilesController";

const ALLOWED_MIMETYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain"
];

const upload = multer({
  storage: uploadConfig.storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void
  ) => {
    if (
      file.mimetype.startsWith("image/") ||
      ALLOWED_MIMETYPES.includes(file.mimetype)
    ) {
      cb(null, true);
    } else {
      cb(new Error("ERR_UNSUPPORTED_FILE_TYPE"), false);
    }
  }
});

const promptFilesRoutes = express.Router();

promptFilesRoutes.get(
  "/prompt-files",
  isAuth,
  PromptFilesController.index
);

promptFilesRoutes.post(
  "/prompt-files",
  isAuth,
  upload.single("file"),
  PromptFilesController.store
);

promptFilesRoutes.delete(
  "/prompt-files/:promptFileId",
  isAuth,
  PromptFilesController.remove
);

export default promptFilesRoutes;
