import { addKeyword } from '@builderbot/bot';
import { setRolTelefono, getRolTelefono, createUsuarioBasico, ensureRolMapping, obtenerUsuario } from '../../queries/queries.js';
import { 
  validarCambioRolPosible, 
  revertirPracticanteAUsuario 
} from '../../queries/cambioRol.js';
import { 
  notificarCambioRol, 
  iniciarRecoleccionDatos, 
  notificarAdministrador,
  notificarError 
} from '../../helpers/notificacionesCambioRol.js';

const MENU = `
*👑 Menú Administrador*

1️⃣ Cambiar rol de usuario existente
2️⃣ Crear nuevo usuario con rol  
3️⃣ Ver rol actual de un número
4️⃣ Ver usuarios pendientes de completar datos
9️⃣ Salir

Responde con el número de la opción.
`;

const askPhone = '📱 Envíame el *número* (con o sin +57).';
const askRole  = '🎭 ¿Qué rol quieres asignar? Escribe: *usuario*, *practicante* o *admin*.';

const validRoles = new Set(['usuario', 'practicante', 'admin']);
const normalizePhone = (raw) => (raw || '').replace(/\D/g, '');

// ===============================================================================================

export const adminEntryFlow = addKeyword(['admin'])
  .addAction(async (ctx, { state, gotoFlow, flowDynamic }) => {
    console.log('🔐 AdminEntryFlow - Usuario ya verificado en welcomeFlow');
    
    const user = await state.get('user');
    console.log('👤 User en estado:', user);
    
    if (!user || !user.data || user.data.rol !== 'admin') {
      console.log('❌ Error: Usuario perdió estado admin');
      await flowDynamic('❌ Error de sesión. Escribe "menu" para reintentar.');
      return 
    }
    
    await state.update({ currentFlow: 'admin' });
    await flowDynamic('👑 Accediendo al panel de administración...');
    
    console.log('🔀 Redirigiendo a adminMenuFlow');
    return gotoFlow(adminMenuFlow);
  });

// ===============================================================================================
export const adminMenuFlow = addKeyword(['menu'])
  .addAction(async (_, { state }) => {
    await state.update({ currentFlow: 'admin' });
  })
  .addAnswer(
    MENU, 
    { capture: true }, 
    async (ctx, { state, flowDynamic, gotoFlow, fallBack }) => {
      console.log('📥 Admin Menu - Opción recibida:', ctx.body);
      const opt = (ctx.body || '').trim();
      
// Validar opción
      if (!['1','2','3','4','9'].includes(opt)) {
        return fallBack('❌ Opción inválida. Responde con *1*, *2*, *3*, *4* o *9*.');        
      }

      // Opción de salir
      if (opt === '9') {
        await state.update({ currentFlow: null });
        await state.clear();
        return await flowDynamic('👋 Saliendo del menú admin.');
      }

      // Guardar opción
      console.log('✅ Opción válida, guardando:', opt);
      await state.update({ admin_opt: opt });
      
      console.log('🔀 Redirigiendo a adminPedirTelefonoFlow');      
      return gotoFlow(adminPedirTelefonoFlow);
    }
  );

// ===============================================================================================

export const adminPedirTelefonoFlow = addKeyword(['__capture_only__'])
  .addAnswer(
    askPhone,
    { capture: true }, 
    async (ctx, { state, flowDynamic, gotoFlow }) => {
      console.log('📥 Teléfono recibido:', ctx.body);
      
      const stepOpt = await state.get('admin_opt');
      
      // Verificar que exista la opción guardada
      if (!stepOpt) {
        console.log('⚠️ No hay admin_opt, reiniciando');
        await flowDynamic('⚠️ Se perdió la opción. Reiniciemos.');
        await state.clear();
        return gotoFlow(adminMenuFlow);
      }

      // Evitar que se envíe otra opción de menú
      if (['1','2','3','9'].includes(ctx.body.trim())) {
        await flowDynamic('Ya escogiste una opción, ahora envíame el *número de teléfono*.');
        return gotoFlow(adminPedirTelefonoFlow);
      }

      // Validar teléfono
      const phone = normalizePhone(ctx.body);
      if (!phone || phone.length < 8) {
        await flowDynamic('❌ Número inválido. Escribe solo números, al menos 8 dígitos.');
        return gotoFlow(adminPedirTelefonoFlow);
      }

      console.log('✅ Teléfono normalizado:', phone);
      await state.update({ admin_phone: phone });

// OPCIÓN 3: Ver rol actual
      if (stepOpt === '3') {
        console.log('🔍 Consultando rol para:', phone);
        try {
          const mapping = await getRolTelefono(phone);
          const rol = mapping?.rol ?? 'no asignado';
          await flowDynamic(`📌 Rol actual de ${phone}: *${rol}*`);
        } catch (err) {
          console.error('Error consultando rol:', err);
          await flowDynamic('❌ Error consultando el rol.');
        }
        
        await state.clear();
        console.log('🔙 Volviendo a adminMenuFlow');
        return gotoFlow(adminMenuFlow);
      }

      // OPCIÓN 4: Ver usuarios pendientes
      if (stepOpt === '4') {
        console.log('🔍 Buscando usuarios pendientes...');
        await flowDynamic('🔍 Buscando usuarios pendientes de completar datos...');
        
        try {
          const { verificarUsuariosPendientes } = await import('../../helpers/notificacionesCambioRol.js');
          const pendientes = await verificarUsuariosPendientes();
          
          if (pendientes.length === 0) {
            await flowDynamic('✅ No hay usuarios pendientes de completar datos.');
          } else {
            await flowDynamic(`📋 *Usuarios pendientes (${pendientes.length}):*\n\n` + 
              pendientes.map(tel => `📱 ${tel}`).join('\n') + 
              '\n\nEstos usuarios recibirán recordatorios automáticos.');
          }
        } catch (err) {
          console.error('Error verificando usuarios pendientes:', err);
          await flowDynamic('❌ Error al verificar usuarios pendientes.');
        }
        
        await state.clear();
        console.log('🔙 Volviendo a adminMenuFlow');
        return gotoFlow(adminMenuFlow);
      }

      // Opciones 1 y 2: continuar
      console.log('🔀 Continuando a adminAsignarRolFlow');
      return gotoFlow(adminAsignarRolFlow);
    }
  );
// ===============================================================================================

export const adminAsignarRolFlow = addKeyword(['__capture_only__'])
  .addAction(async (_, { state }) => {
    console.log('👤 Admin Asignar Rol - Inicializado');
    
    // Enviar pregunta solo si es la primera vez
    const roleAsked = await state.get('role_asked');
    if (!roleAsked) {
      await state.update({ role_asked: true });
    }
  })
  .addAnswer(
    askRole,
    { capture: true },
    async (ctx, { state, flowDynamic, gotoFlow }) => {
      console.log('📥 Rol recibido:', ctx.body);
      const stepOpt = await state.get('admin_opt');
      const phone   = await state.get('admin_phone');
      
      // Verificar que existan los datos necesarios
      if (!stepOpt || !phone) {
        console.log('⚠️ Falta stepOpt o phone, reiniciando');
        await state.clear();
        await flowDynamic('⚠️ Se perdió el estado. Reiniciemos.');
        return gotoFlow(adminMenuFlow);
      }

      // Validar rol
      const rol = (ctx.body || '').trim().toLowerCase();
      if (!validRoles.has(rol)) {
        await flowDynamic('❌ Rol inválido. Escribe: *usuario*, *practicante* o *admin*.');
        return gotoFlow(adminAsignarRolFlow);
      }

// Procesar la asignación
      console.log('✅ Procesando:', { stepOpt, phone, rol });
      
      try {
        if (stepOpt === '1') {
          // OPCIÓN 1: Cambiar rol de usuario existente (con migración de datos)
          const resultado = await procesarCambioRolConMigracion(phone, rol);
          await flowDynamic(resultado.message);
          
          // Notificar al administrador del resultado
          await notificarAdministrador(ctx.from, {
            telefono: phone,
            rolAnterior: resultado.rolAnterior,
            rolNuevo: rol,
            realizadoPor: ctx.from,
            exito: resultado.exito,
            error: resultado.error
          });
          
        } else if (stepOpt === '2') {
          // OPCIÓN 2: Crear nuevo usuario con rol (sin migración)
          if (rol === 'usuario') {
            await createUsuarioBasico(phone, {});
            await flowDynamic(`✅ Usuario ${phone} creado con rol *usuario*.`);
          } else if (rol === 'practicante') {
            // Para practicantes nuevos, iniciar recolección de datos
            const resultadoValidacion = await validarCambioRolPosible(phone, rol);
            if (!resultadoValidacion.valido) {
              await flowDynamic(`❌ ${resultadoValidacion.error}`);
              throw new Error(resultadoValidacion.error);
            }
            
            await setRolTelefono(phone, rol);
            await flowDynamic(`✅ Rol asignado. Enviando notificación a ${phone} para completar datos...`);
            await iniciarRecoleccionDatos(phone, rol);
          } else {
            await ensureRolMapping(phone, rol);
            await flowDynamic(`✅ Creado/asignado ${phone} con rol *${rol}*.`);
          }
        }
      } catch (err) {
        console.error('ADMIN_MENU error:', err);
        await flowDynamic('❌ Error realizando la operación.');
        await notificarError(ctx.from, err.message, { phone, rol, stepOpt });
      }

      // Limpiar y volver al menú
      await state.clear();
      console.log('🔙 Volviendo a adminMenuFlow');
      return gotoFlow(adminMenuFlow);
    }
  );

// ===============================================================================================

/**
 * Procesa el cambio de rol con migración de datos
 * @param {string} telefono - Teléfono del usuario
 * @param {string} nuevoRol - Nuevo rol a asignar
 * @param {string} adminTelefono - Teléfono del administrador que realiza el cambio
 * @returns {Object} { exito: boolean, message: string, rolAnterior?: string, error?: string }
 */
async function procesarCambioRolConMigracion(telefono, nuevoRol) {
  try {
    // Obtener rol actual
    const rolActualInfo = await getRolTelefono(telefono);
    const rolAnterior = rolActualInfo?.rol || 'sin asignar';
    
    console.log(`🔄 Cambiando rol: ${telefono} de ${rolAnterior} a ${nuevoRol}`);
    
    // Validar si el cambio es posible
    const validacion = await validarCambioRolPosible(telefono, nuevoRol);
    if (!validacion.valido) {
      return { 
        exito: false, 
        message: `❌ ${validacion.error}`, 
        rolAnterior 
      };
    }
    
    // Caso 1: Usuario → Practicante (requiere recolección de datos)
    if (rolAnterior === 'usuario' && nuevoRol === 'practicante') {
      await setRolTelefono(telefono, nuevoRol);
      await iniciarRecoleccionDatos(telefono, nuevoRol);
      
      return { 
        exito: true, 
        message: `✅ Rol de ${telefono} cambiado a *practicante*.\n\n📱 El usuario recibirá notificaciones para completar sus datos.`, 
        rolAnterior 
      };
    }
    
    // Caso 2: Practicante → Usuario (requiere reversión)
    if (rolAnterior === 'practicante' && nuevoRol === 'usuario') {
      const resultado = await revertirPracticanteAUsuario(telefono);
      
      if (!resultado.exito) {
        return { 
          exito: false, 
          message: `❌ Error al revertir rol: ${resultado.error}`, 
          rolAnterior 
        };
      }
      
      // Enviar notificación al usuario
      await notificarCambioRol(telefono, nuevoRol, { 
        datosPrecargados: resultado.datosPrecargados 
      });
      
      return { 
        exito: true, 
        message: `✅ Rol de ${telefono} cambiado a *usuario*.\n\n📱 Se ha enviado notificación para completar registro web.\n🗑️ Pacientes asignados han sido liberados.`, 
        rolAnterior 
      };
    }
    
    // Caso 3: Cambios simples (otros roles)
    await setRolTelefono(telefono, nuevoRol);
    await notificarCambioRol(telefono, nuevoRol);
    
    return { 
      exito: true, 
      message: `✅ Rol de ${telefono} cambiado de *${rolAnterior}* a *${nuevoRol}*.\n\n📱 Se ha enviado notificación al usuario.`, 
      rolAnterior 
    };
    
  } catch (error) {
    console.error('Error en procesarCambioRolConMigracion:', error);
    return { 
      exito: false, 
      message: `❌ Error al procesar cambio de rol: ${error.message}`, 
      rolAnterior: 'desconocido',
      error: error.message
    };
  }
}

export const adminMenuMiddleware = addKeyword(['menu'])
  .addAction(async (ctx, { state, gotoFlow, endFlow }) => {
    console.log('📋 Middleware menu - verificando si es admin');
    const user = state.get('user') || await obtenerUsuario(ctx.from);
    
    if (user && user.rol === 'admin') {
      console.log('✅ Usuario es admin, redirigiendo a menú');
      await state.update({ 
        user: user,
        currentFlow: 'admin'
      });
      return gotoFlow(adminMenuFlow);
    }
    
    console.log('❌ Usuario no es admin, ignorando');
    return endFlow();
  });