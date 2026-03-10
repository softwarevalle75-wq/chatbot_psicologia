import { createBot, createProvider, createFlow } from "@builderbot/bot";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { BaileysProvider as Provider } from "builderbot-provider-sherpa";
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
import { getRealPhoneFromCtx, phoneFromAny } from "./helpers/jidHelper.js";
import { saveBotRuntimePhone } from "../shared/botRuntimeState.js";
import { isBotReady, markBotReady, enqueueMessage, flushQueue } from "../shared/startupQueue.js";

// inicializar RAG
import { initializeRAG } from "./RAG/index.js";

const originalConsoleInfo = console.info.bind(console)
const libsignalNoisePatterns = [
	/^Closing session:/,
	/^Removing old closed session:/,
	/^Opening session:/,
]

console.info = (...args) => {
	const firstArg = typeof args[0] === 'string' ? args[0] : ''
	if (libsignalNoisePatterns.some((pattern) => pattern.test(firstArg))) {
		return
	}
	originalConsoleInfo(...args)
}

const PORT = process.env.PORT ?? 3000;

const extractPhoneFromUnknown = (value) => {
	if (!value) return null

	if (typeof value === 'string' || typeof value === 'number') {
		const asString = String(value)
		return phoneFromAny(asString)
	}

	if (typeof value === 'object') {
		try {
			const serialized = JSON.stringify(value)
			if (!serialized) return null

			const jidMatch = serialized.match(/(\d{10,15})(?::\d+)?@s\.whatsapp\.net/)
			if (jidMatch?.[1]) return jidMatch[1]

			const digitsMatch = serialized.match(/\d{10,15}/)
			if (digitsMatch?.[0]) return digitsMatch[0]
		} catch {
			return null
		}
	}

	return null
}

const publishActiveBotNumber = async (provider, source = 'unknown') => {
	try {
		const candidates = [
			provider?.vendor?.user?.id,
			provider?.vendor?.user,
			provider?.vendor?.authState?.creds?.me?.id,
			provider?.vendor?.authState?.creds?.me?.lid,
			provider?.vendor?.authState?.creds?.me?.phoneNumber,
			provider?.vendor?.authState?.creds?.me,
			provider?.vendor?.authState?.creds,
		]

		for (const candidate of candidates) {
			const phone = extractPhoneFromUnknown(candidate)
			if (!phone) continue

			await saveBotRuntimePhone(phone, source)
			console.log(`📲 Número activo del bot detectado: ${phone} (${source})`)
			return phone
		}
	} catch (error) {
		console.error('⚠️ No se pudo publicar número activo del bot:', error?.message || error)
	}

	return null
}
export const adapterProvider = createProvider(Provider, {
	// Esto envía pings cada 30 segundos, pa mantener activa la conec
	version: [2, 3000, 1033834674],
	baileys: {
		writeMyself: 'both',
		keepAliveIntervalMs: 30000,
	}
})
//---------------------------------------------------------------------------------------------------------

adapterProvider.on("message", (ctx) => {
	try {
		const realPhone = getRealPhoneFromCtx(ctx)
		const realJid = realPhone ? `${realPhone}` : null

		ctx.realPhone = realPhone
		ctx.realJid = realJid

		// Se normaliza ctx.from
		if (realPhone) ctx.from = realJid
		if (realJid && ctx?.key) ctx.key.remoteJid = realJid

		// Si el bot aún no está listo, encolar el mensaje para reintentarlo
		// cuando la conexión esté completamente establecida.
		if (!isBotReady()) {
			enqueueMessage(ctx);
		}

	} catch (e) {
		console.error('Error en middleware JID:', e)
	}
})

//---------------------------------------------------------------------------------------------------------

const main = async () => {
	console.log('🚀 Iniciando función main...');

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
		agendFlow
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
	let runtimePublished = false
	const tryPublishRuntimeNumber = async (source) => {
		if (runtimePublished) return
		const found = await publishActiveBotNumber(adapterProvider, source)
		if (found) runtimePublished = true
	}

	await tryPublishRuntimeNumber('startup')

	const ev = adapterProvider?.vendor?.ev
	if (ev?.on) {
		ev.on('connection.update', async (update) => {
			if (update?.connection === 'open') {
				await tryPublishRuntimeNumber('connection.open')

				// Marcar bot como listo cuando Baileys emite connection.open
				if (!isBotReady()) {
					setTimeout(async () => {
						markBotReady();
						await flushQueue(adapterProvider);
					}, 1500);
				}
			}
		})
	}

	// Timeout de seguridad: si connection.open nunca se emite
	// (sesión ya activa al reiniciar), marcar listo igualmente.
	setTimeout(async () => {
		if (!isBotReady()) {
			console.log('⚠️ startupQueue: connection.open no se emitió — marcando listo por timeout');
			markBotReady();
			await flushQueue(adapterProvider);
		}
	}, 5000);

	const publishInterval = setInterval(() => {
		tryPublishRuntimeNumber('polling')
	}, 3000)

	setTimeout(() => {
		clearInterval(publishInterval)
		if (!runtimePublished) {
			console.warn('⚠️ No se pudo detectar automáticamente el número activo del bot')
		}
	}, 60000)

	console.log('✅ Bot creado exitosamente');

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

	// Ruta raíz - redirige al sistema web
	adapterProvider.server.get("/", (req, res) => {
		res.writeHead(302, { 'Location': 'http://localhost:3002' });
		res.end();
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
		console.log(`✅ Servidor HTTP iniciado correctamente en puerto ${PORT}`);
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
