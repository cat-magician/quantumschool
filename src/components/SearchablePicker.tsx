import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

export type PickerRow = {
  id: string;
  title: string;
  subtitle?: string | null;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  disabled?: boolean;
  searchText?: string;
};

function filterRows(rows: PickerRow[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    const haystack = row.searchText ?? `${row.title} ${row.subtitle ?? ''}`;
    return haystack.toLowerCase().includes(q);
  });
}

function PickerSearch({
  value,
  onChange,
  placeholder,
  resultCount,
  totalCount,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  resultCount?: number;
  totalCount?: number;
}) {
  const showCount = totalCount !== undefined && totalCount > 0;

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
        />
      </div>
      {showCount && (
        <p className="text-xs text-slate-500 px-1">
          {value.trim()
            ? `Найдено: ${resultCount ?? 0} из ${totalCount}`
            : `Всего: ${totalCount}`}
        </p>
      )}
    </div>
  );
}

function PickerScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-h-80 overflow-y-auto rounded-xl border border-white/5 bg-slate-950/30 p-1.5 space-y-1">
      {children}
    </div>
  );
}

function PickerEmpty({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-500 text-sm text-center py-8 px-2">{children}</p>;
}

export function SearchableActionList({
  items,
  onPick,
  searchPlaceholder = 'Поиск...',
  emptyText = 'Список пуст',
  noResultsText = 'Ничего не найдено. Попробуйте другой запрос.',
}: {
  items: PickerRow[];
  onPick: (id: string) => void;
  searchPlaceholder?: string;
  emptyText?: string;
  noResultsText?: string;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filterRows(items, query), [items, query]);

  if (items.length === 0) {
    return <PickerEmpty>{emptyText}</PickerEmpty>;
  }

  return (
    <div className="space-y-3">
      <PickerSearch
        value={query}
        onChange={setQuery}
        placeholder={searchPlaceholder}
        resultCount={filtered.length}
        totalCount={items.length}
      />
      {filtered.length === 0 ? (
        <PickerEmpty>{noResultsText}</PickerEmpty>
      ) : (
        <PickerScroll>
          {filtered.map((row) => (
            <button
              key={row.id}
              type="button"
              disabled={row.disabled}
              onClick={() => onPick(row.id)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left disabled:opacity-50 disabled:cursor-default disabled:hover:bg-white/5"
            >
              {row.leading}
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white truncate">{row.title}</div>
                {row.subtitle && (
                  <div className="text-xs text-slate-500 truncate">{row.subtitle}</div>
                )}
              </div>
              {row.trailing}
            </button>
          ))}
        </PickerScroll>
      )}
    </div>
  );
}

export function SearchableCheckboxList({
  items,
  selectedIds,
  onToggle,
  searchPlaceholder = 'Поиск...',
  emptyText = 'Список пуст',
  noResultsText = 'Ничего не найдено. Попробуйте другой запрос.',
  selectedLabel = (count) => `Выбрано: ${count}`,
}: {
  items: PickerRow[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  searchPlaceholder?: string;
  emptyText?: string;
  noResultsText?: string;
  selectedLabel?: (count: number) => string;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filterRows(items, query), [items, query]);

  if (items.length === 0) {
    return <PickerEmpty>{emptyText}</PickerEmpty>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex-1 min-w-0">
          <PickerSearch
            value={query}
            onChange={setQuery}
            placeholder={searchPlaceholder}
            resultCount={filtered.length}
            totalCount={items.length}
          />
        </div>
        {selectedIds.length > 0 && (
          <span className="text-xs text-blue-300/90 shrink-0 pb-1">{selectedLabel(selectedIds.length)}</span>
        )}
      </div>
      {filtered.length === 0 ? (
        <PickerEmpty>{noResultsText}</PickerEmpty>
      ) : (
        <PickerScroll>
          {filtered.map((row) => (
            <label
              key={row.id}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                row.disabled
                  ? 'opacity-50 cursor-default'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(row.id)}
                disabled={row.disabled}
                onChange={() => onToggle(row.id)}
                className="rounded border-slate-600 shrink-0"
              />
              {row.leading}
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white truncate">{row.title}</div>
                {row.subtitle && (
                  <div className="text-xs text-slate-500 truncate">{row.subtitle}</div>
                )}
              </div>
              {row.trailing}
            </label>
          ))}
        </PickerScroll>
      )}
    </div>
  );
}
