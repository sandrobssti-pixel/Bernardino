import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as MetaConnectionController from "../controllers/MetaConnectionController";

const metaConnectionRoutes = Router();

metaConnectionRoutes.get("/meta-connections", isAuth, MetaConnectionController.index);
metaConnectionRoutes.post("/meta-connections", isAuth, MetaConnectionController.store);
metaConnectionRoutes.get("/meta-connections/:metaConnectionId", isAuth, MetaConnectionController.show);
metaConnectionRoutes.put("/meta-connections/:metaConnectionId", isAuth, MetaConnectionController.update);
metaConnectionRoutes.delete("/meta-connections/:metaConnectionId", isAuth, MetaConnectionController.remove);

export default metaConnectionRoutes;
