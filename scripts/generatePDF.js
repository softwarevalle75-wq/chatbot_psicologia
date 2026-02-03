import { generarPDFResultados } from '../src/flows/tests/testPDF_GHQ12.js';
import { generarPDFResultadosDASS21 } from '../src/flows/tests/testPDF_DASS21.js';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
};

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const type = (getArg('type', 'ghq12') || '').toLowerCase();
const user = getArg('user', '999001');

const run = async () => {
  if (type === 'ghq12') {
    const score = toNumber(getArg('score', '12'), 12);
    const respuestas = {
      0: [1, 2],
      1: [3, 4],
      2: [5, 6],
      3: [7, 8, 9, 10, 11, 12]
    };
    const umbrales = {
      bajo: { min: 0, max: 9 },
      medio: { min: 10, max: 16 },
      alto: { min: 17, max: 36 }
    };

    const filePath = await generarPDFResultados(user, score, respuestas, umbrales);
    console.log(filePath);
    return;
  }

  if (type === 'dass21') {
    const depresion = toNumber(getArg('depresion', '7'), 7);
    const ansiedad = toNumber(getArg('ansiedad', '6'), 6);
    const estres = toNumber(getArg('estres', '15'), 15);
    const total = toNumber(getArg('total', String(depresion + ansiedad + estres)), depresion + ansiedad + estres);

    const puntajes = { total, depresion, ansiedad, estres };
    const respuestas = {
      0: [1, 4, 7],
      1: [2, 5, 8, 11],
      2: [3, 6, 9, 12, 15, 18],
      3: [10, 13, 14, 16, 17, 19, 20, 21]
    };

    const filePath = await generarPDFResultadosDASS21(user, puntajes, respuestas);
    console.log(filePath);
    return;
  }

  console.error('Uso: npm run gen:pdf -- --type ghq12|dass21 [--user ID]');
  process.exitCode = 1;
};

run();