import { Router } from "express";
import {
  getPractitioner,
  getPractitioners,
  getStats,
  postPractitioner,
  putPractitioner,
  removePractitioner,
} from "../controllers/practitioner.controller.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

router.get("/", getPractitioners);
router.get("/stats", getStats);
router.get("/:id", getPractitioner);
router.post("/", requireRole("admin"), postPractitioner);
router.put("/:id", requireRole("admin"), putPractitioner);
router.delete("/:id", requireRole("admin"), removePractitioner);

export default router;
