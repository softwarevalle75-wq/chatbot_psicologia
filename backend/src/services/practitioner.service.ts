import { prisma } from "../database/prisma.js";

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
