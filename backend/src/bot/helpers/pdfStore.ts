/**
 * Almacén en memoria de rutas de PDFs generados por usuario.
 */

interface PdfEntry {
  pdfPath: string;
  testId:  string;
  fecha:   Date;
}

const pdfStore = new Map<string, PdfEntry>();

export function guardarRutaPdf(telefono: string, pdfPath: string, testId: string): void {
  pdfStore.set(telefono, { pdfPath, testId, fecha: new Date() });
}

export function obtenerRutaPdf(telefono: string): PdfEntry | null {
  return pdfStore.get(telefono) ?? null;
}

export function limpiarRutaPdf(telefono: string): void {
  pdfStore.delete(telefono);
}
