import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as FiscalConfigController from "../controllers/FiscalConfigController";
import * as SaleController from "../controllers/SaleController";
import * as FiscalDocumentController from "../controllers/FiscalDocumentController";

const fiscalRoutes = Router();

// Fase 3 — Módulo fiscal (NF-e/NFC-e/NFS-e via gateway Focus NFe). Ver
// docs/MANUAL_TECNICO.md, seção 6.2.

fiscalRoutes.get("/fiscal/config", isAuth, FiscalConfigController.show);
fiscalRoutes.put("/fiscal/config", isAuth, FiscalConfigController.update);

fiscalRoutes.get("/sales", isAuth, SaleController.index);
fiscalRoutes.get("/sales/:id", isAuth, SaleController.show);
fiscalRoutes.post("/sales", isAuth, SaleController.store);
fiscalRoutes.put("/sales/:id", isAuth, SaleController.update);
fiscalRoutes.post("/sales/:id/confirm", isAuth, SaleController.confirm);
fiscalRoutes.post("/sales/:id/cancel", isAuth, SaleController.cancel);
fiscalRoutes.delete("/sales/:id", isAuth, SaleController.remove);

fiscalRoutes.get("/sales/:saleId/fiscal-documents", isAuth, FiscalDocumentController.index);
fiscalRoutes.post("/sales/:saleId/fiscal-documents", isAuth, FiscalDocumentController.store);
fiscalRoutes.post("/fiscal-documents/:id/refresh-status", isAuth, FiscalDocumentController.refreshStatus);
fiscalRoutes.post("/fiscal-documents/:id/cancel", isAuth, FiscalDocumentController.cancel);

export default fiscalRoutes;
