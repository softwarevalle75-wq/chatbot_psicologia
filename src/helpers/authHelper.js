import prisma from '../lib/prisma.js';

/**
 * Verifica si un usuario está autenticado mediante la web
 * @param {string} telefono - Número de teléfono del usuario
 * @returns {Promise<Object>} - Estado de autenticación y datos del usuario
 */
export const checkUserAuthentication = async (telefono) => {
    try {
        const user = await prisma.informacionUsuario.findUnique({
            where: { telefonoPersonal: telefono },
            select: {
                idUsuario: true,
                isAuthenticated: true,
                consentimientoInformado: true,
                perteneceUniversidad: true,
                semestre: true,
                jornada: true,
                carrera: true,
                primerNombre: true,
                primerApellido: true,
                flujo: true
            }
        });

        if (!user) {
            return {
                authenticated: false,
                registered: false,
                message: 'Usuario no registrado. Debe registrarse primero en la página web.'
            };
        }

        if (!user.isAuthenticated) {
            return {
                authenticated: false,
                registered: true,
                message: 'Debe iniciar sesión en la página web antes de usar el bot.'
            };
        }

        if (!user.consentimientoInformado) {
            return {
                authenticated: true,
                registered: true,
                consentimientoInformado: false,
                message: 'Debe completar el consentimiento informado en la página web.'
            };
        }

        // Verificar si es estudiante universitario y tiene datos completos
        if (user.perteneceUniversidad && (!user.semestre || !user.jornada || !user.carrera)) {
            return {
                authenticated: true,
                registered: true,
                consentimientoInformado: true,
                datosCompletos: false,
                message: 'Debe completar sus datos académicos en la página web.'
            };
        }

        return {
            authenticated: true,
            registered: true,
            consentimientoInformado: true,
            datosCompletos: true,
            user: {
                id: user.idUsuario,
                nombre: `${user.primerNombre} ${user.primerApellido}`,
                perteneceUniversidad: user.perteneceUniversidad,
                semestre: user.semestre,
                jornada: user.jornada,
                carrera: user.carrera,
                flujo: user.flujo
            },
            message: 'Usuario autenticado correctamente'
        };

    } catch (error) {
        console.error('Error verificando autenticación:', error);
        return {
            authenticated: false,
            error: true,
            message: 'Error interno. Intente nuevamente.'
        };
    }
};

/**
 * Actualiza el flujo del usuario en la base de datos
 * @param {string} telefono - Número de teléfono del usuario
 * @param {string} nuevoFlujo - Nuevo flujo a asignar
 * @returns {Promise<boolean>} - True si se actualizó correctamente
 */
export const updateUserFlow = async (telefono, nuevoFlujo) => {
    try {
        await prisma.informacionUsuario.update({
            where: { telefonoPersonal: telefono },
            data: { flujo: nuevoFlujo }
        });
        return true;
    } catch (error) {
        console.error('Error actualizando flujo:', error);
        return false;
    }
};

/**
 * Obtiene la URL de la página web para registro/login
 * @returns {string} - URL de la página web
 */
export const getWebURL = () => {
    const webPort =   process.env.WEB_PORT || process.env.PORT
    const webHost = process.env.WEB_HOST || '';
    const ipDomain = process.env.IP_DOMAIN

    if (!ipDomain)
        return `http://${webHost}:${webPort}`;
    
    return ipDomain
};

/**
 * Genera mensajes de autenticación para el bot
 */
export const getAuthMessages = () => {
    const webURL = getWebURL();
    
    return {
        notRegistered: `🚫 *No estás registrado*\n\nPara usar este ChatBot, primero debes registrarte en nuestra página web:\n\n🌐 ${webURL}/register\n\n📝 El registro es rápido y seguro. Una vez completado, podrás usar todas las funciones del bot.`,
        
        notAuthenticated: `🔐 *Debes iniciar sesión*\n\nYa tienes una cuenta, pero necesitas iniciar sesión en la página web:\n\n🌐 ${webURL}/login\n\n✅ Una vez que inicies sesión, podrás usar el ChatBot normalmente.`,
        
        noConsent: `📋 *Consentimiento Informado Pendiente*\n\nDebes completar el consentimiento informado en la página web:\n\n🌐 ${webURL}/sociodemografico\n\n⚠️ Este paso es obligatorio para usar el servicio de apoyo psicológico.`,
        
        incompleteData: `📚 *Datos Académicos Incompletos*\n\nComo estudiante universitario, debes completar tus datos académicos:\n\n🌐 ${webURL}/sociodemografico\n\n📝 Necesitamos tu semestre, jornada y carrera para brindarte un mejor servicio.`,
        
        authenticated: (nombre) => `✅ *¡Hola ${nombre}!*\n\n🎉 Ya has iniciado sesión correctamente. Ahora puedes usar todas las funciones del ChatBot de apoyo psicológico.\n\n💬 ¿En qué puedo ayudarte hoy?`,
        
        error: `❌ *Error del Sistema*\n\nHubo un problema verificando tu autenticación. Por favor:\n\n1️⃣ Intenta nuevamente en unos minutos\n2️⃣ Si el problema persiste, contacta al soporte técnico\n\n🌐 ${webURL}`
    };
};
