import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../database/prisma.js";

const ADMIN_EMAIL = process.env.ADMIN_DASHBOARD_EMAIL ?? "chatbotpsicologia@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_DASHBOARD_PASSWORD ?? "psicologia202612345!";

const PRACTITIONER_ROLE_NAMES = new Set(["practicante", "practitioner", "estudiante"]);

type SessionUser = {
  id: string;
  email: string;
  role: "admin" | "practicante" | "usuario";
  profileId: string | null;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeRole(rawRole?: string | null): SessionUser["role"] {
  const role = (rawRole || "").trim().toLowerCase();
  if (role.includes("admin")) return "admin";
  if (PRACTITIONER_ROLE_NAMES.has(role)) return "practicante";
  return "usuario";
}

function signToken(user: SessionUser) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
      profileId: user.profileId,
    },
    process.env.JWT_SECRET ?? "secret",
    { expiresIn: "12h" }
  );
}

export async function login(email: string, password: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (normalizedEmail === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
    const adminUser: SessionUser = {
      id: "admin-dashboard",
      email: ADMIN_EMAIL,
      role: "admin",
      profileId: null,
    };

    return {
      token: signToken(adminUser),
      user: adminUser,
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { role: true, practitioner: true, patient: true }
  });

  if (!user) {
    throw new Error("Credenciales inválidas");
  }

  const normalizedRole = normalizeRole(user.role?.name);
  const roleLoginByCedula = normalizedRole === "practicante";

  if (roleLoginByCedula) {
    const practitionerDocument = String(user.practitioner?.documentNumber || "").trim();
    if (!practitionerDocument) {
      throw new Error("El practicante no tiene cédula registrada");
    }

    const incomingPasswordHash = sha256(String(password || ""));
    const practitionerDocumentHash = sha256(practitionerDocument);

    if (incomingPasswordHash !== practitionerDocumentHash) {
      throw new Error("Credenciales inválidas");
    }
  } else {
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new Error("Credenciales inválidas");
    }
  }

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    role: normalizedRole,
    profileId: user.practitioner?.id ?? user.patient?.id ?? null,
  };

  return {
    token: signToken(sessionUser),
    user: sessionUser,
  };
}

export async function getSessionUserFromTokenSubject(subject?: string | null) {
  if (!subject) return null;

  if (subject === "admin-dashboard") {
    return {
      id: "admin-dashboard",
      email: ADMIN_EMAIL,
      role: "admin" as const,
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
