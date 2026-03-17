import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  void _next;
  console.error(err);
  const message = err instanceof Error ? err.message : "Error inesperado";
  res.status(500).json({ message });
};
