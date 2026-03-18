import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = [
    { name: 'admin', description: 'Administrador del sistema' },
    { name: 'practicante', description: 'Practicante de psicología' },
    { name: 'usuario', description: 'Usuario/paciente del sistema' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
    console.log(`✓ Rol '${role.name}' listo`);
  }

  console.log('\nSeed completado.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
