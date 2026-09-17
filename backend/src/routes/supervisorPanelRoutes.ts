import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as SupervisorPanelController from "../controllers/SupervisorPanelController";
import * as SlaRuleController from "../controllers/SlaRuleController";
import * as NotificationController from "../controllers/NotificationController";

const supervisorPanelRoutes = Router();

// Status de acesso ao Painel Vigia (add-on) — usado pelo frontend pra
// decidir o que mostrar antes de tentar carregar o painel.
supervisorPanelRoutes.get(
  "/supervisor-panel/access",
  isAuth,
  SupervisorPanelController.access
);
supervisorPanelRoutes.get(
  "/supervisor-panel/live",
  isAuth,
  SupervisorPanelController.live
);
supervisorPanelRoutes.get(
  "/supervisor-panel/summary",
  isAuth,
  SupervisorPanelController.summary
);
supervisorPanelRoutes.post(
  "/supervisor-panel/message",
  isAuth,
  SupervisorPanelController.sendMessage
);

supervisorPanelRoutes.get("/sla-rules", isAuth, SlaRuleController.index);
supervisorPanelRoutes.post("/sla-rules", isAuth, SlaRuleController.store);
supervisorPanelRoutes.put("/sla-rules/:id", isAuth, SlaRuleController.update);
supervisorPanelRoutes.delete("/sla-rules/:id", isAuth, SlaRuleController.remove);

supervisorPanelRoutes.get("/notifications", isAuth, NotificationController.index);
supervisorPanelRoutes.delete("/notifications/all", isAuth, NotificationController.removeAll);
supervisorPanelRoutes.delete("/notifications/:id", isAuth, NotificationController.remove);

export default supervisorPanelRoutes;
