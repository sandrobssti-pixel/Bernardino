// backend/src/routes/groupRoutes.ts

import express from "express";
import isAuth from "../middleware/isAuth";

import * as GroupController from "../controllers/GroupController";

const groupRoutes = express.Router();

groupRoutes.get(
  "/contacts/:contactId/group",
  isAuth,
  GroupController.show
);

groupRoutes.get(
  "/contacts/:contactId/group/photo",
  isAuth,
  GroupController.photo
);

groupRoutes.put(
  "/contacts/:contactId/group",
  isAuth,
  GroupController.updateInfo
);

groupRoutes.post(
  "/contacts/:contactId/group/participants",
  isAuth,
  GroupController.updateParticipants
);

groupRoutes.get(
  "/contacts/:contactId/group/invite-link",
  isAuth,
  GroupController.getInviteLink
);

groupRoutes.post(
  "/contacts/:contactId/group/invite-link/revoke",
  isAuth,
  GroupController.revokeInviteLink
);

export default groupRoutes;
