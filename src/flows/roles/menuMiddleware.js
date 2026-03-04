import { addKeyword } from '@builderbot/bot';
import { getRolTelefono } from '../../queries/queries.js';
import { adminMenuFlow } from './adminMenuFlow.js';
import { practMenuFlow } from './practMenuFlow.js';

/**
 * Middleware unificado para el keyword 'menu'.
 *
 * Centraliza el enrutamiento del comando 'menu' según el rol del usuario,
 * evitando tener múltiples flows compitiendo por el mismo keyword.
 *
 * Comportamiento:
 *   - admin       → adminMenuFlow
 *   - practicante → practMenuFlow (solo si NO está esperando resultados)
 *   - usuario     → ignorar (endFlow)
 */
export const menuMiddleware = addKeyword(['menu'])
  .addAction(async (ctx, { state, gotoFlow, endFlow }) => {
    // 1. Intentar leer el rol desde el state en memoria (evita consulta a BD si ya está cacheado)
    const userEnState = await state.get('user');
    const rolEnState  = userEnState?.data?.rol || userEnState?.tipo;

    // 2. Si no hay rol en state, consultar BD
    const rolInfo = rolEnState
      ? { rol: rolEnState }
      : await getRolTelefono(ctx.from);

    const rol = rolInfo?.rol;

    if (rol === 'admin') {
      console.log('📋 menuMiddleware → admin');
      await state.update({ currentFlow: 'admin' });
      return gotoFlow(adminMenuFlow);
    }

    if (rol === 'practicante') {
      // Si está en loop de espera de resultados, ignorar el comando 'menu'
      const esperandoResultados = await state.get('esperandoResultados');
      if (esperandoResultados) {
        console.log('📋 menuMiddleware → practicante esperando resultados, ignorando menu');
        return endFlow();
      }

      console.log('📋 menuMiddleware → practicante');
      await state.update({
        currentFlow: 'practicante',
        esperandoResultados: false,
        testCompletadoPorPaciente: false,
      });
      return gotoFlow(practMenuFlow);
    }

    // Usuario normal u otro rol — ignorar
    console.log('📋 menuMiddleware → rol no manejado, ignorando');
    return endFlow();
  });
