import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Users,
  ClipboardCheck,
  ClipboardList,
  AlertTriangle,
  UserCheck,
  Loader2,
  RefreshCw,
  Brain,
  Heart,
  Zap,
  ShieldAlert,
  Activity,
  GraduationCap,
  Filter,
  Eye,
  UserRoundSearch,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';

import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { api } from '../../services/api';
import type { DashboardData, DashboardStudentDetail, DashboardStudentRow } from '../../services/api';

/* ═══════════════════════════════════════════════════════════════
   CLINICAL COLOR PALETTE
   ═══════════════════════════════════════════════════════════════ */
const C = {
  green: '#22c55e',
  yellow: '#f59e0b',
  orange: '#f97316',
  red: '#ef4444',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  slate: '#64748b',
  indigo: '#6366f1',
  teal: '#14b8a6',
  pink: '#ec4899',
  cyan: '#06b6d4',
  emerald: '#10b981',
  rose: '#f43f5e',
  amber: '#f59e0b',
  sky: '#0ea5e9',
};

const CHART_PALETTE = [C.blue, C.purple, C.teal, C.orange, C.pink, C.cyan, C.emerald, C.amber, C.rose, C.indigo, C.sky, C.slate];
const STUDENTS_PAGE_SIZE = 10;

/* ═══════════════════════════════════════════════════════════════
   UTILITY FUNCTIONS
   ═══════════════════════════════════════════════════════════════ */
function fmt(n: number): string {
  return n.toLocaleString('es-CO');
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function riskColor(percentage: number): string {
  if (percentage >= 60) return C.red;
  if (percentage >= 40) return C.orange;
  if (percentage >= 20) return C.yellow;
  return C.green;
}

/* ═══════════════════════════════════════════════════════════════
   REUSABLE UI COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

/* ── Stat Card ─────────────────────────────────────────────── */
function StatCard({
  title,
  value,
  icon: Icon,
  color = C.blue,
  subtitle,
  alert = false,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
  subtitle?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 ${
        alert ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
      }`}
    >
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ backgroundColor: color }} />
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 truncate">{title}</p>
          <p className={`text-3xl font-bold mt-1 tracking-tight ${alert ? 'text-red-600' : 'text-slate-900'}`}>
            {typeof value === 'number' ? fmt(value) : value}
          </p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div
          className="p-3 rounded-xl flex-shrink-0 ml-3"
          style={{ backgroundColor: `${color}15`, color }}
        >
          <Icon className="w-7 h-7" />
        </div>
      </div>
    </div>
  );
}

/* ── Chart Card (wrapper) ──────────────────────────────────── */
function ChartCard({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-sm ${className}`}>
      <h3 className="text-sm font-semibold text-slate-800 mb-0.5">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  );
}

/* ── Clinical Interpretation Box ──────────────────────────── */
function ClinicalNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
      <div className="flex items-start gap-2">
        <Brain className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-800 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

/* ── Tab Button ────────────────────────────────────────────── */
function TabBtn({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-lg transition-all ${
        active
          ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );
}

/* ── Custom Tooltip for Recharts ──────────────────────────── */
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      {label && <p className="font-semibold text-slate-700 mb-1">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {typeof entry.value === 'number' ? fmt(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

/* ── Pie Chart Label Renderer ─────────────────────────────── */
const renderPieLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  name,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  name: string;
}) => {
  if (percent < 0.03) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#475569" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>
      {name} ({(percent * 100).toFixed(1)}%)
    </text>
  );
};

/* ═══════════════════════════════════════════════════════════════
   TAB SECTION COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

/* ── TAB 1: Resumen General ───────────────────────────────── */
function TabResumen({ data }: { data: DashboardData }) {
  const { overview, dass21, ghq12 } = data;
  const students = data.students || [];

  const [studentSort, setStudentSort] = useState<'recent' | 'alpha' | 'risk'>('recent');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentDetail, setStudentDetail] = useState<DashboardStudentDetail | null>(null);
  const [studentDetailLoading, setStudentDetailLoading] = useState(false);
  const [studentDetailError, setStudentDetailError] = useState('');
  const [studentsPage, setStudentsPage] = useState(1);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);

  const dassTotal = dass21.totalTests || 1;
  const depAffected = dass21.depression.distribution
    .filter((d) => d.level.toLowerCase() !== 'normal')
    .reduce((s, d) => s + d.count, 0);
  const anxAffected = dass21.anxiety.distribution
    .filter((d) => d.level.toLowerCase() !== 'normal')
    .reduce((s, d) => s + d.count, 0);
  const strAffected = dass21.stress.distribution
    .filter((d) => d.level.toLowerCase() !== 'normal')
    .reduce((s, d) => s + d.count, 0);

  const depPct = (depAffected / dassTotal) * 100;
  const anxPct = (anxAffected / dassTotal) * 100;
  const strPct = (strAffected / dassTotal) * 100;

  // New breakdown fields (with fallbacks for backward compat)
  const totalEvaluated: number = (overview as any).totalEvaluated ?? (overview.totalGHQ12 + ((overview as any).onlyDASS21Count ?? 0));
  const notEvaluated: number = (overview as any).notEvaluated ?? (overview.totalPatients - totalEvaluated);
  const bothTests: number = (overview as any).bothTestsCount ?? 0;
  const onlyGHQ12: number = (overview as any).onlyGHQ12Count ?? overview.totalGHQ12;
  const onlyDASS21: number = (overview as any).onlyDASS21Count ?? 0;
  const evalPct = overview.totalPatients > 0 ? (totalEvaluated / overview.totalPatients) * 100 : 0;

  const sortedStudents = useMemo(() => {
    const getDateMs = (s: DashboardStudentRow) => (s.latestTestDate ? new Date(s.latestTestDate).getTime() : -Infinity);
    const arr = [...students];

    if (studentSort === 'alpha') {
      arr.sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
      return arr;
    }

    if (studentSort === 'risk') {
      arr.sort((a, b) => {
        const rankDiff = (b.combinedRisk?.rank || 0) - (a.combinedRisk?.rank || 0);
        if (rankDiff !== 0) return rankDiff;
        const scoreDiff = (b.combinedRisk?.score || 0) - (a.combinedRisk?.score || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return getDateMs(b) - getDateMs(a);
      });
      return arr;
    }

    arr.sort((a, b) => getDateMs(b) - getDateMs(a));
    return arr;
  }, [students, studentSort]);

  useEffect(() => {
    if (!selectedStudentId) return;
    const stillExists = students.some((s) => s.idUsuario === selectedStudentId);
    if (!stillExists) {
      setSelectedStudentId('');
      setStudentDetail(null);
      setStudentDetailError('');
      setIsStudentModalOpen(false);
    }
  }, [students, selectedStudentId]);

  useEffect(() => {
    setStudentsPage(1);
  }, [studentSort]);

  const studentsTotalPages = Math.max(1, Math.ceil(sortedStudents.length / STUDENTS_PAGE_SIZE));

  useEffect(() => {
    if (studentsPage > studentsTotalPages) {
      setStudentsPage(studentsTotalPages);
    }
  }, [studentsPage, studentsTotalPages]);

  const paginatedStudents = useMemo(() => {
    const start = (studentsPage - 1) * STUDENTS_PAGE_SIZE;
    return sortedStudents.slice(start, start + STUDENTS_PAGE_SIZE);
  }, [sortedStudents, studentsPage]);

  const pageStart = sortedStudents.length === 0 ? 0 : ((studentsPage - 1) * STUDENTS_PAGE_SIZE) + 1;
  const pageEnd = Math.min(studentsPage * STUDENTS_PAGE_SIZE, sortedStudents.length);

  const openPdfInline = useCallback((kind: 'ghq12' | 'dass21', id: string, filename?: string | null) => {
    const url = api.getDatabasePdfFileUrl(kind, id, filename, false);
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const loadStudentDetail = useCallback(async (userId: string) => {
    setIsStudentModalOpen(true);
    setSelectedStudentId(userId);
    setStudentDetailLoading(true);
    setStudentDetailError('');
    try {
      const detail = await api.getDashboardStudentDetail(userId);
      setStudentDetail(detail);
    } catch (err) {
      setStudentDetail(null);
      setStudentDetailError(err instanceof Error ? err.message : 'No se pudo cargar el detalle del estudiante');
    } finally {
      setStudentDetailLoading(false);
    }
  }, []);

  const closeStudentModal = useCallback(() => {
    setIsStudentModalOpen(false);
  }, []);

  useEffect(() => {
    if (!isStudentModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeStudentModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isStudentModalOpen, closeStudentModal]);

  const riskBadgeClass = (rank: number) => {
    if (rank >= 5) return 'bg-red-100 text-red-700 border border-red-200';
    if (rank >= 4) return 'bg-orange-100 text-orange-700 border border-orange-200';
    if (rank >= 3) return 'bg-amber-100 text-amber-700 border border-amber-200';
    if (rank >= 2) return 'bg-blue-100 text-blue-700 border border-blue-200';
    return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  };

  const fmtDate = (iso?: string | null) => {
    if (!iso) return 'Sin pruebas';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Sin fecha';
    return d.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const selectedStudentRow = useMemo(
    () => students.find((s) => s.idUsuario === selectedStudentId) || null,
    [students, selectedStudentId],
  );

  const ghqRadarData = studentDetail?.ghq12?.subscales.map((s) => ({
    subject: s.name,
    value: s.value,
    fullMark: s.max,
  })) || [];

  const ghqBarsData = studentDetail?.ghq12?.subscales.map((s) => ({
    name: s.name,
    value: s.value,
  })) || [];

  const dassCurrentBars = studentDetail
    ? [
        { name: 'Depresion', value: studentDetail.dass21.current.dep, color: C.blue },
        { name: 'Ansiedad', value: studentDetail.dass21.current.anx, color: C.orange },
        { name: 'Estres', value: studentDetail.dass21.current.str, color: C.red },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Alert banner */}
      {overview.riskPercentage > 40 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              Alerta: El {pct(overview.riskPercentage)} de los pacientes evaluados con GHQ-12 presenta riesgo en salud mental
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {fmt(overview.patientsAtRisk)} de {fmt(overview.totalGHQ12)} pacientes evaluados superan el umbral de riesgo (puntaje ≥ 12).
            </p>
          </div>
        </div>
      )}

      {/* Fila 1: Cobertura */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Cobertura de Evaluacion</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="Registrados en el sistema"
            value={fmt(overview.totalPatients)}
            icon={Users}
            color={C.blue}
            subtitle="Total de pacientes registrados"
          />
          <StatCard
            title="Evaluados (al menos 1 prueba)"
            value={fmt(totalEvaluated)}
            icon={ClipboardCheck}
            color={C.teal}
            subtitle={`${pct(evalPct)} de los registrados`}
          />
          <StatCard
            title="Sin evaluacion"
            value={fmt(notEvaluated)}
            icon={UserCheck}
            color={C.slate}
            subtitle="Registrados sin prueba completada"
          />
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 mb-3">Distribucion de pruebas</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">Solo GHQ-12</span>
                <span className="text-sm font-bold text-slate-900">{fmt(onlyGHQ12)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">Solo DASS-21</span>
                <span className="text-sm font-bold text-slate-900">{fmt(onlyDASS21)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">Ambas pruebas</span>
                <span className="text-sm font-bold text-indigo-600">{fmt(bothTests)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fila 2: Resultados clinicos */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Resultados Clinicos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <StatCard
            title="GHQ-12 — Evaluados"
            value={fmt(overview.totalGHQ12)}
            icon={ClipboardCheck}
            color={C.purple}
            subtitle={`Puntaje promedio: ${ghq12.averageScore.toFixed(1)} / 36`}
          />
          <StatCard
            title="GHQ-12 — En Riesgo"
            value={fmt(overview.patientsAtRisk)}
            icon={AlertTriangle}
            color={overview.riskPercentage > 40 ? C.red : C.orange}
            alert={overview.riskPercentage > 40}
            subtitle={`${pct(overview.riskPercentage)} de evaluados (puntaje >= 12)`}
          />
          <StatCard
            title="DASS-21 — Evaluados"
            value={fmt(overview.totalDASS21)}
            icon={ClipboardList}
            color={C.indigo}
            subtitle={`${fmt(bothTests)} tambien hicieron GHQ-12`}
          />
        </div>
      </div>

      {/* Fila 3: DASS-21 sintomatologia */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">DASS-21 — Poblacion con Sintomatologia</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-lg" style={{ backgroundColor: `${C.blue}15` }}>
              <Brain className="w-5 h-5" style={{ color: C.blue }} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Depresion</p>
              <p className="text-xl font-bold text-slate-900">{pct(depPct)}</p>
              <p className="text-xs text-slate-400">{fmt(depAffected)} de {fmt(dassTotal)} evaluados</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-lg" style={{ backgroundColor: `${C.orange}15` }}>
              <Heart className="w-5 h-5" style={{ color: C.orange }} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Ansiedad</p>
              <p className="text-xl font-bold text-slate-900">{pct(anxPct)}</p>
              <p className="text-xs text-slate-400">{fmt(anxAffected)} de {fmt(dassTotal)} evaluados</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-lg" style={{ backgroundColor: `${C.red}15` }}>
              <Zap className="w-5 h-5" style={{ color: C.red }} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Estres</p>
              <p className="text-xl font-bold text-slate-900">{pct(strPct)}</p>
              <p className="text-xs text-slate-400">{fmt(strAffected)} de {fmt(dassTotal)} evaluados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Fila 4: Informes enviados por email */}
      {data.emailTracking && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Informes Enviados por Email</h3>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900">{fmt(data.emailTracking.totalEmailsSent)}</p>
                <p className="text-xs text-slate-500 mt-1">Total emails enviados</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{fmt(data.emailTracking.byTestType?.totalConGhq12 ?? 0)}</p>
                <p className="text-xs text-slate-500 mt-1">Tras GHQ-12</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-600">{fmt(data.emailTracking.byTestType?.totalConDass21 ?? 0)}</p>
                <p className="text-xs text-slate-500 mt-1">Tras DASS-21</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-teal-600">{fmt(data.emailTracking.byTestType?.ambas ?? 0)}</p>
                <p className="text-xs text-slate-500 mt-1">Tras ambas pruebas</p>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-3 space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                <span><strong>{fmt(data.emailTracking.byTestType?.soloGhq12 ?? 0)} pacientes</strong> enviaron informe solo tras GHQ-12</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                <span><strong>{fmt(data.emailTracking.byTestType?.soloDass21 ?? 0)} pacientes</strong> enviaron informe solo tras DASS-21</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />
                <span><strong>{fmt(data.emailTracking.byTestType?.ambas ?? 0)} pacientes</strong> hicieron ambas pruebas y enviaron informe</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                <span className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />
                <span>CC automatico a <strong>chatbotpsicologia@gmail.com</strong> en cada envio</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Todos los Estudiantes</h3>
          <div className="flex items-center gap-2">
            <UserRoundSearch className="w-4 h-4 text-slate-500" />
            <select
              value={studentSort}
              onChange={(e) => setStudentSort(e.target.value as 'recent' | 'alpha' | 'risk')}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="recent">Mas reciente primero</option>
              <option value="alpha">Orden alfabetico</option>
              <option value="risk">Riesgo alto a bajo</option>
            </select>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          {sortedStudents.length === 0 ? (
            <p className="text-sm text-slate-500">No hay estudiantes para mostrar con el filtro actual.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="py-2.5 px-2 text-slate-600 font-semibold">Estudiante</th>
                      <th className="py-2.5 px-2 text-slate-600 font-semibold">Fecha prueba</th>
                      <th className="py-2.5 px-2 text-center text-slate-600 font-semibold">GHQ-12</th>
                      <th className="py-2.5 px-2 text-center text-slate-600 font-semibold">DASS-21</th>
                      <th className="py-2.5 px-2 text-center text-slate-600 font-semibold">Riesgo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStudents.map((student) => {
                      const isSelected = student.idUsuario === selectedStudentId;
                      return (
                        <tr
                          key={student.idUsuario}
                          className={`border-b border-slate-100 transition-colors ${
                            isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-2.5 px-2 text-slate-800 font-medium">
                            <button
                              type="button"
                              onClick={() => {
                                void loadStudentDetail(student.idUsuario);
                              }}
                              className="text-left text-blue-700 hover:text-blue-900 underline underline-offset-2"
                            >
                              {student.fullName}
                            </button>
                          </td>
                          <td className="py-2.5 px-2 text-slate-600">{fmtDate(student.latestTestDate)}</td>
                          <td className="py-2.5 px-2 text-center">
                            {student.ghq12?.hasPdf ? (
                              <button
                                type="button"
                                onClick={() => {
                                  openPdfInline('ghq12', student.ghq12!.id, student.ghq12!.pdfFilename);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-purple-200 text-purple-700 hover:bg-purple-50"
                              >
                                <Eye className="w-3.5 h-3.5" /> Ver PDF
                              </button>
                            ) : (
                              <span className="inline-flex px-2.5 py-1 text-xs rounded-md bg-slate-100 text-slate-500">Sin PDF</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            {student.dass21?.hasPdf ? (
                              <button
                                type="button"
                                onClick={() => {
                                  openPdfInline('dass21', student.dass21!.id, student.dass21!.pdfFilename);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                              >
                                <Eye className="w-3.5 h-3.5" /> Ver PDF
                              </button>
                            ) : (
                              <span className="inline-flex px-2.5 py-1 text-xs rounded-md bg-slate-100 text-slate-500">Sin PDF</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className={`inline-flex px-2.5 py-1 text-xs rounded-full font-semibold ${riskBadgeClass(student.combinedRisk.rank)}`}>
                              {student.combinedRisk.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Mostrando {pageStart}-{pageEnd} de {sortedStudents.length} estudiantes
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStudentsPage((prev) => Math.max(1, prev - 1))}
                    disabled={studentsPage <= 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                  </button>
                  <span className="text-xs text-slate-600">Pagina {studentsPage} de {studentsTotalPages}</span>
                  <button
                    type="button"
                    onClick={() => setStudentsPage((prev) => Math.min(studentsTotalPages, prev + 1))}
                    disabled={studentsPage >= studentsTotalPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    Siguiente <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {isStudentModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 p-3 sm:p-6 flex items-start justify-center"
          onClick={closeStudentModal}
        >
          <div
            className="w-full max-w-7xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 sm:px-6 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Analisis Individual del Estudiante</h3>
                <p className="text-xs text-slate-500">
                  {selectedStudentRow?.fullName || 'Estudiante seleccionado'} - graficas personalizadas por historial
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedStudentRow && (
                  <span className={`inline-flex px-3 py-1 text-xs rounded-full font-semibold ${riskBadgeClass(selectedStudentRow.combinedRisk.rank)}`}>
                    Riesgo combinado: {selectedStudentRow.combinedRisk.label}
                  </span>
                )}
                <button
                  type="button"
                  onClick={closeStudentModal}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {studentDetailLoading && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center gap-3 text-slate-600">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Cargando graficas del estudiante...
                </div>
              )}

              {studentDetailError && !studentDetailLoading && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                  {studentDetailError}
                </div>
              )}

              {studentDetail && !studentDetailLoading && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatCard
                      title="GHQ-12 Puntaje"
                      value={studentDetail.ghq12.score ?? 0}
                      icon={ClipboardCheck}
                      color={C.purple}
                      subtitle={studentDetail.ghq12.hasData ? `Nivel: ${studentDetail.ghq12.riskLabel}` : 'Sin datos GHQ-12'}
                    />
                    <StatCard
                      title="DASS-21 Depresion"
                      value={studentDetail.dass21.current.dep}
                      icon={Brain}
                      color={C.blue}
                      subtitle={studentDetail.dass21.hasData ? `Nivel: ${studentDetail.dass21.levels.dep}` : 'Sin datos DASS-21'}
                    />
                    <StatCard
                      title="DASS-21 Ansiedad"
                      value={studentDetail.dass21.current.anx}
                      icon={Heart}
                      color={C.orange}
                      subtitle={studentDetail.dass21.hasData ? `Nivel: ${studentDetail.dass21.levels.anx}` : 'Sin datos DASS-21'}
                    />
                    <StatCard
                      title="DASS-21 Estres"
                      value={studentDetail.dass21.current.str}
                      icon={Zap}
                      color={C.red}
                      subtitle={studentDetail.dass21.hasData ? `Nivel: ${studentDetail.dass21.levels.str}` : 'Sin datos DASS-21'}
                    />
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    <ChartCard title="Perfil Radar - GHQ-12" subtitle="Subescalas del estudiante (ultima evaluacion)">
                      {studentDetail.ghq12.hasSubscaleData ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <RadarChart data={ghqRadarData}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                            <PolarRadiusAxis domain={[0, 6]} tick={{ fontSize: 9 }} />
                            <Radar name="Subescala" dataKey="value" stroke={C.blue} fill={C.blue} fillOpacity={0.25} strokeWidth={2} />
                            <Tooltip content={<CustomTooltip />} />
                          </RadarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-sm text-slate-500">No hay detalle por items para GHQ-12 en este estudiante.</p>
                      )}
                    </ChartCard>

                    <ChartCard title="Subescalas GHQ-12 - Barras" subtitle="Comparativo por dimension (ultima evaluacion)">
                      {studentDetail.ghq12.hasSubscaleData ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={ghqBarsData} layout="vertical" margin={{ top: 5, right: 30, left: 90, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis type="number" domain={[0, 6]} tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="name" width={85} tick={{ fontSize: 10 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="value" name="Puntaje" fill={C.purple} radius={[0, 4, 4, 0]} barSize={18} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-sm text-slate-500">No hay subescalas GHQ-12 para visualizar.</p>
                      )}
                    </ChartCard>
                  </div>

                  <ChartCard title="Tendencia Temporal - GHQ-12" subtitle="Evolucion del puntaje GHQ-12 del estudiante">
                    {studentDetail.ghq12.byDay.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={studentDetail.ghq12.byDay} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 11 }} domain={[0, 36]} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend formatter={(value: string) => <span className="text-xs">{value}</span>} />
                          <Line type="monotone" dataKey="score" name="Puntaje GHQ-12" stroke={C.red} strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-slate-500">No hay historial temporal GHQ-12 para este estudiante.</p>
                    )}
                  </ChartCard>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    <ChartCard title="Comparativo Actual DASS-21" subtitle="Puntajes actuales por subescala">
                      {studentDetail.dass21.hasData ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={dassCurrentBars} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} domain={[0, 21]} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="value" name="Puntaje" radius={[6, 6, 0, 0]} barSize={56}>
                              {dassCurrentBars.map((entry, idx) => (
                                <Cell key={idx} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-sm text-slate-500">No hay datos DASS-21 para este estudiante.</p>
                      )}
                    </ChartCard>

                    <ChartCard title="Niveles DASS-21" subtitle="Clasificacion por subescala">
                      {studentDetail.dass21.hasData ? (
                        <div className="space-y-3 mt-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Depresion</span>
                            <span className="font-semibold text-slate-900">{studentDetail.dass21.levels.dep}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Ansiedad</span>
                            <span className="font-semibold text-slate-900">{studentDetail.dass21.levels.anx}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Estres</span>
                            <span className="font-semibold text-slate-900">{studentDetail.dass21.levels.str}</span>
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-sm">
                            <span className="text-slate-600">Nivel predominante</span>
                            <span className="font-semibold text-red-600">{studentDetail.dass21.levels.worst}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No hay clasificacion DASS-21 disponible.</p>
                      )}
                    </ChartCard>
                  </div>

                  <ChartCard title="Tendencia Temporal - DASS-21" subtitle="Evolucion de depresion, ansiedad y estres">
                    {studentDetail.dass21.byDay.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={studentDetail.dass21.byDay} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 11 }} domain={[0, 21]} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend formatter={(value: string) => <span className="text-xs">{value}</span>} />
                          <Line type="monotone" dataKey="dep" name="Depresion" stroke={C.blue} strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="anx" name="Ansiedad" stroke={C.orange} strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="str" name="Estres" stroke={C.red} strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-slate-500">No hay historial temporal DASS-21 para este estudiante.</p>
                    )}
                  </ChartCard>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── TAB 2: GHQ-12 ────────────────────────────────────────── */
function TabGHQ12({ data }: { data: DashboardData }) {
  const { ghq12 } = data;

  const pieData = ghq12.riskDistribution.map((d) => ({
    name: d.level,
    value: d.count,
    color: d.color,
  }));

  const subscaleEntries = Object.entries(ghq12.subscales);
  const radarData = subscaleEntries.map(([key, val]) => ({
    subject: val.label || key,
    value: val.avg,
    fullMark: 3,
  }));
  const barSubscaleData = subscaleEntries.map(([key, val]) => ({
    name: val.label || key,
    promedio: val.avg,
  }));

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-6">
        <div>
          <p className="text-xs text-slate-500">Total evaluaciones</p>
          <p className="text-2xl font-bold text-slate-900">{fmt(ghq12.totalTests)}</p>
        </div>
        <div className="h-10 w-px bg-slate-200" />
        <div>
          <p className="text-xs text-slate-500">Puntaje promedio</p>
          <p className="text-2xl font-bold text-slate-900">{ghq12.averageScore.toFixed(1)} <span className="text-sm font-normal text-slate-400">/ 36</span></p>
        </div>
        <div className="h-10 w-px bg-slate-200" />
        <div>
          <p className="text-xs text-slate-500">Punto de corte</p>
          <p className="text-2xl font-bold text-blue-600">&ge; 5</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Risk distribution pie */}
        <ChartCard title="Distribucion por Nivel de Riesgo" subtitle="Clasificacion segun punto de corte GHQ-12">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={50}
                dataKey="value"
                nameKey="name"
                label={renderPieLabel}
                labelLine={false}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="#fff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value: string) => <span className="text-xs text-slate-600">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {ghq12.riskDistribution.map((d) => (
              <div key={d.level} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-slate-600">{d.level}</span>
                </div>
                <span className="font-semibold text-slate-800">{fmt(d.count)} ({pct(d.percentage)})</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Score histogram */}
        <ChartCard title="Histograma de Puntajes" subtitle="Distribucion de puntajes individuales GHQ-12 (0-36)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ghq12.scoreHistogram} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="score" tick={{ fontSize: 11 }} label={{ value: 'Puntaje', position: 'insideBottom', offset: -2, fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} label={{ value: 'Frecuencia', angle: -90, position: 'insideLeft', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Pacientes" fill={C.blue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Subscales radar */}
        <ChartCard title="Perfil Radar — Subescalas GHQ-12" subtitle="Promedios por dimension evaluada">
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
              <PolarRadiusAxis tick={{ fontSize: 9 }} domain={[0, 3]} />
              <Radar name="Promedio" dataKey="value" stroke={C.blue} fill={C.blue} fillOpacity={0.25} strokeWidth={2} />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Subscales bar chart */}
        <ChartCard title="Subescalas GHQ-12 — Promedios" subtitle="Barra horizontal por dimension">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={barSubscaleData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 3]} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={75} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="promedio" name="Promedio" fill={C.purple} radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Trend line */}
      <ChartCard title="Tendencia Temporal — GHQ-12" subtitle="Evaluaciones y puntaje promedio por dia" className="col-span-full">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={ghq12.byDay} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: 'Evaluaciones', angle: -90, position: 'insideLeft', fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: 'Puntaje Prom.', angle: 90, position: 'insideRight', fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend formatter={(value: string) => <span className="text-xs">{value}</span>} />
            <Bar yAxisId="left" dataKey="count" name="Evaluaciones" fill={`${C.blue}40`} radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="avgScore" name="Puntaje promedio" stroke={C.red} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ClinicalNote>
        <strong>Interpretacion clinica GHQ-12:</strong> El General Health Questionnaire de 12 items (Goldberg, 1972) es un
        instrumento de tamizaje para detectar malestar psicologico no especifico. El punto de corte &ge; 5 (metodo GHQ) indica
        presencia de malestar psicologico significativo. Las subescalas reflejan dimensiones del funcionamiento psicosocial:
        ansiedad/insomnio, disfuncion social, depresion y somatizacion. Un puntaje poblacional promedio elevado sugiere la
        necesidad de intervenciones preventivas a nivel grupal. Los resultados aqui presentados no constituyen un diagnostico
        clinico individual.
      </ClinicalNote>
    </div>
  );
}

/* ── TAB 3: DASS-21 ───────────────────────────────────────── */
function TabDASS21({ data }: { data: DashboardData }) {
  const { dass21 } = data;

  const depPie = dass21.depression.distribution.map((d) => ({ name: d.level, value: d.count, color: d.color }));
  const anxPie = dass21.anxiety.distribution.map((d) => ({ name: d.level, value: d.count, color: d.color }));
  const strPie = dass21.stress.distribution.map((d) => ({ name: d.level, value: d.count, color: d.color }));

  const avgBarData = [
    { name: 'Depresion', value: dass21.averages.depression, color: C.blue },
    { name: 'Ansiedad', value: dass21.averages.anxiety, color: C.orange },
    { name: 'Estres', value: dass21.averages.stress, color: C.red },
  ];

  /* Build severity summary table */
  const allLevels = new Set<string>();
  [dass21.depression.distribution, dass21.anxiety.distribution, dass21.stress.distribution].forEach((dist) =>
    dist.forEach((d) => allLevels.add(d.level)),
  );
  const levelOrder = ['Normal', 'Leve', 'Moderado', 'Severo', 'Extremadamente Severo'];
  const orderedLevels = levelOrder.filter((l) => allLevels.has(l));
  if (orderedLevels.length === 0) {
    // fallback: use whatever levels exist
    allLevels.forEach((l) => { if (!orderedLevels.includes(l)) orderedLevels.push(l); });
  }

  const findDist = (dist: Array<{ level: string; count: number; percentage: number }>, level: string) =>
    dist.find((d) => d.level === level) || { count: 0, percentage: 0 };

  function SmallPie({ chartData, title }: { chartData: Array<{ name: string; value: number; color: string }>; title: string }) {
    return (
      <ChartCard title={title} subtitle="Distribucion por severidad">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={85}
              innerRadius={40}
              dataKey="value"
              nameKey="name"
              label={renderPieLabel}
              labelLine={false}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="#fff" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-2 space-y-1">
          {chartData.map((d) => (
            <div key={d.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-slate-600">{d.name}</span>
              </div>
              <span className="font-semibold text-slate-800">{fmt(d.value)}</span>
            </div>
          ))}
        </div>
      </ChartCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-6">
        <div>
          <p className="text-xs text-slate-500">Total evaluaciones DASS-21</p>
          <p className="text-2xl font-bold text-slate-900">{fmt(dass21.totalTests)}</p>
        </div>
        <div className="h-10 w-px bg-slate-200" />
        <div>
          <p className="text-xs text-slate-500">Promedio Depresion</p>
          <p className="text-2xl font-bold" style={{ color: C.blue }}>{dass21.averages.depression.toFixed(1)}</p>
        </div>
        <div className="h-10 w-px bg-slate-200" />
        <div>
          <p className="text-xs text-slate-500">Promedio Ansiedad</p>
          <p className="text-2xl font-bold" style={{ color: C.orange }}>{dass21.averages.anxiety.toFixed(1)}</p>
        </div>
        <div className="h-10 w-px bg-slate-200" />
        <div>
          <p className="text-xs text-slate-500">Promedio Estres</p>
          <p className="text-2xl font-bold" style={{ color: C.red }}>{dass21.averages.stress.toFixed(1)}</p>
        </div>
      </div>

      {/* 3 severity pie charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SmallPie chartData={depPie} title="Depresion" />
        <SmallPie chartData={anxPie} title="Ansiedad" />
        <SmallPie chartData={strPie} title="Estres" />
      </div>

      {/* Comparative bar chart */}
      <ChartCard title="Comparativo de Promedios DASS-21" subtitle="Puntuacion promedio poblacional por subescala">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={avgBarData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name="Promedio" radius={[6, 6, 0, 0]} barSize={60}>
              {avgBarData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Trend line */}
      <ChartCard title="Tendencia Temporal — DASS-21" subtitle="Promedios diarios de depresion, ansiedad y estres">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={dass21.byDay} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend formatter={(value: string) => <span className="text-xs">{value}</span>} />
            <Line type="monotone" dataKey="avgDep" name="Depresion" stroke={C.blue} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="avgAnx" name="Ansiedad" stroke={C.orange} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="avgStr" name="Estres" stroke={C.red} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Severity summary table */}
      <ChartCard title="Tabla Resumen de Severidad" subtitle="Distribucion cruzada de las 3 subescalas por nivel de severidad">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-3 text-slate-700 font-semibold">Nivel</th>
                <th className="text-center py-3 px-3 text-slate-700 font-semibold" style={{ color: C.blue }}>Depresion</th>
                <th className="text-center py-3 px-3 text-slate-700 font-semibold" style={{ color: C.orange }}>Ansiedad</th>
                <th className="text-center py-3 px-3 text-slate-700 font-semibold" style={{ color: C.red }}>Estres</th>
              </tr>
            </thead>
            <tbody>
              {orderedLevels.map((level) => {
                const dep = findDist(dass21.depression.distribution, level);
                const anx = findDist(dass21.anxiety.distribution, level);
                const str = findDist(dass21.stress.distribution, level);
                return (
                  <tr key={level} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-700">{level}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="font-semibold">{fmt(dep.count)}</span>
                      <span className="text-slate-400 ml-1">({pct(dep.percentage)})</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="font-semibold">{fmt(anx.count)}</span>
                      <span className="text-slate-400 ml-1">({pct(anx.percentage)})</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="font-semibold">{fmt(str.count)}</span>
                      <span className="text-slate-400 ml-1">({pct(str.percentage)})</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <ClinicalNote>
        <strong>Interpretacion clinica DASS-21:</strong> La Escala de Depresion, Ansiedad y Estres de 21 items (Lovibond & Lovibond, 1995)
        evalua tres ejes emocionales negativos. Los puntos de corte poblacionales clasifican en Normal, Leve, Moderado, Severo y
        Extremadamente Severo. Las puntuaciones se multiplican x2 para equiparar con la version de 42 items. A nivel poblacional,
        un porcentaje elevado de casos en niveles Moderado-Severo indica necesidad de fortalecer estrategias de prevencion e
        intervencion temprana. No sustituye la valoracion clinica individual.
      </ClinicalNote>
    </div>
  );
}

/* ── TAB 4: Perfil Sociodemografico ───────────────────────── */
function TabSociodemographic({ data }: { data: DashboardData }) {
  const { sociodemographic: sd } = data;

  const sexPie = sd.sex.map((s, i) => ({ name: s.label, value: s.count, color: CHART_PALETTE[i % CHART_PALETTE.length] }));
  const occupationPie = sd.occupation.map((o, i) => ({ name: o.type, value: o.count, color: CHART_PALETTE[i % CHART_PALETTE.length] }));
  const schedulePie = sd.university.schedule.map((s, i) => ({ name: s.type, value: s.count, color: CHART_PALETTE[i % CHART_PALETTE.length] }));
  const uniPie = [
    { name: 'Pertenece', value: sd.university.belongs, color: C.blue },
    { name: 'No pertenece', value: sd.university.doesNotBelong, color: C.slate },
  ];
  const disabilityPie = [
    { name: 'Si', value: sd.disability.yes, color: C.orange },
    { name: 'No', value: sd.disability.no, color: C.green },
  ];

  // Academic data (merged into sociodemographic)
  const careerDataNormalized = (sd.topCareers ?? []).map((c) => ({ name: c.career, count: c.count }));
  const jornadaPie = (sd.jornada ?? []).map((j, i) => ({
    name: j.type,
    value: j.count,
    color: CHART_PALETTE[i % CHART_PALETTE.length],
  }));
  const semestreData = (sd.semestre ?? []).map((s) => ({
    semestre: `Sem ${s.semestre}`,
    count: s.count,
  }));

  function MiniPie({ chartData, title, subtitle, height = 220 }: { chartData: Array<{ name: string; value: number; color: string }>; title: string; subtitle?: string; height?: number }) {
    return (
      <ChartCard title={title} subtitle={subtitle}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" outerRadius={70} innerRadius={30} dataKey="value" nameKey="name" label={renderPieLabel} labelLine={false}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="#fff" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-1 mt-1">
          {chartData.map((d) => (
            <div key={d.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-slate-600">{d.name}</span>
              </div>
              <span className="font-semibold text-slate-700">{fmt(d.value)}</span>
            </div>
          ))}
        </div>
      </ChartCard>
    );
  }

  function HorizontalBarChart({
    chartData,
    title,
    subtitle,
    dataKey = 'count',
    nameKey = 'name',
    color = C.blue,
  }: {
    chartData: Array<Record<string, unknown>>;
    title: string;
    subtitle?: string;
    dataKey?: string;
    nameKey?: string;
    color?: string;
  }) {
    return (
      <ChartCard title={title} subtitle={subtitle}>
        <ResponsiveContainer width="100%" height={Math.max(chartData.length * 36 + 40, 160)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey={nameKey} tick={{ fontSize: 11 }} width={95} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey={dataKey} name="Cantidad" fill={color} radius={[0, 4, 4, 0]} barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  const civilData = sd.civilStatus.map((c) => ({ name: c.status, count: c.count }));
  const educationData = sd.education.map((e) => ({ name: e.level, count: e.count }));
  const incomeData = sd.income.map((i) => ({ name: i.level, count: i.count }));

  return (
    <div className="space-y-6">
      {/* Total header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <p className="text-xs text-slate-500">Total registros sociodemograficos</p>
        <p className="text-2xl font-bold text-slate-900">{fmt(sd.totalRecords)}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Sex */}
        <MiniPie chartData={sexPie} title="Distribucion por Sexo" subtitle="Sexo biologico reportado" />

        {/* Age ranges */}
        <ChartCard title="Distribucion por Rango de Edad" subtitle="Grupo etario de la poblacion">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sd.ageRanges} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Pacientes" fill={C.purple} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Civil status */}
        <HorizontalBarChart chartData={civilData} title="Estado Civil" subtitle="Distribucion de la poblacion por estado civil" color={C.teal} />

        {/* Education */}
        <HorizontalBarChart chartData={educationData} title="Nivel Educativo" subtitle="Escolaridad reportada" color={C.indigo} />

        {/* Income */}
        <HorizontalBarChart chartData={incomeData} title="Nivel de Ingresos" subtitle="Rango de ingresos mensuales" color={C.amber} />

        {/* Occupation */}
        <MiniPie chartData={occupationPie} title="Ocupacion" subtitle="Tipo de actividad principal" />
      </div>

      {/* University & Academic section */}
      <h3 className="text-sm font-semibold text-slate-700 mt-2 flex items-center gap-2">
        <GraduationCap className="w-4 h-4 text-blue-600" />
        Informacion Universitaria y Perfil Academico
      </h3>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <MiniPie chartData={uniPie} title="Pertenencia a la Universidad" subtitle="Vinculo con la IUDC" />

        {/* Career distribution — normalized (9 careers + Otra) */}
        <ChartCard title="Distribucion por Carrera (Normalizado)" subtitle="Programas academicos — nombres normalizados" className="xl:col-span-2">
          <ResponsiveContainer width="100%" height={Math.max(careerDataNormalized.length * 36 + 40, 200)}>
            <BarChart data={careerDataNormalized} layout="vertical" margin={{ top: 5, right: 30, left: 160, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={155} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Estudiantes" fill={C.blue} radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Jornada pie chart */}
        <ChartCard title="Jornada Academica" subtitle="Distribucion Diurna vs Nocturna">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={jornadaPie} cx="50%" cy="50%" outerRadius={85} innerRadius={40} dataKey="value" nameKey="name" label={renderPieLabel} labelLine={false}>
                {jornadaPie.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="#fff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {jornadaPie.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-slate-600">{d.name}</span>
                </div>
                <span className="font-semibold text-slate-800">{fmt(d.value)}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Semestre bar chart */}
        <ChartCard title="Distribucion por Semestre" subtitle="Cantidad de estudiantes por semestre academico">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={semestreData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="semestre" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Estudiantes" fill={C.purple} radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <MiniPie chartData={schedulePie} title="Horario Academico" subtitle="Tipo de jornada (raw)" />

        {/* Sexual orientation table */}
        <ChartCard title="Orientacion Sexual" subtitle="Distribucion reportada">
          <div className="space-y-2">
            {sd.sexualOrientation.map((o) => {
              const max = Math.max(...sd.sexualOrientation.map((x) => x.count), 1);
              const widthPct = Math.max((o.count / max) * 100, 4);
              return (
                <div key={o.orientation}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-600">{o.orientation}</span>
                    <span className="font-semibold text-slate-800">{fmt(o.count)}</span>
                  </div>
                  <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div className="h-full rounded-full bg-pink-400 transition-all" style={{ width: `${widthPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>

        {/* Ethnicity table */}
        <ChartCard title="Etnia" subtitle="Grupo etnico reportado">
          <div className="space-y-2">
            {sd.ethnicity.map((e) => {
              const max = Math.max(...sd.ethnicity.map((x) => x.count), 1);
              const widthPct = Math.max((e.count / max) * 100, 4);
              return (
                <div key={e.group}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-600">{e.group}</span>
                    <span className="font-semibold text-slate-800">{fmt(e.count)}</span>
                  </div>
                  <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${widthPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>

      {/* Disability */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <MiniPie chartData={disabilityPie} title="Condicion de Discapacidad" subtitle="Autorreporte de discapacidad" />
      </div>
    </div>
  );
}

/* ── TAB 5: Analisis Cruzado ──────────────────────────────── */
function TabCrossTabs({ data }: { data: DashboardData }) {
  const { crossTabs: ct } = data;

  /* Highlight most at-risk group */
  function findMaxRisk<T extends { riskPct: number }>(arr: T[]): number {
    if (!arr.length) return -1;
    return arr.reduce((maxIdx, item, idx, a) => (item.riskPct > a[maxIdx].riskPct ? idx : maxIdx), 0);
  }

  const maxSex = findMaxRisk(ct.ghq12BySex);
  const maxAge = findMaxRisk(ct.ghq12ByAge);
  const maxCivil = findMaxRisk(ct.ghq12ByCivilStatus);
  const maxIncome = findMaxRisk(ct.ghq12ByIncome);
  const maxCareer = findMaxRisk(ct.ghq12ByCareer ?? []);
  const maxSemestre = findMaxRisk(ct.ghq12BySemestre ?? []);

  const careerCrossData = (ct.ghq12ByCareer ?? []).map((c) => ({ ...c, name: c.career }));
  const semestreCrossData = (ct.ghq12BySemestre ?? []).map((s) => ({ ...s, name: `Sem ${s.semestre}` }));
  const jornadaCrossData = (ct.ghq12ByJornada ?? []);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-500" />
          <p className="text-sm text-slate-700">
            <strong>Analisis Cruzado:</strong> Riesgo GHQ-12 desglosado por variables sociodemograficas. Se destacan los grupos con mayor prevalencia de riesgo.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* By Sex */}
        <ChartCard title="Riesgo GHQ-12 por Sexo" subtitle="Distribucion de riesgo segun sexo biologico">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ct.ghq12BySex} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="sex" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={(value: string) => <span className="text-xs">{value}</span>} />
              <Bar dataKey="atRisk" name="En riesgo" fill={C.red} radius={[4, 4, 0, 0]} />
              <Bar dataKey="noRisk" name="Sin riesgo" fill={C.green} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-slate-600">Sexo</th>
                  <th className="text-center py-2 px-2 text-slate-600">En riesgo</th>
                  <th className="text-center py-2 px-2 text-slate-600">Sin riesgo</th>
                  <th className="text-center py-2 px-2 text-slate-600">Total</th>
                  <th className="text-center py-2 px-2 text-slate-600">% Riesgo</th>
                  <th className="text-center py-2 px-2 text-slate-600">Prom.</th>
                </tr>
              </thead>
              <tbody>
                {ct.ghq12BySex.map((row, i) => (
                  <tr key={row.sex} className={`border-b border-slate-100 ${i === maxSex ? 'bg-red-50' : ''}`}>
                    <td className="py-2 px-2 font-medium">{row.sex}</td>
                    <td className="py-2 px-2 text-center font-semibold text-red-600">{fmt(row.atRisk)}</td>
                    <td className="py-2 px-2 text-center text-green-600">{fmt(row.noRisk)}</td>
                    <td className="py-2 px-2 text-center">{fmt(row.total)}</td>
                    <td className="py-2 px-2 text-center font-semibold" style={{ color: riskColor(row.riskPct) }}>{pct(row.riskPct)}</td>
                    <td className="py-2 px-2 text-center">{row.avgScore.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        {/* By Age */}
        <ChartCard title="Riesgo GHQ-12 por Edad" subtitle="% de riesgo segun rango etario">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ct.ghq12ByAge} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="riskPct" name="% en Riesgo" radius={[4, 4, 0, 0]} barSize={40}>
                {ct.ghq12ByAge.map((_entry, i) => (
                  <Cell key={i} fill={i === maxAge ? C.red : C.blue} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-slate-600">Rango</th>
                  <th className="text-center py-2 px-2 text-slate-600">En riesgo</th>
                  <th className="text-center py-2 px-2 text-slate-600">Total</th>
                  <th className="text-center py-2 px-2 text-slate-600">% Riesgo</th>
                  <th className="text-center py-2 px-2 text-slate-600">Prom.</th>
                </tr>
              </thead>
              <tbody>
                {ct.ghq12ByAge.map((row, i) => (
                  <tr key={row.range} className={`border-b border-slate-100 ${i === maxAge ? 'bg-red-50' : ''}`}>
                    <td className="py-2 px-2 font-medium">{row.range}</td>
                    <td className="py-2 px-2 text-center font-semibold text-red-600">{fmt(row.atRisk)}</td>
                    <td className="py-2 px-2 text-center">{fmt(row.total)}</td>
                    <td className="py-2 px-2 text-center font-semibold" style={{ color: riskColor(row.riskPct) }}>{pct(row.riskPct)}</td>
                    <td className="py-2 px-2 text-center">{row.avgScore.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        {/* By Civil Status */}
        <ChartCard title="Riesgo GHQ-12 por Estado Civil" subtitle="Prevalencia de riesgo segun estado civil">
          <ResponsiveContainer width="100%" height={Math.max(ct.ghq12ByCivilStatus.length * 40 + 40, 200)}>
            <BarChart data={ct.ghq12ByCivilStatus} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} width={95} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="riskPct" name="% en Riesgo" radius={[0, 4, 4, 0]} barSize={18}>
                {ct.ghq12ByCivilStatus.map((_entry, i) => (
                  <Cell key={i} fill={i === maxCivil ? C.red : C.purple} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-slate-600">Estado</th>
                  <th className="text-center py-2 px-2 text-slate-600">En riesgo</th>
                  <th className="text-center py-2 px-2 text-slate-600">Total</th>
                  <th className="text-center py-2 px-2 text-slate-600">% Riesgo</th>
                  <th className="text-center py-2 px-2 text-slate-600">Prom.</th>
                </tr>
              </thead>
              <tbody>
                {ct.ghq12ByCivilStatus.map((row, i) => (
                  <tr key={row.status} className={`border-b border-slate-100 ${i === maxCivil ? 'bg-red-50' : ''}`}>
                    <td className="py-2 px-2 font-medium">{row.status}</td>
                    <td className="py-2 px-2 text-center font-semibold text-red-600">{fmt(row.atRisk)}</td>
                    <td className="py-2 px-2 text-center">{fmt(row.total)}</td>
                    <td className="py-2 px-2 text-center font-semibold" style={{ color: riskColor(row.riskPct) }}>{pct(row.riskPct)}</td>
                    <td className="py-2 px-2 text-center">{row.avgScore.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        {/* By Income */}
        <ChartCard title="Riesgo GHQ-12 por Nivel de Ingresos" subtitle="Prevalencia de riesgo segun ingresos">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ct.ghq12ByIncome} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="level" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="riskPct" name="% en Riesgo" radius={[4, 4, 0, 0]} barSize={40}>
                {ct.ghq12ByIncome.map((_entry, i) => (
                  <Cell key={i} fill={i === maxIncome ? C.red : C.teal} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-slate-600">Nivel</th>
                  <th className="text-center py-2 px-2 text-slate-600">En riesgo</th>
                  <th className="text-center py-2 px-2 text-slate-600">Total</th>
                  <th className="text-center py-2 px-2 text-slate-600">% Riesgo</th>
                  <th className="text-center py-2 px-2 text-slate-600">Prom.</th>
                </tr>
              </thead>
              <tbody>
                {ct.ghq12ByIncome.map((row, i) => (
                  <tr key={row.level} className={`border-b border-slate-100 ${i === maxIncome ? 'bg-red-50' : ''}`}>
                    <td className="py-2 px-2 font-medium">{row.level}</td>
                    <td className="py-2 px-2 text-center font-semibold text-red-600">{fmt(row.atRisk)}</td>
                    <td className="py-2 px-2 text-center">{fmt(row.total)}</td>
                    <td className="py-2 px-2 text-center font-semibold" style={{ color: riskColor(row.riskPct) }}>{pct(row.riskPct)}</td>
                    <td className="py-2 px-2 text-center">{row.avgScore.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        {/* By Career */}
        {careerCrossData.length > 0 && (
          <ChartCard title="Riesgo GHQ-12 por Carrera" subtitle="Prevalencia de riesgo por programa academico (nombres normalizados)" className="xl:col-span-2">
            <ResponsiveContainer width="100%" height={Math.max(careerCrossData.length * 36 + 40, 200)}>
              <BarChart data={careerCrossData} layout="vertical" margin={{ top: 5, right: 30, left: 160, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={155} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="riskPct" name="% en Riesgo" radius={[0, 4, 4, 0]} barSize={18}>
                  {careerCrossData.map((_entry, i) => (
                    <Cell key={i} fill={i === maxCareer ? C.red : C.indigo} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-2 text-slate-600">Carrera</th>
                    <th className="text-center py-2 px-2 text-slate-600">En riesgo</th>
                    <th className="text-center py-2 px-2 text-slate-600">Total</th>
                    <th className="text-center py-2 px-2 text-slate-600">% Riesgo</th>
                    <th className="text-center py-2 px-2 text-slate-600">Prom.</th>
                  </tr>
                </thead>
                <tbody>
                  {(ct.ghq12ByCareer ?? []).map((row, i) => (
                    <tr key={row.career} className={`border-b border-slate-100 ${i === maxCareer ? 'bg-red-50' : ''}`}>
                      <td className="py-2 px-2 font-medium">{row.career}</td>
                      <td className="py-2 px-2 text-center font-semibold text-red-600">{fmt(row.atRisk)}</td>
                      <td className="py-2 px-2 text-center">{fmt(row.total)}</td>
                      <td className="py-2 px-2 text-center font-semibold" style={{ color: riskColor(row.riskPct) }}>{pct(row.riskPct)}</td>
                      <td className="py-2 px-2 text-center">{row.avgScore.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        )}

        {/* By Semestre */}
        {semestreCrossData.length > 0 && (
          <ChartCard title="Riesgo GHQ-12 por Semestre" subtitle="% de riesgo segun semestre academico">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={semestreCrossData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="riskPct" name="% en Riesgo" radius={[4, 4, 0, 0]} barSize={40}>
                  {semestreCrossData.map((_entry, i) => (
                    <Cell key={i} fill={i === maxSemestre ? C.red : C.purple} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-2 text-slate-600">Semestre</th>
                    <th className="text-center py-2 px-2 text-slate-600">En riesgo</th>
                    <th className="text-center py-2 px-2 text-slate-600">Total</th>
                    <th className="text-center py-2 px-2 text-slate-600">% Riesgo</th>
                    <th className="text-center py-2 px-2 text-slate-600">Prom.</th>
                  </tr>
                </thead>
                <tbody>
                  {(ct.ghq12BySemestre ?? []).map((row, i) => (
                    <tr key={row.semestre} className={`border-b border-slate-100 ${i === maxSemestre ? 'bg-red-50' : ''}`}>
                      <td className="py-2 px-2 font-medium">Semestre {row.semestre}</td>
                      <td className="py-2 px-2 text-center font-semibold text-red-600">{fmt(row.atRisk)}</td>
                      <td className="py-2 px-2 text-center">{fmt(row.total)}</td>
                      <td className="py-2 px-2 text-center font-semibold" style={{ color: riskColor(row.riskPct) }}>{pct(row.riskPct)}</td>
                      <td className="py-2 px-2 text-center">{row.avgScore.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        )}

        {/* By Jornada */}
        {jornadaCrossData.length > 0 && (
          <ChartCard title="Riesgo GHQ-12 por Jornada" subtitle="Comparativo Diurna vs Nocturna">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={jornadaCrossData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="jornada" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={(value: string) => <span className="text-xs">{value}</span>} />
                <Bar dataKey="atRisk" name="En riesgo" fill={C.red} radius={[4, 4, 0, 0]} />
                <Bar dataKey="total" name="Total evaluados" fill={C.blue} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-2 text-slate-600">Jornada</th>
                    <th className="text-center py-2 px-2 text-slate-600">En riesgo</th>
                    <th className="text-center py-2 px-2 text-slate-600">Total</th>
                    <th className="text-center py-2 px-2 text-slate-600">% Riesgo</th>
                    <th className="text-center py-2 px-2 text-slate-600">Prom.</th>
                  </tr>
                </thead>
                <tbody>
                  {jornadaCrossData.map((row) => (
                    <tr key={row.jornada} className="border-b border-slate-100">
                      <td className="py-2 px-2 font-medium">{row.jornada}</td>
                      <td className="py-2 px-2 text-center font-semibold text-red-600">{fmt(row.atRisk)}</td>
                      <td className="py-2 px-2 text-center">{fmt(row.total)}</td>
                      <td className="py-2 px-2 text-center font-semibold" style={{ color: riskColor(row.riskPct) }}>{pct(row.riskPct)}</td>
                      <td className="py-2 px-2 text-center">{row.avgScore.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        )}
      </div>

      <ClinicalNote>
        <strong>Nota sobre analisis cruzado:</strong> La identificacion de grupos demograficos con mayor prevalencia de
        riesgo permite focalizar recursos de intervencion. Las filas resaltadas en rojo indican el grupo con mayor
        porcentaje de riesgo en cada variable. Estos datos son descriptivos y no implican causalidad. Se recomienda
        complementar con analisis inferenciales para establecer asociaciones estadisticamente significativas.
      </ClinicalNote>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
type TabKey = 'resumen' | 'ghq12' | 'dass21' | 'socio' | 'cruzado';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'resumen', label: 'Resumen General' },
  { key: 'ghq12', label: 'GHQ-12' },
  { key: 'dass21', label: 'DASS-21' },
  { key: 'socio', label: 'Perfil Sociodemografico' },
  { key: 'cruzado', label: 'Analisis Cruzado' },
];

export default function AdminHomePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('resumen');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPractitioner, setSelectedPractitioner] = useState<string>('');

  const load = useCallback(async (practEmail?: string) => {
    setLoading(true);
    setError('');
    try {
      const email = practEmail !== undefined ? practEmail : selectedPractitioner;
      const summary = await api.getDashboardSummary(email || undefined);
      setData(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, [selectedPractitioner]);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePractitionerChange = useCallback((email: string) => {
    setSelectedPractitioner(email);
    load(email);
  }, [load]);

  const tabContent = useMemo(() => {
    if (!data) return null;
    switch (activeTab) {
      case 'resumen':
        return <TabResumen data={data} />;
      case 'ghq12':
        return <TabGHQ12 data={data} />;
      case 'dass21':
        return <TabDASS21 data={data} />;
      case 'socio':
        return <TabSociodemographic data={data} />;
      case 'cruzado':
        return <TabCrossTabs data={data} />;
      default:
        return null;
    }
  }, [data, activeTab]);

  return (
    <DashboardLayout
      title="Panel de Salud Mental"
      subtitle="Bienestar Universitario — IUDC"
    >
      {/* ── Header with context ──────────────────────────────── */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl shadow-md shadow-blue-200">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Panel de Salud Mental — Bienestar Universitario</h1>
              <p className="text-xs text-slate-500">IUDC — Consultorio Psicologico | Tamizaje poblacional y analisis clinico</p>
            </div>
          </div>
          <button
            onClick={() => load()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm disabled:opacity-50"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {/* ── Practitioner filter ─────────────────────────────── */}
        {data?.emailTracking && (
          <div className="flex items-center gap-3 mb-4 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
            <Filter className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <label htmlFor="practitioner-filter" className="text-sm font-medium text-slate-600 whitespace-nowrap">
              Filtrar por practicante:
            </label>
            <select
              id="practitioner-filter"
              value={selectedPractitioner}
              onChange={(e) => handlePractitionerChange(e.target.value)}
              disabled={loading}
              className="flex-1 min-w-0 text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 truncate"
            >
              <option value="">Todos los pacientes ({fmt(data.emailTracking.uniquePatients)} con email enviado)</option>
              <option value="sin_asignar">
                Sin practicante asignado — {fmt(data.emailTracking.patientsWithoutPractitioner ?? 0)} pacientes
              </option>
              {data.emailTracking.byPractitioner.map((p) => (
                <option key={p.email} value={p.email}>
                  {p.name} — {p.email} ({fmt(p.uniquePatients)} pacientes, {fmt(p.emailsSent)} emails)
                </option>
              ))}
            </select>
            {selectedPractitioner && (
              <button
                onClick={() => handlePractitionerChange('')}
                className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
              >
                Limpiar filtro
              </button>
            )}
          </div>
        )}

        {/* ── Tab navigation ──────────────────────────────────── */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
          {TABS.map((tab) => (
            <TabBtn
              key={tab.key}
              active={activeTab === tab.key}
              label={tab.label}
              onClick={() => setActiveTab(tab.key)}
            />
          ))}
        </div>
      </div>

      {/* ── Loading state ──────────────────────────────────── */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p className="text-sm font-medium">Cargando datos del dashboard...</p>
          <p className="text-xs mt-1">Procesando indicadores clinicos de la poblacion</p>
        </div>
      )}

      {/* ── Error state ────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">Error al cargar el dashboard</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={() => load()}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── Dashboard content ──────────────────────────────── */}
      {data && (
        <div className="animate-in fade-in duration-300">
          {tabContent}
        </div>
      )}
    </DashboardLayout>
  );
}
