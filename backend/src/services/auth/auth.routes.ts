import { Router } from "express";
import { loginController, meController, validateLogin } from "./auth.controller.js";
import { authGuard } from "../../middlewares/auth.middleware.js";
import { loginLimiter } from "../../middlewares/rateLimit.middleware.js";

const router = Router();

router.post("/login", loginLimiter, validateLogin, loginController);
router.get("/me", authGuard, meController);

export default router;
