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
const JWT_SECRET = process.env.JWT_SECRET || 'secret_key';

// ── Helpers ─────────────────────────────────────────────────

const normalizeEmail = (v) => String(v || '').trim().toLowerCase();
const normalizePhone = (v) => String(v || '').replace(/\D/g, '');
const canonicalYesNo = (v) => {
    const t = String(v || '').trim().toLowerCase();
    return t === 'si' || t === 'sí' ? 'si' : 'no';
};
const isYes = (v) => canonicalYesNo(v) === 'si';

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
        return jwt.verify(token, JWT_SECRET);
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
            const {
                primerNombre, segundoNombre, primerApellido, segundoApellido,
                tipoDocumento, documento, genero, correo, telefonoPersonal,
                fechaNacimiento, perteneceUniversidad, carrera, jornada, semestre,
                password, esAspirante,
            } = req.body;

            if (!primerNombre || !primerApellido || !correo || !telefonoPersonal || !password || !documento) {
                return json(res, 400, { error: 'Faltan campos obligatorios' });
            }

            const correoNorm = normalizeEmail(correo);
            const telefonoLimpio = normalizePhone(telefonoPersonal);
            const telefonoConPrefijo = telefonoLimpio.startsWith('57') ? telefonoLimpio : `57${telefonoLimpio}`;
            const perteneceUni = canonicalYesNo(perteneceUniversidad) === 'si';
            const aspiranteFlag = Boolean(esAspirante);

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
                        primerNombre: primerNombre.trim(),
                        segundoNombre: segundoNombre?.trim() || null,
                        primerApellido: primerApellido.trim(),
                        segundoApellido: segundoApellido?.trim() || null,
                        tipoDocumento: tipoDocumento || 'CC',
                        documento,
                        genero: genero || 'No especificado',
                        correo: correoNorm,
                        telefonoPersonal: telefonoConPrefijo,
                        fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : new Date(),
                        perteneceUniversidad: perteneceUni ? 'Si' : 'No',
                        carrera: carrera || null,
                        jornada: jornada || null,
                        semestre: semestre ? Number(semestre) : null,
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
                            documento: documento || null,
                            estado: 'aspirante',
                        },
                    });
                }

                return created;
            });

            const token = jwt.sign({ userId: user.idUsuario, correo: user.correo }, JWT_SECRET, { expiresIn: '7d' });

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
            const token = jwt.sign({ userId: user.idUsuario, correo: user.correo }, JWT_SECRET, { expiresIn: '7d' });

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
            const userId = decoded?.userId || req.body?.userId;
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
            const userId = decoded?.userId || req.body?.userId;
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
            const userId = decoded?.userId || req.body?.userId;
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
