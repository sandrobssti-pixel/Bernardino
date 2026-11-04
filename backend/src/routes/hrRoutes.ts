import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import resumeUploadConfig from "../config/resumeUpload";
import employeePhotoUploadConfig from "../config/employeePhotoUpload";
import companyPartnerPhotoUploadConfig from "../config/companyPartnerPhotoUpload";

import * as JobPostingController from "../controllers/JobPostingController";
import * as JobApplicationController from "../controllers/JobApplicationController";
import * as HRAccessController from "../controllers/HRAccessController";
import * as HRReportController from "../controllers/HRReportController";
import * as EmployeeController from "../controllers/EmployeeController";
import * as EmployeeDependentController from "../controllers/EmployeeDependentController";
import * as PayrollEntryController from "../controllers/PayrollEntryController";
import * as PayrollPartnerEntryController from "../controllers/PayrollPartnerEntryController";
import * as PayrollExpenseController from "../controllers/PayrollExpenseController";
import * as PayrollTableController from "../controllers/PayrollTableController";
import * as CompanyPartnerController from "../controllers/CompanyPartnerController";

const hrRoutes = Router();
const resumeUpload = multer(resumeUploadConfig);
const employeePhotoUpload = multer(employeePhotoUploadConfig);
const companyPartnerPhotoUpload = multer(companyPartnerPhotoUploadConfig);

// Fase 5 — Módulo de RH/recrutamento (vagas, candidaturas, efetivação). Ver
// docs/MANUAL_TECNICO.md, seção 6.2.

hrRoutes.get("/hr/access", isAuth, HRAccessController.show);
hrRoutes.get("/hr/reports/summary", isAuth, HRReportController.summary);

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

// Admin/RH — Cadastro de Funcionários (Fase 1, ver docs/MANUAL_TECNICO.md).
hrRoutes.get("/employees", isAuth, EmployeeController.index);
hrRoutes.get("/employees/:id", isAuth, EmployeeController.show);
hrRoutes.post("/employees", isAuth, EmployeeController.store);
hrRoutes.put("/employees/:id", isAuth, EmployeeController.update);
hrRoutes.delete("/employees/:id", isAuth, EmployeeController.remove);
hrRoutes.post(
  "/employees/:id/photo-upload",
  isAuth,
  employeePhotoUpload.single("photo"),
  EmployeeController.uploadPhoto
);

// Admin/RH — Dependentes do Funcionário (Fase 2).
hrRoutes.get("/employees/:employeeId/dependents", isAuth, EmployeeDependentController.index);
hrRoutes.post("/employees/:employeeId/dependents", isAuth, EmployeeDependentController.store);
hrRoutes.put("/employees/:employeeId/dependents/:id", isAuth, EmployeeDependentController.update);
hrRoutes.delete("/employees/:employeeId/dependents/:id", isAuth, EmployeeDependentController.remove);

// Admin/RH — Folha Mensal (Fase 2): cálculo de INSS/IRRF/FGTS/VT.
hrRoutes.get("/payroll-entries", isAuth, PayrollEntryController.index);
hrRoutes.post("/payroll-entries/calculate", isAuth, PayrollEntryController.calculate);
hrRoutes.post("/payroll-entries/calculate-all", isAuth, PayrollEntryController.calculateAll);
hrRoutes.delete("/payroll-entries/:id", isAuth, PayrollEntryController.remove);

// Admin/RH + Financeiro — lançamento da Folha Mensal em Contas a Pagar,
// UMA conta consolidada por competência (ver PayrollExpenseService).
hrRoutes.get("/payroll-entries/expense-launch", isAuth, PayrollExpenseController.show);
hrRoutes.post("/payroll-entries/expense-launch", isAuth, PayrollExpenseController.launch);

// Admin/RH — Folha de pró-labore dos Sócios. INSS de contribuinte
// individual (alíquota fixa 11%, não a tabela de CLT) + IRRF pela
// mesma tabela de CLT (ver PayrollCalculationService.calculatePartnerPayroll).
hrRoutes.get("/payroll-partner-entries", isAuth, PayrollPartnerEntryController.index);
hrRoutes.post("/payroll-partner-entries/calculate", isAuth, PayrollPartnerEntryController.calculate);
hrRoutes.post("/payroll-partner-entries/calculate-all", isAuth, PayrollPartnerEntryController.calculateAll);
hrRoutes.delete("/payroll-partner-entries/:id", isAuth, PayrollPartnerEntryController.remove);

// Master — administração das tabelas de INSS/IRRF (Fase 2). Nunca edita
// uma versão existente, só cadastra uma nova (ver PayrollTableService).
hrRoutes.get("/payroll/inss-tables", isAuth, PayrollTableController.indexInss);
hrRoutes.post("/payroll/inss-tables", isAuth, PayrollTableController.storeInss);
hrRoutes.get("/payroll/irrf-tables", isAuth, PayrollTableController.indexIrrf);
hrRoutes.post("/payroll/irrf-tables", isAuth, PayrollTableController.storeIrrf);

// Admin/RH — Cadastro de Sócios. Rota "/company-partners" (não
// "/partners") pra não colidir/confundir com o model `Partner` já
// existente no projeto (parceiro de indicação/comissão, ver
// apiCompanyRoutes.ts — outro conceito totalmente diferente). NÃO é
// Funcionário (sem regime CLT/PJ/Estagiário/Aprendiz) — ver
// docs/MANUAL_TECNICO.md. `prolaboreValue` é só cadastro por enquanto,
// não entra no motor de cálculo de folha.
hrRoutes.get("/company-partners", isAuth, CompanyPartnerController.index);
hrRoutes.get("/company-partners/:id", isAuth, CompanyPartnerController.show);
hrRoutes.post("/company-partners", isAuth, CompanyPartnerController.store);
hrRoutes.put("/company-partners/:id", isAuth, CompanyPartnerController.update);
hrRoutes.delete("/company-partners/:id", isAuth, CompanyPartnerController.remove);
hrRoutes.post(
  "/company-partners/:id/photo-upload",
  isAuth,
  companyPartnerPhotoUpload.single("photo"),
  CompanyPartnerController.uploadPhoto
);

// Público (sem login) — página de vagas da empresa e envio de candidatura.
hrRoutes.get("/public/job-postings/:companyId", JobPostingController.publicIndex);
hrRoutes.get("/public/job-postings/:companyId/:id", JobPostingController.publicShow);
hrRoutes.post(
  "/public/job-postings/:companyId/:id/apply",
  resumeUpload.single("resume"),
  JobApplicationController.publicStore
);

export default hrRoutes;
