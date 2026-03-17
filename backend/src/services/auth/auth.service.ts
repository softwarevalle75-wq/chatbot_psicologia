/**
 * Servicio de autenticación.
 *
 * Correcciones sobre Developer y el dashboard:
 * - Sin JWT_SECRET con fallback "secret" — usa env.JWT_SECRET (validado al arranque)
 * - Admin NO hardcodeado en código — viene de variables de entorno
 * - Practicante: usa bcrypt (no SHA-256 que NO es función de hash de contraseñas)
 * - Mensaje de error unificado para user-not-found y password-wrong
 *   (evita enumeración de usuarios)
 * - profileId incluido en el token para que el frontend sepa qué perfil cargar
 */

import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../../database/prisma.js";
import { env } from "../../config/env.js";
import { UnauthorizedError } from "../../lib/errors.js";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type UserRole = "admin" | "practicante" | "usuario";

export type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
  profileId: string | null;
};

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Normaliza el nombre del rol a los valores manejados por el sistema */
function normalizeRole(rawRole?: string | null): UserRole {
  const role = (rawRole ?? "").trim().toLowerCase();
  if (role === "admin") return "admin";
  if (["practicante", "practitioner", "estudiante"].includes(role))
    return "practicante";
  return "usuario";
}

/** Firma un JWT con los datos de sesión */
function signToken(user: SessionUser): string {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
      profileId: user.profileId,
    },
    env.JWT_SECRET,
    { expiresIn: "12h" }
  );
}

/**
 * Hash de cédula para practicantes.
 * Se usa SHA-256 solo como mecanismo de comparación de la cédula
 * (no como almacenamiento de contraseña — la contraseña real es bcrypt).
 * El practicante "autentica" ingresando su número de cédula como contraseña.
 * En BD se guarda el hash bcrypt de la cédula (creado al registrar al practicante).
 */
function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// ---------------------------------------------------------------------------
// Funciones exportadas
// ---------------------------------------------------------------------------

/**
 * Login unificado para admin, practicantes y usuarios.
 * Devuelve { token, user } — nunca devuelve la contraseña ni el hash.
 */
export async function login(
  email: string,
  password: string
): Promise<{ token: string; user: SessionUser }> {
  const normalizedEmail = email.trim().toLowerCase();

  // ── Admin hardcodeado por env (no en código fuente) ──────────────────────
  const adminEmail = (process.env.ADMIN_DASHBOARD_EMAIL ?? "").toLowerCase();
  const adminPassword = process.env.ADMIN_DASHBOARD_PASSWORD ?? "";

  if (
    adminEmail &&
    adminPassword &&
    normalizedEmail === adminEmail &&
    password === adminPassword
  ) {
    const adminUser: SessionUser = {
      id: "admin-dashboard",
      email: adminEmail,
      role: "admin",
      profileId: null,
    };
    return { token: signToken(adminUser), user: adminUser };
  }

  // ── Usuarios en BD ───────────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { role: true, practitioner: true, patient: true },
  });

  // Mensaje unificado para "no existe" y "contraseña incorrecta"
  // evita que un atacante enumere qué emails están registrados
  if (!user) {
    throw new UnauthorizedError("Credenciales inválidas");
  }

  const resolvedRole = normalizeRole(user.role?.name);

  // Practicantes: la contraseña es su número de cédula (hash bcrypt en BD)
  if (resolvedRole === "practicante") {
    const practitionerDoc = user.practitioner?.documentNumber ?? "";
    if (!practitionerDoc) {
      throw new UnauthorizedError("Credenciales inválidas");
    }
    // Comparamos la cédula ingresada con el hash bcrypt guardado al crear al practicante
    const docMatches = await bcrypt.compare(password, user.passwordHash);
    if (!docMatches) {
      throw new UnauthorizedError("Credenciales inválidas");
    }
  } else {
    // Usuarios normales: bcrypt estándar
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError("Credenciales inválidas");
    }
  }

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    role: resolvedRole,
    profileId: user.practitioner?.id ?? user.patient?.id ?? null,
  };

  return { token: signToken(sessionUser), user: sessionUser };
}

/**
 * Reconstruye el SessionUser a partir del subject del JWT.
 * Usado en el endpoint GET /api/auth/me para verificar la sesión activa.
 */
export async function getSessionUser(
  subject?: string | null
): Promise<SessionUser | null> {
  if (!subject) return null;

  if (subject === "admin-dashboard") {
    const adminEmail = process.env.ADMIN_DASHBOARD_EMAIL ?? "";
    return {
      id: "admin-dashboard",
      email: adminEmail,
      role: "admin",
      profileId: null,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: subject },
    include: { role: true, practitioner: true, patient: true },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    role: normalizeRole(user.role?.name),
    profileId: user.practitioner?.id ?? user.patient?.id ?? null,
  };
}
