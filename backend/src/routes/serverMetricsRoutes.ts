import express from "express";

import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";
import * as ServerMetricsController from "../controllers/ServerMetricsController";

const serverMetricsRoutes = express.Router();

serverMetricsRoutes.get("/server-metrics", isAuth, isSuper, ServerMetricsController.index);

export default serverMetricsRoutes;
