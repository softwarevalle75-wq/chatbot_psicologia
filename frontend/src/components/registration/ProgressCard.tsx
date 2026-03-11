interface ProgressCardProps {
  step: number;
  totalSteps: number;
  title: string;
  subtitle: string;
}

export default function ProgressCard({ step, totalSteps, title, subtitle }: ProgressCardProps) {
  const percentage = Math.round((step / totalSteps) * 100);

  return (
    <div className="w-full max-w-[820px] mx-auto rounded-2xl bg-white/15 backdrop-blur-md px-8 py-5 shadow-lg">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="text-sm text-white/70 mt-0.5">
            Paso {step} de {totalSteps}: {subtitle}
          </p>
        </div>
        <span className="text-lg font-bold text-white/90">{percentage}%</span>
      </div>

      {/* Progress bar */}
      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i < step ? 'bg-white' : 'bg-white/25'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
