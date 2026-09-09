import { Search } from 'lucide-react';

export type ListChipOption<T extends string> = {
  value: T;
  label: string;
};

/**
 * Поиск + необязательные кнопки-фильтры для простых списков админки.
 * Для отборочных этапов есть отдельный, более развесистый SelectionFilterBar.
 */
export default function ListSearchBar<T extends string>({
  value,
  onChange,
  placeholder,
  shownCount,
  totalCount,
  chips,
  chipValue,
  onChipChange,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  shownCount: number;
  totalCount: number;
  chips?: ListChipOption<T>[];
  chipValue?: T;
  onChipChange?: (value: T) => void;
  className?: string;
}) {
  const filtering = value.trim() !== '' || shownCount !== totalCount;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
          />
        </div>
        {chips && chips.length > 0 && onChipChange && (
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button
                key={chip.value}
                type="button"
                aria-pressed={chipValue === chip.value}
                onClick={() => onChipChange(chip.value)}
                className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  chipValue === chip.value
                    ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {filtering && (
        <p className="text-xs text-slate-500" aria-live="polite">
          Показано {shownCount} из {totalCount}
        </p>
      )}
    </div>
  );
}
