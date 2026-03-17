/**
 * Validación de variables de entorno al arranque.
 * Si alguna variable requerida falta o es insegura, la app falla inmediatamente
 * en lugar de arrancar con valores por defecto inseguros.
 */

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

export const env = {
  // Seguridad — requeridas, sin fallback
  JWT_SECRET: requireEnv("JWT_SECRET", 32),

  // Base de datos
  DATABASE_URL: requireEnv("DATABASE_URL"),

  // OpenAI
  OPENAI_API_KEY: requireEnv("OPENAI_API_KEY"),

  // Servidor API
  API_PORT: Number(optionalEnv("API_PORT", "3001")),

  // CORS — lista de orígenes permitidos separada por comas
  ALLOWED_ORIGINS: optionalEnv("ALLOWED_ORIGINS", "http://localhost:5173"),

  // Entorno
  NODE_ENV: optionalEnv("NODE_ENV", "development"),
  IS_PROD: optionalEnv("NODE_ENV", "development") === "production",

  // RAG (opcionales — solo requeridos si se usa el módulo RAG)
  QDRANT_URL: process.env.QDRANT_URL ?? "",
  QDRANT_API_KEY: process.env.QDRANT_API_KEY ?? "",
  QDRANT_COLLECTION: optionalEnv("QDRANT_COLLECTION", "rag-psicologia"),
  EMBEDDING_MODEL: optionalEnv("EMBEDDING_MODEL", "text-embedding-3-large"),
  EMBEDDING_DIMENSIONS: Number(optionalEnv("EMBEDDING_DIMENSIONS", "1536")),
} as const;
