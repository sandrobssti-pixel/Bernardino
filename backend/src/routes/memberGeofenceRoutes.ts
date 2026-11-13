import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as MemberGeofenceController from "../controllers/MemberGeofenceController";

const memberGeofenceRoutes = Router();

// Coordenada + raio do clube — usado pra aprovar automaticamente a
// entrada de habitualidade (Gerenciador CAC, Fase 4). Admin-only (ver
// MemberGeofenceController.ensureAccess). Ver docs/MANUAL_TECNICO.md.
memberGeofenceRoutes.get("/company/geofence", isAuth, MemberGeofenceController.show);
memberGeofenceRoutes.put("/company/geofence", isAuth, MemberGeofenceController.update);
memberGeofenceRoutes.delete("/company/geofence", isAuth, MemberGeofenceController.remove);

export default memberGeofenceRoutes;
