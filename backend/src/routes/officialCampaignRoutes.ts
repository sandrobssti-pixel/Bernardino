import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";
import * as OfficialCampaignController from "../controllers/OfficialCampaignController";

const upload = multer(uploadConfig);

const routes = express.Router();

routes.get("/official-campaigns", isAuth, OfficialCampaignController.index);
routes.get("/official-campaigns/:id", isAuth, OfficialCampaignController.show);
routes.post(
  "/official-campaigns/header-media",
  isAuth,
  upload.single("headerMedia"),
  OfficialCampaignController.uploadHeaderMedia
);
routes.post("/official-campaigns", isAuth, OfficialCampaignController.store);
routes.put("/official-campaigns/:id", isAuth, OfficialCampaignController.update);
routes.delete("/official-campaigns/:id", isAuth, OfficialCampaignController.remove);
routes.post("/official-campaigns/:id/cancel", isAuth, OfficialCampaignController.cancel);
routes.post("/official-campaigns/:id/restart", isAuth, OfficialCampaignController.restart);

export default routes;
