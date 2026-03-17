import { Router } from "express";
import { getPatients, getPatient } from "../controllers/patient.controller.js";

const router = Router();

router.get("/", getPatients);
router.get("/:patientId", getPatient);

export default router;
