import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import resumeUploadConfig from "../config/resumeUpload";

import * as JobPostingController from "../controllers/JobPostingController";
import * as JobApplicationController from "../controllers/JobApplicationController";
import * as HRAccessController from "../controllers/HRAccessController";

const hrRoutes = Router();
const resumeUpload = multer(resumeUploadConfig);

// Fase 5 — Módulo de RH/recrutamento (vagas, candidaturas, efetivação). Ver
// docs/MANUAL_TECNICO.md, seção 6.2.

hrRoutes.get("/hr/access", isAuth, HRAccessController.show);

// Admin (autenticado, escopado por empresa) — gestão de vagas.
hrRoutes.get("/job-postings", isAuth, JobPostingController.index);
hrRoutes.get("/job-postings/:id", isAuth, JobPostingController.show);
hrRoutes.post("/job-postings", isAuth, JobPostingController.store);
hrRoutes.put("/job-postings/:id", isAuth, JobPostingController.update);
hrRoutes.delete("/job-postings/:id", isAuth, JobPostingController.remove);

// Admin — triagem de candidaturas e efetivação.
hrRoutes.get("/job-applications", isAuth, JobApplicationController.index);
hrRoutes.get("/job-applications/:id", isAuth, JobApplicationController.show);
hrRoutes.put("/job-applications/:id", isAuth, JobApplicationController.update);
hrRoutes.delete("/job-applications/:id", isAuth, JobApplicationController.remove);
hrRoutes.post("/job-applications/:id/hire", isAuth, JobApplicationController.hire);

// Público (sem login) — página de vagas da empresa e envio de candidatura.
hrRoutes.get("/public/job-postings/:companyId", JobPostingController.publicIndex);
hrRoutes.get("/public/job-postings/:companyId/:id", JobPostingController.publicShow);
hrRoutes.post(
  "/public/job-postings/:companyId/:id/apply",
  resumeUpload.single("resume"),
  JobApplicationController.publicStore
);

export default hrRoutes;
