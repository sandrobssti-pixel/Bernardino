import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as BirthdayController from "../controllers/BirthdayController";

const routes = Router();

routes.get("/birthdays/today", isAuth, BirthdayController.getTodayBirthdays);
routes.get("/birthdays/settings", isAuth, BirthdayController.getBirthdaySettings);
routes.put("/birthdays/settings", isAuth, BirthdayController.updateBirthdaySettings);
routes.post("/birthdays/send-message", isAuth, BirthdayController.sendBirthdayMessage);

export default routes;
