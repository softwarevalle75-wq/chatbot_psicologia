import { z } from "zod";
import { emailSchema, passwordSchema } from "../../utils/validators.js";

// ── Login ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email:    emailSchema,
  password: passwordSchema,
});

export type LoginDto = z.infer<typeof loginSchema>;

// ── Registro paso 1 — acepta campos exactos del frontend (Step1PersonalInfo) ──

export const registerSchema = z.object({
  primerNombre:    z.string().min(2).max(60).transform(v => v.trim()),
  segundoNombre:   z.string().max(60).optional().transform(v => v?.trim() || undefined),
  primerApellido:  z.string().min(2).max(60).transform(v => v.trim()),
  segundoApellido: z.string().max(60).optional().transform(v => v?.trim() || undefined),

  tipoDocumento: z.string().min(1),
  documento:     z.string().min(4).max(20),

  sexo:              z.string().min(1),
  identidadGenero:   z.string().min(1),
  orientacionSexual: z.string().min(1),
  etnia:             z.string().min(1),
  discapacidad:      z.string().min(1),
  discapacidadDetalle: z.string().max(120).optional(),

  correo:          emailSchema,
  telefonoPersonal: z.string().min(7).max(15),
  fechaNacimiento:  z.string().min(1),

  perteneceUniversidad: z.string().default("No"),
  esAspirante:          z.boolean().optional().default(false),
  carrera:              z.string().max(80).optional(),
  jornada:              z.string().optional(),
  semestre:             z.coerce.number().int().min(1).max(10).optional(),

  password: passwordSchema,
});

export type RegisterDto = z.infer<typeof registerSchema>;

// ── Tratamiento de datos (paso 2) — aceptación explícita ──────────────────────

export const tratamientoDatosSchema = z.object({
  autorizacionDatos: z.enum(["si", "no"]),
});

export type TratamientoDatosDto = z.infer<typeof tratamientoDatosSchema>;

// ── Datos sociodemográficos (paso 3) ──────────────────────────────────────────

export const sociodemograficoSchema = z.object({
  estadoCivil:         z.string().min(1),
  numeroHijos:         z.coerce.number().int().min(0),
  numeroHermanos:      z.coerce.number().int().min(0),
  rolFamiliar:         z.array(z.string()).min(1),
  conQuienVive:        z.string().min(1),
  tienePersonasACargo: z.string().min(1),
  personasACargoQuien: z.string().optional(),
  escolaridad:         z.string().min(1),
  ocupacion:           z.string().min(1),
  nivelIngresos:       z.string().min(1),
});

export type SociodemograficoDto = z.infer<typeof sociodemograficoSchema>;

// ── Consentimiento informado (paso 4) — aceptación explícita ──────────────────

export const consentimientoSchema = z.object({
  consentimientoInformado: z.enum(["si", "no"]),
});

export type ConsentimientoDto = z.infer<typeof consentimientoSchema>;
