import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Registro
router.post('/register', async (req, res) => {
    try {
        const {
            primerNombre,
            segundoNombre,
            primerApellido,
            segundoApellido,
            telefonoPersonal,
            segundoTelefono,
            correo,
            segundoCorreo,
            fechaNacimiento,
            perteneceUniversidad,
            documento,
            tipoDocumento,
            password
        } = req.body;

        // Agregar prefijo 57 al teléfono si no lo tiene
        const telefonoConPrefijo = telefonoPersonal.startsWith('57') ? telefonoPersonal : `57${telefonoPersonal}`;
        console.log(`📞 Teléfono original: ${telefonoPersonal} -> Con prefijo: ${telefonoConPrefijo}`);

// Verificar si el usuario ya existe (buscar con ambos formatos)
        const existingUser = await prisma.informacionUsuario.findFirst({
            where: {
                OR: [
                    { correo: correo },
                    { telefonoPersonal: telefonoPersonal },
                    { telefonoPersonal: telefonoConPrefijo },
                    ...(documento ? [{ documento: documento }] : [])
                ]
            }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Usuario ya existe' });
        }

        // Cifrar contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

// Crear usuario
        const user = await prisma.informacionUsuario.create({
            data: {
                primerNombre,
                segundoNombre,
                primerApellido,
                segundoApellido,
                telefonoPersonal: telefonoConPrefijo, // USAR TELÉFONO CON PREFIJO 57
                segundoTelefono,
                correo,
                segundoCorreo,
                fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : new Date(),
                perteneceUniversidad,
                password: hashedPassword,
                consentimientoInformado: "No",
                documento: documento || null,
                tipoDocumento: tipoDocumento || "CC"
            }
        });

        // Crear token JWT
        const token = jwt.sign(
            { userId: user.idUsuario, correo: user.correo },
            process.env.JWT_SECRET || 'secret_key',
            { expiresIn: '1h' }
        );

        res.status(201).json({ 
            message: 'Usuario registrado exitosamente', 
            userId: user.idUsuario,
            token: token
        });
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { correo, password } = req.body;

        // Buscar usuario
        const user = await prisma.informacionUsuario.findFirst({
            where: { correo: correo }
        });

        if (!user || !user.password) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Verificar contraseña
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Crear token JWT
        const token = jwt.sign(
            { userId: user.idUsuario, correo: user.correo },
            process.env.JWT_SECRET || 'secret_key',
            { expiresIn: '1h' }
        );

        res.json({ 
            message: 'Login exitoso', 
            token, // brinda el token al registro
            user: {
                id: user.idUsuario,
                primerNombre: user.primerNombre,
                correo: user.correo,
                consentimientoInformado: user.consentimientoInformado
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Consentimiento informado
router.post('/consent', async (req, res) => {
    try {
        const { userId } = req.body;

        await prisma.informacionUsuario.update({
            where: { idUsuario: userId },
            data: { consentimientoInformado: "Si" }
        });

        res.json({ message: 'Consentimiento registrado' });
    } catch (error) {
        console.error('Error en consentimiento:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para consentimiento informado
router.post('/consentimiento', async (req, res) => {
    try {
        const { userId, consentimientoInformado, semestre, jornada, carrera } = req.body;

        const updateData = {};
        
        // Siempre actualizar consentimiento si viene en la petición
        if (consentimientoInformado !== undefined) {
            updateData.consentimientoInformado = consentimientoInformado;
        }
        
        // Solo agregar datos académicos si vienen
        if (semestre) updateData.semestre = semestre;
        if (jornada) updateData.jornada = jornada;
        if (carrera) updateData.carrera = carrera;

        const updatedUser = await prisma.informacionUsuario.update({
            where: { idUsuario: userId },
            data: updateData
        });

        res.json({ message: 'Consentimiento guardado exitosamente', user: updatedUser });
    } catch (error) {
        console.error('Error guardando consentimiento:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// // Middleware para autenticar token
// function authenticateToken(req, res, next) {
//     const authHeader = req.headers['authorization'];
//     const token = authHeader && authHeader.split(' ')[1];

//     if (!token) {
//         return res.status(401).json({ error: 'Token de acceso requerido' });
//     }

//     jwt.verify(token, process.env.JWT_SECRET || 'secret_key', (err, user) => {
//         if (err) {
//             return res.status(403).json({ error: 'Token inválido' });
//         }
//         req.user = user;
//         next();
//     });
// }

// Ruta para guardar información sociodemográfica (soporta ambos métodos: con token y con userId)
router.post('/sociodemografico', async (req, res) => {
    try {
        console.log('Datos recibidos en /sociodemografico:', req.body);

        const {
            estadoCivil,
            numeroHijos,
            numeroHermanos,
            conQuienVive,
            tienePersonasACargo,
            rolFamiliar,
            escolaridad,
            ocupacion,
            nivelIngresos,
            userId // Para casos donde viene directamente del registro
        } = req.body;

        console.log('Campos extraídos:', {
            estadoCivil, conQuienVive, rolFamiliar, escolaridad, ocupacion, nivelIngresos
        });

        // Validar campos requeridos
        if (!estadoCivil || !conQuienVive || !rolFamiliar || !escolaridad || !ocupacion || !nivelIngresos) {
            console.log('Campos faltantes detectados');
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }

        // Determinar el ID del usuario (del token o del parámetro)
        let usuarioId;
        if (req.user) {
            // Viene con token autenticado
            usuarioId = req.user.userId;
            console.log('Usando userId del token:', usuarioId);
        } else if (userId) {
            // Viene directamente del registro con userId
            usuarioId = userId;
            console.log('Usando userId del parámetro:', usuarioId);
        } else {
            console.log('No se pudo determinar usuarioId');
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        // Crear o actualizar información sociodemográfica
        const informacionSociodemografica = await prisma.informacionSociodemografica.upsert({
            where: { usuarioId: usuarioId },
            update: {
                estadoCivil,
                numeroHijos: numeroHijos || 0,
                numeroHermanos: numeroHermanos || 0,
                conQuienVive,
                tienePersonasACargo: tienePersonasACargo || "No",
                rolFamiliar,
                escolaridad,
                ocupacion,
                nivelIngresos
            },
            create: {
                usuarioId: usuarioId,
                estadoCivil,
                numeroHijos: numeroHijos || 0,
                numeroHermanos: numeroHermanos || 0,
                conQuienVive,
                tienePersonasACargo: tienePersonasACargo || "No",
                rolFamiliar,
                escolaridad,
                ocupacion,
                nivelIngresos
            }
        });

        res.json({
            message: 'Información sociodemográfica guardada exitosamente',
            data: informacionSociodemografica
        });
        console.log('Información sociodemográfica guardada exitosamente para usuario:', usuarioId);
    } catch (error) {
        console.error('Error guardando información sociodemográfica:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para verificar información sociodemográfica del usuario (soporta ambos métodos)
router.get('/check-sociodemografico', async (req, res) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        const userId = req.query.userId; // Para casos donde viene con userId en query params

        let usuarioId;
        if (token) {
            try{
                // Verificar token y obtener userId
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
                console.log('Decoded token:', decoded);  // Ve si userId está aquí
                usuarioId = decoded.userId;

            } catch (err){
                console.error("Error verificando token", err);
                return res.status(401).json({ error: 'Usuario no autenticado' });
            }
        } else if (userId) {
            // Usar userId directamente
            usuarioId = userId;
        } else {
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        const informacionSociodemografica = await prisma.informacionSociodemografica.findUnique({
            where: { usuarioId: usuarioId }
        });

        if (informacionSociodemografica) {
            res.json({
                hasSociodemografico: true,
                data: informacionSociodemografica
            });
        } else {
            res.json({ hasSociodemografico: false });
        }
    } catch (error) {
        console.error('Error verificando información sociodemográfica:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para guardar autorización de tratamiento de datos
router.post('/tratamiento-datos', async (req, res) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        const { userId, autorizacionDatos } = req.body;

        let usuarioId;
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
                usuarioId = decoded.userId;
            } catch (error) {
                if (error.name === 'TokenExpiredError') {
                    // Token expirado: Responde con error y posiblemente redirige
                    return res.status(401).json({ 
                        error: 'Token expirado. Inicia sesión nuevamente.',
                        redirect: '/login'  // Opcional: para frontend
                    });
                } else if (error.name === 'JsonWebTokenError') {
                    // Token inválido
                    return res.status(401).json({ error: 'Token inválido.' });
                } else {
                    // Otros errores
                    return res.status(500).json({ error: 'Error interno del servidor.' });
                }
            }
        } else if (userId) {
            usuarioId = userId;
        } else {
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        // Verificar si el usuario existe
        const usuario = await prisma.informacionUsuario.findUnique({
            where: { idUsuario: usuarioId },
            select: { idUsuario: true }
        });

        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Actualizar autorización de tratamiento de datos
        await prisma.informacionUsuario.update({
            where: { idUsuario: usuarioId },
            data: {
                autorizacionDatos: autorizacionDatos || 'No'
            }
        });

        res.json({
            message: 'Autorización de tratamiento de datos guardada exitosamente',
            autorizacionDatos: autorizacionDatos
        });
        console.log('Autorización de tratamiento de datos guardada exitosamente para usuario:', usuarioId);
    } catch (error) {
        console.error('Error guardando autorización de tratamiento de datos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para verificar autorización de tratamiento de datos del usuario
router.get('/check-tratamiento-datos', async (req, res) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        const userId = req.query.userId;

        let usuarioId;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
            usuarioId = decoded.userId;
        } else if (userId) {
            usuarioId = userId;
        } else {
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        const usuario = await prisma.informacionUsuario.findUnique({
            where: { idUsuario: usuarioId },
            select: {
                idUsuario: true,
                autorizacionDatos: "Si"
            }
        });

        if (usuario && usuario.autorizacionDatos) {
            res.json({
                hasTratamientoDatos: true,
                autorizacionDatos: usuario.autorizacionDatos
            });
        } else {
            res.json({ hasTratamientoDatos: false });
        }
    } catch (error) {
        console.error('Error verificando autorización de tratamiento de datos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

export default router;
