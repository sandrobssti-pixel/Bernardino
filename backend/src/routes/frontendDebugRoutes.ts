import { Router } from "express";
import * as FrontendDebugController from "../controllers/FrontendDebugController";

const frontendDebugRoutes = Router();

frontendDebugRoutes.post("/debug/frontend-log", FrontendDebugController.ingest);

export default frontendDebugRoutes;

