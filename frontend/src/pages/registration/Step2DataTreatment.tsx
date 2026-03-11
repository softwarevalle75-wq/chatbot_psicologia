import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RegistrationLayout from '../../components/registration/RegistrationLayout';
import StepNavigation from '../../components/registration/StepNavigation';
import { useAuth } from '../../context/AuthContext';

export default function Step2DataTreatment() {
  const navigate = useNavigate();
  const { saveTratamientoDatos } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    if (!accepted) {
      setError('Debes aceptar el tratamiento de datos para continuar');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await saveTratamientoDatos();
      navigate('/registro/sociodemografico');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RegistrationLayout currentStep={2}>
      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      {/* Title */}
      <h2 className="text-2xl font-bold text-blue-500 mb-2">
        Autorizacion para Tratamiento de Datos Personales
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Por favor, lee cuidadosamente nuestra politica de privacidad antes de continuar.
      </p>

      {/* Legal text card */}
      <div className="bg-gray-50/80 border border-gray-100 rounded-2xl p-6 max-h-[340px] overflow-y-auto text-sm text-gray-600 leading-relaxed space-y-4 chat-scroll">
        <div>
          <p className="font-bold text-gray-800 mb-2">1. Objeto del Tratamiento</p>
          <p>
            En cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013, informamos que los
            datos personales recolectados seran tratados para fines de atencion psicologica
            personalizada, seguimiento terapeutico y mejora continua de nuestros algoritmos de
            asistencia.
          </p>
        </div>

        <div>
          <p className="font-bold text-gray-800 mb-2">2. Datos Sensibles</p>
          <p>
            El usuario autoriza de manera previa, expresa e informada al Chatbot Psicologico para el
            tratamiento de sus datos personales, incluyendo datos sensibles relacionados con el estado
            de salud mental, respuestas a cuestionarios psicologicos y toda informacion proporcionada
            durante las sesiones de tamizaje.
          </p>
        </div>

        <div>
          <p className="font-bold text-gray-800 mb-2">3. Finalidades</p>
          <p>Los datos seran utilizados para:</p>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>Realizar tamizaje en salud mental mediante instrumentos validados (GHQ-12, DASS-21).</li>
            <li>Generar informes clinicos orientativos para profesionales en formacion.</li>
            <li>Facilitar la asignacion y agendamiento de citas con practicantes de psicologia.</li>
            <li>Fines academicos e investigativos de la Institucion Universitaria de Colombia.</li>
          </ul>
        </div>

        <div>
          <p className="font-bold text-gray-800 mb-2">4. Derechos del Titular</p>
          <p>
            Como titular de los datos, usted tiene derecho a conocer, actualizar, rectificar y suprimir
            su informacion personal, asi como a revocar la autorizacion otorgada. Puede ejercer estos
            derechos comunicandose al correo chatbotpsicologia@gmail.com o presentando quejas ante
            la Superintendencia de Industria y Comercio (SIC).
          </p>
        </div>

        <div>
          <p className="font-bold text-gray-800 mb-2">5. Vigencia</p>
          <p>
            La presente autorizacion se mantendra vigente mientras exista la relacion entre el titular
            y la Institucion Universitaria de Colombia, y durante el periodo necesario para cumplir
            con las finalidades descritas.
          </p>
        </div>
      </div>

      {/* Checkbox */}
      <label className="flex items-start gap-3 mt-6 cursor-pointer select-none">
        <button
          type="button"
          onClick={() => setAccepted(!accepted)}
          className={`mt-0.5 w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors cursor-pointer ${
            accepted
              ? 'bg-blue-500 border-blue-500'
              : 'bg-gray-100 border-gray-300'
          }`}
        >
          {accepted && (
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <span className="text-sm text-gray-700 font-medium leading-relaxed">
          Acepto los terminos de tratamiento de mis datos personales.
        </span>
      </label>

      {/* Navigation */}
      <StepNavigation
        onBack={() => navigate('/registro')}
        backLabel="Volver al Paso 1"
        onNext={handleNext}
        nextLabel={loading ? 'Guardando...' : 'Continuar'}
        nextDisabled={loading || !accepted}
      />
    </RegistrationLayout>
  );
}
