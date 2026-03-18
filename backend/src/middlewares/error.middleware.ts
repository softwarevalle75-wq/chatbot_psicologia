import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";
import { env } from "../config/env.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Errores de validación Zod
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Datos inválidos",
      errors: err.flatten().fieldErrors,
    });
  }

  // Errores de aplicación conocidos (AppError y subclases)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  // Errores inesperados — loguear internamente, no exponer detalles al cliente
  console.error("[Error no controlado]", err);

  const message = env.IS_PROD
    ? "Error interno del servidor"
    : err instanceof Error
      ? err.message
      : "Error desconocido";

  return res.status(500).json({ message });
};
