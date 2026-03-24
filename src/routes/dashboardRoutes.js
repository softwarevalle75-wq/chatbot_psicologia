import { prisma } from '../lib/prisma.js';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 16) {
    throw new Error('JWT_SECRET no configurado o demasiado corto (minimo 16 caracteres)');
}

const json = (res, statusCode, data) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

const getTokenPayload = (req) => {
  const header = req.headers?.authorization;
  const queryToken = String(req.query?.token || '').trim();
  const headerToken = header ? (header.startsWith('Bearer ') ? header.slice(7) : header) : '';
  const token = headerToken || queryToken;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
};

const ENV_ADMIN_EMAIL = (process.env.ADMIN_DASHBOARD_EMAIL || '').trim().toLowerCase();

const adminEmailSet = new Set([
  'chatbotpsicologia@gmail.com',
  ...(ENV_ADMIN_EMAIL ? [ENV_ADMIN_EMAIL] : []),
  ...String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean),
]);

const resolveRole = async (user) => {
  const email = String(user?.correo || '').trim().toLowerCase();
  if (adminEmailSet.has(email)) return { role: 'admin', profileId: null };

  const phone = String(user?.telefonoPersonal || '').trim();
  if (!phone) return { role: 'usuario', profileId: null };

  const roleRow = await prisma.rolChat.findUnique({ where: { telefono: phone } }).catch(() => null);
  const role = roleRow?.rol || 'usuario';

  if (role === 'practicante') {
    const pract = await prisma.practicante.findFirst({
      where: { OR: [{ telefono: phone }, { correo: user?.correo || undefined }, { numero_documento: user?.documento || undefined }] },
      select: { idPracticante: true },
    }).catch(() => null);
    return { role, profileId: pract?.idPracticante || null };
  }
  return { role, profileId: null };
};

const requireAuth = async (req, res) => {
  const payload = getTokenPayload(req);
  if (!payload?.userId) {
    json(res, 401, { error: 'No autenticado' });
    return null;
  }

  if (payload.userId === 'admin-env') {
    return { user: { correo: payload.correo || ENV_ADMIN_EMAIL }, role: 'admin', profileId: null };
  }

  const user = await prisma.informacionUsuario.findUnique({ where: { idUsuario: payload.userId } }).catch(() => null);
  if (!user) {
    json(res, 401, { error: 'Sesion invalida' });
    return null;
  }
  return { user, ...(await resolveRole(user)) };
};

/* ─────────────────────────────────────────────────────────────
 *  DASS-21 subscale item indices (1-based)
 * ───────────────────────────────────────────────────────────── */
const DASS_DEP_ITEMS = [3, 5, 10, 13, 16, 17, 21];
const DASS_ANX_ITEMS = [2, 4, 7, 9, 15, 19, 20];
const DASS_STR_ITEMS = [1, 6, 8, 11, 12, 14, 18];

/* ─────────────────────────────────────────────────────────────
 *  Parse "items=1=V, 2=V, ..." from HistorialTest.resultados
 *  Handles both  "items=1=V, 2=V…"  and  "1=V, 2=V…" formats.
 *  Returns a Map<number, number> of item -> score, or null.
 * ───────────────────────────────────────────────────────────── */
const parseItemScores = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  // Find the items portion: everything after "items=" or the whole string
  let itemsPart = raw;
  const itemsIdx = raw.indexOf('items=');
  if (itemsIdx !== -1) {
    itemsPart = raw.substring(itemsIdx + 6);
  }
  // Remove any trailing lines (fecha lines, etc.)
  itemsPart = itemsPart.split('\n')[0].trim();

  const map = new Map();
  // Match patterns like "1=2" or "21=3"
  const re = /(\d+)\s*=\s*(\d+)/g;
  let match;
  while ((match = re.exec(itemsPart)) !== null) {
    map.set(Number(match[1]), Number(match[2]));
  }
  return map.size > 0 ? map : null;
};

/* ─────────────────────────────────────────────────────────────
 *  Parse date from HistorialTest.resultados text
 *  Looks for "fecha=2026-03-12T21:07:04.340Z" inside the text
 * ───────────────────────────────────────────────────────────── */
const parseDateFromResultados = (raw) => {
  if (!raw) return null;
  const m = raw.match(/fecha=([^\n]+)/);
  if (m) {
    const d = new Date(m[1].trim());
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

/* ─────────────────────────────────────────────────────────────
 *  DASS-21 severity classification (uses doubled raw score)
 * ───────────────────────────────────────────────────────────── */
const dassDepressionLevel = (raw) => {
  const s = raw * 2;
  if (s >= 28) return 'Extremadamente severo';
  if (s >= 21) return 'Severo';
  if (s >= 14) return 'Moderado';
  if (s >= 10) return 'Leve';
  return 'Normal';
};
const dassAnxietyLevel = (raw) => {
  const s = raw * 2;
  if (s >= 20) return 'Extremadamente severo';
  if (s >= 15) return 'Severo';
  if (s >= 10) return 'Moderado';
  if (s >= 8) return 'Leve';
  return 'Normal';
};
const dassStressLevel = (raw) => {
  const s = raw * 2;
  if (s >= 34) return 'Extremadamente severo';
  if (s >= 26) return 'Severo';
  if (s >= 19) return 'Moderado';
  if (s >= 15) return 'Leve';
  return 'Normal';
};

const GHQ_SUBSCALE_DEFS = {
  funcionamientoCognitivo: { items: [1, 2], label: 'Funcionamiento Cognitivo' },
  ansiedadTension: { items: [3, 4], label: 'Ansiedad / Tension' },
  funcionamientoPsicosocial: { items: [5, 6], label: 'Funcionamiento Psicosocial' },
  afrontamiento: { items: [7, 8], label: 'Afrontamiento' },
  estadoAnimoDepresivo: { items: [9, 10], label: 'Estado de Animo Depresivo' },
  autoestima: { items: [11, 12], label: 'Autoestima' },
};

const DASS_LEVEL_RANK = {
  Normal: 1,
  Leve: 2,
  Moderado: 3,
  Severo: 4,
  'Extremadamente severo': 5,
};

const ghqRiskRank = (score) => {
  const v = Number(score || 0);
  if (v >= 28) return 5;
  if (v >= 19) return 4;
  if (v >= 12) return 3;
  if (v > 0) return 2;
  return 1;
};

const ghqRiskLabel = (score) => {
  const v = Number(score || 0);
  if (v >= 28) return 'Muy alto';
  if (v >= 19) return 'Alto';
  if (v >= 12) return 'Moderado';
  return 'Sin riesgo';
};

const combinedRiskLabelByRank = {
  0: 'Sin pruebas',
  1: 'Sin riesgo',
  2: 'Leve',
  3: 'Moderado',
  4: 'Alto',
  5: 'Muy alto',
};

const parseResultDate = (raw, fallbackDate) => {
  const parsed = parseDateFromResultados(String(raw || ''));
  if (parsed && !isNaN(parsed.getTime())) return parsed;
  if (!fallbackDate) return null;
  const d = new Date(fallbackDate);
  return isNaN(d.getTime()) ? null : d;
};

const toIsoOrNull = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const normalizeScore100 = (score, max) => {
  if (score === null || score === undefined || !max) return -1;
  return Math.max(0, Math.min(100, (Number(score) / max) * 100));
};

const computeCombinedRisk = ({ ghqScore, dassDep, dassAnx, dassStr }) => {
  const hasGhq = ghqScore !== null && ghqScore !== undefined;
  const hasDass = [dassDep, dassAnx, dassStr].some((v) => v !== null && v !== undefined);

  const ghqRankValue = hasGhq ? ghqRiskRank(Number(ghqScore || 0)) : 0;
  const depLevel = hasDass ? dassDepressionLevel(Number(dassDep || 0)) : null;
  const anxLevel = hasDass ? dassAnxietyLevel(Number(dassAnx || 0)) : null;
  const strLevel = hasDass ? dassStressLevel(Number(dassStr || 0)) : null;
  const dassRankValue = hasDass ? Math.max(
    DASS_LEVEL_RANK[depLevel] || 0,
    DASS_LEVEL_RANK[anxLevel] || 0,
    DASS_LEVEL_RANK[strLevel] || 0,
  ) : 0;

  const ghqScore100 = hasGhq ? normalizeScore100(Number(ghqScore || 0), 36) : -1;
  const maxDassRaw = hasDass ? Math.max(Number(dassDep || 0), Number(dassAnx || 0), Number(dassStr || 0)) : null;
  const dassScore100 = maxDassRaw !== null ? normalizeScore100(maxDassRaw * 2, 42) : -1;

  const rank = Math.max(ghqRankValue, dassRankValue);
  let source = 'none';
  if (ghqScore100 >= dassScore100 && ghqScore100 >= 0) source = 'ghq12';
  else if (dassScore100 > ghqScore100 && dassScore100 >= 0) source = 'dass21';

  return {
    rank,
    label: combinedRiskLabelByRank[rank] || 'Sin pruebas',
    score: Number(Math.max(ghqScore100, dassScore100, 0).toFixed(2)),
    source,
  };
};

/* ─────────────────────────────────────────────────────────────
 *  Age-range helper
 * ───────────────────────────────────────────────────────────── */
const ageRange = (birthDate) => {
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
  if (age < 15) return '<15';
  if (age <= 19) return '15-19';
  if (age <= 24) return '20-24';
  if (age <= 29) return '25-29';
  if (age <= 34) return '30-34';
  if (age <= 39) return '35-39';
  if (age <= 44) return '40-44';
  if (age <= 49) return '45-49';
  if (age <= 54) return '50-54';
  if (age <= 59) return '55-59';
  return '60+';
};

/* ─────────────────────────────────────────────────────────────
 *  Escolaridad enum → human-readable
 * ───────────────────────────────────────────────────────────── */
const escolaridadMap = {
  primaria_incompleta: 'Primaria incompleta',
  primaria_completa: 'Primaria completa',
  secundaria_incompleta: 'Secundaria incompleta',
  secundaria_completa: 'Secundaria completa',
  tecnico_incompleto: 'Técnico incompleto',
  tecnico_completo: 'Técnico completo',
  universitario_incompleto: 'Universitario incompleto',
  universitario_completo: 'Universitario completo',
  posgrado_incompleto: 'Posgrado incompleto',
  posgrado_completo: 'Posgrado completo',
};

/* ─────────────────────────────────────────────────────────────
 *  Nivel ingresos enum → human-readable
 * ───────────────────────────────────────────────────────────── */
const ingresosMap = {
  nivel_0_1_smmlv: '0-1 SMMLV',
  nivel_1_2_smmlv: '1-2 SMMLV',
  nivel_2_3_smmlv: '2-3 SMMLV',
  nivel_3_4_smmlv: '3-4 SMMLV',
  mayor_4_smmlv: '>4 SMMLV',
};

/* ─────────────────────────────────────────────────────────────
 *  Estado civil enum → human-readable
 * ───────────────────────────────────────────────────────────── */
const estadoCivilMap = {
  soltero: 'Soltero/a',
  casado: 'Casado/a',
  union_libre: 'Unión libre',
  divorciado: 'Divorciado/a',
  viudo: 'Viudo/a',
  separado: 'Separado/a',
};

/* ─────────────────────────────────────────────────────────────
 *  Helper: group-count from array, returns sorted [{label, count}]
 * ───────────────────────────────────────────────────────────── */
const groupCount = (arr) => {
  const map = new Map();
  for (const v of arr) {
    const key = v || 'Sin dato';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
};

/* ─────────────────────────────────────────────────────────────
 *  Sum items from a Map
 * ───────────────────────────────────────────────────────────── */
const sumItems = (itemMap, indices) =>
  indices.reduce((sum, idx) => sum + (itemMap.get(idx) || 0), 0);

/* ─────────────────────────────────────────────────────────────
 *  Career normalization — comprehensive (catches 60+ variants)
 *  Returns exactly 9 canonical careers + 'Otra' catch-all
 * ───────────────────────────────────────────────────────────── */
const normalizeCareer = (raw) => {
  if (!raw) return 'Sin información';
  const lower = String(raw).trim().toLowerCase();

  // 1. Psicología
  if (lower.includes('psicolog') || lower.includes('paicolog') || lower.includes('piscolog')) return 'Psicología';

  // 2. Medicina Veterinaria y Zootecnia (MUST be before generic checks)
  if (lower.includes('veterinar') || lower.includes('zootecn') || lower === 'mvz' || lower === 'mzv' || lower.includes('mvz')) return 'Medicina Veterinaria y Zootecnia';

  // 3. Derecho
  if (lower.includes('derecho') || lower.includes('jurisprudencia')) return 'Derecho';

  // 4. Arquitectura
  if (lower.includes('arquitect')) return 'Arquitectura';

  // 5. Ingeniería Industrial
  if (lower.includes('industrial') || lower.includes('imdustrial')) return 'Ingeniería Industrial';

  // 6. Ingeniería de Software
  if (lower.includes('software')) return 'Ingeniería de Software';

  // 7. Ingeniería de Sistemas
  if (lower.includes('sistema')) return 'Ingeniería de Sistemas';

  // 8. Contaduría Pública
  if (lower.includes('contad') || lower.includes('contab') || lower.includes('auxiliar contable')) return 'Contaduría Pública';

  // 9. Administración de Empresas
  if (lower.includes('administra') || lower.includes('admon')) return 'Administración de Empresas';

  // Catch-all for anything else
  return 'Otra';
};

/* ═══════════════════════════════════════════════════════════════
 *  getDashboardSummary — complete rewrite
 * ═══════════════════════════════════════════════════════════════ */
const getDashboardSummary = async (practitionerEmail = null) => {
  /* ── 0. Practitioner filter: resolve phone list ─────────── */
  let filterPhones = null; // null = no filter (show all)

  if (practitionerEmail === 'sin_asignar') {
    // Patients with NO practitioner linked in envios_correo
    const [allGhq12Phones, linkedPhones] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT DISTINCT telefono COLLATE utf8mb4_unicode_ci AS telefono FROM ghq12`).catch(() => []),
      prisma.$queryRawUnsafe(`SELECT DISTINCT telefono_paciente COLLATE utf8mb4_unicode_ci AS telefono_paciente FROM envios_correo`).catch(() => []),
    ]);
    const linkedSet = new Set(linkedPhones.map((r) => String(r.telefono_paciente)));
    filterPhones = allGhq12Phones.map((r) => String(r.telefono)).filter((t) => !linkedSet.has(t));
    if (filterPhones.length === 0) filterPhones = ['__NO_MATCH__'];
  } else if (practitionerEmail && practitionerEmail !== 'all') {
    const phoneRows = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT telefono_paciente FROM envios_correo WHERE correo_practicante = ?`,
      practitionerEmail,
    ).catch(() => []);
    filterPhones = phoneRows.map((r) => r.telefono_paciente);
    if (filterPhones.length === 0) filterPhones = ['__NO_MATCH__']; // ensure empty result set
  }

  const emailWhereClause = (() => {
    if (practitionerEmail === 'sin_asignar') return ' AND 1=0';
    if (!practitionerEmail || practitionerEmail === 'all') return '';
    const escaped = String(practitionerEmail).replace(/'/g, "''");
    return ` AND correo_practicante = '${escaped}'`;
  })();

  // SQL IN-clause helper for phone filtering
  const phoneInClause = (col) => {
    if (!filterPhones) return '';
    const escaped = filterPhones.map((p) => `'${String(p).replace(/'/g, "''")}'`).join(',');
    return ` AND ${col} IN (${escaped})`;
  };

  /* ── 1. Parallel data fetches ───────────────────────────── */
  const [
    totalPatients,
    activePractitioners,
    practitionerRows,
    ghq12Rows,
    dass21Rows,
    dassHistorialRows,
    ghqHistorialRows,
    userRows,
    socioRows,
    ghq12PdfCount,
    dass21PdfCount,
    ghq12PdfNoDate,
    dass21PdfNoDate,
    patientsWithPractitioner,
    patientsWithoutPractitioner,
    // Email tracking data from envios_correo
    emailTotalRows,
    emailByPractitionerRows,
    emailByDayRows,
    emailByTestRows,
    emailByPatientRows,
    ghq12WithoutPractitionerRows,
  ] = await Promise.all([
    // Total patients
    filterPhones
      ? prisma.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM informacionUsuario WHERE telefonoPersonal IN (${filterPhones.map((p) => `'${String(p).replace(/'/g, "''")}'`).join(',')})`)
          .then((r) => Number(r?.[0]?.c || 0)).catch(() => 0)
      : prisma.informacionUsuario.count().catch(() => 0),
    // Total practitioners
    prisma.practicante.count().catch(() => 0),
    // Practitioner details for workload & gender
    prisma.$queryRawUnsafe(`
      SELECT p.idPracticante, p.nombre, p.genero,
             COUNT(DISTINCT u.idUsuario) AS patients
      FROM practicante p
      LEFT JOIN informacionUsuario u ON u.practicanteAsignado = p.idPracticante
      GROUP BY p.idPracticante, p.nombre, p.genero
      ORDER BY patients DESC
    `).catch(() => []),
    // GHQ-12 from ghq12 table
    prisma.$queryRawUnsafe(`
      SELECT idGhq12, telefono, Puntaje, informePdfFecha, informePdfNombre,
             (informePdf IS NOT NULL) AS hasPdf
      FROM ghq12 WHERE 1=1${phoneInClause('telefono')}
    `).catch(() => []),
    // DASS-21 from dass21 table
    prisma.$queryRawUnsafe(`
      SELECT idDass21, telefono, puntajeDep, puntajeAns, puntajeEstr, informePdfFecha, informePdfNombre,
             (informePdf IS NOT NULL) AS hasPdf
      FROM dass21 WHERE 1=1${phoneInClause('telefono')}
    `).catch(() => []),
    // DASS-21 from HistorialTest
    filterPhones
      ? prisma.$queryRawUnsafe(`
          SELECT ht.id, ht.usuarioId, ht.resultados, ht.fechaCompletado
          FROM HistorialTest ht
          JOIN informacionUsuario u ON u.idUsuario = ht.usuarioId
          WHERE ht.tipoTest = 'interpretacion_dass21'${phoneInClause('u.telefonoPersonal')}
        `).catch(() => [])
      : prisma.$queryRawUnsafe(`
          SELECT id, usuarioId, resultados, fechaCompletado
          FROM HistorialTest
          WHERE tipoTest = 'interpretacion_dass21'
        `).catch(() => []),
    // GHQ-12 item-level from HistorialTest
    filterPhones
      ? prisma.$queryRawUnsafe(`
          SELECT ht.id, ht.usuarioId, ht.resultados, ht.fechaCompletado
          FROM HistorialTest ht
          JOIN informacionUsuario u ON u.idUsuario = ht.usuarioId
          WHERE ht.tipoTest = 'interpretacion_ghq12'${phoneInClause('u.telefonoPersonal')}
        `).catch(() => [])
      : prisma.$queryRawUnsafe(`
          SELECT id, usuarioId, resultados, fechaCompletado
          FROM HistorialTest
          WHERE tipoTest = 'interpretacion_ghq12'
        `).catch(() => []),
    // All users for sociodemographic & cross-tabs
    prisma.$queryRawUnsafe(`
      SELECT idUsuario, primerNombre, segundoNombre, primerApellido, segundoApellido,
             correo, telefonoPersonal, sexo, fechaNacimiento,
             orientacionSexual, identidadGenero, etnia, discapacidad,
             perteneceUniversidad, carrera, jornada, semestre
      FROM informacionUsuario WHERE 1=1${phoneInClause('telefonoPersonal')}
    `).catch(() => []),
    // Sociodemographic data
    filterPhones
      ? prisma.$queryRawUnsafe(`
          SELECT s.usuarioId, s.estadoCivil, s.escolaridad, s.nivelIngresos,
                 s.ocupacion, s.conQuienVive, s.tienePersonasACargo, s.numeroHijos
          FROM informacion_sociodemografica s
          JOIN informacionUsuario u ON u.idUsuario = s.usuarioId
          WHERE 1=1${phoneInClause('u.telefonoPersonal')}
        `).catch(() => [])
      : prisma.$queryRawUnsafe(`
          SELECT s.usuarioId, s.estadoCivil, s.escolaridad, s.nivelIngresos,
                 s.ocupacion, s.conQuienVive, s.tienePersonasACargo, s.numeroHijos
          FROM informacion_sociodemografica s
        `).catch(() => []),
    // PDF counts
    prisma.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM ghq12 WHERE informePdf IS NOT NULL`).catch(() => [{ c: 0 }]),
    prisma.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM dass21 WHERE informePdf IS NOT NULL`).catch(() => [{ c: 0 }]),
    prisma.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM ghq12 WHERE informePdf IS NOT NULL AND informePdfFecha IS NULL`).catch(() => [{ c: 0 }]),
    prisma.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM dass21 WHERE informePdf IS NOT NULL AND informePdfFecha IS NULL`).catch(() => [{ c: 0 }]),
    prisma.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM informacionUsuario WHERE practicanteAsignado IS NOT NULL`).catch(() => [{ c: 0 }]),
    prisma.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM informacionUsuario WHERE practicanteAsignado IS NULL`).catch(() => [{ c: 0 }]),
    // Email tracking: total
    prisma.$queryRawUnsafe(`SELECT COUNT(*) AS total, COUNT(DISTINCT telefono_paciente) AS pacientes FROM envios_correo WHERE 1=1${emailWhereClause}`).catch(() => [{ total: 0, pacientes: 0 }]),
    // Email tracking: by practitioner
    prisma.$queryRawUnsafe(`
      SELECT correo_practicante, nombre_practicante, COUNT(*) AS emails, COUNT(DISTINCT telefono_paciente) AS pacientes
      FROM envios_correo
      WHERE 1=1${emailWhereClause}
      GROUP BY correo_practicante, nombre_practicante
      ORDER BY emails DESC
    `).catch(() => []),
    // Email tracking: by day
    prisma.$queryRawUnsafe(`
      SELECT DATE(fecha_envio) AS fecha, COUNT(*) AS emails
      FROM envios_correo
      WHERE 1=1${emailWhereClause}
      GROUP BY DATE(fecha_envio)
      ORDER BY fecha
    `).catch(() => []),
    // Email tracking: counts by test type
    prisma.$queryRawUnsafe(`
      SELECT LOWER(IFNULL(test_tipo, '')) AS test_tipo, COUNT(*) AS total, COUNT(DISTINCT telefono_paciente) AS pacientes
      FROM envios_correo
      WHERE 1=1${emailWhereClause}
      GROUP BY LOWER(IFNULL(test_tipo, ''))
    `).catch(() => []),
    // Email tracking: per-patient flags by test type (for solo/ambas)
    prisma.$queryRawUnsafe(`
      SELECT
        telefono_paciente,
        MAX(CASE WHEN LOWER(IFNULL(test_tipo, '')) = 'ghq12' THEN 1 ELSE 0 END) AS has_ghq12,
        MAX(CASE WHEN LOWER(IFNULL(test_tipo, '')) = 'dass21' THEN 1 ELSE 0 END) AS has_dass21
      FROM envios_correo
      WHERE 1=1${emailWhereClause}
      GROUP BY telefono_paciente
    `).catch(() => []),
    // Count of GHQ-12 patients NOT in envios_correo (sueltos)
    prisma.$queryRawUnsafe(`
      SELECT COUNT(DISTINCT g.telefono) AS c
      FROM ghq12 g
      WHERE NOT EXISTS (
        SELECT 1 FROM envios_correo e
        WHERE e.telefono_paciente COLLATE utf8mb4_unicode_ci = g.telefono COLLATE utf8mb4_unicode_ci${emailWhereClause}
      )
    `).catch(() => [{ c: 0 }]),
  ]);

  /* ── 2. Build lookup maps ───────────────────────────────── */
  const userById = new Map();      // idUsuario -> user row
  for (const u of userRows) {
    userById.set(u.idUsuario, u);
  }

  const socioByUserId = new Map();
  for (const s of socioRows) {
    socioByUserId.set(s.usuarioId, s);
  }

  /* ── 2b. Deduplicate: keep only LATEST test per patient ── */
  // GHQ-12: keep latest record per telefono (by informePdfFecha, tiebreak by idGhq12)
  const firstGhq12Map = new Map();
  for (const row of ghq12Rows) {
    const key = row.telefono;
    const existing = firstGhq12Map.get(key);
    if (!existing) {
      firstGhq12Map.set(key, row);
    } else {
      const existDate = existing.informePdfFecha ? new Date(existing.informePdfFecha).getTime() : -Infinity;
      const newDate = row.informePdfFecha ? new Date(row.informePdfFecha).getTime() : -Infinity;
      if (newDate > existDate || (newDate === existDate && String(row.idGhq12) > String(existing.idGhq12))) {
        firstGhq12Map.set(key, row);
      }
    }
  }
  const ghq12Deduplicated = Array.from(firstGhq12Map.values());

  // DASS-21 (HistorialTest): keep latest record per usuarioId (by fechaCompletado, tiebreak by id)
  const firstDassMap = new Map();
  for (const row of dassHistorialRows) {
    const key = row.usuarioId;
    const existing = firstDassMap.get(key);
    if (!existing) {
      firstDassMap.set(key, row);
    } else {
      const existDate = existing.fechaCompletado ? new Date(existing.fechaCompletado).getTime() : -Infinity;
      const newDate = row.fechaCompletado ? new Date(row.fechaCompletado).getTime() : -Infinity;
      if (newDate > existDate || (newDate === existDate && Number(row.id) > Number(existing.id))) {
        firstDassMap.set(key, row);
      }
    }
  }
  const dassDeduplicated = Array.from(firstDassMap.values());

  // GHQ-12 HistorialTest: keep latest record per usuarioId (for subscales)
  const firstGhqHistMap = new Map();
  for (const row of ghqHistorialRows) {
    const key = row.usuarioId;
    const existing = firstGhqHistMap.get(key);
    if (!existing) {
      firstGhqHistMap.set(key, row);
    } else {
      const existDate = existing.fechaCompletado ? new Date(existing.fechaCompletado).getTime() : -Infinity;
      const newDate = row.fechaCompletado ? new Date(row.fechaCompletado).getTime() : -Infinity;
      if (newDate > existDate || (newDate === existDate && Number(row.id) > Number(existing.id))) {
        firstGhqHistMap.set(key, row);
      }
    }
  }
  const ghqHistDeduplicated = Array.from(firstGhqHistMap.values());

  // Coverage by unique user in HistorialTest (source of truth for combinations)
  const ghqUsers = new Set(ghqHistorialRows.map((row) => String(row.usuarioId || '')).filter(Boolean));
  const dassUsers = new Set(dassHistorialRows.map((row) => String(row.usuarioId || '')).filter(Boolean));

  let bothTestsCount = 0;
  for (const userId of ghqUsers) {
    if (dassUsers.has(userId)) bothTestsCount++;
  }
  const onlyGHQ12Count = ghqUsers.size - bothTestsCount;
  const onlyDASS21Count = dassUsers.size - bothTestsCount;
  const totalEvaluated = onlyGHQ12Count + onlyDASS21Count + bothTestsCount;
  const notEvaluated = Math.max(0, totalPatients - totalEvaluated);

  // GHQ score source normalized by userId (HistorialTest first, table fallback)
  const ghqTableByPhone = new Map();
  for (const row of ghq12Deduplicated) {
    ghqTableByPhone.set(String(row.telefono || ''), row);
  }

  const ghqByUserId = new Map();
  for (const row of ghqHistDeduplicated) {
    const userId = String(row.usuarioId || '').trim();
    if (!userId) continue;

    const itemMap = parseItemScores(String(row.resultados || ''));
    if (!itemMap) continue;

    const score = Array.from({ length: 12 }, (_v, idx) => idx + 1)
      .reduce((sum, idx) => sum + (itemMap.get(idx) || 0), 0);
    const completedAt = parseResultDate(row.resultados, row.fechaCompletado);

    ghqByUserId.set(userId, {
      score: Number(score || 0),
      completedAt: completedAt || null,
      source: 'historial',
    });
  }

  for (const userId of ghqUsers) {
    if (ghqByUserId.has(userId)) continue;
    const user = userById.get(userId);
    const phone = String(user?.telefonoPersonal || '');
    const tableRow = ghqTableByPhone.get(phone);
    if (!tableRow) continue;

    const score = Number(tableRow.Puntaje || 0);
    const completedAt = tableRow.informePdfFecha ? new Date(tableRow.informePdfFecha) : null;
    ghqByUserId.set(userId, {
      score,
      completedAt: completedAt && !isNaN(completedAt.getTime()) ? completedAt : null,
      source: 'ghq12',
    });
  }

  /* ── 3. GHQ-12 processing (source of truth: HistorialTest) ── */
  const totalGHQ12 = ghqUsers.size;
  let ghqScoreSum = 0;
  const ghqScoreHistogram = new Map(); // score -> count
  for (let i = 0; i <= 36; i++) ghqScoreHistogram.set(i, 0);

  const ghqRiskBuckets = {
    'Sin riesgo (0-11)': 0,
    'Riesgo moderado (12-18)': 0,
    'Riesgo alto (19-27)': 0,
    'Riesgo muy alto (28-36)': 0,
  };

  const ghqByDayMap = new Map(); // 'YYYY-MM-DD' -> { count, scoreSum }
  let patientsAtRisk = 0;

  for (const userId of ghqUsers) {
    const data = ghqByUserId.get(userId);
    const rawScore = Number(data?.score ?? 0);
    const score = Math.max(0, Math.min(36, rawScore));
    ghqScoreSum += score;

    // Histogram
    if (score >= 0 && score <= 36) {
      ghqScoreHistogram.set(score, (ghqScoreHistogram.get(score) || 0) + 1);
    }

    // Risk distribution
    if (score >= 28) ghqRiskBuckets['Riesgo muy alto (28-36)']++;
    else if (score >= 19) ghqRiskBuckets['Riesgo alto (19-27)']++;
    else if (score >= 12) ghqRiskBuckets['Riesgo moderado (12-18)']++;
    else ghqRiskBuckets['Sin riesgo (0-11)']++;

    if (score >= 12) patientsAtRisk++;

    // By day
    const d = data?.completedAt;
    if (d && !isNaN(d.getTime())) {
      const dayKey = d.toISOString().slice(0, 10);
      const existing = ghqByDayMap.get(dayKey) || { count: 0, scoreSum: 0 };
      existing.count++;
      existing.scoreSum += score;
      ghqByDayMap.set(dayKey, existing);
    }
  }

  const ghqAverageScore = totalGHQ12 > 0 ? Number((ghqScoreSum / totalGHQ12).toFixed(2)) : 0;
  const riskPercentage = totalGHQ12 > 0 ? Number(((patientsAtRisk / totalGHQ12) * 100).toFixed(1)) : 0;

  const ghqRiskDistribution = [
    { level: 'Sin riesgo (0-11)', count: ghqRiskBuckets['Sin riesgo (0-11)'], percentage: 0, color: '#22c55e' },
    { level: 'Riesgo moderado (12-18)', count: ghqRiskBuckets['Riesgo moderado (12-18)'], percentage: 0, color: '#f59e0b' },
    { level: 'Riesgo alto (19-27)', count: ghqRiskBuckets['Riesgo alto (19-27)'], percentage: 0, color: '#f97316' },
    { level: 'Riesgo muy alto (28-36)', count: ghqRiskBuckets['Riesgo muy alto (28-36)'], percentage: 0, color: '#ef4444' },
  ];
  for (const item of ghqRiskDistribution) {
    item.percentage = totalGHQ12 > 0 ? Number(((item.count / totalGHQ12) * 100).toFixed(1)) : 0;
  }

  const scoreHistogram = [];
  for (let i = 0; i <= 36; i++) {
    scoreHistogram.push({ score: i, count: ghqScoreHistogram.get(i) || 0 });
  }

  const ghqByDay = [...ghqByDayMap.entries()]
    .map(([date, data]) => ({
      date,
      count: data.count,
      avgScore: Number((data.scoreSum / data.count).toFixed(2)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  /* ── 3b. GHQ-12 subscales from HistorialTest ───────────── */
  const subscaleSums = {};
  const subscaleCounts = {};
  for (const key of Object.keys(GHQ_SUBSCALE_DEFS)) {
    subscaleSums[key] = 0;
    subscaleCounts[key] = 0;
  }

  for (const row of ghqHistDeduplicated) {
    const itemMap = parseItemScores(String(row.resultados || ''));
    if (!itemMap) continue;

    for (const [key, def] of Object.entries(GHQ_SUBSCALE_DEFS)) {
      const val = sumItems(itemMap, def.items);
      subscaleSums[key] += val;
      subscaleCounts[key]++;
    }
  }

  const ghqSubscales = {};
  for (const [key, def] of Object.entries(GHQ_SUBSCALE_DEFS)) {
    ghqSubscales[key] = {
      avg: subscaleCounts[key] > 0
        ? Number((subscaleSums[key] / subscaleCounts[key]).toFixed(2))
        : 0,
      label: def.label,
    };
  }

  /* ── 4. DASS-21 processing from HistorialTest ──────────── */
  const totalDASS21 = dassDeduplicated.length;
  let depSumTotal = 0;
  let anxSumTotal = 0;
  let strSumTotal = 0;
  let dassValidCount = 0;

  const dassLevelColors = {
    Normal: '#22c55e',
    Leve: '#84cc16',
    Moderado: '#f59e0b',
    Severo: '#f97316',
    'Extremadamente severo': '#ef4444',
  };
  const dassLevelNames = ['Normal', 'Leve', 'Moderado', 'Severo', 'Extremadamente severo'];

  const depDist = new Map(dassLevelNames.map((l) => [l, 0]));
  const anxDist = new Map(dassLevelNames.map((l) => [l, 0]));
  const strDist = new Map(dassLevelNames.map((l) => [l, 0]));

  const dassByDayMap = new Map(); // 'YYYY-MM-DD' -> { count, depSum, anxSum, strSum }

  for (const row of dassDeduplicated) {
    const itemMap = parseItemScores(String(row.resultados || ''));
    if (!itemMap || itemMap.size < 21) continue;

    const depRaw = sumItems(itemMap, DASS_DEP_ITEMS);
    const anxRaw = sumItems(itemMap, DASS_ANX_ITEMS);
    const strRaw = sumItems(itemMap, DASS_STR_ITEMS);

    depSumTotal += depRaw;
    anxSumTotal += anxRaw;
    strSumTotal += strRaw;
    dassValidCount++;

    // Severity classification
    const depLevel = dassDepressionLevel(depRaw);
    const anxLevel = dassAnxietyLevel(anxRaw);
    const strLevel = dassStressLevel(strRaw);

    depDist.set(depLevel, (depDist.get(depLevel) || 0) + 1);
    anxDist.set(anxLevel, (anxDist.get(anxLevel) || 0) + 1);
    strDist.set(strLevel, (strDist.get(strLevel) || 0) + 1);

    // By day — prefer fecha from resultados text, fall back to fechaCompletado
    let dateObj = parseDateFromResultados(String(row.resultados || ''));
    if (!dateObj && row.fechaCompletado) {
      dateObj = new Date(row.fechaCompletado);
    }
    if (dateObj && !isNaN(dateObj.getTime())) {
      const dayKey = dateObj.toISOString().slice(0, 10);
      const existing = dassByDayMap.get(dayKey) || { count: 0, depSum: 0, anxSum: 0, strSum: 0 };
      existing.count++;
      existing.depSum += depRaw;
      existing.anxSum += anxRaw;
      existing.strSum += strRaw;
      dassByDayMap.set(dayKey, existing);
    }
  }

  const buildDistArray = (distMap) =>
    dassLevelNames.map((level) => ({
      level,
      count: distMap.get(level) || 0,
      percentage: dassValidCount > 0
        ? Number((((distMap.get(level) || 0) / dassValidCount) * 100).toFixed(1))
        : 0,
      color: dassLevelColors[level],
    }));

  const dassByDay = [...dassByDayMap.entries()]
    .map(([date, d]) => ({
      date,
      count: d.count,
      avgDep: Number((d.depSum / d.count).toFixed(2)),
      avgAnx: Number((d.anxSum / d.count).toFixed(2)),
      avgStr: Number((d.strSum / d.count).toFixed(2)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  /* ── 5. Sociodemographic processing ────────────────────── */
  const totalSocio = socioRows.length;
  const sexArr = [];
  const ageRangesArr = [];
  const civilStatusArr = [];
  const educationArr = [];
  const incomeArr = [];
  const occupationArr = [];
  const sexualOrientationArr = [];
  const ethnicityArr = [];
  let disabilityYes = 0;
  let disabilityNo = 0;
  let belongsUniversity = 0;
  let notBelongsUniversity = 0;
  const careerArr = [];
  const scheduleArr = [];

  for (const u of userRows) {
    const socio = socioByUserId.get(u.idUsuario);

    // Sex (from informacionUsuario)
    sexArr.push(u.sexo || 'No informa');

    // Age range
    if (u.fechaNacimiento) {
      const range = ageRange(new Date(u.fechaNacimiento));
      if (range) ageRangesArr.push(range);
    }

    // Sexual orientation, ethnicity, disability, university (from informacionUsuario)
    sexualOrientationArr.push(u.orientacionSexual || 'Prefiero no decir');
    ethnicityArr.push(u.etnia || 'Prefiero no decir');

    const dis = String(u.discapacidad || 'No').toLowerCase();
    if (dis === 'no' || dis === 'no informa') disabilityNo++;
    else disabilityYes++;

    const belongs = String(u.perteneceUniversidad || 'No').toLowerCase();
    if (belongs === 'si' || belongs === 'sí') {
      belongsUniversity++;
      if (u.carrera) careerArr.push(normalizeCareer(u.carrera));
      if (u.jornada) scheduleArr.push(u.jornada);
    } else {
      notBelongsUniversity++;
    }

    // Sociodemographic fields
    if (socio) {
      civilStatusArr.push(estadoCivilMap[socio.estadoCivil] || socio.estadoCivil || 'Sin dato');
      educationArr.push(escolaridadMap[socio.escolaridad] || socio.escolaridad || 'Sin dato');
      incomeArr.push(ingresosMap[socio.nivelIngresos] || socio.nivelIngresos || 'Sin dato');
      occupationArr.push(socio.ocupacion || 'Sin dato');
    }
  }

  const buildGroupedArray = (arr, keyName) => {
    const map = new Map();
    for (const v of arr) {
      map.set(v, (map.get(v) || 0) + 1);
    }
    return [...map.entries()]
      .map(([label, count]) => ({ [keyName]: label, count }))
      .sort((a, b) => b.count - a.count);
  };

  const sexGrouped = buildGroupedArray(sexArr, 'label');
  const total = sexArr.length || 1;
  const sexWithPct = sexGrouped.map((item) => ({
    label: item.label,
    count: item.count,
    pct: Number(((item.count / total) * 100).toFixed(1)),
  }));

  const ageRangeOrder = ['<15', '15-19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60+'];
  const ageMap = new Map();
  for (const r of ageRangesArr) ageMap.set(r, (ageMap.get(r) || 0) + 1);
  const ageRangesGrouped = ageRangeOrder
    .filter((r) => ageMap.has(r))
    .map((r) => ({ range: r, count: ageMap.get(r) || 0 }));

  const topCareers = buildGroupedArray(careerArr, 'career').slice(0, 15);
  const scheduleGrouped = buildGroupedArray(scheduleArr, 'type');

  /* ── 5b. Academic profile (careers, jornada, semestre) ──── */
  const semestreArr = [];
  for (const u of userRows) {
    if (u.semestre) semestreArr.push(String(u.semestre));
  }

  const topCareersNormalized = buildGroupedArray(careerArr, 'career');
  const jornadaGrouped = buildGroupedArray(scheduleArr, 'type');
  const semestreGrouped = buildGroupedArray(semestreArr, 'semestre')
    .sort((a, b) => {
      const na = parseInt(a.semestre, 10);
      const nb = parseInt(b.semestre, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.semestre.localeCompare(b.semestre);
    });

  /* ── 6. Cross-tabulations (GHQ-12 by demographics) ─────── */
  // Build userId -> ghq score map from normalized source
  const ghqByUserForCrossTabs = new Map(); // userId -> { score, atRisk }
  for (const userId of ghqUsers) {
    const d = ghqByUserId.get(userId);
    const score = Math.max(0, Math.min(36, Number(d?.score ?? 0)));
    ghqByUserForCrossTabs.set(userId, { score, atRisk: score >= 12 });
  }

  // GHQ-12 by Sex
  const ghqBySexMap = new Map(); // sex -> { atRisk, noRisk, total, scoreSum }
  for (const [userId, ghqData] of ghqByUserForCrossTabs) {
    const user = userById.get(userId);
    if (!user) continue;
    const sex = user.sexo || 'No informa';
    const existing = ghqBySexMap.get(sex) || { atRisk: 0, noRisk: 0, total: 0, scoreSum: 0 };
    existing.total++;
    existing.scoreSum += ghqData.score;
    if (ghqData.atRisk) existing.atRisk++;
    else existing.noRisk++;
    ghqBySexMap.set(sex, existing);
  }
  const ghq12BySex = [...ghqBySexMap.entries()].map(([sex, d]) => ({
    sex,
    atRisk: d.atRisk,
    noRisk: d.noRisk,
    total: d.total,
    riskPct: d.total > 0 ? Number(((d.atRisk / d.total) * 100).toFixed(1)) : 0,
    avgScore: d.total > 0 ? Number((d.scoreSum / d.total).toFixed(2)) : 0,
  })).sort((a, b) => b.total - a.total);

  // GHQ-12 by Age
  const ghqByAgeMap = new Map();
  for (const [userId, ghqData] of ghqByUserForCrossTabs) {
    const user = userById.get(userId);
    if (!user || !user.fechaNacimiento) continue;
    const range = ageRange(new Date(user.fechaNacimiento));
    if (!range) continue;
    const existing = ghqByAgeMap.get(range) || { atRisk: 0, total: 0, scoreSum: 0 };
    existing.total++;
    existing.scoreSum += ghqData.score;
    if (ghqData.atRisk) existing.atRisk++;
    ghqByAgeMap.set(range, existing);
  }
  const ghq12ByAge = ageRangeOrder
    .filter((r) => ghqByAgeMap.has(r))
    .map((range) => {
      const d = ghqByAgeMap.get(range);
      return {
        range,
        atRisk: d.atRisk,
        total: d.total,
        riskPct: d.total > 0 ? Number(((d.atRisk / d.total) * 100).toFixed(1)) : 0,
        avgScore: d.total > 0 ? Number((d.scoreSum / d.total).toFixed(2)) : 0,
      };
    });

  // GHQ-12 by Civil Status
  const ghqByCivilMap = new Map();
  for (const [userId, ghqData] of ghqByUserForCrossTabs) {
    const user = userById.get(userId);
    if (!user) continue;
    const socio = socioByUserId.get(user.idUsuario);
    if (!socio) continue;
    const status = estadoCivilMap[socio.estadoCivil] || socio.estadoCivil || 'Sin dato';
    const existing = ghqByCivilMap.get(status) || { atRisk: 0, total: 0, scoreSum: 0 };
    existing.total++;
    existing.scoreSum += ghqData.score;
    if (ghqData.atRisk) existing.atRisk++;
    ghqByCivilMap.set(status, existing);
  }
  const ghq12ByCivilStatus = [...ghqByCivilMap.entries()]
    .map(([status, d]) => ({
      status,
      atRisk: d.atRisk,
      total: d.total,
      riskPct: d.total > 0 ? Number(((d.atRisk / d.total) * 100).toFixed(1)) : 0,
      avgScore: d.total > 0 ? Number((d.scoreSum / d.total).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // GHQ-12 by Income
  const ghqByIncomeMap = new Map();
  for (const [userId, ghqData] of ghqByUserForCrossTabs) {
    const user = userById.get(userId);
    if (!user) continue;
    const socio = socioByUserId.get(user.idUsuario);
    if (!socio) continue;
    const level = ingresosMap[socio.nivelIngresos] || socio.nivelIngresos || 'Sin dato';
    const existing = ghqByIncomeMap.get(level) || { atRisk: 0, total: 0, scoreSum: 0 };
    existing.total++;
    existing.scoreSum += ghqData.score;
    if (ghqData.atRisk) existing.atRisk++;
    ghqByIncomeMap.set(level, existing);
  }
  const ghq12ByIncome = [...ghqByIncomeMap.entries()]
    .map(([level, d]) => ({
      level,
      atRisk: d.atRisk,
      total: d.total,
      riskPct: d.total > 0 ? Number(((d.atRisk / d.total) * 100).toFixed(1)) : 0,
      avgScore: d.total > 0 ? Number((d.scoreSum / d.total).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // GHQ-12 by Career (normalized)
  const ghqByCareerMap = new Map();
  for (const [userId, ghqData] of ghqByUserForCrossTabs) {
    const user = userById.get(userId);
    if (!user || !user.carrera) continue;
    const career = normalizeCareer(user.carrera);
    if (!career) continue;
    const existing = ghqByCareerMap.get(career) || { atRisk: 0, total: 0, scoreSum: 0 };
    existing.total++;
    existing.scoreSum += ghqData.score;
    if (ghqData.atRisk) existing.atRisk++;
    ghqByCareerMap.set(career, existing);
  }
  const ghq12ByCareer = [...ghqByCareerMap.entries()]
    .map(([career, d]) => ({
      career,
      atRisk: d.atRisk,
      total: d.total,
      riskPct: d.total > 0 ? Number(((d.atRisk / d.total) * 100).toFixed(1)) : 0,
      avgScore: d.total > 0 ? Number((d.scoreSum / d.total).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // GHQ-12 by Semestre
  const ghqBySemestreMap = new Map();
  for (const [userId, ghqData] of ghqByUserForCrossTabs) {
    const user = userById.get(userId);
    if (!user || !user.semestre) continue;
    const sem = String(user.semestre);
    const existing = ghqBySemestreMap.get(sem) || { atRisk: 0, total: 0, scoreSum: 0 };
    existing.total++;
    existing.scoreSum += ghqData.score;
    if (ghqData.atRisk) existing.atRisk++;
    ghqBySemestreMap.set(sem, existing);
  }
  const ghq12BySemestre = [...ghqBySemestreMap.entries()]
    .map(([semestre, d]) => ({
      semestre,
      atRisk: d.atRisk,
      total: d.total,
      riskPct: d.total > 0 ? Number(((d.atRisk / d.total) * 100).toFixed(1)) : 0,
      avgScore: d.total > 0 ? Number((d.scoreSum / d.total).toFixed(2)) : 0,
    }))
    .sort((a, b) => {
      const na = parseInt(a.semestre, 10);
      const nb = parseInt(b.semestre, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.semestre.localeCompare(b.semestre);
    });

  // GHQ-12 by Jornada
  const ghqByJornadaMap = new Map();
  for (const [userId, ghqData] of ghqByUserForCrossTabs) {
    const user = userById.get(userId);
    if (!user || !user.jornada) continue;
    const jornada = String(user.jornada);
    const existing = ghqByJornadaMap.get(jornada) || { atRisk: 0, total: 0, scoreSum: 0 };
    existing.total++;
    existing.scoreSum += ghqData.score;
    if (ghqData.atRisk) existing.atRisk++;
    ghqByJornadaMap.set(jornada, existing);
  }
  const ghq12ByJornada = [...ghqByJornadaMap.entries()]
    .map(([jornada, d]) => ({
      jornada,
      atRisk: d.atRisk,
      total: d.total,
      riskPct: d.total > 0 ? Number(((d.atRisk / d.total) * 100).toFixed(1)) : 0,
      avgScore: d.total > 0 ? Number((d.scoreSum / d.total).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  /* ── 6b. Notification / PDF tracking ────────────────────── */
  const ghq12PdfTotal = Number(ghq12PdfCount?.[0]?.c || 0);
  const dass21PdfTotal = Number(dass21PdfCount?.[0]?.c || 0);

  // Email tracking from envios_correo (real data)
  const emailTotal = Number(emailTotalRows?.[0]?.total || 0);
  const emailUniquePatients = Number(emailTotalRows?.[0]?.pacientes || 0);
  const emailPatientsWithoutPractitioner = Number(ghq12WithoutPractitionerRows?.[0]?.c || 0);
  const emailByPractitioner = (emailByPractitionerRows || []).map((r) => ({
    name: String(r.nombre_practicante || 'Sin nombre'),
    email: String(r.correo_practicante || ''),
    emailsSent: Number(r.emails || 0),
    uniquePatients: Number(r.pacientes || 0),
  }));
  const emailByDay = (emailByDayRows || []).map((r) => ({
    date: r.fecha ? (r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha)) : null,
    count: Number(r.emails || 0),
  })).filter((r) => r.date);

  const emailByTestMap = new Map(
    (emailByTestRows || []).map((r) => [
      String(r.test_tipo || '').toLowerCase(),
      {
        total: Number(r.total || 0),
        patients: Number(r.pacientes || 0),
      },
    ]),
  );

  let emailSoloGhq12 = 0;
  let emailSoloDass21 = 0;
  let emailAmbas = 0;
  for (const row of emailByPatientRows || []) {
    const hasGhq12 = Number(row.has_ghq12 || 0) > 0;
    const hasDass21 = Number(row.has_dass21 || 0) > 0;
    if (hasGhq12 && hasDass21) emailAmbas++;
    else if (hasGhq12) emailSoloGhq12++;
    else if (hasDass21) emailSoloDass21++;
  }

  const totalConGhq12 = Number(emailByTestMap.get('ghq12')?.total || 0);
  const totalConDass21 = Number(emailByTestMap.get('dass21')?.total || 0);

  const ghqRowByPhone = new Map();
  for (const row of ghq12Deduplicated) {
    ghqRowByPhone.set(String(row.telefono), row);
  }

  const dassRowByPhone = new Map();
  for (const row of dass21Rows) {
    const key = String(row.telefono || '');
    if (!key) continue;
    const existing = dassRowByPhone.get(key);
    if (!existing) {
      dassRowByPhone.set(key, row);
      continue;
    }
    const existDate = existing.informePdfFecha ? new Date(existing.informePdfFecha).getTime() : -Infinity;
    const newDate = row.informePdfFecha ? new Date(row.informePdfFecha).getTime() : -Infinity;
    if (newDate > existDate || (newDate === existDate && String(row.idDass21) > String(existing.idDass21))) {
      dassRowByPhone.set(key, row);
    }
  }

  const latestGhqDateByUserId = new Map();
  for (const row of ghqHistDeduplicated) {
    const d = parseResultDate(row.resultados, row.fechaCompletado);
    if (!d || !row.usuarioId) continue;
    latestGhqDateByUserId.set(String(row.usuarioId), d);
  }

  const latestDassDateByUserId = new Map();
  for (const row of dassDeduplicated) {
    const d = parseResultDate(row.resultados, row.fechaCompletado);
    if (!d || !row.usuarioId) continue;
    latestDassDateByUserId.set(String(row.usuarioId), d);
  }

  const buildFullName = (u) => {
    const parts = [u.primerNombre, u.segundoNombre, u.primerApellido, u.segundoApellido]
      .map((v) => String(v || '').trim())
      .filter(Boolean);
    if (!parts.length) return 'Sin nombre';
    return parts.join(' ');
  };

  const students = userRows
    .map((u) => {
      const phone = String(u.telefonoPersonal || '');
      const ghqRow = ghqRowByPhone.get(phone) || null;
      const dassRow = dassRowByPhone.get(phone) || null;

      const ghqScore = ghqRow ? Number(ghqRow.Puntaje || 0) : null;
      const dassDep = dassRow ? Number(dassRow.puntajeDep || 0) : null;
      const dassAnx = dassRow ? Number(dassRow.puntajeAns || 0) : null;
      const dassStr = dassRow ? Number(dassRow.puntajeEstr || 0) : null;

      const ghqDate = latestGhqDateByUserId.get(String(u.idUsuario))
        || (ghqRow?.informePdfFecha ? new Date(ghqRow.informePdfFecha) : null);
      const dassDate = latestDassDateByUserId.get(String(u.idUsuario))
        || (dassRow?.informePdfFecha ? new Date(dassRow.informePdfFecha) : null);

      const latestTestDate = [ghqDate, dassDate]
        .filter((d) => d && !isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;

      const combinedRisk = computeCombinedRisk({
        ghqScore,
        dassDep,
        dassAnx,
        dassStr,
      });

      return {
        idUsuario: String(u.idUsuario || ''),
        fullName: buildFullName(u),
        latestTestDate: toIsoOrNull(latestTestDate),
        combinedRisk,
        ghq12: ghqRow
          ? {
              id: String(ghqRow.idGhq12),
              score: ghqScore,
              riskLabel: ghqRiskLabel(ghqScore),
              completedAt: toIsoOrNull(ghqDate),
              hasPdf: Number(ghqRow.hasPdf || 0) > 0,
              pdfFilename: ghqRow.informePdfNombre ? String(ghqRow.informePdfNombre) : null,
            }
          : null,
        dass21: dassRow
          ? {
              id: String(dassRow.idDass21),
              dep: dassDep,
              anx: dassAnx,
              str: dassStr,
              maxSubscale: Math.max(dassDep || 0, dassAnx || 0, dassStr || 0),
              completedAt: toIsoOrNull(dassDate),
              hasPdf: Number(dassRow.hasPdf || 0) > 0,
              pdfFilename: dassRow.informePdfNombre ? String(dassRow.informePdfNombre) : null,
            }
          : null,
      };
    })
    .sort((a, b) => {
      const ta = a.latestTestDate ? new Date(a.latestTestDate).getTime() : -Infinity;
      const tb = b.latestTestDate ? new Date(b.latestTestDate).getTime() : -Infinity;
      return tb - ta;
    });

  /* ── 7. Practitioners processing ───────────────────────── */
  /* ── 7. Build response ─────────────────────────────────── */
  return {
    overview: {
      totalPatients,
      totalGHQ12,
      totalDASS21,
      totalEvaluated,
      notEvaluated,
      onlyGHQ12Count,
      onlyDASS21Count,
      bothTestsCount,
      activePractitioners,
      patientsAtRisk,
      riskPercentage,
    },

    ghq12: {
      totalTests: totalGHQ12,
      averageScore: ghqAverageScore,
      riskDistribution: ghqRiskDistribution,
      scoreHistogram,
      subscales: ghqSubscales,
      byDay: ghqByDay,
    },

    dass21: {
      totalTests: totalDASS21,
      averages: {
        depression: dassValidCount > 0 ? Number((depSumTotal / dassValidCount).toFixed(2)) : 0,
        anxiety: dassValidCount > 0 ? Number((anxSumTotal / dassValidCount).toFixed(2)) : 0,
        stress: dassValidCount > 0 ? Number((strSumTotal / dassValidCount).toFixed(2)) : 0,
      },
      depression: { distribution: buildDistArray(depDist) },
      anxiety: { distribution: buildDistArray(anxDist) },
      stress: { distribution: buildDistArray(strDist) },
      byDay: dassByDay,
    },

    sociodemographic: {
      totalRecords: totalSocio,
      sex: sexWithPct,
      ageRanges: ageRangesGrouped,
      civilStatus: buildGroupedArray(civilStatusArr, 'status'),
      education: buildGroupedArray(educationArr, 'level'),
      income: buildGroupedArray(incomeArr, 'level'),
      occupation: buildGroupedArray(occupationArr, 'type'),
      sexualOrientation: buildGroupedArray(sexualOrientationArr, 'orientation'),
      ethnicity: buildGroupedArray(ethnicityArr, 'group'),
      disability: { yes: disabilityYes, no: disabilityNo },
      university: {
        belongs: belongsUniversity,
        doesNotBelong: notBelongsUniversity,
        topCareers,
        schedule: scheduleGrouped,
      },
      // Academic data merged into sociodemographic
      topCareers: topCareersNormalized,
      jornada: jornadaGrouped,
      semestre: semestreGrouped,
    },

    crossTabs: {
      ghq12BySex,
      ghq12ByAge,
      ghq12ByCivilStatus,
      ghq12ByIncome,
      ghq12ByCareer,
      ghq12BySemestre,
      ghq12ByJornada,
    },

    emailTracking: {
      totalEmailsSent: emailTotal,
      uniquePatients: emailUniquePatients,
      patientsWithoutPractitioner: emailPatientsWithoutPractitioner,
      totalPdfsGenerated: { ghq12: ghq12PdfTotal, dass21: dass21PdfTotal },
      byTestType: {
        totalConGhq12,
        totalConDass21,
        soloGhq12: emailSoloGhq12,
        soloDass21: emailSoloDass21,
        ambas: emailAmbas,
      },
      ccRecipient: 'chatbotpsicologia@gmail.com',
      byPractitioner: emailByPractitioner,
      byDay: emailByDay,
      currentFilter: practitionerEmail || 'all',
    },

    students,
  };
};

/* ═══════════════════════════════════════════════════════════════
 *  Practitioner DTO (unchanged)
 * ═══════════════════════════════════════════════════════════════ */
const toPractitionerDto = (row) => ({
  id: row.idPracticante,
  name: row.nombre || '',
  lastName: '',
  fullName: row.nombre || '',
  documentNumber: row.numero_documento || '',
  documentType: row.tipo_documento || 'CC',
  email: row.correo || '',
  phone: row.telefono || '',
  gender: row.genero || '',
  eps: row.eps_ips || '',
  clinic: row.clinica || '',
  startDate: row.fechaInicio || null,
  endDate: row.fechaFin || null,
  schedule: null,
  active: !row.fechaFin,
  sessionsCount: row.citasProgramadas || 0,
  createdAt: row.fechaCreacion,
});

const buildStudentDashboardDetail = async (userId) => {
  const user = await prisma.informacionUsuario.findUnique({
    where: { idUsuario: userId },
    select: {
      idUsuario: true,
      primerNombre: true,
      segundoNombre: true,
      primerApellido: true,
      segundoApellido: true,
      correo: true,
      telefonoPersonal: true,
    },
  }).catch(() => null);

  if (!user) return null;

  const fullName = [user.primerNombre, user.segundoNombre, user.primerApellido, user.segundoApellido]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(' ') || 'Sin nombre';

  const [ghqRows, dassRows, ghqHistoryRows, dassHistoryRows] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT idGhq12, Puntaje, informePdfFecha, informePdfNombre, (informePdf IS NOT NULL) AS hasPdf
      FROM ghq12
      WHERE telefono = ?
      LIMIT 1
    `, String(user.telefonoPersonal || '')).catch(() => []),
    prisma.$queryRawUnsafe(`
      SELECT idDass21, puntajeDep, puntajeAns, puntajeEstr, informePdfFecha, informePdfNombre, (informePdf IS NOT NULL) AS hasPdf
      FROM dass21
      WHERE telefono = ?
      LIMIT 1
    `, String(user.telefonoPersonal || '')).catch(() => []),
    prisma.historialTest.findMany({
      where: { usuarioId: user.idUsuario, tipoTest: 'interpretacion_ghq12' },
      orderBy: { fechaCompletado: 'asc' },
      select: { id: true, resultados: true, fechaCompletado: true },
    }).catch(() => []),
    prisma.historialTest.findMany({
      where: { usuarioId: user.idUsuario, tipoTest: 'interpretacion_dass21' },
      orderBy: { fechaCompletado: 'asc' },
      select: { id: true, resultados: true, fechaCompletado: true },
    }).catch(() => []),
  ]);

  const ghqDb = ghqRows?.[0] || null;
  const dassDb = dassRows?.[0] || null;

  const ghqByDayMap = new Map();
  let latestGhq = null;

  for (const row of ghqHistoryRows) {
    const itemMap = parseItemScores(String(row.resultados || ''));
    if (!itemMap) continue;

    const score = Array.from({ length: 12 }, (_v, idx) => idx + 1)
      .reduce((sum, idx) => sum + (itemMap.get(idx) || 0), 0);
    const dateObj = parseResultDate(row.resultados, row.fechaCompletado);

    if (!latestGhq || (dateObj && (!latestGhq.dateObj || dateObj.getTime() > latestGhq.dateObj.getTime()))) {
      latestGhq = {
        score,
        itemMap,
        dateObj: dateObj || null,
      };
    }

    if (dateObj) {
      const dayKey = dateObj.toISOString().slice(0, 10);
      const current = ghqByDayMap.get(dayKey) || { scoreSum: 0, count: 0 };
      current.scoreSum += score;
      current.count += 1;
      ghqByDayMap.set(dayKey, current);
    }
  }

  if (!latestGhq && ghqDb) {
    latestGhq = {
      score: Number(ghqDb.Puntaje || 0),
      itemMap: null,
      dateObj: ghqDb.informePdfFecha ? new Date(ghqDb.informePdfFecha) : null,
    };
  }

  const dassByDayMap = new Map();
  let latestDass = null;

  for (const row of dassHistoryRows) {
    const itemMap = parseItemScores(String(row.resultados || ''));
    if (!itemMap || itemMap.size < 21) continue;

    const depRaw = sumItems(itemMap, DASS_DEP_ITEMS);
    const anxRaw = sumItems(itemMap, DASS_ANX_ITEMS);
    const strRaw = sumItems(itemMap, DASS_STR_ITEMS);
    const dateObj = parseResultDate(row.resultados, row.fechaCompletado);

    if (!latestDass || (dateObj && (!latestDass.dateObj || dateObj.getTime() > latestDass.dateObj.getTime()))) {
      latestDass = {
        depRaw,
        anxRaw,
        strRaw,
        dateObj: dateObj || null,
      };
    }

    if (dateObj) {
      const dayKey = dateObj.toISOString().slice(0, 10);
      const current = dassByDayMap.get(dayKey) || { depSum: 0, anxSum: 0, strSum: 0, count: 0 };
      current.depSum += depRaw;
      current.anxSum += anxRaw;
      current.strSum += strRaw;
      current.count += 1;
      dassByDayMap.set(dayKey, current);
    }
  }

  if (!latestDass && dassDb) {
    latestDass = {
      depRaw: Number(dassDb.puntajeDep || 0),
      anxRaw: Number(dassDb.puntajeAns || 0),
      strRaw: Number(dassDb.puntajeEstr || 0),
      dateObj: dassDb.informePdfFecha ? new Date(dassDb.informePdfFecha) : null,
    };
  }

  const ghqByDay = [...ghqByDayMap.entries()]
    .map(([date, d]) => ({
      date,
      score: Number((d.scoreSum / d.count).toFixed(2)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!ghqByDay.length && latestGhq?.dateObj) {
    ghqByDay.push({
      date: latestGhq.dateObj.toISOString().slice(0, 10),
      score: Number((latestGhq.score || 0).toFixed(2)),
    });
  }

  const dassByDay = [...dassByDayMap.entries()]
    .map(([date, d]) => ({
      date,
      dep: Number((d.depSum / d.count).toFixed(2)),
      anx: Number((d.anxSum / d.count).toFixed(2)),
      str: Number((d.strSum / d.count).toFixed(2)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!dassByDay.length && latestDass?.dateObj) {
    dassByDay.push({
      date: latestDass.dateObj.toISOString().slice(0, 10),
      dep: Number((latestDass.depRaw || 0).toFixed(2)),
      anx: Number((latestDass.anxRaw || 0).toFixed(2)),
      str: Number((latestDass.strRaw || 0).toFixed(2)),
    });
  }

  const ghqSubscales = Object.values(GHQ_SUBSCALE_DEFS).map((def) => ({
    name: def.label,
    value: latestGhq?.itemMap ? Number(sumItems(latestGhq.itemMap, def.items).toFixed(2)) : 0,
    max: 6,
  }));

  const depLevel = latestDass ? dassDepressionLevel(latestDass.depRaw) : 'Sin datos';
  const anxLevel = latestDass ? dassAnxietyLevel(latestDass.anxRaw) : 'Sin datos';
  const strLevel = latestDass ? dassStressLevel(latestDass.strRaw) : 'Sin datos';
  const worstDassRank = latestDass ? Math.max(DASS_LEVEL_RANK[depLevel] || 0, DASS_LEVEL_RANK[anxLevel] || 0, DASS_LEVEL_RANK[strLevel] || 0) : 0;
  const worstDassLevel = Object.keys(DASS_LEVEL_RANK).find((k) => DASS_LEVEL_RANK[k] === worstDassRank) || 'Sin datos';

  const combinedRisk = computeCombinedRisk({
    ghqScore: latestGhq ? Number(latestGhq.score || 0) : null,
    dassDep: latestDass ? Number(latestDass.depRaw || 0) : null,
    dassAnx: latestDass ? Number(latestDass.anxRaw || 0) : null,
    dassStr: latestDass ? Number(latestDass.strRaw || 0) : null,
  });

  const latestTestDate = [latestGhq?.dateObj || null, latestDass?.dateObj || null]
    .filter((d) => d && !isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;

  return {
    student: {
      idUsuario: String(user.idUsuario),
      fullName,
      email: user.correo ? String(user.correo) : '',
      phone: user.telefonoPersonal ? String(user.telefonoPersonal) : '',
    },
    summary: {
      latestTestDate: toIsoOrNull(latestTestDate),
      combinedRisk,
    },
    ghq12: {
      hasData: Boolean(latestGhq),
      score: latestGhq ? Number(latestGhq.score || 0) : null,
      riskLabel: latestGhq ? ghqRiskLabel(latestGhq.score) : 'Sin datos',
      completedAt: toIsoOrNull(latestGhq?.dateObj || null),
      hasPdf: Number(ghqDb?.hasPdf || 0) > 0,
      pdf: Number(ghqDb?.hasPdf || 0) > 0
        ? {
            id: String(ghqDb.idGhq12),
            filename: ghqDb.informePdfNombre ? String(ghqDb.informePdfNombre) : null,
          }
        : null,
      hasSubscaleData: Boolean(latestGhq?.itemMap),
      subscales: ghqSubscales,
      byDay: ghqByDay,
    },
    dass21: {
      hasData: Boolean(latestDass),
      completedAt: toIsoOrNull(latestDass?.dateObj || null),
      hasPdf: Number(dassDb?.hasPdf || 0) > 0,
      pdf: Number(dassDb?.hasPdf || 0) > 0
        ? {
            id: String(dassDb.idDass21),
            filename: dassDb.informePdfNombre ? String(dassDb.informePdfNombre) : null,
          }
        : null,
      current: latestDass
        ? {
            dep: Number(latestDass.depRaw || 0),
            anx: Number(latestDass.anxRaw || 0),
            str: Number(latestDass.strRaw || 0),
          }
        : {
            dep: 0,
            anx: 0,
            str: 0,
          },
      levels: {
        dep: depLevel,
        anx: anxLevel,
        str: strLevel,
        worst: worstDassLevel,
      },
      byDay: dassByDay,
    },
  };
};

export function registerDashboardRoutes(server) {
  server.get('/v1/dashboard/summary', async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      if (auth.role !== 'admin') return json(res, 403, { error: 'No autorizado' });
      const practitionerEmail = req.query?.practicante || null;
      return json(res, 200, await getDashboardSummary(practitionerEmail));
    } catch (error) {
      console.error('Error /v1/dashboard/summary:', error);
      return json(res, 500, { error: 'Error interno del servidor' });
    }
  });

  server.get('/v1/dashboard/students/:userId', async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      if (auth.role !== 'admin') return json(res, 403, { error: 'No autorizado' });

      const userId = String(req.params?.userId || '').trim();
      if (!userId) return json(res, 400, { error: 'userId requerido' });

      const detail = await buildStudentDashboardDetail(userId);
      if (!detail) return json(res, 404, { error: 'Estudiante no encontrado' });

      return json(res, 200, detail);
    } catch (error) {
      console.error('Error /v1/dashboard/students/:userId:', error);
      return json(res, 500, { error: 'Error al consultar detalle del estudiante' });
    }
  });

  server.get('/v1/dashboard/my-results', async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;

      const tests = await prisma.historialTest.findMany({
        where: { usuarioId: auth.user.idUsuario },
        orderBy: { fechaCompletado: 'desc' },
        take: 20,
        select: {
          id: true,
          tipoTest: true,
          fechaCompletado: true,
          resultados: true,
        },
      }).catch(() => []);

      const mapType = (tipo) => {
        const t = String(tipo || '').toLowerCase();
        if (t.includes('ghq12')) return 'GHQ-12';
        if (t.includes('dass21')) return 'DASS-21';
        return 'Test';
      };

      const out = tests.map((row) => ({
        id: String(row.id),
        testType: mapType(row.tipoTest),
        completedAt: row.fechaCompletado,
        score: 0,
        maxScore: String(row.tipoTest || '').toLowerCase().includes('ghq12') ? 36 : 63,
        riskLevel: 'No disponible',
        summary: String(row.resultados || '').slice(0, 240),
      }));

      return json(res, 200, out);
    } catch (error) {
      console.error('Error /v1/dashboard/my-results:', error);
      return json(res, 500, { error: 'Error al consultar resultados del usuario' });
    }
  });

  server.get('/v1/dashboard/my-appointments', async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;

      const rows = await prisma.registroCitas.findMany({
        where: { idUsuario: auth.user.idUsuario },
        orderBy: { fechaHora: 'desc' },
        take: 20,
        select: {
          idCita: true,
          fechaHora: true,
          estado: true,
          practicante: { select: { nombre: true } },
        },
      }).catch(() => []);

      const statusMap = (estado) => {
        const v = String(estado || '').toLowerCase();
        if (v.includes('cancel')) return 'cancelada';
        if (v.includes('complet') || v.includes('finaliz') || v.includes('atendid')) return 'completada';
        if (v.includes('confirm')) return 'confirmada';
        return 'pendiente';
      };

      const out = rows.map((row) => {
        const date = row.fechaHora ? new Date(row.fechaHora) : new Date();
        return {
          id: String(row.idCita || ''),
          date: date.toISOString(),
          time: date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
          practitionerName: row.practicante?.nombre || 'Sin asignar',
          status: statusMap(row.estado),
        };
      });

      return json(res, 200, out);
    } catch (error) {
      console.error('Error /v1/dashboard/my-appointments:', error);
      return json(res, 500, { error: 'Error al consultar citas del usuario' });
    }
  });

  server.get('/v1/practitioners', async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      if (auth.role !== 'admin') return json(res, 403, { error: 'No autorizado' });
      const page = Math.max(1, Number(req.query?.page || 1));
      const pageSize = Math.min(100, Math.max(1, Number(req.query?.pageSize || 10)));
      const search = String(req.query?.search || '').trim();
      const where = search ? { OR: [{ nombre: { contains: search } }, { numero_documento: { contains: search } }, { correo: { contains: search } }, { telefono: { contains: search } }] } : undefined;
      const [total, rows] = await Promise.all([
        prisma.practicante.count({ where }),
        prisma.practicante.findMany({ where, orderBy: { fechaCreacion: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      ]);
      return json(res, 200, { data: rows.map(toPractitionerDto), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
    } catch (error) {
      console.error('Error /v1/practitioners:', error);
      return json(res, 500, { error: 'Error interno del servidor' });
    }
  });

  server.get('/v1/practitioners/stats', async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      if (auth.role !== 'admin') return json(res, 403, { error: 'No autorizado' });
      const [total, inactive] = await Promise.all([prisma.practicante.count(), prisma.practicante.count({ where: { fechaFin: { not: null } } })]);
      return json(res, 200, { total, active: total - inactive, inactive });
    } catch (error) {
      console.error('Error /v1/practitioners/stats:', error);
      return json(res, 500, { error: 'Error interno del servidor' });
    }
  });

  server.post('/v1/practitioners', async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      if (auth.role !== 'admin') return json(res, 403, { error: 'No autorizado' });
      const body = req.body || {};
      const created = await prisma.practicante.create({
        data: {
          nombre: `${String(body.name || '').trim()} ${String(body.lastName || '').trim()}`.trim() || String(body.name || '').trim(),
          numero_documento: String(body.documentNumber || '').trim(),
          tipo_documento: String(body.documentType || 'CC').trim(),
          genero: String(body.gender || 'No especificado').trim(),
          telefono: String(body.phone || `${Date.now()}`).trim(),
          correo: body.email ? String(body.email).trim().toLowerCase() : null,
          eps_ips: body.eps ? String(body.eps).trim() : null,
          clinica: body.clinic ? String(body.clinic).trim() : null,
          fechaInicio: body.startDate ? new Date(body.startDate) : null,
          fechaFin: body.endDate ? new Date(body.endDate) : null,
          flujo: 'practMenuFlow',
        },
      });
      return json(res, 201, { data: toPractitionerDto(created) });
    } catch (error) {
      console.error('Error /v1/practitioners POST:', error);
      return json(res, 500, { error: 'Error al crear practicante' });
    }
  });

  server.put('/v1/practitioners/:id', async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      if (auth.role !== 'admin') return json(res, 403, { error: 'No autorizado' });
      const body = req.body || {};
      const updated = await prisma.practicante.update({
        where: { idPracticante: req.params.id },
        data: {
          nombre: `${String(body.name || '').trim()} ${String(body.lastName || '').trim()}`.trim() || String(body.name || '').trim(),
          numero_documento: String(body.documentNumber || '').trim(),
          genero: String(body.gender || 'No especificado').trim(),
          telefono: String(body.phone || '').trim() || undefined,
          correo: body.email ? String(body.email).trim().toLowerCase() : null,
          eps_ips: body.eps ? String(body.eps).trim() : null,
          clinica: body.clinic ? String(body.clinic).trim() : null,
          fechaInicio: body.startDate ? new Date(body.startDate) : null,
          fechaFin: body.active === false ? new Date() : (body.endDate ? new Date(body.endDate) : null),
        },
      });
      return json(res, 200, { data: toPractitionerDto(updated) });
    } catch (error) {
      console.error('Error /v1/practitioners PUT:', error);
      return json(res, 500, { error: 'Error al actualizar practicante' });
    }
  });

  server.delete('/v1/practitioners/:id', async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      if (auth.role !== 'admin') return json(res, 403, { error: 'No autorizado' });

      const deleted = await prisma.$transaction(async (tx) => {
        const existing = await tx.practicante.findUnique({
          where: { idPracticante: req.params.id },
          select: { idPracticante: true, nombre: true },
        });

        if (!existing) return null;

        await tx.informacionUsuario.updateMany({
          where: { practicanteAsignado: existing.idPracticante },
          data: { practicanteAsignado: null },
        });

        await tx.horario.deleteMany({ where: { practicanteId: existing.idPracticante } });
        await tx.registroCitas.deleteMany({ where: { idPracticante: existing.idPracticante } });

        if (existing.nombre) {
          await tx.cita.deleteMany({ where: { nombrePracticante: existing.nombre } });
        }

        await tx.practicante.delete({ where: { idPracticante: existing.idPracticante } });
        return existing;
      });

      if (!deleted) return json(res, 404, { error: 'Practicante no encontrado' });

      return json(res, 200, { message: 'Practicante eliminado correctamente' });
    } catch (error) {
      console.error('Error /v1/practitioners DELETE:', error);
      return json(res, 500, { error: 'No se pudo eliminar el practicante. Verifica si tiene datos relacionados.' });
    }
  });

  server.get('/v1/pdfs', async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;

      const page = Math.max(1, Number(req.query?.page || 1));
      const pageSize = Math.min(100, Math.max(1, Number(req.query?.pageSize || 20)));
      const source = String(req.query?.source || 'all').toLowerCase();
      const search = String(req.query?.search || '').trim().toLowerCase();
      const records = [];

      if (source === 'all' || source === 'database') {
        const [ghqDb, dassDb] = await Promise.all([
          prisma.ghq12.findMany({ where: { informePdf: { not: null } }, select: { idGhq12: true, informePdfNombre: true, informePdfFecha: true, telefono: true } }),
          prisma.dass21.findMany({ where: { informePdf: { not: null } }, select: { idDass21: true, informePdfNombre: true, informePdfFecha: true, telefono: true } }),
        ]);
        const phones = [...new Set([...ghqDb.map((r) => r.telefono), ...dassDb.map((r) => r.telefono)])];
        const users = phones.length
          ? await prisma.informacionUsuario.findMany({ where: { telefonoPersonal: { in: phones } }, select: { idUsuario: true, telefonoPersonal: true, primerNombre: true, segundoNombre: true, primerApellido: true, segundoApellido: true, practicanteAsignado: true } })
          : [];

        const userIds = users.map((u) => u.idUsuario).filter(Boolean);
        const latestAssignments = userIds.length
          ? await prisma.registroCitas.findMany({
            where: { idUsuario: { in: userIds } },
            select: { idUsuario: true, idPracticante: true, fechaHora: true },
            orderBy: { fechaHora: 'desc' },
          })
          : [];

        const latestPractitionerByUser = new Map();
        for (const row of latestAssignments) {
          if (!row?.idUsuario || !row?.idPracticante) continue;
          if (!latestPractitionerByUser.has(row.idUsuario)) {
            latestPractitionerByUser.set(row.idUsuario, row.idPracticante);
          }
        }

        const userByPhone = new Map(users.map((u) => [u.telefonoPersonal, u]));
        const practIds = [...new Set([
          ...users.map((u) => u.practicanteAsignado).filter(Boolean),
          ...latestAssignments.map((r) => r.idPracticante).filter(Boolean),
        ])];
        const practitioners = practIds.length ? await prisma.practicante.findMany({ where: { idPracticante: { in: practIds } }, select: { idPracticante: true, nombre: true } }) : [];
        const practById = new Map(practitioners.map((p) => [p.idPracticante, p.nombre]));

        for (const row of ghqDb) {
          const user = userByPhone.get(row.telefono);
          const patientName = user ? [user.primerNombre, user.segundoNombre, user.primerApellido, user.segundoApellido].filter(Boolean).join(' ') : 'Sin paciente';
          const practId = user?.practicanteAsignado || (user?.idUsuario ? latestPractitionerByUser.get(user.idUsuario) : null);
          const practName = practId ? practById.get(practId) : null;
          records.push({ id: `ghq12:${row.idGhq12}`, filename: row.informePdfNombre || `reporte_ghq12_${row.idGhq12}.pdf`, path: `/v1/pdfs/file?source=database&id=ghq12:${row.idGhq12}`, uploadedAt: row.informePdfFecha || new Date(), source: 'database', patient: { id: row.telefono, name: patientName }, practitioner: practName ? { id: String(practId || ''), name: practName } : null });
        }
        for (const row of dassDb) {
          const user = userByPhone.get(row.telefono);
          const patientName = user ? [user.primerNombre, user.segundoNombre, user.primerApellido, user.segundoApellido].filter(Boolean).join(' ') : 'Sin paciente';
          const practId = user?.practicanteAsignado || (user?.idUsuario ? latestPractitionerByUser.get(user.idUsuario) : null);
          const practName = practId ? practById.get(practId) : null;
          records.push({ id: `dass21:${row.idDass21}`, filename: row.informePdfNombre || `reporte_dass21_${row.idDass21}.pdf`, path: `/v1/pdfs/file?source=database&id=dass21:${row.idDass21}`, uploadedAt: row.informePdfFecha || new Date(), source: 'database', patient: { id: row.telefono, name: patientName }, practitioner: practName ? { id: String(practId || ''), name: practName } : null });
        }
      }

      if (source === 'all' || source === 'email') {
        const emailRows = await prisma.$queryRawUnsafe(`
          SELECT id, mailbox, uid, attachment_index, part, filename, size_bytes, uploaded_at, patient_name, practitioner_name
          FROM email_pdf_cache
          ORDER BY uploaded_at DESC
          LIMIT 3000
        `).catch(() => []);
        for (const row of emailRows) {
          records.push({
            id: String(row.id),
            filename: String(row.filename || 'reporte.pdf'),
            path: `/v1/pdfs/file?source=email&id=${encodeURIComponent(String(row.id))}`,
            sizeBytes: Number(row.size_bytes || 0),
            uploadedAt: row.uploaded_at || new Date(),
            source: 'email',
            emailMeta: { mailbox: String(row.mailbox || 'INBOX'), uid: Number(row.uid || 0), attachmentIndex: Number(row.attachment_index || 0), part: row.part ? String(row.part) : undefined },
            patient: { id: String(row.id), name: String(row.patient_name || 'Sin paciente') },
            practitioner: { id: String(row.id), name: String(row.practitioner_name || 'Sin asignar') },
          });
        }
      }

      const normalized = records
        .filter((item) => !search || `${item.filename} ${item.patient?.name || ''} ${item.practitioner?.name || ''}`.toLowerCase().includes(search))
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      const total = normalized.length;
      const start = (page - 1) * pageSize;
      const data = normalized.slice(start, start + pageSize);

      if (auth.role === 'admin') {
        return json(res, 200, { data, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), hasMore: start + data.length < total });
      }
      return json(res, 200, data);
    } catch (error) {
      console.error('Error /v1/pdfs:', error);
      return json(res, 500, { error: 'Error al consultar PDFs' });
    }
  });

  server.get('/v1/pdfs/file', async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      const source = String(req.query?.source || 'database');
      const id = String(req.query?.id || '');
      const filename = String(req.query?.filename || 'reporte.pdf');
      const asDownload = req.query?.download === '1';

      if (source === 'database') {
        const [kind, rawId] = id.split(':');
        if (kind === 'ghq12') {
          const row = await prisma.ghq12.findUnique({ where: { idGhq12: rawId }, select: { informePdf: true, informePdfNombre: true } });
          if (!row?.informePdf) return json(res, 404, { error: 'PDF no encontrado' });
          const outName = row.informePdfNombre || filename;
          res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `${asDownload ? 'attachment' : 'inline'}; filename="${outName}"` });
          return res.end(Buffer.from(row.informePdf));
        }
        if (kind === 'dass21') {
          const row = await prisma.dass21.findUnique({ where: { idDass21: rawId }, select: { informePdf: true, informePdfNombre: true } });
          if (!row?.informePdf) return json(res, 404, { error: 'PDF no encontrado' });
          const outName = row.informePdfNombre || filename;
          res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `${asDownload ? 'attachment' : 'inline'}; filename="${outName}"` });
          return res.end(Buffer.from(row.informePdf));
        }
        return json(res, 400, { error: 'ID de PDF inválido' });
      }

      if (source === 'email') {
        const rows = await prisma.$queryRawUnsafe('SELECT local_path, filename FROM email_pdf_cache WHERE id = ? LIMIT 1', id).catch(() => []);
        const row = rows?.[0];
        if (!row?.local_path) return json(res, 404, { error: 'Archivo de correo no disponible localmente' });
        if (!fs.existsSync(row.local_path)) return json(res, 404, { error: 'Archivo local no encontrado' });
        const outName = row.filename || filename;
        res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `${asDownload ? 'attachment' : 'inline'}; filename="${outName}"` });
        return res.end(fs.readFileSync(row.local_path));
      }

      return json(res, 400, { error: 'source inválido' });
    } catch (error) {
      console.error('Error /v1/pdfs/file:', error);
      return json(res, 500, { error: 'Error al abrir PDF' });
    }
  });

  server.post('/v1/pdfs/sync', async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      if (auth.role !== 'admin') return json(res, 403, { error: 'No autorizado' });
      const rows = await prisma.$queryRawUnsafe('SELECT COUNT(*) c FROM email_pdf_cache').catch(() => [{ c: 0 }]);
      return json(res, 200, { synced: Number(rows?.[0]?.c || 0), pdfs: [] });
    } catch (error) {
      console.error('Error /v1/pdfs/sync:', error);
      return json(res, 500, { error: 'Error al sincronizar PDFs' });
    }
  });
}
