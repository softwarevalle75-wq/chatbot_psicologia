const rawApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE = rawApiBase ? rawApiBase.replace(/\/+$/, '') : '/v1/auth';
const rawCoreApiBase = import.meta.env.VITE_CORE_API_BASE_URL?.trim();
const CORE_API_BASE = rawCoreApiBase ? rawCoreApiBase.replace(/\/+$/, '') : '/v1';

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
    const errorMessage = typeof data === 'object' && data !== null
      ? ((data as { error?: string; message?: string }).error || (data as { error?: string; message?: string }).message)
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
    const errorMessage = typeof data === 'object' && data !== null
      ? ((data as { error?: string; message?: string }).error || (data as { error?: string; message?: string }).message)
      : undefined;
    throw new Error(errorMessage || 'Error en la solicitud');
  }

  return data as T;
}

// ── Dashboard types ─────────────────────────────────────────

export type DashboardPeriod = 'week' | 'month' | 'year';

export interface DashboardSummary {
  period: DashboardPeriod;
  totalPatients: number;
  newPatientsThisPeriod: number;
  totalAppointments: number;
  pendingAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  rescheduledAppointments: number;
  highRiskAlerts: number;
  testsCompleted: number;
  activePractitioners: number;
  trends: {
    patients: number;
    appointments: number;
    alerts: number;
    tests: number;
  };
  averages: {
    anxiety: number;
    depression: number;
    stress: number;
  };
  activityData: Array<{ name: string; value: number }>;
  growthData: Array<{ name: string; value: number }>;
  riskDistribution: Array<{ name: string; value: number; color: string }>;
  psychEventsDistribution: Array<{ type: string; name: string; value: number; color: string }>;
  patientStateDistribution: Array<{ name: string; value: number; color: string }>;
  patientFlowDistribution: Array<{ name: string; value: number; color: string }>;
  appointmentsByStatus: Array<{ name: string; value: number; color: string }>;
  ghq12Distribution: Array<{ name: string; value: number; color: string }>;
  ghq12Subscales: Array<{ name: string; items: string; average: number; maxPossible: number }>;
  ghq12Averages: { averageScore: number; averageMentalHealth: number; totalEvaluations: number };
  dass21Distribution: Array<{ name: string; value: number; color: string }>;
  dass21Subscales: Array<{ name: string; items: string; average: number; maxPossible: number; levels: Record<string, number> }>;
  dass21Averages: { depression: number; anxiety: number; stress: number; totalEvaluations: number };
  testsByType: Array<{ name: string; completed: number; pending: number }>;
  practitionerWorkload: Array<{ id: string; name: string; patients: number; appointments: number }>;
}

// ── New Dashboard Data (v2 endpoint) ────────────────────────

export interface DashboardData {
  overview: {
    totalPatients: number;
    totalGHQ12: number;
    totalDASS21: number;
    activePractitioners: number;
    patientsAtRisk: number;
    riskPercentage: number;
  };
  ghq12: {
    totalTests: number;
    averageScore: number;
    riskDistribution: Array<{ level: string; count: number; percentage: number; color: string }>;
    scoreHistogram: Array<{ score: number; count: number }>;
    subscales: Record<string, { avg: number; label: string }>;
    byDay: Array<{ date: string; count: number; avgScore: number }>;
  };
  dass21: {
    totalTests: number;
    averages: { depression: number; anxiety: number; stress: number };
    depression: { distribution: Array<{ level: string; count: number; percentage: number; color: string }> };
    anxiety: { distribution: Array<{ level: string; count: number; percentage: number; color: string }> };
    stress: { distribution: Array<{ level: string; count: number; percentage: number; color: string }> };
    byDay: Array<{ date: string; count: number; avgDep: number; avgAnx: number; avgStr: number }>;
  };
  sociodemographic: {
    totalRecords: number;
    sex: Array<{ label: string; count: number; pct: number }>;
    ageRanges: Array<{ range: string; count: number }>;
    civilStatus: Array<{ status: string; count: number }>;
    education: Array<{ level: string; count: number }>;
    income: Array<{ level: string; count: number }>;
    occupation: Array<{ type: string; count: number }>;
    sexualOrientation: Array<{ orientation: string; count: number }>;
    ethnicity: Array<{ group: string; count: number }>;
    disability: { yes: number; no: number };
    university: {
      belongs: number;
      doesNotBelong: number;
      topCareers: Array<{ career: string; count: number }>;
      schedule: Array<{ type: string; count: number }>;
    };
    // Academic data merged into sociodemographic
    topCareers: Array<{ career: string; count: number }>;
    jornada: Array<{ type: string; count: number }>;
    semestre: Array<{ semestre: string; count: number }>;
  };
  crossTabs: {
    ghq12BySex: Array<{ sex: string; atRisk: number; noRisk: number; total: number; riskPct: number; avgScore: number }>;
    ghq12ByAge: Array<{ range: string; atRisk: number; total: number; riskPct: number; avgScore: number }>;
    ghq12ByCivilStatus: Array<{ status: string; atRisk: number; total: number; riskPct: number; avgScore: number }>;
    ghq12ByIncome: Array<{ level: string; atRisk: number; total: number; riskPct: number; avgScore: number }>;
    ghq12ByCareer: Array<{ career: string; atRisk: number; total: number; riskPct: number; avgScore: number }>;
    ghq12BySemestre: Array<{ semestre: string; atRisk: number; total: number; riskPct: number; avgScore: number }>;
    ghq12ByJornada: Array<{ jornada: string; atRisk: number; total: number; riskPct: number; avgScore: number }>;
  };
  emailTracking: {
    totalEmailsSent: number;
    uniquePatients: number;
    patientsWithoutPractitioner?: number;
    totalPdfsGenerated: { ghq12: number; dass21: number };
    ccRecipient: string;
    byPractitioner: Array<{ name: string; email: string; emailsSent: number; uniquePatients: number }>;
    byDay: Array<{ date: string; count: number }>;
    currentFilter: string;
    byTestType?: {
      soloGhq12: number;
      soloDass21: number;
      ambas: number;
      totalConDass21: number;
      totalConGhq12: number;
    };
  };
}

// ── User dashboard types ────────────────────────────────────

export interface UserTestResult {
  id: string;
  testType: string;
  completedAt: string;
  score: number;
  maxScore: number;
  riskLevel: string;
  summary?: string;
}

export interface UserAppointment {
  id: string;
  date: string;
  time: string;
  practitionerName: string;
  status: 'pendiente' | 'confirmada' | 'completada' | 'cancelada';
  notes?: string;
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
  source?: 'database' | 'email' | string;
  emailMeta?: {
    mailbox: string;
    uid: number;
    attachmentIndex: number;
    part?: string;
    messageId?: string;
  };
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

export type PaginatedPdfResponse = {
  data: PdfRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore?: boolean;
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
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const shouldTryLegacy = message === 'Error en la solicitud'
        || message === 'Respuesta invalida del servidor'
        || /Failed to fetch|NetworkError|fetch/i.test(message);

      if (!shouldTryLegacy) {
        throw error;
      }

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

  getAdminPdfHistory(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    source?: 'all' | 'email' | 'database';
  }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params?.search?.trim()) searchParams.set('search', params.search.trim());
    if (params?.source && params.source !== 'all') searchParams.set('source', params.source);

    const query = searchParams.toString();
    return coreRequest<PaginatedPdfResponse>(`/pdfs${query ? `?${query}` : ''}`, { method: 'GET' });
  },

  syncPdfInbox() {
    return coreRequest<{ synced: number; pdfs: PdfRecord[] }>('/pdfs/sync', {
      method: 'POST',
    });
  },

  async getPdfFile(record: PdfRecord, download = false) {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();

    if ((record.source || '').toLowerCase() === 'email') {
      params.set('source', 'email');
      if (record.emailMeta?.mailbox) params.set('mailbox', record.emailMeta.mailbox);
      if (typeof record.emailMeta?.uid === 'number') params.set('uid', String(record.emailMeta.uid));
      if (typeof record.emailMeta?.attachmentIndex === 'number') {
        params.set('attachmentIndex', String(record.emailMeta.attachmentIndex));
      }
      if (record.emailMeta?.part) {
        params.set('part', record.emailMeta.part);
      }
      params.set('filename', record.filename);
    } else {
      params.set('source', 'database');
      params.set('id', record.id);
      params.set('filename', record.filename);
    }

    if (download) params.set('download', '1');

    const res = await fetch(`${CORE_API_BASE}/pdfs/file?${params.toString()}`, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'No se pudo obtener el PDF');
    }

    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);

    return {
      blob,
      filename: match?.[1] || record.filename || 'documento.pdf',
    };
  },

  getPdfFileUrl(record: PdfRecord, download = false): string {
    const token = localStorage.getItem('token') || '';
    const params = new URLSearchParams();

    if ((record.source || '').toLowerCase() === 'email') {
      params.set('source', 'email');
      if (record.emailMeta?.mailbox) params.set('mailbox', record.emailMeta.mailbox);
      if (typeof record.emailMeta?.uid === 'number') params.set('uid', String(record.emailMeta.uid));
      if (typeof record.emailMeta?.attachmentIndex === 'number') {
        params.set('attachmentIndex', String(record.emailMeta.attachmentIndex));
      }
      if (record.emailMeta?.part) {
        params.set('part', record.emailMeta.part);
      }
      params.set('filename', record.filename);
    } else {
      params.set('source', 'database');
      params.set('id', record.id);
      params.set('filename', record.filename);
    }

    if (download) params.set('download', '1');
    params.set('token', token);

    return `${CORE_API_BASE}/pdfs/file?${params.toString()}`;
  },

  getDashboardSummary(practitionerEmail?: string) {
    const params = practitionerEmail ? `?practicante=${encodeURIComponent(practitionerEmail)}` : '';
    return coreRequest<DashboardData>(
      `/dashboard/summary${params}`,
      { method: 'GET' },
    );
  },

  getUserTestResults() {
    return coreRequest<UserTestResult[]>('/dashboard/my-results', { method: 'GET' }).catch(() => []);
  },

  getUserAppointments() {
    return coreRequest<UserAppointment[]>('/dashboard/my-appointments', { method: 'GET' }).catch(() => []);
  },

  createStudent(data: {
    name: string;
    lastName?: string;
    email: string;
    documentNumber: string;
    documentType?: string;
    gender?: string;
    eps?: string;
    phone?: string;
    clinic?: string;
    startDate?: string;
    endDate?: string;
    active?: boolean;
  }) {
    return coreRequest('/practitioners', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
