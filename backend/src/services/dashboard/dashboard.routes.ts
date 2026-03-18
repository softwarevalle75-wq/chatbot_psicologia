import { Router } from "express";
import { getDashboardSummaryController } from "./dashboard.controller.js";

const router = Router();

router.get("/summary", getDashboardSummaryController);

export default router;
