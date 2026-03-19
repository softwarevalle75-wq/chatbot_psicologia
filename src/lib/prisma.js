/**
 * Singleton PrismaClient.
 *
 * En vez de instanciar `new PrismaClient()` en cada archivo,
 * todos los modulos importan esta unica instancia compartida.
 *
 * Esto evita crear multiples connection pools contra MySQL
 * y reduce la presion sobre `max_connections` del servidor.
 */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

/** @type {PrismaClient} */
export const prisma =
    globalForPrisma.__prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.__prisma = prisma;
}
