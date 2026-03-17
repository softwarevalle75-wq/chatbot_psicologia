const rawApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE = rawApiBase ? rawApiBase.replace(/\/+$/, '') : '/v1/auth';
const rawCoreApiBase = import.meta.env.VITE_CORE_API_BASE_URL?.trim();
const CORE_API_BASE = rawCoreApiBase ? rawCoreApiBase.replace(/\/+$/, '') : '/api';

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

async function coreRequest<T>(
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

  const res = await fetch(`${CORE_API_BASE}${endpoint}`, {
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
    const errorMessage = typeof data === 'object' && data !== null && 'message' in data
      ? (data as { message?: string }).message
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

export type SessionUser = {
  id: string;
  email?: string;
  role: 'admin' | 'practicante' | 'usuario';
  profileId?: string | null;
  primerNombre?: string;
  correo?: string;
  documento?: string;
  consentimientoInformado?: string;
  autorizacionDatos?: string;
  registrationStep?: number;
};

export type PdfRecord = {
  id: string;
  filename: string;
  path: string;
  sizeBytes?: number | null;
  uploadedAt: string;
  patient?: {
    id: string;
    name: string;
    documentNumber?: string | null;
  } | null;
  practitioner?: {
    id: string;
    name: string;
    documentNumber?: string;
  } | null;
};

export const api = {
  register(data: RegisterPayload) {
    return request<{ message: string; userId: string; token: string; user: unknown }>(
      '/register',
      { method: 'POST', body: JSON.stringify(data) },
    );
  },

  async login(correo: string, password: string) {
    try {
      return await coreRequest<{ token: string; user: SessionUser }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ email: correo, password }) },
      );
    } catch {
      const legacy = await request<{ message: string; token: string; user: unknown }>(
        '/login',
        { method: 'POST', body: JSON.stringify({ correo, password }) },
      );

      return {
        token: legacy.token,
        user: {
          ...(legacy.user as Record<string, unknown>),
          role: 'usuario' as const,
        },
      };
    }
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

  getMe() {
    return coreRequest<{ user: SessionUser }>('/auth/me', { method: 'GET' });
  },

  getPdfHistory() {
    return coreRequest<PdfRecord[]>('/pdfs', { method: 'GET' });
  },

  createStudent(data: {
    name: string;
    lastName?: string;
    email: string;
    documentNumber: string;
    documentType?: string;
  }) {
    return coreRequest('/practitioners', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
