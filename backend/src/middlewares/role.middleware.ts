import type { NextFunction, Request, Response } from "express";

export function requireRole(...roles: string[]) {
  const allowed = roles.map((role) => role.toLowerCase());

  return (req: Request, res: Response, next: NextFunction) => {
    const role = typeof req.user === "object" && req.user && "role" in req.user
      ? String(req.user.role).toLowerCase()
      : "";

    if (!allowed.includes(role)) {
      return res.status(403).json({ message: "No autorizado para esta accion" });
    }

    return next();
  };
}
