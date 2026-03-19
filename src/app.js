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
	citaWebCheckout,
	getWebConsultorios,
	ChangeWebConsultorio,
	getWebCitas,
} from "./queries/queries.js";

// inicializar RAG
import { initializeRAG } from "./RAG/index.js";

// Auth routes for web chatbot frontend
import { registerAuthRoutes } from "./routes/authRoutes.js";
import { registerDashboardRoutes } from "./routes/dashboardRoutes.js";

// Security middleware
import { createRateLimiter } from "./middleware/rateLimiter.js";
import { sanitizerMiddleware } from "./middleware/sanitizer.js";
import helmet from "helmet";

const PORT = process.env.PORT ?? 3000;

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

const parseAllowedOrigins = () => {
	const source = process.env.CORS_ORIGINS || process.env.FRONTEND_ORIGIN || process.env.IP_DOMAIN || '';
	return source
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins();

/**
 * Resolve the CORS origin header for a request.
 * - Production: only allow explicitly listed origins. If none configured, reject all.
 * - Development: allow localhost:* origins in addition to any configured origins.
 * - Never return '*' as Access-Control-Allow-Origin.
 */
const resolveCorsOrigin = (requestOrigin) => {
	if (!requestOrigin) return null;

	// Check explicit allow-list first (works in both modes)
	if (allowedOrigins.length > 0 && allowedOrigins.includes(requestOrigin)) {
		return requestOrigin;
	}

	if (isProduction) {
		// In production, only explicitly allowed origins pass
		return null;
	}

	// In development, also allow localhost origins
	try {
		const url = new URL(requestOrigin);
		if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
			return requestOrigin;
		}
	} catch {
		// invalid origin URL
	}

	// If there are configured origins but the request doesn't match, reject
	return allowedOrigins.length > 0 ? null : null;
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
		// ── Helmet: security headers ──
		const helmetMiddleware = helmet({
			contentSecurityPolicy: false,   // Disable CSP — this is an API + WebSocket server
			crossOriginEmbedderPolicy: false,
			crossOriginResourcePolicy: false,
		});
		adapterProvider.server.use((req, res, next) => {
			helmetMiddleware(req, res, (err) => {
				if (err) return next(err);
				next();
			});
		});
		console.log('✅ Helmet headers de seguridad habilitados');

		// ── CORS middleware ──
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

		// ── Sanitizer: strip HTML from all string inputs ──
		adapterProvider.server.use(sanitizerMiddleware);
		console.log('✅ Sanitizador de inputs habilitado');

		// ── Rate limiters for specific route groups ──
		const authRateLimiter = createRateLimiter({
			windowMs: 15 * 60 * 1000,
			maxRequests: 30,
			bucket: 'auth-global',
			message: 'Demasiados intentos de autenticacion. Intenta mas tarde.',
		});
		const messagesRateLimiter = createRateLimiter({
			windowMs: 1 * 60 * 1000,
			maxRequests: 60,
			bucket: 'messages',
			message: 'Demasiados mensajes. Intenta mas tarde.',
		});
		const frontRateLimiter = createRateLimiter({
			windowMs: 1 * 60 * 1000,
			maxRequests: 120,
			bucket: 'front',
			message: 'Demasiadas solicitudes. Intenta mas tarde.',
		});

		// Apply rate limiters to route prefixes
		adapterProvider.server.use('/v1/auth', authRateLimiter);
		adapterProvider.server.use('/v1/messages', messagesRateLimiter);
		adapterProvider.server.use('/v1/front', frontRateLimiter);
		console.log('✅ Rate limiting habilitado para rutas criticas');
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
	registerDashboardRoutes(adapterProvider.server);

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



	// ── Serve frontend static files (production / Docker) ──────
	// When SERVE_FRONTEND=true or frontend/dist exists, serve the Vite build
	// output and add SPA fallback (all non-API routes → index.html).
	const serveFrontend = process.env.SERVE_FRONTEND === 'true';
	if (serveFrontend) {
		const { existsSync, readFileSync, statSync } = await import('fs');
		const pathMod = await import('path');
		const { fileURLToPath } = await import('url');
		const __dirname = pathMod.dirname(fileURLToPath(import.meta.url));
		const distDir = pathMod.resolve(__dirname, '..', 'frontend', 'dist');

		if (existsSync(distDir)) {
			const indexHtml = readFileSync(pathMod.join(distDir, 'index.html'), 'utf-8');

			const MIME_TYPES = {
				'.html': 'text/html',
				'.js':   'application/javascript',
				'.css':  'text/css',
				'.json': 'application/json',
				'.png':  'image/png',
				'.jpg':  'image/jpeg',
				'.jpeg': 'image/jpeg',
				'.gif':  'image/gif',
				'.svg':  'image/svg+xml',
				'.ico':  'image/x-icon',
				'.woff': 'font/woff',
				'.woff2':'font/woff2',
				'.ttf':  'font/ttf',
				'.webp': 'image/webp',
				'.webm': 'video/webm',
				'.mp4':  'video/mp4',
				'.txt':  'text/plain',
			};

			// Middleware: try to serve a static file, otherwise fall through
			adapterProvider.server.use((req, res, next) => {
				// Skip API routes, WebSocket upgrade, and non-GET
				if (req.method !== 'GET' || req.url.startsWith('/v1') || req.url === '/ws') {
					return next();
				}

				const urlPath = req.url.split('?')[0]; // strip query string
				const filePath = pathMod.join(distDir, urlPath);

				try {
					const stat = statSync(filePath);
					if (stat.isFile()) {
						const ext = pathMod.extname(filePath).toLowerCase();
						const contentType = MIME_TYPES[ext] || 'application/octet-stream';
						const content = readFileSync(filePath);

						// Cache hashed assets aggressively, everything else short-cache
						const cacheControl = urlPath.startsWith('/assets/')
							? 'public, max-age=31536000, immutable'
							: 'public, max-age=0, must-revalidate';

						res.writeHead(200, {
							'Content-Type': contentType,
							'Content-Length': content.length,
							'Cache-Control': cacheControl,
						});
						res.end(content);
						return;
					}
				} catch {
					// File not found — fall through to SPA fallback
				}

				// SPA fallback: serve index.html for any non-file route
				res.writeHead(200, {
					'Content-Type': 'text/html',
					'Cache-Control': 'public, max-age=0, must-revalidate',
				});
				res.end(indexHtml);
			});

			console.log(`✅ Frontend estático servido desde ${distDir} (SPA fallback habilitado)`);
		} else {
			console.log('⚠️ SERVE_FRONTEND=true pero frontend/dist no encontrado — omitido');
		}
	}

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
