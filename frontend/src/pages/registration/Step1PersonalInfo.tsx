import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, CreditCard, Globe, Lock, GraduationCap } from 'lucide-react';
import RegistrationLayout from '../../components/registration/RegistrationLayout';
import StepNavigation from '../../components/registration/StepNavigation';
import { useAuth } from '../../context/AuthContext';
import type { Step1Data } from '../../types';
import { validateStep1, isFormValid, type FormErrors } from '../../utils/validations';

const INITIAL: Step1Data = {
  primerNombre: '',
  segundoNombre: '',
  primerApellido: '',
  segundoApellido: '',
  tipoDocumento: '',
  documento: '',
  sexo: '',
  identidadGenero: '',
  orientacionSexual: '',
  etnia: '',
  discapacidad: '',
  discapacidadDetalle: '',
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
const inputErrorClass =
  'w-full px-4 py-3 rounded-xl border border-red-400 bg-red-50/30 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all duration-200';
const selectClass =
  'w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200 appearance-none cursor-pointer';
const selectErrorClass =
  'w-full px-4 py-3 rounded-xl border border-red-400 bg-red-50/30 text-sm text-gray-700 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all duration-200 appearance-none cursor-pointer';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';
const helperClass =
  'mt-2 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs font-semibold px-3 py-2';
const fieldErrorClass = 'mt-1.5 text-xs font-medium text-red-600';
const helperText = 'Verifique que este dato sea correcto.';

export default function Step1PersonalInfo() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState<Step1Data>(() => {
    const saved = sessionStorage.getItem('reg_step1');
    return saved ? { ...INITIAL, ...JSON.parse(saved) } : INITIAL;
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<keyof Step1Data, boolean>>>({});

  const displayValue = (value?: string | number | boolean) => {
    if (value === undefined || value === null) return '—';
    if (typeof value === 'boolean') return value ? 'Si' : 'No';
    if (typeof value === 'number') return value.toString();
    const trimmed = value.toString().trim();
    return trimmed.length ? trimmed : '—';
  };


  const update = (field: keyof Step1Data, value: string | boolean) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Excluir contraseñas del sessionStorage — no persistir credenciales en texto plano
      const { password: _p, confirmPassword: _cp, ...persistable } = next;
      sessionStorage.setItem('reg_step1', JSON.stringify(persistable));
      return next;
    });
  };

  const markTouched = (field: keyof Step1Data) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const shouldShowHelper = (field: keyof Step1Data) => {
    if (!touched[field]) return false;
    const value = form[field];
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return true;
    if (typeof value === 'boolean') return value;
    return Boolean(value);
  };

  useEffect(() => {
    if (form.correo.trim() && !touched.correo) {
      setTouched((prev) => ({ ...prev, correo: true }));
    }
  }, [form.correo, touched.correo]);

  const handleNext = async () => {
    const formErrors = validateStep1(form);
    setErrors(formErrors);
    if (!isFormValid(formErrors)) return;
    setShowConfirm(true);
  };

  const submitRegistration = async () => {
    setLoading(true);
    try {
      await register({
        primerNombre: form.primerNombre.trim(),
        segundoNombre: form.segundoNombre.trim() || undefined,
        primerApellido: form.primerApellido.trim(),
        segundoApellido: form.segundoApellido.trim(),
        tipoDocumento: form.tipoDocumento,
        documento: form.documento.trim(),
        sexo: form.sexo,
        identidadGenero: form.identidadGenero,
        orientacionSexual: form.orientacionSexual,
        etnia: form.etnia,
        discapacidad: form.discapacidad,
        discapacidadDetalle: form.discapacidad === 'Si' ? form.discapacidadDetalle.trim() : undefined,
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
      setErrors({ _general: e instanceof Error ? e.message : 'Error al registrar' });
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <RegistrationLayout currentStep={1}>
      <div className="mb-6 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 font-medium">
        Los campos con <span className="text-red-500 font-semibold">(*)</span> son obligatorios.
      </div>

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
            <label className={labelClass}>Primer nombre <span className="text-red-500 font-semibold">(*)</span></label>
            <input
              type="text"
              className={errors.primerNombre ? inputErrorClass : inputClass}
              placeholder="Ej. Juan"
              value={form.primerNombre}
              maxLength={60}
              onChange={(e) => update('primerNombre', e.target.value)}
              onBlur={() => markTouched('primerNombre')}
            />
            {errors.primerNombre
              ? <p className={fieldErrorClass}>{errors.primerNombre}</p>
              : shouldShowHelper('primerNombre') && <p className={helperClass}>{helperText}</p>}
          </div>
          <div>
            <label className={labelClass}>Segundo nombre</label>
            <input
              type="text"
              className={errors.segundoNombre ? inputErrorClass : inputClass}
              placeholder="Ej. Alberto"
              value={form.segundoNombre}
              maxLength={60}
              onChange={(e) => update('segundoNombre', e.target.value)}
              onBlur={() => markTouched('segundoNombre')}
            />
            {errors.segundoNombre
              ? <p className={fieldErrorClass}>{errors.segundoNombre}</p>
              : shouldShowHelper('segundoNombre') && <p className={helperClass}>{helperText}</p>}
          </div>
          <div>
            <label className={labelClass}>Primer apellido <span className="text-red-500 font-semibold">(*)</span></label>
            <input
              type="text"
              className={errors.primerApellido ? inputErrorClass : inputClass}
              placeholder="Ej. Perez"
              value={form.primerApellido}
              maxLength={60}
              onChange={(e) => update('primerApellido', e.target.value)}
              onBlur={() => markTouched('primerApellido')}
            />
            {errors.primerApellido
              ? <p className={fieldErrorClass}>{errors.primerApellido}</p>
              : shouldShowHelper('primerApellido') && <p className={helperClass}>{helperText}</p>}
          </div>
          <div>
            <label className={labelClass}>Segundo apellido <span className="text-red-500 font-semibold">(*)</span></label>
            <input
              type="text"
              className={errors.segundoApellido ? inputErrorClass : inputClass}
              placeholder="Ej. Gomez"
              value={form.segundoApellido}
              maxLength={60}
              onChange={(e) => update('segundoApellido', e.target.value)}
              onBlur={() => markTouched('segundoApellido')}
            />
            {errors.segundoApellido
              ? <p className={fieldErrorClass}>{errors.segundoApellido}</p>
              : shouldShowHelper('segundoApellido') && <p className={helperClass}>{helperText}</p>}
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
            <label className={labelClass}>Tipo de documento <span className="text-red-500 font-semibold">(*)</span></label>
            <select
              className={errors.tipoDocumento ? selectErrorClass : selectClass}
              value={form.tipoDocumento}
              onChange={(e) => update('tipoDocumento', e.target.value)}
              onBlur={() => markTouched('tipoDocumento')}
            >
              <option value="">Seleccione...</option>
              <option value="(cc) Cedula de ciudadania">(cc) Cedula de ciudadania</option>
              <option value="(ti) Tarjeta de identidad">(ti) Tarjeta de identidad</option>
              <option value="(rc) Registro civil">(rc) Registro civil</option>
              <option value="(ce) Cedula de extranjeria">(ce) Cedula de extranjeria</option>
              <option value="(si) Sin identificacion">(si) Sin identificacion</option>
            </select>
            {errors.tipoDocumento
              ? <p className={fieldErrorClass}>{errors.tipoDocumento}</p>
              : shouldShowHelper('tipoDocumento') && <p className={helperClass}>{helperText}</p>}
          </div>
          <div>
            <label className={labelClass}>Numero de documento <span className="text-red-500 font-semibold">(*)</span></label>
            <input
              type="text"
              className={errors.documento ? inputErrorClass : inputClass}
              placeholder="000000000"
              value={form.documento}
              maxLength={20}
              onChange={(e) => update('documento', e.target.value)}
              onBlur={() => markTouched('documento')}
            />
            {errors.documento
              ? <p className={fieldErrorClass}>{errors.documento}</p>
              : shouldShowHelper('documento') && <p className={helperClass}>{helperText}</p>}
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
            <label className={labelClass}>Sexo <span className="text-red-500 font-semibold">(*)</span></label>
            <select
              className={errors.sexo ? selectErrorClass : selectClass}
              value={form.sexo}
              onChange={(e) => update('sexo', e.target.value)}
            >
              <option value="">Seleccione...</option>
              <option value="Hombre">Hombre</option>
              <option value="Mujer">Mujer</option>
              <option value="Intersexual">Intersexual</option>
            </select>
            {errors.sexo && <p className={fieldErrorClass}>{errors.sexo}</p>}
          </div>
          <div>
            <label className={labelClass}>Identidad de genero <span className="text-red-500 font-semibold">(*)</span></label>
            <select
              className={errors.identidadGenero ? selectErrorClass : selectClass}
              value={form.identidadGenero}
              onChange={(e) => update('identidadGenero', e.target.value)}
            >
              <option value="">Seleccione...</option>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
              <option value="Transexual">Transexual</option>
              <option value="No informa">No informa</option>
            </select>
            {errors.identidadGenero && <p className={fieldErrorClass}>{errors.identidadGenero}</p>}
          </div>
          <div>
            <label className={labelClass}>Orientacion sexual <span className="text-red-500 font-semibold">(*)</span></label>
            <select
              className={errors.orientacionSexual ? selectErrorClass : selectClass}
              value={form.orientacionSexual}
              onChange={(e) => update('orientacionSexual', e.target.value)}
            >
              <option value="">Seleccione...</option>
              <option value="Heterosexual">Heterosexual</option>
              <option value="Homosexual">Homosexual</option>
              <option value="Bisexual">Bisexual</option>
              <option value="No informa">No informa</option>
            </select>
            {errors.orientacionSexual && <p className={fieldErrorClass}>{errors.orientacionSexual}</p>}
          </div>
          <div>
            <label className={labelClass}>Etnia <span className="text-red-500 font-semibold">(*)</span></label>
            <select
              className={errors.etnia ? selectErrorClass : selectClass}
              value={form.etnia}
              onChange={(e) => update('etnia', e.target.value)}
            >
              <option value="">Seleccione...</option>
              <option value="Afro">Afro</option>
              <option value="Raizal">Raizal</option>
              <option value="Palanquero">Palanquero</option>
              <option value="Indigena">Indigena</option>
              <option value="Rom">Rom</option>
              <option value="Ninguna">Ninguna</option>
              <option value="No informa">No informa</option>
            </select>
            {errors.etnia && <p className={fieldErrorClass}>{errors.etnia}</p>}
          </div>
          <div>
            <label className={labelClass}>Discapacidad <span className="text-red-500 font-semibold">(*)</span></label>
            <select
              className={errors.discapacidad ? selectErrorClass : selectClass}
              value={form.discapacidad}
              onChange={(e) => {
                const value = e.target.value;
                update('discapacidad', value);
                if (value !== 'Si') {
                  update('discapacidadDetalle', '');
                }
              }}
            >
              <option value="">Seleccione...</option>
              <option value="No">No</option>
              <option value="Si">Si</option>
            </select>
            {errors.discapacidad && <p className={fieldErrorClass}>{errors.discapacidad}</p>}
          </div>
          {form.discapacidad === 'Si' && (
            <div>
              <label className={labelClass}>Cual discapacidad <span className="text-red-500 font-semibold">(*)</span></label>
              <input
                type="text"
                className={errors.discapacidadDetalle ? inputErrorClass : inputClass}
                placeholder="Especifica cual"
                value={form.discapacidadDetalle}
                maxLength={120}
                onChange={(e) => update('discapacidadDetalle', e.target.value)}
                onBlur={() => markTouched('discapacidadDetalle')}
              />
              {errors.discapacidadDetalle
                ? <p className={fieldErrorClass}>{errors.discapacidadDetalle}</p>
                : shouldShowHelper('discapacidadDetalle') && <p className={helperClass}>{helperText}</p>}
            </div>
          )}
          <div>
            <label className={labelClass}>Fecha de nacimiento <span className="text-red-500 font-semibold">(*)</span></label>
            <input
              type="date"
              className={errors.fechaNacimiento ? inputErrorClass : inputClass}
              value={form.fechaNacimiento}
              onChange={(e) => update('fechaNacimiento', e.target.value)}
              onBlur={() => markTouched('fechaNacimiento')}
            />
            {errors.fechaNacimiento
              ? <p className={fieldErrorClass}>{errors.fechaNacimiento}</p>
              : shouldShowHelper('fechaNacimiento') && <p className={helperClass}>{helperText}</p>}
          </div>
          <div>
            <label className={labelClass}>Correo electronico <span className="text-red-500 font-semibold">(*)</span></label>
            <input
              type="email"
              className={errors.correo ? inputErrorClass : inputClass}
              placeholder="correo@ejemplo.com"
              value={form.correo}
              maxLength={120}
              onChange={(e) => update('correo', e.target.value)}
              onBlur={() => markTouched('correo')}
            />
            {errors.correo
              ? <p className={fieldErrorClass}>{errors.correo}</p>
              : shouldShowHelper('correo') && <p className={helperClass}>{helperText}</p>}
          </div>
          <div>
            <label className={labelClass}>Telefono <span className="text-red-500 font-semibold">(*)</span></label>
            <input
              type="tel"
              className={errors.telefonoPersonal ? inputErrorClass : inputClass}
              placeholder="3001234567"
              value={form.telefonoPersonal}
              maxLength={13}
              onChange={(e) => update('telefonoPersonal', e.target.value)}
              onBlur={() => markTouched('telefonoPersonal')}
            />
            {errors.telefonoPersonal
              ? <p className={fieldErrorClass}>{errors.telefonoPersonal}</p>
              : shouldShowHelper('telefonoPersonal') && <p className={helperClass}>{helperText}</p>}
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
              <label className={labelClass}>Carrera <span className="text-red-500 font-semibold">(*)</span></label>
              <input
                type="text"
                className={errors.carrera ? inputErrorClass : inputClass}
                placeholder="Ej. Psicologia"
                value={form.carrera}
                maxLength={80}
                onChange={(e) => update('carrera', e.target.value)}
                onBlur={() => markTouched('carrera')}
              />
              {errors.carrera
                ? <p className={fieldErrorClass}>{errors.carrera}</p>
                : shouldShowHelper('carrera') && <p className={helperClass}>{helperText}</p>}
            </div>
            <div>
              <label className={labelClass}>Jornada <span className="text-red-500 font-semibold">(*)</span></label>
              <select
                className={errors.jornada ? selectErrorClass : selectClass}
                value={form.jornada}
                onChange={(e) => update('jornada', e.target.value)}
                onBlur={() => markTouched('jornada')}
              >
                <option value="">Seleccione...</option>
                <option value="Diurna">Diurna</option>
                <option value="Nocturna">Nocturna</option>
                <option value="Virtual">Virtual</option>
              </select>
              {errors.jornada
                ? <p className={fieldErrorClass}>{errors.jornada}</p>
                : shouldShowHelper('jornada') && <p className={helperClass}>{helperText}</p>}
            </div>
            <div>
              <label className={labelClass}>Semestre <span className="text-red-500 font-semibold">(*)</span></label>
              <select
                className={errors.semestre ? selectErrorClass : selectClass}
                value={form.semestre}
                onChange={(e) => update('semestre', e.target.value)}
                onBlur={() => markTouched('semestre')}
              >
                <option value="">Seleccione...</option>
                {Array.from({ length: 9 }, (_, i) => i + 1).map((s) => (
                  <option key={s} value={String(s)}>
                    {s}
                  </option>
                ))}
              </select>
              {errors.semestre
                ? <p className={fieldErrorClass}>{errors.semestre}</p>
                : shouldShowHelper('semestre') && <p className={helperClass}>{helperText}</p>}
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
            <label className={labelClass}>Contrasena <span className="text-red-500 font-semibold">(*)</span></label>
            <input
              type="password"
              className={errors.password ? inputErrorClass : inputClass}
              placeholder="Minimo 8 caracteres"
              value={form.password}
              maxLength={64}
              onChange={(e) => update('password', e.target.value)}
              onBlur={() => markTouched('password')}
            />
            {errors.password
              ? <p className={fieldErrorClass}>{errors.password}</p>
              : shouldShowHelper('password') && <p className={helperClass}>{helperText}</p>}
          </div>
          <div>
            <label className={labelClass}>Confirmar contrasena <span className="text-red-500 font-semibold">(*)</span></label>
            <input
              type="password"
              className={errors.confirmPassword ? inputErrorClass : inputClass}
              placeholder="Repite la contrasena"
              value={form.confirmPassword}
              maxLength={64}
              onChange={(e) => update('confirmPassword', e.target.value)}
              onBlur={() => markTouched('confirmPassword')}
            />
            {errors.confirmPassword
              ? <p className={fieldErrorClass}>{errors.confirmPassword}</p>
              : shouldShowHelper('confirmPassword') && <p className={helperClass}>{helperText}</p>}
          </div>
        </div>
      </section>

      {errors._general && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium">
          {errors._general}
        </div>
      )}

      {/* Navigation */}
      <StepNavigation
        onNext={handleNext}
        nextLabel={loading ? 'Registrando...' : 'Continuar'}
        nextDisabled={loading}
        showBack={false}
      />

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Confirmar datos</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Revisa que todos tus datos estén correctamente diligenciados antes de continuar. Si estás seguro, presiona continuar.
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
            <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50/80 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-2">
                Resumen rápido
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Nombre completo</span>
                  <p className="font-semibold text-gray-900">
                    {`${displayValue(form.primerNombre)} ${displayValue(form.segundoNombre)} ${displayValue(form.primerApellido)} ${displayValue(form.segundoApellido)}`}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Documento</span>
                  <p className="font-semibold text-gray-900">{displayValue(form.documento)}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Correo</span>
                  <p className="font-semibold text-gray-900">{displayValue(form.correo)}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Teléfono</span>
                  <p className="font-semibold text-gray-900">{displayValue(form.telefonoPersonal)}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                className="flex-1 rounded-full border border-gray-300 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                onClick={() => setShowConfirm(false)}
              >
                Revisar datos
              </button>
              <button
                type="button"
                className="flex-1 rounded-full bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                onClick={submitRegistration}
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
