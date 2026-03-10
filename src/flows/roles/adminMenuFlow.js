import { addKeyword } from '@builderbot/bot';
import { setRolTelefono, getRolTelefono, createUsuarioBasico, ensureRolMapping } from '../../queries/queries.js';
import { prisma } from '../../queries/queries.js';
import {
  validarCambioRolPosible,
  revertirPracticanteAUsuario,
  migrarUsuarioAPracticante,
  validarHorario
} from '../../queries/cambioRol.js';
import {
  notificarCambioRol,
  notificarAdministrador,
  notificarError,
  verificarUsuariosPendientes
} from '../../helpers/notificacionesCambioRol.js';

const MENU = `
  *👑 Menú Administrador*

1️⃣ Cambiar rol de usuario existente
2️⃣ Crear nuevo usuario con rol
3️⃣ Ver rol actual de un número
4️⃣ Ver usuarios pendientes de completar datos
5️⃣ Editar datos de practicante(EPS / IPS, clínica, horarios)
9️⃣ Salir

Responde con el número de la opción.
`;

const askPhone = '📱 Envíame el *número* (con o sin +57).';
const askRole = '🎭 ¿Qué rol quieres asignar? Escribe: *usuario*, *practicante* o *admin*.';

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
export const adminMenuFlow = addKeyword(['__ADMIN_MENU__'])
  .addAction(async (_, { state }) => {
    await state.update({ currentFlow: 'admin_menu' });
  })
  .addAnswer(
    MENU,
    { capture: true },
    async (ctx, { state, flowDynamic, gotoFlow, fallBack }) => {
      console.log('📥 Admin Menu - Opción recibida:', ctx.body);
      const opt = (ctx.body || '').trim();

      // Validar opción
      if (!['1', '2', '3', '4', '5', '9'].includes(opt)) {
        return fallBack('❌ Opción inválida. Responde con *1*, *2*, *3*, *4*, *5* o *9*.');
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
  .addAction(async (_, { state }) => {
    await state.update({ currentFlow: 'admin_pedir_telefono' });
  })
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
      if (['1', '2', '3'].includes(ctx.body.trim())) {
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
          const rol = mapping?.rol ?? 'usuario';
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
          const pendientes = await verificarUsuariosPendientes();

          if (pendientes.length === 0) {
            await flowDynamic('✅ No hay usuarios pendientes de completar datos.');
          } else {
            await flowDynamic(`📋 * Usuarios pendientes(${pendientes.length}):*\n\n` +
              pendientes.map(tel => `📱 ${tel} `).join('\n') +
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

      // OPCIÓN 5: Editar datos de practicante
      if (stepOpt === '5') {
        // Gó directo al flujo de editar practicante sin necesitar el rol de asignar
        console.log('🖊️ Admin editar practicante para:', phone);
        return gotoFlow(adminEditarPracticanteFlow);
      }

      // Opciones 1 y 2: continuar
      console.log('🔀 Continuando a adminAsignarRolFlow');
      return gotoFlow(adminAsignarRolFlow);
    }
  );

// ===============================================================================================

export const adminEditarPracticanteFlow = addKeyword(['__edit_practicante__'])
  .addAction(async (ctx, { state, flowDynamic, gotoFlow }) => {
    await state.update({ currentFlow: 'admin_editar_practicante' });
    const phone = await state.get('admin_phone');
    console.log(`🖊️ Iniciando flujo guiado para: "${phone}"`);

    if (!phone) {
      await flowDynamic('❌ Error: No se especificó el teléfono del practicante.');
      return gotoFlow(adminMenuFlow);
    }

    const phoneVariants = [phone, phone.startsWith('57') ? phone.substring(2) : '57' + phone];
    const practicante = await prisma.practicante.findFirst({
      where: { telefono: { in: phoneVariants } },
      include: { horarios: true }
    });

    if (!practicante) {
      console.log('❌ Edición: Practicante no encontrado para variantes:', phoneVariants);
      await flowDynamic(`❌ No se encontró ningún practicante con el teléfono *${phone}*.`);
      await state.clear();
      return gotoFlow(adminMenuFlow);
    }

    const horariosTexto = practicante.horarios.length > 0
      ? practicante.horarios.map(h => `  - ${h.dia}: ${h.horaInicio}:00–${h.horaFin}:00`).join('\n')
      : '  Sin horarios registrados';

    await flowDynamic(
      `✅ Cambio de rol realizado correctamente.\n` +
      `El usuario ahora tiene el rol de practicante.\n\n` +
      `👤 Resumen actual del practicante:\n` +
      `👤 Practicante: ${practicante.nombre}\n` +
      `🪪 Documento: ${practicante.numero_documento}\n` +
      `🏥 EPS/IPS: ${practicante.eps_ips || 'No registrado'}\n` +
      `🏥 Clínica: ${practicante.clinica || 'No registrada'}\n` +
      `🕒 Horarios:\n${horariosTexto}`
    );

    await flowDynamic('📋 Completa los datos faltantes:');
  })
  .addAnswer(
    'Agrega la EPS/IPS del practicante (escribe "saltar" si no dispones de esta información):',
    { capture: true },
    async (ctx, { state, flowDynamic, gotoFlow }) => {
      const valor = (ctx.body || '').trim();
      if (valor.toLowerCase() === 'saltar') return gotoFlow(adminEditarPracticanteClinicaFlow);

      const phone = await state.get('admin_phone');
      const phoneVariants = [phone, phone.startsWith('57') ? phone.substring(2) : '57' + phone];

      await prisma.practicante.updateMany({
        where: { telefono: { in: phoneVariants } },
        data: { eps_ips: valor }
      });

      await flowDynamic(`✅ EPS/IPS guardada correctamente.`);
      return gotoFlow(adminEditarPracticanteClinicaFlow);
    }
  );

export const adminEditarPracticanteClinicaFlow = addKeyword(['__edit_pract_clinica__'])
  .addAction(async (_, { state }) => {
    await state.update({ currentFlow: 'admin_editar_clinica' });
  })
  .addAnswer(
    'Agrega la clínica del practicante (escribe "saltar" si no dispones de esta información):',
    { capture: true },
    async (ctx, { state, flowDynamic, gotoFlow }) => {
      const valor = (ctx.body || '').trim();
      if (valor.toLowerCase() === 'saltar') return gotoFlow(adminEditarPracticanteHorarioFlow);

      const phone = await state.get('admin_phone');
      const phoneVariants = [phone, phone.startsWith('57') ? phone.substring(2) : '57' + phone];

      await prisma.practicante.updateMany({
        where: { telefono: { in: phoneVariants } },
        data: { clinica: valor }
      });

      await flowDynamic(`✅ Clínica guardada correctamente.`);
      return gotoFlow(adminEditarPracticanteHorarioFlow);
    }
  );

export const adminEditarPracticanteHorarioFlow = addKeyword(['__edit_pract_horario__'])
  .addAction(async (_, { state }) => {
    await state.update({ currentFlow: 'admin_editar_horario' });
  })
  .addAnswer(
    'Agrega un horario del practicante:',
    { capture: true },
    async (ctx, { state, flowDynamic, gotoFlow, fallBack }) => {
      const valor = (ctx.body || '').trim();
      if (valor.toLowerCase() === 'saltar') {
        await flowDynamic('✅ *Proceso de registro de practicante finalizado.*');
        await state.clear();
        return gotoFlow(adminMenuFlow);
      }

      const partes = valor.split(' ');
      if (partes.length !== 3) {
        return fallBack('❌ Formato incorrecto. Usa: *Día HoraInicio HoraFin*  Ej: Lunes 8 17');
      }

      const [dia, horaInicio, horaFin] = partes;
      const validacion = validarHorario({ dia, horaInicio, horaFin });

      if (!validacion.valido) {
        return fallBack(`❌ ${validacion.error}`);
      }

      const diaToEnum = {
        'lunes': 'LUNES', 'martes': 'MARTES', 'miercoles': 'MIERCOLES', 'miércoles': 'MIERCOLES',
        'jueves': 'JUEVES', 'viernes': 'VIERNES', 'sabado': 'SABADO', 'sábado': 'SABADO', 'domingo': 'DOMINGO'
      };
      const diaEnum = diaToEnum[dia.toLowerCase()] || dia.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      const phone = await state.get('admin_phone');
      const phoneVariants = [phone, phone.startsWith('57') ? phone.substring(2) : '57' + phone];
      const practicante = await prisma.practicante.findFirst({ where: { telefono: { in: phoneVariants } } });

      await prisma.horario.create({
        data: {
          dia: diaEnum,
          horaInicio: parseInt(horaInicio),
          horaFin: parseInt(horaFin),
          practicanteId: practicante.idPracticante
        }
      });

      return gotoFlow(adminEditarPracticanteOtroHorarioFlow);
    }
  );

export const adminEditarPracticanteOtroHorarioFlow = addKeyword(['__edit_pract_otro__'])
  .addAction(async (ctx, { state }) => {
    await state.update({ currentFlow: 'admin_editar_otro_horario' });
  })
  .addAnswer(
    '✅ Horario agregado correctamente.\n¿Deseas agregar otro horario? (sí/no):',
    { capture: true },
    async (ctx, { state, flowDynamic, gotoFlow }) => {
      const resp = (ctx.body || '').trim().toLowerCase();

      if (resp === 'si' || resp === 'sí') {
        return gotoFlow(adminEditarPracticanteHorarioFlow);
      } else {
        await flowDynamic('✅ *Proceso de registro de practicante finalizado.*');
        await state.clear();
        return gotoFlow(adminMenuFlow);
      }
    }
  );

// ===============================================================================================

export const adminAsignarRolFlow = addKeyword(['__capture_only__'])
  .addAction(async (_, { state }) => {
    console.log('👤 Admin Asignar Rol - Inicializado');
    await state.update({ currentFlow: 'admin_asignar_rol' });

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
      const phone = await state.get('admin_phone');

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
          // OPCIÓN 1: Cambiar rol de usuario existente
          const resultado = await procesarCambioRolConMigracion(phone, rol);

          if (!resultado.exito) {
            await flowDynamic(resultado.message);
            await state.clear();
            return gotoFlow(adminMenuFlow);
          }

          // Si se creó un practicante, completar datos en el mismo flujo guiado
          if (resultado.requiereCompletar) {
            const finalPhone = resultado.telefonoReal || phone;
            await state.update({ admin_phone: finalPhone });
            return gotoFlow(adminEditarPracticanteFlow);
          }

          // Para otros roles exitosos, notificar y volver
          await flowDynamic(resultado.message);
          await notificarAdministrador({
            telefono: phone,
            rolAnterior: resultado.rolAnterior,
            rolNuevo: rol,
            realizadoPor: ctx.from,
            exito: resultado.exito,
            error: resultado.error
          });

          await state.clear();
          return gotoFlow(adminMenuFlow);

        } else if (stepOpt === '2') {
          // OPCIÓN 2: Crear nuevo usuario con rol
          if (rol === 'usuario') {
            await createUsuarioBasico(phone, {});
            await flowDynamic(`✅ Usuario ${phone} creado con rol *usuario*.`);
          } else if (rol === 'practicante') {
            const resultadoValidacion = await validarCambioRolPosible(phone, rol);
            if (!resultadoValidacion.valido) {
              await flowDynamic(`❌ ${resultadoValidacion.error}`);
              throw new Error(resultadoValidacion.error);
            }
            // Migrar directamente (crear registro practicante)
            const migracion = await migrarUsuarioAPracticante(phone);
            if (!migracion.exito) {
              await flowDynamic(`❌ Error al crear practicante: ${migracion.error}`);
              throw new Error(migracion.error);
            }
            await state.update({ admin_phone: migracion.practicante.telefono });
            return gotoFlow(adminEditarPracticanteFlow);
          } else {
            await ensureRolMapping(phone, rol);
            await flowDynamic(`✅ Creado/asignado ${phone} con rol *${rol}*.`);
            await state.clear();
            return gotoFlow(adminMenuFlow);
          }
        }
      } catch (err) {
        console.error('ADMIN_MENU error:', err);
        await flowDynamic('❌ Error realizando la operación.');
        await notificarError(ctx.from, err.message, { phone, rol, stepOpt });

        await state.clear();
        return gotoFlow(adminMenuFlow);
      }
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
    // Obtener rol actual (default: usuario)
    const rolActualInfo = await getRolTelefono(telefono);
    const rolAnterior = rolActualInfo?.rol || 'usuario';

    console.log(`🔄 Cambiando rol: ${telefono} de ${rolAnterior} a ${nuevoRol}`);

    // Validar si el cambio es posible
    const validacion = await validarCambioRolPosible(telefono, nuevoRol);
    if (!validacion.valido) {
      return {
        exito: false,
        message: `❌ ${validacion.error} `,
        rolAnterior
      };
    }

    // Caso 1: Usuario → Practicante: migrar directamente y pedir datos al admin
    if (rolAnterior === 'usuario' && nuevoRol === 'practicante') {
      const migracion = await migrarUsuarioAPracticante(telefono);

      if (!migracion.exito) {
        return {
          exito: false,
          message: `❌ Error al crear practicante: ${migracion.error}`,
          rolAnterior
        };
      }

      return {
        exito: true,
        message: `✅ *${telefono}* convertido a practicante exitosamente.`,
        rolAnterior,
        telefonoReal: migracion.practicante.telefono, // <-- IMPORTANTE: Devolvemos el número exacto de la DB
        requiereCompletar: true
      };
    }

    // Caso 2: Practicante → Usuario (requiere reversión)
    if (rolAnterior === 'practicante' && nuevoRol === 'usuario') {
      const resultado = await revertirPracticanteAUsuario(telefono);

      if (!resultado.exito) {
        return {
          exito: false,
          message: `❌ Error al revertir rol: ${resultado.error} `,
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
      message: `❌ Error al procesar cambio de rol: ${error.message} `,
      rolAnterior: 'desconocido',
      error: error.message
    };
  }
}
