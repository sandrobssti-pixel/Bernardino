import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";
import financeProductPhotoUpload from "../config/financeProductPhotoUpload";

import * as FinanceAccessController from "../controllers/FinanceAccessController";
import * as FinanceCustomerController from "../controllers/FinanceCustomerController";
import * as FinanceSupplierController from "../controllers/FinanceSupplierController";
import * as FinanceProductController from "../controllers/FinanceProductController";
import * as FinanceWeaponUnitController from "../controllers/FinanceWeaponUnitController";
import * as FinanceExpenseController from "../controllers/FinanceExpenseController";
import * as FinanceReceivableController from "../controllers/FinanceReceivableController";
import * as FinanceReportController from "../controllers/FinanceReportController";
import * as FinanceImportController from "../controllers/FinanceImportController";
import * as FinancePaymentConfigController from "../controllers/FinancePaymentConfigController";
import * as FinancePaymentAccessController from "../controllers/FinancePaymentAccessController";

const upload = multer(uploadConfig);
const productPhotoUpload = multer(financeProductPhotoUpload);

const financeRoutes = Router();

// Status de acesso ao módulo Financeiro (add-on) — usado pelo frontend pra
// decidir o que mostrar antes de tentar qualquer CRUD abaixo.
financeRoutes.get("/finance/access", isAuth, FinanceAccessController.show);

financeRoutes.get("/finance/customers", isAuth, FinanceCustomerController.index);
// Vínculo Contato <-> Cliente financeiro (antes das rotas /:id genéricas,
// senão "by-contact"/"link-contact" seriam lidos como um :id numérico).
financeRoutes.get(
  "/finance/customers/by-contact/:contactId",
  isAuth,
  FinanceCustomerController.showByContact
);
financeRoutes.post(
  "/finance/customers/link-contact/:contactId",
  isAuth,
  FinanceCustomerController.linkFromContact
);
// Planilha-modelo pra download — mesma observação de ordem de rota acima
// (precisa vir antes de "/:id").
financeRoutes.get(
  "/finance/customers/import-template",
  isAuth,
  FinanceImportController.customerTemplate
);
financeRoutes.get("/finance/customers/:id", isAuth, FinanceCustomerController.show);
financeRoutes.post("/finance/customers", isAuth, FinanceCustomerController.store);
financeRoutes.put("/finance/customers/:id", isAuth, FinanceCustomerController.update);
financeRoutes.delete("/finance/customers/:id", isAuth, FinanceCustomerController.remove);

financeRoutes.get("/finance/suppliers", isAuth, FinanceSupplierController.index);
financeRoutes.get("/finance/suppliers/:id", isAuth, FinanceSupplierController.show);
financeRoutes.post("/finance/suppliers", isAuth, FinanceSupplierController.store);
financeRoutes.put("/finance/suppliers/:id", isAuth, FinanceSupplierController.update);
financeRoutes.delete("/finance/suppliers/:id", isAuth, FinanceSupplierController.remove);

financeRoutes.get("/finance/products", isAuth, FinanceProductController.index);
// Planilha-modelo pra download — precisa vir antes de "/:id" (mesmo motivo
// do vínculo Contato/Cliente, acima).
financeRoutes.get(
  "/finance/products/import-template",
  isAuth,
  FinanceImportController.productTemplate
);
financeRoutes.get("/finance/products/:id", isAuth, FinanceProductController.show);
financeRoutes.post("/finance/products", isAuth, FinanceProductController.store);
financeRoutes.put("/finance/products/:id", isAuth, FinanceProductController.update);
financeRoutes.delete("/finance/products/:id", isAuth, FinanceProductController.remove);
financeRoutes.post(
  "/finance/products/:id/photo",
  isAuth,
  productPhotoUpload.single("photo"),
  FinanceProductController.uploadPhoto
);

// Unidades físicas de arma (número de série), sub-cadastro do Produto —
// v2.3.204. Busca (`/finance/weapon-units/search`) precisa vir antes de
// qualquer rota com :productId, mesmo motivo de "import-template" acima.
financeRoutes.get("/finance/weapon-units/search", isAuth, FinanceWeaponUnitController.search);
financeRoutes.get(
  "/finance/products/:productId/weapon-units",
  isAuth,
  FinanceWeaponUnitController.index
);
financeRoutes.post(
  "/finance/products/:productId/weapon-units",
  isAuth,
  FinanceWeaponUnitController.store
);
financeRoutes.put(
  "/finance/products/:productId/weapon-units/:id",
  isAuth,
  FinanceWeaponUnitController.update
);
financeRoutes.delete(
  "/finance/products/:productId/weapon-units/:id",
  isAuth,
  FinanceWeaponUnitController.remove
);

// Fase 2 — Financeiro operacional (custos, contas a pagar/receber, relatórios)
financeRoutes.get("/finance/expenses", isAuth, FinanceExpenseController.index);
financeRoutes.get("/finance/expenses/:id", isAuth, FinanceExpenseController.show);
financeRoutes.post("/finance/expenses", isAuth, FinanceExpenseController.store);
financeRoutes.put("/finance/expenses/:id", isAuth, FinanceExpenseController.update);
financeRoutes.delete("/finance/expenses/:id", isAuth, FinanceExpenseController.remove);

financeRoutes.get("/finance/receivables", isAuth, FinanceReceivableController.index);
financeRoutes.get("/finance/receivables/:id", isAuth, FinanceReceivableController.show);
financeRoutes.post("/finance/receivables", isAuth, FinanceReceivableController.store);
financeRoutes.put("/finance/receivables/:id", isAuth, FinanceReceivableController.update);
financeRoutes.delete("/finance/receivables/:id", isAuth, FinanceReceivableController.remove);

// Cobrança via gateway (Pix/boleto, Mercado Pago — Fase 1) — ver
// FinanceReceivablePaymentService e docs/MANUAL_TECNICO.md.
financeRoutes.post(
  "/finance/receivables/:id/pix",
  isAuth,
  FinanceReceivableController.generatePix
);
financeRoutes.post(
  "/finance/receivables/:id/boleto",
  isAuth,
  FinanceReceivableController.generateBoleto
);

financeRoutes.get("/finance/payment-access", isAuth, FinancePaymentAccessController.show);
financeRoutes.get("/finance/payment-config", isAuth, FinancePaymentConfigController.show);
financeRoutes.put("/finance/payment-config", isAuth, FinancePaymentConfigController.update);

// Importação via planilha Excel (detecção automática de coluna) — ver
// docs/MANUAL_TECNICO.md, seção 6.2 (Fase 6).
financeRoutes.post(
  "/finance/products/import",
  isAuth,
  upload.array("file"),
  FinanceImportController.importProducts
);
financeRoutes.post(
  "/finance/customers/import",
  isAuth,
  upload.array("file"),
  FinanceImportController.importCustomers
);
financeRoutes.post(
  "/finance/suppliers/import",
  isAuth,
  upload.array("file"),
  FinanceImportController.importSuppliers
);

financeRoutes.get("/finance/reports/summary", isAuth, FinanceReportController.summary);
financeRoutes.get("/finance/reports/cashflow", isAuth, FinanceReportController.cashFlow);
financeRoutes.get("/finance/reports/expenses-by-category", isAuth, FinanceReportController.expensesByCategory);
financeRoutes.get("/finance/reports/stock-health", isAuth, FinanceReportController.stockHealth);
financeRoutes.get("/finance/reports/profit-dashboard", isAuth, FinanceReportController.profitDashboard);

export default financeRoutes;
