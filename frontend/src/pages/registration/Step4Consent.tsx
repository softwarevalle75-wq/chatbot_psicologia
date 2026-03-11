import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RegistrationLayout from '../../components/registration/RegistrationLayout';
import StepNavigation from '../../components/registration/StepNavigation';
import { useAuth } from '../../context/AuthContext';

export default function Step4Consent() {
  const navigate = useNavigate();
  const { saveConsentimiento } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFinish = async () => {
    if (!accepted) {
      setError('Debes aceptar el consentimiento para continuar');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await saveConsentimiento();
      // Clean up all session storage from registration
      sessionStorage.removeItem('reg_step1');
      sessionStorage.removeItem('reg_step3');
      navigate('/chat');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RegistrationLayout currentStep={4}>
      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      {/* Title */}
      <h2 className="text-2xl font-bold text-blue-500 mb-2">
        Acuerdo para Tamizaje en Salud Mental
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Por favor, lee cuidadosamente nuestras condiciones
      </p>

      {/* Legal text card */}
      <div className="bg-gray-50/80 border border-gray-100 rounded-2xl p-6 max-h-[380px] overflow-y-auto text-sm text-gray-600 leading-relaxed space-y-3 chat-scroll">
        <p>Al participar en este tamizaje, declaro que:</p>

        <p>
          Su objetivo es identificar aspectos relacionados con mi salud mental para orientar
          acciones de apoyo y, si es necesario, remision a servicios especializados.
        </p>

        <p>
          La informacion sera confidencial y protegida por el secreto profesional, conforme al
          articulo 74 de la Constitucion Politica de Colombia y al articulo 36 de la Ley 1090 de
          2006.
        </p>

        <p>
          La informacion solo podra revelarse en caso de riesgo claro e inminente para mi o para
          terceros, segun lo establece la Ley 1090 de 2006.
        </p>

        <p>
          Puedo retirarme en cualquier momento sin consecuencias negativas para mi vida academica.
        </p>

        <p>
          Este proceso no sustituye la atencion psicologica o psiquiatrica; si se identifican
          necesidades, recibire orientacion y remision.
        </p>

        <p>
          Si deseo conocer mis resultados personales, puedo agendar cita a traves del chat del
          consultorio psicologico de la Universitaria de Colombia (3115148383) y, una vez asista, un
          psicologo en formacion me brindara la informacion.
        </p>
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
          He leido y acepto participar en el tamizaje de salud mental bajo las condiciones descritas
          anteriormente.
        </span>
      </label>

      {/* Navigation */}
      <StepNavigation
        onBack={() => navigate('/registro/sociodemografico')}
        backLabel="Volver al Paso 3"
        onNext={handleFinish}
        nextLabel={loading ? 'Finalizando...' : 'Terminar'}
        nextDisabled={loading || !accepted}
      />
    </RegistrationLayout>
  );
}
