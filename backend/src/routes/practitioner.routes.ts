import { Router } from "express";
import { getPractitioners, postPractitioner } from "../controllers/practitioner.controller.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

router.get("/", getPractitioners);
router.post("/", requireRole("admin"), postPractitioner);

export default router;
