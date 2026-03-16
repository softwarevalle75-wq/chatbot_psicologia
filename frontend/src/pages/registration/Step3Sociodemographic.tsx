import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Users, GraduationCap, Briefcase, DollarSign, Home, UserCheck } from 'lucide-react';
import RegistrationLayout from '../../components/registration/RegistrationLayout';
import StepNavigation from '../../components/registration/StepNavigation';
import SelectableGrid from '../../components/registration/SelectableGrid';
import { useAuth } from '../../context/AuthContext';
import type { Step3Data } from '../../types';
import { validateStep3, isFormValid, type FormErrors } from '../../utils/validations';

const INITIAL: Step3Data = {
  estadoCivil: '',
  numeroHijos: 0,
  numeroHermanos: 0,
  rolFamiliar: [],
  conQuienVive: '',
  tienePersonasACargo: '',
  personasACargoQuien: '',
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
const inputErrorClass =
  'w-full px-4 py-3 rounded-xl border border-red-400 bg-red-50/30 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all duration-200';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';
const fieldErrorClass = 'mt-1.5 text-xs font-medium text-red-600';
const helperClass =
  'mt-2 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs font-semibold px-3 py-2';

export default function Step3Sociodemographic() {
  const navigate = useNavigate();
  const { saveSociodemografico } = useAuth();
  const [form, setForm] = useState<Step3Data>(() => {
    const saved = sessionStorage.getItem('reg_step3');
    return saved ? JSON.parse(saved) : INITIAL;
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [touchedHome, setTouchedHome] = useState(false);
  const [touchedPersonasQuien, setTouchedPersonasQuien] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const update = <K extends keyof Step3Data>(field: K, value: Step3Data[K]) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      sessionStorage.setItem('reg_step3', JSON.stringify(next));
      return next;
    });
  };

  const toggleRolFamiliar = (value: string) => {
    const alreadySelected = form.rolFamiliar.includes(value);

    if (alreadySelected) {
      update('rolFamiliar', form.rolFamiliar.filter((role) => role !== value));
      return;
    }

    let nextRoles = [...form.rolFamiliar, value];

    if (value === 'madre') {
      nextRoles = nextRoles.filter((role) => role !== 'padre');
    }

    if (value === 'padre') {
      nextRoles = nextRoles.filter((role) => role !== 'madre');
    }

    update('rolFamiliar', nextRoles);
  };

  const handleNext = () => {
    const formErrors = validateStep3(form);
    setErrors(formErrors);
    if (!isFormValid(formErrors)) return;
    setShowConfirm(true);
  };

  const submitSociodemografico = async () => {
    setLoading(true);
    try {
      await saveSociodemografico({
        estadoCivil: form.estadoCivil,
        numeroHijos: form.numeroHijos,
        numeroHermanos: form.numeroHermanos,
        rolFamiliar: form.rolFamiliar,
        conQuienVive: form.conQuienVive.trim(),
        tienePersonasACargo: form.tienePersonasACargo,
        personasACargoQuien:
          form.tienePersonasACargo === 'Si' ? form.personasACargoQuien.trim() : undefined,
        escolaridad: form.escolaridad,
        ocupacion: form.ocupacion,
        nivelIngresos: form.nivelIngresos,
      });
      sessionStorage.removeItem('reg_step3');
      navigate('/registro/consentimiento');
    } catch (e) {
      setErrors({ _general: e instanceof Error ? e.message : 'Error al guardar' });
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <RegistrationLayout currentStep={3}>
      <div className="mb-6 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 font-medium">
        Los campos con <span className="text-red-500 font-semibold">(*)</span> son obligatorios.
      </div>

      {/* Estado Civil */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="w-5 h-5 text-blue-500" />
          <h3 className="text-base font-bold text-gray-800">Estado Civil <span className="text-red-500 font-semibold">(*)</span></h3>
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
          <h3 className="text-base font-bold text-gray-800">Numero de hijos <span className="text-red-500 font-semibold">(*)</span></h3>
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
          <h3 className="text-base font-bold text-gray-800">Numero de hermanos <span className="text-red-500 font-semibold">(*)</span></h3>
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
          <h3 className="text-base font-bold text-gray-800">Su rol en la familia <span className="text-red-500 font-semibold">(*)</span></h3>
        </div>
        <SelectableGrid
          options={ROL_FAMILIAR}
          selected={form.rolFamiliar}
          onChange={toggleRolFamiliar}
          variant="pill"
        />
        {errors.rolFamiliar && <p className={fieldErrorClass}>{errors.rolFamiliar}</p>}
      </section>

      {/* Con quien vive */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Home className="w-5 h-5 text-blue-500" />
          <h3 className="text-base font-bold text-gray-800">Con quien vive actualmente? <span className="text-red-500 font-semibold">(*)</span></h3>
        </div>
        <label htmlFor="con-quien-vive" className={labelClass}>
          Describe con quien compartes tu hogar <span className="text-red-500 font-semibold">(*)</span>
        </label>
        <input
          id="con-quien-vive"
          type="text"
          className={errors.conQuienVive ? inputErrorClass : inputClass}
          placeholder="Ej. Padres, pareja, solo/a..."
          value={form.conQuienVive}
          maxLength={100}
          onChange={(e) => update('conQuienVive', e.target.value)}
          onBlur={() => setTouchedHome(true)}
        />
        {errors.conQuienVive
          ? <p className={fieldErrorClass}>{errors.conQuienVive}</p>
          : touchedHome && form.conQuienVive.trim() && (
            <p className={helperClass}>Verifique que este dato sea correcto.</p>
          )}
      </section>

      {/* Personas a cargo */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-500" />
          <h3 className="text-base font-bold text-gray-800">Tiene personas a cargo? <span className="text-red-500 font-semibold">(*)</span></h3>
        </div>
        <SelectableGrid
          options={PERSONAS_A_CARGO}
          selected={form.tienePersonasACargo}
          onChange={(v) => {
            update('tienePersonasACargo', v);
            if (v !== 'Si') {
              update('personasACargoQuien', '');
            }
          }}
          variant="pill"
        />
        {errors.tienePersonasACargo && <p className={fieldErrorClass}>{errors.tienePersonasACargo}</p>}
        {form.tienePersonasACargo === 'Si' && (
          <div className="mt-4">
            <label htmlFor="personas-a-cargo-quien" className={labelClass}>
              Quien? <span className="text-red-500 font-semibold">(*)</span>
            </label>
            <input
              id="personas-a-cargo-quien"
              type="text"
              className={errors.personasACargoQuien ? inputErrorClass : inputClass}
              placeholder="Ej. Mi hijo menor"
              value={form.personasACargoQuien}
              maxLength={100}
              onChange={(e) => update('personasACargoQuien', e.target.value)}
              onBlur={() => setTouchedPersonasQuien(true)}
            />
            {errors.personasACargoQuien
              ? <p className={fieldErrorClass}>{errors.personasACargoQuien}</p>
              : touchedPersonasQuien && form.personasACargoQuien.trim() && (
                <p className={helperClass}>Verifique que este dato sea correcto.</p>
              )}
          </div>
        )}
      </section>

      {/* Escolaridad */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="w-5 h-5 text-blue-500" />
          <h3 className="text-base font-bold text-gray-800">Nivel de escolaridad <span className="text-red-500 font-semibold">(*)</span></h3>
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
          <h3 className="text-base font-bold text-gray-800">Ocupacion actual <span className="text-red-500 font-semibold">(*)</span></h3>
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
          <h3 className="text-base font-bold text-gray-800">Nivel de ingresos <span className="text-red-500 font-semibold">(*)</span></h3>
        </div>
        <SelectableGrid
          options={NIVEL_INGRESOS}
          selected={form.nivelIngresos}
          onChange={(v) => update('nivelIngresos', v)}
          variant="pill"
        />
      </section>

      {errors._general && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium">
          {errors._general}
        </div>
      )}

      {/* Navigation */}
      <StepNavigation
        onBack={() => navigate('/registro/tratamiento-datos')}
        backLabel="Volver al paso 2"
        onNext={handleNext}
        nextLabel={loading ? 'Guardando...' : 'Continuar'}
        nextDisabled={loading}
      />

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Confirmar datos</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Revise que todos sus datos esten correctamente diligenciados antes de continuar. Si esta seguro presione continuar.
                </p>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowConfirm(false)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                className="flex-1 rounded-full border border-gray-300 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                onClick={() => setShowConfirm(false)}
              >
                Revisar
              </button>
              <button
                type="button"
                className="flex-1 rounded-full bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                onClick={submitSociodemografico}
                disabled={loading}
              >
                {loading ? 'Guardando...' : 'Continuar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </RegistrationLayout>
  );
}
