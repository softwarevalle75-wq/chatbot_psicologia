/**
 * Generación de informes PDF con PDFKit.
 */

import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface PatientData {
  nombres?:         string;
  apellidos?:       string;
  documento?:       string;
  tipoDocumento?:   string;
  telefonoPrincipal?: string;
  semestre?:        string | number;
  jornada?:         string;
  carrera?:         string;
}

export interface PdfOptions {
  numeroUsuario:  string;
  testId:         string;
  interpretation: string;
  rawResults:     Record<number, number[]>;
  patientData:    PatientData | null;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const COLORS = {
  primary:   "#1F4E79",
  secondary: "#EEF4FB",
  text:      "#1F2937",
  muted:     "#6B7280",
  border:    "#D1D5DB",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureTempDir(): string {
  const tempDir = path.resolve(process.cwd(), "temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function sanitize(value: unknown): string {
  if (value === undefined || value === null) return "";
  const normalized = String(value)
    .normalize("NFKC")
    .replace(/\r\n/g, "\n")
    .replace(/[\u2012\u2013\u2014\u2212]/g, "-");

  return Array.from(normalized)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return (
        code === 9 || code === 10 || code === 13 ||
        (code >= 32 && code <= 126) ||
        (code >= 160 && code <= 255)
      );
    })
    .join("");
}

function stripMarkdown(text: string): string {
  return sanitize(text)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "• ");
}

function normalizeInterpretation(text: string): string {
  const sanitized = sanitize(text);
  const lines = sanitized.split("\n");
  const transformed: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { transformed.push(""); continue; }
    if (/^\|?\s*-{2,}/.test(line) || /^\|[-\s|:]+\|$/.test(line)) continue;
    if (line.includes("|")) {
      const cells = line.split("|").map(c => c.trim()).filter(Boolean);
      if (cells.length >= 2) {
        if (/^item$/i.test(cells[0])) continue;
        if (cells.length === 2) transformed.push(`- ${cells[0]}: ${cells[1]}`);
        else if (cells.length >= 3) transformed.push(`- ${cells[0]}: ${cells[1]} (${cells[2]})`);
        continue;
      }
    }
    transformed.push(rawLine);
  }
  return transformed.join("\n");
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) doc.addPage();
}

// ---------------------------------------------------------------------------
// Renderizado de la interpretación
// ---------------------------------------------------------------------------

function drawInterpretationContent(doc: PDFKit.PDFDocument, interpretationText: string): void {
  const lines = normalizeInterpretation(interpretationText)
    .split("\n")
    .map(line => line.replace(/\t/g, "    "));

  const left  = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) { doc.moveDown(0.45); continue; }

    ensureSpace(doc, 28);

    // H1
    if (/^# /.test(rawLine)) {
      doc.fontSize(13).fillColor(COLORS.primary).font("Helvetica-Bold")
        .text(stripMarkdown(line.replace(/^# /, "")), left, doc.y, { width });
      doc.moveDown(0.4);
      continue;
    }
    // H2
    if (/^## /.test(rawLine)) {
      doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold")
        .text(stripMarkdown(line.replace(/^## /, "")), left, doc.y, { width });
      doc.moveDown(0.3);
      continue;
    }
    // H3
    if (/^### /.test(rawLine)) {
      doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold")
        .text(stripMarkdown(line.replace(/^### /, "")), left, doc.y, { width });
      doc.moveDown(0.25);
      continue;
    }
    // Bullet
    if (/^[•\-*]\s/.test(line)) {
      const bulletText = stripMarkdown(line.replace(/^[•\-*]\s/, ""));
      doc.fontSize(9).fillColor(COLORS.text).font("Helvetica")
        .text(`• ${bulletText}`, left + 10, doc.y, { width: width - 10 });
      doc.moveDown(0.25);
      continue;
    }
    // Negrita pura (toda la línea es **texto**)
    if (/^\*\*.*\*\*$/.test(line)) {
      doc.fontSize(10).fillColor(COLORS.text).font("Helvetica-Bold")
        .text(stripMarkdown(line), left, doc.y, { width });
      doc.moveDown(0.3);
      continue;
    }
    // Texto normal
    doc.fontSize(9).fillColor(COLORS.text).font("Helvetica")
      .text(stripMarkdown(rawLine), left, doc.y, { width });
    doc.moveDown(0.25);
  }
}

// ---------------------------------------------------------------------------
// Función principal
// ---------------------------------------------------------------------------

export async function generateInterpretationPdf(options: PdfOptions): Promise<string> {
  const { numeroUsuario, testId, interpretation, rawResults, patientData } = options;

  const testLabel = testId.toUpperCase().replace("GHQ12", "GHQ-12").replace("DASS21", "DASS-21");
  const fecha     = new Date().toLocaleString("es-CO");
  const tempDir   = ensureTempDir();
  const fileName  = `informe_${testId}_${numeroUsuario.replace(/\D/g, "")}_${Date.now()}.pdf`;
  const filePath  = path.join(tempDir, fileName);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size:    "LETTER",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info:    { Title: `Informe ${testLabel}`, Author: "ChatBot Psicología IUDC" },
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const left  = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const width = right - left;

      // ── Header ────────────────────────────────────────────────────────────
      doc.rect(left, doc.y, width, 60).fill(COLORS.primary);
      doc.fillColor("white").fontSize(16).font("Helvetica-Bold")
        .text(`Informe de Evaluación Psicológica`, left + 16, doc.y - 50, { width: width - 32 });
      doc.fontSize(11).font("Helvetica")
        .text(`Instrumento: ${testLabel}`, left + 16, doc.y, { width: width - 32 });
      doc.moveDown(2);

      // ── Fecha ─────────────────────────────────────────────────────────────
      doc.fontSize(8).fillColor(COLORS.muted).font("Helvetica")
        .text(`Fecha de elaboración: ${fecha}`, left, doc.y, { align: "right", width });
      doc.moveDown(0.8);

      // ── Datos del paciente ─────────────────────────────────────────────
      if (patientData) {
        doc.rect(left, doc.y, width, 18).fill(COLORS.secondary);
        doc.fillColor(COLORS.primary).fontSize(10).font("Helvetica-Bold")
          .text("DATOS DEL PACIENTE", left + 8, doc.y - 14, { width });
        doc.moveDown(0.8);

        const nombreCompleto = [patientData.nombres, patientData.apellidos].filter(Boolean).join(" ") || "No disponible";
        const docPaciente    = patientData.documento
          ? `${patientData.tipoDocumento ?? ""} ${patientData.documento}`.trim()
          : "No disponible";

        const campos = [
          ["Nombre completo", nombreCompleto],
          ["Documento",       docPaciente],
          ["Teléfono",        patientData.telefonoPrincipal ?? "No disponible"],
          patientData.carrera  ? ["Carrera",  String(patientData.carrera)]  : null,
          patientData.jornada  ? ["Jornada",  String(patientData.jornada)]  : null,
          patientData.semestre ? ["Semestre", String(patientData.semestre)] : null,
        ].filter(Boolean) as string[][];

        const colW = (width - 16) / 2;
        for (let i = 0; i < campos.length; i += 2) {
          ensureSpace(doc, 20);
          const y = doc.y;
          if (i % 4 === 0) doc.rect(left, y, width, 18).fill("#F9FAFB");
          doc.fillColor(COLORS.muted).fontSize(8).font("Helvetica-Bold")
            .text(campos[i][0], left + 8, y + 4, { width: colW });
          doc.fillColor(COLORS.text).font("Helvetica")
            .text(campos[i][1], left + 8 + colW / 2, y + 4, { width: colW });
          if (campos[i + 1]) {
            doc.fillColor(COLORS.muted).font("Helvetica-Bold")
              .text(campos[i + 1][0], left + 8 + colW, y + 4, { width: colW });
            doc.fillColor(COLORS.text).font("Helvetica")
              .text(campos[i + 1][1], left + 8 + colW * 1.5, y + 4, { width: colW / 2 });
          }
          doc.y = y + 18;
        }
        doc.moveDown(1);
      }

      // ── Respuestas por categoría ────────────────────────────────────────
      ensureSpace(doc, 40);
      doc.rect(left, doc.y, width, 18).fill(COLORS.secondary);
      doc.fillColor(COLORS.primary).fontSize(10).font("Helvetica-Bold")
        .text("DISTRIBUCIÓN DE RESPUESTAS", left + 8, doc.y - 14, { width });
      doc.moveDown(0.8);

      const categorias = [
        { label: "Categoría 0", items: rawResults[0] ?? [] },
        { label: "Categoría 1", items: rawResults[1] ?? [] },
        { label: "Categoría 2", items: rawResults[2] ?? [] },
        { label: "Categoría 3", items: rawResults[3] ?? [] },
      ];

      for (const cat of categorias) {
        ensureSpace(doc, 16);
        doc.fontSize(9).fillColor(COLORS.text).font("Helvetica-Bold")
          .text(`${cat.label} (${cat.items.length} ítems): `, left, doc.y, { continued: true });
        doc.font("Helvetica")
          .text(cat.items.length > 0 ? cat.items.join(", ") : "—");
        doc.moveDown(0.3);
      }
      doc.moveDown(0.8);

      // ── Interpretación ─────────────────────────────────────────────────
      ensureSpace(doc, 40);
      doc.rect(left, doc.y, width, 18).fill(COLORS.secondary);
      doc.fillColor(COLORS.primary).fontSize(10).font("Helvetica-Bold")
        .text("INTERPRETACIÓN TÉCNICA", left + 8, doc.y - 14, { width });
      doc.moveDown(0.8);

      drawInterpretationContent(doc, interpretation);

      // ── Footer ────────────────────────────────────────────────────────
      doc.moveDown(1);
      doc.rect(left, doc.y, width, 1).fill(COLORS.border);
      doc.moveDown(0.5);
      doc.fontSize(7).fillColor(COLORS.muted).font("Helvetica")
        .text(
          "Este informe fue generado automáticamente por el Sistema de Evaluación Psicológica de la IUDC. " +
          "No reemplaza el diagnóstico clínico profesional. Uso confidencial.",
          left, doc.y, { width, align: "center" }
        );

      doc.end();
      stream.on("finish", () => resolve(filePath));
      stream.on("error",  reject);
    } catch (err) {
      reject(err);
    }
  });
}
