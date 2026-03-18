/**
 * Validadores centralizados para el backend.
 * Se usan en los schemas Zod de cada servicio para evitar duplicación.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Regex y conjuntos de valores válidos
// ---------------------------------------------------------------------------

const ONLY_LETTERS = /^[A-Za-záéíóúÁÉÍÓÚüÜñÑ\s'-]+$/;
const COLOMBIAN_MOBILE = /^3\d{9}$/;
const VALID_TLDS = new Set([
  "co", "com", "net", "org", "edu", "gov", "io", "es",
  "info", "biz", "me", "tv", "us", "uk", "de", "fr",
]);

export const DOCUMENT_TYPES = new Set(["CC", "TI", "CE", "RC", "PE"]);

// ---------------------------------------------------------------------------
// Validadores de campos individuales (Zod refinements reutilizables)
// ---------------------------------------------------------------------------

/** Nombre o apellido: solo letras, 2–60 chars, sin caracteres repetidos 4+ veces */
export const nameSchema = z
  .string()
  .min(2, "Debe tener al menos 2 caracteres")
  .max(60, "No puede superar 60 caracteres")
  .refine((v) => ONLY_LETTERS.test(v), "Solo se permiten letras y espacios")
  .refine(
    (v) => !/(.)\1{3,}/.test(v),
    "No se permiten caracteres repetidos consecutivos"
  )
  .transform((v) => v.trim());

/** Correo: formato válido + TLD de la lista permitida */
export const emailSchema = z
  .string()
  .email("Formato de correo inválido")
  .max(100, "El correo no puede superar 100 caracteres")
  .refine((v) => {
    const tld = v.split(".").pop()?.toLowerCase() ?? "";
    return VALID_TLDS.has(tld);
  }, "Dominio de correo no reconocido")
  .transform((v) => v.trim().toLowerCase());

/**
 * Número de documento colombiano por tipo.
 * CC: 6-10 dígitos | TI: 10-11 dígitos | CE: 6-12 alfanumérico
 * RC: 1-11 dígitos | PE: permiso especial, 4-15 chars
 */
export const documentSchema = (tipoField?: string) =>
  z
    .string()
    .min(4, "Documento demasiado corto")
    .max(15, "Documento demasiado largo")
    .refine((v) => {
      if (!tipoField) return /^\d{6,12}$/.test(v);
      switch (tipoField) {
        case "CC": return /^\d{6,10}$/.test(v);
        case "TI": return /^\d{10,11}$/.test(v);
        case "CE": return /^[A-Za-z0-9]{6,12}$/.test(v);
        case "RC": return /^\d{1,11}$/.test(v);
        case "PE": return v.length >= 4 && v.length <= 15;
        default:   return /^\d{6,12}$/.test(v);
      }
    }, "Número de documento inválido para el tipo seleccionado");

/**
 * Celular colombiano: 10 dígitos comenzando con 3.
 * Acepta con o sin prefijo +57/57 y lo normaliza.
 */
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/^\+?57/, "").replace(/\s/g, ""))
  .refine(
    (v) => COLOMBIAN_MOBILE.test(v),
    "Celular inválido. Debe ser un número colombiano de 10 dígitos que empiece en 3"
  );

/** Contraseña: 8–64 chars */
export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(64, "La contraseña no puede superar 64 caracteres");

/** Fecha de nacimiento: no futura, edad entre 15 y 100 años */
export const birthDateSchema = z.coerce
  .date()
  .refine((d) => d < new Date(), "La fecha no puede ser futura")
  .refine((d) => {
    const age = new Date().getFullYear() - d.getFullYear();
    return age >= 15 && age <= 100;
  }, "La edad debe estar entre 15 y 100 años");

/** Semestre universitario: entero entre 1 y 10 */
export const semesterSchema = z.coerce
  .number()
  .int()
  .min(1, "El semestre mínimo es 1")
  .max(10, "El semestre máximo es 10");

/** Texto libre con longitud máxima configurable */
export const freeTextSchema = (max: number) =>
  z
    .string()
    .max(max, `No puede superar ${max} caracteres`)
    .transform((v) => v.trim());

// ---------------------------------------------------------------------------
// Tipos derivados
// ---------------------------------------------------------------------------

export type DocumentType = "CC" | "TI" | "CE" | "RC" | "PE";
