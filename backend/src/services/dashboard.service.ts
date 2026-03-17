import { prisma } from "../database/prisma.js";

export async function fetchDashboardSummary() {
  const [patients, appointments, alerts, metrics] = await Promise.all([
    prisma.patient.count(),
    prisma.appointment.count(),
    prisma.psychEvent.count({ where: { riskLevel: "alto" } }),
    prisma.psychMetric.aggregate({
      _avg: {
        anxiety: true,
        depression: true,
        stress: true
      }
    })
  ]);

  return {
    totalPatients: patients,
    totalAppointments: appointments,
    highRiskAlerts: alerts,
    averages: {
      anxiety: metrics._avg.anxiety ?? 0,
      depression: metrics._avg.depression ?? 0,
      stress: metrics._avg.stress ?? 0
    }
  };
}
