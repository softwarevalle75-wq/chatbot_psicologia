import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { initializeConfig } from '../../scripts/initialize-rag-config.js';
config();

const prisma = new PrismaClient();

async function main() {
    // Admin — idempotente
    const adminTelefono = String(process.env.PRIMER_ADMIN || '573183644600');
    await prisma.rolChat.upsert({
        where:  { telefono: adminTelefono },
        update: {},
        create: { telefono: adminTelefono, rol: 'admin', updatedAt: new Date() },
    });
    console.log(`✅ Admin asegurado: ${adminTelefono}`);

    // RAG config — idempotente
    const ragExistente = await prisma.ragPsychologicalConfig.findUnique({
        where:  { id: 'general' },
        select: { id: true },
    });

    if (ragExistente) {
        console.log('ℹ️  Configuración RAG ya existe — se omite.');
    } else {
        console.log('🧠 Insertando configuración RAG...');
        await initializeConfig();
    }
}

main()
    .catch((e) => {
        console.error('Error en seed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
