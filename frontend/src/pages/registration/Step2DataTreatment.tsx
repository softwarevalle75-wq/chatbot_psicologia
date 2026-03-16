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
        AUTORIZACIÓN PARA EL TRATAMIENTO DE DATOS PERSONALES
      </h2>
      <p className="text-sm text-gray-500 mb-1 font-semibold">
        Chatbot de Orientación Psicológica
      </p>
      <p className="text-sm text-gray-500 mb-6">
        En cumplimiento de lo dispuesto en la Ley 1581 de 2012, el Decreto 1377 de 2013, el Decreto 1074 de 2015 y demás normas que regulan la protección de datos personales en Colombia, se informa al titular de los datos personales la siguiente política de tratamiento y autorización para el uso de su información.
      </p>

      {/* Legal text card */}
      <div className="bg-gray-50/80 border border-gray-100 rounded-2xl p-6 max-h-[340px] overflow-y-auto text-sm text-gray-600 leading-relaxed space-y-4 chat-scroll">
        <div>
          <p className="font-bold text-gray-800 mb-2">1. Responsable del Tratamiento de los Datos Personales</p>
          <p>El responsable del tratamiento de los datos personales es:</p>
          <p className="mt-1">Institución Universitaria de Colombia</p>
          <p>Dirección: Calle 36 # 13 -09</p>
          <p>Teléfono: 3115148383</p>
          <p>Correo electrónico para protección de datos: atencionpsicologicaiudc@gmail.com</p>
          <p>Sitio web: universitariadecolombia.edu.co</p>
          <p className="mt-1">La institución será responsable de la recolección, almacenamiento, uso, circulación y supresión de los datos personales tratados a través del sistema de Chatbot de Orientación Psicológica.</p>
        </div>

        <div>
          <p className="font-bold text-gray-800 mb-2">2. Objeto del Tratamiento de Datos Personales</p>
          <p>La información suministrada por los usuarios será recolectada, almacenada, usada, procesada y, en general, tratada con fines de:</p>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>orientación psicológica inicial,</li>
            <li>tamizaje en salud mental,</li>
            <li>seguimiento terapéutico orientativo,</li>
            <li>asignación de citas con practicantes o profesionales en psicología,</li>
            <li>apoyo a procesos académicos, investigativos y de formación en psicología.</li>
          </ul>
          <p className="mt-1">El tratamiento de la información se realizará bajo los principios de legalidad, finalidad, libertad, veracidad, transparencia, acceso y circulación restringida, seguridad y confidencialidad, establecidos en la Ley 1581 de 2012.</p>
          <p className="mt-1">Asimismo, cuando la información esté relacionada con procesos de atención psicológica o evaluación en salud mental, su manejo se realizará respetando los principios éticos establecidos en la Ley 1090 de 2006, especialmente en lo relacionado con el secreto profesional y la confidencialidad de la información psicológica.</p>
        </div>

        <div>
          <p className="font-bold text-gray-800 mb-2">3. Datos Sensibles</p>
          <p>Durante el uso del Chatbot Psicológico podrán recolectarse datos sensibles, incluyendo información relacionada con:</p>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>estado de salud mental,</li>
            <li>respuestas a cuestionarios psicológicos,</li>
            <li>percepciones emocionales,</li>
            <li>niveles de estrés, ansiedad o depresión,</li>
            <li>información suministrada durante las sesiones de evaluación o tamizaje.</li>
          </ul>
          <p className="mt-1">De conformidad con la legislación colombiana:</p>
          <p className="mt-1">El titular no está obligado a autorizar el tratamiento de datos sensibles.</p>
          <p className="mt-1">Sin embargo, el suministro de esta información es necesario para poder realizar las evaluaciones psicológicas y generar orientaciones relacionadas con el bienestar mental.</p>
          <p className="mt-1">El tratamiento de estos datos se realizará garantizando condiciones estrictas de seguridad, confidencialidad y reserva, conforme a la normativa vigente y a los principios éticos de la práctica psicológica.</p>
        </div>

        <div>
          <p className="font-bold text-gray-800 mb-2">4. Finalidades del Tratamiento</p>
          <p>Los datos personales recolectados podrán ser utilizados para las siguientes finalidades:</p>
          <ol className="list-decimal ml-5 mt-1 space-y-1">
            <li>Realizar tamizaje en salud mental mediante instrumentos psicológicos validados como GHQ-12 y DASS-21.</li>
            <li>Generar informes psicológicos orientativos para procesos de formación de estudiantes y practicantes de psicología.</li>
            <li>Facilitar la asignación y agendamiento de citas con practicantes o profesionales de psicología vinculados a la institución.</li>
            <li>Desarrollar actividades académicas, investigativas y de formación profesional en el área de psicología.</li>
            <li>Realizar análisis estadísticos y estudios académicos, garantizando en lo posible la anonimización de los datos personales.</li>
            <li>Mejorar los servicios de orientación psicológica ofrecidos por la institución.</li>
          </ol>
          <p className="mt-1">Los datos no serán vendidos ni comercializados a terceros.</p>
        </div>

        <div>
          <p className="font-bold text-gray-800 mb-2">5. Encargados del Tratamiento y Plataformas Tecnológicas</p>
          <p>Para el funcionamiento del sistema tecnológico, algunos datos podrán ser almacenados o procesados mediante proveedores tecnológicos que actúan como encargados del tratamiento, tales como:</p>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>servicios de almacenamiento en la nube (ej. Amazon Web Services – AWS),</li>
            <li>plataformas de agenda y gestión académica,</li>
            <li>sistemas de inteligencia artificial utilizados para la operación del chatbot.</li>
          </ul>
          <p className="mt-1">Estos proveedores actuarán únicamente bajo instrucciones de la institución y estarán sujetos a obligaciones de confidencialidad y seguridad de la información.</p>
        </div>

        <div>
          <p className="font-bold text-gray-800 mb-2">6. Derechos del Titular de los Datos</p>
          <p>De conformidad con el artículo 8 de la Ley 1581 de 2012, el titular de los datos personales tiene derecho a:</p>
          <ol className="list-decimal ml-5 mt-1 space-y-1">
            <li>Conocer, actualizar y rectificar sus datos personales.</li>
            <li>Solicitar prueba de la autorización otorgada para el tratamiento de sus datos.</li>
            <li>Ser informado sobre el uso que se ha dado a su información personal.</li>
            <li>Presentar consultas o reclamos relacionados con el tratamiento de sus datos.</li>
            <li>Solicitar la supresión de sus datos personales cuando no se respeten los principios, derechos y garantías constitucionales y legales.</li>
            <li>Revocar la autorización otorgada para el tratamiento de sus datos personales.</li>
            <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) cuando considere que ha existido una vulneración de sus derechos.</li>
          </ol>
        </div>

        <div>
          <p className="font-bold text-gray-800 mb-2">7. Procedimiento para el Ejercicio de Derechos</p>
          <p>El titular podrá ejercer sus derechos enviando una solicitud a través de:</p>
          <p className="mt-1">Correo electrónico: atencionpsicologicaiudc@gmail.com</p>
          <p className="mt-1">La solicitud deberá contener:</p>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>nombre completo del titular,</li>
            <li>descripción de la solicitud,</li>
            <li>datos de contacto,</li>
            <li>documentos que acrediten su identidad.</li>
          </ul>
          <p className="mt-1">La institución dará respuesta a las consultas dentro de los diez (10) días hábiles, y a los reclamos dentro de los quince (15) días hábiles, conforme a la legislación vigente.</p>
        </div>

        <div>
          <p className="font-bold text-gray-800 mb-2">8. Tratamiento de Datos de Menores de Edad</p>
          <p>En caso de que el sistema sea utilizado por menores de edad, el tratamiento de sus datos personales se realizará únicamente cuando:</p>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>exista autorización de padres, madres o representantes legales, y</li>
            <li>se respete el interés superior del menor y sus derechos fundamentales.</li>
          </ul>
        </div>

        <div>
          <p className="font-bold text-gray-800 mb-2">9. Conservación de la Información</p>
          <p>Los datos personales serán conservados durante el tiempo necesario para cumplir con las finalidades descritas en esta autorización y durante el período requerido para atender obligaciones legales, académicas o investigativas.</p>
          <p className="mt-1">Como criterio general, la información podrá conservarse por un periodo de hasta cinco (5) años posteriores a la finalización de la relación con el titular, salvo que la ley establezca un plazo distinto.</p>
        </div>

        <div>
          <p className="font-bold text-gray-800 mb-2">10. Limitaciones del Servicio de Chatbot Psicológico</p>
          <p>El Chatbot Psicológico constituye una herramienta de orientación inicial y apoyo académico, y no reemplaza la atención psicológica o psiquiátrica profesional directa.</p>
          <p className="mt-1">Las respuestas generadas por el sistema no constituyen diagnóstico clínico ni tratamiento psicológico formal.</p>
          <p className="mt-1">En caso de presentar situaciones de crisis emocional o riesgo para la salud mental, se recomienda acudir inmediatamente a profesionales de salud mental o servicios de emergencia.</p>
        </div>

        <div>
          <p className="font-bold text-gray-800 mb-2">11. Autorización del Titular</p>
          <p>Al aceptar este documento, el titular declara que:</p>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>ha sido informado de manera previa, expresa e informada sobre el tratamiento de sus datos personales,</li>
            <li>conoce sus derechos como titular de la información,</li>
            <li>y autoriza a la Institución Universitaria de Colombia para realizar el tratamiento de sus datos personales, incluyendo datos sensibles relacionados con su salud mental, conforme a las finalidades aquí descritas.</li>
          </ul>
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
