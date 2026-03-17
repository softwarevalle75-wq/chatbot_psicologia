import { Router } from "express";
import { getAppointmentsController } from "./appointment.controller.js";

const router = Router();

router.get("/", getAppointmentsController);

export default router;
