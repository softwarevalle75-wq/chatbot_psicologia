/**
 * Script de arranque para PRODUCCION.
 *
 * Flujo:
 *   1. Ejecuta prisma migrate deploy (aplica migraciones pendientes)
 *   2. Verifica si hay practicantes en la BD
 *   3. Si no hay → ejecuta el seed de roles (prisma/seed/roles.js)
 *   4. Arranca src/app.js como proceso hijo (NO nodemon)
 *
 * Uso en Railway:
 *   Custom start command: node scripts/start-production.js
 *   O bien: npm run start:prod
 *
 * IMPORTANTE: NO usar nodemon en produccion.
 * nodemon atrapa los crashes y espera cambios de archivo que nunca llegan,
 * impidiendo que Railway reinicie el contenedor automaticamente.
 */
import { execSync, spawn } from 'child_process';
import { PrismaClient } from '@prisma/client';

console.log('=== Inicio arranque de produccion ===\n');

// ── Paso 1: Migraciones ──
try {
    console.log('[1/3] Ejecutando prisma migrate deploy...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd: process.cwd() });
    console.log('[1/3] Migraciones aplicadas.\n');
} catch (error) {
    console.error('[1/3] Error en migraciones:', error.message);
    console.log('[1/3] Continuando de todas formas...\n');
}

// ── Paso 2: Seed condicional ──
async function seedIfNeeded() {
    const prisma = new PrismaClient();
    try {
        console.log('[2/3] Verificando datos iniciales...');
        const count = await prisma.practicante.count();
        if (count === 0) {
            console.log('[2/3] No hay practicantes. Ejecutando seed...');
            execSync('node prisma/seed/roles.js', { stdio: 'inherit', cwd: process.cwd() });
            console.log('[2/3] Seed completado.\n');
        } else {
            console.log(`[2/3] BD tiene ${count} practicantes. Seed omitido.\n`);
        }
    } catch (error) {
        console.error('[2/3] Error verificando seed:', error.message);
        console.log('[2/3] Continuando sin seed...\n');
    } finally {
        await prisma.$disconnect();
    }
}

await seedIfNeeded();

// ── Paso 3: Arrancar la aplicacion ──
console.log('[3/3] Iniciando src/app.js...\n');

const app = spawn('node', ['src/app.js'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
});

app.on('close', (code) => {
    console.log(`\n[start-production] app.js finalizo con codigo ${code}`);
    process.exit(code ?? 1);
});

// Propagar senales al proceso hijo para graceful shutdown
const forwardSignal = (signal) => {
    process.on(signal, () => {
        console.log(`[start-production] ${signal} recibido, propagando a app.js...`);
        app.kill(signal);
    });
};

forwardSignal('SIGTERM');
forwardSignal('SIGINT');
