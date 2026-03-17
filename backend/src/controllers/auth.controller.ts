import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { login } from "../services/auth.service.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export async function loginController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = loginSchema.parse(req.body);
    const token = await login(payload.email, payload.password);
    res.json({ token });
  } catch (error) {
    next(error);
  }
}
