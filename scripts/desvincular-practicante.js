import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const normalizePhone = (value) => String(value || '').replace(/\D/g, '')

const buildPhoneCandidates = (rawPhone) => {
	const phone = normalizePhone(rawPhone)
	if (!phone) return []

	const candidates = [phone]
	if (phone.startsWith('57') && phone.length > 2) {
		candidates.push(phone.slice(2))
	} else {
		candidates.push(`57${phone}`)
	}

	return [...new Set(candidates)]
}

const main = async () => {
	const userPhoneArg = process.argv[2]
	if (!userPhoneArg) {
		console.log('Uso: node scripts/desvincular-practicante.js <telefono_usuario>')
		process.exitCode = 1
		return
	}

	const candidates = buildPhoneCandidates(userPhoneArg)
	if (candidates.length === 0) {
		console.error('❌ Número de usuario inválido.')
		process.exitCode = 1
		return
	}

	try {
		const user = await prisma.informacionUsuario.findFirst({
			where: { telefonoPersonal: { in: candidates } },
			select: {
				idUsuario: true,
				telefonoPersonal: true,
				primerNombre: true,
				primerApellido: true,
				practicanteAsignado: true,
			},
		})

		if (!user) {
			console.error(`❌ No se encontró usuario con teléfono ${candidates.join(' / ')}`)
			process.exitCode = 1
			return
		}

		if (!user.practicanteAsignado) {
			console.log('ℹ️ El usuario ya estaba sin practicante asignado.')
			console.log(`- Usuario: ${user.primerNombre || ''} ${user.primerApellido || ''}`.trim())
			console.log(`- Teléfono usuario: ${user.telefonoPersonal}`)
			return
		}

		await prisma.informacionUsuario.update({
			where: { idUsuario: user.idUsuario },
			data: { practicanteAsignado: null },
		})

		console.log('✅ Practicante desvinculado correctamente')
		console.log(`- Usuario: ${user.primerNombre || ''} ${user.primerApellido || ''}`.trim())
		console.log(`- Teléfono usuario: ${user.telefonoPersonal}`)
		console.log(`- Practicante previo (UUID): ${user.practicanteAsignado}`)
	} catch (error) {
		console.error('❌ Error desvinculando practicante:', error)
		process.exitCode = 1
	} finally {
		await prisma.$disconnect()
	}
}

main()
