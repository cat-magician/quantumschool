import { useId, useState } from 'react';
import { ChevronDown, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { FORM_KIND_LABELS, type FormKind } from '../lib/identityMatching';
import { FormSelect } from './FormControls';
import { FORM_KINDS } from '../lib/selectionPersonMap';
import {
  ALL_ROWS,
  CONTACT_REQUIREMENT_OPTIONS,
  EMPTY_PERSON_MAP_QUERY,
  VERDICT_REQUIREMENT_OPTIONS,
  describeSelection,
  hasActiveQuery,
  panelFilterCount,
  sameSelection,
  type PersonMapQuery,
  type PersonMapSelection,
} from '../lib/selectionStageStats';

/**
 * Отбор строк карты. Главное здесь — набор обязательных этапов: именно из
 * «не сделал хотя бы один из отмеченных» и получается список тех, кому пора
 * писать.
 */

const PRESETS: { id: string; label: string; hint: string; selection: PersonMapSelection }[] = [
  {
    id: 'gaps',
    label: 'Есть пробелы',
    hint: 'Не выполнен хотя бы один из трёх этапов',
    selection: { mode: 'missing_any', stages: FORM_KINDS },
  },
  {
    id: 'all_done',
    label: 'Всё сдано',
    hint: 'Выполнены все три этапа',
    selection: { mode: 'done_all', stages: FORM_KINDS },
  },
];

function Chip({
  active, onClick, title, children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
        active
          ? 'bg-violet-500/20 text-violet-200 border-violet-500/40'
          : 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:border-white/20'
      }`}
    >
      {children}
    </button>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

export default function PersonMapFilterBar({
  query,
  onChange,
  shownCount,
  totalCount,
}: {
  query: PersonMapQuery;
  onChange: (next: PersonMapQuery) => void;
  shownCount: number;
  totalCount: number;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const patch = (next: Partial<PersonMapQuery>) => onChange({ ...query, ...next });
  const setSelection = (selection: PersonMapSelection) => patch({ selection });

  const { selection } = query;
  const stageSet: FormKind[] = selection.mode === 'missing_any' || selection.mode === 'done_all'
    ? selection.stages
    : [];
  const stageMode = selection.mode === 'done_all' ? 'done_all' : 'missing_any';

  const toggleStage = (kind: FormKind) => {
    const next = stageSet.includes(kind)
      ? stageSet.filter((k) => k !== kind)
      : FORM_KINDS.filter((k) => k === kind || stageSet.includes(k));

    // Ни одного этапа — это не «никого не показывать», а «без этого фильтра».
    setSelection(next.length === 0 ? ALL_ROWS : { mode: stageMode, stages: next });
  };

  const activeCount = panelFilterCount(query);
  const dirty = hasActiveQuery(query);

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="search"
            value={query.text}
            onChange={(e) => patch({ text: e.target.value })}
            placeholder="Имя, почта, логин, школа…"
            aria-label="Поиск по карте участников"
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
          />
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
            activeCount > 0
              ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
              : 'bg-white/5 text-slate-300 border-white/10 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Фильтры{activeCount > 0 ? ` (${activeCount})` : ''}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip
          active={selection.mode === 'all'}
          onClick={() => setSelection(ALL_ROWS)}
          title="Без отбора по этапам"
        >
          Все
        </Chip>
        {PRESETS.map((preset) => (
          <Chip
            key={preset.id}
            active={sameSelection(selection, preset.selection)}
            title={preset.hint}
            onClick={() => setSelection(
              sameSelection(selection, preset.selection) ? ALL_ROWS : preset.selection,
            )}
          >
            {preset.label}
          </Chip>
        ))}
        <Chip
          active={query.contact === 'missing'}
          title="Ни почты из анкеты, ни адреса аккаунта"
          onClick={() => patch({ contact: query.contact === 'missing' ? 'any' : 'missing' })}
        >
          Писать некуда
        </Chip>
      </div>

      <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-slate-900/40 border border-white/5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Этапы
        </span>
        {FORM_KINDS.map((kind) => (
          <Chip
            key={kind}
            active={stageSet.includes(kind)}
            onClick={() => toggleStage(kind)}
            title={`Отметить «${FORM_KIND_LABELS[kind]}» как обязательный этап`}
          >
            {FORM_KIND_LABELS[kind]}
          </Chip>
        ))}

        {stageSet.length > 0 && (
          <div className="flex items-center gap-1 ml-1" role="group" aria-label="Что показывать по отмеченным этапам">
            {([
              ['missing_any', 'не сделали хотя бы один'],
              ['done_all', 'сделали все'],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={stageMode === mode}
                onClick={() => setSelection({ mode, stages: stageSet })}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  stageMode === mode
                    ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
                    : 'bg-transparent text-slate-500 border-transparent hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {selection.mode === 'stage' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/15 text-blue-200 border border-blue-500/30">
            {describeSelection(selection)}
            <button
              type="button"
              onClick={() => setSelection(ALL_ROWS)}
              aria-label="Снять отбор по этапу"
              className="p-0.5 -mr-1 rounded hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        </div>
      )}

      {open && (
        <div
          id={panelId}
          className="grid gap-4 sm:grid-cols-2 p-4 rounded-2xl bg-slate-900/60 border border-white/5"
        >
          <FilterField label="Почта для связи">
            <FormSelect
              value={query.contact}
              onChange={(value) => patch({ contact: value as PersonMapQuery['contact'] })}
              options={CONTACT_REQUIREMENT_OPTIONS}
            />
          </FilterField>
          <FilterField label="Решение">
            <FormSelect
              value={query.verdict}
              onChange={(value) => patch({ verdict: value as PersonMapQuery['verdict'] })}
              options={VERDICT_REQUIREMENT_OPTIONS}
            />
          </FilterField>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span aria-live="polite">Показано {shownCount} из {totalCount}</span>
        {dirty && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_PERSON_MAP_QUERY)}
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
