class RegisterManager {
    constructor() {
        this.form = document.getElementById('registerForm');
        this.errorDiv = document.getElementById('errorMessage');
        this.successDiv = document.getElementById('successMessage');
        this.loadingDiv = document.getElementById('loading');
        this.registerBtn = document.getElementById('registerBtn');
        this.infoText = document.getElementById('infoText');
        this.formTitle = document.getElementById('formTitle');
        
        this.init();
    }

    init() {
        this.precargarDatos();
        this.setupEventListeners();
    }

    setupEventListeners() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.manejarEnvioFormulario(e));
        }
    }

    getUrlParameters() {
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

    precargarDatos() {
        const datos = this.getUrlParameters();
        let camposPrecargados = 0;
        
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
            const telefonoInput = document.getElementById('telefonoPersonal');
            telefonoInput.value = datos.telefonoPersonal;
            telefonoInput.readOnly = true;
            telefonoInput.style.backgroundColor = '#f8f9fa';
            telefonoInput.style.border = '2px solid #28a745';
            camposPrecargados++;
        }
        
        // Los campos documento y tipoDocumento ya existen en el HTML de forma permanente.
        // Si vienen precargados desde la URL, se rellenan y se marcan como readonly.
        if (datos.documento) {
            const documentoInput = document.getElementById('documento');
            const tipoDocumentoSelect = document.getElementById('tipoDocumento');

            if (documentoInput) {
                documentoInput.value = datos.documento;
                documentoInput.readOnly = true;
                documentoInput.style.backgroundColor = '#f8f9fa';
                documentoInput.style.border = '2px solid #28a745';
                camposPrecargados++;
            }

            if (tipoDocumentoSelect && datos.tipoDocumento) {
                tipoDocumentoSelect.value = datos.tipoDocumento;
                tipoDocumentoSelect.disabled = true;
                // Un select disabled no envía su valor por FormData, así que usamos
                // un input hidden como respaldo para que el dato llegue al backend.
                const hiddenTipo = document.createElement('input');
                hiddenTipo.type = 'hidden';
                hiddenTipo.name = 'tipoDocumento';
                hiddenTipo.value = datos.tipoDocumento;
                tipoDocumentoSelect.parentElement.appendChild(hiddenTipo);
                tipoDocumentoSelect.style.backgroundColor = '#f8f9fa';
                tipoDocumentoSelect.style.border = '2px solid #28a745';
                camposPrecargados++;
            }
        }
        
        if (camposPrecargados > 0) {
            this.actualizarInterfazPrecarga(camposPrecargados);
        }
    }

    actualizarInterfazPrecarga(camposPrecargados) {
        this.infoText.innerHTML = `✨ <strong>Algunos campos han sido precargados desde tu perfil anterior.</strong><br>` +
            `Los campos en verde son precargados y no se pueden editar. ` +
            `Por favor completa los campos restantes para finalizar tu registro.<br><br>` +
            `Campos precargados: ${camposPrecargados}`;
        
        this.infoText.classList.add('highlight');
        this.formTitle.textContent = '🔄 Completar Registro';
        
        const precargadosElements = document.querySelectorAll('input[readonly], select[readonly]');
        precargadosElements.forEach(element => {
            element.parentElement.classList.add('precargado');
        });
    }

    async manejarEnvioFormulario(e) {
        e.preventDefault();
        
        this.ocultarMensajes();
        
        if (!this.validarFormulario()) {
            return;
        }
        
        this.mostrarLoading();
        
        const data = this.obtenerDatosFormulario();
        
        try {
            const result = await this.registrarUsuario(data);
            this.manejarExito(result);
        } catch (error) {
            this.manejarError(error);
        } finally {
            this.ocultarLoading();
        }
    }

    validarFormulario() {
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (password !== confirmPassword) {
            this.mostrarError('Las contraseñas no coinciden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return false;
        }

        const fechaNacimiento = document.getElementById('fechaNacimiento').value;
        if (fechaNacimiento && !this.validarEdad(fechaNacimiento)) {
            this.mostrarError('Debes ser mayor a 15 años para poder registrarte');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return false;
        }
        
        return true;
    }

    validarEdad(fechaNacimiento) {
        const fechaNaci = new Date(fechaNacimiento);
        const hoy = new Date();
        let edad = hoy.getFullYear() - fechaNaci.getFullYear();
        const mes = hoy.getMonth() - fechaNaci.getMonth();

        if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNaci.getDate())) {
            edad--;
        }

        return edad >= 15;
    }

    obtenerDatosFormulario() {
        const formData = new FormData(this.form);
        const pertenece = document.getElementById('perteneceUniversidad');
        
        // documento y tipoDocumento siempre están presentes en el formulario.
        // FormData los recoge directamente (incluyendo el input hidden que se crea
        // cuando el campo select está disabled por precarga desde URL).
        const data = {
            primerNombre: formData.get('primerNombre'),
            segundoNombre: formData.get('segundoNombre'),
            primerApellido: formData.get('primerApellido'),
            segundoApellido: formData.get('segundoApellido'),
            tipoDocumento: formData.get('tipoDocumento'),
            documento: formData.get('documento'),
            correo: formData.get('correo'),
            segundoCorreo: formData.get('segundoCorreo'),
            telefonoPersonal: formData.get('telefonoPersonal'),
            segundoTelefono: formData.get('segundoTelefono'),
            fechaNacimiento: formData.get('fechaNacimiento'),
            perteneceUniversidad: pertenece.checked ? 'Si' : 'No',
            password: formData.get('password')
        };
        
        return data;
    }

    async registrarUsuario(data) {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Error en el registro');
        }
        
        return result;
    }

    manejarExito(result) {
        const data = this.obtenerDatosFormulario();
        
        if (result.token) {
            const userInfo = {
                id: result.userId,
                primerNombre: data.primerNombre,
                primerApellido: data.primerApellido,
                segundoNombre: data.segundoNombre,
                segundoApellido: data.segundoApellido,
                correo: data.correo,
                consentimientoInformado: 'no'
            };
            
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(userInfo));
            
            this.mostrarExito('Registro exitoso. Redirigiendo al tratamiento de datos...');
            
            setTimeout(() => {
                window.location.href = '/tratamientodatos';
            }, 1500);
        } else {
            const userInfo = {
                id: result.userId,
                primerNombre: data.primerNombre,
                primerApellido: data.primerApellido,
                correo: data.correo,
                telefonoPersonal: data.telefonoPersonal
            };
            
            localStorage.setItem('userInfo', JSON.stringify(userInfo));
            
            this.mostrarExito('¡Registro exitoso! Redirigiendo al login...');
            
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        }
        
        this.limpiarUrl();
    }

    manejarError(error) {
        console.error('Error:', error);
        this.mostrarError(error.message || 'Error al registrar usuario');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    mostrarLoading() {
        this.loadingDiv.style.display = 'block';
        this.registerBtn.disabled = true;
    }

    ocultarLoading() {
        this.loadingDiv.style.display = 'none';
        this.registerBtn.disabled = false;
    }

    mostrarError(mensaje) {
        this.errorDiv.textContent = mensaje;
        this.errorDiv.style.display = 'block';
    }

    mostrarExito(mensaje) {
        this.successDiv.textContent = mensaje;
        this.successDiv.style.display = 'block';
    }

    ocultarMensajes() {
        this.errorDiv.style.display = 'none';
        this.successDiv.style.display = 'none';
    }

    limpiarUrl() {
        if (window.location.search) {
            const url = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({}, document.title, url);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new RegisterManager();
});

window.precargarDatos = function() {
    const manager = new RegisterManager();
    manager.precargarDatos();
};

window.limpiarUrl = function() {
    if (window.location.search) {
        const url = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({}, document.title, url);
    }
};
