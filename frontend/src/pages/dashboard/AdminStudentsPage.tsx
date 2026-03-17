import { useState } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { api } from '../../services/api';

const inputClass = 'w-full rounded-xl border border-blue-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400';

export default function AdminStudentsPage() {
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');

    setLoading(true);
    try {
      await api.createStudent({
        name: name.trim(),
        lastName: lastName.trim() || undefined,
        email: email.trim(),
        documentNumber: documentNumber.trim(),
      });
      setMessage('Estudiante/practicante creado correctamente. La cédula queda como contraseña de ingreso.');
      setName('');
      setLastName('');
      setEmail('');
      setDocumentNumber('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el estudiante');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Creacion de estudiantes" subtitle="Alta de practicantes con acceso al dashboard">
      <div className="max-w-3xl bg-white border border-blue-100 rounded-2xl p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-blue-950">Nombres</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium text-blue-950">Apellidos</label>
            <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-blue-950">Correo</label>
            <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium text-blue-950">Cedula</label>
            <input className={inputClass} value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} required />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-[#4a8af4] hover:bg-[#3d7ae0] text-white px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {loading ? 'Guardando...' : 'Crear estudiante'}
            </button>
            {message ? <span className="text-sm text-emerald-700">{message}</span> : null}
            {error ? <span className="text-sm text-red-600">{error}</span> : null}
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
