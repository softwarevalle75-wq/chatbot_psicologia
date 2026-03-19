//---------------------------------------------------------------------------------------------------------

import { addKeyword, utils, EVENTS } from '@builderbot/bot'
import fs from 'node:fs'
import path from 'node:path'
import {
  obtenerUsuario,
  getInfoCuestionario,
  changeTest,
  resetearEstadoPrueba,
  switchFlujo,
  //switchAyudaPsicologica,
  guardarPracticanteAsignado,
  perteneceUniversidad,
  verificarRolUsuario,
  buscarPracticantePorDocumento,
  obtenerPerfilPacienteParaInforme,
} from '../queries/queries.js'
import { enviarPdfPorCorreo } from '../helpers/emailHelper.js'
import { menuCuestionarios, parsearSeleccionTest } from './tests/controlTest.js'

import { procesarDass21 } from './tests/dass21.js'
import { procesarGHQ12 } from './tests/ghq12.js'
// Importar el helper al inicio del archivo
import { verificarAutenticacionWeb } from '../helpers/autenticarUsuario.js';
import { adminMenuFlow } from './roles/adminMenuFlow.js'

import { practMenuFlow, practEsperarResultados } from './roles/practMenuFlow.js'
import { completarPerfilPracticanteFlow } from './roles/cambioRolFlow.js'
import {
  buscarPracticanteDisponible,
  guardarCita,
  formatearMensajeCita,
  formatearHorariosDisponibles
} from '../helpers/agendHelper.js';
import { obtenerRutaPdf, limpiarRutaPdf } from '../helpers/pdfStore.js'
import prisma from '../lib/prisma.js'
export { prisma }
//---------------------------------------------------------------------------------------------------------

const ensureTempDir = () => {
  const tempDir = path.resolve(process.cwd(), 'temp')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  return tempDir
}

const recuperarPdfDesdeBD = async (telefono, testIdPreferido) => {
  const candidatos = testIdPreferido ? [testIdPreferido] : ['dass21', 'ghq12']

  for (const tipo of candidatos) {
    const modelo = tipo === 'dass21' ? prisma.dass21 : prisma.ghq12
    const registro = await modelo.findUnique({
      where: { telefono },
      select: {
        informePdf: true,
        informePdfNombre: true,
      },
    })

    if (!registro?.informePdf) continue

    const nombreArchivo = registro.informePdfNombre || `informe_${tipo}_${telefono}.pdf`
    const tempDir = ensureTempDir()
    const filePath = path.join(tempDir, nombreArchivo)

    fs.writeFileSync(filePath, Buffer.from(registro.informePdf))
    return { pdfPath: filePath, testId: tipo, fecha: new Date() }
  }

  return null
}

const calcularEdad = (fechaNacimiento) => {
  if (!fechaNacimiento) return null;
  const fecha = new Date(fechaNacimiento);
  if (Number.isNaN(fecha.getTime())) return null;

  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  const mes = hoy.getMonth() - fecha.getMonth();

  if (mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate())) {
    edad -= 1;
  }

  return edad;
};

const validarMayorDeEdad = async (telefono) => {
  const usuario = await obtenerUsuario(telefono);
  const fechaNacimiento = usuario?.data?.fechaNacimiento;
  const edad = calcularEdad(fechaNacimiento);

  if (edad === null) {
    return { permitido: false, motivo: 'SIN_FECHA', edad: null };
  }

  if (edad < 18) {
    return { permitido: false, motivo: 'MENOR_EDAD', edad };
  }

  return { permitido: true, motivo: null, edad };
};

const mensajeBloqueoEdad =
  '❌ Por políticas del sistema, los cuestionarios psicológicos están disponibles solo para mayores de 18 años.';

const GHQ12_HIGH_THRESHOLD = Number(process.env.GHQ12_HIGH_THRESHOLD || 12);

const puedeHabilitarDass21 = async (telefono, state) => {
  const recomendadoEnEstado = Boolean(await state.get('allowDass21')) || Boolean(await state.get('recomendarDass21'));
  if (recomendadoEnEstado) return true;

  try {
    const info = await getInfoCuestionario(telefono, 'ghq12');
    const puntaje = Number(info?.infoCues?.Puntaje || 0);
    return Number.isFinite(puntaje) && puntaje >= GHQ12_HIGH_THRESHOLD;
  } catch (error) {
    console.log('⚠️ No se pudo validar habilitación DASS-21 por puntaje GHQ-12:', error?.message || error);
    return false;
  }
};

const bloquearAccesoPorMenorEdad = async (ctx, state, flowDynamic) => {
  await flowDynamic(`${mensajeBloqueoEdad}\n\n🔒 Acceso al chatbot bloqueado por restricción de edad.`);
  await state.update({
    currentFlow: 'bloqueadoMenorEdad',
    waitingForTestResponse: false,
    justInitializedTest: false,
    initialized: false,
    testActual: null,
  });
  await switchFlujo(ctx.from, 'bloqueadoMenorEdad');
};


export const welcomeFlow = addKeyword(EVENTS.WELCOME).addAction(
  async (ctx, { gotoFlow, flowDynamic, state, endFlow }) => {
    try {
      const incomingText = String(ctx?.body || '').trim();

      if (incomingText === '__web_reset__') {
        await state.clear();
        await state.update({
          currentFlow: null,
          waitingForTestResponse: false,
          justInitializedTest: false,
          initialized: false,
          testActual: null,
          user: null,
        });
        await switchFlujo(ctx.from, 'menuFlow');
      }

      // console.log('🔍 ===== DEBUG CTX COMPLETO =====')
      // console.log('ctx.from:', ctx.from)
      // console.log('ctx.key:', JSON.stringify(ctx.key, null, 2))
      // console.log('🔍 ==============================')

      // 1. VERIFICAR FLUJOS ACTIVOS CRÍTICOS (prioridad máxima)
      let currentFlow = await state.get('currentFlow');

      if (currentFlow === 'bloqueadoMenorEdad') {
        await flowDynamic('🔒 Tu acceso está bloqueado por restricción de edad.');
        return endFlow();
      }

      // ⚠️ DETECCIÓN DE CAMBIO DE ROL EN TIEMPO REAL
      // Si el usuario está en un flujo activo, verificar si un admin le cambió el rol.
      // Si el rol cambió, limpiar el state para sacarlo de su flujo actual y re-evaluar.
      let _rolInfoCache = null; // Cache para evitar doble consulta a BD
      if (currentFlow && currentFlow !== 'completandoDatos') {
        _rolInfoCache = await verificarRolUsuario(ctx.from);
        const userEnState = await state.get('user');
        const rolEnState = userEnState?.data?.rol || userEnState?.tipo;

        if (_rolInfoCache && rolEnState && _rolInfoCache.rol !== rolEnState) {
          console.log(`🔄 ¡ROL CAMBIÓ! State: ${rolEnState} → BD: ${_rolInfoCache.rol}. Limpiando flujo actual (${currentFlow}).`);
          await state.update({ currentFlow: null, user: null, initialized: false });
          currentFlow = null;
          // Continuar ejecución para que se re-evalúe el rol abajo
        }
      }

      if (currentFlow === 'test') {
        console.log('🔀 Redirigiendo mensaje de test a testFlow');
        return gotoFlow(testFlow);
      }
      if (currentFlow === 'testSelection') {
        console.log('🔀 Redirigiendo mensaje a testSelectionFlow');
        return gotoFlow(testSelectionFlow);
      }
      if (currentFlow === 'menu') {
        const userBD = await obtenerUsuario(ctx.from);
        if (userBD?.flujo === 'testFlow') {
          console.log('🔀 Prueba asignada mientras estaba en menú — redirigiendo a testFlow');
          await state.update({ currentFlow: null });
          // continúa hacia handleUserFlow que detecta testFlow en BD
        } else {
          console.log('🔀 Usuario en menú, redirigiendo a menuFlow');
          await state.update({ currentFlow: 'menu' });
          return gotoFlow(menuFlow);
        }
      }
      if (currentFlow === 'esDeUniversidad') {
        console.log('🔀 Usuario registrando datos universitarios, redirigiendo a esDeUniversidadFlow')
        await state.update({ currentFlow: 'esDeUniversidad' })
        return gotoFlow(esDeUniversidadFlow)
      }
      if (currentFlow === 'agendConfirmarRespuesta') {
        console.log('🔀 Usuario confirmando cita, redirigiendo a agendFlow')
        return gotoFlow(agendFlow)
      }
      if (currentFlow === 'pedirDocumentoProfesional') {
        console.log('🔀 Usuario ingresando documento del profesional')
        return gotoFlow(pedirDocumentoProfesionalFlow)
      }
      if (currentFlow === 'completandoDatos') {
        console.log('🔀 Practicante completando datos, redirigiendo a completarPerfilPracticanteFlow')
        return gotoFlow(completarPerfilPracticanteFlow)
      }

      // 2. ⭐ NUEVO: VERIFICAR SI ES PRACTICANTE/ADMIN PRIMERO (ANTES DE AUTENTICAR)
      if (currentFlow && currentFlow.startsWith('admin')) {
        // Si ya está en cualquiera de los flujos admin (menu, edición, asignación), no interferir.
        console.log(`🔀 Usuario en flujo admin (${currentFlow}), no redirigir.`);
        return;
      }

      // Reutilizar cache si ya consultamos el rol en la detección de cambio
      const rolInfo = _rolInfoCache || await verificarRolUsuario(ctx.from);

      if (rolInfo) {
        // ===== PRACTICANTE =====
        if (rolInfo.rol === 'practicante') {
          console.log('🔑 Practicante detectado -> Enviando a flujo de practicantes SIN autenticación');

          const practicanteCompleto = await prisma.practicante.findUnique({
            where: { telefono: rolInfo.telefono },
            select: {
              idPracticante: true,
              nombre: true,
              telefono: true,
            }
          });

          // Verificar si el practicante existe realmente en la tabla
          if (!practicanteCompleto) {
            console.log(`⚠️ Practicante con teléfono ${ctx.from} no encontrado en tabla practicante - redirigiendo a completar datos`);

            await flowDynamic(
              '📋 *Tu perfil de practicante no está completo*\n\n' +
              'Necesitamos recopilar algunos datos adicionales para activar tu perfil.\n\n' +
              'Vamos a empezar con los datos básicos.'
            );

            await state.update({
              currentFlow: 'completandoDatos',
              cambioRol: { telefono: ctx.from, nuevoRol: 'practicante' }
            });
            return gotoFlow(completarPerfilPracticanteFlow);
          }

          const usuarioPracticante = {
            tipo: 'practicante',
            data: {
              idPracticante: practicanteCompleto.idPracticante, // Ahora siempre existe
              nombre: practicanteCompleto.nombre || 'Sin nombre',
              telefono: ctx.from,
              rol: 'practicante'
            },
            flujo: 'practMenuFlow'
          };

          console.log('👨‍⚕️ Practicante encontrado:', JSON.stringify(usuarioPracticante, null, 2));

          await state.update({
            initialized: true,
            user: usuarioPracticante
          });

          return await handlePracticanteFlow(ctx, usuarioPracticante, state, gotoFlow, flowDynamic);
        }

        // ===== ADMINISTRADOR =====
        if (rolInfo.rol === 'admin') {
          // Solo redirigir al menú si no estamos ya en un flujo administrativo
          if (currentFlow && currentFlow.startsWith('admin')) {
            console.log(`🔀 Admin ya en flujo (${currentFlow}), ignorando redirección de welcomeFlow.`);
            return;
          }

          console.log('👑 Administrador detectado -> Enviando a flujo de admin SIN autenticación');
          const usuarioAdmin = {
            tipo: 'admin',
            data: {
              telefono: ctx.from,
              rol: 'admin',
              nombre: 'Administrador'
            },
            flujo: 'adminMenuFlow'
          };

          await state.update({
            initialized: true,
            user: usuarioAdmin,
            currentFlow: 'admin_menu'
          });

          console.log('🔀 Redirigiendo a adminMenuFlow...');
          return gotoFlow(adminMenuFlow);
        }
      }

      // 3. VERIFICAR AUTENTICACIÓN WEB SOLO PARA USUARIOS NORMALES      
      const authUser = await verificarAutenticacionWeb(ctx.from, flowDynamic);
      if (!authUser) return; // Si no está autenticado, parar aquí

      // 4. CREAR OBJETO USER CON DATOS AUTENTICADOS
      const usuarioAutenticado = {
        tipo: 'usuario',
        data: authUser,
        flujo: authUser.flujo || 'menuFlow'
      };
      console.log('👤 Usuario autenticado:', usuarioAutenticado);

      // 5. ACTUALIZAR ESTADO CON USUARIO
      await state.update({ initialized: true, user: usuarioAutenticado });

      // 6. Si pertenece a la universidad, pedir datos académicos solo si faltan
      const esUniversitario = String(authUser.perteneceUniversidad || '').trim().toLowerCase() === 'si'
      const faltanDatosAcademicos = !authUser.carrera || !authUser.jornada || !authUser.semestre

      if (esUniversitario && faltanDatosAcademicos) {
        console.log(`${ctx.from} pertenece a la Universitaria y tiene datos académicos incompletos`)

        await switchFlujo(ctx.from, 'esDeUniversidadFlow');
        await state.update({ currentFlow: 'esDeUniversidad' })
        return gotoFlow(esDeUniversidadFlow)
      }

      // 7. MANEJAR USUARIOS NORMALES - SIEMPRE AL MENÚ (ya están autenticados)
      return await handleUserFlow(ctx, usuarioAutenticado, state, gotoFlow)
      // console.log('✅ Usuario autenticado -> menuFlow');
      // await switchFlujo(ctx.from, 'menuFlow');
      // await state.update({ currentFlow: 'menu' });
      // return gotoFlow(menuFlow);

    } catch (e) {
      console.error('❌ welcomeFlow error:', e);
      return gotoFlow(menuFlow);
    }
  }
);

//--------------------------------------------------------------------------------------------------------------
// Función auxiliar para manejar flujo de practicantes
//--------------------------------------------------------------------------------------------------------------

async function handlePracticanteFlow(ctx, user, state, gotoFlow) {
  const esperandoResultados = await state.get('esperandoResultados');
  const currentFlow = await state.get('currentFlow');

  if (esperandoResultados || currentFlow === 'esperandoResultados') {
    // Verificar en BD si el test ya terminó antes de regresar al loop.
    // notificarTestCompletadoAPracticante actualiza practicante.flujo a 'practMenuFlow'
    // cuando el paciente termina — esa es la señal de salida.
    const pract = await prisma.practicante.findUnique({
      where: { telefono: ctx.from },
      select: { flujo: true },
    });

    if (pract?.flujo === 'practMenuFlow') {
      console.log('✅ Test completado (handlePracticanteFlow) — liberando al menú');
      await state.update({ currentFlow: 'practicante', esperandoResultados: false });
      return gotoFlow(practMenuFlow);
    }

    console.log('⏳ Practicante esperando resultados...');
    return gotoFlow(practEsperarResultados);
  }

  console.log('🔑 Practicante detectado -> practMenuFlow');
  await state.update({ currentFlow: 'practicante' });
  return gotoFlow(practMenuFlow);
}

//--------------------------------------------------------------------------------------------------------------
// Función auxiliar para manejar flujo de usuarios normales
//--------------------------------------------------------------------------------------------------------------


async function handleUserFlow(ctx, user, state, gotoFlow) {
  console.log('📋 Flujo BD:', user.flujo);

  switch (user.flujo) {
    // case 'register':
    //   console.log('📝 Usuario en registro -> registerFlow');
    //   await state.update({ currentFlow: 'register' });
    //   return gotoFlow(registerFlow);

    // case 'consentimiento_rechazado':
    //   console.log('❌ Usuario rechazó consentimiento -> reconsentFlow');
    //   return gotoFlow(reconsentFlow);

    case 'menuFlow':
      console.log('📋 -> menuFlow');
      await state.update({ currentFlow: 'menu' });
      return gotoFlow(menuFlow);

    case 'testFlow':
      if (await state.get('currentFlow') !== 'test') {
        console.log('📝 -> testFlow (desde welcomeFlow)');
        await state.update({
          currentFlow: 'test',
          justInitializedTest: true,
          user: user,
          testAsignadoPorPracticante: true
        });
        return gotoFlow(testFlow);
      } else {
        console.log('🔄 Ya estamos en testFlow, no redirigir');
        return;
      }

    case 'agendFlow':
      console.log('📅 -> agendFlow');
      await state.update({ currentFlow: 'agenda' });
      return gotoFlow(agendFlow);

    case 'testSelectionFlow':
      if (await state.get('currentFlow') !== 'testSelection') {
        console.log('🎯 -> testSelectionFlow');
        await state.update({ currentFlow: 'testSelection' });
        return gotoFlow(testSelectionFlow);
      } else {
        console.log('🔄 Ya estamos en testSelectionFlow, no redirigir');
        return;
      }

    case 'bloqueadoMenorEdad':
      await state.update({ currentFlow: 'bloqueadoMenorEdad' });
      return;

    default:
      console.log('❓ Flujo por defecto -> menuFlow');
      await switchFlujo(ctx.from, 'menuFlow');
      await state.update({ currentFlow: 'menu' });
      return gotoFlow(menuFlow);
  }
}

// ========================================
// TESTFLOW CORREGIDO - CON KEYWORD ESPECÍFICO
// ========================================

export const testFlow = addKeyword(EVENTS.ACTION)
  .addAction(async (ctx, { flowDynamic, gotoFlow, state, endFlow }) => {
    // 🔥 CONFIGURACIÓN INICIAL DEL TEST
    let user = state.get('user');
    const justInitialized = state.get('justInitializedTest');
    const testActualFromState = state.get('testActual');
    const currentFlow = state.get('currentFlow');

    console.log('🔥 TESTFLOW INIT - Current flow:', currentFlow);
    console.log('🔥 TESTFLOW INIT - Just initialized:', justInitialized);

    if (currentFlow !== 'test') {
      console.log('🚫 testFlow ejecutado fuera de contexto');
      return;
    }

    const verificacionEdad = await validarMayorDeEdad(ctx.from);
    if (!verificacionEdad.permitido) {
      await bloquearAccesoPorMenorEdad(ctx, state, flowDynamic);
      return endFlow();
    }

    // Obtener test actual
    let testActual = user?.testActual || testActualFromState;
    if (!testActual) {
      const userFromDB = await obtenerUsuario(ctx.from);
      testActual = userFromDB?.testActual;
    }

    if (!testActual) {
      console.log('❌ No hay test seleccionado');
      await flowDynamic('❌ No hay un test seleccionado. Volviendo al menú.');
      await state.update({ currentFlow: 'menu', justInitializedTest: false });
      await switchFlujo(ctx.from, 'menuFlow'); // DESCOMENTADO - ahora funciona
      return gotoFlow(menuFlow);
    }

    // Actualizar estado
    if (!user?.testActual) {
      user = user || {};
      user.testActual = testActual;
      await state.update({ user: user });
    }

    // 🔥 ENVIAR PRIMERA PREGUNTA SOLO SI ES NECESARIO
    if (justInitialized) {
      console.log('🚀 Enviando primera pregunta del test');
      await state.update({ justInitializedTest: false });

      let primeraPregunta;
      if (testActual === 'dass21') {
        const allowDass21 = await puedeHabilitarDass21(ctx.from, state);
        if (!allowDass21) {
          await flowDynamic('⚠️ El DASS-21 se habilita solo cuando el GHQ-12 resulte alto. Regresando al menú.');
          await state.update({ currentFlow: 'menu', waitingForTestResponse: false, justInitializedTest: false });
          await switchFlujo(ctx.from, 'menuFlow');
          return gotoFlow(menuFlow);
        }
        primeraPregunta = await procesarDass21(ctx.from, null);
      } else {
        primeraPregunta = await procesarGHQ12(ctx.from, null);
      }

      if (typeof primeraPregunta === 'string' && primeraPregunta.trim()) {
        console.log('📤 Primera pregunta enviada');
        await flowDynamic(primeraPregunta);

        // 🔥 CONFIGURAR LISTENER PARA CUALQUIER MENSAJE
        await state.update({ waitingForTestResponse: true });
      }
      return;
    }

    // 🔥 PROCESAR RESPUESTAS SI LLEGAMOS AQUÍ DIRECTAMENTE
    const waitingForResponse = await state.get('waitingForTestResponse');
    if (waitingForResponse) {
      console.log('🔄 Procesando respuesta directa:', ctx.body);
      await procesarRespuestaTest(ctx, { flowDynamic, gotoFlow, state });
    }
  });

// ========================================
// TESTFLOW CON CAPTURA UNIVERSAL
// ========================================

export const testResponseFlow = addKeyword(['0', '1', '2', '3'])
  .addAction(async (ctx, { flowDynamic, gotoFlow, state }) => {
    const currentFlow = await state.get('currentFlow');
    const waitingForResponse = await state.get('waitingForTestResponse');

    console.log('🔥 TESTRESPONSE - Flow:', currentFlow, 'Waiting:', waitingForResponse);

    if (currentFlow === 'test' && waitingForResponse) {
      console.log('🔄 Procesando respuesta de test:', ctx.body);
      await procesarRespuestaTest(ctx, { flowDynamic, gotoFlow, state });
    }
  });


export const procesarRespuestaTest = async (ctx, { flowDynamic, gotoFlow, state, provider }) => {
  const user = state.get('user');
  const testActual = user?.testActual || state.get('testActual');

  if (!testActual) {
    console.log('❌ No hay test en curso');
    await flowDynamic('❌ Error: no hay test activo.');
    await state.update({ currentFlow: 'menu', waitingForTestResponse: false });
    return gotoFlow(menuFlow);
  }

  let resultado;
  if (testActual === 'dass21') {
    const allowDass21 = await puedeHabilitarDass21(ctx.from, state);
    if (!allowDass21) {
      await flowDynamic('⚠️ El DASS-21 se habilita solo cuando el GHQ-12 resulte alto. Regresando al menú.');
      await state.update({ currentFlow: 'menu', waitingForTestResponse: false, justInitializedTest: false });
      await switchFlujo(ctx.from, 'menuFlow');
      return gotoFlow(menuFlow);
    }
    resultado = await procesarDass21(ctx.from, ctx.body, provider);
  } else {
    resultado = await procesarGHQ12(ctx.from, ctx.body, provider);
  }

  if (resultado?.error) {
    await flowDynamic(resultado.error);
    return;
  }

  const respuestaTexto = typeof resultado === 'string' ? resultado : resultado?.message;

  if (typeof respuestaTexto === 'string') {
    await flowDynamic(respuestaTexto);

    if (resultado?.completed || respuestaTexto.includes('completada')) {
      console.log('🎉 Test completado, redirigiendo a pedir documento del profesional');
      await state.update({
        user: user,
        currentFlow: 'pedirDocumentoProfesional',
        justInitializedTest: false,
        testCompletado: testActual === 'dass21' ? 'DASS-21' : 'GHQ-12',
        testActualCompletado: testActual,
        recomendarDass21: testActual === 'ghq12' ? Boolean(resultado?.recomendarDass21) : false,
        waitingForTestResponse: false,
        intentosDocumento: 0,
      });
      await switchFlujo(ctx.from, 'menuFlow');
      return gotoFlow(pedirDocumentoProfesionalFlow);
    }
  }
}

//--------------------------------------------------------------------------------

export const testSelectionFlow = addKeyword(utils.setEvent('TEST_SELECTION_FLOW'))
  .addAction(async (ctx, { state }) => {
    await state.update({ currentFlow: 'testSelection' });
    console.log('🟢 TEST_SELECTION_FLOW: Inicializado para:', ctx.from);
  })
  .addAnswer(
    // 'Selecciona el cuestionario que deseas realizar:\n\n' +
    // '🔹 *1* - GHQ-12 (Cuestionario de Salud General)\n' +
    // '🔹 *2* - DASS-21 (Depresión, Ansiedad y Estrés)\n\n' +
    // 'Responde con *1* o *2*:',
    { capture: true },
    async (ctx, { flowDynamic, gotoFlow, state, fallBack, endFlow }) => {
      const user = state.get('user') || {};
      const msg = ctx.body.trim();
      const allowDass21 = await puedeHabilitarDass21(ctx.from, state);
      const tipoTest = parsearSeleccionTest(msg, allowDass21);

      const verificacionEdad = await validarMayorDeEdad(ctx.from);
      if (!verificacionEdad.permitido) {
        await bloquearAccesoPorMenorEdad(ctx, state, flowDynamic);
        return endFlow();
      }

      // Ya no se requiere practicante asignado para iniciar pruebas

      if (!tipoTest) {
        const errorSeleccion = allowDass21
          ? '❌ Por favor, responde con *1* para GHQ-12 o *2* para DASS-21'
          : '❌ Por favor, responde con *1* para iniciar el GHQ-12';
        await flowDynamic(errorSeleccion);
        return fallBack();
      }

      const testName = tipoTest === 'dass21' ? 'DASS-21' : 'GHQ-12';

      try {
        console.log('🔧 Configurando test:', tipoTest);

        // Resetear estado prueba
        await resetearEstadoPrueba(ctx.from, tipoTest)

        // Configurar test en BD
        await changeTest(ctx.from, tipoTest);

        // Actualizar estados
        user.testActual = tipoTest;
        await state.update({
          user: user,
          currentFlow: 'test',
          testActual: tipoTest,
          justInitializedTest: true
        });

        // Cambiar flujo en BD
        await switchFlujo(ctx.from, 'testFlow');

        await flowDynamic(`✅ Iniciando cuestionario ${testName}...`);
        console.log('🚀 Redirigiendo a testFlow con bandera activa');

        return gotoFlow(testFlow);

      } catch (error) {
        console.error('❌ Error en testSelectionFlow:', error);
        await flowDynamic('❌ Error. Regresando al menú...');
        await state.update({ currentFlow: 'menu' });
        return gotoFlow(menuFlow);
      }
    }
  );

//---------------------------------------------------------------------------------------------------------

// export const registerFlow = addKeyword(utils.setEvent('REGISTER_FLOW')).addAction(
//   async (ctx, { flowDynamic, gotoFlow, state }) => {
//     console.log('🔵 ctx.body:', ctx.body);
//     const registerResponse = await apiRegister(ctx.from, ctx.body)
//     await flowDynamic(registerResponse)

//     // Si el registro fue exitoso, ir al flujo de tratamiento de datos
//     if (registerResponse.includes('Registrado')) {
// 	console.log('🔵 registerResponse:', registerResponse);

//       // Actualizar estado para tratamiento de datos
//       await state.update({ 
//         currentFlow: 'dataConsent',
//         user: { ...await state.get('user'), flujo: 'dataConsentFlow' }
//       });

//       return gotoFlow(dataConsentFlow)
//     }
//   }
// )

//---------------------------------------------------------------------------------------------------------

export const pedirNumeroPracticanteAsignadoFlow = addKeyword(utils.setEvent('PEDIR_NUMERO_PRACTICANTE_ASIGNADO'))
  .addAction(async (ctx, { state }) => {
    await state.update({ currentFlow: 'pedirNumeroPracticanteAsignado' });
    console.log('🟢 PEDIR_NUMERO_PRACTICANTE_ASIGNADO: Inicializado para:', ctx.from);
  })
  .addAnswer(
    'Por favor, proporciona el número de tu psicologo asignado \n\nSi no tienes el número, puedes solicitarlo a tu psicologo.',
    { capture: true },
    async (ctx, { flowDynamic, gotoFlow, state, fallBack }) => {
      const numeroPracticanteAsignado = (ctx.body || '').replace(/\D/g, '');

      console.log('🔵 numeroPracticanteAsignado:', numeroPracticanteAsignado);

      if (numeroPracticanteAsignado.length < 8) {
        await flowDynamic('El número debe tener al menos 8 dígitos.');
        return fallBack();
      }

      try {
        // Guardar el número del practicante asignado
        await guardarPracticanteAsignado(ctx.from, numeroPracticanteAsignado);

        await flowDynamic('✅ Número de practicante asignado guardado correctamente.');

        await switchFlujo(ctx.from, 'menuFlow');
        await state.update({
          currentFlow: 'menu',
          user: { ...await state.get('user'), flujo: 'menuFlow' }
        });
        return gotoFlow(menuFlow);
      } catch (error) {
        console.error('Error guardando practicante:', error);
        await flowDynamic('❌ Error guardando el número. Intenta de nuevo.');
        return fallBack();
      }
    }
  )

//---------------------------------------------------------------------------------------------------------

// Flujo de consentimiento de tratamiento de datos
export const dataConsentFlow = addKeyword(utils.setEvent('DATA_CONSENT_FLOW'))
  .addAction(async (ctx, { state }) => {
    await state.update({ currentFlow: 'dataConsent' });
    console.log('🔒 DATA_CONSENT_FLOW: Inicializado para:', ctx.from);
  })
  .addAnswer(
    '📋 *TRATAMIENTO DE DATOS PERSONALES*\n\n' +
    'Para continuar con nuestros servicios, necesitamos tu consentimiento para el tratamiento de tus datos personales según la Ley de Protección de Datos.\n\n' +
    '🔹 Tus datos serán utilizados únicamente para brindar servicios psicológicos\n' +
    '🔹 No compartiremos tu información con terceros\n' +
    '🔹 Puedes solicitar la eliminación de tus datos en cualquier momento\n\n' +
    '¿Aceptas el tratamiento de tus datos personales?\n\n' +
    'Responde *"si"* para aceptar o *"no"* para rechazar:',
    { capture: true },
    async (ctx, { flowDynamic, gotoFlow, state, endFlow }) => {
      const respuesta = ctx.body.trim().toLowerCase();

      if (respuesta === 'si') {
        // Usuario acepta el tratamiento de datos
        await state.update({
          currentFlow: 'numeroPracticanteAsignado',
          user: { ...await state.get('user'), flujo: 'pedirNumeroPracticanteAsignadoFlow' }
        });

        // Actualizar flujo del usuario en BD
        await switchFlujo(ctx.from, 'pedirNumeroPracticanteAsignadoFlow');

        await flowDynamic('✅ *Consentimiento aceptado*\n\nGracias por aceptar el tratamiento de datos. Ahora puedes acceder a todos nuestros servicios.');

        return gotoFlow(pedirNumeroPracticanteAsignadoFlow);

      } else if (respuesta === 'no') {
        // Usuario rechaza el tratamiento de datos
        // Marcar en BD que rechazó el consentimiento
        await switchFlujo(ctx.from, 'consentimiento_rechazado');

        await flowDynamic('❌ *Lo sentimos, pero no puedes continuar si no aceptas el tratamiento de datos.*\n\nSi cambias de opinión, puedes escribirnos nuevamente en cualquier momento.\n\n¡Que tengas un buen día! 👋');

        return endFlow();

      } else {
        // Respuesta inválida
        await flowDynamic('❌ Por favor responde únicamente *"si"* para aceptar o *"no"* para rechazar el tratamiento de datos.');
        return gotoFlow(dataConsentFlow);
      }
    }
  )
//---------------------------------------------------------------------------------------------------------

// Flujo para usuarios que rechazaron consentimiento y quieren reconsiderar
export const reconsentFlow = addKeyword(utils.setEvent('RECONSENT_FLOW'))
  .addAction(async (ctx, { state }) => {
    await state.update({ currentFlow: 'reconsent' });
    console.log('🔄 RECONSENT_FLOW: Inicializado para:', ctx.from);
  })
  .addAnswer(
    '❌ *No puedes acceder al sistema porque rechazaste el tratamiento de datos.*\n\n' +
    'Si has cambiado de opinión y deseas aceptar el tratamiento de datos, escribe *"acepto"* para continuar.',
    { capture: true },
    async (ctx, { flowDynamic, gotoFlow, state, endFlow }) => {
      const respuesta = ctx.body.trim().toLowerCase();

      if (respuesta === 'acepto') {
        // Usuario acepta ahora
        await state.update({
          currentFlow: 'numeroPracticanteAsignado',
          user: { ...await state.get('user'), flujo: 'pedirNumeroPracticanteAsignadoFlow' }
        });

        await switchFlujo(ctx.from, 'pedirNumeroPracticanteAsignadoFlow');

        await flowDynamic('✅ *Consentimiento aceptado*\n\nGracias por aceptar el tratamiento de datos. Ahora puedes acceder a todos nuestros servicios.');

        return gotoFlow(pedirNumeroPracticanteAsignadoFlow);

      } else {
        // Cualquier otra respuesta = rechaza de nuevo
        await flowDynamic('❌ *Debes escribir "acepto" para continuar.*\n\nSi no deseas aceptar el tratamiento de datos, no podrás usar nuestros servicios.\n\n¡Que tengas un buen día! 👋');

        return endFlow();
      }
    }
  );

//---------------------------------------------------------------------------------------------------------

const validarRespuestaMenu = (respuesta, opcionesValidas) => {
  const resp = respuesta?.toString().trim();
  return opcionesValidas.includes(resp) ? resp : null;
};

export const menuFlow = addKeyword(utils.setEvent('MENU_FLOW'))
  .addAction(async (ctx, { state }) => {
    // Actualizar flujo solo cuando realmente llegamos al menú
    await switchFlujo(ctx.from, 'menuFlow') // ARREGLADO - ahora maneja usuarios web
    await state.update({ currentFlow: 'menu' })
    console.log('🟢 MENU_FLOW: Inicializado para:', ctx.from);
  })
  .addAnswer(
    '¡Perfecto! Ahora puedes elegir qué hacer:\n\n' +
    '🔹 1 - Realizar cuestionarios psicológicos\n\n' +
    'Responde con 1.',
    { capture: true, idle: 600000 }, // Timeout de 10 minutos
    async (ctx, { flowDynamic, gotoFlow, fallBack, endFlow, state }) => {
      try {
        // ⚠️ DETECCIÓN DE CAMBIO DE ROL DENTRO DEL MENÚ
        // Si un admin cambió el rol mientras el usuario estaba en el menú,
        // sacarlo del menú y dejar que welcomeFlow re-evalúe.
        const rolActual = await verificarRolUsuario(ctx.from);
        if (rolActual && rolActual.rol !== 'usuario') {
          console.log(`🔄 ¡ROL CAMBIÓ en menuFlow! Ahora es: ${rolActual.rol}. Saliendo del menú.`);
          await state.update({ currentFlow: null, user: null, initialized: false });
          await flowDynamic(`🔄 *Tu rol ha cambiado a ${rolActual.rol}.*\n\nPor favor, escribe nuevamente para continuar.`);
          return endFlow();
        }

        // ⚠️ DETECCIÓN DE PRUEBA ASIGNADA DENTRO DEL MENÚ
        // El practicante puede asignar una prueba mientras el paciente está en el menú.
        // Como capture:true intercepta el mensaje antes que welcomeFlow, hay que verificar aquí.
        const userBD = await obtenerUsuario(ctx.from);
        if (userBD?.flujo === 'testFlow') {
          console.log('🔀 Prueba asignada mientras estaba en menú — iniciando testFlow');
          await state.update({
            currentFlow: 'test',
            justInitializedTest: true,
            testAsignadoPorPracticante: true,
            user: userBD,
          });
          return gotoFlow(testFlow);
        }

        // Manejo de inactividad (timeout)
        if (ctx?.idleFallBack) {
          await flowDynamic('Te demoraste en responder, Escribe otra vez para empezar.');
          return endFlow();
        } // sirve para hacer un timeout de 10 mins

        console.log('🟢 MENU_FLOW: Recibido mensaje:', ctx.body);
        const msg = validarRespuestaMenu(ctx.body, ['1']);

        if (msg === '1') {
          const verificacionEdad = await validarMayorDeEdad(ctx.from);
          if (!verificacionEdad.permitido) {
            await bloquearAccesoPorMenorEdad(ctx, state, flowDynamic);
            return endFlow();
          }

          // Hacer cuestionarios - DASS-21 se habilita solo si GHQ-12 fue alto
          const allowDass21 = await puedeHabilitarDass21(ctx.from, state);
          await flowDynamic(menuCuestionarios(allowDass21));
          await switchFlujo(ctx.from, 'testSelectionFlow')
          await state.update({ currentFlow: 'testSelection', allowDass21 });
          return gotoFlow(testSelectionFlow, { body: '' });

        } else {
          // Opción inválida
          await flowDynamic('❌ Opción no válida. Por favor responde con:\n' +
            '🔹 1 - Para realizar cuestionarios');
          return fallBack();
        }
      } catch (error) {
        console.error('❌ Error en menuFlow.addAnswer:', error);
        await flowDynamic('⚠️ Ocurrió un error de conexión. Por favor, intenta enviar tu mensaje de nuevo.');
      }
    }
  );

//---------------------------------------------------------------------------------------------------------

// Flujo para pedir el documento del profesional que aplicó el test y enviar el PDF por correo
export const pedirDocumentoProfesionalFlow = addKeyword(utils.setEvent('PEDIR_DOCUMENTO_PROFESIONAL'))
  .addAction(async (ctx, { state }) => {
    await state.update({ currentFlow: 'pedirDocumentoProfesional' });
    console.log('🟢 PEDIR_DOCUMENTO_PROFESIONAL: Inicializado para:', ctx.from);
  })
  .addAnswer(
    '📋 Para enviar el informe al profesional que te aplicó el test, por favor ingresa su *número de documento* (cédula):',
    { capture: true, idle: 300000 },
    async (ctx, { flowDynamic, gotoFlow, state, fallBack, endFlow }) => {
      try {
        // Timeout por inactividad
        if (ctx?.idleFallBack) {
          await flowDynamic('Te demoraste en responder. Escribe otra vez para empezar.');
          await state.update({ currentFlow: null, intentosDocumento: 0 });
          return endFlow();
        }

        const documento = ctx.body.trim();
        let intentos = (await state.get('intentosDocumento')) || 0;

        // Validar que el input sea un número de documento razonable
        if (!documento || documento.length < 5 || !/^\d+$/.test(documento)) {
          intentos++;
          await state.update({ intentosDocumento: intentos });

          if (intentos >= 3) {
            await flowDynamic(
              '❌ Se han agotado los intentos.\n\n' +
              'El informe se generó correctamente pero no se pudo enviar por correo.\n' +
              'Regresando al menú principal...'
            );
            await state.update({ currentFlow: 'menu', intentosDocumento: 0, testActual: null });
            limpiarRutaPdf(ctx.from);
            await switchFlujo(ctx.from, 'menuFlow');
            return gotoFlow(menuFlow);
          }

          await flowDynamic(
            `❌ Documento no válido. Ingresa solo números.\n\n` +
            `Intentos restantes: ${3 - intentos}`
          );
          return fallBack();
        }

        // Buscar practicante por documento
        const practicante = await buscarPracticantePorDocumento(documento);

        if (!practicante) {
          intentos++;
          await state.update({ intentosDocumento: intentos });

          if (intentos >= 3) {
            await flowDynamic(
              '❌ Se han agotado los intentos. No se encontró un profesional con ese documento.\n\n' +
              'El informe se generó correctamente pero no se pudo enviar por correo.\n' +
              'Regresando al menú principal...'
            );
            await state.update({ currentFlow: 'menu', intentosDocumento: 0, testActual: null });
            limpiarRutaPdf(ctx.from);
            await switchFlujo(ctx.from, 'menuFlow');
            return gotoFlow(menuFlow);
          }

          await flowDynamic(
            `⚠️ No se encontró un profesional con el documento *${documento}*.\n\n` +
            `Verifica el número e intenta de nuevo.\n` +
            `Intentos restantes: ${3 - intentos}`
          );
          return fallBack();
        }

        // Practicante encontrado, correo obligatorio
        if (!practicante.correo || !String(practicante.correo).trim()) {
          intentos++;
          await state.update({ intentosDocumento: intentos });

          if (intentos >= 3) {
            await flowDynamic(
              '❌ Se encontró el profesional pero no tiene correo registrado.\n\n' +
              'No fue posible enviar el informe. Regresando al menú principal...'
            );
            await state.update({ currentFlow: 'menu', intentosDocumento: 0, testActual: null });
            limpiarRutaPdf(ctx.from);
            await switchFlujo(ctx.from, 'menuFlow');
            return gotoFlow(menuFlow);
          }

          await flowDynamic(
            `⚠️ El profesional *${practicante.nombre}* no tiene correo registrado.\n\n` +
            `Ingresa el documento de otro profesional.\n` +
            `Intentos restantes: ${3 - intentos}`
          );
          return fallBack();
        }

        await flowDynamic(`✅ Profesional encontrado: *${practicante.nombre}*\n⏳ Preparando el informe para envío por correo...`);

        // Esperar hasta 180 segundos por el PDF (RAG + PDF puede tardar)
        let pdfListo = obtenerRutaPdf(ctx.from);
        for (let i = 0; i < 36 && !pdfListo?.pdfPath; i++) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          pdfListo = obtenerRutaPdf(ctx.from);
        }

        if (!pdfListo?.pdfPath) {
          const testActualCompletado = await state.get('testActualCompletado') || null
          pdfListo = await recuperarPdfDesdeBD(ctx.from, testActualCompletado)
        }

        if (!pdfListo?.pdfPath) {
          await flowDynamic(
            '⚠️ No se encontró el PDF del informe para enviar por correo.\n\n' +
            'Intenta nuevamente en unos segundos escribiendo *menu*.'
          );
          await state.update({ currentFlow: 'menu', intentosDocumento: 0, testActual: null });
          await switchFlujo(ctx.from, 'menuFlow');
          return gotoFlow(menuFlow);
        }

        const testCompletado = await state.get('testCompletado') || 'Test psicológico';
        const patientData = await obtenerPerfilPacienteParaInforme(ctx.from);
        const nombrePaciente = [patientData?.nombres, patientData?.apellidos].filter(Boolean).join(' ').trim() || 'No disponible';
        const documentoPaciente = patientData?.documento && patientData.documento !== 'No disponible'
          ? `${patientData?.tipoDocumento || 'Doc'} ${patientData.documento}`
          : 'No disponible';

        const resultadoEnvio = await enviarPdfPorCorreo(practicante.correo, pdfListo.pdfPath, {
          nombrePaciente,
          documentoPaciente,
          telefonoPaciente: patientData?.telefonoPrincipal || ctx.from,
          testNombre: testCompletado,
          fecha: new Date().toLocaleString('es-CO'),
          nombrePracticante: practicante.nombre,
          semestre: patientData?.semestre || null,
          jornada: patientData?.jornada || null,
          carrera: patientData?.carrera || null,
        });

        if (resultadoEnvio.success) {
          await flowDynamic(
            `✅ *Informe enviado exitosamente*\n\n` +
            `📧 Enviado a: *${practicante.correo}*\n` +
            `📨 Copia enviada a: *chatbotpsicologia@gmail.com*\n\n` +
            'Regresando al menú principal...'
          );

          const testActualCompletado = await state.get('testActualCompletado');
          const recomendarDass21 = await state.get('recomendarDass21');
          if (testActualCompletado === 'ghq12' && recomendarDass21) {
            await flowDynamic(
              '🧠 *Recomendación clínica complementaria*\n\n' +
              'Con base en el resultado del GHQ-12, se recomienda aplicar también el *DASS-21* para ampliar la evaluación de síntomas emocionales.'
            );
            await state.update({ allowDass21: true });
          }
        } else {
          await flowDynamic(
            `⚠️ No se pudo enviar el correo: ${resultadoEnvio.message}\n\n` +
            'Regresando al menú principal...'
          );
        }

        limpiarRutaPdf(ctx.from);
        await state.update({
          currentFlow: 'menu',
          intentosDocumento: 0,
          testActual: null,
          recomendarDass21: false,
          allowDass21: await puedeHabilitarDass21(ctx.from, state),
        });
        await switchFlujo(ctx.from, 'menuFlow');
        return gotoFlow(menuFlow);

      } catch (error) {
        console.error('❌ Error en pedirDocumentoProfesionalFlow:', error);
        await flowDynamic('⚠️ Ocurrió un error. Regresando al menú principal...');
        await state.update({ currentFlow: 'menu', intentosDocumento: 0, recomendarDass21: false });
        limpiarRutaPdf(ctx.from);
        await switchFlujo(ctx.from, 'menuFlow');
        return gotoFlow(menuFlow);
      }
    }
  );

//---------------------------------------------------------------------------------------------------------

// Pertenece a universidad
export const esDeUniversidadFlow = addKeyword(utils.setEvent('PERTENECE_UNIVERSIDAD'))
  .addAction(async (ctx, { state }) => {
    console.log("(me cago en la puta)")
    await switchFlujo(ctx.from, 'esDeUniversidadFlow')
    await state.update({ currentFlow: 'esDeUniversidad' });
    console.log('🟢 esDeUniversidadFlow Inicializado para:', ctx.from);
  })
  .addAnswer(
    'Has indicado que *perteneces a la universidad* Universitaria de Colombia \n\n' +
    '👉 Para continuar debes _*ingresar algunos datos*_ a continuación:'
  )
  // capturar carrera
  .addAnswer(
    'Por favor, indica tú carrera:',
    { capture: true },
    async (ctx, { flowDynamic, state, fallBack }) => {
      const carrera = ctx.body.trim();
      console.log(ctx.body)

      if (!carrera || carrera.length < 4 && carrera.length > 50) {
        await flowDynamic('❌ Debes ingresar una *carrera válida*')
        return fallBack();
      }

      await state.update({ carrera });
      console.log(`✅ Carrera capturada para: ${ctx.from}`)
    }
  )
  // capturar jornada
  .addAnswer(
    'Ahora, indica tú jornada:',
    { capture: true },
    async (ctx, { flowDynamic, state, fallBack }) => {
      const jornada = ctx.body.trim();

      if (!jornada || jornada.length < 4 && jornada.length > 50) {
        await flowDynamic('❌ Debes ingresar una *jornada válida* _(diurna / nocturna)_')
        return fallBack();
      }

      await state.update({ jornada });
      console.log(`✅ Jornada capturada para: ${ctx.from}`)
    }
  )
  // capturar semestre
  .addAnswer(
    'Por último, indica tú semestre (1-9):',
    { capture: true },
    async (ctx, { flowDynamic, state, fallBack }) => {
      const semestre = ctx.body.trim();

      if (!semestre || isNaN(semestre) || parseInt(semestre) < 1 || parseInt(semestre) > 9) {
        await flowDynamic('❌ Debes ingresar un *semestre válido* _(1-9)_ ')
        return fallBack();
      }

      await state.update({ semestre: parseInt(semestre) });
      console.log(`✅ Semestre capturado para: ${ctx.from}`)
    }
  )
  // Acción guarda en BD
  .addAction(
    async (ctx, { state, flowDynamic, gotoFlow }) => {
      const datosUsuario = {
        carrera: await state.get('carrera'),
        jornada: await state.get('jornada'),
        semestre: await state.get('semestre'),
      };

      try {
        // Aqui se guarda en BD
        await perteneceUniversidad(ctx.from, datosUsuario);

        await flowDynamic(
          '✅ Registro completado exitosamente\n' +
          `\n *Carrera:* ${datosUsuario.carrera}` +
          `\n *Jornada:* ${datosUsuario.jornada}` +
          `\n *Semestre:* ${datosUsuario.semestre}` +
          '\n\n🎉 Bienvenido! Ya puedes interactuar con el bot.'
        )

        await state.update({
          currentFlow: 'menu',
          user: {
            ...await state.get('user'), flujo: 'menuFlow'
          }
        });

        await switchFlujo(ctx.from, 'menuFlow')
        return gotoFlow(menuFlow);

      } catch (error) {
        console.error('❌ Error al guardar datos:', error)
        await flowDynamic('❌ Hubo un problema al guardar tus datos, intenta nuevamente')
      }
    })

//---------------------------------------------------------------------------------------------------------



export const agendFlow = addKeyword(utils.setEvent('AGEND_FLOW'))
  .addAction(async (ctx, { state }) => {
    await state.update({ currentFlow: 'agend' });
    console.log('📅 AGEND_FLOW: Inicializado para:', ctx.from);
  })
  // PASO 1: SELECCIÓN DE DÍA
  .addAnswer(
    '📅 AGENDAR CITA PSICOLÓGICA\n\n' +
    'Selecciona el día de la semana que prefieres:\n\n' +
    '🔹 1 - Lunes\n' +
    '🔹 2 - Martes\n' +
    '🔹 3 - Miércoles\n' +
    '🔹 4 - Jueves\n' +
    '🔹 5 - Viernes\n' +
    '🔹 6 - Sábado\n\n' +
    'Responde con el número del día:',
    { capture: true },
    async (ctx, { flowDynamic, state, fallBack }) => {
      const diaSeleccionado = ctx.body.trim();
      const diasValidos = ['1', '2', '3', '4', '5', '6'];

      if (!diasValidos.includes(diaSeleccionado)) {
        await flowDynamic('❌ Opción no válida. Por favor selecciona un número del 1 al 6.');
        return fallBack();
      }

      const mapaDias = {
        '1': 'LUNES',
        '2': 'MARTES',
        '3': 'MIERCOLES',
        '4': 'JUEVES',
        '5': 'VIERNES',
        '6': 'SABADO'
      };

      const diaNombre = mapaDias[diaSeleccionado];

      await state.update({
        diaSeleccionado: diaNombre,
        diaSeleccionadoNumero: diaSeleccionado
      });

      console.log('📅 Día seleccionado:', diaNombre);
    }
  )
  // PASO 2: SELECCIÓN DE HORARIO
  .addAnswer(
    '🕐 SELECCIONAR HORARIO\n\n' +
    'Elige el horario específico que prefieres:\n\n' +
    '🔹 1 - 8:00 - 9:00 AM\n' +
    '🔹 2 - 9:00 - 10:00 AM\n' +
    '🔹 3 - 10:00 - 11:00 AM\n' +
    '🔹 4 - 11:00 AM - 12:00 PM\n' +
    '🔹 5 - 12:00 - 1:00 PM\n' +
    '🔹 6 - 1:00 - 2:00 PM\n' +
    '🔹 7 - 2:00 - 3:00 PM\n' +
    '🔹 8 - 3:00 - 4:00 PM\n' +
    '🔹 9 - 4:00 - 5:00 PM\n\n' +
    'Responde con el número del horario:',
    { capture: true },
    async (ctx, { flowDynamic, state, fallBack }) => {
      console.log('🕐 Horario recibido:', ctx.body);
      const horarioSeleccionado = ctx.body.trim();
      const horariosValidos = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

      if (!horariosValidos.includes(horarioSeleccionado)) {
        await flowDynamic('❌ Opción no válida. Por favor selecciona un número del 1 al 9.');
        return fallBack();
      }

      const mapaHorarios = {
        '1': { inicio: 8, fin: 9, nombre: '8:00 - 9:00 AM', minInicio: 480, minFin: 540 },
        '2': { inicio: 9, fin: 10, nombre: '9:00 - 10:00 AM', minInicio: 540, minFin: 600 },
        '3': { inicio: 10, fin: 11, nombre: '10:00 - 11:00 AM', minInicio: 600, minFin: 660 },
        '4': { inicio: 11, fin: 12, nombre: '11:00 AM - 12:00 PM', minInicio: 660, minFin: 720 },
        '5': { inicio: 12, fin: 13, nombre: '12:00 - 1:00 PM', minInicio: 720, minFin: 780 },
        '6': { inicio: 13, fin: 14, nombre: '1:00 - 2:00 PM', minInicio: 780, minFin: 840 },
        '7': { inicio: 14, fin: 15, nombre: '2:00 - 3:00 PM', minInicio: 840, minFin: 900 },
        '8': { inicio: 15, fin: 16, nombre: '3:00 - 4:00 PM', minInicio: 900, minFin: 960 },
        '9': { inicio: 16, fin: 17, nombre: '4:00 - 5:00 PM', minInicio: 960, minFin: 1020 }
      };

      const horario = mapaHorarios[horarioSeleccionado];

      await state.update({
        horarioInicio: horario.inicio,
        horarioFin: horario.fin,
        horarioNombre: horario.nombre,
        minInicio: horario.minInicio,
        minFin: horario.minFin
      });

      console.log('🕐 Horario guardado:', horario);
    }
  )
  // PASO 3: BUSCAR DISPONIBILIDAD
  .addAction(async (ctx, { flowDynamic, gotoFlow, state }) => {
    console.log('🔵 Iniciando búsqueda integrada...');

    const diaSeleccionado = await state.get('diaSeleccionado');
    const horarioInicio = await state.get('horarioInicio');
    const horarioFin = await state.get('horarioFin');
    const horarioNombre = await state.get('horarioNombre');
    const fechaSolicitada = await state.get('fechaSolicitada');
    const diaNumero = await state.get('diaSeleccionadoNumero');

    console.log('📊 Estado completo:', { diaSeleccionado, horarioInicio, horarioFin, diaNumero });
    const mapaDiasTexto = {
      '1': 'Lunes',
      '2': 'Martes',
      '3': 'Miércoles',
      '4': 'Jueves',
      '5': 'Viernes',
      '6': 'Sábado'
    };

    const diaTexto = mapaDiasTexto[diaNumero];

    try {
      await flowDynamic('🔍 Buscando disponibilidad...');
      console.log('🔎 Llamando buscarPracticanteDisponible...');

      const practicantesDisponibles = await buscarPracticanteDisponible(
        diaSeleccionado,
        horarioInicio,
        horarioFin,
        fechaSolicitada
      );

      console.log('✅ Resultado búsqueda:', practicantesDisponibles?.length || 0);

      if (practicantesDisponibles && practicantesDisponibles.length > 0) {
        console.log('✅ HAY DISPONIBILIDAD');

        await state.update({
          practicantesDisponibles: practicantesDisponibles,
          practicanteSeleccionado: practicantesDisponibles[0],
          hayDisponibilidad: true
        });

        const mensajeHorarios = formatearHorariosDisponibles(practicantesDisponibles);
        await flowDynamic(mensajeHorarios);

        await flowDynamic(
          '📋 *RESUMEN DE TU CITA*\n\n' +
          `📅 *Día:* ${diaTexto}\n` +
          `🕐 *Horario:* ${horarioNombre}\n` +
          `👨‍⚕️ *Psicólogo asignado:* ${practicantesDisponibles[0].nombre}\n\n` +
          '¿Deseas confirmar esta cita?\n\n' +
          '✅ *1* - Sí, confirmar cita\n' +
          '❌ *2* - No, volver al menú\n' +
          '📅 *3* - Cambiar día/horario'
        );

      } else {
        console.log('❌ NO HAY DISPONIBILIDAD');

        await state.update({
          hayDisponibilidad: false
        });

        await flowDynamic(
          '❌ Lo sentimos, no hay psicólogos disponibles en este horario.\n\n' +
          '¿Qué deseas hacer?\n\n' +
          '🔹 1 - Seleccionar otro día/horario\n' +
          '🔹 2 - Volver al menú principal'
        );
      }

    } catch (error) {
      console.error('❌ ERROR:', error);
      console.error('Stack:', error.stack);
      await flowDynamic('❌ Ocurrió un error. Volviendo al menú...');
      await state.update({ currentFlow: 'menu' });
      await switchFlujo(ctx.from, 'menuFlow');
      return gotoFlow(menuFlow);
    }
  })
  // PASO 4: CAPTURAR RESPUESTA (DISPONIBILIDAD O NO)
  .addAnswer(
    '',
    { capture: true },
    async (ctx, { flowDynamic, gotoFlow, state, fallBack }) => {
      const respuesta = ctx.body.trim();
      const hayDisponibilidad = await state.get('hayDisponibilidad');

      console.log('📥 Respuesta recibida:', respuesta, '| Disponibilidad:', hayDisponibilidad);

      if (hayDisponibilidad) {
        // ==== CASO: HAY DISPONIBILIDAD (opciones 1, 2, 3) ====

        if (respuesta === '1') {
          // ✅ CONFIRMAR CITA
          try {
            await flowDynamic('💾 Guardando tu cita...');

            const diaSeleccionado = await state.get('diaSeleccionado');
            const horarioInicio = await state.get('horarioInicio');
            const horarioFin = await state.get('horarioFin');
            const fechaSolicitada = await state.get('fechaSolicitada');
            const practicanteSeleccionado = await state.get('practicanteSeleccionado');

            if (!practicanteSeleccionado) {
              throw new Error('No hay practicante seleccionado');
            }

            // Guardar la cita en BD
            const citaData = await guardarCita(
              ctx.from,
              practicanteSeleccionado.idPracticante,
              diaSeleccionado,
              horarioInicio,
              horarioFin,
              fechaSolicitada
            );

            // Formatear y enviar mensaje de confirmación
            const mensajeConfirmacion = formatearMensajeCita(citaData);
            await flowDynamic(mensajeConfirmacion);

            await flowDynamic(
              '\n¿Qué deseas hacer ahora?\n\n' +
              '🔹 1 - Realizar cuestionarios psicológicos\n' +
              '🔹 2 - Volver al menú principal'
            );

            // Actualizar estado para capturar siguiente respuesta
            await state.update({
              citaConfirmada: true,
              diaSeleccionado: null,
              horarioInicio: null,
              horarioFin: null,
              practicanteSeleccionado: null,
              practicantesDisponibles: null,
              hayDisponibilidad: null
            });

          } catch (error) {
            console.error('❌ Error guardando cita:', error);

            if (error.message.includes('consultorios disponibles')) {
              await flowDynamic(
                '🏥 Lo sentimos, todos los consultorios están ocupados en este horario.\n\n' +
                '¿Qué deseas hacer?\n\n' +
                '🔹 1 - Seleccionar otro día/horario\n' +
                '🔹 2 - Volver al menú principal'
              );

              await state.update({ hayDisponibilidad: false });
              return fallBack();
            }

            await flowDynamic(
              '❌ Error al guardar la cita.\n\n' +
              (error.message === 'Usuario no encontrado'
                ? 'No se encontró tu información. Por favor, regístrate primero.'
                : 'Ocurrió un error. Por favor, intenta nuevamente.')
            );
            await state.update({ currentFlow: 'menu' });
            await switchFlujo(ctx.from, 'menuFlow');
            return gotoFlow(menuFlow);
          }

        } else if (respuesta === '2') {
          // ❌ CANCELAR - Volver al menú
          await flowDynamic('👋 Entendido. Volviendo al menú principal...');
          await state.update({
            currentFlow: 'menu',
            diaSeleccionado: null,
            horarioInicio: null,
            horarioFin: null,
            practicanteSeleccionado: null,
            practicantesDisponibles: null,
            hayDisponibilidad: null
          });
          await switchFlujo(ctx.from, 'menuFlow');
          return gotoFlow(menuFlow);

        } else if (respuesta === '3') {
          // 🔄 CAMBIAR - Reiniciar proceso
          await state.update({
            diaSeleccionado: null,
            horarioInicio: null,
            horarioFin: null,
            practicanteSeleccionado: null,
            practicantesDisponibles: null,
            hayDisponibilidad: null
          });
          await flowDynamic('🔄 Perfecto. Selecciona nuevamente el día y horario...');
          await switchFlujo(ctx.from, 'agendFlow');
          return gotoFlow(agendFlow);

        } else {
          await flowDynamic('❌ Opción no válida. Por favor selecciona 1, 2 o 3.');
          return fallBack();
        }

      } else {
        // ==== CASO: NO HAY DISPONIBILIDAD (opciones 1, 2) ====

        if (respuesta === '1') {
          // ✅ Seleccionar otro horario
          console.log('🔄 Usuario elige cambiar día/horario');

          await state.update({
            diaSeleccionado: null,
            horarioInicio: null,
            horarioFin: null,
            practicanteSeleccionado: null,
            practicantesDisponibles: null,
            hayDisponibilidad: null
          });

          await flowDynamic('🔄 Perfecto. Selecciona nuevamente el día y horario...');
          await switchFlujo(ctx.from, 'agendFlow');
          return gotoFlow(agendFlow);

        } else if (respuesta === '2') {
          // ✅ Volver al menú
          console.log('👋 Usuario vuelve al menú');

          await flowDynamic('👋 Volviendo al menú principal...');

          await state.update({
            currentFlow: 'menu',
            diaSeleccionado: null,
            horarioInicio: null,
            horarioFin: null,
            practicanteSeleccionado: null,
            practicantesDisponibles: null,
            hayDisponibilidad: null
          });

          await switchFlujo(ctx.from, 'menuFlow');
          return gotoFlow(menuFlow);

        } else {
          await flowDynamic('❌ Opción no válida. Por favor selecciona 1 o 2.');
          return fallBack();
        }
      }
    }
  )
  // PASO 5: POST-CONFIRMACIÓN (CUESTIONARIOS O MENÚ)
  .addAnswer(
    '',
    { capture: true },
    async (ctx, { flowDynamic, gotoFlow, state, fallBack }) => {
      const citaConfirmada = await state.get('citaConfirmada');

      // Solo procesar si hay una cita confirmada
      if (!citaConfirmada) {
        return;
      }

      const msg = ctx.body.trim();

      if (msg === '1') {
        // Hacer cuestionarios
        const allowDass21 = await puedeHabilitarDass21(ctx.from, state);
        await flowDynamic(menuCuestionarios(allowDass21));
        await switchFlujo(ctx.from, 'testSelectionFlow');
        await state.update({
          currentFlow: 'testSelection',
          allowDass21,
          citaConfirmada: null
        });
        return gotoFlow(testSelectionFlow);

      } else if (msg === '2') {
        // Volver al menú
        await flowDynamic('✅ Perfecto. Regresando al menú principal...');
        await state.update({
          currentFlow: 'menu',
          citaConfirmada: null
        });
        await switchFlujo(ctx.from, 'menuFlow');
        return gotoFlow(menuFlow);

      } else {
        await flowDynamic(
          '❌ Opción no válida. Por favor responde:\n\n' +
          '🔹 1 - Realizar cuestionarios\n' +
          '🔹 2 - Volver al menú'
        );
        return fallBack();
      }
    }
  );


//---------------------------------------------------------------------------------------------------------

// Flow para manejar "completar datos" - Ayuda a practicantes pendientes de configuración
export const completarDatosFlow = addKeyword(['completar datos'])
  .addAction(async (ctx, { flowDynamic, state, gotoFlow }) => {
    console.log('🔄 Usuario solicita completar datos:', ctx.from);

    // Verificar si el usuario tiene rol de practicante pero no datos completos
    const rolInfo = await verificarRolUsuario(ctx.from);

    if (!rolInfo || rolInfo.rol !== 'practicante') {
      await flowDynamic(
        '❌ Esta función solo está disponible para practicantes que están en proceso de configuración.\n\n' +
        'Si necesitas ayuda, contacta al administrador.'
      );
      return;
    }

    // Verificar si ya existe en tabla practicante
    const practicanteCompleto = await prisma.practicante.findUnique({
      where: { telefono: ctx.from }
    });

    if (practicanteCompleto) {
      await flowDynamic(
        '✅ ¡Tu perfil ya está completo!\n\n' +
        'Ya eres un practicante activo del sistema. Envía `menu` para acceder a tus funciones.'
      );
      return;
    }

    // Si está pendiente, redirigir al flujo de recolección
    await flowDynamic(
      '🔄 *Reanudando proceso de completar datos*\n\n' +
      'Voy a ayudarte a completar tu perfil de practicante.'
    );

    // Guardar en estado que estamos en proceso de completar datos
    await state.update({
      currentFlow: 'completandoDatos',
      cambioRol: { telefono: ctx.from, nuevoRol: 'practicante' }
    });

    return gotoFlow(completarPerfilPracticanteFlow);
  });

//---------------------------------------------------------------------------------------------------------
