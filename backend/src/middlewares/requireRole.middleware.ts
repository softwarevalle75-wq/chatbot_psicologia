import type { NextFunction, Request, Response } from "express";

/**
 * Middleware de autorización por rol.
 * Debe usarse después de authGuard, que ya validó el JWT y puso req.user.
 *
 * Uso:
 *   router.post("/", authGuard, requireRole("admin"), createController)
 *   router.put("/:id", authGuard, requireRole("admin", "practicante"), updateController)
 */
export function requireRole(...roles: string[]) {
  const allowed = new Set(roles.map((r) => r.toLowerCase()));

  return (req: Request, res: Response, next: NextFunction) => {
    const userRole =
      typeof req.user === "object" && req.user !== null && "role" in req.user
        ? String((req.user as Record<string, unknown>).role ?? "").toLowerCase()
        : "";

    if (!allowed.has(userRole)) {
      return res
        .status(403)
        .json({ message: "No tienes permisos para esta acción" });
    }

    return next();
  };
}
