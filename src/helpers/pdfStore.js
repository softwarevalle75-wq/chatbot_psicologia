/**
 * Almacén temporal en memoria para las rutas de PDF generados.
 * Se usa para que el flujo de pedirDocumentoProfesionalFlow pueda
 * acceder al PDF más reciente generado para un usuario.
 */

// Map<telefonoUsuario, { pdfPath, testId, fecha }>
const pdfStore = new Map()

/**
 * Guarda la ruta del PDF más reciente generado para un usuario.
 * @param {string} telefono - Teléfono del usuario
 * @param {string} pdfPath - Ruta absoluta al PDF
 * @param {string} testId - Identificador del test (ghq12, dass21)
 */
export const guardarRutaPdf = (telefono, pdfPath, testId) => {
    pdfStore.set(telefono, {
        pdfPath,
        testId,
        fecha: new Date(),
    })
    console.log(`📄 PDF guardado en store para ${telefono}: ${pdfPath}`)
}

/**
 * Obtiene la ruta del PDF más reciente para un usuario.
 * @param {string} telefono - Teléfono del usuario
 * @returns {{ pdfPath: string, testId: string, fecha: Date } | null}
 */
export const obtenerRutaPdf = (telefono) => {
    return pdfStore.get(telefono) || null
}

/**
 * Elimina la ruta del PDF para un usuario (limpieza después de enviar).
 * @param {string} telefono - Teléfono del usuario
 */
export const limpiarRutaPdf = (telefono) => {
    pdfStore.delete(telefono)
}
