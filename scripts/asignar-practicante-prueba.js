import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const normalizeText = (value) =>
	String(value || '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.trim()

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

const findPractitionerForTests = async () => {
	const practitioners = await prisma.practicante.findMany({
		select: {
			idPracticante: true,
			nombre: true,
			telefono: true,
		},
	})

	const exact = practitioners.find((p) => {
		const name = normalizeText(p.nombre)
		return name === 'practicante prueba' || name === 'practicante para pruebas'
	})
	if (exact) return exact

	const fuzzy = practitioners.find((p) => {
		const name = normalizeText(p.nombre)
		return name.includes('practicante') && name.includes('prueba')
	})

	return fuzzy || null
}

const main = async () => {
	const userPhoneArg = process.argv[2]
	if (!userPhoneArg) {
		console.log('Uso: node scripts/asignar-practicante-prueba.js <telefono_usuario>')
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
		const practitioner = await findPractitionerForTests()
		if (!practitioner) {
			console.error('❌ No se encontró un practicante de pruebas (nombre esperado: "practicante prueba" o similar).')
			process.exitCode = 1
			return
		}

		const user = await prisma.informacionUsuario.findFirst({
			where: { telefonoPersonal: { in: candidates } },
			select: { telefonoPersonal: true, primerNombre: true, primerApellido: true, practicanteAsignado: true },
		})

		if (!user) {
			console.error(`❌ No se encontró usuario con teléfono ${candidates.join(' / ')}`)
			process.exitCode = 1
			return
		}

		await prisma.informacionUsuario.update({
			where: { telefonoPersonal: user.telefonoPersonal },
			data: { practicanteAsignado: practitioner.telefono },
		})

		console.log('✅ Practicante de pruebas asignado correctamente')
		console.log(`- Usuario: ${user.primerNombre || ''} ${user.primerApellido || ''}`.trim())
		console.log(`- Teléfono usuario: ${user.telefonoPersonal}`)
		console.log(`- Practicante: ${practitioner.nombre}`)
		console.log(`- Teléfono practicante asignado: ${practitioner.telefono}`)
	} catch (error) {
		console.error('❌ Error asignando practicante de pruebas:', error)
		process.exitCode = 1
	} finally {
		await prisma.$disconnect()
	}
}

main()
