/**
 * Script de seed para pruebas
 *
 * Uso:
 *   node prisma/seed-test.mjs usuario        → Crea usuario normal (puede usar el bot como paciente)
 *   node prisma/seed-test.mjs practicante    → Crea practicante pendiente (activa flujo completar datos)
 *   node prisma/seed-test.mjs limpiar        → Borra todos los datos de prueba
 *
 * El número de teléfono se configura abajo.
 */

import Prisma from '@prisma/client';
const prisma = new Prisma.PrismaClient();

import dotenv from 'dotenv';
dotenv.config();

// =====================================================================
// CONFIGURA AQUÍ
// =====================================================================
const TELEFONO = process.env.TELEFONO_PRUEBAS;
// =====================================================================

const comando = process.argv[2];

if (!comando || !['usuario', 'practicante', 'limpiar'].includes(comando)) {
  console.log('Uso: node prisma/seed-test.mjs [usuario|practicante|limpiar]');
  process.exit(1);
}

async function limpiar() {
  console.log(`\n🧹 Limpiando datos de prueba para ${TELEFONO}...\n`);

  // Horarios y practicante
  const pract = await prisma.practicante.findUnique({ where: { telefono: TELEFONO } });
  if (pract) {
    await prisma.horario.deleteMany({ where: { practicanteId: pract.idPracticante } });
    await prisma.practicante.delete({ where: { idPracticante: pract.idPracticante } });
    console.log('  ✅ Practicante y horarios eliminados');
  }

  // Tests
  await prisma.ghq12.deleteMany({ where: { telefono: TELEFONO } }).catch(() => {});
  await prisma.dass21.deleteMany({ where: { telefono: TELEFONO } }).catch(() => {});
  await prisma.tests.deleteMany({ where: { telefono: TELEFONO } }).catch(() => {});

  // Usuario
  const user = await prisma.informacionUsuario.findUnique({ where: { telefonoPersonal: TELEFONO } });
  if (user) {
    await prisma.informacionSociodemografica.deleteMany({ where: { usuarioId: user.idUsuario } }).catch(() => {});
    await prisma.historialTest.deleteMany({ where: { usuarioId: user.idUsuario } }).catch(() => {});
    await prisma.informacionUsuario.delete({ where: { idUsuario: user.idUsuario } });
    console.log('  ✅ Usuario eliminado');
  }

  // Rol
  await prisma.rolChat.deleteMany({ where: { telefono: TELEFONO } });
  console.log('  ✅ Rol eliminado');

  console.log('\n✅ Limpieza completa.\n');
}

async function crearUsuario() {
  await limpiar();

  console.log('👤 Creando USUARIO normal...\n');

  await prisma.rolChat.create({
    data: { telefono: TELEFONO, rol: 'usuario' }
  });

  await prisma.informacionUsuario.create({
    data: {
      primerNombre: 'Test',
      segundoNombre: 'Prueba',
      primerApellido: 'Usuario',
      segundoApellido: 'Dev',
      telefonoPersonal: TELEFONO,
      correo: `test_${Date.now()}@example.com`,
      documento: `TEST_${Date.now()}`,
      tipoDocumento: 'CC',
      fechaNacimiento: new Date('2000-01-15'),
      password: '$2b$10$dummyhashfortest1234567890abcdefghij', 
      consentimientoInformado: 'Si',
      autorizacionDatos: 'Si',
      perteneceUniversidad: 'No',
    }
  });

  console.log('  ✅ Usuario creado:');
  console.log(`     Nombre: Test Prueba Usuario Dev`);
  console.log(`     Teléfono: ${TELEFONO}`);
  console.log(`     Rol: usuario`);
  console.log(`     Consentimiento: Si`);
  console.log(`\n  📱 Escribe al bot desde este número → verás el menú de paciente.\n`);
}

async function crearPracticantePendiente() {
  await limpiar();

  console.log('👨‍⚕️ Creando PRACTICANTE PENDIENTE...\n');

  // Crear rol como practicante
  await prisma.rolChat.create({
    data: { telefono: TELEFONO, rol: 'practicante' }
  });

  // Crear usuario base (necesario para migrarUsuarioAPracticante)
  await prisma.informacionUsuario.create({
    data: {
      primerNombre: 'Test',
      segundoNombre: 'Prueba',
      primerApellido: 'Practicante',
      segundoApellido: 'Dev',
      telefonoPersonal: TELEFONO,
      correo: `pract_${Date.now()}@example.com`,
      documento: `PRACT_${Date.now()}`,
      tipoDocumento: 'CC',
      fechaNacimiento: new Date('1998-06-20'),
      password: '$2b$10$dummyhashfortest1234567890abcdefghij',
      consentimientoInformado: 'Si',
      autorizacionDatos: 'Si',
      perteneceUniversidad: 'Si',
      semestre: 9,
      jornada: 'Diurna',
      carrera: 'Psicología',
    }
  });

  // NO crear registro en tabla practicante → esto activa el flujo de completar datos

  console.log('  ✅ Practicante pendiente creado:');
  console.log(`     Teléfono: ${TELEFONO}`);
  console.log(`     Rol en rolChat: practicante`);
  console.log(`     Tabla practicante: ❌ VACÍA (pendiente)`);
  console.log(`\n  📱 Escribe al bot desde este número → te pedirá completar datos`);
  console.log(`     (género, estrato, barrio, localidad, horarios).\n`);
}

async function main() {
  try {
    switch (comando) {
      case 'usuario':
        await crearUsuario();
        break;
      case 'practicante':
        await crearPracticantePendiente();
        break;
      case 'limpiar':
        await limpiar();
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'P2002') {
      console.error('   Dato duplicado. Ejecuta primero: node prisma/seed-test.mjs limpiar');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();