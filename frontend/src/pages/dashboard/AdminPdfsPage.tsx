import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { api } from '../../services/api';
import type { PdfRecord } from '../../services/api';

const REQUEST_TIMEOUT_MS = 30_000;

export default function AdminPdfsPage() {
  const [pdfs, setPdfs] = useState<PdfRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'email' | 'database'>('all');
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error('La carga de PDFs tardó demasiado. Intenta de nuevo.')), REQUEST_TIMEOUT_MS);
        });

        const response = await Promise.race([
          api.getAdminPdfHistory({
            page,
            pageSize,
            search: query,
            source: sourceFilter,
          }),
          timeoutPromise,
        ]);

        if (cancelled) return;

        setPdfs(response.data || []);
        setTotal(response.total || 0);
        setTotalPages(Math.max(1, response.totalPages || 1));
        setHasMore(Boolean(response.hasMore));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los PDFs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, pageSize, query, sourceFilter]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void api
        .getAdminPdfHistory({
          page,
          pageSize,
          search: query,
          source: sourceFilter,
        })
        .then((response) => {
          setPdfs(response.data || []);
          setTotal(response.total || 0);
          setTotalPages(Math.max(1, response.totalPages || 1));
          setHasMore(Boolean(response.hasMore));
        })
        .catch(() => undefined);
    }, 15_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [page, pageSize, query, sourceFilter]);

  const startIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, total);

  const openPdf = async (item: PdfRecord) => {
    try {
      setError('');
      const { blob } = await api.getPdfFile(item, false);
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el PDF');
    }
  };

  const downloadPdf = async (item: PdfRecord) => {
    try {
      setError('');
      const { blob, filename } = await api.getPdfFile(item, true);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || item.filename || 'documento.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar el PDF');
    }
  };

  const onSearchChange = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const onSourceChange = (value: 'all' | 'email' | 'database') => {
    setSourceFilter(value);
    setPage(1);
  };

  const onPageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  return (
    <DashboardLayout title="PDFs" subtitle="Historial global de informes PDF">
      <div className="bg-white border border-blue-100 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">Mostrando {total} PDF(s) en total</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              value={query}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar por paciente, archivo o practicante"
              className="w-full rounded-md border border-blue-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400 sm:w-80"
            />
            <select
              value={sourceFilter}
              onChange={(event) => onSourceChange(event.target.value as 'all' | 'email' | 'database')}
              className="rounded-md border border-blue-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
            >
              <option value="all">Todos</option>
              <option value="email">Solo correo</option>
              <option value="database">Solo sistema</option>
            </select>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value) || 20)}
              className="rounded-md border border-blue-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
            >
              <option value={20}>20 por página</option>
              <option value={50}>50 por página</option>
              <option value={100}>100 por página</option>
            </select>
          </div>
        </div>

        {loading ? <p className="text-sm text-slate-600">Cargando PDFs...</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {!loading && !error ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-blue-900 border-b border-blue-100">
                    <th className="py-2">Origen</th>
                    <th className="py-2">Paciente</th>
                    <th className="py-2">Practicante</th>
                    <th className="py-2">Archivo</th>
                    <th className="py-2">Fecha</th>
                    <th className="py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pdfs.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-2">{item.source === 'email' ? 'Correo' : 'Sistema'}</td>
                      <td className="py-2">{item.patient?.name || 'Sin paciente'}</td>
                      <td className="py-2">{item.practitioner?.name || 'Sin asignar'}</td>
                      <td className="py-2">{item.filename}</td>
                      <td className="py-2">{new Date(item.uploadedAt).toLocaleString('es-CO')}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openPdf(item)}
                            className="rounded-md border border-blue-200 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-50"
                          >
                            Ver
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadPdf(item)}
                            className="rounded-md border border-emerald-200 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                          >
                            Descargar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-600">
                {total === 0 ? 'Sin resultados' : `Mostrando ${startIndex}-${endIndex} de ${total}`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="text-slate-700">Página {page} de {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={!hasMore && page >= totalPages}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
