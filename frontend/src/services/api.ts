/**
 * Servicio API del frontend.
 * Apunta a /api/auth/ (backend nuevo en puerto 3001).
 * En dev, Vite proxy redirige /api → http://localhost:3001.
 */

const rawApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE   = rawApiBase ? rawApiBase.replace(/\/+$/, "") : "/api/auth";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const raw = await res.text();

  let data: unknown = {};
  if (raw) {
    try { data = JSON.parse(raw); }
    catch { throw new Error("Respuesta inválida del servidor"); }
  }

  if (!res.ok) {
    // Extrae mensaje del backend (campo "message" o "error")
    const msg =
      typeof data === "object" && data !== null
        ? (data as Record<string, string>).message ?? (data as Record<string, string>).error
        : undefined;
    throw new Error(msg || "Error en la solicitud");
  }

  return data as T;
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface RegisterPayload {
  primerNombre:    string;
  segundoNombre?:  string;
  primerApellido:  string;
  segundoApellido: string;
  tipoDocumento:   string;
  documento:       string;
  sexo:            string;
  identidadGenero:   string;
  orientacionSexual: string;
  etnia:             string;
  discapacidad:      string;
  discapacidadDetalle?: string;
  correo:            string;
  telefonoPersonal:  string;
  fechaNacimiento:   string;
  perteneceUniversidad: string;
  esAspirante?:      boolean;
  carrera?:          string;
  jornada?:          string;
  semestre?:         number;
  password:          string;
}

export interface SociodemograficoPayload {
  estadoCivil:         string;
  numeroHijos:         number;
  numeroHermanos:      number;
  rolFamiliar:         string[];
  conQuienVive:        string;
  tienePersonasACargo: string;
  personasACargoQuien?: string;
  escolaridad:         string;
  ocupacion:           string;
  nivelIngresos:       string;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export const api = {
  /** Registro paso 1: datos personales */
  register(data: RegisterPayload) {
    return request<{ message: string; userId: string; token: string; user: unknown }>(
      "/register",
      { method: "POST", body: JSON.stringify(data) }
    );
  },

  /**
   * Login unificado.
   * El backend espera { email, password }.
   * El frontend puede llamar con correo — se mapea aquí.
   */
  login(correo: string, password: string) {
    return request<{ message: string; token: string; user: unknown }>(
      "/login",
      { method: "POST", body: JSON.stringify({ email: correo, password }) }
    );
  },

  /** Paso 2: autorización de tratamiento de datos */
  saveTratamientoDatos() {
    return request<{ message: string }>(
      "/tratamiento-datos",
      { method: "POST", body: JSON.stringify({ autorizacionDatos: "si" }) }
    );
  },

  /** Paso 3: datos sociodemográficos */
  saveSociodemografico(data: SociodemograficoPayload) {
    return request<{ message: string }>(
      "/sociodemografico",
      { method: "POST", body: JSON.stringify(data) }
    );
  },

  /** Paso 4: consentimiento informado */
  saveConsentimiento() {
    return request<{ message: string }>(
      "/consentimiento",
      { method: "POST", body: JSON.stringify({ consentimientoInformado: "si" }) }
    );
  },

  /** Verifica estado del registro y sesión activa */
  checkStatus() {
    return request<{ registrationStep: number; user: unknown }>(
      "/check-status",
      { method: "GET" }
    );
  },
};
