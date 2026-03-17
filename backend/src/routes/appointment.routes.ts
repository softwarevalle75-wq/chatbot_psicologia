import { Router } from "express";
import { getAppointments } from "../controllers/appointment.controller.js";

const router = Router();

router.get("/", getAppointments);

export default router;
