import { prisma } from '../lib/prisma.js';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
const JWT_SECRET = process.env.JWT_SECRET;

const RISK_LEVELS = ['bajo', 'medio', 'alto', 'critico'];
const RISK_COLORS = { bajo: '#15803d', medio: '#b45309', alto: '#dc2626', critico: '#991b1b' };
const APPOINTMENT_COLORS = { programada: '#2f6ee5', completada: '#15803d', cancelada: '#dc2626', reagendada: '#b45309' };
const PERIODS = new Set(['week', 'month', 'year']);

const normalizePeriod = (value) => (PERIODS.has(value) ? value : 'month');
const toDayKey = (date) => date.toISOString().slice(0, 10);
const toMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();
const buildNameKey = (firstName, lastName) => `${normalizeText(firstName)}|${normalizeText(lastName)}`;
const normalizePhone = (value) => String(value || '').replace(/\D/g, '');
const buildPhoneCandidates = (value) => {
  const base = normalizePhone(value);
  if (!base) return [];
  const out = new Set([base]);
  if (base.startsWith('57') && base.length > 2) out.add(base.slice(2));
  else out.add(`57${base}`);
  return [...out];
};

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

  // Admin autenticado por variables de entorno — no existe en BD
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

const getPeriodStart = (period, now) => {
  const start = new Date(now);
  if (period === 'week') start.setDate(now.getDate() - 6);
  else if (period === 'month') start.setDate(now.getDate() - 29);
  else {
    start.setFullYear(now.getFullYear() - 1);
    start.setDate(1);
  }
  start.setHours(0, 0, 0, 0);
  return start;
};

const safeTrend = (current, previous) => {
  if (previous === 0 && current > 0) return 100;
  if (previous === 0) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

const getBuckets = (period, now) => {
  if (period === 'year') {
    const out = [];
    const base = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let i = 11; i >= 0; i -= 1) {
      const start = new Date(base.getFullYear(), base.getMonth() - i, 1);
      out.push({ key: toMonthKey(start), name: start.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '') });
    }
    return out;
  }

  const days = period === 'week' ? 7 : 30;
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const start = new Date(now);
    start.setDate(now.getDate() - i);
    start.setHours(0, 0, 0, 0);
    out.push({ key: toDayKey(start), name: start.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit' }).replace('.', '') });
  }
  return out;
};

const aggregateByBucket = (dates, buckets, keyBuilder) => {
  const map = new Map(buckets.map((b) => [b.key, 0]));
  for (const d of dates) {
    const key = keyBuilder(d);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return buckets.map((b) => ({ name: b.name, value: map.get(b.key) || 0 }));
};

const parseResponses = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
};

const normalizeHistorialTestType = (value) => {
  const normalized = normalizeText(value);
  if (normalized.includes('ghq12')) return 'ghq12';
  if (normalized.includes('dass21')) return 'dass21';
  return null;
};

const ghqRiskLevel = (score) => {
  if (score >= 20) return 'critico';
  if (score >= 16) return 'alto';
  if (score >= 12) return 'medio';
  return 'bajo';
};

const dassBand = (subscale, score) => {
  if (subscale === 'dep') {
    if (score >= 14) return 'extremo';
    if (score >= 11) return 'severo';
    if (score >= 7) return 'moderado';
    if (score >= 5) return 'leve';
    return 'normal';
  }
  if (subscale === 'anx') {
    if (score >= 10) return 'extremo';
    if (score >= 8) return 'severo';
    if (score >= 6) return 'moderado';
    if (score >= 4) return 'leve';
    return 'normal';
  }
  if (score >= 17) return 'extremo';
  if (score >= 13) return 'severo';
  if (score >= 10) return 'moderado';
  if (score >= 8) return 'leve';
  return 'normal';
};

const riskFromDassBand = (band) => {
  if (band === 'extremo') return 'critico';
  if (band === 'severo') return 'alto';
  if (band === 'moderado') return 'medio';
  return 'bajo';
};

const worstRisk = (levels) => {
  const order = { bajo: 0, medio: 1, alto: 2, critico: 3 };
  return levels.reduce((a, b) => (order[b] > order[a] ? b : a), 'bajo');
};

const getDashboardSummary = async (period) => {
  const now = new Date();
  const periodStart = getPeriodStart(period, now);
  const previousStart = new Date(periodStart.getTime() - (now.getTime() - periodStart.getTime()));

  const [
    totalPatients,
    newPatientsThisPeriod,
    prevPeriodPatients,
    totalAppointments,
    pendingAppointments,
    completedAppointments,
    cancelledAppointments,
    rescheduledAppointments,
    testsPendingRows,
    activePractitioners,
    historialRows,
    socialIsolationRows,
    patientRows,
    appointmentPeriod,
    appointmentPrev,
    growthRows,
    workloadRows,
  ] = await Promise.all([
    prisma.informacionUsuario.count().catch(() => 0),
    prisma.informacionUsuario.count({ where: { fechaCreacion: { gte: periodStart, lte: now } } }).catch(() => 0),
    prisma.informacionUsuario.count({ where: { fechaCreacion: { gte: previousStart, lt: periodStart } } }).catch(() => 0),
    prisma.registroCitas.count().catch(() => 0),
    prisma.registroCitas.count({ where: { estado: { in: ['pendiente', 'programada'] } } }).catch(() => 0),
    prisma.registroCitas.count({ where: { estado: { in: ['completada', 'atendida', 'finalizada'] } } }).catch(() => 0),
    prisma.registroCitas.count({ where: { estado: { startsWith: 'cancel' } } }).catch(() => 0),
    prisma.registroCitas.count({ where: { estado: { startsWith: 'reagend' } } }).catch(() => 0),
    prisma.informacionUsuario.groupBy({ by: ['testActual'], _count: { _all: true } }).catch(() => []),
    prisma.practicante.count().catch(() => 0),
    prisma.historialTest.findMany({
      select: { usuarioId: true, tipoTest: true, fechaCompletado: true },
      orderBy: { fechaCompletado: 'desc' },
    }).catch(() => []),
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS c
      FROM informacion_sociodemografica
      WHERE LOWER(COALESCE(conQuienVive, '')) LIKE '%solo%'
    `).catch(() => [{ c: 0 }]),
    prisma.informacionUsuario.findMany({ select: { flujo: true, estado: true, fechaCreacion: true } }).catch(() => []),
    prisma.registroCitas.count({ where: { fechaHora: { gte: periodStart, lte: now } } }).catch(() => 0),
    prisma.registroCitas.count({ where: { fechaHora: { gte: previousStart, lt: periodStart } } }).catch(() => 0),
    prisma.informacionUsuario.findMany({ where: { fechaCreacion: { gte: new Date(now.getFullYear() - 1, now.getMonth(), 1), lte: now } }, select: { fechaCreacion: true } }).catch(() => []),
    prisma.$queryRawUnsafe(`
      SELECT p.idPracticante AS id, p.nombre AS name,
             COUNT(DISTINCT u.idUsuario) AS patients,
             COUNT(DISTINCT rc.idCita) AS appointments
      FROM practicante p
      LEFT JOIN informacionUsuario u ON u.practicanteAsignado = p.idPracticante
      LEFT JOIN registroCitas rc ON rc.idPracticante = p.idPracticante
      GROUP BY p.idPracticante, p.nombre
      ORDER BY patients DESC
      LIMIT 10
    `).catch(() => []),
  ]);

  const allTestLogs = historialRows
    .map((row) => ({
      usuarioId: String(row.usuarioId || ''),
      tipo: normalizeHistorialTestType(row.tipoTest),
      fechaCompletado: row.fechaCompletado ? new Date(row.fechaCompletado) : null,
    }))
    .filter((row) => row.usuarioId && row.tipo && row.fechaCompletado && !Number.isNaN(row.fechaCompletado.getTime()));

  const testsCompleted = allTestLogs.length;
  const testsCompletedThisPeriod = allTestLogs.filter((row) => row.fechaCompletado >= periodStart && row.fechaCompletado <= now).length;
  const testsCompletedPrevPeriod = allTestLogs.filter((row) => row.fechaCompletado >= previousStart && row.fechaCompletado < periodStart).length;

  const latestByUserAndType = new Map();
  for (const row of allTestLogs) {
    const key = `${row.usuarioId}|${row.tipo}`;
    if (!latestByUserAndType.has(key)) {
      latestByUserAndType.set(key, row);
    }
  }
  const latestTestLogs = [...latestByUserAndType.values()];
  const latestGhqLogs = latestTestLogs.filter((row) => row.tipo === 'ghq12');
  const latestDassLogs = latestTestLogs.filter((row) => row.tipo === 'dass21');

  const latestUserIds = [...new Set(latestTestLogs.map((row) => row.usuarioId))];
  const latestUsers = latestUserIds.length
    ? await prisma.informacionUsuario.findMany({
      where: { idUsuario: { in: latestUserIds } },
      select: { idUsuario: true, telefonoPersonal: true },
    }).catch(() => [])
    : [];
  const phoneByUserId = new Map(
    latestUsers
      .filter((u) => u.idUsuario && u.telefonoPersonal)
      .map((u) => [u.idUsuario, u.telefonoPersonal]),
  );

  const phonesForLatestLogs = [...new Set(latestUsers.map((u) => u.telefonoPersonal).filter(Boolean))];
  const [ghqRowsByPhone, dassRowsByPhone] = phonesForLatestLogs.length
    ? await Promise.all([
      prisma.ghq12.findMany({
        where: { telefono: { in: phonesForLatestLogs } },
        select: { telefono: true, Puntaje: true, resPreg: true, informePdfFecha: true },
      }).catch(() => []),
      prisma.dass21.findMany({
        where: { telefono: { in: phonesForLatestLogs } },
        select: { telefono: true, puntajeDep: true, puntajeAns: true, puntajeEstr: true, respuestas: true, resPreg: true, informePdfFecha: true },
      }).catch(() => []),
    ])
    : [[], []];

  const ghqByPhone = new Map(ghqRowsByPhone.map((row) => [row.telefono, row]));
  const dassByPhone = new Map(dassRowsByPhone.map((row) => [row.telefono, row]));

  const ghqSourceRows = latestGhqLogs
    .map((log) => {
      const phone = phoneByUserId.get(log.usuarioId);
      const row = phone ? ghqByPhone.get(phone) : null;
      if (!row) return null;
      return { ...row, completedAt: log.fechaCompletado };
    })
    .filter(Boolean);

  const dassSourceRowsRaw = latestDassLogs
    .map((log) => {
      const phone = phoneByUserId.get(log.usuarioId);
      const row = phone ? dassByPhone.get(phone) : null;
      if (!row) return null;
      return { ...row, completedAt: log.fechaCompletado };
    })
    .filter(Boolean);

  // ── DASS-21: calculate real scores from respuestas if puntaje fields are 0 ──
  // DASS-21 subscale item indices (1-based): Dep=3,5,10,13,16,17,21  Anx=2,4,7,9,15,19,20  Str=1,6,8,11,12,14,18
  const DASS_DEP_ITEMS = [3, 5, 10, 13, 16, 17, 21];
  const DASS_ANX_ITEMS = [2, 4, 7, 9, 15, 19, 20];
  const DASS_STR_ITEMS = [1, 6, 8, 11, 12, 14, 18];

  const calcDassFromResponses = (respuestas) => {
    if (!respuestas) return null;
    let arr = respuestas;
    if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { return null; } }
    if (!Array.isArray(arr) || arr.length < 21) return null;
    const sumItems = (items) => items.reduce((sum, idx) => sum + Number(arr[idx - 1] || 0), 0);
    return { dep: sumItems(DASS_DEP_ITEMS), anx: sumItems(DASS_ANX_ITEMS), str: sumItems(DASS_STR_ITEMS) };
  };

  const dassSourceRows = dassSourceRowsRaw.map((row) => {
    const hasScores = Number(row.puntajeDep || 0) > 0 || Number(row.puntajeAns || 0) > 0 || Number(row.puntajeEstr || 0) > 0;
    if (hasScores) return row;
    const calculated = calcDassFromResponses(row.respuestas);
    if (calculated) {
      return { ...row, puntajeDep: calculated.dep, puntajeAns: calculated.anx, puntajeEstr: calculated.str };
    }
    return row;
  });

  const ghqCount = ghqSourceRows.length;
  const dassCount = dassSourceRows.length;

  const riskTotals = { bajo: 0, medio: 0, alto: 0, critico: 0 };
  const ghqRiskTotals = { bajo: 0, medio: 0, alto: 0, critico: 0 };
  for (const row of ghqSourceRows) {
    const level = ghqRiskLevel(Number(row.Puntaje || 0));
    riskTotals[level] += 1;
    ghqRiskTotals[level] += 1;
  }

  const dassLevels = {
    dep: { bajo: 0, medio: 0, alto: 0, critico: 0 },
    anx: { bajo: 0, medio: 0, alto: 0, critico: 0 },
    str: { bajo: 0, medio: 0, alto: 0, critico: 0 },
    total: { bajo: 0, medio: 0, alto: 0, critico: 0 },
  };
  let depSum = 0; let anxSum = 0; let strSum = 0;
  for (const row of dassSourceRows) {
    const dep = riskFromDassBand(dassBand('dep', Number(row.puntajeDep || 0)));
    const anx = riskFromDassBand(dassBand('anx', Number(row.puntajeAns || 0)));
    const str = riskFromDassBand(dassBand('str', Number(row.puntajeEstr || 0)));
    const totalLevel = worstRisk([dep, anx, str]);
    depSum += Number(row.puntajeDep || 0);
    anxSum += Number(row.puntajeAns || 0);
    strSum += Number(row.puntajeEstr || 0);
    dassLevels.dep[dep] += 1; dassLevels.anx[anx] += 1; dassLevels.str[str] += 1; dassLevels.total[totalLevel] += 1;
    riskTotals[totalLevel] += 1;
  }

  const ghqSubscaleDef = {
    'Funcionamiento cognitivo': [1, 4],
    'Ansiedad / tension': [2, 5],
    'Funcionamiento psicosocial': [3, 7],
    Afrontamiento: [6, 8],
    'Estado de animo depresivo': [9, 12],
    Autoestima: [10, 11],
  };
  const subTotals = {}; const subCounts = {};
  for (const key of Object.keys(ghqSubscaleDef)) { subTotals[key] = 0; subCounts[key] = 0; }
  for (const row of ghqSourceRows) {
    const responses = parseResponses(row.resPreg);
    if (!responses) continue;
    const itemScores = new Map();
    for (const [scoreStr, items] of Object.entries(responses)) {
      const score = Number(scoreStr);
      if (!Array.isArray(items)) continue;
      for (const item of items) itemScores.set(Number(item), score);
    }
    for (const [name, items] of Object.entries(ghqSubscaleDef)) {
      let sum = 0; let valid = 0;
      for (const item of items) {
        if (itemScores.has(item)) { sum += Number(itemScores.get(item)); valid += 1; }
      }
      if (valid > 0) { subTotals[name] += sum; subCounts[name] += 1; }
    }
  }

  const ghq12Subscales = Object.entries(ghqSubscaleDef).map(([name, items]) => ({
    name,
    items: items.join(', '),
    average: subCounts[name] > 0 ? Number((subTotals[name] / subCounts[name]).toFixed(1)) : 0,
    maxPossible: items.length * 3,
  }));

  const ghqAvg = ghqSourceRows.length > 0 ? Number((ghqSourceRows.reduce((sum, row) => sum + Number(row.Puntaje || 0), 0) / ghqSourceRows.length).toFixed(1)) : 0;
  const depAvg = dassSourceRows.length > 0 ? Number((depSum / dassSourceRows.length).toFixed(1)) : 0;
  const anxAvg = dassSourceRows.length > 0 ? Number((anxSum / dassSourceRows.length).toFixed(1)) : 0;
  const strAvg = dassSourceRows.length > 0 ? Number((strSum / dassSourceRows.length).toFixed(1)) : 0;

  const activityBuckets = getBuckets(period, now);
  const activityDates = latestTestLogs
    .map((row) => row.fechaCompletado)
    .filter(Boolean)
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()));
  const activityData = aggregateByBucket(activityDates, activityBuckets, period === 'year' ? toMonthKey : toDayKey);

  const growthBuckets = (() => {
    const out = [];
    const base = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let i = 11; i >= 0; i -= 1) {
      const start = new Date(base.getFullYear(), base.getMonth() - i, 1);
      out.push({ key: toMonthKey(start), name: start.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '') });
    }
    return out;
  })();
  const growthData = aggregateByBucket(growthRows.map((row) => new Date(row.fechaCreacion)), growthBuckets, toMonthKey);

  const flowMap = new Map();
  const stateCounts = { aspirante: 0, registrado: totalPatients, con_cita: 0, activo: 0, inactivo: 0 };
  for (const row of patientRows) {
    const flow = String(row.flujo || 'register');
    flowMap.set(flow, (flowMap.get(flow) || 0) + 1);
    if (row.estado) stateCounts.activo += 1; else stateCounts.inactivo += 1;
  }
  stateCounts.aspirante = await prisma.aspirante.count().catch(() => 0);
  stateCounts.con_cita = await prisma.registroCitas.groupBy({ by: ['idUsuario'] }).then((rows) => rows.length).catch(() => 0);

  const patientFlowDistribution = ['register', 'assistantFlow', 'testFlow', 'agendFlow', 'finalFlow'].map((flow) => ({
    name: flow.replace('Flow', '').replace(/^./, (l) => l.toUpperCase()),
    value: flowMap.get(flow) || 0,
    color: '#4a8af4',
  }));

  const patientStateDistribution = [
    { name: 'Aspirante', value: stateCounts.aspirante, color: '#94a3b8' },
    { name: 'Registrado', value: stateCounts.registrado, color: '#4a8af4' },
    { name: 'Con cita', value: stateCounts.con_cita, color: '#2f6ee5' },
    { name: 'Activo', value: stateCounts.activo, color: '#15803d' },
    { name: 'Inactivo', value: stateCounts.inactivo, color: '#64748b' },
  ];

  const appointmentsByStatus = [
    { name: 'Programada', value: pendingAppointments, color: APPOINTMENT_COLORS.programada },
    { name: 'Completada', value: completedAppointments, color: APPOINTMENT_COLORS.completada },
    { name: 'Cancelada', value: cancelledAppointments, color: APPOINTMENT_COLORS.cancelada },
    { name: 'Reagendada', value: rescheduledAppointments, color: APPOINTMENT_COLORS.reagendada },
  ];

  const testsByType = [
    { name: 'GHQ12', completed: latestGhqLogs.length, pending: testsPendingRows.find((row) => String(row.testActual || '').toUpperCase().includes('GHQ'))?._count?._all || 0 },
    { name: 'DASS21', completed: latestDassLogs.length, pending: testsPendingRows.find((row) => String(row.testActual || '').toUpperCase().includes('DASS'))?._count?._all || 0 },
  ];

  const highRiskAlerts = riskTotals.alto + riskTotals.critico;

  return {
    period,
    totalPatients,
    newPatientsThisPeriod,
    totalAppointments,
    pendingAppointments,
    completedAppointments,
    cancelledAppointments,
    rescheduledAppointments,
    highRiskAlerts,
    testsCompleted,
    activePractitioners,
    trends: {
      patients: safeTrend(newPatientsThisPeriod, prevPeriodPatients),
      appointments: safeTrend(appointmentPeriod, appointmentPrev),
      alerts: safeTrend(highRiskAlerts, 0),
      tests: safeTrend(testsCompletedThisPeriod, testsCompletedPrevPeriod),
    },
    averages: { anxiety: anxAvg, depression: depAvg, stress: strAvg },
    activityData,
    growthData,
    riskDistribution: RISK_LEVELS.map((risk) => ({ name: risk.charAt(0).toUpperCase() + risk.slice(1), value: riskTotals[risk], color: RISK_COLORS[risk] })),
    psychEventsDistribution: [
      { type: 'ansiedad_severa', name: 'Ansiedad severa', value: dassLevels.anx.alto + dassLevels.anx.critico, color: '#2f6ee5' },
      { type: 'depresion_critica', name: 'Depresion critica', value: dassLevels.dep.critico, color: '#2f6ee5' },
      { type: 'estres_agudo', name: 'Estres agudo', value: dassLevels.str.alto + dassLevels.str.critico, color: '#2f6ee5' },
      { type: 'aislamiento_social', name: 'Aislamiento social', value: Number(socialIsolationRows?.[0]?.c || 0), color: '#2f6ee5' },
    ],
    patientStateDistribution,
    patientFlowDistribution,
    appointmentsByStatus,
    ghq12Distribution: RISK_LEVELS.map((risk) => ({ name: risk.charAt(0).toUpperCase() + risk.slice(1), value: ghqRiskTotals[risk], color: RISK_COLORS[risk] })),
    ghq12Subscales,
    ghq12Averages: { averageScore: ghqAvg, averageMentalHealth: ghqAvg, totalEvaluations: ghqCount },
    dass21Distribution: RISK_LEVELS.map((risk) => ({ name: risk.charAt(0).toUpperCase() + risk.slice(1), value: dassLevels.total[risk], color: RISK_COLORS[risk] })),
    dass21Subscales: [
      { name: 'Depresion', items: '3, 5, 10, 13, 16, 17, 21', average: depAvg, maxPossible: 42, levels: dassLevels.dep },
      { name: 'Ansiedad', items: '2, 4, 7, 9, 15, 19, 20', average: anxAvg, maxPossible: 42, levels: dassLevels.anx },
      { name: 'Estres', items: '1, 6, 8, 11, 12, 14, 18', average: strAvg, maxPossible: 42, levels: dassLevels.str },
    ],
    dass21Averages: { depression: depAvg, anxiety: anxAvg, stress: strAvg, totalEvaluations: dassCount },
    testsByType,
    practitionerWorkload: workloadRows.map((row) => ({ id: String(row.id), name: String(row.name || 'Sin nombre'), patients: Number(row.patients || 0), appointments: Number(row.appointments || 0) })),
  };
};

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

export function registerDashboardRoutes(server) {
  server.get('/v1/dashboard/summary', async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      if (auth.role !== 'admin') return json(res, 403, { error: 'No autorizado' });
      return json(res, 200, await getDashboardSummary(normalizePeriod(req.query?.periodo || req.query?.period)));
    } catch (error) {
      console.error('Error /v1/dashboard/summary:', error);
      return json(res, 500, { error: 'Error interno del servidor' });
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

        const userByPhone = new Map();
        for (const user of users) {
          const candidates = buildPhoneCandidates(user.telefonoPersonal);
          for (const candidate of candidates) {
            if (!userByPhone.has(candidate)) userByPhone.set(candidate, user);
          }
        }

        const unresolvedUsers = users.filter((u) => {
          const assigned = u.practicanteAsignado || (u.idUsuario ? latestPractitionerByUser.get(u.idUsuario) : null);
          return !assigned;
        });

        const userKey = (u) => buildNameKey(u.primerNombre, u.primerApellido);
        const unresolvedByKey = new Map(unresolvedUsers.map((u) => [userKey(u), u]));

        const citasByUserKey = unresolvedUsers.length
          ? await prisma.cita.findMany({
            where: {
              OR: unresolvedUsers.map((u) => ({
                primerNombre: String(u.primerNombre || ''),
                primerApellido: String(u.primerApellido || ''),
              })),
            },
            select: {
              primerNombre: true,
              primerApellido: true,
              nombrePracticante: true,
              fechaHora: true,
            },
            orderBy: { fechaHora: 'desc' },
          })
          : [];

        const latestPractitionerNameByUserKey = new Map();
        for (const cita of citasByUserKey) {
          const key = buildNameKey(cita.primerNombre, cita.primerApellido);
          if (!unresolvedByKey.has(key) || latestPractitionerNameByUserKey.has(key)) continue;
          latestPractitionerNameByUserKey.set(key, String(cita.nombrePracticante || '').trim());
        }

        const emailPractitionerByPatientName = new Map();
        const emailRowsForFallback = await prisma.$queryRawUnsafe(`
          SELECT patient_name, practitioner_name, uploaded_at
          FROM email_pdf_cache
          WHERE practitioner_name IS NOT NULL
            AND practitioner_name <> ''
            AND patient_name IS NOT NULL
            AND patient_name <> ''
          ORDER BY uploaded_at DESC
          LIMIT 5000
        `).catch(() => []);
        for (const row of emailRowsForFallback) {
          const patientKey = normalizeText(row.patient_name);
          const practitionerName = String(row.practitioner_name || '').trim();
          if (!patientKey || !practitionerName || emailPractitionerByPatientName.has(patientKey)) continue;
          emailPractitionerByPatientName.set(patientKey, practitionerName);
        }

        const practNamesFromCitas = [...new Set([...latestPractitionerNameByUserKey.values()].filter(Boolean))];
        const practNamesFromEmail = [...new Set([...emailPractitionerByPatientName.values()].filter(Boolean))];
        const practNamesForFallback = [...new Set([...practNamesFromCitas, ...practNamesFromEmail])];
        const practitionersByName = practNamesForFallback.length
          ? await prisma.practicante.findMany({
            where: { nombre: { in: practNamesForFallback } },
            select: { idPracticante: true, nombre: true },
          })
          : [];
        const practByName = new Map(practitionersByName.map((p) => [normalizeText(p.nombre), p]));

        const practIds = [...new Set([
          ...users.map((u) => u.practicanteAsignado).filter(Boolean),
          ...latestAssignments.map((r) => r.idPracticante).filter(Boolean),
        ])];
        const practitioners = practIds.length ? await prisma.practicante.findMany({ where: { idPracticante: { in: practIds } }, select: { idPracticante: true, nombre: true } }) : [];
        const practById = new Map(practitioners.map((p) => [p.idPracticante, p.nombre]));

        for (const row of ghqDb) {
          const phoneKey = normalizePhone(row.telefono);
          const user = userByPhone.get(phoneKey);
          const patientName = user ? [user.primerNombre, user.segundoNombre, user.primerApellido, user.segundoApellido].filter(Boolean).join(' ') : 'Sin paciente';
          const directPractId = user?.practicanteAsignado || (user?.idUsuario ? latestPractitionerByUser.get(user.idUsuario) : null);
          const fallbackPractName = user ? latestPractitionerNameByUserKey.get(userKey(user)) : null;
          const fallbackPract = fallbackPractName ? practByName.get(normalizeText(fallbackPractName)) : null;
          const emailPractName = emailPractitionerByPatientName.get(normalizeText(patientName));
          const emailPract = emailPractName ? practByName.get(normalizeText(emailPractName)) : null;
          const practId = directPractId || fallbackPract?.idPracticante || emailPract?.idPracticante || null;
          const practName = (directPractId ? practById.get(directPractId) : null) || fallbackPract?.nombre || emailPract?.nombre || emailPractName || null;
          records.push({ id: `ghq12:${row.idGhq12}`, filename: row.informePdfNombre || `reporte_ghq12_${row.idGhq12}.pdf`, path: `/v1/pdfs/file?source=database&id=ghq12:${row.idGhq12}`, uploadedAt: row.informePdfFecha || new Date(), source: 'database', patient: { id: row.telefono, name: patientName }, practitioner: practName ? { id: String(practId || ''), name: practName } : null });
        }
        for (const row of dassDb) {
          const phoneKey = normalizePhone(row.telefono);
          const user = userByPhone.get(phoneKey);
          const patientName = user ? [user.primerNombre, user.segundoNombre, user.primerApellido, user.segundoApellido].filter(Boolean).join(' ') : 'Sin paciente';
          const directPractId = user?.practicanteAsignado || (user?.idUsuario ? latestPractitionerByUser.get(user.idUsuario) : null);
          const fallbackPractName = user ? latestPractitionerNameByUserKey.get(userKey(user)) : null;
          const fallbackPract = fallbackPractName ? practByName.get(normalizeText(fallbackPractName)) : null;
          const emailPractName = emailPractitionerByPatientName.get(normalizeText(patientName));
          const emailPract = emailPractName ? practByName.get(normalizeText(emailPractName)) : null;
          const practId = directPractId || fallbackPract?.idPracticante || emailPract?.idPracticante || null;
          const practName = (directPractId ? practById.get(directPractId) : null) || fallbackPract?.nombre || emailPract?.nombre || emailPractName || null;
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
