import { prisma } from './queries.js';
import { setRolTelefono } from './queries.js';

// Normaliza el número (solo dígitos)
const normalizePhone = (raw) => (raw || '').replace(/\D/g, '');

/**
 * Valida si es posible cambiar el rol de un usuario
 * @param {string} telefono - Teléfono del usuario
 * @param {string} rolDestino - Rol al que se quiere cambiar ('usuario' | 'practicante' | 'admin')
 * @returns {Object} { valido: boolean, error?: string }
 */
export async function validarCambioRolPosible(telefono, rolDestino) {
  const phone = normalizePhone(telefono);
  
  try {
    // Obtener rol actual
    const rolActual = await prisma.rolChat.findUnique({
      where: { telefono: phone }
    });

    if (rolActual && rolActual.rol === rolDestino) {
      return { valido: false, error: `El usuario ya tiene el rol ${rolDestino}` };
    }

    // Validar que no exista ya en tabla destino
    if (rolDestino === 'practicante') {
      const existePracticante = await prisma.practicante.findUnique({
        where: { telefono: phone }
      });
      if (existePracticante) {
        return { valido: false, error: 'Este teléfono ya está registrado como practicante' };
      }
    }

    if (rolDestino === 'usuario') {
      const existeUsuario = await prisma.informacionUsuario.findUnique({
        where: { telefonoPersonal: phone }
      });
      if (existeUsuario) {
        return { valido: false, error: 'Este teléfono ya está registrado como usuario' };
      }
    }

    return { valido: true };
  } catch (error) {
    console.error('Error en validarCambioRolPosible:', error);
    return { valido: false, error: 'Error al validar cambio de rol' };
  }
}

/**
 * Migra usuario a practicante
 * @param {string} telefono - Teléfono del usuario
 * @param {Object} datosAdicionales - Datos adicionales requeridos para practicante
 * @returns {Object} { exito: boolean, error?: string, practicante?: Object }
 */
export async function migrarUsuarioAPracticante(telefono, datosAdicionales) {
  const phone = normalizePhone(telefono);
  
  try {
    // Obtener datos del usuario
    const usuario = await prisma.informacionUsuario.findUnique({
      where: { telefonoPersonal: phone }
    });

    if (!usuario) {
      return { exito: false, error: 'Usuario no encontrado' };
    }

    // Validar que el documento no exista ya en practicante
    if (usuario.documento) {
      const existeDocumento = await prisma.practicante.findUnique({
        where: { numero_documento: usuario.documento }
      });
      if (existeDocumento) {
        return { exito: false, error: 'Este documento ya está registrado como practicante' };
      }
    }

    // Preparar datos para migración
    const nombreCompleto = [usuario.primerNombre, usuario.segundoNombre, usuario.primerApellido, usuario.segundoApellido]
      .filter(Boolean)
      .join(' ');

    const datosPracticante = {
      nombre:           nombreCompleto || 'Sin nombre',
      telefono:         phone,
      numero_documento: usuario.documento || `DOC_${Date.now()}`,
      tipo_documento:   usuario.tipoDocumento || 'CC',
      genero:           datosAdicionales.genero,
      // Nuevos campos — opcionales, se completan desde la interfaz web
      correo:           datosAdicionales.correo     || null,
      eps_ips:          datosAdicionales.eps_ips    || null,
      clinica:          datosAdicionales.clinica    || null,
      fechaInicio:      datosAdicionales.fechaInicio ? new Date(datosAdicionales.fechaInicio) : null,
      fechaFin:         datosAdicionales.fechaFin   ? new Date(datosAdicionales.fechaFin)    : null,
      // Campos legacy — ya no se recopilan en el flujo del bot
      estrato:          datosAdicionales.estrato    || null,
      barrio:           datosAdicionales.barrio     || null,
      localidad:        datosAdicionales.localidad  || null,
      citasProgramadas: 0,
      fechaCreacion:    new Date()
    };

    // Crear practicante
    const practicante = await prisma.practicante.create({
      data: datosPracticante
    });

    // Crear horarios si se proporcionaron
    if (datosAdicionales.horarios && datosAdicionales.horarios.length > 0) {
      // Mapear nombres de día a valores del enum DiaSemana (MAYÚSCULAS, sin tildes)
      const diaToEnum = {
        'lunes': 'LUNES', 'martes': 'MARTES', 'miercoles': 'MIERCOLES', 'miércoles': 'MIERCOLES',
        'jueves': 'JUEVES', 'viernes': 'VIERNES', 'sabado': 'SABADO', 'sábado': 'SABADO',
        'domingo': 'DOMINGO'
      };
      const horariosData = datosAdicionales.horarios.map(horario => ({
        dia: diaToEnum[horario.dia.toLowerCase()] || horario.dia.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
        horaInicio: parseInt(horario.horaInicio),
        horaFin: parseInt(horario.horaFin),
        practicanteId: practicante.idPracticante
      }));

      await prisma.horario.createMany({
        data: horariosData
      });
    }

    // Eliminar usuario (para evitar duplicación)
    await prisma.informacionUsuario.delete({
      where: { telefonoPersonal: phone }
    });

    // Actualizar rol
    await setRolTelefono(phone, 'practicante');

    return { exito: true, practicante };
  } catch (error) {
    console.error('Error en migrarUsuarioAPracticante:', error);
    return { exito: false, error: 'Error al migrar usuario a practicante' };
  }
}

/**
 * Revierte practicante a usuario
 * @param {string} telefono - Teléfono del practicante
 * @returns {Object} { exito: boolean, error?: string, datosPrecargados?: Object }
 */
export async function revertirPracticanteAUsuario(telefono) {
  const phone = normalizePhone(telefono);
  
  try {
    // Obtener datos del practicante
    const practicante = await prisma.practicante.findUnique({
      where: { telefono: phone },
      include: { horarios: true }
    });

    if (!practicante) {
      return { exito: false, error: 'Practicante no encontrado' };
    }

    // Quitar asignación de pacientes
    await limpiarAsignacionesPacientes(practicante.idPracticante);

    // Eliminar horarios del practicante
    await prisma.horario.deleteMany({
      where: { practicanteId: practicante.idPracticante }
    });

    // Eliminar practicante
    await prisma.practicante.delete({
      where: { idPracticante: practicante.idPracticante }
    });

    // Actualizar rol
    await setRolTelefono(phone, 'usuario');

    // Preparar datos precargados para registro web
    const nombres = practicante.nombre.split(' ');
    const datosPrecargados = {
      primerNombre: nombres[0] || '',
      segundoNombre: nombres.length > 2 ? nombres[1] : '',
      primerApellido: nombres.length > 1 ? nombres[nombres.length - 2] : '',
      segundoApellido: nombres.length > 1 ? nombres[nombres.length - 1] : '',
      telefonoPersonal: phone,
      documento: practicante.numero_documento,
      tipoDocumento: practicante.tipo_documento
    };

    return { exito: true, datosPrecargados };
  } catch (error) {
    console.error('Error en revertirPracticanteAUsuario:', error);
    return { exito: false, error: 'Error al revertir practicante a usuario' };
  }
}

/**
 * Limpia asignaciones de pacientes de un practicante
 * @param {string} practicanteId - ID del practicante
 */
export async function limpiarAsignacionesPacientes(practicanteId) {
  try {
    await prisma.informacionUsuario.updateMany({
      where: { practicanteAsignado: practicanteId },
      data: { practicanteAsignado: null }
    });

    console.log(`✅ Asignaciones de pacientes limpiadas para practicante: ${practicanteId}`);
  } catch (error) {
    console.error('Error en limpiarAsignacionesPacientes:', error);
    throw error;
  }
}

/**
 * Obtiene datos faltantes de un usuario para convertirlo en practicante
 * @param {string} telefono - Teléfono del usuario
 * @returns {Object} { datosExistentes: Object, datosFaltantes: Array<string> }
 */
export async function obtenerDatosParaConversion(telefono) {
  const phone = normalizePhone(telefono);
  
  try {
    const usuario = await prisma.informacionUsuario.findUnique({
      where: { telefonoPersonal: phone }
    });

    if (!usuario) {
      return { datosExistentes: null, datosFaltantes: ['Usuario no encontrado'] };
    }

    const datosExistentes = {
      primerNombre: usuario.primerNombre,
      segundoNombre: usuario.segundoNombre,
      primerApellido: usuario.primerApellido,
      segundoApellido: usuario.segundoApellido,
      telefono: phone,
      documento: usuario.documento,
      tipoDocumento: usuario.tipoDocumento
    };

    const datosFaltantes = [];

    // Campos que siempre faltan para practicante
    if (!datosExistentes.primerNombre) datosFaltantes.push('nombre');
    if (!datosExistentes.documento) datosFaltantes.push('documento');
    
    // Campos que no están en usuario pero son requeridos para practicante
    datosFaltantes.push('género', 'estrato', 'barrio', 'localidad', 'horarios');

    return { datosExistentes, datosFaltantes };
  } catch (error) {
    console.error('Error en obtenerDatosParaConversion:', error);
    return { datosExistentes: null, datosFaltantes: ['Error al obtener datos'] };
  }
}

/**
 * Valida datos de horario
 * @param {Object} horario - Objeto con dia, horaInicio, horaFin
 * @returns {Object} { valido: boolean, error?: string }
 */
export function validarHorario(horario) {
  if (!horario.dia || !horario.horaInicio || !horario.horaFin) {
    return { valido: false, error: 'El horario debe contener día, hora inicio y hora fin' };
  }

  const horaInicio = parseInt(horario.horaInicio);
  const horaFin = parseInt(horario.horaFin);

  if (isNaN(horaInicio) || isNaN(horaFin)) {
    return { valido: false, error: 'Las horas deben ser números válidos' };
  }

  if (horaInicio < 0 || horaInicio > 23 || horaFin < 0 || horaFin > 23) {
    return { valido: false, error: 'Las horas deben estar entre 0 y 23' };
  }

  if (horaInicio >= horaFin) {
    return { valido: false, error: 'La hora de inicio debe ser menor que la hora de fin' };
  }

  return { valido: true };
}