/**
 * Auth routes for the web chatbot frontend registration flow.
 * These are mounted on the bot's built-in Polka HTTP server under /v1/auth/*.
 * 
 * Endpoints:
 *   POST /v1/auth/register          - Step 1: Create user account
 *   POST /v1/auth/login             - Login with email/phone + password
 *   POST /v1/auth/tratamiento-datos - Step 2: Save data treatment authorization
 *   POST /v1/auth/sociodemografico  - Step 3: Save sociodemographic info
 *   POST /v1/auth/consentimiento    - Step 4: Save informed consent
 *   GET  /v1/auth/check-status      - Check which registration step needs completion
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 16) {
    throw new Error('JWT_SECRET no configurado o demasiado corto (minimo 16 caracteres)');
}

const GENEROS_VALIDOS = new Set(['Masculino', 'Femenino', 'Otro', 'Prefiero no decir']);
const ORIENTACIONES_VALIDAS = new Set([
    'Heterosexual',
    'Homosexual',
    'Bisexual',
    'Pansexual',
    'Asexual',
    'Otra',
    'Prefiero no decir',
]);
const ETNIAS_VALIDAS = new Set([
    'Indigena',
    'Afrocolombiano(a)',
    'Raizal',
    'Palenquero(a)',
    'Rrom (Gitano)',
    'Blanco(a)',
    'Otra',
    'Prefiero no decir',
]);
const DISCAPACIDAD_VALIDA = new Set(['Si', 'No']);

const rateLimitStore = new Map();

// ── Helpers ─────────────────────────────────────────────────

const normalizeEmail = (v) => String(v || '').trim().toLowerCase();
const normalizePhone = (v) => String(v || '').replace(/\D/g, '');
const canonicalYesNo = (v) => {
    const t = String(v || '').trim().toLowerCase();
    return t === 'si' || t === 'sí' ? 'si' : 'no';
};
const isYes = (v) => canonicalYesNo(v) === 'si';

const normalizeSpaces = (v) => String(v || '').replace(/\s+/g, ' ').trim();

const getClientIp = (req) => {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || 'unknown';
};

const isAllowedRate = (bucket, key, max, windowMs) => {
    const now = Date.now();
    const storeKey = `${bucket}:${key}`;
    const current = rateLimitStore.get(storeKey);

    if (!current || now > current.expiresAt) {
        rateLimitStore.set(storeKey, { count: 1, expiresAt: now + windowMs });
        return { allowed: true, retryAfterMs: 0 };
    }

    if (current.count >= max) {
        return { allowed: false, retryAfterMs: Math.max(0, current.expiresAt - now) };
    }

    current.count += 1;
    rateLimitStore.set(storeKey, current);
    return { allowed: true, retryAfterMs: 0 };
};

const validateRegisterPayload = (payload) => {
    const errors = [];

    const primerNombre = normalizeSpaces(payload.primerNombre);
    const primerApellido = normalizeSpaces(payload.primerApellido);
    const documento = normalizeSpaces(payload.documento);
    const correo = normalizeEmail(payload.correo);
    const telefono = normalizePhone(payload.telefonoPersonal);
    const password = String(payload.password || '');
    const genero = normalizeSpaces(payload.genero);
    const orientacionSexual = normalizeSpaces(payload.orientacionSexual || '');
    const etnia = normalizeSpaces(payload.etnia || '');
    const discapacidadRaw = normalizeSpaces(payload.discapacidad || '');
    const discapacidad = discapacidadRaw.toLowerCase() === 'si' ? 'Si' : discapacidadRaw.toLowerCase() === 'no' ? 'No' : discapacidadRaw;
    const discapacidadDetalle = normalizeSpaces(payload.discapacidadDetalle || '');

    if (!primerNombre || primerNombre.length < 2 || primerNombre.length > 80) errors.push('Primer nombre invalido');
    if (!primerApellido || primerApellido.length < 2 || primerApellido.length > 80) errors.push('Primer apellido invalido');
    if (!documento || documento.length < 5 || documento.length > 20 || !/^[A-Za-z0-9-]+$/.test(documento)) errors.push('Documento invalido');
    if (!correo || correo.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errors.push('Correo invalido');
    if (!telefono || telefono.length < 10 || telefono.length > 13) errors.push('Telefono invalido');
    if (password.length < 8 || password.length > 64) errors.push('Contrasena invalida (minimo 8 caracteres)');
    if (!GENEROS_VALIDOS.has(genero)) errors.push('Genero invalido');
    if (!ORIENTACIONES_VALIDAS.has(orientacionSexual)) errors.push('Orientacion sexual invalida');
    if (!ETNIAS_VALIDAS.has(etnia)) errors.push('Etnia invalida');
    if (!DISCAPACIDAD_VALIDA.has(discapacidad)) errors.push('Discapacidad invalida');
    if (discapacidad === 'Si' && (discapacidadDetalle.length < 2 || discapacidadDetalle.length > 120)) {
        errors.push('Debes indicar cual discapacidad tienes');
    }

    if (payload.fechaNacimiento) {
        const fecha = new Date(payload.fechaNacimiento);
        if (Number.isNaN(fecha.getTime())) errors.push('Fecha de nacimiento invalida');
        if (fecha > new Date()) errors.push('Fecha de nacimiento no puede ser futura');
    }

    return {
        errors,
        normalized: {
            primerNombre,
            segundoNombre: normalizeSpaces(payload.segundoNombre),
            primerApellido,
            segundoApellido: normalizeSpaces(payload.segundoApellido),
            tipoDocumento: normalizeSpaces(payload.tipoDocumento),
            documento,
            genero,
            orientacionSexual,
            etnia,
            discapacidad,
            discapacidadDetalle,
            correo,
            telefono,
            fechaNacimiento: payload.fechaNacimiento,
            perteneceUniversidad: payload.perteneceUniversidad,
            carrera: normalizeSpaces(payload.carrera),
            jornada: normalizeSpaces(payload.jornada),
            semestre: payload.semestre,
            password,
            esAspirante: Boolean(payload.esAspirante),
        },
    };
};

const buildPhoneCandidates = (value) => {
    const phone = normalizePhone(value);
    if (!phone) return [];
    const candidates = [phone];
    if (phone.startsWith('57') && phone.length > 2) candidates.push(phone.slice(2));
    else candidates.push(`57${phone}`);
    return [...new Set(candidates)];
};

/** Send JSON response using Polka's raw res */
const json = (res, statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
};

/** Verify JWT token from Authorization header. Returns decoded payload or null. */
const verifyToken = (req) => {
    const header = req.headers?.authorization;
    if (!header) return null;
    const token = header.startsWith('Bearer ') ? header.slice(7) : header;
    try {
        return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
        return null;
    }
};

/** Determine user registration step (2 = needs data treatment, 3 = socio, 4 = consent, 5 = done) */
const getRegistrationStep = async (userId) => {
    const user = await prisma.informacionUsuario.findUnique({
        where: { idUsuario: userId },
        include: { informacionSociodemografica: true },
    });
    if (!user) return { step: 1, user: null };

    // Step 2: data treatment
    if (!isYes(user.autorizacionDatos)) return { step: 2, user };
    // Step 3: sociodemographic
    if (!user.informacionSociodemografica) return { step: 3, user };
    // Step 4: consent
    if (!isYes(user.consentimientoInformado)) return { step: 4, user };
    // All done
    return { step: 5, user };
};

/** Build a safe user object to return to the frontend */
const safeUser = (user, step) => ({
    id: user.idUsuario,
    primerNombre: user.primerNombre,
    correo: user.correo,
    documento: user.documento || '',
    consentimientoInformado: canonicalYesNo(user.consentimientoInformado),
    autorizacionDatos: canonicalYesNo(user.autorizacionDatos),
    registrationStep: step,
});

// ── Route Registration ──────────────────────────────────────

/**
 * Register all auth routes on a Polka server instance.
 * @param {import('polka').Polka} server - The Polka HTTP server (adapterProvider.server)
 */
export function registerAuthRoutes(server) {

    // ── POST /v1/auth/register ──────────────────────────────
    server.post('/v1/auth/register', async (req, res) => {
        try {
            const registerIp = getClientIp(req);
            const rateByIp = isAllowedRate('register-ip', registerIp, 20, 15 * 60 * 1000);
            if (!rateByIp.allowed) {
                return json(res, 429, { error: 'Demasiados intentos. Intenta mas tarde.' });
            }

            const {
                primerNombre, segundoNombre, primerApellido, segundoApellido,
                tipoDocumento, documento, genero, correo, telefonoPersonal,
                fechaNacimiento, perteneceUniversidad, carrera, jornada, semestre,
                password, esAspirante, orientacionSexual, etnia, discapacidad, discapacidadDetalle,
            } = req.body;

            const { errors, normalized } = validateRegisterPayload({
                primerNombre,
                segundoNombre,
                primerApellido,
                segundoApellido,
                tipoDocumento,
                documento,
                genero,
                orientacionSexual,
                etnia,
                discapacidad,
                discapacidadDetalle,
                correo,
                telefonoPersonal,
                fechaNacimiento,
                perteneceUniversidad,
                carrera,
                jornada,
                semestre,
                password,
                esAspirante,
            });

            if (errors.length > 0) {
                return json(res, 400, { error: errors[0] });
            }

            const correoNorm = normalized.correo;
            const telefonoLimpio = normalized.telefono;
            const telefonoConPrefijo = telefonoLimpio.startsWith('57') ? telefonoLimpio : `57${telefonoLimpio}`;
            const perteneceUni = canonicalYesNo(normalized.perteneceUniversidad) === 'si';
            const aspiranteFlag = normalized.esAspirante;

            const rateByIdentifier = isAllowedRate('register-identifier', `${correoNorm}|${telefonoConPrefijo}|${normalized.documento}`, 8, 15 * 60 * 1000);
            if (!rateByIdentifier.allowed) {
                return json(res, 429, { error: 'Demasiados intentos con estos datos. Intenta mas tarde.' });
            }

            if (perteneceUni && aspiranteFlag) {
                return json(res, 400, { error: 'No puedes marcar pertenencia y aspirante al mismo tiempo' });
            }

            // Check uniqueness
            const existing = await prisma.informacionUsuario.findFirst({
                where: {
                    OR: [
                        { correo: correoNorm },
                        { telefonoPersonal: telefonoConPrefijo },
                        { telefonoPersonal: telefonoPersonal },
                        { documento: documento },
                    ],
                },
            });
            if (existing) return json(res, 400, { error: 'Ya existe un usuario con ese correo, telefono o documento' });

            const hashedPassword = await bcrypt.hash(password, 10);

            const user = await prisma.$transaction(async (tx) => {
                const created = await tx.informacionUsuario.create({
                    data: {
                        primerNombre: normalized.primerNombre,
                        segundoNombre: normalized.segundoNombre || null,
                        primerApellido: normalized.primerApellido,
                        segundoApellido: normalized.segundoApellido || null,
                        tipoDocumento: normalized.tipoDocumento || 'CC',
                        documento: normalized.documento,
                        genero: normalized.genero,
                        orientacionSexual: normalized.orientacionSexual,
                        etnia: normalized.etnia,
                        discapacidad: normalized.discapacidad,
                        discapacidadDetalle: normalized.discapacidad === 'Si' ? normalized.discapacidadDetalle : null,
                        correo: correoNorm,
                        telefonoPersonal: telefonoConPrefijo,
                        fechaNacimiento: normalized.fechaNacimiento ? new Date(normalized.fechaNacimiento) : new Date(),
                        perteneceUniversidad: perteneceUni ? 'Si' : 'No',
                        carrera: normalized.carrera || null,
                        jornada: normalized.jornada || null,
                        semestre: normalized.semestre ? Number(normalized.semestre) : null,
                        password: hashedPassword,
                        consentimientoInformado: 'no',
                        autorizacionDatos: 'no',
                        isAuthenticated: true,
                    },
                });

                await tx.rolChat.upsert({
                    where: { telefono: telefonoConPrefijo },
                    update: {},
                    create: { telefono: telefonoConPrefijo, rol: 'usuario' },
                });

                if (aspiranteFlag) {
                    await tx.aspirante.create({
                        data: {
                            usuarioId: created.idUsuario,
                            telefono: telefonoConPrefijo,
                            documento: normalized.documento || null,
                            estado: 'aspirante',
                        },
                    });
                }

                return created;
            });

            const token = jwt.sign({ userId: user.idUsuario, correo: user.correo }, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });

            return json(res, 201, {
                message: 'Usuario registrado exitosamente',
                userId: user.idUsuario,
                token,
                user: safeUser(user, 2),
            });
        } catch (error) {
            console.error('Error en /v1/auth/register:', error);
            return json(res, 500, { error: 'Error interno del servidor' });
        }
    });

    // ── POST /v1/auth/login ─────────────────────────────────
    server.post('/v1/auth/login', async (req, res) => {
        try {
            const { correo, password } = req.body;
            const identificador = String(correo || '').trim();

            const loginIp = getClientIp(req);
            const rateByIp = isAllowedRate('login-ip', loginIp, 30, 15 * 60 * 1000);
            if (!rateByIp.allowed) {
                return json(res, 429, { error: 'Demasiados intentos. Intenta mas tarde.' });
            }

            const rateByIdentifier = isAllowedRate('login-identifier', `${loginIp}|${identificador.toLowerCase()}`, 8, 15 * 60 * 1000);
            if (!rateByIdentifier.allowed) {
                return json(res, 429, { error: 'Demasiados intentos para este usuario. Intenta mas tarde.' });
            }

            const correoNorm = normalizeEmail(identificador);
            const phoneCandidates = buildPhoneCandidates(identificador);

            const user = await prisma.informacionUsuario.findFirst({
                where: {
                    OR: [
                        { correo: correoNorm },
                        ...(phoneCandidates.length ? [{ telefonoPersonal: { in: phoneCandidates } }] : []),
                        { documento: identificador },
                    ],
                },
            });

            if (!user || !user.password) return json(res, 401, { error: 'Credenciales invalidas' });

            const isBcrypt = typeof user.password === 'string' && user.password.startsWith('$2');
            let validPassword = false;

            if (isBcrypt) {
                validPassword = await bcrypt.compare(String(password), user.password);
            } else {
                validPassword = user.password === String(password);
                if (validPassword) {
                    await prisma.informacionUsuario.update({
                        where: { idUsuario: user.idUsuario },
                        data: { password: await bcrypt.hash(String(password), 10) },
                    });
                }
            }

            if (!validPassword) return json(res, 401, { error: 'Credenciales invalidas' });

            const { step } = await getRegistrationStep(user.idUsuario);
            const token = jwt.sign({ userId: user.idUsuario, correo: user.correo }, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });

            return json(res, 200, {
                message: 'Login exitoso',
                token,
                user: safeUser(user, step),
            });
        } catch (error) {
            console.error('Error en /v1/auth/login:', error);
            return json(res, 500, { error: 'Error interno del servidor' });
        }
    });

    // ── POST /v1/auth/tratamiento-datos ─────────────────────
    server.post('/v1/auth/tratamiento-datos', async (req, res) => {
        try {
            const decoded = verifyToken(req);
            const userId = decoded?.userId;
            if (!userId) return json(res, 401, { error: 'No autenticado' });

            if (!isYes(req.body?.autorizacionDatos)) {
                return json(res, 400, { error: 'Debes autorizar el tratamiento de datos' });
            }

            await prisma.informacionUsuario.update({
                where: { idUsuario: userId },
                data: { autorizacionDatos: 'si' },
            });

            return json(res, 200, { message: 'Autorizacion guardada exitosamente' });
        } catch (error) {
            console.error('Error en /v1/auth/tratamiento-datos:', error);
            return json(res, 500, { error: 'Error interno del servidor' });
        }
    });

    // ── POST /v1/auth/sociodemografico ──────────────────────
    server.post('/v1/auth/sociodemografico', async (req, res) => {
        try {
            const decoded = verifyToken(req);
            const userId = decoded?.userId;
            if (!userId) return json(res, 401, { error: 'No autenticado' });

            const {
                estadoCivil, numeroHijos, numeroHermanos, conQuienVive,
                tienePersonasACargo, rolFamiliar, escolaridad, ocupacion, nivelIngresos,
            } = req.body;

            if (!estadoCivil || !conQuienVive || !rolFamiliar || !escolaridad || !ocupacion || !nivelIngresos) {
                return json(res, 400, { error: 'Todos los campos son obligatorios' });
            }

            await prisma.informacionSociodemografica.upsert({
                where: { usuarioId: userId },
                update: {
                    estadoCivil, numeroHijos: Number(numeroHijos) || 0,
                    numeroHermanos: Number(numeroHermanos) || 0, conQuienVive,
                    tienePersonasACargo: tienePersonasACargo || 'No',
                    rolFamiliar, escolaridad, ocupacion, nivelIngresos,
                },
                create: {
                    usuarioId: userId, estadoCivil,
                    numeroHijos: Number(numeroHijos) || 0,
                    numeroHermanos: Number(numeroHermanos) || 0, conQuienVive,
                    tienePersonasACargo: tienePersonasACargo || 'No',
                    rolFamiliar, escolaridad, ocupacion, nivelIngresos,
                },
            });

            return json(res, 200, { message: 'Informacion sociodemografica guardada exitosamente' });
        } catch (error) {
            console.error('Error en /v1/auth/sociodemografico:', error);
            return json(res, 500, { error: 'Error interno del servidor' });
        }
    });

    // ── POST /v1/auth/consentimiento ────────────────────────
    server.post('/v1/auth/consentimiento', async (req, res) => {
        try {
            const decoded = verifyToken(req);
            const userId = decoded?.userId;
            if (!userId) return json(res, 401, { error: 'No autenticado' });

            if (!isYes(req.body?.consentimientoInformado)) {
                return json(res, 400, { error: 'Debes aceptar el consentimiento' });
            }

            await prisma.informacionUsuario.update({
                where: { idUsuario: userId },
                data: { consentimientoInformado: 'si' },
            });

            return json(res, 200, { message: 'Consentimiento guardado exitosamente' });
        } catch (error) {
            console.error('Error en /v1/auth/consentimiento:', error);
            return json(res, 500, { error: 'Error interno del servidor' });
        }
    });

    // ── GET /v1/auth/check-status ───────────────────────────
    server.get('/v1/auth/check-status', async (req, res) => {
        try {
            const decoded = verifyToken(req);
            if (!decoded?.userId) return json(res, 401, { error: 'No autenticado' });

            const { step, user } = await getRegistrationStep(decoded.userId);
            if (!user) return json(res, 404, { error: 'Usuario no encontrado' });

            return json(res, 200, {
                registrationStep: step,
                user: safeUser(user, step),
            });
        } catch (error) {
            console.error('Error en /v1/auth/check-status:', error);
            return json(res, 500, { error: 'Error interno del servidor' });
        }
    });

    console.log('✅ Rutas de autenticación web registradas (/v1/auth/*)');
}
