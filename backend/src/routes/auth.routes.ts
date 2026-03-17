import { Router } from "express";
import { loginController, meController } from "../controllers/auth.controller.js";
import { authGuard } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/login", loginController);
router.get("/me", authGuard, meController);

export default router;
