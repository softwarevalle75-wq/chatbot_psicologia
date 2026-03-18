import { type FormEvent, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit, Eye, Plus, Search, Trash2 } from 'lucide-react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { api } from '../../services/api';
import type { Practitioner } from '../../types';
import StudentForm, { type PractitionerFormData } from './components/StudentForm';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
}

export default function AdminStudentsPage() {
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [selectedPractitioner, setSelectedPractitioner] = useState<Practitioner | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [practitionerToDelete, setPractitionerToDelete] = useState<Practitioner | null>(null);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadPractitioners = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (search) params.append('search', search);

      const res = await fetch(`${import.meta.env.VITE_CORE_API_BASE_URL || '/v1'}/practitioners?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Error al cargar practicantes');

      const data: PaginatedResponse<Practitioner> = await res.json();
      setPractitioners(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_CORE_API_BASE_URL || '/v1'}/practitioners/stats`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (res.ok) {
        const data: Stats = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  useEffect(() => {
    loadPractitioners();
  }, [page, search]);

  useEffect(() => {
    loadStats();
  }, []);

  const handleCreate = async (data: PractitionerFormData) => {
    setMessage('');
    setError('');
    try {
      await api.createStudent({
        name: data.name,
        lastName: data.lastName || undefined,
        email: data.email,
        documentNumber: data.documentNumber,
        documentType: 'CC',
        gender: data.gender,
        eps: data.eps || undefined,
        phone: data.phone || undefined,
        clinic: data.clinic || undefined,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
        active: data.active,
      });
      setMessage('Practicante creado correctamente');
      setIsCreateModalOpen(false);
      loadPractitioners();
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear');
    }
  };

  const handleEdit = async (data: PractitionerFormData) => {
    if (!selectedPractitioner) return;
    setMessage('');
    setError('');
    try {
      await fetch(`${import.meta.env.VITE_CORE_API_BASE_URL || '/v1'}/practitioners/${selectedPractitioner.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      setMessage('Practicante actualizado correctamente');
      setIsEditModalOpen(false);
      setSelectedPractitioner(null);
      loadPractitioners();
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  const handleDelete = async () => {
    if (!practitionerToDelete) return;
    setMessage('');
    setError('');
    try {
      await fetch(`${import.meta.env.VITE_CORE_API_BASE_URL || '/v1'}/practitioners/${practitionerToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      setMessage('Practicante eliminado correctamente');
      setIsDeleteModalOpen(false);
      setPractitionerToDelete(null);
      loadPractitioners();
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-CO');
  };

  return (
    <DashboardLayout title="Gestión de Practicantes" subtitle="Administración de practicantes del consultorio">
      <div className="space-y-6">
        <div className="bg-white border border-blue-100 rounded-2xl p-6 shadow-sm">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-slate-600 mt-1">Total de Practicantes</div>
          </div>
        </div>

        <div className="bg-white border border-blue-100 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, documento, correo..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-blue-200 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
                Buscar
              </button>
            </form>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#4a8af4] text-white rounded-xl text-sm font-medium hover:bg-[#3d7ae0]"
            >
              <Plus className="w-4 h-4" />
              Nuevo Practicante
            </button>
          </div>
        </div>

        <div className="bg-white border border-blue-100 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Cargando...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-500">{error}</div>
          ) : practitioners.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No se encontraron practicantes</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-50 text-blue-900">
                      <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                      <th className="px-4 py-3 text-left font-semibold">Documento</th>
                      <th className="px-4 py-3 text-left font-semibold">Correo</th>
                      <th className="px-4 py-3 text-left font-semibold">Teléfono</th>
                      <th className="px-4 py-3 text-left font-semibold">EPS/IPS</th>
                      <th className="px-4 py-3 text-left font-semibold">Clínica</th>
                      <th className="px-4 py-3 text-left font-semibold">Fecha Inicio</th>
                      <th className="px-4 py-3 text-left font-semibold">Estado</th>
                      <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {practitioners.map((p) => (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-blue-900">{p.name} {p.lastName}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{p.documentNumber}</td>
                        <td className="px-4 py-3 text-slate-600">{p.email || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{p.phone || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{p.eps || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{p.clinic || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(p.startDate)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              p.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {p.active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedPractitioner(p);
                                setIsViewModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Ver"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedPractitioner(p);
                                setIsEditModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setPractitionerToDelete(p);
                                setIsDeleteModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                  <div className="text-sm text-slate-500">
                    Mostrando {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} de {total}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-2 text-sm">
                      Página {page} de {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-2 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-semibold text-blue-900">Nuevo Practicante</h2>
            </div>
            <div className="p-6">
              {message && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-xl text-sm">{message}</div>}
              {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}
              <StudentForm practitioner={null} onSubmit={handleCreate} onCancel={() => setIsCreateModalOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && selectedPractitioner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-semibold text-blue-900">Editar Practicante</h2>
            </div>
            <div className="p-6">
              {message && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-xl text-sm">{message}</div>}
              {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}
              <StudentForm
                practitioner={selectedPractitioner}
                onSubmit={handleEdit}
                onCancel={() => {
                  setIsEditModalOpen(false);
                  setSelectedPractitioner(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {isViewModalOpen && selectedPractitioner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-semibold text-blue-900">Detalles del Practicante</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Nombre</p>
                  <p className="font-medium text-blue-900">{selectedPractitioner.name} {selectedPractitioner.lastName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Documento</p>
                  <p className="font-medium text-blue-900">{selectedPractitioner.documentNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Correo</p>
                  <p className="font-medium text-blue-900">{selectedPractitioner.email || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Teléfono</p>
                  <p className="font-medium text-blue-900">{selectedPractitioner.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Género</p>
                  <p className="font-medium text-blue-900">{selectedPractitioner.gender || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">EPS/IPS</p>
                  <p className="font-medium text-blue-900">{selectedPractitioner.eps || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Clínica</p>
                  <p className="font-medium text-blue-900">{selectedPractitioner.clinic || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Fecha Inicio</p>
                  <p className="font-medium text-blue-900">{formatDate(selectedPractitioner.startDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Fecha Fin</p>
                  <p className="font-medium text-blue-900">{formatDate(selectedPractitioner.endDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Estado</p>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      selectedPractitioner.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {selectedPractitioner.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedPractitioner(null);
                }}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-full hover:bg-blue-100"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && practitionerToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-semibold text-red-600">Confirmar Eliminación</h2>
            </div>
            <div className="p-6">
              {message && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-xl text-sm">{message}</div>}
              {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}
              <p className="text-slate-600">
                ¿Está seguro que desea eliminar al practicante{' '}
                <strong>{practitionerToDelete.name} {practitionerToDelete.lastName}</strong>?
              </p>
              <p className="text-sm text-slate-500 mt-2">Esta acción no se puede deshacer.</p>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setPractitionerToDelete(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-full hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-full hover:bg-red-700">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
