/**
 * WebSocket Provider para BuilderBot — chatbot web.
 */

import { ProviderClass } from "@builderbot/bot";
import { WebSocketServer, type WebSocket } from "ws";
import EventEmitter from "node:events";
import jwt from "jsonwebtoken";
import type { IncomingMessage } from "node:http";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";

interface UserInfo { name: string; patientId: string }

export class WebSocketProvider extends ProviderClass {
  globalVendorArgs = { name: "websocket", port: env.BOT_PORT };

  connections = new Map<string, WebSocket>();
  userInfo    = new Map<string, UserInfo>();
  _emitter    = new EventEmitter();
  wss: WebSocketServer | null = null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  beforeHttpServerInit() { /* noop */ }

  afterHttpServerInit() {
    this._mountWebSocketUpgrade();
    console.log("[Bot] WebSocket Provider listo (ruta: /ws)");
  }

  async initVendor() {
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on("connection", (ws, request) => {
      this._handleConnection(ws, request as IncomingMessage);
    });
    return this._emitter;
  }

  busEvents() {
    return [
      {
        event: "message",
        func: (payload: unknown) => { this.emit("message", payload); },
      },
      {
        event: "ready",
        func: () => { this.emit("ready", true); },
      },
    ];
  }

  // ── Envío de mensajes ─────────────────────────────────────────────────────

  async sendMessage(userId: string, message: string, args?: Record<string, unknown>) {
    const ws = this.connections.get(userId);
    if (!ws || ws.readyState !== 1) {
      console.warn(`[WS] Sin conexión activa para ${userId}`);
      return { userId, message, delivered: false };
    }

    const payload: Record<string, unknown> = {
      type:      "message",
      from:      "bot",
      body:      message,
      timestamp: new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true }),
    };

    const options = (args?.options ?? args) as Record<string, unknown> | undefined;
    if (options?.media)   payload.media   = options.media;
    if (options?.buttons) payload.buttons = options.buttons;

    try {
      ws.send(JSON.stringify(payload));
    } catch (err) {
      console.error(`[WS] Error enviando a ${userId}:`, (err as Error).message);
      return { userId, message, delivered: false };
    }

    return { userId, message, delivered: true };
  }

  async sendText(jid: string, text: string) {
    const phone = String(jid).replace(/\D/g, "");
    return this.sendMessage(phone, text);
  }

  async saveFile() { return ""; }

  // ── Upgrade HTTP → WebSocket ──────────────────────────────────────────────

  private _mountWebSocketUpgrade() {
    const tryMount = (attempt = 0) => {
      const httpServer = (this as unknown as Record<string, unknown>).server as { server?: import("node:http").Server } | undefined;
      const raw = httpServer?.server;

      if (!raw) {
        if (attempt < 20) { setTimeout(() => tryMount(attempt + 1), 100); return; }
        console.error("[WS] No se pudo acceder al HTTP server después de 2s");
        return;
      }

      raw.on("upgrade", (request, socket, head) => {
        const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
        if (url.pathname !== "/ws") { socket.destroy(); return; }
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.wss!.emit("connection", ws, request);
        });
      });

      this._emitter.emit("ready");
      console.log(`[WS] Upgrade handler montado (intento ${attempt + 1})`);
    };

    tryMount();
  }

  // ── Manejo de conexión ────────────────────────────────────────────────────

  private async _handleConnection(ws: WebSocket, request: IncomingMessage) {
    let phone: string | null = null;

    try {
      const url   = new URL(request.url ?? "/", `http://${request.headers.host}`);
      const token = url.searchParams.get("token");

      if (!token) { ws.close(4001, "Token requerido"); return; }

      // Verificar JWT
      let decoded: Record<string, unknown>;
      try {
        decoded = jwt.verify(token, env.JWT_SECRET) as Record<string, unknown>;
      } catch {
        ws.close(4002, "Token inválido o expirado"); return;
      }

      const userId = String(decoded.sub ?? "");
      const role   = String(decoded.role ?? "usuario");

      // ── Resolver identidad según rol ──────────────────────────────────
      let userName = "Usuario";

      if (role === "admin") {
        // Admin no tiene Patient — usa un identificador fijo para la sesión
        phone    = `admin_${userId}`;
        userName = "Admin";
      } else if (role === "practicante") {
        // Practicante no tiene Patient — buscar en Practitioner
        const practitioner = await prisma.practitioner.findFirst({
          where:  { userId },
          select: { id: true, name: true, documentNumber: true },
        });
        if (!practitioner) { ws.close(4003, "Practicante no encontrado"); return; }
        phone    = `pract_${practitioner.documentNumber}`;
        userName = practitioner.name ?? "Practicante";
      } else {
        // Usuario/paciente — buscar Patient por userId
        const patient = await prisma.patient.findFirst({
          where:  { userId },
          select: { id: true, name: true, whatsappNumber: true },
        });
        if (!patient?.whatsappNumber) { ws.close(4003, "Paciente no encontrado"); return; }
        phone    = patient.whatsappNumber;
        userName = patient.name ?? "Usuario";
      }

      // Una sola conexión activa por usuario
      const existing = this.connections.get(phone);
      if (existing && existing.readyState === 1) {
        existing.close(4004, "Sesión reemplazada");
      }

      this.connections.set(phone, ws);
      this.userInfo.set(phone, { name: userName, patientId: userId });

      console.log(`[WS] Conectado: ${userName} (${phone}) [${role}]`);

      ws.send(JSON.stringify({ type: "connected", phone, name: userName }));

      ws.on("message", (raw) => { this._handleIncomingMessage(phone!, raw); });
      ws.on("close",   ()    => { this._handleDisconnect(phone!); });
      ws.on("error",   (err) => {
        console.error(`[WS] Error en ${phone}:`, err.message);
        this._handleDisconnect(phone!);
      });

    } catch (err) {
      console.error("[WS] Error en _handleConnection:", err);
      if (ws.readyState === 1) ws.close(4500, "Error interno");
    }
  }

  private _handleIncomingMessage(phone: string, raw: unknown) {
    try {
      const data = JSON.parse(String(raw));
      const text = String(data.text ?? data.body ?? "").trim();
      if (!text) return;

      const info = this.userInfo.get(phone) ?? { name: "Usuario" };
      this._emitter.emit("message", { from: phone, body: text, name: info.name });
    } catch (err) {
      console.error(`[WS] Error procesando mensaje de ${phone}:`, (err as Error).message);
    }
  }

  private _handleDisconnect(phone: string) {
    if (!phone) return;
    const info = this.userInfo.get(phone);
    this.connections.delete(phone);
    this.userInfo.delete(phone);
    console.log(`[WS] Desconectado: ${info?.name ?? phone}`);
  }
}
