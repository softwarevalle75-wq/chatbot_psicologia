// Función para obtener parámetros de la URL
function getUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        primerNombre: urlParams.get('primerNombre'),
        segundoNombre: urlParams.get('segundoNombre'),
        primerApellido: urlParams.get('primerApellido'),
        segundoApellido: urlParams.get('segundoApellido'),
        telefonoPersonal: urlParams.get('telefonoPersonal'),
        documento: urlParams.get('documento'),
        tipoDocumento: urlParams.get('tipoDocumento')
    };
}

// Función para precargar datos en el formulario
function precargarDatos() {
    const datos = getUrlParameters();
    let camposPrecargados = 0;
    
    // Precargar nombres
    if (datos.primerNombre) {
        document.getElementById('primerNombre').value = datos.primerNombre;
        camposPrecargados++;
    }
    
    if (datos.segundoNombre) {
        document.getElementById('segundoNombre').value = datos.segundoNombre;
        camposPrecargados++;
    }
    
    if (datos.primerApellido) {
        document.getElementById('primerApellido').value = datos.primerApellido;
        camposPrecargados++;
    }
    
    if (datos.segundoApellido) {
        document.getElementById('segundoApellido').value = datos.segundoApellido;
        camposPrecargados++;
    }
    
    if (datos.telefonoPersonal) {
        document.getElementById('telefonoPersonal').value = datos.telefonoPersonal;
        // Marcar como readonly o disabled con indicación visual
        const telefonoInput = document.getElementById('telefonoPersonal');
        telefonoInput.readOnly = true;
        telefonoInput.style.backgroundColor = '#f8f9fa';
        telefonoInput.style.border = '2px solid #28a745';
        camposPrecargados++;
    }
    
    // Agregar campo de documento si no existe
    if (datos.documento && !document.getElementById('documento')) {
        const form = document.getElementById('registerForm');
        const passwordGroup = document.getElementById('password').parentElement;
        
        const documentoRow = document.createElement('div');
        documentoRow.className = 'form-row';
        documentoRow.innerHTML = `
            <div class="form-group">
                <label for="documento">Número de Documento</label>
                <input type="text" id="documento" name="documento" value="${datos.documento}" readonly style="background-color: #f8f9fa; border: 2px solid #28a745;">
            </div>
            <div class="form-group">
                <label for="tipoDocumento">Tipo de Documento</label>
                <select id="tipoDocumento" name="tipoDocumento" readonly style="background-color: #f8f9fa; border: 2px solid #28a745;">
                    <option value="CC" ${datos.tipoDocumento === 'CC' ? 'selected' : ''}>Cédula de Ciudadanía</option>
                    <option value="CE" ${datos.tipoDocumento === 'CE' ? 'selected' : ''}>Cédula de Extranjería</option>
                    <option value="TI" ${datos.tipoDocumento === 'TI' ? 'selected' : ''}>Tarjeta de Identidad</option>
                    <option value="PA" ${datos.tipoDocumento === 'PA' ? 'selected' : ''}>Pasaporte</option>
                </select>
            </div>
        `;
        
        form.insertBefore(documentoRow, passwordGroup);
        camposPrecargados += 2;
    }
    
    // Mostrar mensaje si hay datos precargados
    if (camposPrecargados > 0) {
        const infoText = document.querySelector('.info-text p');
        infoText.innerHTML = `✨ <strong>Algunos campos han sido precargados desde tu perfil anterior.</strong><br>` +
            `Los campos en verde son precargados y no se pueden editar. ` +
            `Por favor completa los campos restantes para finalizar tu registro.<br><br>` +
            `Campos precargados: ${camposPrecargados}`;
        
        // Cambiar el título del formulario
        document.querySelector('h1').textContent = '🔄 Completar Registro';
        
        // Resaltar campos precargados
        const precargadosElements = document.querySelectorAll('input[readonly], select[readonly]');
        precargadosElements.forEach(element => {
            element.parentElement.style.backgroundColor = '#e8f5e8';
            element.parentElement.style.padding = '15px';
            element.parentElement.style.borderRadius = '8px';
        });
    }
}

// Función para limpiar URL de parámetros
function limpiarUrl() {
    if (window.location.search) {
        const url = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({}, document.title, url);
    }
}

// Modificar el envío del formulario para incluir documento si existe
function manejarEnvioFormulario(e) {
    e.preventDefault();
    
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    const loadingDiv = document.getElementById('loading');
    const registerBtn = document.getElementById('registerBtn');
    
    // Ocultar mensajes previos
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    // Validar contraseñas
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (password !== confirmPassword) {
        errorDiv.textContent = 'Las contraseñas no coinciden';
        errorDiv.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    // Validar edad mínima 15 años
    const fechaNacimiento = document.getElementById('fechaNacimiento').value;
    if (fechaNacimiento) {
        const fechaNaci = new Date(fechaNacimiento);
        const hoy = new Date();
        let edad = hoy.getFullYear() - fechaNaci.getFullYear();
        const mes = hoy.getMonth() - fechaNaci.getMonth();

        if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNaci.getDate())){
            edad--;
        }

        if (edad < 15){
            errorDiv.textContent = "Debes ser mayor a 15 años para poder registrarte";
            errorDiv.style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
    }
    
    // Mostrar loading
    loadingDiv.style.display = 'block';
    registerBtn.disabled = true;
    
    const pertenece = document.getElementById('perteneceUniversidad');
    const formData = new FormData(e.target);
    
    const data = {
        primerNombre: formData.get('primerNombre'),
        segundoNombre: formData.get('segundoNombre'),
        primerApellido: formData.get('primerApellido'),
        segundoApellido: formData.get('segundoApellido'),
        correo: formData.get('correo'),
        segundoCorreo: formData.get('segundoCorreo'),
        telefonoPersonal: formData.get('telefonoPersonal'),
        segundoTelefono: formData.get('segundoTelefono'),
        fechaNacimiento: formData.get('fechaNacimiento'),
        perteneceUniversidad: pertenece.checked ? 'Si' : 'No',              
        password: formData.get('password')
    };
    
    // Agregar documento si existe
    const documentoInput = document.getElementById('documento');
    if (documentoInput) {
        data.documento = formData.get('documento');
        data.tipoDocumento = formData.get('tipoDocumento');
    }
    
    // Enviar solicitud
    registrarUsuario(data, errorDiv, successDiv, loadingDiv, registerBtn);
}

// Función para registrar usuario
async function registrarUsuario(data, errorDiv, successDiv, loadingDiv, registerBtn) {
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        console.log('Respuesta del servidor:', result);
        
        if (response.ok) {
            // Guardar información básica del usuario en localStorage
            const userInfo = {
                id: result.userId,
                primerNombre: data.primerNombre,
                primerApellido: data.primerApellido,
                correo: data.correo,
                telefonoPersonal: data.telefonoPersonal
            };
            localStorage.setItem('userInfo', JSON.stringify(userInfo));
            
            successDiv.textContent = '¡Registro exitoso! Redirigiendo al login...';
            successDiv.style.display = 'block';
            errorDiv.style.display = 'none';
            loadingDiv.style.display = 'none';
            
            // Limpiar URL de parámetros
            limpiarUrl();
            
            // Redirigir después de 2 segundos
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
            
        } else {
            throw new Error(result.error || 'Error en el registro');
        }
    } catch (error) {
        console.error('Error completo:', error);
        errorDiv.textContent = error.message || 'Error al registrar usuario';
        errorDiv.style.display = 'block';
        successDiv.style.display = 'none';
        loadingDiv.style.display = 'none';
        registerBtn.disabled = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    // Precargar datos si existen
    precargarDatos();
    
    // Agregar evento de envío al formulario
    const form = document.getElementById('registerForm');
    if (form) {
        form.removeEventListener('submit', manejarEnvioFormulario);
        form.addEventListener('submit', manejarEnvioFormulario);
    }
});

// Exportar funciones para uso externo
window.precargarDatos = precargarDatos;
window.limpiarUrl = limpiarUrl;