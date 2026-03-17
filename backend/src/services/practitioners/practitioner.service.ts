/**
 * Servicio de practicantes.
 * CRUD exclusivo del admin.
 *
 * Correcciones sobre Developer y el dashboard:
 * - createPractitioner: password es bcrypt del número de documento (no SHA-256)
 * - updatePractitioner: no permite cambiar documento ni email (identidad inmutable)
 * - deactivatePractitioner: soft delete (active = false), no elimina el registro
 */

import bcrypt from "bcryptjs";
import { prisma } from "../../database/prisma.js";
import { NotFoundError, ConflictError } from "../../lib/errors.js";
import type { CreatePractitionerDto, UpdatePractitionerDto } from "./practitioner.schema.js";

function formatName(p: { name: string; lastName?: string | null }): string {
  return [p.name, p.lastName].filter(Boolean).join(" ");
}

/** Busca el rol de practicante en la BD — falla si no existe */
async function getPractitionerRole() {
  const role = await prisma.role.findFirst({
    where: {
      name: { in: ["practicante", "Practicante", "estudiante", "ESTUDIANTE"] },
    },
  });

  if (!role) {
    throw new Error(
      "No existe el rol 'practicante' en la base de datos. Ejecuta los seeders primero."
    );
  }

  return role;
}

// ---------------------------------------------------------------------------

export async function listPractitioners() {
  const practitioners = await prisma.practitioner.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      lastName: true,
      documentNumber: true,
      documentType: true,
      gender: true,
      estrato: true,
      barrio: true,
      localidad: true,
      schedule: true,
      sessionsCount: true,
      active: true,
    },
  });

  return practitioners.map((p) => ({
    ...p,
    fullName: formatName(p),
  }));
}

export async function getPractitionerById(id: string) {
  const practitioner = await prisma.practitioner.findUnique({
    where: { id },
    include: {
      patients: {
        select: { id: true, name: true, lastName: true, state: true },
        take: 20,
      },
    },
  });

  if (!practitioner) {
    throw new NotFoundError("Practicante no encontrado");
  }

  return { ...practitioner, fullName: formatName(practitioner) };
}

export async function createPractitioner(input: CreatePractitionerDto) {
  // Verificar duplicados antes de crear
  const existing = await prisma.practitioner.findFirst({
    where: {
      OR: [
        { documentNumber: input.documentNumber },
        { user: { email: input.email } },
      ],
    },
  });

  if (existing) {
    throw new ConflictError(
      "Ya existe un practicante con ese documento o correo"
    );
  }

  const role = await getPractitionerRole();

  // La contraseña del practicante es su número de documento hasheado con bcrypt.
  // Al hacer login, el practicante ingresa su cédula como contraseña
  // y el authService la compara contra este hash.
  const passwordHash = await bcrypt.hash(input.documentNumber, 10);

  return prisma.practitioner.create({
    data: {
      name: input.name,
      lastName: input.lastName ?? null,
      documentNumber: input.documentNumber,
      documentType: input.documentType ?? "CC",
      gender: input.gender ?? "No especificado",
      estrato: input.estrato ?? "N/A",
      barrio: input.barrio ?? "N/A",
      localidad: input.localidad ?? "N/A",
      schedule: input.schedule ?? {},
      user: {
        create: {
          name: input.name,
          lastName: input.lastName ?? null,
          email: input.email.toLowerCase(),
          passwordHash,
          roleId: role.id,
        },
      },
    },
    include: {
      user: { select: { id: true, email: true } },
    },
  });
}

export async function updatePractitioner(
  id: string,
  input: UpdatePractitionerDto
) {
  const existing = await prisma.practitioner.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Practicante no encontrado");
  }

  const updated = await prisma.practitioner.update({
    where: { id },
    data: {
      name: input.name,
      lastName: input.lastName,
      gender: input.gender,
      estrato: input.estrato,
      barrio: input.barrio,
      localidad: input.localidad,
      schedule: input.schedule,
    },
  });

  // Sincronizar nombre en User si cambió
  if (input.name && updated.userId) {
    await prisma.user.update({
      where: { id: updated.userId },
      data: { name: input.name, lastName: input.lastName },
    });
  }

  return { ...updated, fullName: formatName(updated) };
}

/** Soft delete: desactiva al practicante sin borrar sus datos históricos */
export async function deactivatePractitioner(id: string) {
  const existing = await prisma.practitioner.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Practicante no encontrado");
  }

  await prisma.$transaction([
    prisma.practitioner.update({ where: { id }, data: { active: false } }),
    ...(existing.userId
      ? [prisma.user.update({ where: { id: existing.userId }, data: { active: false } })]
      : []),
  ]);

  return { message: "Practicante desactivado correctamente" };
}
