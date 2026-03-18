import type { NextFunction, Request, Response } from "express";
import {
  login,
  register,
  saveTratamientoDatos,
  saveSociodemografico,
  saveConsentimiento,
  checkStatus,
  getSessionUser,
} from "./auth.service.js";
import {
  loginSchema,
  registerSchema,
  sociodemograficoSchema,
  tratamientoDatosSchema,
  consentimientoSchema,
} from "./auth.schema.js";
import { validate } from "../../middlewares/validate.middleware.js";

// ── Middlewares de validación ─────────────────────────────────────────────────

export const validateLogin         = validate(loginSchema);
export const validateRegister      = validate(registerSchema);
export const validateSociodem      = validate(sociodemograficoSchema);
export const validateTratamiento   = validate(tratamientoDatosSchema);
export const validateConsentimiento = validate(consentimientoSchema);

// ── Helper ───────────────────────────────────────────────────────────────────

function getUserId(req: Request): string | null {
  const u = req.user;
  if (typeof u === "object" && u !== null && "sub" in u) {
    return String((u as Record<string, unknown>).sub);
  }
  return null;
}

// ── Controllers ───────────────────────────────────────────────────────────────

export async function loginController(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as { email: string; password: string };
    res.json(await login(email, password));
  } catch (error) { next(error); }
}

export async function registerController(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await register(req.body));
  } catch (error) { next(error); }
}

export async function meController(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getSessionUser(getUserId(req));
    if (!user) return res.status(401).json({ message: "Sesión inválida" });
    return res.json({ user });
  } catch (error) { return next(error); }
}

export async function checkStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "No autenticado" });
    return res.json(await checkStatus(userId));
  } catch (error) { return next(error); }
}

export async function tratamientoDatosController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "No autenticado" });
    const { autorizacionDatos } = req.body as { autorizacionDatos: "si" | "no" };
    return res.json(await saveTratamientoDatos(userId, autorizacionDatos === "si"));
  } catch (error) { return next(error); }
}

export async function sociodemograficoController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "No autenticado" });
    return res.json(await saveSociodemografico(userId, req.body));
  } catch (error) { return next(error); }
}

export async function consentimientoController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "No autenticado" });
    const { consentimientoInformado } = req.body as { consentimientoInformado: "si" | "no" };
    return res.json(await saveConsentimiento(userId, consentimientoInformado === "si"));
  } catch (error) { return next(error); }
}
