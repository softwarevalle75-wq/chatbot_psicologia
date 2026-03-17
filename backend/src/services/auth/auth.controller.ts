import type { NextFunction, Request, Response } from "express";
import { login, getSessionUser } from "./auth.service.js";
import { loginSchema } from "./auth.schema.js";
import { validate } from "../../middlewares/validate.middleware.js";

export const validateLogin = validate(loginSchema);

export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const session = await login(email, password);
    res.json(session);
  } catch (error) {
    next(error);
  }
}

export async function meController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const subject =
      typeof req.user === "object" &&
      req.user !== null &&
      "sub" in req.user
        ? String((req.user as Record<string, unknown>).sub)
        : null;

    const user = await getSessionUser(subject);
    if (!user) {
      return res.status(401).json({ message: "Sesión inválida" });
    }

    return res.json({ user });
  } catch (error) {
    return next(error);
  }
}
