import { prisma } from "../../database/prisma.js";

function getDayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function listAppointmentsByDate(date: Date = new Date()) {
  const { start, end } = getDayRange(date);

  const appointments = await prisma.appointment.findMany({
    where: { scheduledAt: { gte: start, lte: end } },
    orderBy: { scheduledAt: "asc" },
    include: {
      patient: { select: { id: true, name: true, lastName: true } },
      practitioner: { select: { id: true, name: true, lastName: true } },
      consultingRoom: { select: { id: true, name: true } },
    },
  });

  return appointments.map((a) => ({
    id: a.id,
    scheduledAt: a.scheduledAt,
    status: a.status,
    patient: {
      id: a.patient?.id,
      name: [a.patient?.name, a.patient?.lastName].filter(Boolean).join(" "),
    },
    practitioner: {
      id: a.practitioner?.id,
      name: [a.practitioner?.name, a.practitioner?.lastName]
        .filter(Boolean)
        .join(" "),
    },
    consultingRoom: a.consultingRoom,
    timeframe: a.scheduledAt.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));
}
