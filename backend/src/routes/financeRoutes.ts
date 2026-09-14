import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as FinanceAccessController from "../controllers/FinanceAccessController";
import * as FinanceCustomerController from "../controllers/FinanceCustomerController";
import * as FinanceSupplierController from "../controllers/FinanceSupplierController";
import * as FinanceProductController from "../controllers/FinanceProductController";

const financeRoutes = Router();

// Status de acesso ao módulo Financeiro (add-on) — usado pelo frontend pra
// decidir o que mostrar antes de tentar qualquer CRUD abaixo.
financeRoutes.get("/finance/access", isAuth, FinanceAccessController.show);

financeRoutes.get("/finance/customers", isAuth, FinanceCustomerController.index);
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
financeRoutes.get("/finance/products/:id", isAuth, FinanceProductController.show);
financeRoutes.post("/finance/products", isAuth, FinanceProductController.store);
financeRoutes.put("/finance/products/:id", isAuth, FinanceProductController.update);
financeRoutes.delete("/finance/products/:id", isAuth, FinanceProductController.remove);

export default financeRoutes;
