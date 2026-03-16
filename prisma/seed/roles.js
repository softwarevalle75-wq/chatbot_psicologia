import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { config } from 'dotenv';
import { initializeConfig } from '../../scripts/initialize-rag-config.js';
config();

const prisma = new PrismaClient();

// Conversión de hora a minutos desde medianoche
// Ej: h(13, 0) = 780  →  1:00 PM
const h = (hora, minutos = 0) => hora * 60 + minutos;

async function main() {

    // IMPORTANTE: EL TELÉFONO NO DEBE TENER ESPACIOS, O NO LO DETECTA COMO VÁLIDO
    // Todos los teléfonos deben tener prefijo 57 (Colombia)
    const practicantes = [

        // 1 — Aguilar Delgado Laura Alejandra
        // Horario: Lunes a jueves 1:00 pm – 6:00 pm
        {
            idPracticante:    uuidv4(),
            numero_documento: '1001193299',
            tipo_documento:   'CC',
            nombre:           'Aguilar Delgado Laura Alejandra',
            genero:           'F',
            correo:           'lauraalejandraaguilardelgado@gmail.com',
            eps_ips:          'Famisanar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-02-23'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573212275109',
            horarios: { create: [
                { dia: 'LUNES',   horaInicio: h(13), horaFin: h(18) },
                { dia: 'MARTES',  horaInicio: h(13), horaFin: h(18) },
                { dia: 'MIERCOLES', horaInicio: h(13), horaFin: h(18) },
                { dia: 'JUEVES',  horaInicio: h(13), horaFin: h(18) },
            ]},
        },

        // 2 — Arellano Amaya Yeimy Paola
        // Horario: Lunes a jueves 1:00 pm – 5:00 pm | Viernes 8:00 am – 1:00 pm
        {
            idPracticante:    uuidv4(),
            numero_documento: '1073673455',
            tipo_documento:   'CC',
            nombre:           'Arellano Amaya Yeimy Paola',
            genero:           'F',
            correo:           'arellanojeimy811@gmail.com',
            eps_ips:          'Famisanar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-02-10'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573112576609',
            horarios: { create: [
                { dia: 'LUNES',    horaInicio: h(13), horaFin: h(17) },
                { dia: 'MARTES',   horaInicio: h(13), horaFin: h(17) },
                { dia: 'MIERCOLES',horaInicio: h(13), horaFin: h(17) },
                { dia: 'JUEVES',   horaInicio: h(13), horaFin: h(17) },
                { dia: 'VIERNES',  horaInicio: h(8),  horaFin: h(13) },
            ]},
        },

        // 3 — Arias Matta Jazbleidi Johana
        // Horario: Sábados 7:00 am – 10:00 am
        {
            idPracticante:    uuidv4(),
            numero_documento: '1001059346',
            tipo_documento:   'CC',
            nombre:           'Arias Matta Jazbleidi Johana',
            genero:           'F',
            correo:           'Johanaariassofi@gmail.com',
            eps_ips:          'Salud Total',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-01-14'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573208062436',
            horarios: { create: [
                { dia: 'SABADO', horaInicio: h(7), horaFin: h(10) },
            ]},
        },

        // 4 — Bechara Mosquera Angie Melissa
        // Horario: Lunes y jueves después de las 3:00 pm (hasta fin de jornada → 6:00 pm)
        {
            idPracticante:    uuidv4(),
            numero_documento: '1013677733',
            tipo_documento:   'CC',
            nombre:           'Bechara Mosquera Angie Melissa',
            genero:           'F',
            correo:           'angie.bechara19@gmail.com',
            eps_ips:          'Aliansalud',
            clinica:          'Clinica',
            fechaInicio:      new Date('2025-07-17'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573106406637',
            horarios: { create: [
                { dia: 'LUNES',  horaInicio: h(15), horaFin: h(18) },
                { dia: 'JUEVES', horaInicio: h(15), horaFin: h(18) },
            ]},
        },

        // 5 — Bohorquez Olga Patricia
        // Horario: Lunes a jueves 8:00 am – 5:00 pm | Viernes 8:00 am – 1:00 pm
        {
            idPracticante:    uuidv4(),
            numero_documento: '53894261',
            tipo_documento:   'PPT',
            nombre:           'Bohorquez Olga Patricia',
            genero:           'F',
            correo:           'patico-2007@hotmail.com',
            eps_ips:          'Famisanar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2025-12-02'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573118113202',
            horarios: { create: [
                { dia: 'LUNES',    horaInicio: h(8), horaFin: h(17) },
                { dia: 'MARTES',   horaInicio: h(8), horaFin: h(17) },
                { dia: 'MIERCOLES',horaInicio: h(8), horaFin: h(17) },
                { dia: 'JUEVES',   horaInicio: h(8), horaFin: h(17) },
                { dia: 'VIERNES',  horaInicio: h(8), horaFin: h(13) },
            ]},
        },

        // 6 — Bonilla Sanchez Lizeth Gabriela
        // Horario: Sábados 7:00 am – 10:00 am
        {
            idPracticante:    uuidv4(),
            numero_documento: '1022433668',
            tipo_documento:   'CC',
            nombre:           'Bonilla Sanchez Lizeth Gabriela',
            genero:           'F',
            correo:           'gabrielabs2611@gmail.com',
            eps_ips:          'Salud Total',
            clinica:          'Clinica',
            fechaInicio:      new Date('2025-11-08'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573173298265',
            horarios: { create: [
                { dia: 'SABADO', horaInicio: h(7), horaFin: h(10) },
            ]},
        },

        // 7 — Buitrago Bernal Emmy Mariana
        // Horario: Sábados 7:00 am – 11:00 am
        {
            idPracticante:    uuidv4(),
            numero_documento: '1001289032',
            tipo_documento:   'CC',
            nombre:           'Buitrago Bernal Emmy Mariana',
            genero:           'F',
            correo:           'Eimmybuitrago17@gmail.com',
            eps_ips:          'Famisanar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-02-14'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573102369648',
            horarios: { create: [
                { dia: 'SABADO', horaInicio: h(7), horaFin: h(11) },
            ]},
        },

        // 8 — Burgos Garcia Blanca Yineth
        // Horario: Lunes a jueves 8:00 am – 6:00 pm | Viernes 8:00 am – 1:00 pm
        // Nota: tiene dos teléfonos (3243287604 / 3239302222) — se usa el primero
        // Nota: tiene dos correos — se usa el primero
        {
            idPracticante:    uuidv4(),
            numero_documento: '28880364',
            tipo_documento:   'PPT',
            nombre:           'Burgos Garcia Blanca Yineth',
            genero:           'F',
            correo:           'burgosblanca0613@gmail.com',
            eps_ips:          'Salud Total',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-01-15'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573243287604',
            horarios: { create: [
                { dia: 'LUNES',    horaInicio: h(8), horaFin: h(18) },
                { dia: 'MARTES',   horaInicio: h(8), horaFin: h(18) },
                { dia: 'MIERCOLES',horaInicio: h(8), horaFin: h(18) },
                { dia: 'JUEVES',   horaInicio: h(8), horaFin: h(18) },
                { dia: 'VIERNES',  horaInicio: h(8), horaFin: h(13) },
            ]},
        },

        // 9 — Calvete Coronado Virleans Daniela
        // Horario: Lunes a viernes 8:00 am – 12:00 m
        {
            idPracticante:    uuidv4(),
            numero_documento: '1030688264',
            tipo_documento:   'CC',
            nombre:           'Calvete Coronado Virleans Daniela',
            genero:           'F',
            correo:           'coronadodanyela47@gmail.com',
            eps_ips:          'Sanitas',
            clinica:          'Clinica',
            fechaInicio:      new Date('2025-08-11'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573132691105',
            horarios: { create: [
                { dia: 'LUNES',    horaInicio: h(8), horaFin: h(12) },
                { dia: 'MARTES',   horaInicio: h(8), horaFin: h(12) },
                { dia: 'MIERCOLES',horaInicio: h(8), horaFin: h(12) },
                { dia: 'JUEVES',   horaInicio: h(8), horaFin: h(12) },
                { dia: 'VIERNES',  horaInicio: h(8), horaFin: h(12) },
            ]},
        },

        // 10 — Canizalez Silva Laura Jimena
        // Horario: Lunes a jueves 8:00 am – 6:00 pm | Viernes 8:00 am – 1:00 pm | Sábados 7:00 am – 10:00 am
        {
            idPracticante:    uuidv4(),
            numero_documento: '1029220446',
            tipo_documento:   'CC',
            nombre:           'Canizalez Silva Laura Jimena',
            genero:           'F',
            correo:           'Canizaleslaura538@gmail.com',
            eps_ips:          'Sanidad Policia',
            clinica:          'Clinica',
            fechaInicio:      new Date('2025-11-27'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573045597780',
            horarios: { create: [
                { dia: 'LUNES',    horaInicio: h(8),  horaFin: h(18) },
                { dia: 'MARTES',   horaInicio: h(8),  horaFin: h(18) },
                { dia: 'MIERCOLES',horaInicio: h(8),  horaFin: h(18) },
                { dia: 'JUEVES',   horaInicio: h(8),  horaFin: h(18) },
                { dia: 'VIERNES',  horaInicio: h(8),  horaFin: h(13) },
                { dia: 'SABADO',   horaInicio: h(7),  horaFin: h(10) },
            ]},
        },

        // 11 — Carrillo Peña Dayssy Judith
        // Horario: Lunes a jueves 1:00 pm – 4:00 pm
        // Nota: tiene dos correos — se usa el primero
        {
            idPracticante:    uuidv4(),
            numero_documento: '1121828422',
            tipo_documento:   'CC',
            nombre:           'Carrillo Peña Dayssy Judith',
            genero:           'F',
            correo:           'DAYSSYCP@GMAIL.COM',
            eps_ips:          'Nueva EPS',
            clinica:          'Clinica',
            fechaInicio:      new Date('2025-01-28'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573016818553',
            horarios: { create: [
                { dia: 'LUNES',    horaInicio: h(13), horaFin: h(16) },
                { dia: 'MARTES',   horaInicio: h(13), horaFin: h(16) },
                { dia: 'MIERCOLES',horaInicio: h(13), horaFin: h(16) },
                { dia: 'JUEVES',   horaInicio: h(13), horaFin: h(16) },
            ]},
        },

        // 12 — Castillo Ovalle Tania Valentina
        // Horario: Lunes a jueves 8:00 am – 6:00 pm | Viernes 8:00 am – 1:00 pm
        {
            idPracticante:    uuidv4(),
            numero_documento: '1000729759',
            tipo_documento:   'CC',
            nombre:           'Castillo Ovalle Tania Valentina',
            genero:           'F',
            correo:           'psicologataniacastillo@gmail.com',
            eps_ips:          'Salud Total',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-02-03'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573227034045',
            horarios: { create: [
                { dia: 'LUNES',    horaInicio: h(8), horaFin: h(18) },
                { dia: 'MARTES',   horaInicio: h(8), horaFin: h(18) },
                { dia: 'MIERCOLES',horaInicio: h(8), horaFin: h(18) },
                { dia: 'JUEVES',   horaInicio: h(8), horaFin: h(18) },
                { dia: 'VIERNES',  horaInicio: h(8), horaFin: h(13) },
            ]},
        },

        // 13 — Daza Mendoza Shirly Katerine
        // Horario: Lunes a jueves 8:00 am – 5:00 pm | Viernes 8:00 am – 1:00 pm
        {
            idPracticante:    uuidv4(),
            numero_documento: '1013096684',
            tipo_documento:   'CC',
            nombre:           'Daza Mendoza Shirly Katerine',
            genero:           'F',
            correo:           'katerine.daza05@gmail.com',
            eps_ips:          'Famisanar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2025-09-01'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573160628098',
            horarios: { create: [
                { dia: 'LUNES',    horaInicio: h(8), horaFin: h(17) },
                { dia: 'MARTES',   horaInicio: h(8), horaFin: h(17) },
                { dia: 'MIERCOLES',horaInicio: h(8), horaFin: h(17) },
                { dia: 'JUEVES',   horaInicio: h(8), horaFin: h(17) },
                { dia: 'VIERNES',  horaInicio: h(8), horaFin: h(13) },
            ]},
        },

        // 14 — Diaz Origua Brighitte Tatiana
        // Horario: Lunes a jueves 8:00 am – 2:00 pm
        {
            idPracticante:    uuidv4(),
            numero_documento: '1031643591',
            tipo_documento:   'CC',
            nombre:           'Diaz Origua Brighitte Tatiana',
            genero:           'F',
            correo:           'td0717@gmail.com',
            eps_ips:          'EPS Suramericana S.A',
            clinica:          'Clinica',
            fechaInicio:      new Date('2024-07-24'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573112622871',
            horarios: { create: [
                { dia: 'LUNES',    horaInicio: h(8), horaFin: h(14) },
                { dia: 'MARTES',   horaInicio: h(8), horaFin: h(14) },
                { dia: 'MIERCOLES',horaInicio: h(8), horaFin: h(14) },
                { dia: 'JUEVES',   horaInicio: h(8), horaFin: h(14) },
            ]},
        },

        // 15 — Escobar Cuesto Geraldine Tatiana
        // Horario: Miércoles y jueves 8:00 am – 6:00 pm
        {
            idPracticante:    uuidv4(),
            numero_documento: '1015481421',
            tipo_documento:   'CC',
            nombre:           'Escobar Cuesto Geraldine Tatiana',
            genero:           'F',
            correo:           'gtescobar99@gmail.com',
            eps_ips:          'Nueva EPS',
            clinica:          'Clinica',
            fechaInicio:      new Date('2025-11-07'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573115009325',
            horarios: { create: [
                { dia: 'MIERCOLES', horaInicio: h(8), horaFin: h(18) },
                { dia: 'JUEVES',    horaInicio: h(8), horaFin: h(18) },
            ]},
        },

        // 16 — Galeano Novoa Leidy Stefania
        // Horario: Martes y miércoles 4:00 pm – 6:00 pm | Sábados 7:00 am – 10:00 am
        {
            idPracticante:    uuidv4(),
            numero_documento: '1010961832',
            tipo_documento:   'CC',
            nombre:           'Galeano Novoa Leidy Stefania',
            genero:           'F',
            correo:           'leidy.galeano.novoa@gmail.com',
            eps_ips:          'Sanitas',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-02-16'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573023571237',
            horarios: { create: [
                { dia: 'MARTES',    horaInicio: h(16), horaFin: h(18) },
                { dia: 'MIERCOLES', horaInicio: h(16), horaFin: h(18) },
                { dia: 'SABADO',    horaInicio: h(7),  horaFin: h(10) },
            ]},
        },

        // 17 — Garcia Osorio Yenny
        // Horario: Sábados 7:00 am – 10:00 am
        {
            idPracticante:    uuidv4(),
            numero_documento: '53032313',
            tipo_documento:   'PPT',
            nombre:           'Garcia Osorio Yenny',
            genero:           'F',
            correo:           'yenny_osorio24@hotmail.com',
            eps_ips:          'Compensar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2025-10-28'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573003352534',
            horarios: { create: [
                { dia: 'SABADO', horaInicio: h(7), horaFin: h(10) },
            ]},
        },

        // 18 — Gonzalez Buitrago Edilma
        // Horario: Martes y jueves 8:00 am – 6:00 pm
        // Nota: tiene dos teléfonos — se usa el primero
        {
            idPracticante:    uuidv4(),
            numero_documento: '52854698',
            tipo_documento:   'PPT',
            nombre:           'Gonzalez Buitrago Edilma',
            genero:           'F',
            correo:           'edigonzalezb@gmail.com',
            eps_ips:          'Compensar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-02-18'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573506793505',
            horarios: { create: [
                { dia: 'MARTES', horaInicio: h(8), horaFin: h(18) },
                { dia: 'JUEVES', horaInicio: h(8), horaFin: h(18) },
            ]},
        },

        // 19 — Henao Velasquez Lesly Vanesa
        // Horario: Lunes a jueves 8:00 am – 5:00 pm
        {
            idPracticante:    uuidv4(),
            numero_documento: '1029142888',
            tipo_documento:   'CC',
            nombre:           'Henao Velasquez Lesly Vanesa',
            genero:           'F',
            correo:           'v4n3s4082816@gmail.com',
            eps_ips:          'Famisanar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2025-12-02'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573148915501',
            horarios: { create: [
                { dia: 'LUNES',    horaInicio: h(8), horaFin: h(17) },
                { dia: 'MARTES',   horaInicio: h(8), horaFin: h(17) },
                { dia: 'MIERCOLES',horaInicio: h(8), horaFin: h(17) },
                { dia: 'JUEVES',   horaInicio: h(8), horaFin: h(17) },
            ]},
        },

        // 20 — Herrera Zubieta Alejandra
        // Horario: Viernes 8:00 am – 1:00 pm | Sábados 7:00 am – 10:00 am
        {
            idPracticante:    uuidv4(),
            numero_documento: '1019143534',
            tipo_documento:   'CC',
            nombre:           'Herrera Zubieta Alejandra',
            genero:           'F',
            correo:           'zaleja1009@gmail.com',
            eps_ips:          'Salud Total',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-02-07'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573209244313',
            horarios: { create: [
                { dia: 'VIERNES', horaInicio: h(8), horaFin: h(13) },
                { dia: 'SABADO',  horaInicio: h(7), horaFin: h(10) },
            ]},
        },

        // 21 — Hidalgo Coronado Gloria Estefania
        // Horario: Miércoles 8:00 am – 6:00 pm | Viernes 8:00 am – 1:00 pm | Sábados 7:00 am – 10:00 am
        {
            idPracticante:    uuidv4(),
            numero_documento: '1022418011',
            tipo_documento:   'CC',
            nombre:           'Hidalgo Coronado Gloria Estefania',
            genero:           'F',
            correo:           'Estefa96.h@gmail.com',
            eps_ips:          'Sanitas',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-01-31'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573102135306',
            horarios: { create: [
                { dia: 'MIERCOLES', horaInicio: h(8), horaFin: h(18) },
                { dia: 'VIERNES',   horaInicio: h(8), horaFin: h(13) },
                { dia: 'SABADO',    horaInicio: h(7), horaFin: h(10) },
            ]},
        },

        // 22 — Jaque Arevalo Danna Michelle
        // Horario: Lunes, miércoles y jueves 1:00 pm – 4:00 pm
        {
            idPracticante:    uuidv4(),
            numero_documento: '1013674523',
            tipo_documento:   'CC',
            nombre:           'Jaque Arevalo Danna Michelle',
            genero:           'F',
            correo:           'danna201161@hotmail.com',
            eps_ips:          'Famisanar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2025-10-14'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573015484608',
            horarios: { create: [
                { dia: 'LUNES',     horaInicio: h(13), horaFin: h(16) },
                { dia: 'MIERCOLES', horaInicio: h(13), horaFin: h(16) },
                { dia: 'JUEVES',    horaInicio: h(13), horaFin: h(16) },
            ]},
        },

        // 23 — Laverde Herrera Karen Natalia
        // Horario: Sábados 7:00 am – 10:00 am
        {
            idPracticante:    uuidv4(),
            numero_documento: '1016946387',
            tipo_documento:   'CC',
            nombre:           'Laverde Herrera Karen Natalia',
            genero:           'F',
            correo:           'natila1421@gmail.com',
            eps_ips:          'Compensar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-01-17'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573202722656',
            horarios: { create: [
                { dia: 'SABADO', horaInicio: h(7), horaFin: h(10) },
            ]},
        },

        // 24 — Leon Velasquez Brenda Catalina
        // Horario: Sábados 7:00 am – 10:00 am
        // Nota: tiene dos teléfonos — se usa el primero
        {
            idPracticante:    uuidv4(),
            numero_documento: '1001345251',
            tipo_documento:   'CC',
            nombre:           'Leon Velasquez Brenda Catalina',
            genero:           'F',
            correo:           'catalinavelasquez@gmail.com',
            eps_ips:          'Famisanar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2025-05-17'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573213655112',
            horarios: { create: [
                { dia: 'SABADO', horaInicio: h(7), horaFin: h(10) },
            ]},
        },

        // 25 — Lopez Avila Jeimmy Lorena
        // Horario: Sábados 7:00 am – 10:00 am
        {
            idPracticante:    uuidv4(),
            numero_documento: '1000992180',
            tipo_documento:   'CC',
            nombre:           'Lopez Avila Jeimmy Lorena',
            genero:           'F',
            correo:           'jeimmylopez@gmail.com',
            eps_ips:          'Sanitas',
            clinica:          'Clinica',
            fechaInicio:      new Date('2025-12-09'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573142080104',
            horarios: { create: [
                { dia: 'SABADO', horaInicio: h(7), horaFin: h(10) },
            ]},
        },

        // 26 — Lozano Sanchez Laura Daniela
        // Horario: Lunes a jueves 3:00 pm – 5:00 pm
        {
            idPracticante:    uuidv4(),
            numero_documento: '1006117842',
            tipo_documento:   'CC',
            nombre:           'Lozano Sanchez Laura Daniela',
            genero:           'F',
            correo:           'danielalozano459@gmail.com',
            eps_ips:          'Compensar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-02-25'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573138071759',
            horarios: { create: [
                { dia: 'LUNES',    horaInicio: h(15), horaFin: h(17) },
                { dia: 'MARTES',   horaInicio: h(15), horaFin: h(17) },
                { dia: 'MIERCOLES',horaInicio: h(15), horaFin: h(17) },
                { dia: 'JUEVES',   horaInicio: h(15), horaFin: h(17) },
            ]},
        },

        // 27 — Lugo Baracaldo Natalia
        // Horario: Viernes 8:00 am – 1:00 pm | Sábados 7:00 am – 10:00 am
        {
            idPracticante:    uuidv4(),
            numero_documento: '1031421570',
            tipo_documento:   'CC',
            nombre:           'Lugo Baracaldo Natalia',
            genero:           'F',
            correo:           'natlav578@gmail.com',
            eps_ips:          'Sanitas',
            clinica:          'Clinica',
            fechaInicio:      new Date('2025-11-29'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573213223839',
            horarios: { create: [
                { dia: 'VIERNES', horaInicio: h(8), horaFin: h(13) },
                { dia: 'SABADO',  horaInicio: h(7), horaFin: h(10) },
            ]},
        },

        // 28 — Marquéz Cortes Alexa Fernanda
        // Horario: Lunes a jueves 8:00 am – 6:00 pm | Viernes 8:00 am – 1:00 pm
        {
            idPracticante:    uuidv4(),
            numero_documento: '1030574029',
            tipo_documento:   'CC',
            nombre:           'Marquéz Cortes Alexa Fernanda',
            genero:           'F',
            correo:           'fernandamarquez1503@gmail.com',
            eps_ips:          'Famisanar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-03-02'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573503467265',
            horarios: { create: [
                { dia: 'LUNES',    horaInicio: h(8),  horaFin: h(18) },
                { dia: 'MARTES',   horaInicio: h(8),  horaFin: h(18) },
                { dia: 'MIERCOLES',horaInicio: h(8),  horaFin: h(18) },
                { dia: 'JUEVES',   horaInicio: h(8),  horaFin: h(18) },
                { dia: 'VIERNES',  horaInicio: h(8),  horaFin: h(13) },
            ]},
        },

        // 28 — Perez Pulido Diana Katerin
        // Horario: Miércoles 4:00 pm – 5:00 pm
        {
            idPracticante:    uuidv4(),
            numero_documento: '1000352725',
            tipo_documento:   'CC',
            nombre:           'Perez Pulido Diana Katerin',
            genero:           'F',
            correo:           'dianakaterinperez.liceo12@gmail.com',
            eps_ips:          'Compensar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-02-05'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573124963716',
            horarios: { create: [
                { dia: 'MIERCOLES', horaInicio: h(16), horaFin: h(17) },
            ]},
        },

        // 29 — Plaza Rojas Romy Andrea
        // Horario: Sábados 7:00 am – 10:00 am
        {
            idPracticante:    uuidv4(),
            numero_documento: '2000021640',
            tipo_documento:   'CC',
            nombre:           'Plaza Rojas Romy Andrea',
            genero:           'F',
            correo:           'plazaromy@gmail.com',
            eps_ips:          'Compensar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2025-10-25'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573134836977',
            horarios: { create: [
                { dia: 'SABADO', horaInicio: h(7), horaFin: h(10) },
            ]},
        },

        // 30 — Polo Silgado Miley
        // Horario: Sábados 7:00 am – 10:00 am
        {
            idPracticante:    uuidv4(),
            numero_documento: '42658302',
            tipo_documento:   'PPT',
            nombre:           'Polo Silgado Miley',
            genero:           'F',
            correo:           'Polomiley@gmail.com',
            eps_ips:          'Compensar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2025-05-17'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573204265870',
            horarios: { create: [
                { dia: 'SABADO', horaInicio: h(7), horaFin: h(10) },
            ]},
        },

        // 31 — Ramirez Reyes Aleida Yohana
        // Horario: Sábados 7:00 am – 10:00 am
        {
            idPracticante:    uuidv4(),
            numero_documento: '1031143491',
            tipo_documento:   'CC',
            nombre:           'Ramirez Reyes Aleida Yohana',
            genero:           'F',
            correo:           'ayramirezry@gmail.com',
            eps_ips:          'Compensar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2025-11-01'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573215039872',
            horarios: { create: [
                { dia: 'SABADO', horaInicio: h(7), horaFin: h(10) },
            ]},
        },

        // 32 — Rico Matoma Karen Lorena
        // Horario: Lunes a jueves 1:00 pm – 4:00 pm
        {
            idPracticante:    uuidv4(),
            numero_documento: '1029140564',
            tipo_documento:   'CC',
            nombre:           'Rico Matoma Karen Lorena',
            genero:           'F',
            correo:           'karenlorenarico@gmail.com',
            eps_ips:          'Capital Salud',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-02-23'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573217774291',
            horarios: { create: [
                { dia: 'LUNES',    horaInicio: h(13), horaFin: h(16) },
                { dia: 'MARTES',   horaInicio: h(13), horaFin: h(16) },
                { dia: 'MIERCOLES',horaInicio: h(13), horaFin: h(16) },
                { dia: 'JUEVES',   horaInicio: h(13), horaFin: h(16) },
            ]},
        },

        // 33 — Rodriguez Soto Juan David
        // Horario: Lunes a jueves 8:00 am – 6:00 pm | Viernes 8:00 am – 1:00 pm | Sábados 8:00 am – 10:00 am
        {
            idPracticante:    uuidv4(),
            numero_documento: '1016108682',
            tipo_documento:   'CC',
            nombre:           'Rodriguez Soto Juan David',
            genero:           'M',
            correo:           'erickmrs90@gmail.com',
            eps_ips:          'Salud Total',
            clinica:          'Clinica',
            fechaInicio:      new Date('2025-10-20'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573134398277',
            horarios: { create: [
                { dia: 'LUNES',    horaInicio: h(8), horaFin: h(18) },
                { dia: 'MARTES',   horaInicio: h(8), horaFin: h(18) },
                { dia: 'MIERCOLES',horaInicio: h(8), horaFin: h(18) },
                { dia: 'JUEVES',   horaInicio: h(8), horaFin: h(18) },
                { dia: 'VIERNES',  horaInicio: h(8), horaFin: h(13) },
                { dia: 'SABADO',   horaInicio: h(8), horaFin: h(10) },
            ]},
        },

        // 34 — Rodriguez Vargas Hary Johanna
        // Horario: Lunes a jueves 8:00 am – 6:00 pm | Viernes 8:00 am – 1:00 pm
        {
            idPracticante:    uuidv4(),
            numero_documento: '1000776815',
            tipo_documento:   'CC',
            nombre:           'Rodriguez Vargas Hary Johanna',
            genero:           'F',
            correo:           'hary.rodriguez2002@gmail.com',
            eps_ips:          'Nueva EPS',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-01-19'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573168120154',
            horarios: { create: [
                { dia: 'LUNES',    horaInicio: h(8), horaFin: h(18) },
                { dia: 'MARTES',   horaInicio: h(8), horaFin: h(18) },
                { dia: 'MIERCOLES',horaInicio: h(8), horaFin: h(18) },
                { dia: 'JUEVES',   horaInicio: h(8), horaFin: h(18) },
                { dia: 'VIERNES',  horaInicio: h(8), horaFin: h(13) },
            ]},
        },

        // 35 — Rubio Reyes Juan David
        // Horario: Lunes a jueves 11:00 am – 4:00 pm | Viernes 11:00 am – 1:00 pm
        {
            idPracticante:    uuidv4(),
            numero_documento: '1032487810',
            tipo_documento:   'CC',
            nombre:           'Rubio Reyes Juan David',
            genero:           'M',
            correo:           'Juandavidrubioreyes49@gmail.com',
            eps_ips:          'Famisanar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-02-23'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573028091735',
            horarios: { create: [
                { dia: 'LUNES',    horaInicio: h(11), horaFin: h(16) },
                { dia: 'MARTES',   horaInicio: h(11), horaFin: h(16) },
                { dia: 'MIERCOLES',horaInicio: h(11), horaFin: h(16) },
                { dia: 'JUEVES',   horaInicio: h(11), horaFin: h(16) },
                { dia: 'VIERNES',  horaInicio: h(11), horaFin: h(13) },
            ]},
        },

        // 36 — Sandoval Carreño Rosaura
        // Horario: Lunes y martes 1:00 pm – 6:00 pm
        {
            idPracticante:    uuidv4(),
            numero_documento: '51920840',
            tipo_documento:   'CC',
            nombre:           'Sandoval Carreño Rosaura',
            genero:           'F',
            correo:           'lepanto97@gmail.com',
            eps_ips:          'Servisalud',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-03-02'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573124632826',
            horarios: { create: [
                { dia: 'LUNES',  horaInicio: h(13), horaFin: h(18) },
                { dia: 'MARTES', horaInicio: h(13), horaFin: h(18) },
            ]},
        },

        // 37 — Santos Garnica Adriana Valentina
        // Horario: Lunes a jueves 8:00 am – 10:00 am
        {
            idPracticante:    uuidv4(),
            numero_documento: '1033099519',
            tipo_documento:   'CC',
            nombre:           'Santos Garnica Adriana Valentina',
            genero:           'F',
            correo:           'addriva657@gmail.com',
            eps_ips:          'Famisanar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2025-11-19'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573177581979',
            horarios: { create: [
                { dia: 'LUNES',    horaInicio: h(8), horaFin: h(10) },
                { dia: 'MARTES',   horaInicio: h(8), horaFin: h(10) },
                { dia: 'MIERCOLES',horaInicio: h(8), horaFin: h(10) },
                { dia: 'JUEVES',   horaInicio: h(8), horaFin: h(10) },
            ]},
        },

        // 38 — Uzuriaga Duque Laura Melissa
        // Horario: Lunes a miércoles 11:00 am – 5:00 pm
        {
            idPracticante:    uuidv4(),
            numero_documento: '1002862750',
            tipo_documento:   'CC',
            nombre:           'Uzuriaga Duque Laura Melissa',
            genero:           'F',
            correo:           'melissa321@hotmail.com',
            eps_ips:          'Compensar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-02-09'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573223064775',
            horarios: { create: [
                { dia: 'LUNES',     horaInicio: h(11), horaFin: h(17) },
                { dia: 'MARTES',    horaInicio: h(11), horaFin: h(17) },
                { dia: 'MIERCOLES', horaInicio: h(11), horaFin: h(17) },
            ]},
        },

        // 39 — Vera Covaleda Valentina
        // Horario: Lunes a jueves 8:00 am – 6:00 pm | Viernes 8:00 am – 1:00 pm
        {
            idPracticante:    uuidv4(),
            numero_documento: '1011091594',
            tipo_documento:   'CC',
            nombre:           'Vera Covaleda Valentina',
            genero:           'F',
            correo:           'valentinatrabajordsociales@gmail.com',
            eps_ips:          'Sanitas',
            clinica:          'Clinica',
            fechaInicio:      new Date('2025-11-18'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573202816575',
            horarios: { create: [
                { dia: 'LUNES',    horaInicio: h(8), horaFin: h(18) },
                { dia: 'MARTES',   horaInicio: h(8), horaFin: h(18) },
                { dia: 'MIERCOLES',horaInicio: h(8), horaFin: h(18) },
                { dia: 'JUEVES',   horaInicio: h(8), horaFin: h(18) },
                { dia: 'VIERNES',  horaInicio: h(8), horaFin: h(13) },
            ]},
        },

        // 40 — Zapata Mayac Yuliana Andrea
        // Horario: Lunes a jueves 8:00 am – 6:00 pm | Viernes 8:00 am – 1:00 pm | Sábados 8:00 am – 10:00 am
        {
            idPracticante:    uuidv4(),
            numero_documento: '1113696886',
            tipo_documento:   'CC',
            nombre:           'Zapata Mayac Yuliana Andrea',
            genero:           'F',
            correo:           'yuliana19992@outlook.com',
            eps_ips:          'Famisanar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-02-02'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573203575245',
            horarios: { create: [
                { dia: 'LUNES',    horaInicio: h(8), horaFin: h(18) },
                { dia: 'MARTES',   horaInicio: h(8), horaFin: h(18) },
                { dia: 'MIERCOLES',horaInicio: h(8), horaFin: h(18) },
                { dia: 'JUEVES',   horaInicio: h(8), horaFin: h(18) },
                { dia: 'VIERNES',  horaInicio: h(8), horaFin: h(13) },
                { dia: 'SABADO',   horaInicio: h(8), horaFin: h(10) },
            ]},
        },

        // 41 — Zorrilla Montero Arianna Fiorella
        // Horario: Lunes a jueves 8:00 am – 6:00 pm | Viernes 8:00 am – 1:00 pm | Sábados 8:00 am – 10:00 am
        // Nota: documento tipo PPT (Permiso por Protección Temporal)
        {
            idPracticante:    uuidv4(),
            numero_documento: '5031473',
            tipo_documento:   'PPT',
            nombre:           'Zorrilla Montero Arianna Fiorella',
            genero:           'F',
            correo:           'arianna0701afzm@icloud.com',
            eps_ips:          'Compensar',
            clinica:          'Clinica',
            fechaInicio:      new Date('2026-01-05'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573006362113',
            horarios: { create: [
                { dia: 'LUNES',    horaInicio: h(8), horaFin: h(18) },
                { dia: 'MARTES',   horaInicio: h(8), horaFin: h(18) },
                { dia: 'MIERCOLES',horaInicio: h(8), horaFin: h(18) },
                { dia: 'JUEVES',   horaInicio: h(8), horaFin: h(18) },
                { dia: 'VIERNES',  horaInicio: h(8), horaFin: h(13) },
                { dia: 'SABADO',   horaInicio: h(8), horaFin: h(10) },
            ]},
        },
        // 42 — Estupiñan Geraldine
        // Horario: Sábados 7:00 am – 10:00 am
        {
            idPracticante:    uuidv4(),
            numero_documento: '1020304050',
            tipo_documento:   'CC',
            nombre:           'Geraldine Estupiñan',
            genero:           'F',
            correo:           'geraldine.estupinan.arias@gmail.com',
            eps_ips:          '',
            clinica:          '',
            fechaInicio:      new Date('2026-03-03'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '573207603941',
            horarios: { create: [
                { dia: 'SABADO',   horaInicio: h(7), horaFin: h(10) },
            ]},
        },
        // 99999 — Practicante prueba
        {
            idPracticante:    uuidv4(),
            numero_documento: '1000616357',
            tipo_documento:   'CC',
            nombre:           'Sebastian Riascos',
            genero:           'M',
            correo:           'sebastianriascos892@gmail.com',
            eps_ips:          'Sanitas',
            clinica:          'clinica',
            fechaInicio:      new Date('2026-03-03'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '3007717571',
            horarios: { create: [
                { dia: 'SABADO',   horaInicio: h(7), horaFin: h(10) },
            ]},
        },
        // 999999 — Practicante prueba
        {
            idPracticante:    uuidv4(),
            numero_documento: '1025461232',
            tipo_documento:   'CC',
            nombre:           'Jhon Barrantes',
            genero:           'M',
            correo:           'jhonaleba@gmail.com',
            eps_ips:          'Sanitas',
            clinica:          'clinica',
            fechaInicio:      new Date('2026-03-03'),
            fechaFin:         null,
            citasProgramadas: 0,
            telefono:         '3007717571',
            horarios: { create: [
                { dia: 'SABADO',   horaInicio: h(7), horaFin: h(10) },
            ]},
        },
    ];


    let sincronizados = 0;

    for (const p of practicantes) {
        // Si otro registro tiene el mismo teléfono pero distinto documento, liberar el teléfono
        const conflicto = await prisma.practicante.findUnique({ where: { telefono: p.telefono } });
        if (conflicto && conflicto.numero_documento !== p.numero_documento) {
            await prisma.practicante.update({
                where: { telefono: p.telefono },
                data:  { telefono: `OLD_${conflicto.numero_documento}_${Date.now()}` },
            });
        }

        // Upsert practicante (crea o actualiza por numero_documento)
        const practicante = await prisma.practicante.upsert({
            where:  { numero_documento: p.numero_documento },
            create: {
                idPracticante:    p.idPracticante,
                numero_documento: p.numero_documento,
                tipo_documento:   p.tipo_documento,
                nombre:           p.nombre,
                genero:           p.genero,
                correo:           p.correo      ?? null,
                eps_ips:          p.eps_ips     ?? null,
                clinica:          p.clinica     ?? null,
                fechaInicio:      p.fechaInicio ?? null,
                fechaFin:         p.fechaFin    ?? null,
                estrato:          p.estrato     ?? null,
                barrio:           p.barrio      ?? null,
                localidad:        p.localidad   ?? null,
                citasProgramadas: p.citasProgramadas,
                telefono:         p.telefono,
            },
            update: {
                tipo_documento: p.tipo_documento,
                nombre:         p.nombre,
                genero:         p.genero,
                correo:         p.correo      ?? null,
                eps_ips:        p.eps_ips     ?? null,
                clinica:        p.clinica     ?? null,
                fechaInicio:    p.fechaInicio ?? null,
                fechaFin:       p.fechaFin    ?? null,
                estrato:        p.estrato     ?? null,
                barrio:         p.barrio      ?? null,
                localidad:      p.localidad   ?? null,
                telefono:       p.telefono,
            },
        });
        sincronizados++;

        // Sincronizar horarios: borrar solo los de este practicante y recrear
        await prisma.horario.deleteMany({ where: { practicanteId: practicante.idPracticante } });
        await prisma.horario.createMany({
            data: p.horarios.create.map(h => ({
                practicanteId: practicante.idPracticante,
                dia:           h.dia,
                horaInicio:    h.horaInicio,
                horaFin:       h.horaFin,
            })),
        });

        // Upsert rol en rolChat
        await prisma.rolChat.upsert({
            where:  { telefono: p.telefono },
            create: { telefono: p.telefono, rol: 'practicante', updatedAt: new Date() },
            update: { rol: 'practicante', updatedAt: new Date() },
        });
    }

    console.log(`✅ Se han sincronizado ${sincronizados} practicantes.\n`);

    // -------------------------------------------------------------------------
    // Admins
    // -------------------------------------------------------------------------
    const admins = [
        {
            telefono:  String(process.env.PRIMER_ADMIN) || '573183644600',
            rol:       'admin',
            updatedAt: new Date(),
        }
    ];
    await prisma.rolChat.createMany({
        data:           admins,
        skipDuplicates: true,
    });

    // -------------------------------------------------------------------------
    // RAG Config — insertar prompt si no existe (idempotente)
    // -------------------------------------------------------------------------
    const ragExistente = await prisma.ragPsychologicalConfig.findUnique({
        where:  { id: 'general' },
        select: { id: true }
    });

    if (ragExistente) {
        console.log('\nℹ️  Configuración RAG ya existe — se omite la inserción.');
    } else {
        console.log('\n🧠 Insertando configuración RAG...');
        await initializeConfig();
    }
}

main()
    .catch((e) => {
        console.error('Error en seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
