import { useId, useState } from 'react';
import { ChevronDown, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { FormSelect } from './FormControls';
import {
  ACCOUNT_FILTER_OPTIONS,
  CONTACT_FILTER_OPTIONS,
  EMPTY_SELECTION_FILTERS,
  QUESTIONNAIRE_FILTER_OPTIONS,
  SELECTION_PRESETS,
  SELECTION_SORT_OPTIONS,
  STAGE_FILTER_OPTIONS,
  VERDICT_FILTER_OPTIONS,
  activeSelectionFilterCount,
  hasActiveSelectionFilters,
  type SelectionFilters,
} from '../lib/selectionFilters';

const SCORE_INPUT_CLASS =
  'w-16 h-10 px-2 rounded-xl bg-slate-950/80 border border-white/10 text-white text-sm text-center placeholder:text-slate-600 focus:outline-none focus:border-blue-500/60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function ScoreRange({
  label,
  min,
  max,
  onChange,
}: {
  label: string;
  min: string;
  max: string;
  onChange: (patch: { min?: string; max?: string }) => void;
}) {
  // Пустая строка = граница не задана, поэтому значение не приводим к числу.
  const clamp = (raw: string) => {
    if (raw.trim() === '') return '';
    const n = Number(raw);
    if (Number.isNaN(n)) return '';
    return String(Math.min(10, Math.max(0, n)));
  };

  return (
    <FilterField label={label}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={10}
          value={min}
          onChange={(e) => onChange({ min: clamp(e.target.value) })}
          placeholder="от"
          aria-label={`${label}: от`}
          className={SCORE_INPUT_CLASS}
        />
        <span className="text-slate-600 text-sm">—</span>
        <input
          type="number"
          min={0}
          max={10}
          value={max}
          onChange={(e) => onChange({ max: clamp(e.target.value) })}
          placeholder="до"
          aria-label={`${label}: до`}
          className={SCORE_INPUT_CLASS}
        />
      </div>
    </FilterField>
  );
}

export default function SelectionFilterBar({
  filters,
  onChange,
  grades,
  cities,
  shownCount,
  totalCount,
}: {
  filters: SelectionFilters;
  onChange: (next: SelectionFilters) => void;
  grades: string[];
  cities: string[];
  shownCount: number;
  totalCount: number;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const patch = (next: Partial<SelectionFilters>) => onChange({ ...filters, ...next });
  const activeCount = activeSelectionFilterCount(filters);
  const canReset = hasActiveSelectionFilters(filters);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => patch({ search: e.target.value })}
            placeholder="Имя, ник, почта, школа, город…"
            aria-label="Поиск участников"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/60 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
              activeCount > 0
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
                : 'bg-white/5 text-slate-300 border-white/10 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Фильтры{activeCount > 0 ? ` (${activeCount})` : ''}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          <FormSelect
            value={filters.sort}
            onChange={(v) => patch({ sort: v as SelectionFilters['sort'] })}
            options={SELECTION_SORT_OPTIONS}
            className="min-w-[13rem] [&>button]:py-2.5"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SELECTION_PRESETS.map((preset) => {
          const active = filters.preset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              title={preset.hint}
              aria-pressed={active}
              onClick={() => patch({ preset: active ? 'none' : preset.id })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                active
                  ? 'bg-violet-500/20 text-violet-200 border-violet-500/40'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {open && (
        <div
          id={panelId}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 p-4 rounded-2xl bg-slate-900/60 border border-white/5"
        >
          <FilterField label="Анкета">
            <FormSelect
              value={filters.questionnaire}
              onChange={(v) => patch({ questionnaire: v as SelectionFilters['questionnaire'] })}
              options={QUESTIONNAIRE_FILTER_OPTIONS}
            />
          </FilterField>
          <FilterField label="Почта для связи">
            <FormSelect
              value={filters.contact}
              onChange={(v) => patch({ contact: v as SelectionFilters['contact'] })}
              options={CONTACT_FILTER_OPTIONS}
            />
          </FilterField>
          <FilterField label="Эссе">
            <FormSelect
              value={filters.essay}
              onChange={(v) => patch({ essay: v as SelectionFilters['essay'] })}
              options={STAGE_FILTER_OPTIONS}
            />
          </FilterField>
          <FilterField label="Задачи">
            <FormSelect
              value={filters.contest}
              onChange={(v) => patch({ contest: v as SelectionFilters['contest'] })}
              options={STAGE_FILTER_OPTIONS}
            />
          </FilterField>

          <ScoreRange
            label="Балл за эссе"
            min={filters.essayScoreMin}
            max={filters.essayScoreMax}
            onChange={({ min, max }) => patch({
              ...(min !== undefined ? { essayScoreMin: min } : {}),
              ...(max !== undefined ? { essayScoreMax: max } : {}),
            })}
          />
          <ScoreRange
            label="Балл за задачи"
            min={filters.contestScoreMin}
            max={filters.contestScoreMax}
            onChange={({ min, max }) => patch({
              ...(min !== undefined ? { contestScoreMin: min } : {}),
              ...(max !== undefined ? { contestScoreMax: max } : {}),
            })}
          />
          <FilterField label="Решение">
            <FormSelect
              value={filters.verdict}
              onChange={(v) => patch({ verdict: v as SelectionFilters['verdict'] })}
              options={VERDICT_FILTER_OPTIONS}
            />
          </FilterField>

          <FilterField label="Тип аккаунта">
            <FormSelect
              value={filters.account}
              onChange={(v) => patch({ account: v as SelectionFilters['account'] })}
              options={ACCOUNT_FILTER_OPTIONS}
            />
          </FilterField>
          <FilterField label="Класс">
            <FormSelect
              value={filters.grade}
              onChange={(v) => patch({ grade: v })}
              options={[{ value: '', label: 'Любой' }, ...grades.map((g) => ({ value: g, label: g }))]}
            />
          </FilterField>
          <FilterField label="Город">
            <FormSelect
              value={filters.city}
              onChange={(v) => patch({ city: v })}
              options={[{ value: '', label: 'Любой' }, ...cities.map((c) => ({ value: c, label: c }))]}
            />
          </FilterField>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span aria-live="polite">
          Показано {shownCount} из {totalCount}
        </span>
        {canReset && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_SELECTION_FILTERS)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Сбросить
          </button>
        )}
      </div>
    </div>
  );
}
