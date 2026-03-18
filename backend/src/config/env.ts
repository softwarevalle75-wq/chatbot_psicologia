/**
 * Validación de variables de entorno al arranque.
 * Carga el .env desde backend/ independientemente del directorio de trabajo.
 * Variables requeridas: la app falla inmediatamente si faltan.
 * Variables opcionales: solo fallan cuando se intenta usar el módulo que las necesita.
 */

import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Carga backend/.env sin importar desde dónde corra el proceso
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../.env") });

function requireEnv(key: string, minLength = 1): string {
  const value = process.env[key];
  if (!value || value.trim().length < minLength) {
    throw new Error(
      `[ENV] Variable de entorno '${key}' no definida o demasiado corta (mínimo ${minLength} caracteres). ` +
        `Revisa tu archivo .env antes de iniciar.`
    );
  }
  return value.trim();
}

function optionalEnv(key: string, defaultValue: string): string {
  return (process.env[key] ?? defaultValue).trim();
}

function optionalInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (!val) return defaultValue;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export const env = {
  // ── Requeridas — la app falla al arranque si faltan ──────────────────────
  JWT_SECRET:   requireEnv("JWT_SECRET", 32),
  DATABASE_URL: requireEnv("DATABASE_URL"),
  OPENAI_API_KEY: requireEnv("OPENAI_API_KEY"),

  // ── Servidor API ─────────────────────────────────────────────────────────
  API_PORT: optionalInt("API_PORT", 3001),
  BOT_PORT: optionalInt("BOT_PORT", 3008),

  // ── CORS ─────────────────────────────────────────────────────────────────
  ALLOWED_ORIGINS: optionalEnv("ALLOWED_ORIGINS", "http://localhost:5173"),

  // ── Entorno ──────────────────────────────────────────────────────────────
  NODE_ENV: optionalEnv("NODE_ENV", "development"),
  IS_PROD:  optionalEnv("NODE_ENV", "development") === "production",

  // ── Admin dashboard ───────────────────────────────────────────────────────
  ADMIN_EMAIL:    process.env.ADMIN_DASHBOARD_EMAIL   ?? "",
  ADMIN_PASSWORD: process.env.ADMIN_DASHBOARD_PASSWORD ?? "",

  // ── SMTP (opcionales — solo necesarios para envío de emails) ─────────────
  // Si no están configuradas, el servicio de email lanzará un error descriptivo
  // al intentar enviar, sin romper el arranque de la app.
  SMTP_HOST: optionalEnv("SMTP_HOST", "smtp.gmail.com"),
  SMTP_PORT: optionalInt("SMTP_PORT", 587),
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASS: process.env.SMTP_PASS ?? "",

  // ── Qdrant / RAG (opcionales — solo necesarios si se usa el módulo RAG) ──
  QDRANT_URL:          process.env.QDRANT_URL          ?? "",
  QDRANT_API_KEY:      process.env.QDRANT_API_KEY      ?? "",
  QDRANT_COLLECTION:   optionalEnv("QDRANT_COLLECTION",   "rag-psicologia"),
  EMBEDDING_MODEL:     optionalEnv("EMBEDDING_MODEL",     "text-embedding-3-large"),
  EMBEDDING_DIMENSIONS: optionalInt("EMBEDDING_DIMENSIONS", 1536),
} as const;

// ── Helpers para módulos opcionales ─────────────────────────────────────────

/** Lanza error descriptivo si SMTP no está configurado */
export function requireSmtp(): void {
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    throw new Error(
      "[SMTP] Variables SMTP_USER y SMTP_PASS no configuradas. " +
      "Agrega estas variables al archivo backend/.env para habilitar el envío de correos."
    );
  }
}

/** Lanza error descriptivo si Qdrant no está configurado */
export function requireQdrant(): void {
  if (!env.QDRANT_URL) {
    throw new Error(
      "[RAG] Variable QDRANT_URL no configurada. " +
      "Agrega QDRANT_URL y QDRANT_API_KEY al archivo backend/.env para habilitar el sistema RAG."
    );
  }
}
