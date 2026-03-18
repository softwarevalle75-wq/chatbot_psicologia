/**
 * Servicio de autenticación y registro de usuarios.
 *
 * Correcciones:
 * - register(): persiste TODOS los campos del Paso 1 (demográficos, universidad, nombres separados)
 * - saveTratamientoDatos(): valida aceptación/rechazo explícito
 * - saveSociodemografico(): guarda en columnas de Patient (no en JSON)
 * - saveConsentimiento(): valida aceptación explícita + timestamp + versión
 * - calcRegistrationStep(): diferencia los 4 pasos correctamente
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../database/prisma.js";
import { env } from "../../config/env.js";
import { UnauthorizedError, NotFoundError, ConflictError, AppError } from "../../lib/errors.js";
import type { RegisterDto, SociodemograficoDto } from "./auth.schema.js";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type UserRole = "admin" | "practicante" | "usuario";

export type SessionUser = {
  id:        string;
  email:     string;
  role:      UserRole;
  profileId: string | null;
};

// ── Helpers internos ──────────────────────────────────────────────────────────

function normalizeRole(rawRole?: string | null): UserRole {
  const role = (rawRole ?? "").trim().toLowerCase();
  if (role === "admin") return "admin";
  if (["practicante", "practitioner", "estudiante"].includes(role)) return "practicante";
  return "usuario";
}

function signToken(user: SessionUser): string {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email, profileId: user.profileId },
    env.JWT_SECRET,
    { expiresIn: "12h" }
  );
}

/**
 * Determina en qué paso del registro está el paciente.
 * Paso 1: registro personal (si no hay patient)
 * Paso 2: tratamiento de datos (si dataAgreement = false)
 * Paso 3: sociodemográfico (si sociodemograficoCompleted = false)
 * Paso 4: consentimiento (si consentimientoAt = null)
 * Paso 5: completo
 */
function calcRegistrationStep(patient: {
  dataAgreement:             boolean;
  sociodemograficoCompleted: boolean;
  consentimientoAt:          Date | null;
} | null): number {
  if (!patient)                          return 1;
  if (!patient.dataAgreement)            return 2;
  if (!patient.sociodemograficoCompleted) return 3;
  if (!patient.consentimientoAt)         return 4;
  return 5;
}

async function getUserRole() {
  let role = await prisma.role.findFirst({
    where: { name: { in: ["usuario", "Usuario", "user"] } },
  });
  if (!role) {
    role = await prisma.role.create({ data: { name: "usuario", description: "Paciente del sistema" } });
  }
  return role;
}

async function getPatientByUserId(userId: string) {
  const user = await prisma.user.findUnique({
    where:   { id: userId },
    include: { patient: true },
  });
  if (!user?.patient) throw new NotFoundError("Paciente no encontrado");
  return { user, patient: user.patient };
}

// ── Funciones exportadas ──────────────────────────────────────────────────────

/**
 * Login unificado: admin (por env), practicantes (cédula + bcrypt), usuarios (bcrypt).
 */
export async function login(
  email:    string,
  password: string
): Promise<{ token: string; user: SessionUser }> {
  const normalizedEmail = email.trim().toLowerCase();

  const adminEmail    = env.ADMIN_EMAIL.toLowerCase();
  const adminPassword = env.ADMIN_PASSWORD;

  if (adminEmail && adminPassword && normalizedEmail === adminEmail && password === adminPassword) {
    const adminUser: SessionUser = { id: "admin-dashboard", email: adminEmail, role: "admin", profileId: null };
    return { token: signToken(adminUser), user: adminUser };
  }

  const user = await prisma.user.findUnique({
    where:   { email: normalizedEmail },
    include: { role: true, practitioner: true, patient: true },
  });

  if (!user) throw new UnauthorizedError("Credenciales inválidas");

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) throw new UnauthorizedError("Credenciales inválidas");

  const resolvedRole = normalizeRole(user.role?.name);
  const sessionUser: SessionUser = {
    id:        user.id,
    email:     user.email,
    role:      resolvedRole,
    profileId: user.practitioner?.id ?? user.patient?.id ?? null,
  };

  return { token: signToken(sessionUser), user: sessionUser };
}

/**
 * Registro paso 1: crea User + Patient con TODOS los datos personales.
 */
export async function register(data: RegisterDto): Promise<{ token: string; user: SessionUser; userId: string; message: string }> {
  const email = data.correo.toLowerCase();

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new ConflictError("Ya existe una cuenta con ese correo electrónico");

  const existingPatient = await prisma.patient.findFirst({ where: { documentNumber: data.documento } });
  if (existingPatient) throw new ConflictError("Ya existe una cuenta con ese número de documento");

  const role         = await getUserRole();
  const passwordHash = await bcrypt.hash(data.password, 10);

  const result = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name:     data.primerNombre,
        lastName: [data.primerApellido, data.segundoApellido].filter(Boolean).join(" "),
        email,
        passwordHash,
        roleId: role.id,
      },
    });

    const newPatient = await tx.patient.create({
      data: {
        userId:         newUser.id,
        whatsappNumber: data.telefonoPersonal,
        email,
        documentType:   data.tipoDocumento,
        documentNumber: data.documento,

        // Nombres separados — completos
        name:           data.primerNombre,
        lastName:       [data.primerApellido, data.segundoApellido].filter(Boolean).join(" "),
        firstName:      data.primerNombre,
        secondName:     data.segundoNombre ?? null,
        firstLastName:  data.primerApellido,
        secondLastName: data.segundoApellido ?? null,

        // Demográficos
        birthDate:          data.fechaNacimiento ? new Date(data.fechaNacimiento) : null,
        sex:                data.sexo,
        genderIdentity:     data.identidadGenero,
        sexualOrientation:  data.orientacionSexual,
        ethnicity:          data.etnia,
        disability:         data.discapacidad,
        disabilityDetail:   data.discapacidadDetalle ?? null,

        // Universidad
        belongsToUniversity: data.perteneceUniversidad === "Si",
        isAspirant:          data.esAspirante ?? false,
        career:              data.carrera ?? null,
        academicSchedule:    data.jornada ?? null,
        semester:            data.semestre ?? null,

        // Estado inicial
        state:          "registrado",
        flow:           "register",
        dataAgreement:  false,
        availability:   {},
      },
    });

    return { user: newUser, patient: newPatient };
  });

  const sessionUser: SessionUser = {
    id:        result.user.id,
    email:     result.user.email,
    role:      "usuario",
    profileId: result.patient.id,
  };

  return { token: signToken(sessionUser), user: sessionUser, userId: result.user.id, message: "Registro exitoso" };
}

/**
 * Paso 2: autorización de tratamiento de datos.
 * Requiere aceptación explícita ("si"). Si rechaza ("no"), no avanza.
 */
export async function saveTratamientoDatos(
  userId:   string,
  aceptado: boolean
): Promise<{ message: string; accepted: boolean }> {
  const { patient } = await getPatientByUserId(userId);

  if (!aceptado) {
    return { message: "Autorización de datos rechazada. No puedes continuar sin aceptar.", accepted: false };
  }

  await prisma.patient.update({
    where: { id: patient.id },
    data:  { dataAgreement: true, dataAgreementAt: new Date() },
  });

  return { message: "Autorización de datos guardada", accepted: true };
}

/**
 * Paso 3: datos sociodemográficos — guardados en columnas de Patient (no JSON).
 */
export async function saveSociodemografico(
  userId: string,
  data:   SociodemograficoDto
): Promise<{ message: string }> {
  const { patient } = await getPatientByUserId(userId);

  await prisma.patient.update({
    where: { id: patient.id },
    data: {
      estadoCivil:         data.estadoCivil,
      numeroHijos:         data.numeroHijos,
      numeroHermanos:      data.numeroHermanos,
      rolFamiliar:         data.rolFamiliar,
      conQuienVive:        data.conQuienVive,
      tienePersonasACargo: data.tienePersonasACargo === "Si",
      personasACargoQuien: data.personasACargoQuien ?? null,
      escolaridad:         data.escolaridad,
      ocupacion:           data.ocupacion,
      nivelIngresos:       data.nivelIngresos,
      sociodemograficoCompleted: true,
    },
  });

  return { message: "Datos sociodemográficos guardados" };
}

/**
 * Paso 4: consentimiento informado.
 * Requiere aceptación explícita ("si"). Guarda timestamp y versión del texto.
 */
export async function saveConsentimiento(
  userId:   string,
  aceptado: boolean
): Promise<{ message: string; accepted: boolean }> {
  const { patient } = await getPatientByUserId(userId);

  if (!aceptado) {
    return { message: "Consentimiento rechazado. No puedes continuar sin aceptar.", accepted: false };
  }

  await prisma.patient.update({
    where: { id: patient.id },
    data: {
      state:                 "activo",
      consentimientoAt:      new Date(),
      consentimientoVersion: "v1.0",
    },
  });

  return { message: "Consentimiento informado guardado", accepted: true };
}

/**
 * Check status: devuelve el paso de registro actual (1-5).
 */
export async function checkStatus(userId: string): Promise<{
  registrationStep: number;
  user:             SessionUser;
}> {
  if (userId === "admin-dashboard") {
    return {
      registrationStep: 5,
      user: { id: "admin-dashboard", email: env.ADMIN_EMAIL, role: "admin", profileId: null },
    };
  }

  const user = await prisma.user.findUnique({
    where:   { id: userId },
    include: { role: true, patient: true, practitioner: true },
  });
  if (!user) throw new NotFoundError("Usuario no encontrado");

  const patient = user.patient;
  const step    = calcRegistrationStep(
    patient ? {
      dataAgreement:             patient.dataAgreement,
      sociodemograficoCompleted: patient.sociodemograficoCompleted,
      consentimientoAt:          patient.consentimientoAt,
    } : null
  );

  const sessionUser: SessionUser = {
    id:        user.id,
    email:     user.email,
    role:      normalizeRole(user.role?.name),
    profileId: user.practitioner?.id ?? patient?.id ?? null,
  };

  return { registrationStep: step, user: sessionUser };
}

/**
 * Reconstruye el SessionUser desde el subject del JWT.
 */
export async function getSessionUser(subject?: string | null): Promise<SessionUser | null> {
  if (!subject) return null;

  if (subject === "admin-dashboard") {
    return { id: "admin-dashboard", email: env.ADMIN_EMAIL, role: "admin", profileId: null };
  }

  const user = await prisma.user.findUnique({
    where:   { id: subject },
    include: { role: true, practitioner: true, patient: true },
  });
  if (!user) return null;

  return {
    id:        user.id,
    email:     user.email,
    role:      normalizeRole(user.role?.name),
    profileId: user.practitioner?.id ?? user.patient?.id ?? null,
  };
}
