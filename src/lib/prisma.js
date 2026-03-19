import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Graceful shutdown: disconnect Prisma on process termination
const shutdown = async () => {
	try {
		await prisma.$disconnect();
		console.log('Prisma disconnected');
	} catch (e) {
		console.error('Error disconnecting Prisma:', e);
	}
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { prisma };
export default prisma;
