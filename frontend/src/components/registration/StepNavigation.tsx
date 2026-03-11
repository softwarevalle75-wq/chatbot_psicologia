import { ArrowLeft, ArrowRight } from 'lucide-react';

interface StepNavigationProps {
  onBack?: () => void;
  onNext: () => void;
  backLabel?: string;
  nextLabel?: string;
  nextDisabled?: boolean;
  showBack?: boolean;
}

export default function StepNavigation({
  onBack,
  onNext,
  backLabel = 'Volver',
  nextLabel = 'Continuar',
  nextDisabled = false,
  showBack = true,
}: StepNavigationProps) {
  return (
    <div className="flex items-center justify-between mt-8 pt-4">
      {showBack && onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </button>
      ) : (
        <div />
      )}

      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="flex items-center gap-2 px-8 py-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-full shadow-lg shadow-blue-500/30 transition-all duration-200 cursor-pointer"
      >
        {nextLabel}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
