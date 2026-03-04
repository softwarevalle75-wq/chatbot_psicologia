/**
 * Cola de mensajes durante el arranque del bot.
 *
 * Problema: Baileys tiene un período de "calentamiento" al reconectar donde
 * descarta o no puede enviar respuestas a los primeros mensajes recibidos.
 *
 * Solución: mientras el bot no esté listo (`botReady === false`), los mensajes
 * entrantes se encolan. Cuando la conexión se establece completamente, la cola
 * se procesa reinyectando cada mensaje al provider como si acabara de llegar.
 *
 * Restricciones de diseño:
 * - Solo se guarda el último mensaje por teléfono (evita procesar spam de un mismo usuario).
 * - La cola se limpia tras procesarse o tras un timeout de seguridad.
 */

let botReady = false;

/** @type {Map<string, object>} clave: ctx.from, valor: ctx completo */
const pendingMessages = new Map();

/**
 * Marca el bot como listo para procesar mensajes.
 * Debe llamarse cuando Baileys emite connection === 'open' y el bot está creado.
 */
export const markBotReady = () => {
    botReady = true;
    console.log('✅ startupQueue: bot marcado como listo');
};

/**
 * Indica si el bot está listo para procesar mensajes.
 */
export const isBotReady = () => botReady;

/**
 * Encola un mensaje recibido durante el arranque.
 * Si el mismo teléfono ya tenía un mensaje encolado, lo reemplaza (solo el más reciente importa).
 * @param {object} ctx - Contexto del mensaje de BuilderBot
 */
export const enqueueMessage = (ctx) => {
    const phone = ctx?.from;
    if (!phone) return;
    pendingMessages.set(phone, ctx);
    console.log(`📥 startupQueue: mensaje encolado de ${phone} (cola: ${pendingMessages.size})`);
};

/**
 * Procesa todos los mensajes encolados reinyectándolos al provider.
 * @param {object} provider - adapterProvider de BuilderBot
 */
export const flushQueue = async (provider) => {
    if (pendingMessages.size === 0) return;

    console.log(`🔄 startupQueue: procesando ${pendingMessages.size} mensajes encolados...`);

    for (const [phone, ctx] of pendingMessages) {
        try {
            // Pequeño delay entre mensajes para no saturar el provider
            await new Promise(res => setTimeout(res, 300));
            console.log(`📤 startupQueue: reinyectando mensaje de ${phone}: "${ctx.body}"`);
            provider.emit('message', ctx);
        } catch (err) {
            console.error(`❌ startupQueue: error reinyectando mensaje de ${phone}:`, err);
        }
    }

    pendingMessages.clear();
    console.log('✅ startupQueue: cola procesada y limpiada');
};
