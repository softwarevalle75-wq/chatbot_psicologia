import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageCircle,
  ClipboardCheck,
  Calendar,
  Loader2,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { UserTestResult, UserAppointment } from '../../services/api';
import logo from '../../assets/loguito.png';

const STATUS_COLORS: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-800',
  confirmada: 'bg-blue-100 text-blue-800',
  completada: 'bg-green-100 text-green-800',
  cancelada: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

const RISK_COLORS: Record<string, string> = {
  bajo: 'bg-green-100 text-green-800',
  moderado: 'bg-amber-100 text-amber-800',
  alto: 'bg-red-100 text-red-800',
  normal: 'bg-green-100 text-green-800',
  leve: 'bg-yellow-100 text-yellow-800',
  severo: 'bg-red-100 text-red-800',
};

export default function UserDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [testResults, setTestResults] = useState<UserTestResult[]>([]);
  const [appointments, setAppointments] = useState<UserAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [results, appts] = await Promise.all([
          api.getUserTestResults(),
          api.getUserAppointments(),
        ]);
        setTestResults(results);
        setAppointments(appts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const pendingAppointments = appointments.filter(
    (a) => a.status === 'pendiente' || a.status === 'confirmada',
  );

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 font-['Inter',sans-serif]">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur border-b border-blue-100 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-lg font-bold text-blue-950">Mi Panel</h1>
              <p className="text-xs text-slate-500">
                {user?.correo || user?.primerNombre || 'Usuario'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-slate-500 hover:text-red-600 transition-colors"
          >
            Cerrar sesion
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/chat')}
            className="flex items-center gap-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl p-5 shadow-lg shadow-blue-200/50 hover:shadow-blue-300/60 hover:-translate-y-0.5 transition-all duration-200"
          >
            <MessageCircle className="w-8 h-8" />
            <div className="text-left">
              <p className="font-bold text-sm">Ir al Chat</p>
              <p className="text-xs text-blue-100">Habla con PsicoBot</p>
            </div>
            <ChevronRight className="w-5 h-5 ml-auto opacity-70" />
          </button>

          <div className="flex items-center gap-3 bg-white border border-blue-100 rounded-2xl p-5 shadow-sm">
            <div className="bg-blue-100 p-2.5 rounded-xl">
              <ClipboardCheck className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-950">{testResults.length}</p>
              <p className="text-xs text-slate-500">Tests completados</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white border border-blue-100 rounded-2xl p-5 shadow-sm">
            <div className="bg-amber-100 p-2.5 rounded-xl">
              <Calendar className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-950">{pendingAppointments.length}</p>
              <p className="text-xs text-slate-500">Citas pendientes</p>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm">Cargando tu informacion...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700">{error}</p>
          </div>
        )}

        {!loading && (
          <>
            {/* Test Results */}
            <section>
              <h2 className="text-lg font-bold text-blue-950 mb-3 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-blue-500" />
                Mis Resultados de Tests
              </h2>
              {testResults.length === 0 ? (
                <div className="bg-white border border-blue-100 rounded-2xl p-8 text-center shadow-sm">
                  <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">
                    Aun no has completado ningun test. Habla con PsicoBot en el chat para
                    realizar tu primera evaluacion.
                  </p>
                  <button
                    onClick={() => navigate('/chat')}
                    className="mt-4 px-5 py-2 text-sm font-medium bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                  >
                    Ir al Chat
                  </button>
                </div>
              ) : (
                <div className="bg-white border border-blue-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-blue-50 text-blue-900">
                          <th className="px-4 py-3 text-left font-semibold">Test</th>
                          <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                          <th className="px-4 py-3 text-center font-semibold">Puntaje</th>
                          <th className="px-4 py-3 text-center font-semibold">Nivel</th>
                        </tr>
                      </thead>
                      <tbody>
                        {testResults.map((result) => (
                          <tr key={result.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-blue-900">{result.testType}</td>
                            <td className="px-4 py-3 text-slate-600">{formatDate(result.completedAt)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-semibold text-blue-950">
                                {result.score}
                              </span>
                              <span className="text-slate-400"> / {result.maxScore}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                                  RISK_COLORS[result.riskLevel.toLowerCase()] || 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {result.riskLevel}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            {/* Appointments */}
            <section>
              <h2 className="text-lg font-bold text-blue-950 mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                Mis Citas
              </h2>
              {appointments.length === 0 ? (
                <div className="bg-white border border-blue-100 rounded-2xl p-8 text-center shadow-sm">
                  <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">
                    No tienes citas registradas. Si necesitas agendar una cita, puedes hacerlo
                    a traves del chat con PsicoBot.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {appointments.map((appt) => (
                    <div
                      key={appt.id}
                      className="bg-white border border-blue-100 rounded-2xl p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-blue-950">{formatDate(appt.date)}</p>
                          <p className="text-sm text-slate-500">{appt.time}</p>
                        </div>
                        <span
                          className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                            STATUS_COLORS[appt.status] || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {STATUS_LABELS[appt.status] || appt.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">
                        Practicante: <span className="font-medium">{appt.practitionerName}</span>
                      </p>
                      {appt.notes && (
                        <p className="text-xs text-slate-400 mt-1">{appt.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Info card */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
              <p className="text-sm text-blue-800 font-medium mb-1">
                Sobre tus resultados
              </p>
              <p className="text-xs text-blue-600 leading-relaxed">
                Los resultados de los tests son orientativos y no constituyen un diagnostico clinico.
                Si deseas conocer mas sobre tus resultados, puedes agendar una cita a traves del
                chat del consultorio psicologico de la Universitaria de Colombia (3115148383).
                Un psicologo en formacion te brindara la informacion personalizada.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
