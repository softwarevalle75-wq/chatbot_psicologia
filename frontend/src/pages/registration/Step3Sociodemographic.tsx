import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Users, GraduationCap, Briefcase, DollarSign, Home, UserCheck } from 'lucide-react';
import RegistrationLayout from '../../components/registration/RegistrationLayout';
import StepNavigation from '../../components/registration/StepNavigation';
import SelectableGrid from '../../components/registration/SelectableGrid';
import { useAuth } from '../../context/AuthContext';
import type { Step3Data } from '../../types';

const INITIAL: Step3Data = {
  estadoCivil: '',
  numeroHijos: 0,
  numeroHermanos: 0,
  rolFamiliar: '',
  conQuienVive: '',
  tienePersonasACargo: '',
  escolaridad: '',
  ocupacion: '',
  nivelIngresos: '',
};

const ESTADO_CIVIL = [
  { value: 'soltero', label: 'Soltero/a' },
  { value: 'casado', label: 'Casado/a' },
  { value: 'union_libre', label: 'Union libre' },
  { value: 'divorciado', label: 'Divorciado/a' },
  { value: 'viudo', label: 'Viudo/a' },
  { value: 'separado', label: 'Separado/a' },
];

const HIJOS = [
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4+' },
];

const HERMANOS = [
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4+' },
];

const ROL_FAMILIAR = [
  { value: 'madre', label: 'Madre' },
  { value: 'padre', label: 'Padre' },
  { value: 'hijo', label: 'Hijo/a' },
  { value: 'hermano', label: 'Hermano/a' },
  { value: 'abuelo', label: 'Abuelo/a' },
  { value: 'tio', label: 'Tio/a' },
  { value: 'otro', label: 'Otro' },
];

const PERSONAS_A_CARGO = [
  { value: 'Si', label: 'Si' },
  { value: 'No', label: 'No' },
];

const ESCOLARIDAD = [
  { value: 'primaria_completa', label: 'Primaria / Secundaria' },
  { value: 'tecnico_completo', label: 'Tecnico / Tecnologico' },
  { value: 'universitario_completo', label: 'Universitario' },
  { value: 'posgrado_completo', label: 'Posgrado / Maestria' },
];

const OCUPACION = [
  { value: 'Empleado', label: 'Empleado' },
  { value: 'Independiente', label: 'Independiente' },
  { value: 'Estudiante', label: 'Estudiante' },
  { value: 'Desempleado', label: 'Desempleado' },
  { value: 'Hogar', label: 'Hogar' },
  { value: 'Jubilado', label: 'Jubilado' },
];

const NIVEL_INGRESOS = [
  { value: 'nivel_0_1_smmlv', label: '0 - 1 SMMLV' },
  { value: 'nivel_1_2_smmlv', label: '1 - 2 SMMLV' },
  { value: 'nivel_2_3_smmlv', label: '2 - 3 SMMLV' },
  { value: 'nivel_3_4_smmlv', label: '3 - 4 SMMLV' },
  { value: 'mayor_4_smmlv', label: '> 4 SMMLV' },
];

const inputClass =
  'w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200';

export default function Step3Sociodemographic() {
  const navigate = useNavigate();
  const { saveSociodemografico } = useAuth();
  const [form, setForm] = useState<Step3Data>(() => {
    const saved = sessionStorage.getItem('reg_step3');
    return saved ? JSON.parse(saved) : INITIAL;
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = <K extends keyof Step3Data>(field: K, value: Step3Data[K]) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      sessionStorage.setItem('reg_step3', JSON.stringify(next));
      return next;
    });
  };

  const validate = (): string | null => {
    if (!form.estadoCivil) return 'Selecciona tu estado civil';
    if (!form.rolFamiliar) return 'Selecciona tu rol familiar';
    if (!form.conQuienVive.trim()) return 'Indica con quien vives actualmente';
    if (!form.tienePersonasACargo) return 'Indica si tienes personas a cargo';
    if (!form.escolaridad) return 'Selecciona tu nivel de escolaridad';
    if (!form.ocupacion) return 'Selecciona tu ocupacion actual';
    if (!form.nivelIngresos) return 'Selecciona tu nivel de ingresos';
    return null;
  };

  const handleNext = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setLoading(true);
    try {
      await saveSociodemografico({
        estadoCivil: form.estadoCivil,
        numeroHijos: form.numeroHijos,
        numeroHermanos: form.numeroHermanos,
        rolFamiliar: form.rolFamiliar,
        conQuienVive: form.conQuienVive.trim(),
        tienePersonasACargo: form.tienePersonasACargo,
        escolaridad: form.escolaridad,
        ocupacion: form.ocupacion,
        nivelIngresos: form.nivelIngresos,
      });
      sessionStorage.removeItem('reg_step3');
      navigate('/registro/consentimiento');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RegistrationLayout currentStep={3}>
      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      {/* Estado Civil */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="w-5 h-5 text-blue-500" />
          <h3 className="text-base font-bold text-gray-800">Estado Civil</h3>
        </div>
        <SelectableGrid
          options={ESTADO_CIVIL}
          selected={form.estadoCivil}
          onChange={(v) => update('estadoCivil', v)}
          variant="pill"
        />
      </section>

      {/* Numero de hijos */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-500" />
          <h3 className="text-base font-bold text-gray-800">Numero de hijos</h3>
        </div>
        <SelectableGrid
          options={HIJOS}
          selected={String(form.numeroHijos)}
          onChange={(v) => update('numeroHijos', Number(v))}
          variant="circle"
        />
      </section>

      {/* Numero de hermanos */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-500" />
          <h3 className="text-base font-bold text-gray-800">Numero de hermanos</h3>
        </div>
        <SelectableGrid
          options={HERMANOS}
          selected={String(form.numeroHermanos)}
          onChange={(v) => update('numeroHermanos', Number(v))}
          variant="circle"
        />
      </section>

      {/* Rol familiar */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <UserCheck className="w-5 h-5 text-blue-500" />
          <h3 className="text-base font-bold text-gray-800">Su rol en la familia</h3>
        </div>
        <SelectableGrid
          options={ROL_FAMILIAR}
          selected={form.rolFamiliar}
          onChange={(v) => update('rolFamiliar', v)}
          variant="pill"
        />
      </section>

      {/* Con quien vive */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Home className="w-5 h-5 text-blue-500" />
          <h3 className="text-base font-bold text-gray-800">Con quien vive actualmente?</h3>
        </div>
        <input
          type="text"
          className={inputClass}
          placeholder="Ej. Padres, pareja, solo/a..."
          value={form.conQuienVive}
          onChange={(e) => update('conQuienVive', e.target.value)}
        />
      </section>

      {/* Personas a cargo */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-500" />
          <h3 className="text-base font-bold text-gray-800">Tiene personas a cargo?</h3>
        </div>
        <SelectableGrid
          options={PERSONAS_A_CARGO}
          selected={form.tienePersonasACargo}
          onChange={(v) => update('tienePersonasACargo', v)}
          variant="pill"
        />
      </section>

      {/* Escolaridad */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="w-5 h-5 text-blue-500" />
          <h3 className="text-base font-bold text-gray-800">Nivel de escolaridad</h3>
        </div>
        <SelectableGrid
          options={ESCOLARIDAD}
          selected={form.escolaridad}
          onChange={(v) => update('escolaridad', v)}
          variant="wide"
          columns={2}
        />
      </section>

      {/* Ocupacion actual */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="w-5 h-5 text-blue-500" />
          <h3 className="text-base font-bold text-gray-800">Ocupacion actual</h3>
        </div>
        <SelectableGrid
          options={OCUPACION}
          selected={form.ocupacion}
          onChange={(v) => update('ocupacion', v)}
          variant="pill"
        />
      </section>

      {/* Nivel de ingresos */}
      <section className="mb-4">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-blue-500" />
          <h3 className="text-base font-bold text-gray-800">Nivel de ingresos</h3>
        </div>
        <SelectableGrid
          options={NIVEL_INGRESOS}
          selected={form.nivelIngresos}
          onChange={(v) => update('nivelIngresos', v)}
          variant="pill"
        />
      </section>

      {/* Navigation */}
      <StepNavigation
        onBack={() => navigate('/registro/tratamiento-datos')}
        backLabel="Volver al paso 2"
        onNext={handleNext}
        nextLabel={loading ? 'Guardando...' : 'Continuar'}
        nextDisabled={loading}
      />
    </RegistrationLayout>
  );
}
