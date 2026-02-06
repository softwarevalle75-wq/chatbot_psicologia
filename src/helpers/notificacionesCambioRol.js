import { adapterProvider } from '../app.js';
import { prisma } from '../queries/queries.js';

/**
 * Envía notificación de cambio de rol a un usuario
 * @param {string} telefono - Teléfono del usuario a notificar
 * @param {string} nuevoRol - Nuevo rol asignado ('usuario' | 'practicante' | 'admin')
 * @param {Object} opciones - Opciones adicionales
 * @returns {Object} { exito: boolean, error?: string }
 */
export async function notificarCambioRol(telefono, nuevoRol, opciones = {}) {
  try {
    let mensaje = '';
    
    switch (nuevoRol) {
      case 'practicante':
        mensaje = opciones.esMigracion 
          ? '🎉 *¡Has sido promovido a Practicante!*\n\n' +
            'Para completar tu perfil, por favor responde a las siguientes preguntas que te enviaré a continuación.\n\n' +
            'Esto es necesario para que puedas recibir pacientes y agendar citas.'
          : '🎉 *¡Tu rol ha sido actualizado a Practicante!*\n\n' +
            'Ya puedes acceder a las funciones de practicante en el sistema.';
        break;
        
      case 'usuario':
        mensaje = '⚠️ *Tu rol ha sido cambiado a Usuario*\n\n' +
          'Tu perfil de practicante ha sido eliminado y ya no tienes pacientes asignados.\n\n' +
          'Para continuar usando el sistema, por favor completa tu registro en el siguiente enlace:\n' +
          '🔗 https://tu-sitio.com/register\n\n' +
          opciones.datosPrecargados ? 'Tus datos estarán precargados para tu comodidad.' : '';
        break;
        
      case 'admin':
        mensaje = '👑 *¡Has sido promovido a Administrador!*\n\n' +
          'Ahora tienes acceso a las funciones administrativas del sistema.\n\n' +
          'Usa este poder con responsabilidad.';
        break;
        
      default:
        return { exito: false, error: 'Rol no válido' };
    }
    
    // Enviar mensaje usando el provider
    await adapterProvider.sendMessage(telefono, mensaje);
    
    console.log(`✅ Notificación de cambio de rol enviada a ${telefono}: ${nuevoRol}`);
    return { exito: true };
    
  } catch (error) {
    console.error('Error en notificarCambioRol:', error);
    return { exito: false, error: 'Error al enviar notificación' };
  }
}

/**
 * Envía recordatorio de datos pendientes
 * @param {string} telefono - Teléfono del usuario
 * @param {string} rolPendiente - Rol que necesita completar datos
 * @returns {Object} { exito: boolean, error?: string }
 */
export async function enviarRecordatorioDatos(telefono, rolPendiente) {
  try {
    let mensaje = '';
    
    if (rolPendiente === 'practicante') {
      mensaje = '⏰ *Recordatorio: Datos pendientes de completar*\n\n' +
        'Te cambiaron el rol a Practicante pero aún no has completado tus datos.\n\n' +
        'Para poder recibir pacientes y citas, necesitas completar tu perfil.\n\n' +
        'Escribe *completar datos* cuando estés listo para continuar.\n\n' +
        'Este recordatorio se enviará cada 6 horas hasta que completes el proceso.';
    }
    
    await adapterProvider.sendMessage(telefono, mensaje);
    
    console.log(`📅 Recordatorio enviado a ${telefono} para rol ${rolPendiente}`);
    return { exito: true };
    
  } catch (error) {
    console.error('Error en enviarRecordatorioDatos:', error);
    return { exito: false, error: 'Error al enviar recordatorio' };
  }
}

/**
 * Inicia el proceso de recolección de datos para cambio de rol
 * @param {string} telefono - Teléfono del usuario
 * @param {string} nuevoRol - Nuevo rol a asignar
 * @param {Object} datosAdicionales - Datos adicionales para el proceso
 * @returns {Object} { exito: boolean, error?: string }
 */
export async function iniciarRecoleccionDatos(telefono, nuevoRol) {
  try {
    if (nuevoRol !== 'practicante') {
      return { exito: false, error: 'Este flujo solo es para rol de practicante' };
    }
    
    // Pequeña pausa para que el usuario lea
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    
    
    console.log(`🚀 Proceso de recolección de datos iniciado para ${telefono}`);
    return { exito: true };
    
  } catch (error) {
    console.error('Error en iniciarRecoleccionDatos:', error);
    return { exito: false, error: 'Error al iniciar recolección de datos' };
  }
}

/**
 * Verifica si hay usuarios pendientes de completar datos y envía recordatorios
 * @returns {Array} Lista de usuarios notificados
 */
export async function verificarUsuariosPendientes() {
  try {
    const usuariosPendientes = [];
    
    // Buscar usuarios con rol 'practicante' pero sin registro en tabla practicante
    const rolesPracticante = await prisma.rolChat.findMany({
      where: { rol: 'practicante' }
    });
    
    for (const rol of rolesPracticante) {
      const existePracticante = await prisma.practicante.findUnique({
        where: { telefono: rol.telefono }
      });
      
      if (!existePracticante) {
        usuariosPendientes.push(rol.telefono);
      }
    }
    
    // Enviar recordatorios a usuarios pendientes
    const notificacionesEnviadas = [];
    for (const telefono of usuariosPendientes) {
      const resultado = await enviarRecordatorioDatos(telefono, 'practicante');
      if (resultado.exito) {
        notificacionesEnviadas.push(telefono);
      }
    }
    
    console.log(`📊 Usuarios pendientes encontrados: ${usuariosPendientes.length}`);
    console.log(`📤 Recordatorios enviados: ${notificacionesEnviadas.length}`);
    
    return notificacionesEnviadas;
    
  } catch (error) {
    console.error('Error en verificarUsuariosPendientes:', error);
    return [];
  }
}

/**
 * Notifica al administrador sobre cambios importantes
 * @param {Object} cambio - Información del cambio realizado
 * @returns {Object} { exito: boolean, error?: string }
 */
export async function notificarAdministrador(cambio) {
  try {
    // Obtener teléfono del administrador desde variables de entorno
    const telefonoAdminConfig = process.env.PRIMER_ADMIN;
    
    if (!telefonoAdminConfig) {
      console.error('❌ No hay teléfono de administrador configurado en variables de entorno');
      return { exito: false, error: 'No hay teléfono de administrador configurado' };
    }
    
    let mensaje = `📋 *Notificación de Cambio de Rol*\n\n` +
      `📱 Teléfono: ${cambio.telefono}\n` +
      `🔄 Cambio: ${cambio.rolAnterior} → ${cambio.rolNuevo}\n` +
      `👤 Realizado por: ${cambio.realizadoPor}\n` +
      `⏰ Fecha: ${new Date().toLocaleString('es-CO')}\n\n` +
      `Estado: ${cambio.exito ? '✅ Completado' : '❌ Fallido'}`;
    
    if (cambio.error) {
      mensaje += `\n❌ Error: ${cambio.error}`;
    }
    
    await adapterProvider.sendMessage(telefonoAdminConfig, mensaje);
    
    console.log(`📢 Notificación enviada al administrador`);
    return { exito: true };
    
  } catch (error) {
    console.error('Error en notificarAdministrador:', error);
    return { exito: false, error: 'Error al notificar al administrador' };
  }
}

/**
 * Envía mensaje de bienvenida a nuevos practicantes
 * @param {string} telefono - Teléfono del nuevo practicante
 * @param {Object} datosPracticante - Datos del practicante
 * @returns {Object} { exito: boolean, error?: string }
 */
export async function enviarBienvenidaPracticante(telefono, datosPracticante) {
  try {
    let mensaje = `🎉 *¡Bienvenido al equipo de practicantes!*\n\n` +
      `Hola ${datosPracticante.nombre},\n\n` +
      `Tu perfil de practicante ha sido activado exitosamente.\n\n` +
      `📋 *Tus datos registrados:*\n` +
      `📱 Teléfono: ${telefono}\n` +
      `🆔 Documento: ${datosPracticante.numero_documento}\n` +
      `👥 Género: ${datosPracticante.genero}\n` +
      `🏘️ Estrato: ${datosPracticante.estrato}\n` +
      `📍 Barrio: ${datosPracticante.barrio}\n` +
      `🏙️ Localidad: ${datosPracticante.localidad}\n\n` +
      `⏰ *Tus horarios de atención:*\n` +
      (datosPracticante.horarios?.map(h => `- ${h.dia}: ${h.horaInicio}:00 - ${h.horaFin}:00`).join('\n') || 'No hay horarios registrados') + '\n\n' +
      `🚀 *¿Qué puedes hacer ahora?*\n` +
      `• Recibir pacientes asignados\n` +
      `• Agendar citas\n` +
      `• Recibir notificaciones cuando los pacientes completen pruebas\n` +
      `• Acceder a herramientas de apoyo profesional\n\n` +
      `Para empezar, envía *menu* al bot.\n\n` +
      `¡Estamos para apoyarte! 🌟`;
    
    await adapterProvider.sendMessage(telefono, mensaje);
    
    console.log(`👋 Bienvenida enviada a nuevo practicante ${telefono}`);
    return { exito: true };
    
  } catch (error) {
    console.error('Error en enviarBienvenidaPracticante:', error);
    return { exito: false, error: 'Error al enviar bienvenida' };
  }
}

/**
 * Programa recordatorios automáticos para usuarios pendientes
 * @param {number} intervaloHoras - Intervalo en horas entre recordatorios (default: 6)
 */
export function programarRecordatoriosAutomaticos(intervaloHoras = 6) {
  const intervaloMs = intervaloHoras * 60 * 60 * 1000;
  
  setInterval(async () => {
    console.log('🕐 Ejecutando verificación automática de usuarios pendientes...');
    await verificarUsuariosPendientes();
  }, intervaloMs);
  
  console.log(`⏰ Recordatorios automáticos programados cada ${intervaloHoras} horas`);
}

/**
 * Envía notificación de error al administrador
 * @param {string} telefonoAdmin - Teléfono del administrador
 * @param {string} error - Mensaje de error
 * @param {Object} contexto - Contexto adicional del error
 * @returns {Object} { exito: boolean, error?: string }
 */
export async function notificarError(telefonoAdmin, error, contexto = {}) {
  try {
    // Obtener teléfono del administrador desde variables de entorno
    const telefonoAdminConfig = process.env.ADMIN_PHONE || process.env.PRIMER_ADMIN || telefonoAdmin;
    
    if (!telefonoAdminConfig) {
      console.error('❌ No hay teléfono de administrador configurado en variables de entorno');
      return { exito: false, error: 'No hay teléfono de administrador configurado' };
    }
    
    const mensaje = `🚨 *Error en el Sistema de Cambio de Roles*\n\n` +
      `❌ Error: ${error}\n` +
      `📱 Usuario: ${contexto.telefono || 'No especificado'}\n` +
      `⏰ Fecha: ${new Date().toLocaleString('es-CO')}\n` +
      `🔧 Contexto: ${JSON.stringify(contexto, null, 2)}\n\n` +
      `Por favor revisar el sistema y tomar las acciones necesarias.`;
    
    await adapterProvider.sendMessage(telefonoAdminConfig, mensaje);
    
    console.log(`🚨 Notificación de error enviada al administrador`);
    return { exito: true };
    
  } catch (err) {
    console.error('Error en notificarError:', err);
    return { exito: false, error: 'Error al notificar error' };
  }
}