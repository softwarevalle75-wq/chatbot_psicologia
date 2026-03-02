import Prisma from '@prisma/client'
export const prisma = new Prisma.PrismaClient()
import { adapterProvider } from '../app.js'
import { ensureJid } from '../helpers/jidHelper.js'
import fs from 'fs'
//---------------------------------------------------------------------------------------------------------

export const registrarUsuario = async (
  primerNombre,
  primerApellido,
  correo,
  numero
) => {
  try {
    const user = await prisma.informacionUsuario.upsert({
      where: {
        telefonoPersonal: numero,
      },
      update: {
        primerNombre,
        primerApellido,
        correo,
      },
      create: {
        telefonoPersonal: numero,
        primerNombre,
        primerApellido,
        correo,
        fechaNacimiento: new Date(), // Campo requerido
        password: 'temp_password' // Campo requerido
      },
    });
    return user;
  } catch (error) {
    console.error("Error al crear el usuario:", error);
    throw new Error("Hubo un problema al crear el usuario.");
  }
};

//---------------------------------------------------------------------------------------------------------

export const perteneceUniversidad = async (numero, datos) => {
	try {
		const usuario = await prisma.informacionUsuario.update({
			where: { telefonoPersonal: numero },
			data: {
				carrera: datos.carrera,
				jornada: datos.jornada,
				semestre: datos.semestre
			}
		})
		console.log('✅ Datos del usuario registrados correctamente')
		return usuario;
	} catch (error) {
		console.error('✖️❌ Error al guardar los datos del usuario:', error)
		throw new Error('Hubo un problema al guardar los datos del usuario')
	}
};

// //---------------------------------------------------------------------------------------------------------
//Verificar rol sin autenticación completa
export async function verificarRolUsuario(telefono) {
  try {
    console.log('======================================')
    console.log('🔍 Verificando rol para:', telefono);
    
    // Buscar con el número tal como viene
    let rolInfo = await prisma.rolChat.findUnique({
      where: { telefono: telefono },
      select: {
        telefono: true,
        rol: true
      }
    });

    // Si no encuentra y el número empieza con 57, buscar sin prefijo
    if (!rolInfo && telefono.startsWith('57')) {
      const telefonoSinPrefijo = telefono.substring(2);
      console.log('🔍 Buscando rol sin prefijo 57:', telefonoSinPrefijo);
      
      rolInfo = await prisma.rolChat.findUnique({
        where: { telefono: telefonoSinPrefijo },
        select: {
          telefono: true,
          rol: true
        }
      });
    }

    console.log('📋 Rol encontrado:', rolInfo ? rolInfo.rol : 'No encontrado');
	console.log('======================================')
    return rolInfo;
    
  } catch (error) {
    console.error('❌ Error verificando rol:', error);
    return null;
  }
}

// //---------------------------------------------------------------------------------------------------------

export const obtenerPracticantePorTelefono = async (numero) => {
  try {
    return await prisma.practicante.findFirst({
      where: { telefono: numero },
    });
  } catch (e) {
    console.error('obtenerPracticantePorTelefono error:', e);
    return null;
  }
};

// --- NUEVO: NO crea usuario; solo mira si existe por telefonoPersonal
export const buscarUsuarioPorTelefono = async (numero) => {
  try {
    return await prisma.informacionUsuario.findUnique({
      where: { telefonoPersonal: numero },
    });
  } catch (e) {
    console.error('buscarUsuarioPorTelefono error:', e);
    return null;
  }
};

export const obtenerPerfilPacienteParaInforme = async (numero) => {
	try {
		const telefonoLimpio = String(numero || '').replace(/\D/g, '')
		if (!telefonoLimpio) return null

		const candidatos = [telefonoLimpio]
		if (!telefonoLimpio.startsWith('57')) candidatos.push(`57${telefonoLimpio}`)
		if (telefonoLimpio.startsWith('57') && telefonoLimpio.length > 2) {
			candidatos.push(telefonoLimpio.slice(2))
		}

		for (const telefono of candidatos) {
			const user = await prisma.informacionUsuario.findUnique({
				where: { telefonoPersonal: telefono },
				select: {
					primerNombre: true,
					segundoNombre: true,
					primerApellido: true,
					segundoApellido: true,
					tipoDocumento: true,
					documento: true,
					telefonoPersonal: true,
					segundoTelefono: true,
					correo: true,
					fechaNacimiento: true,
					semestre: true,
					carrera: true,
					jornada: true,
					informacionSociodemografica: {
						select: {
							escolaridad: true,
							ocupacion: true,
							estadoCivil: true,
						}
					}
				}
			})

			if (user) {
				const now = new Date()
				const birthDate = user.fechaNacimiento ? new Date(user.fechaNacimiento) : null
				let edad = null
				if (birthDate) {
					edad = now.getFullYear() - birthDate.getFullYear()
					const monthDiff = now.getMonth() - birthDate.getMonth()
					if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
						edad -= 1
					}
				}

				return {
					nombres: [user.primerNombre, user.segundoNombre].filter(Boolean).join(' ') || 'No disponible',
					apellidos: [user.primerApellido, user.segundoApellido].filter(Boolean).join(' ') || 'No disponible',
					tipoDocumento: user.tipoDocumento || 'No disponible',
					documento: user.documento || 'No disponible',
					telefonoPrincipal: user.telefonoPersonal || 'No disponible',
					telefonoAlterno: user.segundoTelefono || 'No disponible',
					correo: user.correo || 'No disponible',
					edad: Number.isFinite(edad) && edad >= 0 ? `${edad} años` : 'No disponible',
					fechaNacimiento: user.fechaNacimiento
						? new Date(user.fechaNacimiento).toLocaleDateString('es-CO')
						: 'No disponible',
					semestre: user.semestre ? `${user.semestre}` : null,
					carrera: user.carrera || null,
					jornada: user.jornada || null,
					escolaridad: user.informacionSociodemografica?.escolaridad || 'No disponible',
					ocupacion: user.informacionSociodemografica?.ocupacion || 'No disponible',
					estadoCivil: user.informacionSociodemografica?.estadoCivil || 'No disponible',
				}
			}
		}

		return null
	} catch (error) {
		console.error('Error obteniendo perfil del paciente para informe:', error)
		return null
	}
}

// --- NUEVO: resuelve remitente por teléfono (prioriza practicante)
// export const resolverRemitentePorTelefono = async (numero) => {
//   const practicante = await obtenerPracticantePorTelefono(numero);
//   if (practicante) return { tipo: 'practicante', data: practicante };

//   const usuario = await buscarUsuarioPorTelefono(numero);
//   if (usuario) return { tipo: 'usuario', data: usuario };

//   return { tipo: 'desconocido', data: null };
// };



//---------------------------------------------------------------------------------------------------------

export const obtenerUsuario = async (numero) => {
  try {
    const getUser = async (numero) => {

      // ✅ Primero: intentar detectar practicante por teléfono
      const pract = await prisma.practicante.findUnique({
        where: {
          telefono: numero
        },
        select: {
          idPracticante: true,
          nombre: true,
          telefono: true,
        }
      })

      if (pract) {
        return {
          tipo: 'practicante',
          data: pract,
          flujo: 'practMenuFlow'
        };
      }
      // ✅ Luego: buscar usuario normal
      let user = await prisma.informacionUsuario.findUnique({
        where: {
          telefonoPersonal: numero,
        },
        select: {
          idUsuario: true,
          primerNombre: true,
          primerApellido: true,
          correo: true,
          telefonoPersonal: true,
          flujo: true,
          testActual: true,
          historial: true,
          fechaCreacion: true,
          consentimientoInformado: true,
          practicanteAsignado: true
        }
      })

      if (user) {
        return {
          tipo: 'usuario',
          data: user,
          flujo: user.flujo,
          testActual: user.testActual
        }
      }

      return null;
    }

    let user = await getUser(numero);

    // Si el usuario no existe y no es practicante, crearlo con valores por defecto
    if (!user) {
      // doble verificación: si es practicante no crear usuario
      const pract = await prisma.practicante.findUnique({ where: { telefono: numero } });
      if (pract) {
        return {
          tipo: 'practicante',
          data: pract,
          flujo: 'practMenuFlow'
        };
      }
      const newUser = await prisma.informacionUsuario.create({
        data: {
			telefonoPersonal: numero,
			primerNombre: '',
			primerApellido: '', 	
			correo: '',
			fechaNacimiento: new Date(),
			password: '',
			historial: [],
			flujo: 'register' // ← BD ya tiene este default
        },

        select: {
          idUsuario: true,
          telefonoPersonal: true,
          historial: true,
          flujo: true, // ← IMPORTANTE: Seleccionar flujo
        },
      })
      
      return { 
        tipo: 'usuario', 
        data: newUser, 
        flujo: newUser.flujo // ← Será 'register'
      }
    }
    
    return user
  } catch (error) {
    console.error('Error al obtener el usuario:', error)
    throw new Error('Hubo un problema al obtener el usuario.')
  }
}
//---------------------------------------------------------------------------------------------------------

// Retorna el usuario solo si existe y completó el registro (tiene nombre y flujo != 'register').
export const buscarUsuarioRegistrado = async (numero) => {
  try {
    const user = await prisma.informacionUsuario.findUnique({
      where: { telefonoPersonal: numero },
      select: {
        idUsuario: true,
        primerNombre: true,
        primerApellido: true,
        telefonoPersonal: true,
        flujo: true,
        consentimientoInformado: true,
      }
    });

    // No existe en BD
    if (!user) return null;

    // Existe pero no completó registro
    if (user.flujo === 'register' || !user.primerNombre) return null;

    return user;
  } catch (error) {
    console.error('Error al buscar usuario registrado:', error);
    return null;
  }
};

//---------------------------------------------------------------------------------------------------------

// Normaliza el número (solo dígitos)
const normalizePhone = (raw) => (raw || '').replace(/\D/g, '');

export async function setRolTelefono(telefono, rol) {
	const phone = normalizePhone(telefono);
  return prisma.rolChat.upsert({
	where: { telefono: phone },
    update: { rol },
    create: { telefono: phone, rol },
  });
}
//---------------------------------------------------------------------------------------------------------

export async function getRolTelefono(telefono) {
	const phone = normalizePhone(telefono);
	return prisma.rolChat.findUnique({ where: { telefono: phone } });
}
//---------------------------------------------------------------------------------------------------------


export async function createUsuarioBasico(telefono, data = {}) {
  const phone = normalizePhone(telefono);
  // Crea (o asegura) un usuario mínimo en informacionUsuario
  const user = await prisma.informacionUsuario.upsert({
    where: { telefonoPersonal: phone },
    update: {
      primerNombre: data.primerNombre ?? undefined,
      primerApellido: data.primerApellido ?? undefined,
      correo: data.correo ?? undefined,
    },
    create: {
      telefonoPersonal: phone,
      primerNombre: data.primerNombre ?? 'Usuario',
      primerApellido: data.primerApellido ?? 'Bot',
      correo: data.correo ?? `${phone}@temp.com`,
      fechaNacimiento: new Date(),
      password: 'temp_password',
      historial: [],
      // los demás campos de tu modelo ya tienen defaults
    },
  });
  // Marca el rol en el mapa
  await setRolTelefono(phone, 'usuario');
  return user;
}

/**
 * Crea un “cascarón” para rol practicante/admin:
 * - Para 'practicante' NO creamos registro en la tabla practicante aquí porque tu modelo exige muchos campos obligatorios.
 *   Sugerencia: crea el perfil completo en su flujo propio.
 * - Para 'admin' normalmente basta con el mapeo (o si tienes tabla admin, haz upsert ahí).
 */
export async function ensureRolMapping(telefono, rol) {
  const phone = normalizePhone(telefono);
  await setRolTelefono(phone, rol);
  return { telefono: phone, rol };
}

export async function resolverRemitentePorTelefono(rawPhone) {
  const telefono = normalizePhone(rawPhone);

  // 1) Si existe mapeo, úsalo
  const mapping = await getRolTelefono(telefono);
  if (mapping) {
    return { tipo: mapping.rol, data: null };
  }

  // 2) Fallback a tus tablas (ajusta los campos según tu schema real)
  const user = await prisma.informacionUsuario.findUnique({
    where: { telefonoPersonal: telefono },
  });
  if (user) return { tipo: 'usuario', data: user };

  // Si tu modelo practicante tiene campo 'telefono', úsalo; si no, quita esto.
  try {
    const pract = await prisma.practicante.findUnique({
      where: { telefono: telefono },
    });
    if (pract) return { tipo: 'practicante', data: pract };
  } catch (_) {
    // si no existe la columna 'telefono' en practicante, ignora
  }

  // 3) Desconocido
  return null;
}

//---------------------------------------------------------------------------------------------------------

export const obtenerHist = async (numero) => {
	try {
		console.log('Obteniendo historial del usuario:', numero)
		
		// 🔥 VERIFICAR PRIMERO SI ES UN PRACTICANTE
		const practicante = await prisma.practicante.findFirst({
			where: { telefono: numero }
		});
		
		if (practicante) {
			console.log('📋 Es un practicante, retornando historial vacío');
			return []; // Los practicantes no necesitan historial
		}
		
		const user = await prisma.informacionUsuario.findUnique({
			where: {
				telefonoPersonal: numero,
			},
			select: {
				historial: true,
			},
		})

		// Verificar si no se encontró el usuario
		if (!user) {
			console.error(`Usuario no encontrado con el número: ${numero}`)
			return []
		}

		// Retornar el historial del usuario encontrado
		return user.historial || []
	} catch (error) {
		console.error('Error al obtener o crear el historial del usuario:', error)
		throw new Error('Hubo un problema al procesar la solicitud de historial.')
	}
}

//---------------------------------------------------------------------------------------------------------

export async function saveHist(numero, conversationHistory) {
  try {
    console.log("Guardando historial para:", numero);
    
    // 🔥 VERIFICAR PRIMERO SI ES UN PRACTICANTE
    const practicante = await prisma.practicante.findFirst({
      where: { telefono: numero }
    });
    
    if (practicante) {
      console.log('📋 Es un practicante, no guardar historial');
      return; // Los practicantes no necesitan historial
    }

    await prisma.informacionUsuario.upsert({
      where: { telefonoPersonal: numero },
      update: { historial: conversationHistory },
      create: {
        telefonoPersonal: numero,
        primerNombre: 'Usuario',
        primerApellido: 'Bot',
        correo: `${numero}@temp.com`,
        fechaNacimiento: new Date(),
        password: 'temp_password',
        historial: conversationHistory
      }
    });

    console.log("Historial guardado correctamente.");
  } catch (error) {
    console.error("Error al guardar el historial:", error);
    throw new Error("Hubo un problema al guardar el historial.");
  }
}

//---------------------------------------------------------------------------------------------------------

export const switchAyudaPsicologica = async (numero, opcion) => {
	try {
		await prisma.informacionUsuario.update({
			where: {
				telefonoPersonal: numero,
			},
			data: {
				ayudaPsicologica: opcion,
			},
		})
	} catch (error) {
		console.error('Error al guardar el historial:', error)
		throw new Error('Hubo un problema al guardar el historial.')
	}
}

//---------------------------------------------------------------------------------------------------------

export const switchFlujo = async (numero, flujo) => {
	try {
		console.log('🔄 Intentando switchear flujo para:', numero, 'a:', flujo);
		
		// Intentar con el número tal como viene
		let result = await prisma.informacionUsuario.updateMany({
			where: {
				telefonoPersonal: numero,
			},
			data: {
				flujo: flujo,
			},
		});

		// Si no actualizó nada y el número empieza con 57, intentar sin prefijo
		if (result.count === 0 && numero.startsWith('57')) {
			const numeroSinPrefijo = numero.substring(2);
			console.log('🔄 Intentando sin prefijo 57:', numeroSinPrefijo);
			
			result = await prisma.informacionUsuario.updateMany({
				where: {
					telefonoPersonal: numeroSinPrefijo,
				},
				data: {
					flujo: flujo,
				},
			});
		}

		console.log('✅ Flujo actualizado. Registros afectados:', result.count);
		
		// Si no se actualizó ningún registro, no es un error crítico para usuarios web
		if (result.count === 0) {
			console.log('⚠️ No se encontró usuario para actualizar flujo, pero continuando...');
		}
		
	} catch (error) {
		console.error('Error al switchear el flujo:', error)
		// No lanzar error para usuarios web que no existen en BD del bot
		console.log('⚠️ Error en switchFlujo, pero continuando para usuarios web...');
	}
}

//---------------------------------------------------------------------------------------------------------

export const sendAutonomousMessage = async (numero, mensaje) => {
	try {
		// Asegurate de que el número esté limpio
		const numeroLimpio = numero.replace(/\D/g, '');
		const numeroCompleto = `${numeroLimpio}@s.whatsapp.net`;
		
		const jid = ensureJid(numeroCompleto); // canoniza el número
		await adapterProvider.sendText(jid, mensaje);
		
		console.log(`Mensaje autónomo enviado a ${numero}: ${mensaje}`);
		return true;
	} catch (error) {
		console.error('Error enviando mensaje autónomo:', error);
		throw new Error('Hubo un problema enviando el mensaje autónomo.');
	}
}

export const sendAutonomousDocument = async (numero, mensaje, filePath) => {
	try {
		if (!filePath || !fs.existsSync(filePath)) {
			throw new Error(`Archivo no encontrado: ${filePath}`)
		}

		const numeroLimpio = numero.replace(/\D/g, '')
		const numeroCompleto = `${numeroLimpio}@s.whatsapp.net`
		const jid = ensureJid(numeroCompleto)

		await adapterProvider.sendMessage(jid, mensaje, { media: filePath })
		console.log(`Documento enviado a ${numero}: ${filePath}`)
		return true
	} catch (error) {
		console.error('Error enviando documento autónomo:', error)
		throw new Error('Hubo un problema enviando el documento autónomo.')
	}
}

// Función para notificar al practicante que el test se completó y cambiar su flujo
export const notificarTestCompletadoAPracticante = async (telefonoPaciente) => {
	try {
		console.log(`🔔 Notificando test completado para paciente: ${telefonoPaciente}`);
		
		const telefonoPracticante = await obtenerTelefonoPracticante(telefonoPaciente);
		if (!telefonoPracticante) {
			console.log('❌ No se encontró practicante asignado');
			return false;
		}

		// Enviar mensaje de notificación al practicante
		await sendAutonomousMessage(
			telefonoPracticante,
			"✅ *Test completado.* Los resultados han sido enviados.\n\n_Escribe cualquier mensaje para regresar al menú._"
		);

		// Cambiar estado de practicante en BD
		await switchFlujo(telefonoPracticante, 'practMenuFlow')

		console.log(`✅ Practicante ${telefonoPracticante} notificado del test completado`);
		return true;
	} catch (error) {
		console.error('Error notificando test completado:', error);
		return false;
	}
}

export const usuarioTienePracticanteAsignado = async (telefonoPaciente) => {
	try {
		const telefonoPracticante = await obtenerTelefonoPracticante(telefonoPaciente)
		return Boolean(telefonoPracticante)
	} catch (error) {
		console.error('Error verificando practicante asignado:', error)
		return false
	}
}

// Función para limpiar el estado de test completado del practicante
export const limpiarEstadoTestCompletado = async (telefonoPracticante) => {
	try {
		const telefonoLimpio = telefonoPracticante.replace(/\D/g, '');
		// Campos testCompletadoReciente y ultimoPacienteTest no existen en el modelo actual
		await prisma.practicante.update({
			where: { telefono: telefonoLimpio },
			data: { 
				testCompletadoReciente: false,
				ultimoPacienteTest: null
			}
		});
		console.log(`🧹 Estado de test completado limpiado para practicante: ${telefonoPracticante}`);
		return true;
	} catch (error) {
		console.error('Error limpiando estado de test completado:', error);
		return false;
	}
}

// Función para verificar si un practicante tiene un test completado reciente
export const verificarTestCompletadoReciente = async (telefonoPracticante) => {
	try {
		const telefonoLimpio = telefonoPracticante.replace(/\D/g, '');
		// Campos testCompletadoReciente y ultimoPacienteTest no existen en el modelo actual
		const practicante = await prisma.practicante.findUnique({
			where: { telefono: telefonoLimpio },
			select: { 
				testCompletadoReciente: true,
				ultimoPacienteTest: true
			}
		});
		
		return practicante?.testCompletadoReciente || false;
	} catch (error) {
		console.error('Error verificando test completado reciente:', error);
		return false;
	}
}


//---------------------------------------------------------------------------------------------------------

export const getEstadoCuestionario = async(telefono, tipoTest) => {
	try {
		console.log('[DB] getEstadoCuestionario ->', { telefono, tipoTest });
		const modelo = seleccionarModelo(tipoTest);

		// Si el registro existe
		let infoCues = await modelo.findUnique ({
			where: { telefono }
		})
		
		// Si no hay registro, se crea
		if (!infoCues) {
			const defaultData = { telefono: telefono }

			if (tipoTest === 'ghq12') {
				defaultData.Puntaje = 0
				defaultData.preguntaActual = 0
				defaultData.resPreg = {}
			} else if (tipoTest === 'dass21') {
				defaultData.puntajeDep = 0
				defaultData.puntajeAns = 0
				defaultData.puntajeEstr = 0
				defaultData.preguntaActual = 0
				defaultData.resPreg = {}
				defaultData.respuestas= []
			} else {
				defaultData.Puntaje = 0
				defaultData.preguntaActual = 0
				defaultData.resPreg = {}
			}

			infoCues = await modelo.create ({
				data: defaultData,
			})
		}

		return infoCues

	} catch (error) {
		console.error('Error obteniendo el estado:', error)
		throw new Error('Hubo un problema obteniendo el estado.')
	}
}
//---------------------------------------------------------------------------------------------------------

export const saveEstadoCuestionario = async (
	telefono, 
	preguntaActual,
	resPreg,
	tipoTest,
	...extraParams // guardar paramentros adicionales
) => {
	const modelo = seleccionarModelo(tipoTest)
	console.log('[DB] saveEstadoCuestionario call:', { telefono, preguntaActual, resPreg, tipoTest, extraParams });
	const data = {
		preguntaActual: preguntaActual,
		resPreg: resPreg,
	}

	if (tipoTest === 'ghq12') {
		const [puntaje] = extraParams
		if (puntaje !== undefined) {
			data.Puntaje = puntaje
		}
	} else if (tipoTest === 'dass21') {
		const [respuestas] = extraParams
		if (respuestas !== undefined) {
			data.respuestas = respuestas
		}
	} else {
		const [puntaje] = extraParams
		if (puntaje !== undefined) {
			data.Puntaje = puntaje
		}
	}

	return await modelo.update({
		where: { telefono },
		data: data,
	})
}
//---------------------------------------------------------------------------------------------------------

export const savePuntajeUsuario = async (telefono, tipoTest, ...puntajeParams) => {
	const modelo = seleccionarModelo(tipoTest)

	console.log(`Tipo de test: ${tipoTest}`)
	
	if (tipoTest === 'ghq12') {
		const [puntaje, jsonPreg] = puntajeParams
		return await modelo.update ({
			where: { telefono },
			data: {
				Puntaje: puntaje,
				resPreg: jsonPreg,
			},
		})
	} else if (tipoTest === 'dass21') {
		const [puntajeDep, puntajeAns, puntajeEstr, jsonPreg] = puntajeParams
		
		return await modelo.update ({
			where: { telefono },
			data: {
				puntajeDep,
				puntajeAns,
				puntajeEstr,
				resPreg: jsonPreg,
			},
		})
	} else {
		const [puntaje, jsonPreg] = puntajeParams
		return await modelo.update ({
			where: { telefono },
			data: {
				Puntaje: puntaje,
				resPreg: jsonPreg,
			},
		})
	}
}


//---------------------------------------------------------------------------------------------------------


// Obtener el puntaje y pregunta actual.
export const getInfoCuestionario = async (telefono, tipoTest) => {
	try {
		const test = seleccionarModelo(tipoTest)

		if (tipoTest === 'dass21') {
			const infoCues = await test.findUnique ({
				where: { telefono },
				select: {
					puntajeDep: true,
					puntajeAns: true,
					puntajeEstr: true,
					preguntaActual: true,
					resPreg: true,
					respuestas: true,
				},
			})
			return { infoCues }
		} else if (tipoTest === 'ghq12') {
			const infoCues = await test.findUnique({
				where: { telefono },
				select: {
					Puntaje: true,
					preguntaActual: true,
					resPreg: true,
				},
			})

			if (infoCues) {
			const preguntas = [
				'1. ¿Ha podido concentrarse bien en lo que hace?\n    0) Mejor que lo habitual.\n    1) Igual que lo habitual.\n    2) Menos que lo habitual.\n    3) Mucho menos que lo habitual.',
				'2. ¿Sus preocupaciones le han hecho perder mucho el sueño?\n    0) No, en absoluto.\n    1) Igual que lo habitual.\n    2) Más que lo habitual.\n    3) Mucho más que lo habitual.',
				'3. ¿Ha sentido que está desempeñando un papel útil en la vida?\n    0) Más que lo habitual.\n    1) Igual que lo habitual.\n    2) Menos que lo habitual.\n    3) Mucho menos que lo habitual.',
				'4. ¿Se ha sentido capaz de tomar decisiones?\n    0) Más capaz que lo habitual.\n    1) Igual que lo habitual.\n    2) Menos capaz que lo habitual.\n    3) Mucho menos capaz que lo habitual.',
				'5. ¿Se ha sentido constantemente agobiado y en tensión?\n    0) No, en absoluto.\n    1) Igual que lo habitual.\n    2) Más que lo habitual.\n    3) Mucho más que lo habitual.',
				'6. ¿Ha sentido que no puede superar sus dificultades?\n    0) No, en absoluto.\n    1) Igual que lo habitual.\n    2) Más que lo habitual.\n    3) Mucho más que lo habitual.',
				'7. ¿Ha sido capaz de disfrutar de sus actividades normales de cada día?\n    0) Más que lo habitual.\n    1) Igual que lo habitual.\n    2) Menos que lo habitual.\n    3) Mucho menos que lo habitual.',
				'8. ¿Ha sido capaz de hacer frente adecuadamente a sus problemas?\n    0) Más capaz que lo habitual.\n    1) Igual que lo habitual.\n    2) Menos capaz que lo habitual.\n    3) Mucho menos capaz que lo habitual.',
				'9. ¿Se ha sentido poco feliz o deprimido/a?\n    0) No, en absoluto.\n    1) No más que lo habitual.\n    2) Más que lo habitual.\n    3) Mucho más que lo habitual.',
				'10. ¿Ha perdido confianza en sí mismo/a?\n    0) No, en absoluto.\n    1) No más que lo habitual.\n    2) Más que lo habitual.\n    3) Mucho más que lo habitual.',
				'11. ¿Ha pensado que usted es una persona que no vale para nada?\n    0) No, en absoluto.\n    1) No más que lo habitual.\n    2) Más que lo habitual.\n    3) Mucho más que lo habitual.',
				'12. ¿Se siente razonablemente feliz considerando todas las circunstancias?\n    0) Más feliz que lo habitual.\n    1) Igual que lo habitual.\n    2) Menos feliz que lo habitual.\n    3) Mucho menos feliz que lo habitual.',
			]
			const preguntasString = preguntas.join('\n')
			const objetct = { infoCues, preguntasString }
			return objetct
		} else {
			await test.create({
				data: {
					telefono: telefono,
				},
			})
			return
		}
		}

		
	} catch (error) {
		console.error('Error obteniendo el estado:', error)
		throw new Error('Hubo un problema obteniendo el estado.')
	}
}

//---------------------------------------------------------------------------------------------------------

export const changeTest = async (numero, tipoTest) => {
	try {
		const change = await prisma.informacionUsuario.update({
			where: {
				telefonoPersonal: numero,
			},
			data: {
				testActual: tipoTest,
			},
		})
		return change.testActual
	} catch (error) {
		console.error('Error cambiando el test:', error)
		throw new Error('Hubo un problema cambiando el test.')
	}
}

//---------------------------------------------------------------------------------------------------------

// Función para seleccionar el modelo adecuado basado en el tipo de test
function seleccionarModelo(tipoTest) {
	if (tipoTest === 'ghq12') {
		return prisma.ghq12
	} else if (tipoTest === 'dass21') {
		return prisma.dass21
	} else {
		return prisma.tests
	}
} 

//---------------------------------------------------------------------------------------------------------

// FUNCIÓN DESHABILITADA - Campo disponibilidad no existe en el modelo actual
export const actualizarDisp = async (numero, disp) => {
	try {
		const change = await prisma.informacionUsuario.update({
			where: {
				telefonoPersonal: numero,
			},
			data: {
				disponibilidad: disp,
			},
		})
		return change
	} catch (error) {
		console.error('Error cambiando el test:', error)
		throw new Error('Hubo un problema cambiando el test.')
	}
}

//---------------------------------------------------------------------------------------------------------

//* ABAJO IRAN LAS QUERIES PARA LOS ENDPONTS

//---------------------------------------------------------------------------------------------------------

export const getUsuario = async (correo) => {
	try {
		let user = await prisma.informacionUsuario.findUnique({
			where: {
				correo: correo,
			},
			select: {
				idUsuario: true,
				primerNombre: true,
				primerApellido: true,
				correo: true,
				telefonoPersonal: true,
				testActual: true,
				ayudaPsicologica: true,
				flujo: true,
				fechaCreacion: true,
				consentimientoInformado: true,
			},
		})

		return user
	} catch (error) {
		console.error('Error al obtener el Usuario:', error)
		throw new Error('Hubo un problema al obtener el Usuario.')
	}
}

//---------------------------------------------------------------------------------------------------------

export const getPracticante = async (documento) => {
	try {
		let pract = await prisma.practicante.findUnique({
			where: {
				numero_documento: documento,
			},
		})

		return pract
	} catch (error) {
		console.error('Error al obtener el Practicante:', error)
		throw new Error('Hubo un problema al obtener el Practicante.')
	}
}

//---------------------------------------------------------------------------------------------------------

//Necesito una query de prisma para obtener la cita en estado "pendiente" en base al id del usuario
export const getCita = async (id) => {
	try {
		let cita = await prisma.cita.findMany({
			where: {
				idUsuario: id,
				estado: 'pendiente',
			},
		})
		console.log(cita)
		return cita
	} catch (error) {
		console.error('Error al obtener la Cita:', error)
		throw new Error('Hubo un problema al obtener la Cita.')
	}
}

// FUNCIÓN DESHABILITADA - Usar sistema web de autenticación
export const addWebUser = async (
	nombre,
	apellido,
	correo,
	tipoDocumento,
	documento,
	telefonoPersonal
) => {
	try {
		const user = await prisma.informacionUsuario.create({
			data: {
				nombre: nombre,
				apellido: apellido,
				correo: correo,
				tipoDocumento: tipoDocumento,
				documento: documento,
				telefonoPersonal: telefonoPersonal,
			},
		})
		return user
	} catch (error) {
		console.error('Error al crear el usuario:', error)
		throw new Error('Hubo un problema al crear el usuario.')
	}
}

//---------------------------------------------------------------------------------------------------------

export const addWebPracticante = async (
	nombre,
	documento,
	tipoDocumento,
	genero,
	estrato,
	barrio,
	localidad,
	horario
) => {
	try {
		const pract = await prisma.practicante.create({
			data: {
				nombre: nombre,
				numero_documento: documento,
				tipo_documento: tipoDocumento,
				genero: genero,
				estrato: estrato,
				barrio: barrio,
				localidad: localidad,
				horario: horario,
			},
		})
		return pract
	} catch (error) {
		console.error('Error al crear el practicante:', error)
		throw new Error('Hubo un problema al crear el practicante.')
	}
}

//---------------------------------------------------------------------------------------------------------

// FUNCIÓN DESHABILITADA - Usar sistema web de autenticación
export const editWebUser = async (
	nombre,
	apellido,
	correo,
	tipoDocumento,
	documento,
	telefonoPersonal
) => {
	try {
		// Buscar al usuario por correo
		let user = await prisma.informacionUsuario.findFirst({
			where: {
				correo: correo,
			},
		})

		// Si no se encuentra por correo, buscar por documento
		if (!user) {
			console.log('No se encontró usuario por correo, buscando por documento:', documento)
			user = await prisma.informacionUsuario.findFirst({
				where: {
					documento: documento,
				},
			})
		}

		// Si no se encuentra por documento, buscar por teléfono
		if (!user) {
			user = await prisma.informacionUsuario.findFirst({
				where: {
					telefonoPersonal: telefonoPersonal,
				},
			})
		}

		// Si no se encuentra el usuario, lanzar un error
		if (!user) {
			throw new Error('No se encontró ningún usuario con los datos proporcionados.')
		} else {
			console.log('Usuario encontrado:', user)
		}

		// Comparar y agregar a updatedData solo los campos que han cambiado
		if (user.nombre !== nombre) {
			const updatedUser = await prisma.informacionUsuario.update({
				where: { idUsuario: user.idUsuario },
				data: { nombre: nombre },
			})
			return updatedUser
		}
		if (user.apellido !== apellido) {
			const updatedUser = await prisma.informacionUsuario.update({
				where: { idUsuario: user.idUsuario },
				data: { apellido: apellido },
			})
			return updatedUser
		}
		if (user.correo !== correo) {
			const updatedUser = await prisma.informacionUsuario.update({
				where: { idUsuario: user.idUsuario },
				data: { correo: correo },
			})
			return updatedUser
		}
		if (user.tipoDocumento !== tipoDocumento) {
			const updatedUser = await prisma.informacionUsuario.update({
				where: { idUsuario: user.idUsuario },
				data: { tipoDocumento: tipoDocumento },
			})
			return updatedUser
		}
		if (user.documento !== documento) {
			const updatedUser = await prisma.informacionUsuario.update({
				where: { idUsuario: user.idUsuario },
				data: { documento: documento },
			})
			return updatedUser
		}
		if (user.telefonoPersonal !== telefonoPersonal) {
			const updatedUser = await prisma.informacionUsuario.update({
				where: { idUsuario: user.idUsuario },
				data: { telefonoPersonal: telefonoPersonal },
			})
			return updatedUser
		}
	} catch (error) {
		console.error('Error al editar el usuario:', error)
		throw new Error('Hubo un problema al editar el usuario.')
	}
}

//---------------------------------------------------------------------------------------------------------

export const editWebPracticante = async (
	nombre,
	documento,
	tipoDocumento,
	genero,
	estrato,
	barrio,
	localidad
) => {
	try {
		const pract = await prisma.practicante.update({
			where: {
				numero_documento: documento,
			},
			data: {
				nombre: nombre,
				tipo_documento: tipoDocumento,
				genero: genero,
				estrato: estrato,
				barrio: barrio,
				localidad: localidad,
			},
		})
		return pract
	} catch (error) {
		console.error('Error al editar el practicante:', error)
		throw new Error('Hubo un problema al editar el practicante.')
	}
}

//---------------------------------------------------------------------------------------------------------

export const citaWebCheckout = async (idCita) => {
	try {
		const cita = await prisma.cita.update({
			where: {
				idCita: idCita,
			},
			data: {
				estado: 'completada',
			},
		})
		return cita
	} catch (error) {
		console.error('Error al cambiar estado de la cita:', error)
		throw new Error('Hubo un problema al crear la cita.')
	}
}

//---------------------------------------------------------------------------------------------------------

export const getWebConsultorios = async () => {
	try {
		const consultorios = await prisma.consultorio.findMany()
		return consultorios
	} catch (error) {
		console.error('Error al obtener los consultorios:', error)
		throw new Error('Hubo un problema al obtener los consultorios.')
	}
}

//---------------------------------------------------------------------------------------------------------

export const ChangeWebConsultorio = async (idConsultorio) => {
	try {
		const consultorio = await prisma.consultorio.update({
			where: {
				idConsultorio: idConsultorio,
			},
			data: {
				activo: 0,
			},
		})
		return consultorio
	} catch (error) {
		console.error('Error al cambiar estado del consultorio:', error)
		throw new Error('Hubo un problema al cambiar estado del consultorio.')
	}
}

//---------------------------------------------------------------------------------------------------------

export const getWebCitas = async (diaActual) => {
	try {
		const citas = await prisma.cita.findMany({
			where: {
				fechaHora: diaActual,
			},
		})
		return citas
	} catch (error) {
		console.error('Error al obtener las citas:', error)
		throw new Error('Hubo un problema al obtener las citas.')
	}
}

//---------------------------------------------------------------------------------------------------------

export const citasPorPaciente = async (idPaciente) => {
	try {
		const citas = await prisma.cita.findMany({
			where: {
				idPaciente: idPaciente,
			},
		})
		return citas
	} catch (error) {
		console.error('Error al obtener las citas:', error)
		throw new Error('Hubo un problema al obtener las citas.')
	}
}

//---------------------------------------------------------------------------------------------------------

export const eliminarCita = async (id) => {
	try {
		const cita = await prisma.cita.deleteMany({
			where: {
				idUsuario: id,
			},
		})
		return cita
	} catch (error) {
		console.error('Error al eliminar la Cita:', error)
		throw new Error('Hubo un problema al eliminar la Cita.')
	}
}

//---------------------------------------------------------------------------------------------------------

export const obtenerPracticante = async (idPracticante) => {
	try {
		const practicante = await prisma.practicante.findUnique({
			where: {
				idPracticante: idPracticante,
			},
		})
		return practicante
	} catch (error) {
		console.error('Error al obtener el Practicante:', error)
		throw new Error('Hubo un problema al obtener el Practicante.')
	}
}

//---------------------------------------------------------------------------------------------------------

// Función para obtener el teléfono del practicante asignado a un paciente
export const obtenerTelefonoPracticante = async (telefonoPaciente) => {
	try {
		console.log(`🔍 DEBUG: Buscando practicante para paciente: ${telefonoPaciente}`);

		const soloNumeros = String(telefonoPaciente || '').replace(/\D/g, '');
		if (!soloNumeros) {
			console.log('❌ DEBUG: teléfonoPaciente vacío o inválido');
			return null;
		}

		const telefonoConPrefijo = soloNumeros.startsWith('57') ? soloNumeros : `57${soloNumeros}`;
		const telefonoSinPrefijo = soloNumeros.startsWith('57') ? soloNumeros.slice(2) : soloNumeros;
		const candidatos = [...new Set([telefonoConPrefijo, telefonoSinPrefijo])];

		let paciente = null;
		for (const telefono of candidatos) {
			paciente = await prisma.informacionUsuario.findUnique({
				where: { telefonoPersonal: telefono },
				select: { practicanteAsignado: true, primerNombre: true, primerApellido: true }
			});

			if (paciente) {
				console.log(`✅ DEBUG: Paciente encontrado con formato: ${telefono}`);
				break;
			}
		}

		console.log(`🔍 DEBUG: Paciente encontrado:`, paciente);

		if (!paciente?.practicanteAsignado) {
			console.log(`❌ DEBUG: No hay practicante asignado para ${telefonoPaciente}`);
			return null;
		}

		// Desde ahora practicanteAsignado debe ser SIEMPRE idPracticante
		const practicanteAsignado = paciente.practicanteAsignado;
		console.log(`🔍 DEBUG: Buscando practicante con ID: ${practicanteAsignado}`);

		const practicante = await prisma.practicante.findUnique({
			where: { idPracticante: practicanteAsignado },
			select: { telefono: true, nombre: true }
		});

		console.log(`🔍 DEBUG: Practicante encontrado:`, practicante);

		if (practicante?.telefono) {
			console.log(`✅ DEBUG: Teléfono del practicante (desde BD): ${practicante.telefono}`);
			const telefonoConPrefijo = practicante.telefono.startsWith('57') ? practicante.telefono : `57${practicante.telefono}`;
			return telefonoConPrefijo;
		} else {
			console.log(`❌ DEBUG: Practicante no encontrado por idPracticante o sin teléfono`);
			return null;
		}
	} catch (error) {
		console.error('❌ DEBUG: Error obteniendo teléfono del practicante:', error);
		return null;
	}
}

//---------------------------------------------------------------------------------------------------------

export const guardarPracticanteAsignado = async (numeroUsuario, numeroPracticante) => {
	try {
		const telefonoPracticante = String(numeroPracticante || '').replace(/\D/g, '');
		if (!telefonoPracticante) {
			throw new Error('Número de practicante inválido');
		}

		const telefonoPracticanteConPrefijo = telefonoPracticante.startsWith('57')
			? telefonoPracticante
			: `57${telefonoPracticante}`;
		const telefonoPracticanteSinPrefijo = telefonoPracticanteConPrefijo.slice(2);

		const practicante = await prisma.practicante.findFirst({
			where: {
				telefono: {
					in: [telefonoPracticanteConPrefijo, telefonoPracticanteSinPrefijo],
				},
			},
			select: { idPracticante: true, telefono: true },
		});

		if (!practicante) {
			throw new Error('No se encontró un practicante con ese número');
		}

		const telefonoUsuario = String(numeroUsuario || '').replace(/\D/g, '');
		const telefonoUsuarioConPrefijo = telefonoUsuario.startsWith('57') ? telefonoUsuario : `57${telefonoUsuario}`;
		const telefonoUsuarioSinPrefijo = telefonoUsuarioConPrefijo.slice(2);

		const result = await prisma.informacionUsuario.updateMany({
			where: {
				telefonoPersonal: {
					in: [telefonoUsuarioConPrefijo, telefonoUsuarioSinPrefijo],
				},
			},
			data: { practicanteAsignado: practicante.idPracticante },
		});

		if (result.count === 0) {
			throw new Error('No se encontró el usuario para guardar el practicante asignado');
		}

		return {
			telefonoUsuario: telefonoUsuarioConPrefijo,
			idPracticante: practicante.idPracticante,
			telefonoPracticante: practicante.telefono,
		};
	} catch (error) {
		console.error('Error guardando practicante asignado:', error);
		throw new Error('Hubo un problema guardando el practicante asignado.');
	}
};

//---------------------------------------------------------------------------------------------------------

// Función para obtener los resultados de tests de un paciente específico
export const obtenerResultadosPaciente = async (telefonoPaciente) => {
	try {
		console.log(`🔍 Obteniendo resultados para paciente: ${telefonoPaciente}`);
		
		// Normalizar el número de teléfono - probar ambos formatos
		const soloNumeros = (telefonoPaciente || '').replace(/\D/g, '');
		const telefonoSinPrefijo = soloNumeros.startsWith('57') ? soloNumeros.substring(2) : soloNumeros;
		const telefonoConPrefijo = soloNumeros.startsWith('57') ? soloNumeros : `57${soloNumeros}`;
		
		console.log(`🔍 DEBUG: Número original: ${telefonoPaciente}`);
		console.log(`🔍 DEBUG: Solo números: ${soloNumeros}`);
		console.log(`🔍 DEBUG: Sin prefijo: ${telefonoSinPrefijo}`);
		console.log(`🔍 DEBUG: Con prefijo: ${telefonoConPrefijo}`);
		
		// Buscar paciente con ambos formatos
		let paciente = await prisma.informacionUsuario.findUnique({
			where: { telefonoPersonal: telefonoConPrefijo },
			select: {
				primerNombre: true,
				primerApellido: true,
				telefonoPersonal: true,
				fechaCreacion: true
			}
		});
		
		// Si no se encuentra con prefijo, buscar sin prefijo
		if (!paciente) {
			console.log(`🔍 DEBUG: No encontrado con prefijo, buscando sin prefijo: ${telefonoSinPrefijo}`);
			paciente = await prisma.informacionUsuario.findUnique({
				where: { telefonoPersonal: telefonoSinPrefijo },
				select: {
					primerNombre: true,
					primerApellido: true,
					telefonoPersonal: true,
					fechaCreacion: true
				}
			});
		}

		if (!paciente) {
			console.log(`❌ DEBUG: Paciente no encontrado con ningún formato`);
			return null;
		}
		
		console.log(`✅ DEBUG: Paciente encontrado:`, paciente);
		const telefonoFinal = paciente.telefonoPersonal;

		// Obtener resultados de GHQ-12
		console.log(`🔍 DEBUG: Buscando GHQ-12 para: ${telefonoFinal}`);
		const resultadosGHQ12 = await prisma.ghq12.findUnique({
			where: { telefono: telefonoFinal },
			select: {
				Puntaje: true,
				resPreg: true,
				preguntaActual: true
			}
		});

		// Obtener resultados de DASS-21
		const resultadosDASS21 = await prisma.dass21.findUnique({
			where: { telefono: telefonoFinal },
			select: {
				puntajeDep: true,
				puntajeAns: true,
				puntajeEstr: true,
				resPreg: true,
				respuestas: true,
				preguntaActual: true
			}
		});

		return {
			paciente,
			ghq12: resultadosGHQ12,
			dass21: resultadosDASS21
		};
	} catch (error) {
		console.error('Error obteniendo resultados del paciente:', error);
		throw new Error('Hubo un problema obteniendo los resultados del paciente.');
	}
};

//---------------------------------------------------------------------------------------------------------
export const resetearEstadoPrueba = async (telefono, tipoTest) => {
	try{
		const modelo = seleccionarModelo(tipoTest);
		console.log(`🫡 Se intenta resetear el estado para ${telefono} en ${tipoTest}`)
		const registroExistente = await modelo.findUnique({
			where: { telefono },
		})

		if(!registroExistente){
			console.log(`❌ No existe registro previo para ${telefono} en ${tipoTest}`)
			return;
		} else if (tipoTest === 'ghq12'){
			await modelo.update({
				where: { telefono },
				data: ({
					Puntaje: 0,
					preguntaActual: 0,
					resPreg: {},
				})
			})
		} else if (tipoTest === 'dass21'){
			await modelo.update({
				where: { telefono },
				data: ({
					puntajeAns: 0,
					puntajeDep: 0,
					puntajeEstr: 0,
					preguntaActual: 0,
					resPreg: 0,
					respuestas: [],
				})
			})
		}
		console.log(`✅ El estado se reseteó correctamente para ${telefono} en ${tipoTest}`)

	} catch (error) {
		console.error(`❌ No se pudo resetear correctamente el estado para ${telefono} en ${tipoTest}`)
	}
}

//---------------------------------------------------------------------------------------------------------

// Función para obtener lista de pacientes asignados a un practicante
export const obtenerPacientesAsignados = async (idPracticante) => {
	try {
		console.log(`🔍 Obteniendo pacientes para practicante: ${idPracticante}`);
		
		const pacientes = await prisma.informacionUsuario.findMany({
			where: { practicanteAsignado: idPracticante },
			select: {
				primerNombre: true,
				primerApellido: true,
				telefonoPersonal: true,
				fechaCreacion: true
			},
			orderBy: {
				fechaCreacion: 'desc'
			}
		});

		return pacientes;
	} catch (error) {
		console.error('Error obteniendo pacientes asignados:', error);
		throw new Error('Hubo un problema obteniendo los pacientes asignados.');
	}
};

//---------------------------------------------------------------------------------------------------------

export const guardarResultadoPrueba = async (telefono, tipoTest, datosResultados) => {
	try{
		console.log(`🫡 Guardando prueba ${tipoTest} para usuario ${telefono}`)

		// Obtener usuario en BD
		const usuario = await prisma.informacionUsuario.findUnique({
			where: { telefonoPersonal: telefono },
			select: { idUsuario: true },
		});
		if (!usuario){
			console.log(`❌ El usuario con telefono ${telefono} no se encuentra en la base de datos`)
			return;
		}

		// Se crea el registro en la BD
		await prisma.historialTest.create({
			data: {
				usuarioId: usuario.idUsuario,
				tipoTest: tipoTest,
				resultados: datosResultados,
			}
		})
		console.log(`✅ Los resultados para ${telefono} en ${tipoTest} fueron guardados con éxito`)
	} catch (error){
		console.error(`❌ Error al guardar resultado para ${telefono} en ${tipoTest}:`, error);
	}
};

//---------------------------------------------------------------------------------------------------------
// Configuración RAG Unificada para Tests Psicológicos

/**
 * Obtiene la configuración general del RAG para tests psicológicos
 */
export const getRagPsychologicalConfig = async () => {
	try {
		const config = await prisma.ragPsychologicalConfig.findUnique({
			where: { id: 'general' }
		});

		if (!config) {
			throw new Error('Configuración RAG general no encontrada. Necesita inicializar el sistema.');
		}

		return config;
	} catch (error) {
		console.error('❌ Error al obtener configuración RAG:', error);
		throw new Error('Error al obtener configuración del sistema RAG.');
	}
};

/**
 * Inicializa o actualiza la configuración general del RAG con los prompts proporcionados
 */
export const initializeRagPsychologicalConfig = async (systemInstructions, promptTemplate, metadata = {}) => {
	try {
		const config = await prisma.ragPsychologicalConfig.upsert({
			where: { id: 'general' },
			update: {
				systemInstructions,
				promptTemplate,
				metadata,
				version: metadata.version || '1.0'
			},
			create: {
				id: 'general',
				systemInstructions,
				promptTemplate,
				metadata,
				version: metadata.version || '1.0'
			}
		});

		console.log('✅ Configuración RAG inicializada exitosamente');
		return config;
	} catch (error) {
		console.error('❌ Error al inicializar configuración RAG:', error);
		throw new Error('Error al inicializar configuración del sistema RAG.');
	}
};

/**
 * Actualiza la versión de la configuración RAG
 */
export const updateRagPsychologicalConfigVersion = async (newVersion) => {
	try {
		const config = await prisma.ragPsychologicalConfig.update({
			where: { id: 'general' },
			data: { version: newVersion }
		});

		console.log(`✅ Versión RAG actualizada a ${newVersion}`);
		return config;
	} catch (error) {
		console.error('❌ Error al actualizar versión RAG:', error);
		throw new Error('Error al actualizar versión de configuración RAG.');
	}
};
