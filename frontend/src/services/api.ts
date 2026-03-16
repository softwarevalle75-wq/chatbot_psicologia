const rawApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE = rawApiBase ? rawApiBase.replace(/\/+$/, '') : '/v1/auth';

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

  const raw = await res.text();
  let data: unknown = {};

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('Respuesta invalida del servidor');
    }
  }

  if (!res.ok) {
    const errorMessage = typeof data === 'object' && data !== null && 'error' in data
      ? (data as { error?: string }).error
      : undefined;
    throw new Error(errorMessage || 'Error en la solicitud');
  }

  return data as T;
}

// ── Auth endpoints ──────────────────────────────────────────

export interface RegisterPayload {
  primerNombre: string;
  segundoNombre?: string;
  primerApellido: string;
  segundoApellido: string;
  tipoDocumento: string;
  documento: string;
  sexo: string;
  identidadGenero: string;
  orientacionSexual: string;
  etnia: string;
  discapacidad: string;
  discapacidadDetalle?: string;
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
  rolFamiliar: string[];
  conQuienVive: string;
  tienePersonasACargo: string;
  personasACargoQuien?: string;
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

  saveTratamientoDatos() {
    return request<{ message: string }>(
      '/tratamiento-datos',
      { method: 'POST', body: JSON.stringify({ autorizacionDatos: 'si' }) },
    );
  },

  saveSociodemografico(data: SociodemograficoPayload) {
    return request<{ message: string }>(
      '/sociodemografico',
      { method: 'POST', body: JSON.stringify(data) },
    );
  },

  saveConsentimiento() {
    return request<{ message: string }>(
      '/consentimiento',
      { method: 'POST', body: JSON.stringify({ consentimientoInformado: 'si' }) },
    );
  },

  checkStatus() {
    return request<{
      registrationStep: number;
      user: unknown;
    }>('/check-status', { method: 'GET' });
  },
};
