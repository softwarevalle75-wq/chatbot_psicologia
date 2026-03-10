import { addKeyword, EVENTS } from '@builderbot/bot';
import { migrarUsuarioAPracticante } from '../../queries/cambioRol.js';
import { enviarBienvenidaPracticante } from '../../helpers/notificacionesCambioRol.js';

// --- Flow simplificado: activa el perfil de practicante automáticamente ---
export const completarPerfilPracticanteFlow = addKeyword(EVENTS.ACTION)
  .addAction(async (ctx, { flowDynamic, state }) => {
    const cambioRol = state.get('cambioRol') || {};
    const telefono = cambioRol.telefono || ctx.from;

    await flowDynamic(
      '⚙️ *Tu perfil de practicante está siendo activado...*\n\n' +
      'Estamos configurando tu cuenta automáticamente. Esto solo tomará un momento.'
    );

    const resultado = await migrarUsuarioAPracticante(telefono);

    if (!resultado.exito) {
      await flowDynamic(
        `❌ *Error al activar el perfil:* ${resultado.error}\n\n` +
        'Por favor, contacta al administrador.'
      );
      await state.update({
        currentFlow: null,
        completandoDatos: null,
        cambioRol: null
      });
      return;
    }

    await enviarBienvenidaPracticante(telefono, {
      nombre: resultado.practicante?.nombre || 'Practicante',
      numero_documento: resultado.practicante?.numero_documento || '',
      genero: resultado.practicante?.genero || 'No especificado'
    });

    await state.update({
      currentFlow: null,
      completandoDatos: null,
      cambioRol: null
    });
  });

// Alias para mantener compatibilidad con imports existentes
export const confirmacionDatosFlow = completarPerfilPracticanteFlow;
export const resumenDatosFlow = completarPerfilPracticanteFlow;

// --- Flow de recordatorio para datos pendientes ---
export const recordatorioDatosFlow = addKeyword(EVENTS.ACTION)
  .addAction(async (ctx, { flowDynamic }) => {
    await flowDynamic(
      '⏰ *Recordatorio: Activación de perfil pendiente*\n\n' +
      'Tu rol fue cambiado a Practicante, pero tu perfil aún no está activo.\n\n' +
      '👉 *Envía cualquier mensaje* para activar tu perfil automáticamente.\n\n' +
      'Este recordatorio se enviará cada 6 horas hasta que se complete el proceso.'
    );
  });

export const END = { key: 'END', text: 'Fin del flujo' };