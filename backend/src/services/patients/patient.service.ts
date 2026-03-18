import { prisma } from "../../database/prisma.js";
import { NotFoundError } from "../../lib/errors.js";

function formatName(entity: { name?: string | null; lastName?: string | null } | null): string | null {
  if (!entity) return null;
  return [entity.name, entity.lastName].filter(Boolean).join(" ") || null;
}

export async function listPatients() {
  const patients = await prisma.patient.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      practitioner: { select: { id: true, name: true, lastName: true } },
      metrics: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return patients.map((patient) => ({
    id: patient.id,
    name: formatName(patient) ?? "Sin nombre",
    whatsappNumber: patient.whatsappNumber,
    state: patient.state,
    flow: patient.flow,
    helpStage: patient.helpStage,
    practitioner: patient.practitioner
      ? {
          id: patient.practitioner.id,
          name: formatName(patient.practitioner),
        }
      : null,
    lastMetric: patient.metrics[0] ?? null,
    updatedAt: patient.updatedAt,
  }));
}

export async function getPatientDetail(patientId: string) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      practitioner: { select: { id: true, name: true, lastName: true } },
      appointments: {
        orderBy: { scheduledAt: "desc" },
        take: 5,
        include: {
          practitioner: { select: { id: true, name: true, lastName: true } },
          consultingRoom: { select: { id: true, name: true } },
        },
      },
      evaluations: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      metrics: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  if (!patient) {
    throw new NotFoundError("Paciente no encontrado");
  }

  return {
    id: patient.id,
    name: formatName(patient) ?? "Sin nombre",
    whatsappNumber: patient.whatsappNumber,
    state: patient.state,
    flow: patient.flow,
    helpStage: patient.helpStage,
    availability: patient.availability,
    practitioner: patient.practitioner
      ? {
          id: patient.practitioner.id,
          name: formatName(patient.practitioner),
        }
      : null,
    appointments: patient.appointments,
    evaluations: patient.evaluations,
    metrics: patient.metrics,
  };
}
