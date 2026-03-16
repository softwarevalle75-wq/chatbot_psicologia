import SelectableButton from './SelectableButton';

interface SelectableGridProps {
  options: { value: string; label: string }[];
  selected: string | string[];
  onChange: (value: string) => void;
  variant?: 'pill' | 'circle' | 'wide';
  columns?: number;
}

export default function SelectableGrid({
  options,
  selected,
  onChange,
  variant = 'pill',
  columns,
}: SelectableGridProps) {
  const isSelected = (value: string) =>
    Array.isArray(selected) ? selected.includes(value) : selected === value;

  const gridClass = columns
    ? `grid gap-3`
    : 'flex flex-wrap gap-3';

  const style = columns
    ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
    : undefined;

  return (
    <div className={gridClass} style={style}>
      {options.map((opt) => (
        <SelectableButton
          key={opt.value}
          label={opt.label}
          selected={isSelected(opt.value)}
          onClick={() => onChange(opt.value)}
          variant={variant}
        />
      ))}
    </div>
  );
}
