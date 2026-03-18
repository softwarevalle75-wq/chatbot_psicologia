import { Router } from "express";
import { getPatientsController, getPatientController } from "./patient.controller.js";

const router = Router();

router.get("/", getPatientsController);
router.get("/:patientId", getPatientController);

export default router;
