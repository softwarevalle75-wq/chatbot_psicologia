import { useState, useEffect } from 'react';
import type { Practitioner } from '../../../types';

interface StudentFormProps {
  practitioner: Practitioner | null;
  onSubmit: (data: PractitionerFormData) => void;
  onCancel: () => void;
}

export interface PractitionerFormData {
  name: string;
  lastName?: string;
  documentNumber: string;
  email: string;
  phone?: string;
  gender?: string;
  eps?: string;
  clinic?: string;
  startDate?: string;
  endDate?: string;
  schedule?: string;
  active?: boolean;
}

const GENDER_OPTIONS = [
  { value: '', label: 'Seleccionar...' },
  { value: 'Masculino', label: 'Masculino' },
  { value: 'Femenino', label: 'Femenino' },
  { value: 'Otro', label: 'Otro' },
  { value: 'No especificado', label: 'No especificado' },
];

const inputClass = 'w-full rounded-xl border border-blue-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400';
const labelClass = 'block text-sm font-medium text-blue-950 mb-1';

export default function StudentForm({ practitioner, onSubmit, onCancel }: StudentFormProps) {
  const [formData, setFormData] = useState<PractitionerFormData>({
    name: '',
    lastName: '',
    documentNumber: '',
    email: '',
    phone: '',
    gender: '',
    eps: '',
    clinic: '',
    startDate: '',
    endDate: '',
    schedule: '',
    active: true,
  });

  const [tieneTiempo, setTieneTiempo] = useState(false);

  useEffect(() => {
    if (practitioner) {
      setFormData({
        name: practitioner.name || '',
        lastName: practitioner.lastName || '',
        documentNumber: practitioner.documentNumber || '',
        email: practitioner.email || '',
        phone: practitioner.phone || '',
        gender: practitioner.gender || '',
        eps: practitioner.eps || '',
        clinic: practitioner.clinic || '',
        startDate: practitioner.startDate ? new Date(practitioner.startDate).toISOString().split('T')[0] : '',
        endDate: practitioner.endDate ? new Date(practitioner.endDate).toISOString().split('T')[0] : '',
        schedule: practitioner.schedule ? JSON.stringify(practitioner.schedule) : '',
        active: practitioner.active ?? true,
      });
      setTieneTiempo(!!practitioner.startDate);
    }
  }, [practitioner]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleToggleTiempo = (checked: boolean) => {
    setTieneTiempo(checked);
    if (!checked) {
      setFormData(prev => ({ ...prev, startDate: '', endDate: '' }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Nombre del/la practicante *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={inputClass}
            placeholder="Nombres"
            required
          />
        </div>

        <div>
          <label className={labelClass}>Apellidos</label>
          <input
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            className={inputClass}
            placeholder="Apellidos"
          />
        </div>

        <div>
          <label className={labelClass}>Número de documento *</label>
          <input
            type="text"
            name="documentNumber"
            value={formData.documentNumber}
            onChange={handleChange}
            className={inputClass}
            placeholder="Número de documento"
            required
            disabled={!!practitioner}
          />
        </div>

        <div>
          <label className={labelClass}>Correo electrónico *</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={inputClass}
            placeholder="correo@ejemplo.com"
            required
          />
        </div>

        <div>
          <label className={labelClass}>Teléfono</label>
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className={inputClass}
            placeholder="3001234567"
          />
        </div>

        <div>
          <label className={labelClass}>Género</label>
          <select
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            className={inputClass}
          >
            {GENDER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>EPS/IPS</label>
          <input
            type="text"
            name="eps"
            value={formData.eps}
            onChange={handleChange}
            className={inputClass}
            placeholder="EPS/IPS"
          />
        </div>

        <div>
          <label className={labelClass}>Clínica</label>
          <input
            type="text"
            name="clinic"
            value={formData.clinic}
            onChange={handleChange}
            className={inputClass}
            placeholder="Clínica"
          />
        </div>

        <div>
          <label className={labelClass}>Horario de prácticas</label>
          <input
            type="text"
            name="schedule"
            value={formData.schedule}
            onChange={handleChange}
            className={inputClass}
            placeholder="Ej: Lun-Vie 8am-12pm"
          />
        </div>

        <div>
          <label className={labelClass}>Estado</label>
          <select
            name="active"
            value={formData.active ? 'true' : 'false'}
            onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.value === 'true' }))}
            className={inputClass}
          >
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 py-2 border-t border-blue-100 mt-4">
        <input
          type="checkbox"
          id="tieneTiempo"
          checked={tieneTiempo}
          onChange={(e) => handleToggleTiempo(e.target.checked)}
          className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-200"
        />
        <label htmlFor="tieneTiempo" className="text-sm font-medium text-blue-900">
          ¿Ya tiene tiempo en el consultorio?
        </label>
      </div>

      {tieneTiempo && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Fecha de inicio</label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Fecha de finalización</label>
            <input
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              className={inputClass}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-full hover:bg-blue-100"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-6 py-2 text-sm font-medium text-white bg-[#4a8af4] rounded-full hover:bg-[#3d7ae0]"
        >
          {practitioner ? 'Actualizar' : 'Crear'}
        </button>
      </div>
    </form>
  );
}
