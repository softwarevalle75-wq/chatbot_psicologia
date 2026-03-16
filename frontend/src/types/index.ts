// ── Chat types ──────────────────────────────────────────────
export type MessageSender = 'bot' | 'user';

export interface Message {
  id: string;
  sender: MessageSender;
  content: string;
  timestamp: string;
}

// ── Registration types ──────────────────────────────────────

export interface Step1Data {
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  tipoDocumento: string;
  documento: string;
  sexo: string;
  identidadGenero: string;
  orientacionSexual: string;
  etnia: string;
  discapacidad: string;
  discapacidadDetalle: string;
  correo: string;
  telefonoPersonal: string;
  fechaNacimiento: string;
  perteneceUniversidad: string;
  esAspirante: boolean;
  carrera: string;
  jornada: string;
  semestre: string;
  password: string;
  confirmPassword: string;
}

export interface Step2Data {
  autorizacionDatos: boolean;
}

export interface Step3Data {
  estadoCivil: string;
  numeroHijos: number;
  numeroHermanos: number;
  rolFamiliar: string[];
  conQuienVive: string;
  tienePersonasACargo: string;
  personasACargoQuien: string;
  escolaridad: string;
  ocupacion: string;
  nivelIngresos: string;
}

export interface Step4Data {
  consentimientoInformado: boolean;
}

export interface RegistrationData {
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  step4: Step4Data;
}

// ── Auth types ──────────────────────────────────────────────

export interface AuthUser {
  id: string;
  primerNombre: string;
  correo: string;
  documento: string;
  consentimientoInformado: string;
  autorizacionDatos: string;
  registrationStep: number;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  correo: string;
  password: string;
}

export interface RegisterResponse {
  message: string;
  userId: string;
  token: string;
  user: AuthUser;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: AuthUser;
}
