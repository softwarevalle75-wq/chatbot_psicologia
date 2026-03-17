import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { getSessionUserFromTokenSubject, login } from "../services/auth.service.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export async function loginController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = loginSchema.parse(req.body);
    const session = await login(payload.email, payload.password);
    res.json(session);
  } catch (error) {
    next(error);
  }
}

export async function meController(req: Request, res: Response, next: NextFunction) {
  try {
    const subject = typeof req.user === "object" && req.user && "sub" in req.user
      ? String(req.user.sub)
      : null;

    const user = await getSessionUserFromTokenSubject(subject);
    if (!user) {
      return res.status(401).json({ message: "Sesión inválida" });
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
}
