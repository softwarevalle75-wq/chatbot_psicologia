import DashboardLayout from '../../components/dashboard/DashboardLayout';

export default function AdminHomePage() {
  return (
    <DashboardLayout
      title="Panel de Administrador"
      subtitle="Inicio del dashboard (metricas en construccion)"
    >
      <div className="bg-white border border-blue-100 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-blue-950 mb-2">Inicio</h2>
        <p className="text-sm text-slate-600">
          Este espacio mostrara las metricas generales del sistema. Por ahora dejamos la estructura base
          y en las siguientes iteraciones agregamos cada indicador.
        </p>
      </div>
    </DashboardLayout>
  );
}
