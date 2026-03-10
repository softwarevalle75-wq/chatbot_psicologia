import nodemailer from 'nodemailer'
import path from 'path'

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true para 465, false para otros puertos
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
})

/**
 * Envía el PDF del informe psicológico por correo electrónico al practicante.
 *
 * @param {string} correoPracticante - Email del practicante destino
 * @param {string} pdfPath - Ruta absoluta al archivo PDF generado
 * @param {object} datosInforme - Datos para el cuerpo del correo
 * @param {string} datosInforme.nombrePaciente - Nombre del paciente
 * @param {string} datosInforme.documentoPaciente - Documento del paciente
 * @param {string} datosInforme.telefonoPaciente - Teléfono del paciente
 * @param {string} datosInforme.testNombre - Nombre del test (GHQ-12 o DASS-21)
 * @param {string} datosInforme.fecha - Fecha de elaboración
 * @param {string} datosInforme.nombrePracticante - Nombre del practicante
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const enviarPdfPorCorreo = async (correoPracticante, pdfPath, datosInforme) => {
    try {
        if (!correoPracticante) {
            return { success: false, message: 'No se proporcionó correo del practicante' }
        }
        if (!pdfPath) {
            return { success: false, message: 'No se proporcionó ruta del PDF' }
        }

        const {
            nombrePaciente = 'No disponible',
            documentoPaciente = 'No disponible',
            telefonoPaciente = 'No disponible',
            testNombre = 'Test psicológico',
            fecha = new Date().toLocaleString('es-CO'),
            nombrePracticante = 'Profesional',
        } = datosInforme || {}

        const nombreArchivo = path.basename(pdfPath)

        const mailOptions = {
            from: `"ChatBot Psicología" <${process.env.SMTP_USER}>`,
            to: correoPracticante,
            cc: 'chatbotpsicologia@gmail.com',
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
                    </table>
                    
                    <p>El informe técnico completo se encuentra adjunto en formato PDF.</p>
                    
                    <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
                    <p style="color: #6c757d; font-size: 12px;">
                        Este correo fue enviado automáticamente por el ChatBot de Psicología.
                    </p>
                </div>
            `,
            attachments: [
                {
                    filename: nombreArchivo,
                    path: pdfPath,
                },
            ],
        }

        const info = await transporter.sendMail(mailOptions)
        console.log('✅ Correo enviado exitosamente:', info.messageId)
        return { success: true, message: `Correo enviado a ${correoPracticante}` }
    } catch (error) {
        console.error('❌ Error enviando correo:', error)
        return { success: false, message: `Error enviando correo: ${error.message}` }
    }
}
