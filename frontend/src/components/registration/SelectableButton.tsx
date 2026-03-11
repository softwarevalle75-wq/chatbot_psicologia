interface SelectableButtonProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  variant?: 'pill' | 'circle' | 'wide';
}

export default function SelectableButton({
  label,
  selected,
  onClick,
  variant = 'pill',
}: SelectableButtonProps) {
  const base =
    'font-medium transition-all duration-200 cursor-pointer border text-sm select-none';

  const variants = {
    pill: `px-6 py-2.5 rounded-full ${
      selected
        ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/20'
        : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
    }`,
    circle: `w-11 h-11 rounded-full flex items-center justify-center ${
      selected
        ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/20'
        : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
    }`,
    wide: `px-6 py-3 rounded-xl w-full text-left ${
      selected
        ? 'bg-white text-blue-600 border-blue-500 shadow-sm'
        : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
    }`,
  };

  return (
    <button type="button" onClick={onClick} className={`${base} ${variants[variant]}`}>
      {label}
    </button>
  );
}
