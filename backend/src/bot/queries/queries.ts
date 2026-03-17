import { format } from "@formkit/tempo";
import { apiHorarios } from "../flows/agend/aiHorarios.js";
import { prisma } from "../../database/prisma.js";

const preguntas = [
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
  "12. ¿Se siente razonablemente feliz considerando todas las circunstancias?\n    0) Más feliz que lo habitual.\n    1) Igual que lo habitual.\n    2) Menos feliz que lo habitual.\n    3) Mucho menos feliz que lo habitual."
];

const RESPONSE_TEMPLATES = {
  ghq12: { 0: [], 1: [], 2: [], 3: [] },
  dep: { 0: [], 1: [], 2: [], 3: [] },
  ans: { 0: [], 1: [], 2: [], 3: [] },
  estr: { 0: [], 1: [], 2: [], 3: [], 4: [] },
  suic: { 0: [], 1: [], 2: [] },
  calvida: { 1: [], 2: [], 3: [], 4: [], 5: [] }
};

const senderToRole = {
  paciente: "user",
  ia: "assistant",
  sistema: "system"
};

function createInitialResponses(tipoTest) {
  return JSON.parse(JSON.stringify(RESPONSE_TEMPLATES[tipoTest] ?? { 0: [], 1: [], 2: [], 3: [] }));
}

function mapHistoryFromMessages(messages) {
  return messages.map((message) => ({
    role: senderToRole[message.sender] ?? "system",
    content: message.body
  }));
}

function mapHistoryToMessages(history) {
  return history.map((entry, index) => ({
    sender: entry.role === "user" ? "paciente" : entry.role === "assistant" ? "ia" : "sistema",
    body: typeof entry.content === "string" ? entry.content : JSON.stringify(entry.content),
    metadata: null,
    sentAt: new Date(Date.now() + index)
  }));
}

async function ensurePatientByPhone(phone) {
  let patient = await prisma.patient.findUnique({ where: { whatsappNumber: phone } });
  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        whatsappNumber: phone,
        availability: {}
      }
    });
  }
  return patient;
}

async function getPatientWithRelations(phone) {
  const patient = await ensurePatientByPhone(phone);
  return prisma.patient.findUnique({
    where: { id: patient.id },
    include: {
      practitioner: true
    }
  });
}

async function getOrCreateActiveSession(patientId) {
  let session = await prisma.chatSession.findFirst({
    where: { patientId, endedAt: null },
    include: { messages: { orderBy: { sentAt: "asc" } } }
  });

  if (!session) {
    session = await prisma.chatSession.create({
      data: { patientId },
      include: { messages: { orderBy: { sentAt: "asc" } } }
    });
  }

  return session;
}

function mapPatientToLegacy(patient, history) {
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
      ? {
          id: patient.practitioner.id,
          nombre: patient.practitioner.name
        }
      : null
  };
}

async function loadLegacyPatient(phone) {
  const patient = await getPatientWithRelations(phone);
  const session = await getOrCreateActiveSession(patient.id);
  const historial = mapHistoryFromMessages(session.messages ?? []);
  return mapPatientToLegacy(patient, historial);
}

export const registrarUsuario = async (nombre, apellido, correo, tipoDocumento, documento, numero) => {
  const patient = await ensurePatientByPhone(numero);
  await prisma.patient.update({
    where: { id: patient.id },
    data: {
      name: nombre,
      lastName: apellido,
      email: correo,
      documentType: tipoDocumento,
      documentNumber: documento,
      state: "registrado"
    }
  });
  return loadLegacyPatient(numero);
};

export const obtenerUsuario = async (numero) => {
  return loadLegacyPatient(numero);
};

export const obtenerHist = async (numero) => {
  const patient = await ensurePatientByPhone(numero);
  const session = await getOrCreateActiveSession(patient.id);
  return mapHistoryFromMessages(session.messages ?? []);
};

export const saveHist = async (numero, historial) => {
  const patient = await ensurePatientByPhone(numero);
  const session = await getOrCreateActiveSession(patient.id);
  await prisma.chatMessage.deleteMany({ where: { sessionId: session.id } });
  const data = mapHistoryToMessages(historial).map((entry) => ({ ...entry, sessionId: session.id }));
  if (data.length) {
    await prisma.chatMessage.createMany({ data });
  }
};

export const switchAyudaPsicologica = async (numero, opcion) => {
  const patient = await ensurePatientByPhone(numero);
  await prisma.patient.update({
    where: { id: patient.id },
    data: { helpStage: opcion }
  });
};

export const switchFlujo = async (numero, flujo) => {
  const patient = await ensurePatientByPhone(numero);
  await prisma.patient.update({
    where: { id: patient.id },
    data: { flow: flujo }
  });
};

async function getEvaluation(patientId, tipoTest) {
  const template = createInitialResponses(tipoTest);
  const evaluation = await prisma.psychEvaluation.upsert({
    where: {
      patientId_type: {
        patientId,
        type: tipoTest
      }
    },
    update: {},
    create: {
      patientId,
      type: tipoTest,
      responses: template
    }
  });
  return evaluation;
}

export const savePuntajeUsuario = async (telefono, puntaje, jsonPreg, tipoTest) => {
  const patient = await ensurePatientByPhone(telefono);
  await getEvaluation(patient.id, tipoTest);
  await prisma.psychEvaluation.update({
    where: {
      patientId_type: {
        patientId: patient.id,
        type: tipoTest
      }
    },
    data: {
      totalScore: puntaje,
      responses: jsonPreg
    }
  });
};

export const getEstadoCuestionario = async (telefono, tipoTest) => {
  const patient = await ensurePatientByPhone(telefono);
  const evaluation = await getEvaluation(patient.id, tipoTest);
  return {
    Puntaje: evaluation.totalScore,
    preguntaActual: evaluation.currentQuestion,
    resPreg: evaluation.responses ?? createInitialResponses(tipoTest)
  };
};

export const getInfoCuestionario = async (telefono, tipoTest) => {
  const patient = await ensurePatientByPhone(telefono);
  const evaluation = await getEvaluation(patient.id, tipoTest);
  return {
    infoCues: {
      Puntaje: evaluation.totalScore,
      preguntaActual: evaluation.currentQuestion,
      resPreg: evaluation.responses ?? createInitialResponses(tipoTest)
    },
    preguntasString: preguntas.join("\n")
  };
};

export const changeTest = async (numero, tipoTest) => {
  const patient = await ensurePatientByPhone(numero);
  const updated = await prisma.patient.update({
    where: { id: patient.id },
    data: { testActual: tipoTest }
  });
  return updated.testActual;
};

export const saveEstadoCuestionario = async (telefono, puntaje, preguntaActual, resPreg, tipoTest) => {
  const patient = await ensurePatientByPhone(telefono);
  await prisma.psychEvaluation.update({
    where: {
      patientId_type: {
        patientId: patient.id,
        type: tipoTest
      }
    },
    data: {
      totalScore: puntaje,
      currentQuestion: preguntaActual,
      responses: resPreg
    }
  });
};

export const actualizarDisp = async (numero, disp) => {
  const patient = await ensurePatientByPhone(numero);
  await prisma.patient.update({
    where: { id: patient.id },
    data: { availability: disp }
  });
};

export const getUsuario = async (documento) => {
  const patient = await prisma.patient.findUnique({
    where: { documentNumber: documento },
    include: { practitioner: true }
  });
  if (!patient) return null;
  const session = await getOrCreateActiveSession(patient.id);
  return mapPatientToLegacy(patient, mapHistoryFromMessages(session.messages ?? []));
};

export const getPracticante = async (documento) => {
  return prisma.practitioner.findUnique({
    where: { documentNumber: documento }
  });
};

export const addWebUser = async (nombre, apellido, correo, tipoDocumento, documento, telefonoPersonal) => {
  const patient = await ensurePatientByPhone(telefonoPersonal);
  return prisma.patient.update({
    where: { id: patient.id },
    data: {
      name: nombre,
      lastName: apellido,
      email: correo,
      documentType: tipoDocumento,
      documentNumber: documento
    }
  });
};

export const addWebPracticante = async (nombre, documento, tipoDocumento, genero, estrato, barrio, localidad, horario) => {
  const parsedHorario = await apiHorarios(horario);
  return prisma.practitioner.create({
    data: {
      name: nombre,
      documentNumber: documento,
      documentType: tipoDocumento,
      gender: genero,
      estrato,
      barrio,
      localidad,
      schedule: parsedHorario
    }
  });
};

export const editWebUser = async (nombre, apellido, correo, tipoDocumento, documento, telefonoPersonal) => {
  const patient = await ensurePatientByPhone(telefonoPersonal);
  return prisma.patient.update({
    where: { id: patient.id },
    data: {
      name: nombre,
      lastName: apellido,
      email: correo,
      documentType: tipoDocumento,
      documentNumber: documento
    }
  });
};

export const editWebPracticante = async (
  nombre,
  documento,
  tipoDocumento,
  genero,
  estrato,
  barrio,
  localidad,
  horario
) => {
  return prisma.practitioner.update({
    where: { documentNumber: documento },
    data: {
      name: nombre,
      documentType: tipoDocumento,
      gender: genero,
      estrato,
      barrio,
      localidad,
      schedule: horario ?? {}
    }
  });
};

export const citaWebCheckout = async (idCita) => {
  return prisma.appointment.update({
    where: { id: idCita },
    data: { status: "completada" }
  });
};

export const getWebConsultorios = async () => {
  return prisma.consultingRoom.findMany();
};

export const ChangeWebConsultorio = async (idConsultorio) => {
  return prisma.consultingRoom.update({
    where: { id: idConsultorio },
    data: { active: false }
  });
};

export const getWebCitas = async (diaActual) => {
  const fechaFormateada = format(diaActual, "YYYY-MM-DD");
  const inicioDelDia = new Date(`${fechaFormateada}T00:00:00`);
  const finDelDia = new Date(`${fechaFormateada}T23:59:59.999`);

  return prisma.appointment.findMany({
    where: {
      scheduledAt: {
        gte: inicioDelDia,
        lte: finDelDia
      }
    },
    include: {
      patient: true,
      practitioner: true,
      consultingRoom: true
    },
    orderBy: { scheduledAt: "asc" }
  });
};

export const citasPorPaciente = async (idPaciente) => {
  return prisma.appointment.findMany({
    where: { patientId: idPaciente }
  });
};

export const addMotivo = async (numero, motivo) => {
  const patient = await ensurePatientByPhone(numero);
  return prisma.patient.update({
    where: { id: patient.id },
    data: { motivo }
  });
};

export const getCita = async (idPaciente) => {
  return prisma.appointment.findFirst({
    where: { patientId: idPaciente },
    include: {
      patient: true,
      practitioner: true,
      consultingRoom: true
    },
    orderBy: { scheduledAt: "asc" }
  });
};
