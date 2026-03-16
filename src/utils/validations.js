/**
 * validations.js
 * Módulo centralizado de validaciones — capa backend.
 * Las reglas son idénticas a las de frontend/src/utils/validations.ts.
 * Fuente de verdad única: cualquier cambio de regla debe aplicarse en ambos archivos.
 *
 * Convenciones Colombia:
 *  - CC: 6–10 dígitos numéricos
 *  - TI: 10–11 dígitos numéricos
 *  - RC: 1–11 dígitos numéricos
 *  - CE: 6–12 caracteres alfanuméricos
 *  - SI: 1–30 caracteres libres
 *  - Teléfono móvil: 10 dígitos, empieza en 3 (ej: 3001234567)
 *  - Teléfono con prefijo +57 o 57: se acepta y se normaliza externamente
 */

// ─────────────────────────────────────────────
// REGEX centralizados
// ─────────────────────────────────────────────

/** Letras latinas incluyendo tildes, ñ, espacios, guión y apóstrofe. */
const RE_NOMBRE = /^[A-Za-záéíóúÁÉÍÓÚüÜñÑ\s'-]+$/;

/** Correo electrónico con TLD mínimo de 2 caracteres. */
const RE_CORREO = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Teléfono móvil colombiano (ya normalizado, sin prefijo):
 * 10 dígitos que empiezan por 3.
 */
const RE_TELEFONO_CO_LIMPIO = /^3[0-9]{9}$/;

/** Caracteres repetidos 4 o más veces consecutivas. */
const RE_REPETIDOS = /(.)\1{3,}/;

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
 */
const TLDS_VALIDOS = new Set([
    'co',
    'com', 'net', 'org', 'edu', 'gov', 'mil', 'int',
    'io', 'info', 'biz', 'me', 'app', 'dev', 'tech',
    'us', 'mx', 'es', 'ar', 'cl', 'pe', 'br', 'fr', 'de', 'uk',
]);

/**
 * Calcula el ratio de vocales sobre el total de letras del valor.
 * Un nombre real en español/colombiano tiene siempre >= 0.15 de vocales.
 */
function ratioVocales(valor) {
    const letras = String(valor || '').toLowerCase().replace(/[^a-záéíóúüñ]/g, '');
    if (!letras.length) return 0;
    return (letras.match(/[aeiouáéíóúü]/g) || []).length / letras.length;
}

/** Detecta si un nombre es basura basándose en la distribución de vocales. */
function esNombreBasura(valor) {
    return ratioVocales(valor) < RATIO_VOCALES_MINIMO;
}

/** Extrae el TLD de un correo. Para "user@uni.edu.co" devuelve "co". */
function extraerTLD(correo) {
    const parts = String(correo || '').split('.');
    return parts[parts.length - 1].toLowerCase();
}

// ─────────────────────────────────────────────
// VALIDADORES individuales
// ─────────────────────────────────────────────

/**
 * Valida un nombre o apellido.
 * @param {string} valor
 * @param {string} etiqueta
 * @param {boolean} [obligatorio=true]
 * @returns {string|null}
 */
export function validateNombre(valor, etiqueta, obligatorio = true) {
    const v = String(valor || '').trim();
    if (!v) return obligatorio ? `${etiqueta} es obligatorio` : null;
    if (v.length < 2) return `${etiqueta} debe tener al menos 2 caracteres`;
    if (v.length > 60) return `${etiqueta} no puede superar 60 caracteres`;
    if (!RE_NOMBRE.test(v)) return `${etiqueta} solo puede contener letras`;
    if (RE_REPETIDOS.test(v.toLowerCase())) return `${etiqueta} no parece un nombre válido`;
    if (esNombreBasura(v)) return `${etiqueta} no parece un nombre válido`;
    return null;
}

/**
 * Valida el número de documento según el tipo seleccionado.
 * El documento debe llegar ya limpiado (sin espacios ni puntos).
 * @param {string} tipoDocumento
 * @param {string} documento
 * @returns {string|null}
 */
export function validateDocumento(tipoDocumento, documento) {
    const doc = String(documento || '').trim().replace(/[\s.]/g, '');
    if (!doc) return 'El número de documento es obligatorio';

    const match = String(tipoDocumento || '').match(/\(([a-z]+)\)/i);
    const tipo = match ? match[1].toLowerCase() : String(tipoDocumento || '').toLowerCase();

    switch (tipo) {
        case 'cc':
            if (!/^\d{6,10}$/.test(doc)) return 'La Cédula de Ciudadanía debe tener entre 6 y 10 dígitos';
            break;
        case 'ti':
            if (!/^\d{10,11}$/.test(doc)) return 'La Tarjeta de Identidad debe tener 10 u 11 dígitos';
            break;
        case 'rc':
            if (!/^\d{1,11}$/.test(doc)) return 'El Registro Civil debe tener entre 1 y 11 dígitos';
            break;
        case 'ce':
            if (!/^[A-Za-z0-9]{6,12}$/.test(doc)) return 'La Cédula de Extranjería debe tener entre 6 y 12 caracteres alfanuméricos';
            break;
        case 'si':
            if (doc.length > 30) return 'El identificador no puede superar 30 caracteres';
            break;
        default:
            if (!/^[A-Za-z0-9-]+$/.test(doc) || doc.length < 5 || doc.length > 20) return 'Documento inválido';
    }
    return null;
}

/**
 * Valida una dirección de correo electrónico (ya normalizada a minúsculas).
 * @param {string} correo
 * @returns {string|null}
 */
export function validateCorreo(correo) {
    const v = String(correo || '').trim().toLowerCase();
    if (!v) return 'El correo es obligatorio';
    if (v.length > 120) return 'El correo no puede superar 120 caracteres';
    if (!RE_CORREO.test(v)) return 'El correo electrónico no es válido';
    if (!TLDS_VALIDOS.has(extraerTLD(v))) return 'El dominio del correo no es válido (ej. gmail.com, outlook.com)';
    return null;
}

/**
 * Valida un número de teléfono colombiano ya normalizado (solo dígitos, sin prefijo 57).
 * El backend normaliza con replace(/\D/g, '') antes de llamar a esta función.
 * @param {string} telefonoLimpio - Solo dígitos
 * @returns {string|null}
 */
export function validateTelefono(telefonoLimpio) {
    const v = String(telefonoLimpio || '');
    if (!v) return 'El teléfono es obligatorio';

    // Aceptar con o sin prefijo 57
    const sinPrefijo = v.startsWith('57') && v.length > 10 ? v.slice(2) : v;
    if (!RE_TELEFONO_CO_LIMPIO.test(sinPrefijo)) {
        return 'Ingresa un número de celular colombiano válido (ej. 3001234567)';
    }
    return null;
}

/**
 * Valida la fecha de nacimiento.
 * @param {string|Date} fecha
 * @returns {string|null}
 */
export function validateFechaNacimiento(fecha) {
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
 * @param {string} password
 * @returns {string|null}
 */
export function validatePassword(password) {
    const v = String(password || '');
    if (!v) return 'La contraseña es obligatoria';
    if (v.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    if (v.length > 64) return 'La contraseña no puede superar 64 caracteres';
    return null;
}

/**
 * Valida un campo de texto libre.
 * @param {string} valor
 * @param {string} etiqueta
 * @param {number} [min=3]
 * @param {number} [max=100]
 * @returns {string|null}
 */
export function validateTextoLibre(valor, etiqueta, min = 3, max = 100) {
    const v = String(valor || '').trim();
    if (!v) return `${etiqueta} es obligatorio`;
    if (v.length < min) return `${etiqueta} debe tener al menos ${min} caracteres`;
    if (v.length > max) return `${etiqueta} no puede superar ${max} caracteres`;
    if (!RE_TEXTO_LIBRE.test(v)) return `${etiqueta} contiene caracteres no permitidos`;
    if (RE_REPETIDOS.test(v.toLowerCase())) return `${etiqueta} no parece un valor válido`;
    return null;
}

// ─────────────────────────────────────────────
// SETS de valores válidos (mirror de authRoutes.js)
// ─────────────────────────────────────────────

const TIPOS_DOCUMENTO_VALIDOS = new Set([
    '(cc) Cedula de ciudadania',
    '(ti) Tarjeta de identidad',
    '(rc) Registro civil',
    '(ce) Cedula de extranjeria',
    '(si) Sin identificacion',
    'CC', 'TI', 'RC', 'CE', 'SI',
]);
const SEXOS_VALIDOS = new Set(['Hombre', 'Mujer', 'Intersexual']);
const IDENTIDADES_GENERO_VALIDAS = new Set(['Masculino', 'Femenino', 'Transexual', 'No informa']);
const ORIENTACIONES_VALIDAS = new Set(['Heterosexual', 'Homosexual', 'Bisexual', 'No informa']);
const ETNIAS_VALIDAS = new Set(['Afro', 'Raizal', 'Palanquero', 'Indigena', 'Rom', 'Ninguna', 'No informa']);
const DISCAPACIDAD_VALIDOS = new Set(['Si', 'No']);

// ─────────────────────────────────────────────
// VALIDADOR completo del payload de registro (Step 1)
// Reemplaza validateRegisterPayload en authRoutes.js
// ─────────────────────────────────────────────

/**
 * Valida el payload completo de registro.
 * @param {object} payload - Body del POST /v1/auth/register
 * @param {object} normalized - Campos ya normalizados (desde normalizeSpaces, normalizeEmail, etc.)
 * @returns {string[]} Array de mensajes de error. Vacío si todo es válido.
 */
export function validateRegisterPayload(payload, normalized) {
    const errors = [];

    // ── Nombres ──────────────────────────────────────────────
    const errPN = validateNombre(normalized.primerNombre, 'Primer nombre');
    if (errPN) errors.push(errPN);

    // segundoNombre: opcional, pero si viene debe ser válido
    if (normalized.segundoNombre) {
        const errSN = validateNombre(normalized.segundoNombre, 'Segundo nombre', false);
        if (errSN) errors.push(errSN);
    }

    const errPA = validateNombre(normalized.primerApellido, 'Primer apellido');
    if (errPA) errors.push(errPA);

    // segundoApellido: obligatorio según regla de negocio actual
    const errSA = validateNombre(normalized.segundoApellido, 'Segundo apellido');
    if (errSA) errors.push(errSA);

    // ── Documento ────────────────────────────────────────────
    if (!TIPOS_DOCUMENTO_VALIDOS.has(normalized.tipoDocumento)) {
        errors.push('Tipo de documento inválido');
    } else {
        const errDoc = validateDocumento(normalized.tipoDocumento, normalized.documento);
        if (errDoc) errors.push(errDoc);
    }

    // ── Selects de demografía (enums) ────────────────────────
    if (!SEXOS_VALIDOS.has(normalized.sexo)) errors.push('Sexo inválido');
    if (!IDENTIDADES_GENERO_VALIDAS.has(normalized.identidadGenero)) errors.push('Identidad de género inválida');
    if (!ORIENTACIONES_VALIDAS.has(normalized.orientacionSexual)) errors.push('Orientación sexual inválida');
    if (!ETNIAS_VALIDAS.has(normalized.etnia)) errors.push('Etnia inválida');
    if (!DISCAPACIDAD_VALIDOS.has(normalized.discapacidad)) errors.push('Discapacidad inválida');

    if (normalized.discapacidad === 'Si') {
        const errDet = validateTextoLibre(normalized.discapacidadDetalle, 'La descripción de discapacidad', 2, 120);
        if (errDet) errors.push(errDet);
    }

    // ── Contacto ─────────────────────────────────────────────
    const errCorreo = validateCorreo(normalized.correo);
    if (errCorreo) errors.push(errCorreo);

    const errTel = validateTelefono(normalized.telefono);
    if (errTel) errors.push(errTel);

    const errFecha = validateFechaNacimiento(payload.fechaNacimiento);
    if (errFecha) errors.push(errFecha);

    // ── Contraseña ───────────────────────────────────────────
    const errPass = validatePassword(payload.password);
    if (errPass) errors.push(errPass);

    // ── Universidad ──────────────────────────────────────────
    const perteneceUni = String(normalized.perteneceUniversidad || '').toLowerCase() === 'si';
    if (perteneceUni && normalized.esAspirante) {
        errors.push('No puedes marcar pertenencia y aspirante al mismo tiempo');
    }
    if (perteneceUni) {
        const errCarrera = validateTextoLibre(normalized.carrera, 'La carrera', 3, 80);
        if (errCarrera) errors.push(errCarrera);

        if (!normalized.jornada) errors.push('La jornada es obligatoria si perteneces a la universidad');

        const semestre = Number(normalized.semestre);
        if (!normalized.semestre || isNaN(semestre) || semestre < 1 || semestre > 9) {
            errors.push('El semestre es obligatorio y debe estar entre 1 y 9');
        }
    }

    return errors;
}

/**
 * Valida el payload del endpoint /v1/auth/sociodemografico (Step 3).
 * Solo campos de texto libre; los selects se validan como "no vacío".
 * @param {object} body
 * @returns {string[]}
 */
export function validateSociodemograficoPayload(body) {
    const errors = [];

    const { estadoCivil, conQuienVive, rolFamiliar, tienePersonasACargo,
        personasACargoQuien, escolaridad, ocupacion, nivelIngresos } = body;

    if (!estadoCivil) errors.push('Estado civil es obligatorio');
    if (!escolaridad) errors.push('Escolaridad es obligatoria');
    if (!ocupacion) errors.push('Ocupación es obligatoria');
    if (!nivelIngresos) errors.push('Nivel de ingresos es obligatorio');

    const rolNorm = Array.isArray(rolFamiliar)
        ? rolFamiliar.filter(Boolean)
        : (rolFamiliar ? [rolFamiliar] : []);
    if (rolNorm.length === 0) errors.push('Selecciona al menos un rol familiar');

    const errConQuien = validateTextoLibre(conQuienVive, 'Con quién vives', 3, 100);
    if (errConQuien) errors.push(errConQuien);

    if (!tienePersonasACargo) {
        errors.push('Indica si tienes personas a cargo');
    } else if (tienePersonasACargo === 'Si') {
        const errQuien = validateTextoLibre(personasACargoQuien, 'Quién está a tu cargo', 2, 100);
        if (errQuien) errors.push(errQuien);
    }

    return errors;
}
