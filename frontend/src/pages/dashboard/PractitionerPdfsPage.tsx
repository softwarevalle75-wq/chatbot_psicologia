import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { api } from '../../services/api';
import type { PdfRecord } from '../../services/api';

export default function PractitionerPdfsPage() {
  const [pdfs, setPdfs] = useState<PdfRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getPdfHistory();
        setPdfs(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el historial de PDF');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <DashboardLayout title="Historial de PDFs" subtitle="Informes de los casos atendidos por ti">
      <div className="bg-white border border-blue-100 rounded-2xl p-4 sm:p-6 shadow-sm">
        {loading ? <p className="text-sm text-slate-600">Cargando historial...</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {!loading && !error ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-blue-900 border-b border-blue-100">
                  <th className="py-2">Paciente</th>
                  <th className="py-2">Archivo</th>
                  <th className="py-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {pdfs.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-2">{item.patient?.name || 'Sin paciente'}</td>
                    <td className="py-2">{item.filename}</td>
                    <td className="py-2">{new Date(item.uploadedAt).toLocaleString('es-CO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
