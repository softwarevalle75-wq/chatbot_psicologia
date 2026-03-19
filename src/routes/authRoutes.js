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

import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Resolver } from 'dns/promises';
import crypto from 'node:crypto';
import { validateRegisterPayload, validateSociodemograficoPayload } from '../utils/validations.js';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 16) {
    throw new Error('JWT_SECRET no configurado o demasiado corto (minimo 16 caracteres)');
}

// Los sets de valores válidos y la función validateRegisterPayload
// se centralizaron en src/utils/validations.js (importado arriba).

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

const ENV_ADMIN_EMAIL = (process.env.ADMIN_DASHBOARD_EMAIL || '').trim().toLowerCase();
const ENV_ADMIN_PASSWORD = process.env.ADMIN_DASHBOARD_PASSWORD || '';

const adminEmailSet = new Set([
    'chatbotpsicologia@gmail.com',
    ...(ENV_ADMIN_EMAIL ? [ENV_ADMIN_EMAIL] : []),
    ...String(process.env.ADMIN_EMAILS || '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
]);

const resolveUserRole = async (user) => {
    const email = normalizeEmail(user?.correo);
    if (adminEmailSet.has(email)) {
        return { role: 'admin', profileId: null };
    }

    const phone = String(user?.telefonoPersonal || '').trim();
    const roleRow = phone ? await prisma.rolChat.findUnique({ where: { telefono: phone } }).catch(() => null) : null;
    const role = roleRow?.rol || 'usuario';

    if (role === 'practicante') {
        const pract = await prisma.practicante.findFirst({
            where: {
                OR: [
                    { telefono: phone || undefined },
                    { correo: user?.correo || undefined },
                    { numero_documento: user?.documento || undefined },
                ],
            },
            select: { idPracticante: true },
        }).catch(() => null);

        return {
            role,
            profileId: pract?.idPracticante || null,
        };
    }

    return { role, profileId: null };
};

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

/**
 * Normaliza los campos del payload de registro y devuelve el objeto normalizado.
 * La validación se delega al módulo src/utils/validations.js.
 */
const normalizeRegisterPayload = (payload) => {
    const primerNombre = normalizeSpaces(payload.primerNombre);
    const primerApellido = normalizeSpaces(payload.primerApellido);
    const documento = normalizeSpaces(payload.documento);
    const correo = normalizeEmail(payload.correo);
    const telefono = normalizePhone(payload.telefonoPersonal);
    const password = String(payload.password || '');
    const tipoDocumento = normalizeSpaces(payload.tipoDocumento);
    const sexo = normalizeSpaces(payload.sexo || '');
    const identidadGenero = normalizeSpaces(payload.identidadGenero || '');
    const orientacionSexual = normalizeSpaces(payload.orientacionSexual || '');
    const etnia = normalizeSpaces(payload.etnia || '');
    const discapacidadRaw = normalizeSpaces(payload.discapacidad || '');
    const discapacidad = discapacidadRaw.toLowerCase() === 'si' ? 'Si'
        : discapacidadRaw.toLowerCase() === 'no' ? 'No'
        : discapacidadRaw;
    const discapacidadDetalle = normalizeSpaces(payload.discapacidadDetalle || '');

    return {
        primerNombre,
        segundoNombre: normalizeSpaces(payload.segundoNombre),
        primerApellido,
        segundoApellido: normalizeSpaces(payload.segundoApellido),
        tipoDocumento,
        documento,
        sexo,
        identidadGenero,
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
    });
    if (!user) return { step: 1, user: null };

    let hasSociodemografico = false;
    try {
        const rows = await prisma.$queryRawUnsafe(
            'SELECT COUNT(*) AS c FROM informacion_sociodemografica WHERE usuarioId = ? LIMIT 1',
            userId,
        );
        hasSociodemografico = Number(rows?.[0]?.c || 0) > 0;
    } catch {
        hasSociodemografico = false;
    }

    // Step 2: data treatment
    if (!isYes(user.autorizacionDatos)) return { step: 2, user };
    // Step 3: sociodemographic
    if (!hasSociodemografico) return { step: 3, user };
    // Step 4: consent
    if (!isYes(user.consentimientoInformado)) return { step: 4, user };
    // All done
    return { step: 5, user };
};

/** Build a safe user object to return to the frontend */
const safeUser = (user, step, roleInfo = { role: 'usuario', profileId: null }) => ({
    id: user.idUsuario,
    primerNombre: user.primerNombre,
    correo: user.correo,
    documento: user.documento || '',
    consentimientoInformado: canonicalYesNo(user.consentimientoInformado),
    autorizacionDatos: canonicalYesNo(user.autorizacionDatos),
    registrationStep: step,
    role: roleInfo.role,
    profileId: roleInfo.profileId,
});

// ── DNS email domain validation ─────────────────────────────

// Resolver DNS con servidores públicos para evitar dependencia del DNS del sistema
const dnsResolver = new Resolver();
dnsResolver.setServers(['8.8.8.8', '1.1.1.1']);

/**
 * Verifica que el dominio de un correo tenga registros MX en DNS.
 * Solo se acepta un dominio que pueda recibir correos (registro MX presente).
 * Un dominio con solo A record (sitio web pero sin servidor de correo) es rechazado.
 *
 * @param {string} correo - Correo ya normalizado en minúsculas
 * @returns {Promise<boolean>} true si el dominio puede recibir correos
 */
const validarDominioCorreo = async (correo) => {
    const dominio = correo.split('@')[1];
    if (!dominio) return false;
    try {
        const mx = await dnsResolver.resolveMx(dominio);
        return Array.isArray(mx) && mx.length > 0;
    } catch {
        return false;
    }
};

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
                tipoDocumento, documento, sexo, identidadGenero, orientacionSexual, etnia, discapacidad,
                discapacidadDetalle,
                correo, telefonoPersonal,
                fechaNacimiento, perteneceUniversidad, carrera, jornada, semestre,
                password, esAspirante,
            } = req.body;

            const normalized = normalizeRegisterPayload({
                primerNombre,
                segundoNombre,
                primerApellido,
                segundoApellido,
                tipoDocumento,
                documento,
                sexo,
                identidadGenero,
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

            const validationErrors = validateRegisterPayload(
                { fechaNacimiento, password },
                normalized,
            );

            if (validationErrors.length > 0) {
                return json(res, 400, { error: validationErrors[0] });
            }

            const correoNorm = normalized.correo;
            const telefonoLimpio = normalized.telefono;
            const telefonoConPrefijo = telefonoLimpio.startsWith('57') ? telefonoLimpio : `57${telefonoLimpio}`;
            const perteneceUni = canonicalYesNo(normalized.perteneceUniversidad) === 'si';
            const aspiranteFlag = normalized.esAspirante;

            // Verificar que el dominio del correo existe en DNS
            const dominioValido = await validarDominioCorreo(correoNorm);
            if (!dominioValido) {
                return json(res, 400, { error: 'El dominio del correo no existe. Verifica que sea un correo real.' });
            }

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
                        { telefonoPersonal: normalized.telefono },
                        { documento: normalized.documento },
                    ],
                },
            });
            if (existing) return json(res, 400, { error: 'Ya existe un usuario con ese correo, telefono o documento' });

            const hashedPassword = await bcrypt.hash(normalized.password, 10);

            const user = await prisma.$transaction(async (tx) => {
                const created = await tx.informacionUsuario.create({
                    data: {
                        primerNombre: normalized.primerNombre,
                        segundoNombre: normalized.segundoNombre || null,
                        primerApellido: normalized.primerApellido,
                        segundoApellido: normalized.segundoApellido || null,
                        tipoDocumento: normalized.tipoDocumento,
                        documento: normalized.documento,
                        sexo: normalized.sexo,
                        identidadGenero: normalized.identidadGenero,
                        genero: normalized.identidadGenero,
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
                user: safeUser(user, 2, { role: 'usuario', profileId: null }),
            });
        } catch (error) {
            console.error('Error en /v1/auth/register:', error);
            return json(res, 500, { error: 'Error interno del servidor' });
        }
    });

    // ── POST /v1/auth/login ─────────────────────────────────
    server.post('/v1/auth/login', async (req, res) => {
        try {
            const identificador = String(req.body?.correo ?? req.body?.email ?? '').trim();
            const password = req.body?.password;

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

            // ── Admin por variables de entorno (sin BD) ──
            if (ENV_ADMIN_EMAIL && ENV_ADMIN_PASSWORD && correoNorm === ENV_ADMIN_EMAIL && password === ENV_ADMIN_PASSWORD) {
                const token = jwt.sign(
                    { userId: 'admin-env', correo: ENV_ADMIN_EMAIL },
                    JWT_SECRET,
                    { expiresIn: '7d', algorithm: 'HS256' },
                );
                return json(res, 200, {
                    message: 'Login exitoso',
                    token,
                    user: {
                        id: 'admin-env',
                        primerNombre: 'Administrador',
                        correo: ENV_ADMIN_EMAIL,
                        documento: '',
                        consentimientoInformado: 'si',
                        autorizacionDatos: 'si',
                        registrationStep: 5,
                        role: 'admin',
                        profileId: null,
                    },
                });
            }

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
                    try {
                        await prisma.$executeRawUnsafe(
                            'UPDATE informacionUsuario SET password = ? WHERE idUsuario = ?',
                            await bcrypt.hash(String(password), 10),
                            user.idUsuario,
                        );
                    } catch {
                        // ignore hash upgrade failure
                    }
                }
            }

            if (!validPassword) return json(res, 401, { error: 'Credenciales invalidas' });

            let step = 5;
            let roleInfo = { role: 'usuario', profileId: null };
            try {
                const regStep = await getRegistrationStep(user.idUsuario);
                step = regStep.step;
            } catch {
                // default to step 5
            }
            try {
                roleInfo = await resolveUserRole(user);
            } catch {
                // default to usuario
            }
            const token = jwt.sign({ userId: user.idUsuario, correo: user.correo }, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });

            return json(res, 200, {
                message: 'Login exitoso',
                token,
                user: safeUser(user, step, roleInfo),
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
                tienePersonasACargo, personasACargoQuien, rolFamiliar, escolaridad, ocupacion, nivelIngresos,
            } = req.body;

            const rolFamiliarNormalizado = Array.isArray(rolFamiliar)
                ? rolFamiliar.filter(Boolean)
                : (rolFamiliar ? [rolFamiliar] : []);

            const socioErrors = validateSociodemograficoPayload({
                estadoCivil, conQuienVive, rolFamiliar: rolFamiliarNormalizado,
                tienePersonasACargo, personasACargoQuien, escolaridad, ocupacion, nivelIngresos,
            });
            if (socioErrors.length > 0) {
                return json(res, 400, { error: socioErrors[0] });
            }

            const socioId = crypto.randomUUID();
            const rolFamiliarJson = JSON.stringify(rolFamiliarNormalizado);

            await prisma.$executeRawUnsafe(
                `
                INSERT INTO informacion_sociodemografica (
                    id,
                    usuarioId,
                    estadoCivil,
                    numeroHijos,
                    numeroHermanos,
                    conQuienVive,
                    tienePersonasACargo,
                    escolaridad,
                    ocupacion,
                    nivelIngresos,
                    rolFamiliar,
                    fechaCreacion,
                    fechaActualizacion
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE
                    estadoCivil = VALUES(estadoCivil),
                    numeroHijos = VALUES(numeroHijos),
                    numeroHermanos = VALUES(numeroHermanos),
                    conQuienVive = VALUES(conQuienVive),
                    tienePersonasACargo = VALUES(tienePersonasACargo),
                    escolaridad = VALUES(escolaridad),
                    ocupacion = VALUES(ocupacion),
                    nivelIngresos = VALUES(nivelIngresos),
                    rolFamiliar = VALUES(rolFamiliar),
                    fechaActualizacion = NOW()
                `,
                socioId,
                userId,
                estadoCivil,
                Number(numeroHijos) || 0,
                Number(numeroHermanos) || 0,
                conQuienVive,
                tienePersonasACargo || 'No',
                escolaridad,
                ocupacion,
                nivelIngresos,
                rolFamiliarJson,
            );

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

            // Admin autenticado por variables de entorno — no existe en BD
            if (decoded.userId === 'admin-env') {
                return json(res, 200, {
                    registrationStep: 5,
                    user: {
                        id: 'admin-env',
                        primerNombre: 'Administrador',
                        correo: decoded.correo || ENV_ADMIN_EMAIL,
                        documento: '',
                        consentimientoInformado: 'si',
                        autorizacionDatos: 'si',
                        registrationStep: 5,
                        role: 'admin',
                        profileId: null,
                    },
                });
            }

            const user = await prisma.informacionUsuario.findUnique({ where: { idUsuario: decoded.userId } });
            if (!user) return json(res, 404, { error: 'Usuario no encontrado' });

            let step = 5;
            try { step = (await getRegistrationStep(decoded.userId)).step; } catch { /* default 5 */ }
            let roleInfo = { role: 'usuario', profileId: null };
            try { roleInfo = await resolveUserRole(user); } catch { /* default */ }

            return json(res, 200, {
                registrationStep: roleInfo.role === 'admin' || roleInfo.role === 'practicante' ? 5 : step,
                user: safeUser(user, step, roleInfo),
            });
        } catch (error) {
            console.error('Error en /v1/auth/check-status:', error);
            return json(res, 500, { error: 'Error interno del servidor' });
        }
    });

    // ── GET /v1/auth/me ─────────────────────────────────────
    server.get('/v1/auth/me', async (req, res) => {
        try {
            const decoded = verifyToken(req);
            if (!decoded?.userId) return json(res, 401, { error: 'No autenticado' });

            // Admin autenticado por variables de entorno — no existe en BD
            if (decoded.userId === 'admin-env') {
                return json(res, 200, {
                    user: {
                        id: 'admin-env',
                        email: decoded.correo || ENV_ADMIN_EMAIL,
                        role: 'admin',
                        profileId: null,
                    },
                });
            }

            const user = await prisma.informacionUsuario.findUnique({ where: { idUsuario: decoded.userId } });
            if (!user) return json(res, 404, { error: 'Usuario no encontrado' });

            let roleInfo = { role: 'usuario', profileId: null };
            try { roleInfo = await resolveUserRole(user); } catch { /* default */ }
            return json(res, 200, {
                user: {
                    id: user.idUsuario,
                    email: user.correo,
                    role: roleInfo.role,
                    profileId: roleInfo.profileId,
                },
            });
        } catch (error) {
            console.error('Error en /v1/auth/me:', error);
            return json(res, 500, { error: 'Error interno del servidor' });
        }
    });

    console.log('✅ Rutas de autenticación web registradas (/v1/auth/*)');
}
