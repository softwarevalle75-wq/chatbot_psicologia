/**
 * Entry point del Bot de chat web.
 * Proceso separado de la API REST (puerto 3008).
 *
 * Usa el WebSocketProvider de BuilderBot para el chatbot web.
 * La autenticación del usuario se valida via JWT en el handshake inicial.
 */

import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import { createBot, createProvider, createFlow, MemoryDB as Database } from "@builderbot/bot";
import { WebSocketProvider as Provider } from "./provider/WebSocketProvider.js";

// Flows
import {
  welcomeFlow,
  menuFlow,
  testSelectionFlow,
  testFlow,
  testResponseFlow,
  pedirDocumentoProfesionalFlow,
  assistantFlow,
} from "./flows/core/flows.js";

import {
  getUsuario,
  getPracticante,
  addWebUser,
  citaWebCheckout,
  getWebConsultorios,
  getWebCitas,
} from "./queries/queries.js";

const PORT = Number(process.env.BOT_PORT ?? 3008);

// ---------------------------------------------------------------------------

const main = async () => {
  const adapterFlow = createFlow([
    welcomeFlow,
    menuFlow,
    testSelectionFlow,
    testFlow,
    testResponseFlow,
    pedirDocumentoProfesionalFlow,
    assistantFlow,
  ]);

  const adapterProvider = createProvider(Provider);

  // MemoryDB: en desarrollo. En producción migrar a PostgresDB adapter
  const adapterDB = new Database();

  const { handleCtx, httpServer } = await createBot(
    {
      flow:     adapterFlow,
      provider: adapterProvider,
      database: adapterDB,
    },
    {
      queue: {
        timeout:          20000,
        concurrencyLimit: 10,
      },
    }
  );

  // ── Enviar mensaje a un número ────────────────────────────────────────────
  adapterProvider.server.post(
    "/v1/messages",
    handleCtx(async (bot: any, req: any, res: any) => {
      const { number, message, urlMedia } = req.body;
      await bot.sendMessage(number, message, { media: urlMedia ?? null });
      return res.end("sended");
    })
  );

  // ── Blacklist ─────────────────────────────────────────────────────────────
  adapterProvider.server.post(
    "/v1/blacklist",
    handleCtx(async (bot: any, req: any, res: any) => {
      const { number, intent } = req.body;
      if (intent === "remove") bot.blacklist.remove(number);
      if (intent === "add")    bot.blacklist.add(number);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "ok", number, intent }));
    })
  );

  // ── Consultar entidades desde el frontend ─────────────────────────────────
  adapterProvider.server.get(
    "/v1/front/:entity/:searchQuery",
    handleCtx(async (_bot: any, req: any, res: any) => {
      const { entity, searchQuery } = req.params;
      try {
        let response;
        switch (entity) {
          case "user":        response = await getUsuario(searchQuery);    break;
          case "practicante": response = await getPracticante(searchQuery); break;
          default:
            res.writeHead(400, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ status: "error", message: "Entidad no válida" }));
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(response));
      } catch (error) {
        console.error("[bot/front] Error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ status: "error", message: "Error interno" }));
      }
    })
  );

  // ── Actualizar datos del usuario desde formulario web ────────────────────
  adapterProvider.server.post(
    "/v1/front/addUser",
    handleCtx(async (_bot: any, req: any, res: any) => {
      const { nombre, apellido, correo, tipoDocumento, documento, telefonoPersonal } = req.body;
      try {
        const response = await addWebUser(nombre, apellido, correo, tipoDocumento, documento, telefonoPersonal);
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(response));
      } catch (error) {
        console.error("[bot/addUser] Error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ status: "error", message: "Error al actualizar el usuario" }));
      }
    })
  );

  // ── Checkout de cita ──────────────────────────────────────────────────────
  adapterProvider.server.post(
    "/v1/front/citaCheckout",
    handleCtx(async (_bot: any, req: any, res: any) => {
      const { idCita } = req.body;
      try {
        const response = await citaWebCheckout(idCita);
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(response));
      } catch (error) {
        console.error("[bot/citaCheckout] Error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ status: "error", message: "Error al actualizar la cita" }));
      }
    })
  );

  // ── Consultar consultorios ────────────────────────────────────────────────
  adapterProvider.server.get(
    "/v1/front/consultorios",
    handleCtx(async (_bot: any, req: any, res: any) => {
      try {
        const response = await getWebConsultorios();
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(response));
      } catch (error) {
        console.error("[bot/consultorios] Error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ status: "error", message: "Error al consultar consultorios" }));
      }
    })
  );

  // ── Consultar citas del día ───────────────────────────────────────────────
  adapterProvider.server.get(
    "/v1/front/citas",
    handleCtx(async (_bot: any, req: any, res: any) => {
      try {
        const response = await getWebCitas(new Date());
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(response));
      } catch (error) {
        console.error("[bot/citas] Error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ status: "error", message: "Error al consultar citas" }));
      }
    })
  );

  // ── Iniciar servidor ──────────────────────────────────────────────────────
  httpServer(PORT);
  console.log(`[Bot] Corriendo en el puerto ${PORT}`);
};

main().catch((e) => {
  console.error("[Bot] Error fatal al iniciar:", e);
  process.exit(1);
});
