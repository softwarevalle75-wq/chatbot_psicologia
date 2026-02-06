import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { config } from 'dotenv';
config();
const prisma = new PrismaClient();

async function main() {

    const practicantes = [
        // IMPORTANTE: EL TELÉFONO NOOOO DEBE TENER ESPACIOS, O NO LO DETECTA COMO VÁLIDO
        //1
        {
      idPracticante: uuidv4(),
      numero_documento: '111111111',
      tipo_documento: 'CC',
      nombre: 'Maria Del Carmen Corredor Sarmiento',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "LUNES", horaInicio: 1020, horaFin: 1080 },
            { dia: "MARTES", horaInicio: 1020, horaFin: 1080 },
            { dia: "MIERCOLES", horaInicio: 1020, horaFin: 1080 },
            { dia: "JUEVES", horaInicio: 1020, horaFin: 1080 },
            { dia: "VIERNES", horaInicio: 1020, horaFin: 1080 }
         ]
      },
      sesiones: 0,
      telefono: '573125833772'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111112',
      tipo_documento: 'CC',
      nombre: 'Astrid Rocio Rincon Gordillo',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "VIERNES", horaInicio: 420, horaFin: 600 }
         ]
      },
      sesiones: 0,
      telefono: '573235796364'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111113',
      tipo_documento: 'CC',
      nombre: 'Julian David Tulcal Suarez',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "LUNES", horaInicio: 780, horaFin: 1020 },
            { dia: "MARTES", horaInicio: 780, horaFin: 1020 },
            { dia: "MIERCOLES", horaInicio: 780, horaFin: 1020 },
            { dia: "JUEVES", horaInicio: 780, horaFin: 1020 }
         ]
      },
      sesiones: 0,
      telefono: '573222243640'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111114',
      tipo_documento: 'CC',
      nombre: 'Tania Geraldine Carrero Carvajal',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "LUNES", horaInicio: 780, horaFin: 1020 },
            { dia: "MARTES", horaInicio: 780, horaFin: 1020 },
            { dia: "MIERCOLES", horaInicio: 780, horaFin: 1020 },
            { dia: "JUEVES", horaInicio: 780, horaFin: 1020 }
         ]
      },
      sesiones: 0,
      telefono: '573213431364'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111115',
      tipo_documento: 'CC',
      nombre: 'Jaider Enrique Porras Diaz',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "MIERCOLES", horaInicio: 780, horaFin: 1020 }
         ]
      },
      sesiones: 0,
      telefono: '573014523701'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111116',
      tipo_documento: 'CC',
      nombre: 'Ximena Rodriguez Murcia',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "LUNES", horaInicio: 780, horaFin: 1020 },
            { dia: "MARTES", horaInicio: 780, horaFin: 1020 },
            { dia: "MIERCOLES", horaInicio: 780, horaFin: 1020 },
            { dia: "JUEVES", horaInicio: 780, horaFin: 1020 }
         ]
      },
      sesiones: 0,
      telefono: '573142143156'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111117',
      tipo_documento: 'CC',
      nombre: 'David Steven Sanches Amaya',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "LUNES", horaInicio: 780, horaFin: 1020 },
            { dia: "MARTES", horaInicio: 780, horaFin: 1020 },
            { dia: "MIERCOLES", horaInicio: 780, horaFin: 1020 },
            { dia: "JUEVES", horaInicio: 780, horaFin: 1020 }
         ]
      },
      sesiones: 0,
      telefono: '573217230278'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111118',
      tipo_documento: 'CC',
      nombre: 'Andrea Katherine Garcia',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "VIERNES", horaInicio: 420, horaFin: 600 }
         ]
      },
      sesiones: 0,
      telefono: '573052797485'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111119',
      tipo_documento: 'CC',
      nombre: 'Angela Maria Uribe Raigozo',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "VIERNES", horaInicio: 420, horaFin: 600 }
         ]
      },
      sesiones: 0,
      telefono: '573025270160'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111110',
      tipo_documento: 'CC',
      nombre: 'Liliam Daniela Vacarez Rincon',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "VIERNES", horaInicio: 420, horaFin: 600 }
         ]
      },
      sesiones: 0,
      telefono: '573013953828'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111120',
      tipo_documento: 'CC',
      nombre: 'Mirley Polo Silgado',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "VIERNES", horaInicio: 420, horaFin: 600 }
         ]
      },
      sesiones: 0,
      telefono: '573204265870'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111121',
      tipo_documento: 'CC',
      nombre: 'Yeimy Paola Rozo Ramos',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "JUEVES", horaInicio: 480, horaFin: 720 },
            { dia: "VIERNES", horaInicio: 420, horaFin: 600 }
         ]
      },
      sesiones: 0,
      telefono: '573043704552'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111122',
      tipo_documento: 'CC',
      nombre: 'Stiven Andres Patarrollo Caballero',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "LUNES", horaInicio: 780, horaFin: 1020 },
            { dia: "MARTES", horaInicio: 780, horaFin: 1020 },
            { dia: "MIERCOLES", horaInicio: 780, horaFin: 1020 },
            { dia: "JUEVES", horaInicio: 780, horaFin: 960 }
         ]
      },
      sesiones: 0,
      telefono: '573117510986'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111123',
      tipo_documento: 'CC',
      nombre: 'Gloria Sindy Fiquitiva Leon',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "MIERCOLES", horaInicio: 780, horaFin: 1020 }
         ]
      },
      sesiones: 0,
      telefono: '573102308453'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111125',
      tipo_documento: 'CC',
      nombre: 'Shirly Katerine Daza Mendoza',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "LUNES", horaInicio: 780, horaFin: 1020 },
            { dia: "MARTES", horaInicio: 780, horaFin: 1020 },
            { dia: "JUEVES", horaInicio: 780, horaFin: 1020 }
         ]
      },
      sesiones: 0,
      telefono: '573160628098'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111126',
      tipo_documento: 'CC',
      nombre: 'Yirleans Daniela Calvete Coronado',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "MIERCOLES", horaInicio: 480, horaFin: 660 },
            { dia: "JUEVES", horaInicio: 480, horaFin: 660 }
         ]
      },
      sesiones: 0,
      telefono: '573132691105'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111127',
      tipo_documento: 'CC',
      nombre: 'Lady Viviana Colorado Sanchez',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "VIERNES", horaInicio: 420, horaFin: 600 }
         ]
      },
      sesiones: 0,
      telefono: '573118589148'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111128',
      tipo_documento: 'CC',
      nombre: 'Erika Yuliana Urrea Rodriguez',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "LUNES", horaInicio: 780, horaFin: 1020 },
            { dia: "MARTES", horaInicio: 780, horaFin: 1020 },
            { dia: "MIERCOLES", horaInicio: 780, horaFin: 1020 },
            { dia: "VIERNES", horaInicio: 480, horaFin: 660 }
         ]
      },
      sesiones: 0,
      telefono: '573124472887'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111129',
      tipo_documento: 'CC',
      nombre: 'Ana Maria Piernagorda Peña',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "LUNES", horaInicio: 780, horaFin: 1020 },
            { dia: "MARTES", horaInicio: 780, horaFin: 1020 },
            { dia: "MIERCOLES", horaInicio: 780, horaFin: 1020 },
            { dia: "JUEVES", horaInicio: 780, horaFin: 1020 }
         ]
      },
      sesiones: 0,
      telefono: '573044919112'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111130',
      tipo_documento: 'CC',
      nombre: 'Saira Viviana Cardenas Guzman',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "LUNES", horaInicio: 780, horaFin: 1020 },
            { dia: "MARTES", horaInicio: 780, horaFin: 1020 },
            { dia: "MIERCOLES", horaInicio: 780, horaFin: 1020 },
            { dia: "JUEVES", horaInicio: 780, horaFin: 1020 }
         ]
      },
      sesiones: 0,
      telefono: '573103005906'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111131',
      tipo_documento: 'CC',
      nombre: 'Yessi Caroline Guzman Ortiz',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "LUNES", horaInicio: 780, horaFin: 1020 },
            { dia: "MARTES", horaInicio: 780, horaFin: 1020 },
            { dia: "MIERCOLES", horaInicio: 780, horaFin: 1020 },
            { dia: "JUEVES", horaInicio: 780, horaFin: 1020 }
         ]
      },
      sesiones: 0,
      telefono: '573233216223'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111132',
      tipo_documento: 'CC',
      nombre: 'Andres Felipe Santamaria Gordillo',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "LUNES", horaInicio: 780, horaFin: 1020 },
            { dia: "MARTES", horaInicio: 780, horaFin: 1020 },
            { dia: "MIERCOLES", horaInicio: 780, horaFin: 1020 },
            { dia: "JUEVES", horaInicio: 780, horaFin: 1020 }
         ]
      },
      sesiones: 0,
      telefono: '573018762357'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111133',
      tipo_documento: 'CC',
      nombre: 'Ana Lizeth Ardila Ramos',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "LUNES", horaInicio: 780, horaFin: 1020 },
            { dia: "MARTES", horaInicio: 780, horaFin: 1020 },
            { dia: "MIERCOLES", horaInicio: 780, horaFin: 1020 },
            { dia: "JUEVES", horaInicio: 780, horaFin: 1020 }
         ]
      },
      sesiones: 0,
      telefono: '573134271402'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111134',
      tipo_documento: 'CC',
      nombre: 'John Anderson Muños Torres',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "LUNES", horaInicio: 780, horaFin: 1020 },
            { dia: "MARTES", horaInicio: 780, horaFin: 1020 },
            { dia: "MIERCOLES", horaInicio: 780, horaFin: 1020 },
            { dia: "JUEVES", horaInicio: 780, horaFin: 1020 }
         ]
      },
      sesiones: 0,
      telefono: '573238126123'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111135',
      tipo_documento: 'CC',
      nombre: 'Yuri Alejandra Rozo Castro',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "MARTES", horaInicio: 960, horaFin: 1020 },
            { dia: "MIERCOLES", horaInicio: 960, horaFin: 1020 },
            { dia: "JUEVES", horaInicio: 960, horaFin: 1020 }
         ]
      },
      sesiones: 0,
      telefono: '573104391217'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111136',
      tipo_documento: 'CC',
      nombre: 'Marleidys Urrutia Mosquera',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "VIERNES", horaInicio: 420, horaFin: 600 }
         ]
      },
      sesiones: 0,
      telefono: '573115753174'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111137',
      tipo_documento: 'CC',
      nombre: 'Magalis Candelaria Soto Meza',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "VIERNES", horaInicio: 420, horaFin: 600 }
         ]
      },
      sesiones: 0,
      telefono: '573017651977'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111138',
      tipo_documento: 'CC',
      nombre: 'Jose Albeiro Rincon Ropero',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "VIERNES", horaInicio: 420, horaFin: 600 }
         ]
      },
      sesiones: 0,
      telefono: '573219153813'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111139',
      tipo_documento: 'CC',
      nombre: 'Jeimy Alejandra Prieto Peña',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "VIERNES", horaInicio: 420, horaFin: 600 }
         ]
      },
      sesiones: 0,
      telefono: '573059463331'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111140',
      tipo_documento: 'CC',
      nombre: 'Catherine Jimenez Vargas',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "VIERNES", horaInicio: 420, horaFin: 600 }
         ]
      },
      sesiones: 0,
      telefono: '573114792029'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111141',
      tipo_documento: 'CC',
      nombre: 'Brenda Catalina Leon Velasquez',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "VIERNES", horaInicio: 420, horaFin: 600 }
         ]
      },
      sesiones: 0,
      telefono: '573213655112'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111142',
      tipo_documento: 'CC',
      nombre: 'Andrea Valentina Veira Ramos',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "LUNES", horaInicio: 780, horaFin: 840 },
            { dia: "MARTES", horaInicio: 900, horaFin: 960 },
            { dia: "MIERCOLES", horaInicio: 780, horaFin: 840 },
            { dia: "JUEVES", horaInicio: 780, horaFin: 840 }
         ]
      },
      sesiones: 0,
      telefono: '573193098508'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111143',
      tipo_documento: 'CC',
      nombre: 'Jeiner Velasco Valencia',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "LUNES", horaInicio: 480, horaFin: 660 },
            { dia: "LUNES", horaInicio: 780, horaFin: 1020 },
            { dia: "MARTES", horaInicio: 480, horaFin: 660 },
            { dia: "MARTES", horaInicio: 780, horaFin: 1020 },
            { dia: "MIERCOLES", horaInicio: 480, horaFin: 660 },
            { dia: "MIERCOLES", horaInicio: 780, horaFin: 1020 },
            { dia: "JUEVES", horaInicio: 480, horaFin: 660 },
            { dia: "JUEVES", horaInicio: 780, horaFin: 1020 }
         ]
      },
      sesiones: 0,
      telefono: '573208270674'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111144',
      tipo_documento: 'CC',
      nombre: 'Jhasbleidy Lorena Chapeton Martinez',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "LUNES", horaInicio: 780, horaFin: 1020 },
            { dia: "MARTES", horaInicio: 780, horaFin: 1020 },
            { dia: "MIERCOLES", horaInicio: 780, horaFin: 1020 },
            { dia: "JUEVES", horaInicio: 780, horaFin: 1020 }
         ]
      },
      sesiones: 0,
      telefono: '573168719489'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111145',
      tipo_documento: 'CC',
      nombre: 'Daisy Geraldine Daza Rodriguez',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "LUNES", horaInicio: 780, horaFin: 1020 },
            { dia: "MARTES", horaInicio: 780, horaFin: 1020 },
            { dia: "MIERCOLES", horaInicio: 780, horaFin: 1020 },
            { dia: "JUEVES", horaInicio: 780, horaFin: 1020 }
         ]
      },
      sesiones: 0,
      telefono: '573118453523'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111146',
      tipo_documento: 'CC',
      nombre: 'Oscar Javier Castañeda Neiva',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "LUNES", horaInicio: 780, horaFin: 1020 },
            { dia: "MIERCOLES", horaInicio: 780, horaFin: 1020 },
            { dia: "JUEVES", horaInicio: 780, horaFin: 1020 }
         ]
      },
      sesiones: 0,
      telefono: '573103271115'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111147',
      tipo_documento: 'CC',
      nombre: 'Karol Vega Moreno',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "MIERCOLES", horaInicio: 1020, horaFin: 1080 },
            { dia: "VIERNES", horaInicio: 420, horaFin: 600 }
         ]
      },
      sesiones: 0,
      telefono: '573132329504'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111148',
      tipo_documento: 'CC',
      nombre: 'Angie Melissa Bechara Mosquera',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "MIERCOLES", horaInicio: 780, horaFin: 1020 }
         ]
      },
      sesiones: 0,
      telefono: '573106406637'
   },
   {
      idPracticante: uuidv4(),
      numero_documento: '111111149',
      tipo_documento: 'CC',
      nombre: 'Anderson Johan Vargas Cuadros',
      genero: 'M',
      estrato: '3',
      barrio: 'Chapinero',
      localidad: 'Chapinero',
      horarios: {
         create: [
            { dia: "MIERCOLES", horaInicio: 960, horaFin: 1020 }
         ]
      },
      sesiones: 0,
      telefono: '573209455967'
   },   
      //   Practicante para pruebas
        {
            idPracticante: uuidv4(),
            numero_documento: '22222222',
            tipo_documento: 'CC',
            nombre: 'Practicante para pruebas',
            genero: 'M',
            estrato: '3', 
            barrio: 'Chapinero',
            localidad: 'Chapinero', 
            horarios: {
                create: [
                    { dia: "DOMINGO", horaInicio: 1200, horaFin: 1200 },   // 20:00 - 20:00
                  //   { dia: "DOMINGO", horaInicio: 460, horaFin: 660 }   // 9:00 - 11:00
                ]
                },
            sesiones: 0, //agregar sesiones
            telefono: '', //agregar telefono
        },
    ]


    for (const p of practicantes) {
        // Crear practicante con horarios
        await prisma.practicante.create({
            data: {
            idPracticante: p.idPracticante,
            numero_documento: p.numero_documento,
            tipo_documento: p.tipo_documento,
            nombre: p.nombre,
            genero: p.genero,
            estrato: p.estrato,
            barrio: p.barrio,
            localidad: p.localidad,
            sesiones: p.sesiones,
            telefono: p.telefono,
            horarios: p.horarios // aquí ya tienes el create [] en tu seed
            }
        });

        // Crear rolChat asociado
        await prisma.rolChat.create({
            data: {
            telefono: p.telefono,
            rol: "practicante",
            updatedAt: new Date()
            }
        });
    }

//-------------------------------------------------------------------------------------------------------------------------------------------

// Crear consultorios

//-------------------------------------------------------------------------------------------------------------------------------------------
  const admins = [
    {
      telefono: String(process.env.PRIMER_ADMIN) || '573183644600',
      rol: 'admin',
      updatedAt: new Date(),
    }
  ]
    await prisma.rolChat.createMany({
      data: admins,
      skipDuplicates: true,
    });

}

main()
  .catch((e) => {
    console.error("Error en categorías:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });