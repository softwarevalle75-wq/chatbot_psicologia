import {
	getEstadoCuestionario,
	saveEstadoCuestionario,
	savePuntajeUsuario,
	obtenerTelefonoPracticante,
	sendAutonomousMessage,
	notificarTestCompletadoAPracticante,
    guardarResultadoPrueba,    
} from '../../queries/queries.js'

import { generarPDFResultados} from '../tests/testPDF_GHQ12.js'
import fs from 'fs'

const cuestGhq12 = {    
    preguntas: [
        '1. ¿Ha podido concentrarse bien en lo que hace?\n    0️⃣ Mejor que lo habitual.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Menos que lo habitual.\n    3️⃣ Mucho menos que lo habitual.',
        '2. ¿Sus preocupaciones le han hecho perder mucho el sueño?\n    0️⃣ No, en absoluto.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Más que lo habitual.\n    3️⃣ Mucho más que lo habitual.',
        '3. ¿Ha sentido que está desempeñando un papel útil en la vida?\n    0️⃣ Más que lo habitual.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Menos que lo habitual.\n    3️⃣ Mucho menos que lo habitual.',        
        '4. ¿Se ha sentido capaz de tomar decisiones?\n    0️⃣ Más capaz que lo habitual.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Menos capaz que lo habitual.\n    3️⃣ Mucho menos capaz que lo habitual.',
        // '5. ¿Se ha sentido constantemente agobiado y en tensión?\n    0️⃣ No, en absoluto.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Más que lo habitual.\n    3️⃣ Mucho más que lo habitual.',        
        // '6. ¿Ha sentido que no puede superar sus dificultades?\n    0️⃣ No, en absoluto.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Más que lo habitual.\n    3️⃣ Mucho más que lo habitual.',
        // '7. ¿Ha sido capaz de disfrutar de sus actividades normales de cada día?\n    0️⃣ Más que lo habitual.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Menos que lo habitual.\n    3️⃣ Mucho menos que lo habitual.',
        // '8. ¿Ha sido capaz de hacer frente adecuadamente a sus problemas?\n    0️⃣ Más capaz que lo habitual.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Menos capaz que lo habitual.\n    3️⃣ Mucho menos capaz que lo habitual.',
        // '9. ¿Se ha sentido poco feliz o deprimido/a?\n    0️⃣ No, en absoluto.\n    1️⃣ No más que lo habitual.\n    2️⃣ Más que lo habitual.\n    3️⃣ Mucho más que lo habitual.',
        // '10. ¿Ha perdido confianza en sí mismo/a?\n    0️⃣ No, en absoluto.\n    1️⃣ No más que lo habitual.\n    2️⃣ Más que lo habitual.\n    3️⃣ Mucho más que lo habitual.',
        // '11. ¿Ha pensado que usted es una persona que no vale para nada?\n    0️⃣ No, en absoluto.\n    1️⃣ No más que lo habitual.\n    2️⃣ Más que lo habitual.\n    3️⃣ Mucho más que lo habitual.',
        // '12. ¿Se siente razonablemente feliz considerando todas las circunstancias?\n    0️⃣ Más feliz que lo habitual.\n    1️⃣ Igual que lo habitual.\n    2️⃣ Menos feliz que lo habitual.\n    3️⃣ Mucho menos feliz que lo habitual.',
    ],
    umbrales: {
        bajo: {
            max: 11,
            mensaje: '    No hay presencia de síntomas significativos de malestar psicológico 🟢',
        },
        medio: { 
            min: 12, 
            max: 18, 
            mensaje: '    Hay cierto grado de preocupación emocional 🟡' 
        },
        alto: { 
            min: 19, 
            mensaje: '    Hay un indicador de malestar psicológico significativo 🔴' 
        },
    },
    resPreg: {
        0: [],
        1: [],
        2: [],
        3: [],
    },
}

//--------------------------------------------------------------------------------

let globalProvider = null;

export const configurarProviderGHQ12 = (provider) => {
    globalProvider = provider;
    console.log('👍 Provider configurado para envío de PDFs')
}

//--------------------------------------------------------------------------------

export const procesarGHQ12 = async (numeroUsuario, respuestas) => {
    const tipoTest = 'ghq12'
    const { preguntas, umbrales } = cuestGhq12

    console.log('Procesando GHQ-12 para el usuario:', numeroUsuario)

    try {
        let estado = await getEstadoCuestionario(numeroUsuario, tipoTest)

        // Validar respuesta
        if (estado.resPreg && ![0,1,2,3].includes(Number(respuestas))) {
            return {
                error: 'Respuesta inválida. Debe ser un número entre 0 y 3.',
            }
        }

        // permite que el cuestionario inicie desde la pregunta 1
        if (!estado.resPreg || Object.keys(estado.resPreg).length === 0) {
            estado = {
                Puntaje: 0,
                preguntaActual: 0,
                resPreg: { ...cuestGhq12.resPreg }, 
            }
            await saveEstadoCuestionario(
                numeroUsuario,
                estado.preguntaActual,
                estado.resPreg,
                tipoTest,
                estado.Puntaje,
            )
            return preguntas[0]
        }

        if (respuestas === null) {
			return preguntas[estado.preguntaActual]
		}

        const respuestaNum = Number(respuestas)
        estado.Puntaje += respuestaNum

        // Guardar respuesta
        if (!estado.resPreg[respuestaNum]) {
            estado.resPreg[respuestaNum] = []
        }
        estado.resPreg[respuestaNum].push(estado.preguntaActual + 1)

        // Verificar si hay más preguntas
        const siguientePregunta = estado.preguntaActual + 1 
        if (siguientePregunta >= preguntas.length) {
            
            // Guardar estado y puntaje 
            await saveEstadoCuestionario(
                numeroUsuario,
                estado.preguntaActual,
                estado.resPreg,
                tipoTest,
                estado.Puntaje,
            )
            await savePuntajeUsuario(numeroUsuario, tipoTest, estado.Puntaje, estado.resPreg )

            // await guardarResultadoPrueba(numeroUsuario, tipoTest, {
            //     puntaje: estado.Puntaje,
            //     respuestasPorPuntos: estado.resPreg,
            //     interpretacion: await evaluarGHQ12(estado.Puntaje, umbrales)
            // });

            // Se guarda el resultado en la BD
            const interpretacion = await evaluarGHQ12(estado.Puntaje, umbrales)            
            const datosFormateados = 
            '*PUNTAJE' +
            `\n    Total: ${estado.Puntaje} \n` +
            '*RESPUESTAS POR PUNTOS*' +
            `\n    Puntaje 0: [${estado.resPreg[0]?.join(', ') || ''}]` +
            `\n    Puntaje 1: [${estado.resPreg[1]?.join(', ') || ''}]` +
            `\n    Puntaje 2: [${estado.resPreg[2]?.join(', ') || ''}]` +
            `\n    Puntaje 3: [${estado.resPreg[3]?.join(', ') || ''}] \n` +
            '*INTERPRETACIÓN*' +
            `\n    ${interpretacion}`;

            await guardarResultadoPrueba(numeroUsuario, tipoTest, datosFormateados);

            // await guardarResultadoPrueba(numeroUsuario, tipoTest, {
            //     puntaje: estado.Puntaje,
            //     respuestasPorPuntos: estado.resPreg,
            //     interpretacion: await evaluarGHQ12(estado.Puntaje, umbrales)
            // });


            try {
                const telefonoPracticante = await obtenerTelefonoPracticante(numeroUsuario)
                if (telefonoPracticante) {
                    const mensajeInicial = `🔔 *📋 TEST GHQ12 COMPLETADO - GENERANDO REPORTE*\n\n`;
                    
                    await sendAutonomousMessage(telefonoPracticante, mensajeInicial);

                    //Aqui se genera el pdf
                    const rutaPDF = await generarPDFResultados(
                        numeroUsuario, 
                        estado.Puntaje, 
                        estado.resPreg,
                        umbrales                        
                    )

                    console.log('PDF generado: ', rutaPDF)

                    //Se envia el pdf al practicante
                    setTimeout(async() => {
                        try {
                            if (globalProvider) {
                                try{
                                    // Enviar PDF con sendMedia
                                    const numeroCompleto = telefonoPracticante.includes('@') 
                                        ? telefonoPracticante 
                                        : `${telefonoPracticante}@s.whatsapp.net`;
                                    
                                    await globalProvider.sendMedia(
                                        numeroCompleto,
                                        rutaPDF,
                                        '📊 *Reporte GHQ-12*'
                                    );

                                    setTimeout(async () => {
										await notificarTestCompletadoAPracticante(numeroUsuario);
									}, 1000);

                                    console.log('PDF enviado existosamente via provider')
                                } catch (providerError) {
                                    console.log('Error con provider, usando fallback')
                                    throw providerError;
                                }
                            } else {
                                throw new Error('Provider no configurado')
                            }

                        } catch (error) {
                            console.log('Error al enviar el PDF', error)
                            
                            const resultadosTexto = await evaluarGHQ12(estado.Puntaje, umbrales);
                            
                            await sendAutonomousMessage(
                                telefonoPracticante,
                                `🔔 *🧠 RESULTADOS GHQ12*\n\n` +
                                `👤 *Paciente:* ${numeroUsuario}\n` +
                                `📊 *Resultados obtenidos:*${resultadosTexto}`
                            )
                        }

                        setTimeout(() => {
                            try {
                                fs.unlinkSync(rutaPDF)
                                console.log('PDF eliminado exitosamente')
                            } catch (error) {
                                console.log('Error al eliminar el PDF', error)
                            }
                        }, 30000)
                    }, 3000)

                } else {
                    console.log('No se pudo obtener teléfono del practicante')
                }
            } catch (error) {
                console.error('Error procesando resultados GHQ-12', error)
            }

            return "✅ *Prueba completada con éxito.*\n\nGracias por completar la evaluación. Los resultados han sido enviados a tu practicante asignado."
        }

        // Siguiente pregunta
        estado.preguntaActual = siguientePregunta
        await saveEstadoCuestionario(
            numeroUsuario,
            estado.preguntaActual,
            estado.resPreg,
            tipoTest,
            estado.Puntaje,
        )

        return preguntas[estado.preguntaActual]

    } catch (error) {
        console.error('Error al procesar GHQ-12:', error)
        return 'Hubo un error al procesar la prueba. Por favor, inténtelo de nuevo más tarde.'

    }
}

//--------------------------------------------------------------------------------

export const evaluarGHQ12 = async (puntaje, umbrales) => {
	if (puntaje <= umbrales.bajo.max) {
		return `El puntaje del paciente fue de: ${puntaje} \n${umbrales.bajo.mensaje}`
	} else if (puntaje >= umbrales.medio.min && puntaje <= umbrales.medio.max) {
		return `El puntaje del paciente fue de: ${puntaje} \n${umbrales.medio.mensaje}`
	} else if (puntaje >= umbrales.alto.min) {
		return `El puntaje del paciente fue de: ${puntaje} \n${umbrales.alto.mensaje}`
	} else {
		return 'Error al evaluar su puntaje'
	}
}

//--------------------------------------------------------------------------------

export const GHQ12info = () => {
    return {
        nombre: 'GHQ-12',
        descripcion: 'Cuestionario de Salud General de 12 ítems',
        numPreguntas: cuestGhq12.preguntas.length,
        tiempoEstimado: '5-10 minutos',
    }
}



