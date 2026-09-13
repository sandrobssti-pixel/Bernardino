import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as PushSubscriptionController from "../controllers/PushSubscriptionController";

const pushSubscriptionRoutes = Router();

pushSubscriptionRoutes.get(
  "/push/public-key",
  isAuth,
  PushSubscriptionController.publicKey
);

pushSubscriptionRoutes.post(
  "/push/subscriptions",
  isAuth,
  PushSubscriptionController.upsert
);

pushSubscriptionRoutes.delete(
  "/push/subscriptions",
  isAuth,
  PushSubscriptionController.remove
);

export default pushSubscriptionRoutes;

