/**
 * Flows principales del chatbot web.
 */

import { addKeyword, utils, EVENTS } from "@builderbot/bot";
import {
  obtenerUsuario,
  getInfoCuestionario,
  changeTest,
  resetearEstadoPrueba,
  switchFlujo,
  buscarPracticantePorDocumento,
  obtenerPerfilPacienteParaInforme,
} from "../../queries/queries.js";
import { enviarPdfPorCorreo }    from "../../services/email.service.js";
import { menuCuestionarios, parsearSeleccionTest } from "../assessment/controlTest.js";
import { procesarDass21 }        from "../assessment/dass21.js";
import { procesarGHQ12, GHQ12_HIGH_THRESHOLD } from "../assessment/ghq12.js";
import { obtenerRutaPdf, limpiarRutaPdf }        from "../../helpers/pdfStore.js";
import { apiAssistant1 }         from "../assist/aiAssistant.js";

// ---------------------------------------------------------------------------
// Helpers locales
// ---------------------------------------------------------------------------

const calcularEdad = (fechaNacimiento: string | null | undefined): number | null => {
  if (!fechaNacimiento) return null;
  const fecha = new Date(fechaNacimiento);
  if (isNaN(fecha.getTime())) return null;
  const hoy   = new Date();
  let edad    = hoy.getFullYear() - fecha.getFullYear();
  const mes   = hoy.getMonth() - fecha.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate())) edad--;
  return edad;
};

const validarMayorDeEdad = async (telefono: string) => {
  const usuario = await obtenerUsuario(telefono);
  const edad    = calcularEdad(usuario?.data?.fechaNacimiento ?? null);
  if (edad === null) return { permitido: false, motivo: "SIN_FECHA" };
  if (edad < 18)    return { permitido: false, motivo: "MENOR_EDAD", edad };
  return { permitido: true, motivo: null, edad };
};

const puedeHabilitarDass21 = async (telefono: string, state: Record<string, unknown>): Promise<boolean> => {
  const enState = Boolean(await (state as any).get("allowDass21")) || Boolean(await (state as any).get("recomendarDass21"));
  if (enState) return true;
  try {
    const info    = await getInfoCuestionario(telefono, "ghq12");
    const puntaje = Number(info?.infoCues?.Puntaje ?? 0);
    return Number.isFinite(puntaje) && puntaje >= GHQ12_HIGH_THRESHOLD;
  } catch { return false; }
};

async function bloquearMenorEdad(flowDynamic: (msg: string) => Promise<void>, state: any) {
  await flowDynamic(
    "❌ Por políticas del sistema, los cuestionarios psicológicos están disponibles solo para mayores de 18 años.\n\n" +
    "🔒 Acceso bloqueado por restricción de edad."
  );
  await state.update({ currentFlow: "bloqueadoMenorEdad" });
  await switchFlujo(state._phone ?? "", "bloqueadoMenorEdad");
}

// ---------------------------------------------------------------------------
// WELCOME FLOW
// Router principal — decide a dónde va cada mensaje
// ---------------------------------------------------------------------------

export const welcomeFlow = addKeyword(EVENTS.WELCOME).addAction(
  async (ctx, { gotoFlow, flowDynamic, state, endFlow }) => {
    try {
      const incomingText = String(ctx?.body ?? "").trim();
      let currentFlow    = await state.get("currentFlow");

      // Reset desde frontend
      if (incomingText === "__web_reset__") {
        await state.clear();
        await state.update({ currentFlow: null, initialized: false, user: null });
        await switchFlujo(ctx.from, "menuFlow");
        currentFlow = null;
      }

      // Flujo bloqueado
      if (currentFlow === "bloqueadoMenorEdad") {
        await flowDynamic("🔒 Tu acceso está bloqueado por restricción de edad.");
        return endFlow();
      }

      // Redirigir a flujos activos
      if (currentFlow === "test")          return gotoFlow(testFlow);
      if (currentFlow === "testSelection") return gotoFlow(testSelectionFlow);
      if (currentFlow === "menu")          return gotoFlow(menuFlow);
      if (currentFlow === "pedirDocumentoProfesional") return gotoFlow(pedirDocumentoProfesionalFlow);
      if (currentFlow === "assistant")     return gotoFlow(assistantFlow);

      // Obtener usuario (ya autenticado via JWT en el handshake WebSocket)
      const userBD = await obtenerUsuario(ctx.from);
      if (!userBD) {
        await flowDynamic("⚠️ No encontramos tu perfil. Por favor, completa el registro en la web.");
        return endFlow();
      }

      const usuarioAutenticado = {
        tipo: "usuario",
        data: userBD.data ?? userBD,
        flujo: userBD.flujo ?? "menuFlow",
      };

      await state.update({ initialized: true, user: usuarioAutenticado, _phone: ctx.from });
      return await handleUserFlow(ctx, usuarioAutenticado, state, gotoFlow);

    } catch (e) {
      console.error("[welcomeFlow] error:", e);
      return gotoFlow(menuFlow);
    }
  }
);

// ---------------------------------------------------------------------------

async function handleUserFlow(
  ctx: any,
  user: any,
  state: any,
  gotoFlow: (flow: any) => Promise<void>
) {
  switch (user.flujo) {
    case "testFlow":
      await state.update({ currentFlow: "test", justInitializedTest: true, user, testAsignadoPorPracticante: true });
      return gotoFlow(testFlow);

    case "testSelectionFlow":
      await state.update({ currentFlow: "testSelection" });
      return gotoFlow(testSelectionFlow);

    case "assistantFlow":
      await state.update({ currentFlow: "assistant" });
      return gotoFlow(assistantFlow);

    case "bloqueadoMenorEdad":
      await state.update({ currentFlow: "bloqueadoMenorEdad" });
      return;

    case "menuFlow":
    default:
      await switchFlujo(ctx.from, "menuFlow");
      await state.update({ currentFlow: "menu" });
      return gotoFlow(menuFlow);
  }
}

// ---------------------------------------------------------------------------
// MENU FLOW
// ---------------------------------------------------------------------------

export const menuFlow = addKeyword(utils.setEvent("MENU_FLOW"))
  .addAction(async (ctx, { state }) => {
    await switchFlujo(ctx.from, "menuFlow");
    await state.update({ currentFlow: "menu", _phone: ctx.from });
  })
  .addAnswer(
    "¡Hola! Soy tu asistente de bienestar psicológico. ¿En qué te puedo ayudar hoy?\n\n" +
    "🔹 *1* - Realizar cuestionarios psicológicos\n" +
    "🔹 *2* - Hablar con el asistente\n\n" +
    "Responde con el número de tu elección:",
    { capture: true, idle: 600000 },
    async (ctx, { flowDynamic, gotoFlow, fallBack, endFlow, state }) => {
      if (ctx?.idleFallBack) {
        await flowDynamic("Te demoraste en responder. Escribe cualquier cosa para empezar de nuevo.");
        return endFlow();
      }

      // Verificar si se asignó un test mientras estaba en menú
      const userBD = await obtenerUsuario(ctx.from);
      if (userBD?.flujo === "testFlow") {
        await state.update({ currentFlow: "test", justInitializedTest: true, testAsignadoPorPracticante: true, user: userBD });
        return gotoFlow(testFlow);
      }

      const msg = (ctx.body ?? "").trim();

      if (msg === "1") {
        const verificacion = await validarMayorDeEdad(ctx.from);
        if (!verificacion.permitido) {
          await bloquearMenorEdad(flowDynamic, state);
          return endFlow();
        }
        const allowDass21 = await puedeHabilitarDass21(ctx.from, state);
        await flowDynamic(menuCuestionarios(allowDass21));
        await switchFlujo(ctx.from, "testSelectionFlow");
        await state.update({ currentFlow: "testSelection", allowDass21 });
        return gotoFlow(testSelectionFlow);
      }

      if (msg === "2") {
        await state.update({ currentFlow: "assistant" });
        await switchFlujo(ctx.from, "assistantFlow");
        await flowDynamic("Hola, estoy aquí para escucharte. ¿Cómo te sientes hoy?");
        return gotoFlow(assistantFlow);
      }

      await flowDynamic("❌ Opción no válida. Responde con *1* para cuestionarios o *2* para hablar con el asistente.");
      return fallBack();
    }
  );

// ---------------------------------------------------------------------------
// TEST SELECTION FLOW
// ---------------------------------------------------------------------------

export const testSelectionFlow = addKeyword(utils.setEvent("TEST_SELECTION_FLOW"))
  .addAction(async (ctx, { state }) => {
    await state.update({ currentFlow: "testSelection", _phone: ctx.from });
  })
  .addAnswer(
    { capture: true },
    async (ctx, { flowDynamic, gotoFlow, state, fallBack, endFlow }) => {
      const allowDass21 = await puedeHabilitarDass21(ctx.from, state);
      const tipoTest    = parsearSeleccionTest(ctx.body ?? "", allowDass21);

      const verificacion = await validarMayorDeEdad(ctx.from);
      if (!verificacion.permitido) {
        await bloquearMenorEdad(flowDynamic, state);
        return endFlow();
      }

      if (!tipoTest) {
        await flowDynamic(
          allowDass21
            ? "❌ Responde con *1* para GHQ-12 o *2* para DASS-21"
            : "❌ Responde con *1* para iniciar el GHQ-12"
        );
        return fallBack();
      }

      try {
        await resetearEstadoPrueba(ctx.from, tipoTest);
        await changeTest(ctx.from, tipoTest);

        const user = (await state.get("user")) ?? {};
        user.testActual = tipoTest;

        await state.update({ user, currentFlow: "test", testActual: tipoTest, justInitializedTest: true });
        await switchFlujo(ctx.from, "testFlow");
        await flowDynamic(`✅ Iniciando cuestionario ${tipoTest === "dass21" ? "DASS-21" : "GHQ-12"}...`);
        return gotoFlow(testFlow);
      } catch (error) {
        console.error("[testSelectionFlow] error:", error);
        await flowDynamic("❌ Error iniciando el test. Regresando al menú...");
        await state.update({ currentFlow: "menu" });
        return gotoFlow(menuFlow);
      }
    }
  );

// ---------------------------------------------------------------------------
// TEST FLOW
// ---------------------------------------------------------------------------

export const testFlow = addKeyword(EVENTS.ACTION)
  .addAction(async (ctx, { flowDynamic, gotoFlow, state, endFlow }) => {
    const currentFlow    = await state.get("currentFlow");
    const justInitialized = await state.get("justInitializedTest");

    if (currentFlow !== "test") return;

    const verificacion = await validarMayorDeEdad(ctx.from);
    if (!verificacion.permitido) {
      await bloquearMenorEdad(flowDynamic, state);
      return endFlow();
    }

    let user       = await state.get("user");
    let testActual = user?.testActual ?? (await state.get("testActual"));

    if (!testActual) {
      const userBD = await obtenerUsuario(ctx.from);
      testActual   = userBD?.testActual;
    }

    if (!testActual) {
      await flowDynamic("❌ No hay test seleccionado. Volviendo al menú.");
      await state.update({ currentFlow: "menu" });
      await switchFlujo(ctx.from, "menuFlow");
      return gotoFlow(menuFlow);
    }

    if (justInitialized) {
      await state.update({ justInitializedTest: false });

      if (testActual === "dass21" && !(await puedeHabilitarDass21(ctx.from, state))) {
        await flowDynamic("⚠️ El DASS-21 se habilita cuando el GHQ-12 resulte alto. Regresando al menú.");
        await state.update({ currentFlow: "menu" });
        await switchFlujo(ctx.from, "menuFlow");
        return gotoFlow(menuFlow);
      }

      const primera = testActual === "dass21"
        ? await procesarDass21(ctx.from, null)
        : await procesarGHQ12(ctx.from, null);

      if (typeof primera === "string") {
        await flowDynamic(primera);
        await state.update({ waitingForTestResponse: true });
      }
      return;
    }

    const waiting = await state.get("waitingForTestResponse");
    if (waiting) {
      await procesarRespuestaTest(ctx, { flowDynamic, gotoFlow, state });
    }
  });

// ---------------------------------------------------------------------------
// TEST RESPONSE FLOW (captura 0,1,2,3)
// ---------------------------------------------------------------------------

export const testResponseFlow = addKeyword(["0", "1", "2", "3"])
  .addAction(async (ctx, { flowDynamic, gotoFlow, state }) => {
    const currentFlow = await state.get("currentFlow");
    const waiting     = await state.get("waitingForTestResponse");
    if (currentFlow === "test" && waiting) {
      await procesarRespuestaTest(ctx, { flowDynamic, gotoFlow, state });
    }
  });

// ---------------------------------------------------------------------------

async function procesarRespuestaTest(
  ctx: any,
  { flowDynamic, gotoFlow, state }: any
): Promise<void> {
  const user      = await state.get("user");
  const testActual = user?.testActual ?? (await state.get("testActual"));

  if (!testActual) {
    await flowDynamic("❌ Error: no hay test activo.");
    await state.update({ currentFlow: "menu", waitingForTestResponse: false });
    return gotoFlow(menuFlow);
  }

  let resultado: any;
  if (testActual === "dass21") {
    if (!(await puedeHabilitarDass21(ctx.from, state))) {
      await state.update({ currentFlow: "menu", waitingForTestResponse: false });
      return gotoFlow(menuFlow);
    }
    resultado = await procesarDass21(ctx.from, ctx.body);
  } else {
    resultado = await procesarGHQ12(ctx.from, ctx.body);
  }

  if (resultado?.error) { await flowDynamic(resultado.error); return; }

  const texto = typeof resultado === "string" ? resultado : resultado?.message;
  if (texto) await flowDynamic(texto);

  if (resultado?.completed) {
    await state.update({
      currentFlow:             "pedirDocumentoProfesional",
      justInitializedTest:     false,
      testCompletado:          testActual === "dass21" ? "DASS-21" : "GHQ-12",
      testActualCompletado:    testActual,
      recomendarDass21:        testActual === "ghq12" ? Boolean(resultado.recomendarDass21) : false,
      waitingForTestResponse:  false,
      intentosDocumento:       0,
    });
    await switchFlujo(ctx.from, "menuFlow");
    return gotoFlow(pedirDocumentoProfesionalFlow);
  }
}

// ---------------------------------------------------------------------------
// PEDIR DOCUMENTO DEL PROFESIONAL
// ---------------------------------------------------------------------------

export const pedirDocumentoProfesionalFlow = addKeyword(utils.setEvent("PEDIR_DOCUMENTO_PROFESIONAL"))
  .addAction(async (ctx, { state }) => {
    await state.update({ currentFlow: "pedirDocumentoProfesional", _phone: ctx.from });
  })
  .addAnswer(
    "📋 Para enviar el informe al profesional que te aplicó el test, ingresa su *número de documento* (cédula):",
    { capture: true, idle: 300000 },
    async (ctx, { flowDynamic, gotoFlow, state, fallBack, endFlow }) => {
      if (ctx?.idleFallBack) {
        await state.update({ currentFlow: null, intentosDocumento: 0 });
        return endFlow();
      }

      const documento = (ctx.body ?? "").trim();
      let intentos    = ((await state.get("intentosDocumento")) as number) ?? 0;

      const irAlMenu = async (msg: string) => {
        await flowDynamic(msg);
        await state.update({ currentFlow: "menu", intentosDocumento: 0, testActual: null });
        limpiarRutaPdf(ctx.from);
        await switchFlujo(ctx.from, "menuFlow");
        return gotoFlow(menuFlow);
      };

      if (!documento || documento.length < 5 || !/^\d+$/.test(documento)) {
        intentos++;
        await state.update({ intentosDocumento: intentos });
        if (intentos >= 3) return irAlMenu("❌ Se agotaron los intentos. El informe se generó pero no se pudo enviar. Regresando al menú...");
        await flowDynamic(`❌ Documento no válido. Solo números.\n\nIntentos restantes: ${3 - intentos}`);
        return fallBack();
      }

      const practicante = await buscarPracticantePorDocumento(documento);

      if (!practicante) {
        intentos++;
        await state.update({ intentosDocumento: intentos });
        if (intentos >= 3) return irAlMenu("❌ Se agotaron los intentos. No se encontró el profesional. Regresando al menú...");
        await flowDynamic(`⚠️ No se encontró un profesional con el documento *${documento}*.\nIntentos restantes: ${3 - intentos}`);
        return fallBack();
      }

      if (!practicante.correo) {
        intentos++;
        await state.update({ intentosDocumento: intentos });
        if (intentos >= 3) return irAlMenu("❌ El profesional no tiene correo registrado. Regresando al menú...");
        await flowDynamic(`⚠️ El profesional *${practicante.nombre}* no tiene correo registrado.\nIntentos restantes: ${3 - intentos}`);
        return fallBack();
      }

      await flowDynamic(`✅ Profesional encontrado: *${practicante.nombre}*\n⏳ Preparando informe...`);

      // Esperar PDF (máx. 3 min en intervalos de 5s)
      let pdfListo = obtenerRutaPdf(ctx.from);
      for (let i = 0; i < 36 && !pdfListo?.pdfPath; i++) {
        await new Promise(r => setTimeout(r, 5000));
        pdfListo = obtenerRutaPdf(ctx.from);
      }

      if (!pdfListo?.pdfPath) {
        return irAlMenu("⚠️ No se encontró el PDF del informe. Intenta de nuevo en unos segundos escribiendo *menu*.");
      }

      const testCompletado = ((await state.get("testCompletado")) as string) ?? "Test psicológico";
      const patientData    = await obtenerPerfilPacienteParaInforme(ctx.from);
      const nombrePaciente = [patientData?.nombres, patientData?.apellidos].filter(Boolean).join(" ").trim() || "No disponible";
      const docPaciente    = patientData?.documento ?? "No disponible";

      const resultadoEnvio = await enviarPdfPorCorreo(practicante.correo, pdfListo.pdfPath, {
        nombrePaciente,
        documentoPaciente: docPaciente,
        telefonoPaciente:  patientData?.telefonoPrincipal ?? ctx.from,
        testNombre:        testCompletado,
        fecha:             new Date().toLocaleString("es-CO"),
        nombrePracticante: practicante.nombre ?? "Profesional",
        semestre:          patientData?.semestre ?? null,
        jornada:           patientData?.jornada  ?? null,
        carrera:           patientData?.carrera  ?? null,
      });

      if (resultadoEnvio.success) {
        await flowDynamic(
          `✅ *Informe enviado exitosamente*\n\n📧 Enviado a: *${practicante.correo}*\n\nRegresando al menú...`
        );
        const recomendarDass21 = await state.get("recomendarDass21");
        const testActualComp   = await state.get("testActualCompletado");
        if (testActualComp === "ghq12" && recomendarDass21) {
          await flowDynamic(
            "🧠 *Recomendación clínica*\n\nCon base en el resultado del GHQ-12, se recomienda aplicar también el *DASS-21*."
          );
          await state.update({ allowDass21: true });
        }
      } else {
        await flowDynamic(`⚠️ No se pudo enviar: ${resultadoEnvio.message}\n\nRegresando al menú...`);
      }

      limpiarRutaPdf(ctx.from);
      await state.update({ currentFlow: "menu", intentosDocumento: 0, testActual: null, recomendarDass21: false });
      await switchFlujo(ctx.from, "menuFlow");
      return gotoFlow(menuFlow);
    }
  );

// ---------------------------------------------------------------------------
// ASSISTANT FLOW
// ---------------------------------------------------------------------------

export const assistantFlow = addKeyword(EVENTS.ACTION)
  .addAction(async (ctx, { flowDynamic, gotoFlow, state, endFlow }) => {
    const currentFlow = await state.get("currentFlow");
    if (currentFlow !== "assistant") return;

    try {
      const user      = await state.get("user");
      const helpStage = Number(user?.data?.helpStage ?? user?.helpStage ?? 0);

      const respuesta = await apiAssistant1(ctx.from, ctx.body ?? "", helpStage);

      if (respuesta === true) {
        // El asistente detectó que el usuario quiere ayuda psicológica
        await flowDynamic(
          "Entiendo que puedes necesitar apoyo profesional. Te recomiendo realizar nuestros cuestionarios psicológicos para orientarte mejor.\n\n" +
          "¿Deseas iniciarlos ahora?\n\n🔹 *1* - Sí, iniciar cuestionarios\n🔹 *2* - No, seguir conversando"
        );
        await state.update({ currentFlow: "menu" });
        await switchFlujo(ctx.from, "menuFlow");
        return gotoFlow(menuFlow);
      }

      if (typeof respuesta === "string" && respuesta.trim()) {
        await flowDynamic(respuesta);
      }

      // Incrementar helpStage en BD
      const newStage = helpStage + 1;
      if (user) {
        user.data = { ...(user.data ?? {}), helpStage: newStage };
        await state.update({ user });
      }
    } catch (error) {
      console.error("[assistantFlow] error:", error);
      await flowDynamic("⚠️ Hubo un error. Por favor, escribe de nuevo.");
    }
  });
