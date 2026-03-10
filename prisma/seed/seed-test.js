import Prisma from '@prisma/client';
import { v4 as uuidv4} from 'uuid'
const prisma = new Prisma.PrismaClient();


const comando = process.argv[2];
const telefono = process.argv[3];

// ==============================================
// const TELEFONO = process.env.TELEFONO_PRUEBAS;
const TELEFONO = telefono.includes('57') ? telefono : `57${telefono}`;
// ==============================================

if (!comando || !['usuario', 'practicante', 'limpiar', 'practicanteCompleto'].includes(comando)) {
  console.log('Uso: node prisma/seed-test.mjs [usuario|practicante|limpiar|practicanteCompleto]');
  process.exit(1);
}

//  FUNCIÓN LIMPIAR
// ================

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

//  FUNCIÓN CREAR USUARIO
// ======================

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
      genero: 'Masculino',
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

//  FUNCIÓN CREAR PRACTICANTE PENDIENTE
// ===================================

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
  console.log(`     (género, correo, EPS/IPS, clínica, fechas, horarios).\n`);
}

//  FUNCIÓN PRACTICANTE COMPLETO
// ============================

async function crearPracticanteCompleto() {
  await limpiar();

  console.log('👨‍⚕️ Creando PRACTICANTE COMPLETO...\n');

  const suffix = TELEFONO.slice(-6)
  const numeroDocumento = `9${suffix}`
  const nombrePracticante = `Practicante para pruebas ${suffix}`

  // Crear/actualizar rol como practicante
  await prisma.rolChat.upsert({
    where: { telefono: TELEFONO },
    update: { rol: 'practicante' },
    create: { telefono: TELEFONO, rol: 'practicante' }
  });

  // Crear registro en tabla practicante
  await prisma.practicante.create({
    data: {
      idPracticante:    uuidv4(),
      numero_documento: numeroDocumento,
      tipo_documento:   'CC',
      nombre:           nombrePracticante,
      genero:           'M',
      correo:           null,
      eps_ips:          null,
      clinica:          null,
      fechaInicio:      null,
      fechaFin:         null,
      citasProgramadas: 0,
      telefono:         TELEFONO,
      horarios: {
        create: [
          { dia: 'LUNES',   horaInicio: 480, horaFin: 720 },  // 8:00 - 12:00
          { dia: 'VIERNES', horaInicio: 780, horaFin: 1020 }, // 13:00 - 17:00
        ]
      },
    }
  });

  console.log('  ✅ Practicante completo creado:');
  console.log(`     Nombre: ${nombrePracticante}`);
  console.log(`     Teléfono: ${TELEFONO}`);
  console.log(`     Rol en rolChat: practicante`);
  console.log(`     Tabla practicante: ✅ LLENA (completo)`);
  console.log(`\n  📱 Escribe al bot desde este número → verás el menú de practicante.\n`);
}

//  FUNCIÓN PRINCIPAL
// =================

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
      case 'practicanteCompleto':
        await crearPracticanteCompleto();
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'P2002') {
      console.error('   Dato duplicado. Ejecuta primero: node prisma/seed-test.js limpiar');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
