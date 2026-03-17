import { prisma } from "../database/prisma.js";
import bcrypt from "bcryptjs";

export async function listPractitioners() {
  const practitioners = await prisma.practitioner.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      lastName: true,
      documentNumber: true,
      gender: true,
      estrato: true,
      barrio: true,
      localidad: true,
      schedule: true,
      sessionsCount: true,
      active: true
    }
  });

  return practitioners.map((practitioner) => ({
    ...practitioner,
    fullName: [practitioner.name, practitioner.lastName].filter(Boolean).join(" ")
  }));
}

type CreatePractitionerInput = {
  name: string;
  lastName?: string;
  email: string;
  documentNumber: string;
  documentType?: string;
  gender?: string;
  estrato?: string;
  barrio?: string;
  localidad?: string;
  schedule?: unknown;
};

export async function createPractitioner(input: CreatePractitionerInput) {
  const role = await prisma.role.findFirst({
    where: { name: { in: ["practicante", "Practicante", "ESTUDIANTE", "estudiante"] } },
  });

  if (!role) {
    throw new Error("No existe el rol de practicante/estudiante en la base de datos");
  }

  const passwordHash = await bcrypt.hash(String(input.documentNumber), 10);

  return prisma.practitioner.create({
    data: {
      name: input.name,
      lastName: input.lastName || null,
      documentNumber: input.documentNumber,
      documentType: input.documentType || "CC",
      gender: input.gender || "No especificado",
      estrato: input.estrato || "N/A",
      barrio: input.barrio || "N/A",
      localidad: input.localidad || "N/A",
      schedule: input.schedule ?? {},
      user: {
        create: {
          name: input.name,
          lastName: input.lastName || null,
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
