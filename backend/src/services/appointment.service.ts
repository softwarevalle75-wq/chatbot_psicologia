import { prisma } from "../database/prisma.js";

function getDayRange(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function listAppointmentsByDate(date = new Date()) {
  const { start, end } = getDayRange(date);

  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledAt: {
        gte: start,
        lte: end
      }
    },
    orderBy: { scheduledAt: "asc" },
    include: {
      patient: { select: { id: true, name: true, lastName: true } },
      practitioner: { select: { id: true, name: true, lastName: true } },
      consultingRoom: { select: { id: true, name: true } }
    }
  });

  return appointments.map((appointment) => ({
    id: appointment.id,
    scheduledAt: appointment.scheduledAt,
    status: appointment.status,
    patient: {
      id: appointment.patient?.id,
      name: [appointment.patient?.name, appointment.patient?.lastName]
        .filter(Boolean)
        .join(" ")
    },
    practitioner: {
      id: appointment.practitioner?.id,
      name: [appointment.practitioner?.name, appointment.practitioner?.lastName]
        .filter(Boolean)
        .join(" ")
    },
    consultingRoom: appointment.consultingRoom,
    timeframe: appointment.scheduledAt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    })
  }));
}
