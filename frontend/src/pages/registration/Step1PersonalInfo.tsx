import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, CreditCard, Globe, Lock, GraduationCap } from 'lucide-react';
import RegistrationLayout from '../../components/registration/RegistrationLayout';
import StepNavigation from '../../components/registration/StepNavigation';
import { useAuth } from '../../context/AuthContext';
import type { Step1Data } from '../../types';

const INITIAL: Step1Data = {
  primerNombre: '',
  segundoNombre: '',
  primerApellido: '',
  segundoApellido: '',
  tipoDocumento: '',
  documento: '',
  genero: '',
  correo: '',
  telefonoPersonal: '',
  fechaNacimiento: '',
  perteneceUniversidad: 'No',
  esAspirante: false,
  carrera: '',
  jornada: '',
  semestre: '',
  password: '',
  confirmPassword: '',
};

const inputClass =
  'w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200';
const selectClass =
  'w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200 appearance-none cursor-pointer';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';

export default function Step1PersonalInfo() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState<Step1Data>(() => {
    const saved = sessionStorage.getItem('reg_step1');
    return saved ? { ...INITIAL, ...JSON.parse(saved) } : INITIAL;
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field: keyof Step1Data, value: string | boolean) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      sessionStorage.setItem('reg_step1', JSON.stringify(next));
      return next;
    });
  };

  const validate = (): string | null => {
    if (!form.primerNombre.trim()) return 'El primer nombre es obligatorio';
    if (!form.primerApellido.trim()) return 'El primer apellido es obligatorio';
    if (!form.tipoDocumento) return 'Selecciona el tipo de documento';
    if (!form.documento.trim()) return 'El numero de documento es obligatorio';
    if (!form.genero) return 'Selecciona el genero';
    if (!form.correo.trim()) return 'El correo es obligatorio';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo)) return 'El correo no es valido';
    if (!form.telefonoPersonal.trim()) return 'El telefono es obligatorio';
    if (!form.fechaNacimiento) return 'La fecha de nacimiento es obligatoria';
    if (form.perteneceUniversidad === 'Si') {
      if (!form.carrera.trim()) return 'La carrera es obligatoria si perteneces a la universidad';
      if (!form.jornada) return 'La jornada es obligatoria si perteneces a la universidad';
      if (!form.semestre) return 'El semestre es obligatorio si perteneces a la universidad';
    }
    if (form.perteneceUniversidad === 'Si' && form.esAspirante) return 'No puedes marcar pertenencia y aspirante al mismo tiempo';
    if (!form.password) return 'La contrasena es obligatoria';
    if (form.password.length < 6) return 'La contrasena debe tener al menos 6 caracteres';
    if (form.password !== form.confirmPassword) return 'Las contrasenas no coinciden';
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
      await register({
        primerNombre: form.primerNombre.trim(),
        segundoNombre: form.segundoNombre.trim() || undefined,
        primerApellido: form.primerApellido.trim(),
        segundoApellido: form.segundoApellido.trim() || undefined,
        tipoDocumento: form.tipoDocumento,
        documento: form.documento.trim(),
        genero: form.genero,
        correo: form.correo.trim(),
        telefonoPersonal: form.telefonoPersonal.trim(),
        fechaNacimiento: form.fechaNacimiento,
        perteneceUniversidad: form.perteneceUniversidad,
        esAspirante: form.esAspirante,
        carrera: form.perteneceUniversidad === 'Si' ? form.carrera.trim() : undefined,
        jornada: form.perteneceUniversidad === 'Si' ? form.jornada : undefined,
        semestre: form.perteneceUniversidad === 'Si' ? Number(form.semestre) : undefined,
        password: form.password,
      });
      sessionStorage.removeItem('reg_step1');
      navigate('/registro/tratamiento-datos');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al registrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RegistrationLayout currentStep={1}>
      {/* Error message */}
      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      {/* SECCION 1: NOMBRES */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-5 h-5 text-blue-500" />
          <h3 className="text-sm font-bold text-blue-500 tracking-wider uppercase">
            Seccion 1: Nombres
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Primer nombre</label>
            <input
              type="text"
              className={inputClass}
              placeholder="Ej. Juan"
              value={form.primerNombre}
              onChange={(e) => update('primerNombre', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Segundo nombre</label>
            <input
              type="text"
              className={inputClass}
              placeholder="Ej. Alberto"
              value={form.segundoNombre}
              onChange={(e) => update('segundoNombre', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Primer apellido</label>
            <input
              type="text"
              className={inputClass}
              placeholder="Ej. Perez"
              value={form.primerApellido}
              onChange={(e) => update('primerApellido', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Segundo apellido</label>
            <input
              type="text"
              className={inputClass}
              placeholder="Ej. Gomez"
              value={form.segundoApellido}
              onChange={(e) => update('segundoApellido', e.target.value)}
            />
          </div>
        </div>
      </section>

      <hr className="border-gray-100 mb-8" />

      {/* SECCION 2: IDENTIFICACION */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-5">
          <CreditCard className="w-5 h-5 text-blue-500" />
          <h3 className="text-sm font-bold text-blue-500 tracking-wider uppercase">
            Seccion 2: Identificacion
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Tipo de documento</label>
            <select
              className={selectClass}
              value={form.tipoDocumento}
              onChange={(e) => update('tipoDocumento', e.target.value)}
            >
              <option value="">Seleccione...</option>
              <option value="CC">Cedula de Ciudadania</option>
              <option value="TI">Tarjeta de Identidad</option>
              <option value="CE">Cedula de Extranjeria</option>
              <option value="PA">Pasaporte</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Numero de documento</label>
            <input
              type="text"
              className={inputClass}
              placeholder="000.000.000"
              value={form.documento}
              onChange={(e) => update('documento', e.target.value)}
            />
          </div>
        </div>
      </section>

      <hr className="border-gray-100 mb-8" />

      {/* SECCION 3: DEMOGRAFIA */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-5">
          <Globe className="w-5 h-5 text-blue-500" />
          <h3 className="text-sm font-bold text-blue-500 tracking-wider uppercase">
            Seccion 3: Demografia
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Genero</label>
            <select
              className={selectClass}
              value={form.genero}
              onChange={(e) => update('genero', e.target.value)}
            >
              <option value="">Seleccione...</option>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
              <option value="Otro">Otro</option>
              <option value="Prefiero no decir">Prefiero no decir</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Fecha de nacimiento</label>
            <input
              type="date"
              className={inputClass}
              value={form.fechaNacimiento}
              onChange={(e) => update('fechaNacimiento', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Correo electronico</label>
            <input
              type="email"
              className={inputClass}
              placeholder="correo@ejemplo.com"
              value={form.correo}
              onChange={(e) => update('correo', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Telefono</label>
            <input
              type="tel"
              className={inputClass}
              placeholder="3001234567"
              value={form.telefonoPersonal}
              onChange={(e) => update('telefonoPersonal', e.target.value)}
            />
          </div>
        </div>
      </section>

      <hr className="border-gray-100 mb-8" />

      {/* SECCION 4: UNIVERSIDAD */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-5">
          <GraduationCap className="w-5 h-5 text-blue-500" />
          <h3 className="text-sm font-bold text-blue-500 tracking-wider uppercase">
            Seccion 4: Universidad
          </h3>
        </div>

        <div className="mb-4">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                form.perteneceUniversidad === 'Si'
                  ? 'bg-blue-500 border-blue-500'
                  : 'border-gray-300'
              }`}
              onClick={() =>
                setForm((prev) => {
                  const nuevoPertenece = prev.perteneceUniversidad === 'Si' ? 'No' : 'Si';
                  const next = {
                    ...prev,
                    perteneceUniversidad: nuevoPertenece,
                    esAspirante: nuevoPertenece === 'Si' ? false : prev.esAspirante,
                    carrera: nuevoPertenece === 'Si' ? prev.carrera : '',
                    jornada: nuevoPertenece === 'Si' ? prev.jornada : '',
                    semestre: nuevoPertenece === 'Si' ? prev.semestre : '',
                  };
                  sessionStorage.setItem('reg_step1', JSON.stringify(next));
                  return next;
                })
              }
            >
              {form.perteneceUniversidad === 'Si' && (
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm text-gray-700 font-medium">
              Pertenezco a la Institucion Universitaria de Colombia
            </span>
          </label>
        </div>

        <div className="mb-4">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                form.esAspirante
                  ? 'bg-blue-500 border-blue-500'
                  : 'border-gray-300'
              }`}
              onClick={() =>
                setForm((prev) => {
                  const next = {
                    ...prev,
                    esAspirante: !prev.esAspirante,
                    perteneceUniversidad: !prev.esAspirante ? 'No' : prev.perteneceUniversidad,
                    carrera: !prev.esAspirante ? '' : prev.carrera,
                    jornada: !prev.esAspirante ? '' : prev.jornada,
                    semestre: !prev.esAspirante ? '' : prev.semestre,
                  };
                  sessionStorage.setItem('reg_step1', JSON.stringify(next));
                  return next;
                })
              }
            >
              {form.esAspirante && (
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm text-gray-700 font-medium">
              Soy aspirante para ingresar a la universidad
            </span>
          </label>
        </div>

        {form.perteneceUniversidad === 'Si' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in">
            <div>
              <label className={labelClass}>Carrera</label>
              <input
                type="text"
                className={inputClass}
                placeholder="Ej. Psicologia"
                value={form.carrera}
                onChange={(e) => update('carrera', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Jornada</label>
              <select
                className={selectClass}
                value={form.jornada}
                onChange={(e) => update('jornada', e.target.value)}
              >
                <option value="">Seleccione...</option>
                <option value="Diurna">Diurna</option>
                <option value="Nocturna">Nocturna</option>
                <option value="Virtual">Virtual</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Semestre</label>
              <select
                className={selectClass}
                value={form.semestre}
                onChange={(e) => update('semestre', e.target.value)}
              >
                <option value="">Seleccione...</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((s) => (
                  <option key={s} value={String(s)}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

          </div>
        )}
      </section>

      <hr className="border-gray-100 mb-8" />

      {/* SECCION 5: CONTRASENA */}
      <section className="mb-4">
        <div className="flex items-center gap-2 mb-5">
          <Lock className="w-5 h-5 text-blue-500" />
          <h3 className="text-sm font-bold text-blue-500 tracking-wider uppercase">
            Seccion 5: Contrasena
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Contrasena</label>
            <input
              type="password"
              className={inputClass}
              placeholder="Minimo 6 caracteres"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Confirmar contrasena</label>
            <input
              type="password"
              className={inputClass}
              placeholder="Repite la contrasena"
              value={form.confirmPassword}
              onChange={(e) => update('confirmPassword', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Navigation */}
      <StepNavigation
        onNext={handleNext}
        nextLabel={loading ? 'Registrando...' : 'Continuar'}
        nextDisabled={loading}
        showBack={false}
      />
    </RegistrationLayout>
  );
}
