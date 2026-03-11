import { spawn, execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

console.log('🚀 Iniciando ChatBot Psicológico con Sistema Web...\n');

// ── Seed automático: solo si no hay practicantes en la BD ──
async function seedIfNeeded() {
    const prisma = new PrismaClient();
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
    } finally {
        await prisma.$disconnect();
    }
}

async function start() {
    await seedIfNeeded();

    // Iniciar servidor web
    console.log('🌐 Iniciando servidor web...');
    const webServer = spawn('node', ['web/server.js'], {
        stdio: 'inherit',
        cwd: process.cwd()
    });

    // Esperar un momento antes de iniciar el bot
    setTimeout(() => {
        console.log('🤖 Iniciando bot (modo WebSocket)...');
        const botServer = spawn('node', ['src/app.js'], {
            stdio: 'inherit',
            cwd: process.cwd()
        });

        botServer.on('close', (code) => {
            console.log(`Bot terminado con código ${code}`);
            webServer.kill();
            process.exit(code);
        });
    }, 3000);

    webServer.on('close', (code) => {
        console.log(`Servidor web terminado con código ${code}`);
        process.exit(code);
    });

    process.on('SIGINT', () => {
        console.log('\n🛑 Cerrando servicios...');
        webServer.kill();
        process.exit(0);
    });
}

start();
