import type { ReactNode } from 'react';
import ProgressCard from './ProgressCard';
import logo from '../../assets/loguito.png';

interface StepConfig {
  step: number;
  title: string;
  subtitle: string;
}

const STEPS: StepConfig[] = [
  { step: 1, title: 'Informacion Personal', subtitle: 'Datos demograficos basicos' },
  { step: 2, title: 'Tratamiento de datos', subtitle: 'Politica de privacidad y consentimiento' },
  { step: 3, title: 'Informacion Sociodemografica', subtitle: 'Perfilado del paciente' },
  { step: 4, title: 'Acuerdo de Tamizaje', subtitle: 'Privacidad tratamiento psicologico' },
];

interface RegistrationLayoutProps {
  currentStep: number;
  children: ReactNode;
}

export default function RegistrationLayout({ currentStep, children }: RegistrationLayoutProps) {
  const config = STEPS[currentStep - 1] || STEPS[0];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-400 flex flex-col font-['Inter',sans-serif]">
      {/* Header */}
      <header className="flex items-center justify-center gap-2 py-3 bg-blue-600/30 backdrop-blur-sm">
        <img
          src={logo}
          alt="Logo Chatbot Psicologico"
          className="w-14 h-14 object-contain"
        />
        <span className="text-white font-bold text-lg tracking-wide">Chatbot Psicologico</span>
      </header>

      {/* Content area */}
      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-6 overflow-y-auto">
        {/* Progress card */}
        <ProgressCard
          step={config.step}
          totalSteps={4}
          title={config.title}
          subtitle={config.subtitle}
        />

        {/* Form card */}
        <div className="w-full max-w-[820px] mx-auto bg-white rounded-3xl shadow-xl shadow-blue-900/10 p-8 sm:p-10">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-5 text-center text-sm text-white/50 font-medium">
        &copy; 2026 Chatbot Psicologico. Todos los derechos reservados.
      </footer>
    </div>
  );
}
