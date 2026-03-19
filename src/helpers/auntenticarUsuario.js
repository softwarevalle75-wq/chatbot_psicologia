import { prisma } from '../lib/prisma.js';

const userSelect = {
    idUsuario: true,
    primerNombre: true,
    primerApellido: true,
    consentimientoInformado: true,
    perteneceUniversidad: true,
    semestre: true,
    jornada: true,
    carrera: true,
    flujo: true,
};

/**
 * Permite usar el chatbot sin registro web.
 * Si no existe usuario, crea uno invitado con datos mínimos.
 */
export const verificarAutenticacionWeb = async (telefono, flowDynamic) => {
    try {
        const telefonoLimpio = String(telefono || '').replace(/\D/g, '');
        if (!telefonoLimpio) return null;

        const candidatos = [telefonoLimpio];
        if (telefonoLimpio.startsWith('57') && telefonoLimpio.length > 2) {
            candidatos.push(telefonoLimpio.slice(2));
        } else {
            candidatos.push(`57${telefonoLimpio}`);
        }

        let user = null;
        for (const tel of candidatos) {
            user = await prisma.informacionUsuario.findUnique({
                where: { telefonoPersonal: tel },
                select: userSelect,
            });
            if (user) break;
        }

        if (!user) {
            const telefonoCanonico = telefonoLimpio.startsWith('57') ? telefonoLimpio : `57${telefonoLimpio}`;
            const sufijo = telefonoCanonico.slice(-6);

            user = await prisma.informacionUsuario.create({
                data: {
                    primerNombre: `Invitado${sufijo}`,
                    segundoNombre: null,
                    primerApellido: `Chat${sufijo}`,
                    segundoApellido: null,
                    telefonoPersonal: telefonoCanonico,
                    segundoTelefono: null,
                    correo: `${telefonoCanonico}@guest.local`,
                    segundoCorreo: null,
                    fechaNacimiento: new Date('2000-01-01'),
                    perteneceUniversidad: 'No',
                    documento: null,
                    tipoDocumento: 'CC',
                    genero: 'No especificado',
                    password: 'guest_access',
                    consentimientoInformado: 'si',
                    autorizacionDatos: 'si',
                    flujo: 'menuFlow',
                    isAuthenticated: true,
                },
                select: userSelect,
            });

            if (typeof flowDynamic === 'function') {
                await flowDynamic('✅ *Acceso habilitado*\n\nPuedes usar el chatbot sin registro previo.');
            }
        }

        return user;
    } catch (error) {
        console.error('Error verificando autenticación abierta:', error);
        if (typeof flowDynamic === 'function') {
            await flowDynamic('❌ *Error del sistema*\n\nNo fue posible iniciar tu sesión en este momento. Intenta de nuevo.');
        }
        return null;
    }
};
