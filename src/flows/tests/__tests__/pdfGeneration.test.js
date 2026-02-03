import fs from 'fs';
import path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { generarPDFResultados } from '../testPDF_GHQ12.js';
import { generarPDFResultadosDASS21 } from '../testPDF_DASS21.js';

const createdFiles = [];

const ensureCleanup = (filePath) => {
  if (!filePath) return;
  createdFiles.push(filePath);
};

const assertPdfFile = (filePath) => {
  expect(fs.existsSync(filePath)).toBe(true);
  const buffer = fs.readFileSync(filePath);
  expect(buffer.length).toBeGreaterThan(0);
  const header = buffer.subarray(0, 4).toString('ascii');
  expect(header).toBe('%PDF');
};

afterEach(() => {
  for (const filePath of createdFiles) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  createdFiles.length = 0;
});

describe('PDF generation', () => {
  it('genera PDF GHQ-12 en temp', async () => {
    const numeroUsuario = '12345';
    const puntaje = 10;
    const respuestas = {
      0: [1, 3],
      1: [2, 4],
      2: [5, 6],
      3: [7, 8, 9, 10, 11, 12]
    };
    const umbrales = {
      bajo: { min: 0, max: 9 },
      medio: { min: 10, max: 16 },
      alto: { min: 17, max: 36 }
    };

    const filePath = await generarPDFResultados(numeroUsuario, puntaje, respuestas, umbrales);
    ensureCleanup(filePath);
    assertPdfFile(filePath);

    const expectedName = `GHQ12_${numeroUsuario}.pdf`;
    expect(path.basename(filePath)).toBe(expectedName);
  });

  it('genera PDF DASS-21 en temp', async () => {
    const numeroUsuario = '67890';
    const puntajes = {
      total: 30,
      depresion: 8,
      ansiedad: 6,
      estres: 16
    };
    const respuestas = {
      0: [1, 4, 7],
      1: [2, 5, 8, 11],
      2: [3, 6, 9, 12, 15, 18],
      3: [10, 13, 14, 16, 17, 19, 20, 21]
    };

    const filePath = await generarPDFResultadosDASS21(numeroUsuario, puntajes, respuestas);
    ensureCleanup(filePath);
    assertPdfFile(filePath);

    const expectedName = `DASS21_${numeroUsuario}.pdf`;
    expect(path.basename(filePath)).toBe(expectedName);
  });
});