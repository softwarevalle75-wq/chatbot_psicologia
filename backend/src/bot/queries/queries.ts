/**
 * Capa de acceso a datos del bot.
 *
 * Correcciones sobre Developer:
 * - Eliminada importación de aiHorarios (módulo eliminado junto con agendFlow)
 * - Eliminadas funciones exclusivas del flujo de WhatsApp
 *   (addWebPracticante, editWebPracticante, editWebUser — ahora viven en la API REST)
 * - Un único punto de importación de prisma (lib/database/prisma.ts)
 */

import { prisma } from "../../database/prisma.js";

// ---------------------------------------------------------------------------
// Constantes de cuestionarios
// ---------------------------------------------------------------------------

const GHQ12_QUESTIONS = [
  "1. ¿Ha podido concentrarse bien en lo que hace?\n    0) Mejor que lo habitual.\n    1) Igual que lo habitual.\n    2) Menos que lo habitual.\n    3) Mucho menos que lo habitual.",
  "2. ¿Sus preocupaciones le han hecho perder mucho el sueño?\n    0) No, en absoluto.\n    1) Igual que lo habitual.\n    2) Más que lo habitual.\n    3) Mucho más que lo habitual.",
  "3. ¿Ha sentido que está desempeñando un papel útil en la vida?\n    0) Más que lo habitual.\n    1) Igual que lo habitual.\n    2) Menos que lo habitual.\n    3) Mucho menos que lo habitual.",
  "4. ¿Se ha sentido capaz de tomar decisiones?\n    0) Más capaz que lo habitual.\n    1) Igual que lo habitual.\n    2) Menos capaz que lo habitual.\n    3) Mucho menos capaz que lo habitual.",
  "5. ¿Se ha sentido constantemente agobiado y en tensión?\n    0) No, en absoluto.\n    1) Igual que lo habitual.\n    2) Más que lo habitual.\n    3) Mucho más que lo habitual.",
  "6. ¿Ha sentido que no puede superar sus dificultades?\n    0) No, en absoluto.\n    1) Igual que lo habitual.\n    2) Más que lo habitual.\n    3) Mucho más que lo habitual.",
  "7. ¿Ha sido capaz de disfrutar de sus actividades normales de cada día?\n    0) Más que lo habitual.\n    1) Igual que lo habitual.\n    2) Menos que lo habitual.\n    3) Mucho menos que lo habitual.",
  "8. ¿Ha sido capaz de hacer frente adecuadamente a sus problemas?\n    0) Más capaz que lo habitual.\n    1) Igual que lo habitual.\n    2) Menos capaz que lo habitual.\n    3) Mucho menos capaz que lo habitual.",
  "9. ¿Se ha sentido poco feliz o deprimido/a?\n    0) No, en absoluto.\n    1) No más que lo habitual.\n    2) Más que lo habitual.\n    3) Mucho más que lo habitual.",
  "10. ¿Ha perdido confianza en sí mismo/a?\n    0) No, en absoluto.\n    1) No más que lo habitual.\n    2) Más que lo habitual.\n    3) Mucho más que lo habitual.",
  "11. ¿Ha pensado que usted es una persona que no vale para nada?\n    0) No, en absoluto.\n    1) No más que lo habitual.\n    2) Más que lo habitual.\n    3) Mucho más que lo habitual.",
  "12. ¿Se siente razonablemente feliz considerando todas las circunstancias?\n    0) Más feliz que lo habitual.\n    1) Igual que lo habitual.\n    2) Menos feliz que lo habitual.\n    3) Mucho menos feliz que lo habitual.",
];

const RESPONSE_TEMPLATES: Record<string, Record<number, number[]>> = {
  ghq12: { 0: [], 1: [], 2: [], 3: [] },
  dep:   { 0: [], 1: [], 2: [], 3: [] },
  ans:   { 0: [], 1: [], 2: [], 3: [] },
  estr:  { 0: [], 1: [], 2: [], 3: [], 4: [] },
  suic:  { 0: [], 1: [], 2: [] },
  calvida: { 1: [], 2: [], 3: [], 4: [], 5: [] },
};

const SENDER_TO_ROLE: Record<string, string> = {
  paciente: "user",
  ia: "assistant",
  sistema: "system",
};

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function createInitialResponses(tipoTest: string): Record<number, number[]> {
  return JSON.parse(
    JSON.stringify(RESPONSE_TEMPLATES[tipoTest] ?? { 0: [], 1: [], 2: [], 3: [] })
  );
}

function mapHistoryFromMessages(
  messages: Array<{ sender: string; body: string }>
): Array<{ role: string; content: string }> {
  return messages.map((m) => ({
    role: SENDER_TO_ROLE[m.sender] ?? "system",
    content: m.body,
  }));
}

function mapHistoryToMessages(
  history: Array<{ role: string; content: unknown }>
): Array<{ sender: string; body: string; metadata: null; sentAt: Date }> {
  return history.map((entry, index) => ({
    sender:
      entry.role === "user"
        ? "paciente"
        : entry.role === "assistant"
          ? "ia"
          : "sistema",
    body:
      typeof entry.content === "string"
        ? entry.content
        : JSON.stringify(entry.content),
    metadata: null,
    sentAt: new Date(Date.now() + index),
  }));
}

// ---------------------------------------------------------------------------
// Gestión de pacientes por teléfono
// ---------------------------------------------------------------------------

/**
 * Busca o crea un paciente por número de WhatsApp.
 * El estado inicial es "aspirante" — no crea un usuario autenticado.
 */
async function ensurePatientByPhone(phone: string) {
  let patient = await prisma.patient.findUnique({
    where: { whatsappNumber: phone },
  });

  if (!patient) {
    patient = await prisma.patient.create({
      data: { whatsappNumber: phone, availability: {} },
    });
  }

  return patient;
}

async function getPatientWithRelations(phone: string) {
  const patient = await ensurePatientByPhone(phone);
  return prisma.patient.findUnique({
    where: { id: patient.id },
    include: { practitioner: true },
  });
}

async function getOrCreateActiveSession(patientId: string) {
  let session = await prisma.chatSession.findFirst({
    where: { patientId, endedAt: null },
    include: { messages: { orderBy: { sentAt: "asc" } } },
  });

  if (!session) {
    session = await prisma.chatSession.create({
      data: { patientId },
      include: { messages: { orderBy: { sentAt: "asc" } } },
    });
  }

  return session;
}

function mapPatientToLegacy(
  patient: NonNullable<Awaited<ReturnType<typeof getPatientWithRelations>>>,
  history: Array<{ role: string; content: string }>
) {
  return {
    idUsuario: patient.id,
    nombre: patient.name,
    apellido: patient.lastName,
    correo: patient.email,
    telefonoPersonal: patient.whatsappNumber,
    documento: patient.documentNumber,
    tipoDocumento: patient.documentType,
    testActual: patient.testActual,
    motivo: patient.motivo,
    ayudaPsicologica: patient.helpStage,
    tratDatos: patient.dataAgreement,
    flujo: patient.flow,
    estado: patient.state === "activo",
    disponibilidad: patient.availability,
    historial: history,
    practicanteAsignado: patient.practitionerId,
    practitioner: patient.practitioner
      ? { id: patient.practitioner.id, nombre: patient.practitioner.name }
      : null,
  };
}

async function loadLegacyPatient(phone: string) {
  const patient = await getPatientWithRelations(phone);
  if (!patient) throw new Error(`Paciente no encontrado para el teléfono: ${phone}`);
  const session = await getOrCreateActiveSession(patient.id);
  const historial = mapHistoryFromMessages(session.messages ?? []);
  return mapPatientToLegacy(patient, historial);
}

// ---------------------------------------------------------------------------
// Evaluaciones psicológicas
// ---------------------------------------------------------------------------

async function getEvaluation(patientId: string, tipoTest: string) {
  const template = createInitialResponses(tipoTest);
  return prisma.psychEvaluation.upsert({
    where: { patientId_type: { patientId, type: tipoTest } },
    update: {},
    create: { patientId, type: tipoTest, responses: template },
  });
}

// ---------------------------------------------------------------------------
// Exports públicos
// ---------------------------------------------------------------------------

export const obtenerUsuario = (numero: string) => loadLegacyPatient(numero);

export const obtenerHist = async (numero: string) => {
  const patient = await ensurePatientByPhone(numero);
  const session = await getOrCreateActiveSession(patient.id);
  return mapHistoryFromMessages(session.messages ?? []);
};

export const saveHist = async (
  numero: string,
  historial: Array<{ role: string; content: unknown }>
) => {
  const patient = await ensurePatientByPhone(numero);
  const session = await getOrCreateActiveSession(patient.id);
  await prisma.chatMessage.deleteMany({ where: { sessionId: session.id } });
  const data = mapHistoryToMessages(historial).map((entry) => ({
    ...entry,
    sessionId: session.id,
  }));
  if (data.length) {
    await prisma.chatMessage.createMany({ data });
  }
};

export const switchAyudaPsicologica = async (numero: string, opcion: number) => {
  const patient = await ensurePatientByPhone(numero);
  await prisma.patient.update({
    where: { id: patient.id },
    data: { helpStage: opcion },
  });
};

export const switchFlujo = async (numero: string, flujo: string) => {
  const patient = await ensurePatientByPhone(numero);
  await prisma.patient.update({
    where: { id: patient.id },
    data: { flow: flujo as never },
  });
};

export const savePuntajeUsuario = async (
  telefono: string,
  puntaje: number,
  jsonPreg: Record<number, number[]>,
  tipoTest: string
) => {
  const patient = await ensurePatientByPhone(telefono);
  await getEvaluation(patient.id, tipoTest);
  await prisma.psychEvaluation.update({
    where: { patientId_type: { patientId: patient.id, type: tipoTest } },
    data: { totalScore: puntaje, responses: jsonPreg },
  });
};

export const getEstadoCuestionario = async (telefono: string, tipoTest: string) => {
  const patient = await ensurePatientByPhone(telefono);
  const evaluation = await getEvaluation(patient.id, tipoTest);
  return {
    Puntaje: evaluation.totalScore,
    preguntaActual: evaluation.currentQuestion,
    resPreg: (evaluation.responses as Record<number, number[]>) ?? createInitialResponses(tipoTest),
  };
};

export const getInfoCuestionario = async (telefono: string, tipoTest: string) => {
  const patient = await ensurePatientByPhone(telefono);
  const evaluation = await getEvaluation(patient.id, tipoTest);
  return {
    infoCues: {
      Puntaje: evaluation.totalScore,
      preguntaActual: evaluation.currentQuestion,
      resPreg: (evaluation.responses as Record<number, number[]>) ?? createInitialResponses(tipoTest),
    },
    preguntasString: GHQ12_QUESTIONS.join("\n"),
  };
};

export const changeTest = async (numero: string, tipoTest: string) => {
  const patient = await ensurePatientByPhone(numero);
  const updated = await prisma.patient.update({
    where: { id: patient.id },
    data: { testActual: tipoTest },
  });
  return updated.testActual;
};

export const saveEstadoCuestionario = async (
  telefono: string,
  puntaje: number,
  preguntaActual: number,
  resPreg: Record<number, number[]>,
  tipoTest: string
) => {
  const patient = await ensurePatientByPhone(telefono);
  await prisma.psychEvaluation.update({
    where: { patientId_type: { patientId: patient.id, type: tipoTest } },
    data: { totalScore: puntaje, currentQuestion: preguntaActual, responses: resPreg },
  });
};

export const actualizarDisp = async (numero: string, disp: unknown) => {
  const patient = await ensurePatientByPhone(numero);
  await prisma.patient.update({
    where: { id: patient.id },
    data: { availability: disp as never },
  });
};

export const addMotivo = async (numero: string, motivo: string) => {
  const patient = await ensurePatientByPhone(numero);
  return prisma.patient.update({
    where: { id: patient.id },
    data: { motivo },
  });
};

export const getUsuario = async (documento: string) => {
  const patient = await prisma.patient.findUnique({
    where: { documentNumber: documento },
    include: { practitioner: true },
  });
  if (!patient) return null;
  const session = await getOrCreateActiveSession(patient.id);
  return mapPatientToLegacy(patient, mapHistoryFromMessages(session.messages ?? []));
};

export const getPracticante = async (documento: string) => {
  return prisma.practitioner.findUnique({ where: { documentNumber: documento } });
};

/** Actualiza datos básicos del paciente desde el formulario web */
export const addWebUser = async (
  nombre: string,
  apellido: string,
  correo: string,
  tipoDocumento: string,
  documento: string,
  telefonoPersonal: string
) => {
  const patient = await ensurePatientByPhone(telefonoPersonal);
  return prisma.patient.update({
    where: { id: patient.id },
    data: {
      name: nombre,
      lastName: apellido,
      email: correo,
      documentType: tipoDocumento,
      documentNumber: documento,
    },
  });
};

export const citaWebCheckout = async (idCita: string) => {
  return prisma.appointment.update({
    where: { id: idCita },
    data: { status: "completada" },
  });
};

export const getWebConsultorios = async () => {
  return prisma.consultingRoom.findMany();
};

export const getWebCitas = async (diaActual: Date) => {
  const fecha = diaActual.toISOString().split("T")[0];
  const inicioDelDia = new Date(`${fecha}T00:00:00`);
  const finDelDia = new Date(`${fecha}T23:59:59.999`);

  return prisma.appointment.findMany({
    where: { scheduledAt: { gte: inicioDelDia, lte: finDelDia } },
    include: { patient: true, practitioner: true, consultingRoom: true },
    orderBy: { scheduledAt: "asc" },
  });
};

export const citasPorPaciente = async (idPaciente: string) => {
  return prisma.appointment.findMany({ where: { patientId: idPaciente } });
};
