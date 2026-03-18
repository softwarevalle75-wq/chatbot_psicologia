/**
 * Rate limiters por endpoint.
 * Usa express-rate-limit que maneja cleanup automáticamente
 */

import rateLimit from "express-rate-limit";

const IS_PROD = process.env.NODE_ENV === "production";

const rateLimitMessage = (windowMinutes: number) => ({
  message: `Demasiados intentos. Espera ${windowMinutes} minutos antes de intentar de nuevo.`,
});

/**
 * Login:
 * - Producción: 10 intentos / 15 minutos por IP
 * - Desarrollo:  50 intentos / 15 minutos (para pruebas)
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      IS_PROD ? 10 : 50,
  message:  rateLimitMessage(15),
  standardHeaders: true,
  legacyHeaders:   false,
});

/**
 * Registro:
 * - Producción: 5 intentos / 15 minutos por IP
 * - Desarrollo: 20 intentos / 15 minutos
 */
export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      IS_PROD ? 5 : 20,
  message:  rateLimitMessage(15),
  standardHeaders: true,
  legacyHeaders:   false,
});

/**
 * General: 200 requests por minuto por IP
 * - Producción: 100 req/min
 * - Desarrollo: 500 req/min
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      IS_PROD ? 100 : 500,
  message:  rateLimitMessage(1),
  standardHeaders: true,
  legacyHeaders:   false,
});
