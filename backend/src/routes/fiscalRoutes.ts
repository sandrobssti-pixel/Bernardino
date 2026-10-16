import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";

import * as FiscalAccessController from "../controllers/FiscalAccessController";
import * as FiscalConfigController from "../controllers/FiscalConfigController";
import * as SaleController from "../controllers/SaleController";
import * as SaleImportController from "../controllers/SaleImportController";
import * as FiscalDocumentController from "../controllers/FiscalDocumentController";
import * as FiscalNumberingController from "../controllers/FiscalNumberingController";

const upload = multer(uploadConfig);

const fiscalRoutes = Router();

// Fase 3 — Módulo fiscal (NF-e/NFC-e/NFS-e via gateway Focus NFe). Ver
// docs/MANUAL_TECNICO.md, seção 6.2.

// Status de acesso ao módulo fiscal (add-on separado do Financeiro) — usado
// pelo frontend pra decidir se mostra as abas Vendas/Configuração Fiscal.
fiscalRoutes.get("/fiscal/access", isAuth, FiscalAccessController.show);

fiscalRoutes.get("/fiscal/config", isAuth, FiscalConfigController.show);
fiscalRoutes.put("/fiscal/config", isAuth, FiscalConfigController.update);
fiscalRoutes.get("/fiscal/gateways", isAuth, FiscalConfigController.gateways);

// Importação de vendas históricas (migração de ERP, v2.3.116) — registra
// vendas que já têm nota fiscal emitida no sistema anterior; nunca chama o
// gateway, nunca mexe em estoque. Ver SaleImportService.ts.
fiscalRoutes.post("/sales/import", isAuth, upload.array("file"), SaleImportController.importSales);

fiscalRoutes.get("/sales", isAuth, SaleController.index);
fiscalRoutes.get("/sales/:id", isAuth, SaleController.show);
fiscalRoutes.post("/sales", isAuth, SaleController.store);
fiscalRoutes.put("/sales/:id", isAuth, SaleController.update);
fiscalRoutes.post("/sales/:id/confirm", isAuth, SaleController.confirm);
fiscalRoutes.post("/sales/:id/cancel", isAuth, SaleController.cancel);
fiscalRoutes.delete("/sales/:id", isAuth, SaleController.remove);

fiscalRoutes.get("/sales/:saleId/fiscal-documents", isAuth, FiscalDocumentController.index);
fiscalRoutes.post("/sales/:saleId/fiscal-documents", isAuth, FiscalDocumentController.store);
fiscalRoutes.post("/sales/:saleId/fiscal-documents/preview", isAuth, FiscalDocumentController.previewDanfe);
fiscalRoutes.post("/fiscal-documents/:id/refresh-status", isAuth, FiscalDocumentController.refreshStatus);
fiscalRoutes.post("/fiscal-documents/:id/cancel", isAuth, FiscalDocumentController.cancel);
fiscalRoutes.post("/fiscal-documents/:id/correction-letter", isAuth, FiscalDocumentController.correctionLetter);
fiscalRoutes.post("/fiscal-documents/:id/send-email", isAuth, FiscalDocumentController.sendEmail);

fiscalRoutes.get("/fiscal/numbering/invalidations", isAuth, FiscalNumberingController.index);
fiscalRoutes.post("/fiscal/numbering/invalidations", isAuth, FiscalNumberingController.invalidate);

export default fiscalRoutes;
