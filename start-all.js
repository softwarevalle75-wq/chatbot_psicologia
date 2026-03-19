import { execSync } from 'child_process';
import { spawn } from 'child_process';
import prisma from './src/lib/prisma.js';

console.log('🚀 Iniciando ChatBot Psicológico...\n');

// ── Seed automático: solo si no hay practicantes en la BD ──
async function seedIfNeeded() {
    try {
        const count = await prisma.practicante.count();
        if (count === 0) {
            console.log('🌱 No hay practicantes en la BD. Ejecutando seed de roles...\n');
            execSync('node prisma/seed/roles.js', { stdio: 'inherit', cwd: process.cwd() });
            console.log('\n✅ Seed de roles completado.\n');
        } else {
            console.log(`✅ BD ya tiene ${count} practicantes. Seed omitido.\n`);
        }
    } catch (error) {
        console.error('⚠️ Error verificando/ejecutando seed:', error.message);
        console.log('Continuando sin seed...\n');
    }
}

async function start() {
    await seedIfNeeded();

    console.log('🤖 Iniciando bot (modo WebSocket)...');
    const botServer = spawn('node', ['src/app.js'], {
        stdio: 'inherit',
        cwd: process.cwd()
    });

    botServer.on('close', (code) => {
        console.log(`Bot terminado con código ${code}`);
        process.exit(code);
    });

    process.on('SIGINT', () => {
        console.log('\n🛑 Cerrando servicios...');
        botServer.kill();
        process.exit(0);
    });
}

start();
