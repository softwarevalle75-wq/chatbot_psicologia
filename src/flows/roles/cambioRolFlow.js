import { addKeyword, EVENTS } from '@builderbot/bot';
import {
  validarHorario,
  migrarUsuarioAPracticante
} from '../../queries/cambioRol.js';
import { enviarBienvenidaPracticante } from '../../helpers/notificacionesCambioRol.js';

// --- Flow para recolectar género ---
export const recolectarGeneroFlow = addKeyword(EVENTS.ACTION)
  .addAnswer(
    '📋 *Género*\n' +
    'Por favor, selecciona tu género:\n\n' +
    '1. Masculino\n' +
    '2. Femenino\n' +
    '3. Otro\n' +
    '4. Prefiero no decir',
    { capture: true },
    async (ctx, { flowDynamic, fallBack, state, gotoFlow }) => {
      const opcion = ctx.body.trim();
      
      let genero;
      switch (opcion) {
        case '1':
          genero = 'Masculino';
          break;
        case '2':
          genero = 'Femenino';
          break;
        case '3':
          genero = 'Otro';
          break;
        case '4':
          genero = 'Prefiero no decir';
          break;
        default:
          await flowDynamic('❌ Por favor, selecciona una opción válida (1-4).');
          return fallBack();
      }
      
      // Guardar género en el estado
      const datosAdicionales = state.get('datosAdicionales') || {};
      await state.update({ datosAdicionales: { ...datosAdicionales, genero } });
      
      await flowDynamic('✅ Género registrado.');
      return gotoFlow(recolectarEstratoFlow);
    }
  );

// --- Flow para recolectar estrato ---
export const recolectarEstratoFlow = addKeyword(EVENTS.ACTION)
  .addAnswer(
    '🏠 *Estrato socioeconómico*\n\n' +
    'Por favor, ingresa tu estrato (1-6):',
    { capture: true },
    async (ctx, { flowDynamic, fallBack, state, gotoFlow }) => {
      const estrato = parseInt(ctx.body.trim());
      
      if (isNaN(estrato) || estrato < 1 || estrato > 6) {
        await flowDynamic('❌ Por favor, ingresa un número válido entre 1 y 6.');
        return fallBack();
      }
      
      // Guardar estrato en el estado
      const datosAdicionales = state.get('datosAdicionales') || {};
      await state.update({ datosAdicionales: { ...datosAdicionales, estrato } });
      
      await flowDynamic('✅ Estrato registrado.');
      return gotoFlow(recolectarBarrioFlow);
    }
  );

// --- Flow para recolectar barrio ---
export const recolectarBarrioFlow = addKeyword(EVENTS.ACTION)
  .addAnswer(
    '📍 *Barrio*\n\n' +
    'Por favor, ingresa el nombre de tu barrio:',
    { capture: true },
    async (ctx, { flowDynamic, fallBack, state, gotoFlow }) => {
      const barrio = ctx.body.trim();
      
      if (barrio.length < 2) {
        await flowDynamic('❌ Por favor, ingresa un nombre de barrio válido.');
        return fallBack();
      }
      
      // Guardar barrio en el estado
      const datosAdicionales = state.get('datosAdicionales') || {};
      await state.update({ datosAdicionales: { ...datosAdicionales, barrio } });
      
      await flowDynamic('✅ Barrio registrado.');
      return gotoFlow(recolectarLocalidadFlow);
    }
  );

// --- Flow para recolectar localidad ---
export const recolectarLocalidadFlow = addKeyword(EVENTS.ACTION)
  .addAnswer(
    '🏙️ *Localidad*\n\n' +
    'Por favor, ingresa el nombre de tu localidad:',
    { capture: true },
    async (ctx, { flowDynamic, fallBack, state, gotoFlow }) => {
      const localidad = ctx.body.trim();
      
      if (localidad.length < 2) {
        await flowDynamic('❌ Por favor, ingresa un nombre de localidad válido.');
        return fallBack();
      }
      
      // Guardar localidad en el estado
      const datosAdicionales = state.get('datosAdicionales') || {};
      await state.update({ datosAdicionales: { ...datosAdicionales, localidad } });
      
      await flowDynamic('✅ Localidad registrada.');
      return gotoFlow(recolectarHorariosFlow);
    }
  );

// --- Flow para recolectar horarios ---
export const recolectarHorariosFlow = addKeyword(EVENTS.ACTION)
  .addAnswer(
    '⏰ *Horarios de atención*\n\n' +
    'Como practicante, necesitas definir tus horarios de atención. Esto es **obligatorio** para que los pacientes puedan agendar citas contigo.\n\n' +
    'Formato: Día HoraInicio HoraFin\n' +
    'Ejemplos:\n' +
    '- Lunes 8 12\n' +
    '- Martes 14 18\n' +
    '- Miércoles 9 13\n\n' +
    'Puedes agregar múltiples horarios, uno por línea. Cuando termines, escribe *listo*.\n\n' +
    'Días disponibles: Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo\n' +
    'Horas en formato 24h (0-23)',
    { capture: true },
    async (ctx, { flowDynamic, fallBack, state, gotoFlow }) => {
      const entrada = ctx.body.trim().toLowerCase();
      
      if (entrada === 'listo') {
        // Verificar que se haya capturado al menos un horario
        const horarios = state.get('horarios') || [];

        if (horarios.length === 0) {
          await flowDynamic('❌ Debes agregar al menos un horario. Por favor ingresa al menos uno.');
          return fallBack();
        }

        // Mostrar resumen de datos recolectados antes de ir a confirmación
        const datosAdicionales = state.get('datosAdicionales') || {};
        const horariosTexto = horarios.map(h => `  - ${h.dia}: ${h.horaInicio}:00 - ${h.horaFin}:00`).join('\n');

        await flowDynamic(
          `✅ Se han registrado ${horarios.length} horario(s).\n\n` +
          `📋 *Resumen de tus datos:*\n\n` +
          `👥 Género: ${datosAdicionales.genero || 'N/A'}\n` +
          `🏘️ Estrato: ${datosAdicionales.estrato || 'N/A'}\n` +
          `📍 Barrio: ${datosAdicionales.barrio || 'N/A'}\n` +
          `🏙️ Localidad: ${datosAdicionales.localidad || 'N/A'}\n` +
          `⏰ Horarios:\n${horariosTexto}`
        );

        // ⚠️ gotoFlow a un flujo con SOLO addAnswer(capture:true) es seguro.
        // El race condition solo ocurre cuando el flujo destino tiene addAction(flowDynamic)+addAnswer(capture).
        return gotoFlow(resumenDatosFlow);
      }
      
      // Procesar el horario ingresado
      const partes = entrada.split(' ');
      if (partes.length !== 3) {
        await flowDynamic('❌ Formato incorrecto. Usa: Día HoraInicio HoraFin');
        return fallBack();
      }
      
      const [dia, horaInicio, horaFin] = partes;
      
      // Validar día
      const diasValidos = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
      const diaNormalizado = dia.charAt(0).toUpperCase() + dia.slice(1).replace('á', 'a').replace('é', 'e');
      
      if (!diasValidos.includes(dia.toLowerCase())) {
        await flowDynamic('❌ Día no válido. Usa: Lunes, Martes, Miércoles, Jueves, Viernes, Sábado o Domingo');
        return fallBack();
      }
      
      // Validar horas
      const validacion = validarHorario({ dia: diaNormalizado, horaInicio, horaFin });
      if (!validacion.valido) {
        await flowDynamic(`❌ ${validacion.error}`);
        return fallBack();
      }
      
      // Guardar horario
      const horarios = state.get('horarios') || [];
      const nuevoHorario = { 
        dia: diaNormalizado, 
        horaInicio: parseInt(horaInicio), 
        horaFin: parseInt(horaFin) 
      };
      
      horarios.push(nuevoHorario);
      await state.update({ horarios });
      
      await flowDynamic(`✅ Horario agregado: ${diaNormalizado} ${horaInicio}:00 - ${horaFin}:00`);
      await flowDynamic('Puedes agregar otro horario o escribe *listo* para continuar.');
      return fallBack();
    }
  );

// --- Flow de confirmación de datos ---
// ⚠️ CRITICAL: Este flow usa SOLO addAnswer con capture:true, SIN addAction previo,
// SIN flowDynamic previo. Esto evita el race condition de BuilderBot donde flowDynamic
// guarda un mensaje en la BD que sobreescribe el capture:true del addAnswer.
// El resumen de datos se muestra DESDE recolectarHorariosFlow via flowDynamic
// ANTES del gotoFlow (flowDynamic + fallBack en vez de flowDynamic + gotoFlow).
export const resumenDatosFlow = addKeyword(EVENTS.ACTION)
  .addAnswer(
    '📋 *Confirmación de datos*\n\n¿Deseas completar tu registro como practicante?\n\n1. ✅ Sí, completar\n2. ❌ No, cancelar',
    { capture: true },
    async (ctx, { flowDynamic, fallBack, state }) => {
      const opcion = ctx.body.trim();

      if (opcion === '1') {
        const cambioRol = state.get('cambioRol') || {};
        const datosAdicionales = state.get('datosAdicionales') || {};
        const horarios = state.get('horarios') || [];
        const telefono = cambioRol.telefono || ctx.from;

        await flowDynamic('⏳ Guardando datos en el sistema...');

        const resultado = await migrarUsuarioAPracticante(telefono, {
          genero: datosAdicionales.genero,
          estrato: String(datosAdicionales.estrato),
          barrio: datosAdicionales.barrio,
          localidad: datosAdicionales.localidad,
          horarios
        });

        if (!resultado.exito) {
          await flowDynamic(
            `❌ *Error al guardar datos:* ${resultado.error}\n\n` +
            'Por favor, contacta al administrador o intenta de nuevo enviando *completar datos*.'
          );
          await state.update({
            currentFlow: null,
            completandoDatos: null,
            cambioRol: null,
            datosAdicionales: null,
            horarios: null
          });
          return;
        }

        await enviarBienvenidaPracticante(telefono, {
          nombre: resultado.practicante?.nombre || 'Practicante',
          numero_documento: resultado.practicante?.numero_documento || '',
          genero: datosAdicionales.genero,
          estrato: String(datosAdicionales.estrato),
          barrio: datosAdicionales.barrio,
          localidad: datosAdicionales.localidad,
          horarios
        });

        await state.update({
          currentFlow: null,
          completandoDatos: null,
          cambioRol: null,
          datosAdicionales: null,
          horarios: null
        });
        return;
      } else if (opcion === '2') {
        await flowDynamic('❌ *Proceso cancelado.*\n\nSi tienes dudas, contacta al administrador.');
        await state.update({
          currentFlow: null,
          completandoDatos: null,
          cambioRol: null,
          datosAdicionales: null,
          horarios: null
        });
        return;
      } else {
        await flowDynamic('❌ Opción no válida. Responde *1* o *2*.');
        return fallBack();
      }
    }
  );

// Alias para mantener compatibilidad con imports existentes
export const confirmacionDatosFlow = resumenDatosFlow;

// --- Flow de recordatorio para datos pendientes ---
export const recordatorioDatosFlow = addKeyword(EVENTS.ACTION)
  .addAction(async (ctx, { flowDynamic }) => {
    
    await flowDynamic(
      '⏰ *Recordatorio: Datos pendientes de completar*\n\n' +
      'Te cambiamos el rol a Practicante pero aún no has completado tus datos.\n\n' +
      'Para poder recibir pacientes y citas, necesitas completar tu perfil.\n\n' +
      'Cuando estés listo, escribe *completar datos* para continuar.\n\n' +
      'Este recordatorio se enviará cada 6 horas hasta que completes el proceso.'
    );
  });



export const END = { key: 'END', text: 'Fin del flujo' };