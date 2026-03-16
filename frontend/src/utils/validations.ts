/**
 * validations.ts
 * Módulo centralizado de validaciones para el flujo de registro.
 * Fuente de verdad única: las mismas reglas se replican en src/utils/validations.js (backend).
 *
 * Convenciones Colombia:
 *  - CC: 6–10 dígitos numéricos
 *  - TI: 10–11 dígitos numéricos
 *  - RC: 1–11 dígitos numéricos
 *  - CE: 6–12 caracteres alfanuméricos
 *  - SI: 1–30 caracteres libres
 *  - Teléfono móvil: 10 dígitos, empieza en 3 (ej: 3001234567)
 *  - Teléfono con prefijo +57: se acepta y se normaliza
 */

import type { Step1Data, Step3Data } from '../types';

// ─────────────────────────────────────────────
// REGEX centralizados
// ─────────────────────────────────────────────

/** Letras latinas incluyendo tildes, ñ, espacios, guión y apóstrofe. */
const RE_NOMBRE = /^[A-Za-záéíóúÁÉÍÓÚüÜñÑ\s'-]+$/;

/** Correo electrónico con TLD mínimo de 2 caracteres. */
const RE_CORREO = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Teléfono móvil colombiano:
 *  - Opcional prefijo +57 o 57
 *  - Luego 10 dígitos que empiezan por 3
 */
const RE_TELEFONO_CO = /^(\+?57)?3[0-9]{9}$/;

/** Caracteres repetidos 4 o más veces consecutivas: "aaaa", "zzzz". */
const RE_REPETIDOS = /(.)\1{3,}/;

/** Documento: solo letras, dígitos y guión. */
const RE_DOC_GENERICO = /^[A-Za-z0-9-]+$/;

/** Texto libre seguro: letras, dígitos, espacios y puntuación básica. Sin HTML. */
const RE_TEXTO_LIBRE = /^[A-Za-záéíóúÁÉÍÓÚüÜñÑ0-9\s,.()\-/']+$/;

/**
 * Ratio mínimo de vocales que debe tener un nombre para considerarse válido.
 * Basado en análisis de nombres colombianos reales incluyendo casos límite
 * como "Shirly" (0.17) y "Yerlys" (0.17).
 * Por debajo de 0.15 ningún nombre real colombiano existe.
 */
const RATIO_VOCALES_MINIMO = 0.15;

/**
 * TLDs aceptados. Cubre los dominios más usados en Colombia y los internacionales comunes.
 * Rechaza TLDs inventados como .cerda, .xyz, .fake, etc.
 */
const TLDS_VALIDOS = new Set([
  // Colombia
  'co',
  // Genéricos comunes
  'com', 'net', 'org', 'edu', 'gov', 'mil', 'int',
  // Populares internacionales usados en Colombia
  'io', 'info', 'biz', 'me', 'app', 'dev', 'tech',
  // Países frecuentes en correos institucionales/extranjeros
  'us', 'mx', 'es', 'ar', 'cl', 'pe', 'br', 'fr', 'de', 'uk',
]);

/**
 * Calcula el ratio de vocales sobre el total de letras del valor.
 * Un nombre real en español/colombiano tiene siempre >= 0.15 de vocales.
 */
function ratioVocales(valor: string): number {
  const letras = valor.toLowerCase().replace(/[^a-záéíóúüñ]/g, '');
  if (!letras.length) return 0;
  const vocales = (letras.match(/[aeiouáéíóúü]/g) || []).length;
  return vocales / letras.length;
}

/**
 * Detecta si un nombre es basura basándose en la distribución de vocales.
 * No usa listas negras — aplica lingüística estadística.
 */
function esNombreBasura(valor: string): boolean {
  return ratioVocales(valor) < RATIO_VOCALES_MINIMO;
}

/**
 * Extrae el TLD de un correo (la última parte después del último punto).
 * Para "user@uni.edu.co" devuelve "co".
 */
function extraerTLD(correo: string): string {
  const parts = correo.split('.');
  return parts[parts.length - 1].toLowerCase();
}

// ─────────────────────────────────────────────
// VALIDADORES individuales
// Cada función devuelve un mensaje de error o null si es válido.
// ─────────────────────────────────────────────

/**
 * Valida un nombre o apellido.
 * @param valor  - valor del campo
 * @param etiqueta - nombre del campo para el mensaje (ej. "Primer nombre")
 * @param obligatorio - si es false, un valor vacío es válido
 */
export function validateNombre(
  valor: string,
  etiqueta: string,
  obligatorio = true,
): string | null {
  const v = valor.trim();

  if (!v) {
    return obligatorio ? `${etiqueta} es obligatorio` : null;
  }
  if (v.length < 2) return `${etiqueta} debe tener al menos 2 caracteres`;
  if (v.length > 60) return `${etiqueta} no puede superar 60 caracteres`;
  if (!RE_NOMBRE.test(v)) return `${etiqueta} solo puede contener letras`;
  if (RE_REPETIDOS.test(v.toLowerCase())) return `${etiqueta} no parece un nombre válido`;
  if (esNombreBasura(v)) return `${etiqueta} no parece un nombre válido`;
  return null;
}

/**
 * Valida el número de documento según el tipo seleccionado.
 * Convenciones Colombia.
 */
export function validateDocumento(tipoDocumento: string, documento: string): string | null {
  const doc = documento.trim().replace(/[\s.]/g, ''); // eliminar espacios y puntos

  if (!doc) return 'El número de documento es obligatorio';

  // Extraer código corto del tipo: "(cc) Cedula de ciudadania" → "cc"
  const match = tipoDocumento.match(/\(([a-z]+)\)/i);
  const tipo = match ? match[1].toLowerCase() : tipoDocumento.toLowerCase();

  switch (tipo) {
    case 'cc':
      if (!/^\d{6,10}$/.test(doc)) {
        return 'La Cédula de Ciudadanía debe tener entre 6 y 10 dígitos';
      }
      break;
    case 'ti':
      if (!/^\d{10,11}$/.test(doc)) {
        return 'La Tarjeta de Identidad debe tener 10 u 11 dígitos';
      }
      break;
    case 'rc':
      if (!/^\d{1,11}$/.test(doc)) {
        return 'El Registro Civil debe tener entre 1 y 11 dígitos';
      }
      break;
    case 'ce':
      if (!/^[A-Za-z0-9]{6,12}$/.test(doc)) {
        return 'La Cédula de Extranjería debe tener entre 6 y 12 caracteres alfanuméricos';
      }
      break;
    case 'si':
      if (doc.length > 30) return 'El identificador no puede superar 30 caracteres';
      break;
    default:
      // Tipo no reconocido → validación genérica
      if (!RE_DOC_GENERICO.test(doc) || doc.length < 5 || doc.length > 20) {
        return 'Documento inválido';
      }
  }

  return null;
}

/**
 * Valida una dirección de correo electrónico.
 */
export function validateCorreo(correo: string): string | null {
  const v = correo.trim().toLowerCase();
  if (!v) return 'El correo es obligatorio';
  if (v.length > 120) return 'El correo no puede superar 120 caracteres';
  if (!RE_CORREO.test(v)) return 'El correo electrónico no es válido';
  if (!TLDS_VALIDOS.has(extraerTLD(v))) return 'El dominio del correo no es válido (ej. gmail.com, outlook.com)';
  return null;
}

/**
 * Valida un número de teléfono colombiano.
 * Acepta: 3001234567 | +573001234567 | 573001234567
 */
export function validateTelefono(telefono: string): string | null {
  const v = telefono.trim().replace(/[\s\-()]/g, ''); // limpiar separadores

  if (!v) return 'El teléfono es obligatorio';

  if (!RE_TELEFONO_CO.test(v)) {
    return 'Ingresa un número de celular colombiano válido (ej. 3001234567)';
  }
  return null;
}

/**
 * Valida la fecha de nacimiento.
 * - No puede ser futura
 * - Edad mínima: 15 años
 * - Edad máxima: 100 años
 */
export function validateFechaNacimiento(fecha: string): string | null {
  if (!fecha) return 'La fecha de nacimiento es obligatoria';

  const d = new Date(fecha);
  if (isNaN(d.getTime())) return 'La fecha de nacimiento no es válida';

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  if (d >= hoy) return 'La fecha de nacimiento no puede ser futura';

  const edad = hoy.getFullYear() - d.getFullYear()
    - (hoy < new Date(hoy.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);

  if (edad < 15) return 'Debes tener al menos 15 años para registrarte';
  if (edad > 100) return 'Verifica que la fecha de nacimiento sea correcta';

  return null;
}

/**
 * Valida la contraseña.
 * Regla alineada con el backend: mínimo 8, máximo 64 caracteres.
 */
export function validatePassword(password: string): string | null {
  if (!password) return 'La contraseña es obligatoria';
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (password.length > 64) return 'La contraseña no puede superar 64 caracteres';
  return null;
}

/**
 * Valida un campo de texto libre (conQuienVive, personasACargoQuien, discapacidadDetalle, carrera).
 * @param valor     - valor del campo
 * @param etiqueta  - nombre del campo para el mensaje
 * @param min       - longitud mínima (default 3)
 * @param max       - longitud máxima (default 100)
 */
export function validateTextoLibre(
  valor: string,
  etiqueta: string,
  min = 3,
  max = 100,
): string | null {
  const v = valor.trim();
  if (!v) return `${etiqueta} es obligatorio`;
  if (v.length < min) return `${etiqueta} debe tener al menos ${min} caracteres`;
  if (v.length > max) return `${etiqueta} no puede superar ${max} caracteres`;
  if (!RE_TEXTO_LIBRE.test(v)) {
    return `${etiqueta} contiene caracteres no permitidos`;
  }
  if (RE_REPETIDOS.test(v.toLowerCase())) {
    return `${etiqueta} no parece un valor válido`;
  }
  return null;
}

// ─────────────────────────────────────────────
// VALIDADORES de formulario completo
// Devuelven Record<string, string> — errores por campo.
// ─────────────────────────────────────────────

/** Tipo del mapa de errores: { campo: 'mensaje de error' } */
export type FormErrors = Record<string, string>;

/**
 * Valida el formulario completo del Step 1.
 * Devuelve un objeto vacío si no hay errores.
 */
export function validateStep1(form: Step1Data): FormErrors {
  const errors: FormErrors = {};

  // ── Nombres y apellidos ──────────────────────────────────
  const errPrimerNombre = validateNombre(form.primerNombre, 'El primer nombre');
  if (errPrimerNombre) errors.primerNombre = errPrimerNombre;

  // Segundo nombre: opcional
  if (form.segundoNombre.trim()) {
    const errSegundoNombre = validateNombre(form.segundoNombre, 'El segundo nombre', false);
    if (errSegundoNombre) errors.segundoNombre = errSegundoNombre;
  }

  const errPrimerApellido = validateNombre(form.primerApellido, 'El primer apellido');
  if (errPrimerApellido) errors.primerApellido = errPrimerApellido;

  // Segundo apellido: obligatorio según regla de negocio actual
  const errSegundoApellido = validateNombre(form.segundoApellido, 'El segundo apellido');
  if (errSegundoApellido) errors.segundoApellido = errSegundoApellido;

  // ── Identificación ───────────────────────────────────────
  if (!form.tipoDocumento) {
    errors.tipoDocumento = 'Selecciona el tipo de documento';
  } else {
    const errDoc = validateDocumento(form.tipoDocumento, form.documento);
    if (errDoc) errors.documento = errDoc;
  }

  // ── Demografía — selects (siempre valores predefinidos) ──
  if (!form.sexo) errors.sexo = 'Selecciona el sexo';
  if (!form.identidadGenero) errors.identidadGenero = 'Selecciona la identidad de género';
  if (!form.orientacionSexual) errors.orientacionSexual = 'Selecciona la orientación sexual';
  if (!form.etnia) errors.etnia = 'Selecciona la etnia';
  if (!form.discapacidad) errors.discapacidad = 'Selecciona si tienes discapacidad';

  if (form.discapacidad === 'Si') {
    const errDetalle = validateTextoLibre(
      form.discapacidadDetalle,
      'La descripción de discapacidad',
      2,
      120,
    );
    if (errDetalle) errors.discapacidadDetalle = errDetalle;
  }

  // ── Contacto ─────────────────────────────────────────────
  const errCorreo = validateCorreo(form.correo);
  if (errCorreo) errors.correo = errCorreo;

  const errTel = validateTelefono(form.telefonoPersonal);
  if (errTel) errors.telefonoPersonal = errTel;

  const errFecha = validateFechaNacimiento(form.fechaNacimiento);
  if (errFecha) errors.fechaNacimiento = errFecha;

  // ── Universidad ──────────────────────────────────────────
  if (form.perteneceUniversidad === 'Si' && form.esAspirante) {
    errors.perteneceUniversidad = 'No puedes marcar pertenencia y aspirante al mismo tiempo';
  }

  if (form.perteneceUniversidad === 'Si') {
    const errCarrera = validateTextoLibre(form.carrera, 'La carrera', 3, 80);
    if (errCarrera) errors.carrera = errCarrera;

    if (!form.jornada) errors.jornada = 'Selecciona la jornada';
    if (!form.semestre) errors.semestre = 'Selecciona el semestre';
  }

  // ── Contraseña ───────────────────────────────────────────
  const errPass = validatePassword(form.password);
  if (errPass) errors.password = errPass;

  if (!errors.password && form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Las contraseñas no coinciden';
  }

  return errors;
}

/**
 * Valida el formulario completo del Step 3.
 * Devuelve un objeto vacío si no hay errores.
 */
export function validateStep3(form: Step3Data): FormErrors {
  const errors: FormErrors = {};

  if (!form.estadoCivil) errors.estadoCivil = 'Selecciona tu estado civil';

  if (form.rolFamiliar.length === 0) {
    errors.rolFamiliar = 'Selecciona al menos un rol familiar';
  } else if (form.rolFamiliar.includes('madre') && form.rolFamiliar.includes('padre')) {
    errors.rolFamiliar = 'No puedes seleccionar Madre y Padre al mismo tiempo';
  }

  const errConQuien = validateTextoLibre(form.conQuienVive, 'Con quién vives', 3, 100);
  if (errConQuien) errors.conQuienVive = errConQuien;

  if (!form.tienePersonasACargo) {
    errors.tienePersonasACargo = 'Indica si tienes personas a cargo';
  }

  if (form.tienePersonasACargo === 'Si') {
    const errQuien = validateTextoLibre(form.personasACargoQuien, 'Quién está a tu cargo', 2, 100);
    if (errQuien) errors.personasACargoQuien = errQuien;
  }

  if (!form.escolaridad) errors.escolaridad = 'Selecciona tu nivel de escolaridad';
  if (!form.ocupacion) errors.ocupacion = 'Selecciona tu ocupación actual';
  if (!form.nivelIngresos) errors.nivelIngresos = 'Selecciona tu nivel de ingresos';

  return errors;
}

/**
 * Utilidad: indica si un mapa de errores no tiene ningún error.
 */
export function isFormValid(errors: FormErrors): boolean {
  return Object.keys(errors).length === 0;
}
