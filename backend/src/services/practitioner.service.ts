import bcrypt from "bcryptjs";
import { prisma } from "../database/prisma.js";

export async function listPractitioners() {
  const practitioners = await prisma.practitioner.findMany({
    orderBy: { name: "asc" },
  });

  return practitioners.map((practitioner) => ({
    ...practitioner,
    fullName: [practitioner.name, practitioner.lastName].filter(Boolean).join(" "),
  }));
}

export async function listPractitionersPaginated(page = 1, pageSize = 20, search?: string) {
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
          { documentNumber: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { clinic: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [practitioners, total] = await Promise.all([
    prisma.practitioner.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.practitioner.count({ where }),
  ]);

  return {
    data: practitioners.map((p) => ({
      ...p,
      fullName: [p.name, p.lastName].filter(Boolean).join(" "),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getPractitionerById(id: string) {
  return prisma.practitioner.findUnique({ where: { id } });
}

type CreatePractitionerInput = {
  name: string;
  lastName?: string;
  email: string;
  documentNumber: string;
  documentType?: string;
  gender?: string;
  eps?: string;
  phone?: string;
  clinic?: string;
  startDate?: string;
  endDate?: string;
  schedule?: unknown;
  active?: boolean;
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
      eps: input.eps || null,
      phone: input.phone || null,
      email: input.email || null,
      clinic: input.clinic || null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      schedule: (input.schedule ?? {}) as any,
      active: input.active ?? true,
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

type UpdatePractitionerInput = {
  name?: string;
  lastName?: string;
  email?: string;
  documentNumber?: string;
  documentType?: string;
  gender?: string;
  eps?: string;
  phone?: string;
  clinic?: string;
  startDate?: string;
  endDate?: string;
  schedule?: unknown;
  active?: boolean;
};

export async function updatePractitioner(id: string, input: UpdatePractitionerInput) {
  const practitioner = await prisma.practitioner.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!practitioner) {
    throw new Error("Practicante no encontrado");
  }

  const updateData: {
    name?: string;
    lastName?: string;
    gender?: string;
    eps?: string;
    phone?: string;
    clinic?: string;
    startDate?: Date;
    endDate?: Date;
    active?: boolean;
    user?: { update: { email: string } };
  } = {
    name: input.name,
    lastName: input.lastName,
    gender: input.gender,
    eps: input.eps,
    phone: input.phone,
    clinic: input.clinic,
    startDate: input.startDate ? new Date(input.startDate) : undefined,
    endDate: input.endDate ? new Date(input.endDate) : undefined,
    active: input.active,
  };

  if (input.email && practitioner.user) {
    updateData.user = {
      update: { email: input.email.toLowerCase() },
    };
  }

  return prisma.practitioner.update({
    where: { id },
    data: updateData,
  });
}

export async function deletePractitioner(id: string) {
  const practitioner = await prisma.practitioner.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!practitioner) {
    throw new Error("Practicante no encontrado");
  }

  if (practitioner.user) {
    await prisma.user.delete({ where: { id: practitioner.user.id } });
  }

  return prisma.practitioner.delete({ where: { id } });
}

export async function getPractitionerStats() {
  const [total, active] = await Promise.all([
    prisma.practitioner.count(),
    prisma.practitioner.count({ where: { active: true } }),
  ]);

  return { total, active, inactive: total - active };
}
