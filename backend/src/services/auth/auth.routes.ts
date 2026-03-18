import { Router } from "express";
import {
  loginController,
  registerController,
  meController,
  checkStatusController,
  tratamientoDatosController,
  sociodemograficoController,
  consentimientoController,
  validateLogin,
  validateRegister,
  validateSociodem,
  validateTratamiento,
  validateConsentimiento,
} from "./auth.controller.js";
import { authGuard }      from "../../middlewares/auth.middleware.js";
import { loginLimiter, registerLimiter } from "../../middlewares/rateLimit.middleware.js";

const router = Router();

// ── Públicos ──────────────────────────────────────────────────────────────────
router.post("/login",    loginLimiter,    validateLogin,    loginController);
router.post("/register", registerLimiter, validateRegister, registerController);

// ── Autenticados ──────────────────────────────────────────────────────────────
router.get("/me",           authGuard, meController);
router.get("/check-status", authGuard, checkStatusController);

// ── Flujo de registro multi-paso (requieren token del paso 1) ────────────────
router.post("/tratamiento-datos", authGuard, validateTratamiento,   tratamientoDatosController);
router.post("/sociodemografico",  authGuard, validateSociodem,      sociodemograficoController);
router.post("/consentimiento",    authGuard, validateConsentimiento, consentimientoController);

export default router;
