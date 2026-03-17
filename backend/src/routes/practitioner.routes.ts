import { Router } from "express";
import { getPractitioners } from "../controllers/practitioner.controller.js";

const router = Router();

router.get("/", getPractitioners);

export default router;
