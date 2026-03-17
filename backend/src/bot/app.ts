import "dotenv/config";
import { createBot, createProvider, createFlow } from "@builderbot/bot";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import {
	welcomeFlow,
	registerFlow,
	assistantFlow,
	testFlow,
	agendFlow,
	finalFlow,
} from "./flows/flows.js";

import {
	getPracticante,
	getUsuario,
	addWebUser,
	addWebPracticante,
	editWebUser,
	editWebPracticante,
	citaWebCheckout,
	getWebConsultorios,
	ChangeWebConsultorio,
	getWebCitas,
	// citasPorPaciente,
} from "./queries/queries.js";

const PORT = process.env.PORT ?? 3008;

//---------------------------------------------------------------------------------------------------------

const main = async () => {
	const adapterFlow = createFlow([
		welcomeFlow,
		registerFlow,
		assistantFlow,
		testFlow,
		agendFlow,
		finalFlow,
	]);

	const adapterProvider = createProvider(Provider);
	const adapterDB = new Database({
		host: process.env.MYSQL_DB_HOST,
		user: process.env.MYSQL_DB_USER,
		database: process.env.MYSQL_DB_NAME,
		password: process.env.MYSQL_DB_PASSWORD,
	});

	const startBot = createBot as unknown as (
		config: Record<string, unknown>,
		options?: Record<string, unknown>
	) => Promise<{ handleCtx: any; httpServer: (port: number) => void }>;

	const { handleCtx, httpServer } = await startBot(
		{
			flow: adapterFlow,
			provider: adapterProvider,
			database: adapterDB,
		},
		{
			queue: {
				timeout: 1000,
				concurrencyLimit: 5,
			},
		}
	);

	//---------------------------------------------------------------------------------------------------------

	adapterProvider.server.post(
		"/v1/messages",
		handleCtx(async (bot, req, res) => {
			const { number, message, urlMedia } = req.body;
			await bot.sendMessage(number, message, { media: urlMedia ?? null });
			return res.end("sended");
		})
	);

	adapterProvider.server.post(
		"/v1/register",
		handleCtx(async (bot, req, res) => {
			const { number, name } = req.body;
			await bot.dispatch("REGISTER_FLOW", { from: number, name });
			return res.end("trigger");
		})
	);

	adapterProvider.server.post(
		"/v1/samples",
		handleCtx(async (bot, req, res) => {
			const { number, name } = req.body;
			await bot.dispatch("SAMPLES", { from: number, name });
			return res.end("trigger");
		})
	);

	adapterProvider.server.post(
		"/v1/blacklist",
		handleCtx(async (bot, req, res) => {
			const { number, intent } = req.body;
			if (intent === "remove") bot.blacklist.remove(number);
			if (intent === "add") bot.blacklist.add(number);

			res.writeHead(200, { "Content-Type": "application/json" });
			return res.end(JSON.stringify({ status: "ok", number, intent }));
		})
	);

	adapterProvider.server.get(
		"/v1/front/:entity/:searchQuery",
		handleCtx(async (bot, req, res) => {
			const { entity, searchQuery } = req.params; // Extrae los parámetros correctamente

			try {
				let response;
				console.log(entity);
				switch (entity) {
					case "user":
						response = await getUsuario(searchQuery); // Lógica para obtener el usuario
						break;

					case "practicante":
						response = await getPracticante(searchQuery); // Lógica para obtener el practicante
						break;

					default:
						// Si la entidad no es válida, devuelve un error
						res.writeHead(400, { "Content-Type": "application/json" });
						return res.end(
							JSON.stringify({
								status: "error",
								message: "Entidad no válida",
							})
						);
				}

				res.writeHead(200, { "Content-Type": "application/json" });
				return res.end(JSON.stringify(response));
			} catch (error) {
				// Manejo de errores
				console.error(error);
				res.writeHead(500, { "Content-Type": "application/json" });
				return res.end(
					JSON.stringify({
						status: "error",
						message: "Error al consultar la base de datos",
					})
				);
			}
		})
	);

	//---------------------------------------------------------------------------------------------------------

	adapterProvider.server.post(
		"/v1/front/addUser",
		handleCtx(async (bot, req, res) => {
			const { nombre, apellido, correo, tipoDocumento, documento, telefonoPersonal } =
				req.body;

			try {
				const response = await addWebUser(
					nombre,
					apellido,
					correo,
					tipoDocumento,
					documento,
					telefonoPersonal
				);

				res.writeHead(200, { "Content-Type": "application/json" });
				return res.end(JSON.stringify(response));
			} catch (error) {
				console.error(error);
				res.writeHead(500, { "Content-Type": "application/json" });
				return res.end(
					JSON.stringify({
						status: "error",
						message: "Error al insertar el usuario en la base de datos",
					})
				);
			}
		})
	);

	//---------------------------------------------------------------------------------------------------------

	adapterProvider.server.post(
		"/v1/front/addPracticante",
		handleCtx(async (bot, req, res) => {
			const {
				nombre,
				documento,
				tipoDocumento,
				genero,
				estrato,
				barrio,
				localidad,
				horario,
			} = req.body;

			try {
				const response = await addWebPracticante(
					nombre,
					documento,
					tipoDocumento,
					genero,
					estrato,
					barrio,
					localidad,
					horario
				);

				res.writeHead(200, { "Content-Type": "application/json" });
				return res.end(JSON.stringify(response));
			} catch (error) {
				console.error(error);
				res.writeHead(500, { "Content-Type": "application/json" });
				return res.end(
					JSON.stringify({
						status: "error",
						message: "Error al insertar el practicante en la base de datos",
					})
				);
			}
		})
	);

	//---------------------------------------------------------------------------------------------------------

	adapterProvider.server.post(
		"/v1/front/editUser",
		handleCtx(async (bot, req, res) => {
			const { nombre, apellido, correo, tipoDocumento, documento, telefonoPersonal } =
				req.body;

			try {
				const response = await editWebUser(
					nombre,
					apellido,
					correo,
					tipoDocumento,
					documento,
					telefonoPersonal
				);

				res.writeHead(200, { "Content-Type": "application/json" });
				return res.end(JSON.stringify(response));
			} catch (error) {
				console.error(error);
				res.writeHead(500, { "Content-Type": "application/json" });
				return res.end(
					JSON.stringify({
						status: "error",
						message: "Error al editar el usuario en la base de datos",
					})
				);
			}
		})
	);

	//---------------------------------------------------------------------------------------------------------

	adapterProvider.server.post(
		"/v1/front/editPracticante",
		handleCtx(async (bot, req, res) => {
			const {
				nombre,
				documento,
				tipoDocumento,
				genero,
				estrato,
				barrio,
				localidad,
				horario,
			} = req.body;

			try {
				const response = await editWebPracticante(
					nombre,
					documento,
					tipoDocumento,
					genero,
					estrato,
					barrio,
					localidad,
					horario
				);

				res.writeHead(200, { "Content-Type": "application/json" });
				return res.end(JSON.stringify(response));
			} catch (error) {
				console.error(error);
				res.writeHead(500, { "Content-Type": "application/json" });
				return res.end(
					JSON.stringify({
						status: "error",
						message: "Error al editar el practicante en la base de datos",
					})
				);
			}
		})
	);

	//---------------------------------------------------------------------------------------------------------

	adapterProvider.server.post(
		"/v1/front/citaCheckout",
		handleCtx(async (bot, req, res) => {
			const { idCita } = req.body;

			try {
				const response = await citaWebCheckout(idCita);

				res.writeHead(200, { "Content-Type": "application/json" });
				return res.end(JSON.stringify(response));
			} catch (error) {
				console.error(error);
				res.writeHead(500, { "Content-Type": "application/json" });
				return res.end(
					JSON.stringify({
						status: "error",
						message: "Error al editar la cita en la base de datos",
					})
				);
			}
		})
	);

	//---------------------------------------------------------------------------------------------------------

	adapterProvider.server.get(
		"/v1/front/consultorios",
		handleCtx(async (bot, req, res) => {
			try {
				const response = await getWebConsultorios();
				console.log("consultoriosGet");
				res.writeHead(200, { "Content-Type": "application/json" });
				return res.end(JSON.stringify(response));
			} catch (error) {
				console.error(error);
				res.writeHead(500, { "Content-Type": "application/json" });
				return res.end(
					JSON.stringify({
						status: "error",
						message: "Error al consultar los consultorios en la base de datos",
					})
				);
			}
		})
	);

	//---------------------------------------------------------------------------------------------------------

	adapterProvider.server.post(
		"/v1/front/changeConsultorio",
		handleCtx(async (bot, req, res) => {
			const { idConsultorio } = req.body;

			try {
				const response = await ChangeWebConsultorio(idConsultorio);

				res.writeHead(200, { "Content-Type": "application/json" });
				return res.end(JSON.stringify(response));
			} catch (error) {
				console.error(error);
				res.writeHead(500, { "Content-Type": "application/json" });
				return res.end(
					JSON.stringify({
						status: "error",
						message: "Error al editar el consultorio en la base de datos",
					})
				);
			}
		})
	);

	//---------------------------------------------------------------------------------------------------------

	adapterProvider.server.get(
		"/v1/front/citas",
		handleCtx(async (bot, req, res) => {
			const diaActual = new Date();
			console.log("citasGet", diaActual);

			try {
				const response = await getWebCitas(diaActual);
				console.log("citasGet", response);
				res.writeHead(200, { "Content-Type": "application/json" });
				return res.end(JSON.stringify(response));
			} catch (error) {
				console.error(error);
				res.writeHead(500, { "Content-Type": "application/json" });
				return res.end(
					JSON.stringify({
						status: "error",
						message: "Error al consultar las citas en la base de datos",
					})
				);
			}
		})
	);

	//---------------------------------------------------------------------------------------------------------

	// adapterProvider.server.get(
	// 	'v1/front/citasPorPaciente',

	// 	handleCtx(async (bot, req, res) => {
	// 		const { idPaciente } = req.body

	// 		try {
	// 			const response = await citasPorPaciente(idPaciente)

	// 			res.writeHead(200, { 'Content-Type': 'application/json' })
	// 			return res.end(JSON.stringify(response))
	// 		} catch (error) {
	// 			console.error(error)
	// 			res.writeHead(500, { 'Content-Type': 'application/json' })
	// 			return res.end(
	// 				JSON.stringify({
	// 					status: 'error',
	// 					message: 'Error al consultar las citas en la base de datos',
	// 				})
	// 			)
	// 		}
	// 	})
	// )

	httpServer(+PORT);
};

main();
