const API_BASE = '/v1/auth';

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Error en la solicitud');
  }

  return data as T;
}

// ── Auth endpoints ──────────────────────────────────────────

export interface RegisterPayload {
  primerNombre: string;
  segundoNombre?: string;
  primerApellido: string;
  segundoApellido?: string;
  tipoDocumento: string;
  documento: string;
  genero: string;
  correo: string;
  telefonoPersonal: string;
  fechaNacimiento: string;
  perteneceUniversidad: string;
  esAspirante?: boolean;
  carrera?: string;
  jornada?: string;
  semestre?: number;
  password: string;
}

export interface SociodemograficoPayload {
  estadoCivil: string;
  numeroHijos: number;
  numeroHermanos: number;
  rolFamiliar: string;
  conQuienVive: string;
  tienePersonasACargo: string;
  escolaridad: string;
  ocupacion: string;
  nivelIngresos: string;
}

export const api = {
  register(data: RegisterPayload) {
    return request<{ message: string; userId: string; token: string; user: unknown }>(
      '/register',
      { method: 'POST', body: JSON.stringify(data) },
    );
  },

  login(correo: string, password: string) {
    return request<{ message: string; token: string; user: unknown }>(
      '/login',
      { method: 'POST', body: JSON.stringify({ correo, password }) },
    );
  },

  saveTratamientoDatos(userId: string) {
    return request<{ message: string }>(
      '/tratamiento-datos',
      { method: 'POST', body: JSON.stringify({ userId, autorizacionDatos: 'si' }) },
    );
  },

  saveSociodemografico(userId: string, data: SociodemograficoPayload) {
    return request<{ message: string }>(
      '/sociodemografico',
      { method: 'POST', body: JSON.stringify({ ...data, userId }) },
    );
  },

  saveConsentimiento(userId: string) {
    return request<{ message: string }>(
      '/consentimiento',
      { method: 'POST', body: JSON.stringify({ userId, consentimientoInformado: 'si' }) },
    );
  },

  checkStatus() {
    return request<{
      registrationStep: number;
      user: unknown;
    }>('/check-status', { method: 'GET' });
  },
};
