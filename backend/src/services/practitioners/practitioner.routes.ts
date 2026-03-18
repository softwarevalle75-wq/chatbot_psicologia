import { Router } from "express";
import { requireRole } from "../../middlewares/requireRole.middleware.js";
import {
  getPractitionersController,
  getPractitionerController,
  createPractitionerController,
  updatePractitionerController,
  deactivatePractitionerController,
  validateCreate,
  validateUpdate,
} from "./practitioner.controller.js";

const router = Router();

// Listado y detalle — admin y practicantes (un practicante puede ver la lista)
router.get("/", getPractitionersController);
router.get("/:id", getPractitionerController);

// CRUD de escritura — exclusivo del admin
router.post("/", requireRole("admin"), validateCreate, createPractitionerController);
router.put("/:id", requireRole("admin"), validateUpdate, updatePractitionerController);
router.delete("/:id", requireRole("admin"), deactivatePractitionerController);

export default router;
