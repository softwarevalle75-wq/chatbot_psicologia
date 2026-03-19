// Módulo standalone para configuración RAG — solo Prisma, sin dependencia de app.js/WhatsApp
import { prisma } from '../lib/prisma.js'

/**
 * Obtiene la configuración RAG (systemInstructions + promptTemplate) desde la BD.
 * Lanza error si no existe — debe inicializarse con: node scripts/initialize-rag-config.js
 */
export const getRagPsychologicalConfig = async () => {
	const config = await prisma.ragPsychologicalConfig.findUnique({
		where: { id: 'general' }
	})
	if (!config) {
		throw new Error('Configuración RAG no encontrada. Ejecuta: node scripts/initialize-rag-config.js')
	}
	return config
}

/**
 * Guarda el resultado de una prueba psicológica en el historial del usuario.
 * Si el usuario no existe en la BD, retorna silenciosamente (no es error crítico).
 */
export const guardarResultadoPrueba = async (telefono, tipoTest, datosResultados) => {
	try {
		console.log(`🫡 Guardando prueba ${tipoTest} para usuario ${telefono}`)
		const usuario = await prisma.informacionUsuario.findUnique({
			where: { telefonoPersonal: telefono },
			select: { idUsuario: true },
		})
		if (!usuario) {
			console.log(`❌ El usuario con telefono ${telefono} no se encuentra en la base de datos`)
			return
		}
		await prisma.historialTest.create({
			data: {
				usuarioId: usuario.idUsuario,
				tipoTest: tipoTest,
				resultados: datosResultados,
			}
		})
		console.log(`✅ Los resultados para ${telefono} en ${tipoTest} fueron guardados con éxito`)
	} catch (error) {
		console.error(`❌ Error al guardar resultado para ${telefono} en ${tipoTest}:`, error)
	}
}
