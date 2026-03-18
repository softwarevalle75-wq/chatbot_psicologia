import { useEffect, useState } from 'react';
import {
  Users,
  ClipboardCheck,
  Stethoscope,
  Loader2,
  RefreshCw,
} from 'lucide-react';


import DashboardLayout from '../../components/dashboard/DashboardLayout';
import StatCard from '../../components/charts/StatCard';
import SimpleLineChart from '../../components/charts/SimpleLineChart';
import SimpleBarChart from '../../components/charts/SimpleBarChart';
import SimplePieChart from '../../components/charts/SimplePieChart';
import SimpleRadarChart from '../../components/charts/SimpleRadarChart';
import { api } from '../../services/api';
import type { DashboardPeriod, DashboardSummary } from '../../services/api';

/* ── Colores del proyecto ─────────────────────────────────── */
const COLORS = {
  primary: '#2f6ee5',
  accent: '#4a8af4',
  sidebar: '#2559be',
  greenOk: '#15803d',
  amber: '#b45309',
  red: '#dc2626',
  redDark: '#991b1b',
  slate: '#64748b',
};

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  week: 'Semana',
  month: 'Mes',
  year: 'A\u00f1o',
};

/* ── Componente de tarjeta para graficas ──────────────────── */
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
    <div className={`relative overflow-hidden h-full bg-gradient-to-br from-white via-white to-blue-50/60 border border-blue-100/90 rounded-2xl p-5 shadow-[0_12px_32px_-22px_rgba(37,89,190,0.6)] hover:shadow-[0_18px_40px_-22px_rgba(37,89,190,0.75)] transition-all duration-300 hover:-translate-y-0.5 ${className}`}>
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#2f6ee5] via-[#4a8af4] to-[#2559be]" />
      <div className="absolute -bottom-12 -right-12 h-28 w-28 rounded-full bg-blue-200/20 blur-2xl" />
      <h3 className="text-sm font-semibold text-blue-950 mb-0.5">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

/* ── Barra horizontal CSS custom ──────────────────────────── */
function HorizontalBar({
  items,
}: {
  items: Array<{ name: string; value: number; color: string }>;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-3">
          <span className="text-xs text-slate-600 w-32 truncate text-right font-medium">{item.name}</span>
          <div className="flex-1 bg-blue-50 rounded-full h-5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max((item.value / max) * 100, 2)}%`,
                backgroundColor: item.color,
                boxShadow: `0 6px 14px -10px ${item.color}`,
              }}
            />
          </div>
          <span className="text-xs font-semibold text-blue-950 w-8 text-right">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Componente principal ─────────────────────────────────── */
export default function AdminHomePage() {
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (p: DashboardPeriod) => {
    setLoading(true);
    setError('');
    try {
      const summary = await api.getDashboardSummary(p);
      setData(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar metricas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(period);
  }, [period]);

  /* ── Datos para grafica de promedios (barras agrupadas) ── */
  const averagesBarData = data
    ? [
        { name: 'Ansiedad', value: data.averages.anxiety, color: COLORS.amber },
        { name: 'Depresion', value: data.averages.depression, color: COLORS.primary },
        { name: 'Estres', value: data.averages.stress, color: COLORS.red },
      ]
    : [];

  /* ── Colores para subescalas DASS-21 ───────────────────── */
  const DASS_COLORS: Record<string, string> = {
    Depresion: COLORS.primary,
    Ansiedad: COLORS.amber,
    Estres: COLORS.red,
  };

  const ghqRadarData = data
    ? data.ghq12Subscales.map((sub) => ({
        name: sub.name
          .replace('Funcionamiento ', 'Func. ')
          .replace('Estado de animo ', 'Animo '),
        value: sub.average,
        max: sub.maxPossible,
      }))
    : [];

  const dassRadarData = data
    ? data.dass21Subscales.map((sub) => ({
        name: sub.name,
        value: sub.average,
        max: sub.maxPossible,
      }))
    : [];

  return (
    <DashboardLayout
      title="Panel de Administrador"
      subtitle="Metricas y estadisticas del consultorio psicologico"
    >
      {/* ── Selector de periodo + refresh ─────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex bg-gradient-to-r from-white to-blue-50 border border-blue-100 rounded-xl overflow-hidden shadow-[0_8px_20px_-16px_rgba(37,89,190,0.7)]">
          {(Object.keys(PERIOD_LABELS) as DashboardPeriod[]).map((key) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                period === key
                  ? 'bg-gradient-to-r from-[#2f6ee5] to-[#4a8af4] text-white shadow-[0_10px_20px_-14px_rgba(37,89,190,0.9)]'
                  : 'text-slate-600 hover:bg-blue-50/70'
              }`}
            >
              {PERIOD_LABELS[key]}
            </button>
          ))}
        </div>
        <button
          onClick={() => load(period)}
          disabled={loading}
          className="p-2 rounded-xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-all shadow-[0_10px_20px_-16px_rgba(37,89,190,0.8)] disabled:opacity-50"
          title="Actualizar datos"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        {data && (
          <span className="text-xs text-slate-400 ml-auto">
            Periodo: {PERIOD_LABELS[data.period]}
          </span>
        )}
      </div>

      {/* ── Loading state ─────────────────────────────────── */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3" />
          <p className="text-sm">Cargando metricas del dashboard...</p>
        </div>
      )}

      {/* ── Error state ───────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* ── Dashboard content ─────────────────────────────── */}
      {data && (
        <div className="relative space-y-6">
          <div className="pointer-events-none absolute -top-6 right-8 h-24 w-24 rounded-full bg-blue-300/15 blur-2xl" />
          <div className="pointer-events-none absolute top-1/3 -left-6 h-20 w-20 rounded-full bg-sky-300/15 blur-2xl" />
          {/* ══ SECCION A: 4 Stat Cards ═════════════════════ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <StatCard
              title="Total Pacientes"
              value={data.totalPatients}
              icon={Users}
              iconBgColor="bg-[#2f6ee5]"
              subtitle={`${data.newPatientsThisPeriod} nuevos este periodo`}
              trend={{
                value: data.trends.patients,
                isPositive: data.trends.patients >= 0,
              }}
            />
            <StatCard
              title="Tests Completados"
              value={data.testsCompleted}
              icon={ClipboardCheck}
              iconBgColor="bg-[#2559be]"
              subtitle={`${data.activePractitioners} practicantes activos`}
              trend={{
                value: data.trends.tests,
                isPositive: data.trends.tests >= 0,
              }}
            />
          </div>

          {/* ══ SECCION B: Graficas principales ═══════════════ */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <ChartCard
              title="Actividad del Sistema"
              subtitle="Evaluaciones GHQ-12 y DASS-21 por periodo"
            >
              <SimpleLineChart
                data={data.activityData}
                color={COLORS.primary}
                height={260}
              />
            </ChartCard>
            <ChartCard
              title="Crecimiento de Pacientes"
              subtitle="Nuevos registros por mes (ultimos 12 meses)"
            >
              <SimpleBarChart
                data={data.growthData}
                color={COLORS.accent}
                height={260}
              />
            </ChartCard>
          </div>

          {/* ══ SECCION C: Distribucion psicologica ═════════ */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <ChartCard
              title="Distribucion por Nivel de Riesgo"
              subtitle="Riesgo consolidado desde GHQ-12 y DASS-21"
            >
              <SimplePieChart data={data.riskDistribution} height={260} />
            </ChartCard>
            <ChartCard
              title="Promedios Psicologicos"
              subtitle="Promedio de subescalas DASS-21 del periodo"
            >
              <SimpleBarChart
                data={averagesBarData}
                color={COLORS.primary}
                height={260}
              />
            </ChartCard>
            <ChartCard
              title="Eventos Psicologicos por Tipo"
              subtitle="Eventos criticos pre-diagnosticados en el periodo"
              className="xl:col-span-2"
            >
              <HorizontalBar items={data.psychEventsDistribution} />
            </ChartCard>
          </div>

          {/* ══ SECCION E: Resultados GHQ-12 ═════════════════ */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <ChartCard
              title="Resultados GHQ-12"
              subtitle="Distribucion por nivel de riesgo"
            >
              <SimplePieChart data={data.ghq12Distribution} height={280} />
            </ChartCard>
            <ChartCard
              title="Agrupaciones Descriptivas GHQ-12"
              subtitle="Promedios por subescala (sin inferencia diagnostica)"
            >
              <div className="space-y-3">
                {data.ghq12Subscales.map((sub) => {
                  const pct = sub.maxPossible > 0 ? (sub.average / sub.maxPossible) * 100 : 0;
                  const barColor = pct > 66 ? COLORS.red : pct > 33 ? COLORS.amber : COLORS.greenOk;
                  return (
                    <div key={sub.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-600">{sub.name}</span>
                        <span className="text-xs font-semibold text-blue-950">
                          {sub.average} / {sub.maxPossible}
                        </span>
                      </div>
                      <div className="bg-blue-50 rounded-full h-4 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(pct, 3)}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">Items: {sub.items}</p>
                    </div>
                  );
                })}
                {data.ghq12Averages.totalEvaluations > 0 && (
                  <div className="mt-3 pt-3 border-t border-blue-100 flex items-center gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Puntaje promedio GHQ-12</p>
                      <p className="text-lg font-bold text-blue-950">{data.ghq12Averages.averageScore} / 36</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Evaluaciones</p>
                      <p className="text-lg font-bold text-blue-950">{data.ghq12Averages.totalEvaluations}</p>
                    </div>
                  </div>
                )}
              </div>
            </ChartCard>
            <ChartCard
              title="Perfil Radar GHQ-12"
              subtitle="Vista comparativa por subescala"
              className="xl:col-span-2"
            >
              <SimpleRadarChart data={ghqRadarData} height={300} color={COLORS.primary} />
            </ChartCard>
          </div>

          {/* ══ SECCION F: Resultados DASS-21 ════════════════ */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <ChartCard
              title="Resultados DASS-21"
              subtitle="Distribucion por nivel de riesgo"
            >
              <SimplePieChart data={data.dass21Distribution} height={280} />
            </ChartCard>
            <ChartCard
              title="Agrupaciones Descriptivas DASS-21"
              subtitle="Promedios por subescala (items asociados)"
            >
              <div className="space-y-3">
                {data.dass21Subscales.map((sub) => {
                  const pct = sub.maxPossible > 0 ? (sub.average / sub.maxPossible) * 100 : 0;
                  const barColor = DASS_COLORS[sub.name] || COLORS.primary;
                  return (
                    <div key={sub.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-600">{sub.name}</span>
                        <span className="text-xs font-semibold text-blue-950">
                          {sub.average} / {sub.maxPossible}
                        </span>
                      </div>
                      <div className="bg-blue-50 rounded-full h-4 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(pct, 3)}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">Items: {sub.items}</p>
                    </div>
                  );
                })}
                {data.dass21Averages.totalEvaluations > 0 && (
                  <div className="mt-3 pt-3 border-t border-blue-100 flex items-center gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Puntaje promedio DASS-21</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-sm font-bold" style={{ color: COLORS.primary }}>Dep: {data.dass21Averages.depression}</span>
                        <span className="text-sm font-bold" style={{ color: COLORS.amber }}>Ans: {data.dass21Averages.anxiety}</span>
                        <span className="text-sm font-bold" style={{ color: COLORS.red }}>Est: {data.dass21Averages.stress}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Evaluaciones</p>
                      <p className="text-lg font-bold text-blue-950">{data.dass21Averages.totalEvaluations}</p>
                    </div>
                  </div>
                )}
              </div>
            </ChartCard>
            <ChartCard
              title="Perfil Radar DASS-21"
              subtitle="Comparativo depresion, ansiedad y estres"
              className="xl:col-span-2"
            >
              <SimpleRadarChart data={dassRadarData} height={300} color={COLORS.red} />
            </ChartCard>
          </div>

          {/* ══ SECCION G: Practicantes ═════════════════════ */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <ChartCard
              title="Carga de Trabajo por Practicante"
              subtitle={`${data.activePractitioners} practicantes activos (pacientes y estudiantes asignados)`}
              className="xl:col-span-2"
            >
              {data.practitionerWorkload.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">
                  No hay practicantes activos con pacientes asignados.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-blue-100">
                        <th className="text-left py-2.5 px-3 text-blue-900 font-semibold">Practicante</th>
                        <th className="text-center py-2.5 px-3 text-blue-900 font-semibold">Pacientes y Estudiantes</th>
                        <th className="text-left py-2.5 px-3 text-blue-900 font-semibold w-48">Carga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.practitionerWorkload.map((p) => {
                        const maxLoad = Math.max(
                          ...data.practitionerWorkload.map((w) => w.patients),
                          1,
                        );
                        const load = p.patients;
                        const pct = (load / maxLoad) * 100;

                        return (
                          <tr key={p.id} className="border-b border-blue-50 hover:bg-blue-50/40 transition-colors">
                            <td className="py-2.5 px-3 text-slate-700 flex items-center gap-2">
                              <Stethoscope className="w-4 h-4 text-[#4a8af4]" />
                              {p.name}
                            </td>
                            <td className="py-2.5 px-3 text-center font-medium text-blue-950">{p.patients}</td>
                            <td className="py-2.5 px-3">
                              <div className="bg-blue-50 rounded-full h-4 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.max(pct, 4)}%`,
                                    backgroundColor: pct > 75 ? COLORS.red : pct > 50 ? COLORS.amber : COLORS.accent,
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </ChartCard>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
