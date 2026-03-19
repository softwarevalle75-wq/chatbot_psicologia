import prisma from "../../lib/prisma.js";
import { format, parse, addDay, isAfter } from "@formkit/tempo";

export async function asignarCita(usuario) {
	try {
		console.log(usuario);
		const practicantesDisponibles = await encontrarPracticantesDisponibles(usuario);
		console.log(practicantesDisponibles);
		if (practicantesDisponibles.length === 0)
			throw new Error("No hay practicantes disponibles");

		const practicante = practicantesDisponibles.sort((a, b) => a.citasProgramadas - b.citasProgramadas)[0];
		const horario = await encontrarHorarioCompatible(usuario, practicante);
		if (!horario) {
			console.error("Horarios posibles no encontrados debido a:");
			console.log("Disponibilidad usuario:", usuario.disponibilidad);
			console.log("Horario practicante:", practicante.horario);
			throw new Error("No hay horarios compatibles");
		}
		const consultorio = await encontrarConsultorioDisponible(horario.fechaHora);
		if (!consultorio) throw new Error("No hay consultorios disponibles");

		const nuevaCita = await prisma.cita.create({
			data: {
				//nombre usuario, nombre prácticante, fecha y hora, consultorio
				primerNombre: usuario.primerNombre,
				segundoNombre: usuario.segundoNombre,
				primerApellido: usuario.primerApellido,
				fechaHora: horario.fechaHora,
				nombreConsultorio: consultorio.nombre,
				nombrePracticante: practicante.nombre,
				estado: 'pendiente'
				//----
				// idConsultorio: consultorio.idConsultorio,
				// idUsuario: usuario.idUsuario,
				// idPracticante: practicante.idPracticante,
				// fechaHora: horario.fechaHora,
				// estado: "pendiente",
			},
		});

		await prisma.practicante.update({
			where: { idPracticante: practicante.idPracticante },
			data: { citasProgramadas: { increment: 1 } },
		});

		await prisma.informacionUsuario.update({
			where: { idUsuario: usuario.idUsuario },
			data: { practicanteAsignado: practicante.idPracticante },
		});

		return nuevaCita;
	} catch (error) {
		console.error("Error en asignación de cita:", error);
		throw error;
	}
}

// Funciones auxiliares actualizadas con Tempo
async function encontrarPracticantesDisponibles(usuario) {
	const disponibilidad = usuario.disponibilidad;
	const practicantes = await prisma.practicante.findMany();

	return practicantes.filter((practicante) => {
		const horario = practicante.horario;
		return Object.keys(disponibilidad).some(
			(day) => horario[day] && disponibilidad[day].some((time) => horario[day].includes(time))
		);
	});
}

async function encontrarHorarioCompatible(usuario, practicante) {
	const disponibilidad = usuario.disponibilidad;
	const horarioPracticante = practicante.horario;

	const posiblesHorarios = [];

	for (const [day, userTimes] of Object.entries(disponibilidad)) {
		const practTimes = horarioPracticante[day] || [];

		// Coincidencia exacta de horas
		const commonTimes = userTimes.filter((time) =>
			practTimes.some((pTime) => {
				const [userH, userM] = time.split(":").map(Number);
				const [practH, practM] = pTime.split(":").map(Number);
				return userH === practH && userM === practM;
			})
		);

		for (const time of commonTimes) {
			const fechaHora = calcularProximaFecha(day, time);
			if (
				fechaHora &&
				(await verificarDisponibilidadPracticante(practicante.idPracticante, fechaHora))
			) {
				posiblesHorarios.push({ fechaHora });
			}
		}
	}
	console.log("Horarios posibles para:", practicante.nombre);
	posiblesHorarios.forEach((h) => console.log(" -", format(h.fechaHora, "full", "es")));
	if (posiblesHorarios.length === 0) return null;

	return posiblesHorarios.sort((a, b) => a.fechaHora.getTime() - b.fechaHora.getTime())[0];
}

function calcularProximaFecha(day, time) {
	try {
		const ahora = new Date(); // Fecha actual local

		// Buscar en las próximas 3 semanas
		for (let i = 0; i < 21; i++) {
			const fechaPrueba = addDay(ahora, i);

			// Obtener día en español sin acentos
			const diaSemana = format(fechaPrueba, "ddd", "es")
				.toLowerCase()
				.normalize("NFD")
				.replace(/[\u0300-\u036f]/g, "")
				.slice(0, 3);

			if (diaSemana === day) {
				// Crear fecha combinada
				const fechaCompleta = parse(
					`${format(fechaPrueba, "YYYY-MM-DD")} ${time}`,
					"YYYY-MM-DD HH:mm",
					"es"
				);

				// Verificar que la hora sea futura
				if (isAfter(fechaCompleta, ahora)) {
					console.log("Fecha válida:", format(fechaCompleta, "full", "es"));
					return fechaCompleta;
				}
			}
		}
		return null;
	} catch (error) {
		console.error("Error calculando fecha:", error);
		return null;
	}
}

async function verificarDisponibilidadPracticante(practicanteId, fechaHora) {
	const citas = await prisma.cita.findMany({
		where: {
			idPracticante: practicanteId,
			fechaHora: { equals: fechaHora },
		},
	});

	return citas.length === 0;
}

async function encontrarConsultorioDisponible(fechaHora) {
	const consultorios = await prisma.consultorio.findMany({
		include: { citas: { where: { fechaHora } } },
	});

	return consultorios.find((c) => c.citas.length === 0);
}

//*--------------------------    Ejecutar un ejemplo    --------------------------*//

// async function ejecutarEjemplo() {
// 	try {
// 		// Obtener el primer usuario
// 		const usuario = await prisma.informacionUsuario.findFirst({
// 			// Primer usuario creado
// 		})

// 		if (!usuario) {
// 			console.log('No hay usuarios en la base de datos')
// 			return
// 		}

// 		// Ejecutar la asignación de cita
// 		const citaAsignada = await asignarCita(usuario)

// 		console.log('Cita asignada exitosamente:', citaAsignada)
// 		return citaAsignada
// 	} catch (error) {
// 		console.error('Error en el ejemplo:', error.message)
// 	}
// }

// // Ejecutar el ejemplo
// const cita = await ejecutarEjemplo()
// console.log(format(cita.fechaHora, { time: 'full', date: 'full' }, 'es'))

//*--------------------------    Ejecutar un ejemplo    --------------------------*//
