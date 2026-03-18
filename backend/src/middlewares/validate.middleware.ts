import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

/**
 * Middleware genérico de validación con Zod.
 * Valida req.body contra el schema y reemplaza el body con los datos parseados.
 * Si la validación falla, pasa el ZodError al errorHandler global.
 *
 * Uso:
 *   router.post("/login", validate(loginSchema), loginController)
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return next(result.error);
    }

    req.body = result.data;
    return next();
  };
}
