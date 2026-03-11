/**
 * WebSocket Provider for BuilderBot.
 *
 * Replaces the Baileys/WhatsApp provider so the bot can communicate
 * with the React frontend over WebSocket instead of WhatsApp.
 *
 * Key design decisions:
 *  - ctx.from = user's telefonoPersonal (e.g. "573122038876") so that
 *    ALL existing flows and database queries work without changes.
 *  - Authentication is done via JWT token sent as a query parameter
 *    when opening the WebSocket connection.
 *  - One active connection per phone number (latest connection wins).
 */

import { ProviderClass } from '@builderbot/bot';
import { WebSocketServer } from 'ws';
import EventEmitter from 'node:events';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secret_key';

class WebSocketProvider extends ProviderClass {

    // ── Required by ProviderClass ───────────────────────────
    globalVendorArgs = { name: 'websocket', port: 3000 };

    /** @type {Map<string, import('ws').WebSocket>} phone -> ws */
    connections = new Map();

    /** @type {Map<string, { name: string; userId: string }>} phone -> user info */
    userInfo = new Map();

    /** Internal event bus (returned by initVendor, used by busEvents) */
    _emitter = new EventEmitter();

    /** @type {WebSocketServer | null} */
    wss = null;

    // ── Lifecycle hooks ─────────────────────────────────────

    beforeHttpServerInit() {
        // Nothing needed before HTTP starts
    }

    afterHttpServerInit() {
        // Mount WebSocket upgrade handler on the underlying http.Server
        // Polka exposes the raw Node http.Server as this.server.server
        // after .listen() has been called.
        this._mountWebSocketUpgrade();
        console.log('✅ WebSocket Provider listo (ruta: /ws)');
    }

    /**
     * Initialize the vendor.
     * Must return an object with .on(event, handler) so that
     * listenOnEvents() in the base class can bind busEvents().
     */
    async initVendor() {
        // Create the WebSocketServer in noServer mode.
        // We will handle the HTTP upgrade ourselves in afterHttpServerInit.
        this.wss = new WebSocketServer({ noServer: true });

        this.wss.on('connection', (ws, request) => {
            this._handleConnection(ws, request);
        });

        // The _emitter is what BuilderBot's listenOnEvents() will call .on() on.
        // We emit 'message' on it from _handleIncomingMessage().
        return this._emitter;
    }

    /**
     * Map vendor events to framework events.
     * The _emitter emits 'message' when a user sends a chat message.
     */
    busEvents() {
        return [
            {
                event: 'message',
                func: (payload) => {
                    // Forward to BuilderBot's internal 'message' event
                    this.emit('message', payload);
                },
            },
            {
                event: 'ready',
                func: () => this.emit('ready', true),
            },
        ];
    }

    /**
     * Send a message to a user via WebSocket.
     * This is called by BuilderBot when a flow calls flowDynamic(), endFlow(), etc.
     *
     * @param {string} userId - The user's telefonoPersonal (e.g. "573122038876")
     * @param {string} message - The message text
     * @param {object} [args] - Additional context (media, buttons, etc.)
     */
    async sendMessage(userId, message, args) {
        const ws = this.connections.get(userId);

        if (!ws || ws.readyState !== 1 /* WebSocket.OPEN */) {
            console.warn(`⚠️ WS: No hay conexión activa para ${userId}, mensaje no enviado`);
            return { userId, message, delivered: false };
        }

        const payload = {
            type: 'message',
            from: 'bot',
            body: message,
            timestamp: new Date().toLocaleTimeString('es-CO', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            }),
        };

        // Include media URL if present
        if (args?.options?.media) {
            payload.media = args.options.media;
        }

        // Include buttons if present
        if (args?.options?.buttons) {
            payload.buttons = args.options.buttons;
        }

        try {
            ws.send(JSON.stringify(payload));
        } catch (err) {
            console.error(`❌ WS: Error enviando a ${userId}:`, err.message);
            return { userId, message, delivered: false };
        }

        return { userId, message, delivered: true };
    }

    /**
     * Save a file from context. Not applicable for WebSocket (no media upload yet).
     */
    // eslint-disable-next-line no-unused-vars
    async saveFile(ctx, options) {
        return '';
    }

    // ── Internal methods ────────────────────────────────────

    /**
     * Mount the WebSocket upgrade handler on the HTTP server.
     * Called from afterHttpServerInit() after Polka has started.
     *
     * NOTE: BuilderBot calls cb(routes) before polka.listen(), so
     * this.server.server (the raw http.Server) may not exist yet.
     * We poll briefly to wait for Polka to create it.
     */
    _mountWebSocketUpgrade() {
        const tryMount = (attempt = 0) => {
            const httpServer = this.server?.server;

            if (!httpServer) {
                if (attempt < 20) {
                    // Polka hasn't created the http.Server yet; retry in 100ms
                    setTimeout(() => tryMount(attempt + 1), 100);
                    return;
                }
                console.error('❌ WS: No se pudo acceder al HTTP server de Polka después de 2s');
                return;
            }

            httpServer.on('upgrade', (request, socket, head) => {
                const url = new URL(request.url, `http://${request.headers.host}`);

                // Only handle /ws path
                if (url.pathname !== '/ws') {
                    socket.destroy();
                    return;
                }

                this.wss.handleUpgrade(request, socket, head, (ws) => {
                    this.wss.emit('connection', ws, request);
                });
            });

            // Signal that the provider is ready
            this._emitter.emit('ready');
            console.log(`✅ WS: Upgrade handler montado en HTTP server (intento ${attempt + 1})`);
        };

        tryMount();
    }

    /**
     * Handle a new WebSocket connection.
     * Authenticates via JWT token in query params, then registers the connection.
     */
    async _handleConnection(ws, request) {
        let phone = null;

        try {
            // Extract token from query string: /ws?token=JWT_HERE
            const url = new URL(request.url, `http://${request.headers.host}`);
            const token = url.searchParams.get('token');

            if (!token) {
                ws.close(4001, 'Token requerido');
                return;
            }

            // Verify JWT
            let decoded;
            try {
                decoded = jwt.verify(token, JWT_SECRET);
            } catch {
                ws.close(4002, 'Token invalido o expirado');
                return;
            }

            // Look up user to get their phone number
            const user = await prisma.informacionUsuario.findUnique({
                where: { idUsuario: decoded.userId },
                select: {
                    idUsuario: true,
                    primerNombre: true,
                    telefonoPersonal: true,
                    documento: true,
                },
            });

            if (!user || !user.telefonoPersonal) {
                ws.close(4003, 'Usuario no encontrado');
                return;
            }

            phone = user.telefonoPersonal;
            const userName = user.primerNombre || 'Usuario';

            // Close any existing connection for this phone (only 1 active session)
            const existingWs = this.connections.get(phone);
            if (existingWs && existingWs.readyState === 1) {
                existingWs.close(4004, 'Sesion reemplazada por nueva conexion');
            }

            // Register this connection
            this.connections.set(phone, ws);
            this.userInfo.set(phone, { name: userName, userId: user.idUsuario });

            console.log(`🔗 WS: Conectado ${userName} (${phone})`);

            // Send welcome confirmation
            ws.send(JSON.stringify({
                type: 'connected',
                phone,
                name: userName,
            }));

            // Handle incoming messages
            ws.on('message', (raw) => {
                this._handleIncomingMessage(phone, raw);
            });

            // Handle disconnect
            ws.on('close', () => {
                this._handleDisconnect(phone);
            });

            ws.on('error', (err) => {
                console.error(`❌ WS: Error en conexión de ${phone}:`, err.message);
                this._handleDisconnect(phone);
            });

        } catch (err) {
            console.error('❌ WS: Error en _handleConnection:', err);
            if (ws.readyState === 1) {
                ws.close(4500, 'Error interno');
            }
        }
    }

    /**
     * Handle an incoming message from a WebSocket client.
     * Emits the 'message' event on _emitter so BuilderBot processes it.
     */
    _handleIncomingMessage(phone, raw) {
        try {
            const data = JSON.parse(raw.toString());
            const text = (data.text || data.body || '').trim();

            if (!text) return;

            const info = this.userInfo.get(phone) || { name: 'Usuario' };

            // Emit on the _emitter (which is the "vendor")
            // BuilderBot's busEvents handler will pick this up and forward it
            // to the core's handleMsg via this.emit('message', ...)
            this._emitter.emit('message', {
                from: phone,
                body: text,
                name: info.name,
            });

        } catch (err) {
            console.error(`❌ WS: Error procesando mensaje de ${phone}:`, err.message);
        }
    }

    /**
     * Handle WebSocket disconnection. Clean up maps.
     */
    _handleDisconnect(phone) {
        if (!phone) return;
        const info = this.userInfo.get(phone);
        this.connections.delete(phone);
        this.userInfo.delete(phone);
        console.log(`🔌 WS: Desconectado ${info?.name || phone} (${phone})`);
    }

    /**
     * Send a text message to a user. Used by sendAutonomousMessage in queries.js.
     * This mirrors the Baileys sendText method signature.
     */
    async sendText(jid, text) {
        // jid might be a WhatsApp JID like "573122038876@s.whatsapp.net"
        // or just a phone number. Extract digits only.
        const phone = String(jid).replace(/[^\d]/g, '');
        return this.sendMessage(phone, text);
    }
}

export { WebSocketProvider };
