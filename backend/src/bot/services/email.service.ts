/**
 * Servicio de email para el bot.
 */

import nodemailer from "nodemailer";
import path from "node:path";
import { env, requireSmtp } from "../../config/env.js";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface EmailReportData {
  nombrePaciente?:    string;
  documentoPaciente?: string;
  telefonoPaciente?:  string;
  testNombre?:        string;
  fecha?:             string;
  nombrePracticante?: string;
  semestre?:          string | number | null;
  jornada?:           string | null;
  carrera?:           string | null;
}

export interface EmailResult {
  success: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Transporter (lazy singleton)
// ---------------------------------------------------------------------------

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    requireSmtp(); // Lanza error descriptivo si SMTP no está configurado
    transporter = nodemailer.createTransport({
      host:   env.SMTP_HOST,
      port:   env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

// ---------------------------------------------------------------------------
// Función principal
// ---------------------------------------------------------------------------

/**
 * Envía el PDF del informe psicológico por correo al practicante.
 */
export async function enviarPdfPorCorreo(
  correoPracticante: string,
  pdfPath: string,
  datosInforme: EmailReportData = {}
): Promise<EmailResult> {
  try {
    if (!correoPracticante) {
      return { success: false, message: "No se proporcionó correo del practicante" };
    }
    if (!pdfPath) {
      return { success: false, message: "No se proporcionó ruta del PDF" };
    }

    const {
      nombrePaciente    = "No disponible",
      documentoPaciente = "No disponible",
      telefonoPaciente  = "No disponible",
      testNombre        = "Test psicológico",
      fecha             = new Date().toLocaleString("es-CO"),
      nombrePracticante = "Profesional",
      semestre          = null,
      jornada           = null,
      carrera           = null,
    } = datosInforme;

    const nombreArchivo = path.basename(pdfPath);

    const mailOptions: nodemailer.SendMailOptions = {
      from:    `"ChatBot Psicología" <${env.SMTP_USER}>`,
      to:      correoPracticante,
      cc:      env.ADMIN_EMAIL || undefined,
      subject: `Informe ${testNombre} - Paciente: ${nombrePaciente}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
            Informe de Evaluación Psicológica
          </h2>
          <p>Estimado/a <strong>${nombrePracticante}</strong>,</p>
          <p>Se ha completado una evaluación psicológica. A continuación los detalles:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background-color: #f8f9fa;">
              <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Paciente</td>
              <td style="padding: 10px; border: 1px solid #dee2e6;">${nombrePaciente}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Documento</td>
              <td style="padding: 10px; border: 1px solid #dee2e6;">${documentoPaciente}</td>
            </tr>
            <tr style="background-color: #f8f9fa;">
              <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Teléfono</td>
              <td style="padding: 10px; border: 1px solid #dee2e6;">${telefonoPaciente}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Prueba</td>
              <td style="padding: 10px; border: 1px solid #dee2e6;">${testNombre}</td>
            </tr>
            <tr style="background-color: #f8f9fa;">
              <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Fecha</td>
              <td style="padding: 10px; border: 1px solid #dee2e6;">${fecha}</td>
            </tr>
            ${semestre ? `
            <tr>
              <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Semestre</td>
              <td style="padding: 10px; border: 1px solid #dee2e6;">${semestre}</td>
            </tr>` : ""}
            ${jornada ? `
            <tr style="background-color: #f8f9fa;">
              <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Jornada</td>
              <td style="padding: 10px; border: 1px solid #dee2e6;">${jornada}</td>
            </tr>` : ""}
            ${carrera ? `
            <tr>
              <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Carrera</td>
              <td style="padding: 10px; border: 1px solid #dee2e6;">${carrera}</td>
            </tr>` : ""}
          </table>
          <p>El informe técnico completo se encuentra adjunto en formato PDF.</p>
          <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
          <p style="color: #6c757d; font-size: 12px;">
            Este correo fue enviado automáticamente por el ChatBot de Psicología IUDC.
          </p>
        </div>
      `,
      attachments: [{ filename: nombreArchivo, path: pdfPath }],
    };

    const smtp = getTransporter();
    const info = await smtp.sendMail(mailOptions);
    console.log("[email] Correo enviado:", info.messageId);
    return { success: true, message: `Correo enviado a ${correoPracticante}` };

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[email] Error enviando correo:", msg);
    return { success: false, message: `Error enviando correo: ${msg}` };
  }
}

/**
 * Verifica la configuración SMTP sin enviar un correo.
 * Útil para diagnóstico.
 */
export async function verificarConexionSmtp(): Promise<EmailResult> {
  try {
    const smtp = getTransporter();
    await smtp.verify();
    return { success: true, message: `SMTP conectado correctamente (${env.SMTP_HOST}:${env.SMTP_PORT})` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Error de conexión SMTP: ${msg}` };
  }
}
