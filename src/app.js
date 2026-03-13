import { createBot, createProvider, createFlow } from "@builderbot/bot";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";

// ── Provider: WebSocket (reemplaza WhatsApp/Baileys) ──
import { WebSocketProvider } from "./provider/WebSocketProvider.js";

// ── DESACTIVADO: WhatsApp/Baileys provider ──
// import { BaileysProvider as Provider } from "builderbot-provider-sherpa";
// import { getRealPhoneFromCtx, phoneFromAny } from "./helpers/jidHelper.js";
// import { saveBotRuntimePhone } from "../shared/botRuntimeState.js";
// import { isBotReady, markBotReady, enqueueMessage, flushQueue } from "../shared/startupQueue.js";

import {
	welcomeFlow,
	dataConsentFlow,
	reconsentFlow,
	esDeUniversidadFlow,
	menuFlow,
	testSelectionFlow,
	testFlow,
	agendFlow,
	pedirNumeroPracticanteAsignadoFlow,
	pedirDocumentoProfesionalFlow,
} from "./flows/flows.js";

import {
	adminEntryFlow,
	adminMenuFlow,
	adminPedirTelefonoFlow,
	adminAsignarRolFlow,
	adminEditarPracticanteFlow,
	adminEditarPracticanteClinicaFlow,
	adminEditarPracticanteHorarioFlow,
	adminEditarPracticanteOtroHorarioFlow,
} from './flows/roles/adminMenuFlow.js'
import { menuMiddleware } from './flows/roles/menuMiddleware.js';
import {
	practMenuFlow,
	practOfrecerTestFlow__ElegirTest,
	practOfrecerTestFlow__PedirTelefono,
	practConsejosFlow,
	practEsperarResultados
} from './flows/roles/practMenuFlow.js'

import {
	completarPerfilPracticanteFlow,
	resumenDatosFlow,
	recordatorioDatosFlow
} from './flows/roles/cambioRolFlow.js';

import {
	getPracticante,
	getUsuario,
	addWebUser,
	editWebUser,
	citaWebCheckout,
	getWebConsultorios,
	ChangeWebConsultorio,
	getWebCitas,
	citasPorPaciente,
} from "./queries/queries.js";

// inicializar RAG
import { initializeRAG } from "./RAG/index.js";

// Auth routes for web chatbot frontend
import { registerAuthRoutes } from "./routes/authRoutes.js";

const PORT = process.env.PORT ?? 3000;

const parseAllowedOrigins = () => {
	const source = process.env.CORS_ORIGINS || process.env.FRONTEND_ORIGIN || process.env.IP_DOMAIN || '';
	return source
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins();

const resolveCorsOrigin = (requestOrigin) => {
	if (!requestOrigin) return null;
	if (allowedOrigins.length === 0) return requestOrigin;
	if (allowedOrigins.includes('*')) return '*';
	return allowedOrigins.includes(requestOrigin) ? requestOrigin : null;
};

// ── Provider: WebSocket ──
export const adapterProvider = createProvider(WebSocketProvider);

// ── DESACTIVADO: WhatsApp/Baileys provider y middleware de JID ──
// export const adapterProvider = createProvider(Provider, {
// 	version: [2, 3000, 1033834674],
// 	baileys: { writeMyself: 'both', keepAliveIntervalMs: 30000 }
// });
//
// adapterProvider.on("message", (ctx) => {
// 	try {
// 		const realPhone = getRealPhoneFromCtx(ctx)
// 		const realJid = realPhone ? `${realPhone}` : null
// 		ctx.realPhone = realPhone
// 		ctx.realJid = realJid
// 		if (realPhone) ctx.from = realJid
// 		if (realJid && ctx?.key) ctx.key.remoteJid = realJid
// 		if (!isBotReady()) { enqueueMessage(ctx); }
// 	} catch (e) {
// 		console.error('Error en middleware JID:', e)
// 	}
// });

//---------------------------------------------------------------------------------------------------------

const main = async () => {
	console.log('🚀 Iniciando ChatBot Psicológico (modo WebSocket)...');

	const adapterFlow = createFlow([
		// Flujos de entrada y bienvenida
		welcomeFlow,

		// Flujos de registro (DEPRECADOS - ahora se hace por web)
		dataConsentFlow,
		reconsentFlow,
		pedirNumeroPracticanteAsignadoFlow,
		esDeUniversidadFlow,

		// Flujos de menús (agrupados)
		menuFlow,

		adminEntryFlow,
		adminMenuFlow,
		adminPedirTelefonoFlow,
		adminAsignarRolFlow,
		adminEditarPracticanteFlow,
		adminEditarPracticanteClinicaFlow,
		adminEditarPracticanteHorarioFlow,
		adminEditarPracticanteOtroHorarioFlow,
		menuMiddleware,

		// Flujos de roles (después de welcome)
		practMenuFlow,
		practEsperarResultados,

		// Flujos de cambio de rol
		completarPerfilPracticanteFlow,
		resumenDatosFlow,
		recordatorioDatosFlow,

		// Flujos de tests (en orden lógico)
		testSelectionFlow,
		practOfrecerTestFlow__ElegirTest,
		practOfrecerTestFlow__PedirTelefono,
		testFlow,
		practConsejosFlow,

		// Flujos de agendamiento
		agendFlow,

		// Flujo para pedir documento del profesional y enviar PDF por correo
		pedirDocumentoProfesionalFlow,
	]);


	console.log('📊 Configurando base de datos...');
	console.log('DB Config:', {
		host: process.env.MYSQL_DB_HOST,
		user: process.env.MYSQL_DB_USER,
		database: process.env.MYSQL_DB_NAME,
		password: process.env.MYSQL_DB_PASSWORD ? '***' : 'NO_PASSWORD'
	});

	let adapterDB;
	try {
		adapterDB = new Database({
			host: process.env.MYSQL_DB_HOST,
			user: process.env.MYSQL_DB_USER,
			database: process.env.MYSQL_DB_NAME,
			password: process.env.MYSQL_DB_PASSWORD,
			port: process.env.MYSQL_DB_PORT || 3306,
			timezone: '-05:00' // zona horaria para Colombia
		});
		console.log('✅ Base de datos configurada');
	} catch (error) {
		console.error('❌ Error configurando base de datos:', error.message);
		console.log('⚠️ Continuando sin base de datos...');
		adapterDB = null;
	}


	console.log('🤖 Creando bot...');
	const { handleCtx, httpServer } = await createBot({
		flow: adapterFlow,
		provider: adapterProvider,
		database: adapterDB,
	});

	// ── DESACTIVADO: WhatsApp bot number detection y startup queue ──
	// let runtimePublished = false
	// const tryPublishRuntimeNumber = async (source) => { ... }
	// await tryPublishRuntimeNumber('startup')
	// const ev = adapterProvider?.vendor?.ev
	// ... connection.update listeners, timeouts, polling ...

	console.log('✅ Bot creado exitosamente');

	if (typeof adapterProvider.server.use === 'function') {
		adapterProvider.server.use((req, res, next) => {
			const requestOrigin = req.headers?.origin;
			const corsOrigin = resolveCorsOrigin(requestOrigin);

			if (corsOrigin) {
				res.setHeader('Access-Control-Allow-Origin', corsOrigin);
				res.setHeader('Vary', 'Origin');
				res.setHeader('Access-Control-Allow-Credentials', 'true');
			}

			res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
			res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

			if (req.method === 'OPTIONS') {
				res.writeHead(204);
				res.end();
				return;
			}

			next();
		});
		console.log('✅ CORS habilitado para API HTTP');
	}

	// 🔥 CONFIGURAR PROVIDER PARA ENVÍO DE PDFs
	const { configurarProviderGHQ12 } = await import('./flows/tests/ghq12.js');
	const { configurarProviderDASS21 } = await import('./flows/tests/dass21.js');
	configurarProviderGHQ12(adapterProvider);
	configurarProviderDASS21(adapterProvider);

	//---------------------------------------------------------------------------------------------------------

	// Inicializar RAG
	initializeRAG()
		.then(() => console.log('✅ RAG listo'))
		.catch(err => console.error('❌ Error inicializando RAG:', err));


	//---------------------------------------------------------------------------------------------------------

	// ── Auth routes for web chatbot frontend ──
	registerAuthRoutes(adapterProvider.server);

	// Ruta raíz
	adapterProvider.server.get("/", (req, res) => {
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ status: 'ok', mode: 'websocket', message: 'ChatBot Psicológico API' }));
	});

	adapterProvider.server.post(
		"/v1/messages",
		handleCtx(async (bot, req, res) => {
			let { number, message, urlMedia } = req.body;
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

	//---------------------------------------------------------------------------------------------------------

	adapterProvider.server.get(
		"/v1/front/:entity/:searchQuery",
		handleCtx(async (req, res) => {
			const { entity, searchQuery } = req.params;

			try {
				let response;
				console.log(entity);
				switch (entity) {
					case "user":
						response = await getUsuario(searchQuery);
						break;

					case "practicante":
						response = await getPracticante(searchQuery);
						break;

					default:
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
		handleCtx(async (req, res) => {
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
		"/v1/front/editUser",
		handleCtx(async (req, res) => {
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
		"/v1/front/citaCheckout",
		handleCtx(async (req, res) => {
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
		handleCtx(async (res) => {
			try {
				const response = await getWebConsultorios();

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
		handleCtx(async (req, res) => {
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
		handleCtx(async (req, res) => {
			const { diaActual } = req.query;

			try {
				const response = await getWebCitas(diaActual);

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

	adapterProvider.server.get(
		"/v1/front/citasPorPaciente",
		handleCtx(async (req, res) => {
			const { idPaciente } = req.body;

			try {
				const response = await citasPorPaciente(idPaciente);

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

	console.log(`🤖 Bot iniciado en puerto ${PORT}`);
	try {
		httpServer(+PORT);
		console.log(`✅ Servidor HTTP + WebSocket iniciado en puerto ${PORT}`);
		await new Promise(() => { });
	} catch (error) {
		console.error('❌ Error iniciando servidor HTTP:', error);
		throw error;
	}
};

main().catch((error) => {
	console.error('❌ Error fatal en main:', error);
	console.error('Stack trace:', error.stack);
	process.exit(1);
});
