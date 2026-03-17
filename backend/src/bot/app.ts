/**
 * Entry point del Bot de chat web.
 * Corre en un proceso separado al de la API REST (puerto distinto).
 *
 * Correcciones sobre Developer:
 * - Eliminados imports de flows inexistentes (adminMenuFlow, practMenuFlow, etc.)
 * - Eliminados endpoints /v1/front/addPracticante y /v1/front/editPracticante
 *   (ahora son responsabilidad de la API REST: POST/PUT /api/practitioners)
 * - Eliminado /v1/front/editUser (la edición de usuarios va por la API REST)
 * - Se mantienen solo los endpoints que el bot web necesita operativamente
 */

import "dotenv/config";
import { createBot, createProvider, createFlow } from "@builderbot/bot";
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";

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
// Flows del bot (se agregarán en fases siguientes de la migración)
// ---------------------------------------------------------------------------
// Los flows de Developer (welcomeFlow, testFlow, etc.) se migran a TypeScript
// en la siguiente fase. Por ahora el bot arranca sin flows para no romper el build.
const adapterFlow = createFlow([]);

// ---------------------------------------------------------------------------

const main = async () => {
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
      if (intent === "add") bot.blacklist.add(number);
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
          case "user":
            response = await getUsuario(searchQuery);
            break;
          case "practicante":
            response = await getPracticante(searchQuery);
            break;
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
        const response = await addWebUser(
          nombre, apellido, correo, tipoDocumento, documento, telefonoPersonal
        );
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

main();
