/**
 * Rate limiters por endpoint.
 * Usa express-rate-limit que maneja cleanup automáticamente
 * (a diferencia del Map manual de Developer que tenía memory leak).
 */

import rateLimit from "express-rate-limit";

const rateLimitMessage = (windowMinutes: number) => ({
  message: `Demasiados intentos. Espera ${windowMinutes} minutos antes de intentar de nuevo.`,
});

/** Login: 10 intentos cada 15 minutos por IP */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: rateLimitMessage(15),
  standardHeaders: true,
  legacyHeaders: false,
});

/** Registro: 5 intentos cada 15 minutos por IP */
export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: rateLimitMessage(15),
  standardHeaders: true,
  legacyHeaders: false,
});

/** Endpoints generales: 100 requests por minuto por IP */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: rateLimitMessage(1),
  standardHeaders: true,
  legacyHeaders: false,
});
