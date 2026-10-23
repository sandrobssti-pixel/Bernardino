import express from "express";
import isAuth from "../middleware/isAuth";
import * as PromptBlockedNumberController from "../controllers/PromptBlockedNumberController";

const promptBlockedNumberRoutes = express.Router();

promptBlockedNumberRoutes.get(
  "/prompt-blocked-numbers",
  isAuth,
  PromptBlockedNumberController.index
);

promptBlockedNumberRoutes.post(
  "/prompt-blocked-numbers",
  isAuth,
  PromptBlockedNumberController.store
);

promptBlockedNumberRoutes.delete(
  "/prompt-blocked-numbers/:blockedNumberId",
  isAuth,
  PromptBlockedNumberController.remove
);

export default promptBlockedNumberRoutes;
