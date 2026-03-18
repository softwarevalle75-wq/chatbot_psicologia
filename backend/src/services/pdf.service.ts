import { prisma } from "../database/prisma.js";

function mapPdf(record: any) {
  return {
    id: record.id,
    filename: record.filename,
    path: record.path,
    sizeBytes: record.sizeBytes,
    uploadedAt: record.uploadedAt,
    patient: record.patient
      ? {
          id: record.patient.id,
          name: [record.patient.name, record.patient.lastName].filter(Boolean).join(" "),
          documentNumber: record.patient.documentNumber,
        }
      : null,
    practitioner: record.patient?.practitioner
      ? {
          id: record.patient.practitioner.id,
          name: [record.patient.practitioner.name, record.patient.practitioner.lastName].filter(Boolean).join(" "),
          documentNumber: record.patient.practitioner.documentNumber,
        }
      : null,
  };
}

export async function listAllPdfDocuments() {
  const records = await prisma.pdfDocument.findMany({
    orderBy: { uploadedAt: "desc" },
    include: {
      patient: {
        include: {
          practitioner: true,
        },
      },
    },
  });

  return records.map(mapPdf);
}

export async function listPdfDocumentsByPractitioner(practitionerId: string) {
  const records = await prisma.pdfDocument.findMany({
    where: {
      patient: {
        practitionerId,
      },
    },
    orderBy: { uploadedAt: "desc" },
    include: {
      patient: {
        include: {
          practitioner: true,
        },
      },
    },
  });

  return records.map(mapPdf);
}
