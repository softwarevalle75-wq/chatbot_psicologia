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
        
        if (datos.documento && !document.getElementById('documento')) {
            this.agregarCamposDocumento(datos);
            camposPrecargados += 2;
        }
        
        if (camposPrecargados > 0) {
            this.actualizarInterfazPrecarga(camposPrecargados);
        }
    }

    agregarCamposDocumento(datos) {
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
        
        this.form.insertBefore(documentoRow, passwordGroup);
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
        
        const documentoInput = document.getElementById('documento');
        if (documentoInput) {
            data.documento = formData.get('documento');
            data.tipoDocumento = formData.get('tipoDocumento');
        }
        
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
