import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export function authGuard(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token requerido" });
  }

  const token = header.replace("Bearer ", "");
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? "secret");
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido" });
  }
}
