import { useMemo } from 'react';
import { FORM_KIND_LABELS } from '../lib/identityMatching';
import { FormSelect } from './FormControls';
import type { PersonMapRow } from '../lib/selectionPersonMap';
import {
  STAGE_BASIS_HINTS,
  STAGE_BASIS_OPTIONS,
  STAGE_STATE_LABELS,
  sameSelection,
  stageStatesFor,
  tallyStages,
  type PersonMapSelection,
  type StageBasis,
  type StageState,
} from '../lib/selectionStageStats';

/**
 * Сводка по этапам отбора: сколько человек прошли каждый, и кто именно.
 *
 * Любое число — кнопка, которая оставляет в таблице ниже ровно этих людей.
 * Иначе «сколько» и «каких» приходилось бы считать в двух разных местах.
 */

const STATE_STYLES: Record<StageState, string> = {
  done: 'text-emerald-300',
  answer: 'text-emerald-300',
  mark_only: 'text-orange-300',
  started: 'text-amber-300',
  missing: 'text-rose-300',
  graded: 'text-blue-300',
};

function StateRow({
  label, value, tone, active, onClick,
}: {
  label: string;
  value: number;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`w-full flex items-baseline justify-between gap-2 px-2 py-1 rounded-lg text-left transition-colors ${
        active ? 'bg-blue-500/15 ring-1 ring-blue-500/30' : 'hover:bg-white/5'
      }`}
    >
      <span className="text-[11px] text-slate-400 leading-tight">{label}</span>
      <span className={`text-sm font-semibold tabular-nums shrink-0 ${tone}`}>{value}</span>
    </button>
  );
}

export default function SelectionStageTally({
  rows,
  basis,
  onBasisChange,
  selection,
  onSelect,
  narrowed = false,
  totalCount,
}: {
  rows: PersonMapRow[];
  basis: StageBasis;
  onBasisChange: (basis: StageBasis) => void;
  selection: PersonMapSelection;
  onSelect: (selection: PersonMapSelection) => void;
  /** Сводка посчитана не по всем участникам, а по текущему поиску. */
  narrowed?: boolean;
  totalCount: number;
}) {
  const tallies = useMemo(() => tallyStages(rows, basis), [rows, basis]);

  const pick = (kind: (typeof tallies)[number]['kind'], state: StageState) => {
    const next: PersonMapSelection = { mode: 'stage', kind, state };
    onSelect(sameSelection(selection, next) ? { mode: 'all' } : next);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Кто прошёл этапы</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {narrowed
              ? `Считаем по текущему отбору: ${rows.length} из ${totalCount}`
              : `Считаем по всем участникам: ${rows.length}`}
            {' · '}
            нажмите на число, чтобы увидеть этих людей
          </p>
        </div>
        <label className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Что считаем выполненным
          </span>
          <FormSelect
            value={basis}
            onChange={(value) => onBasisChange(value as StageBasis)}
            options={STAGE_BASIS_OPTIONS}
            className="min-w-[15rem]"
          />
        </label>
      </div>

      <p className="text-xs text-slate-500">{STAGE_BASIS_HINTS[basis]}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tallies.map((tally) => {
          const done = tally.counts.done;
          const share = tally.total === 0 ? 0 : Math.round((done / tally.total) * 100);
          const doneActive = sameSelection(selection, {
            mode: 'stage', kind: tally.kind, state: 'done',
          });

          return (
            <div
              key={tally.kind}
              className="rounded-2xl bg-slate-900/60 border border-white/5 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {FORM_KIND_LABELS[tally.kind]}
                  </div>
                  <button
                    type="button"
                    aria-pressed={doneActive}
                    onClick={() => pick(tally.kind, 'done')}
                    title="Показать тех, кто этап выполнил"
                    className={`mt-1 flex items-baseline gap-1.5 px-1.5 py-0.5 -mx-1.5 rounded-lg transition-colors ${
                      doneActive ? 'bg-blue-500/15 ring-1 ring-blue-500/30' : 'hover:bg-white/5'
                    }`}
                  >
                    <span className="text-2xl font-bold text-white tabular-nums">{done}</span>
                    <span className="text-sm text-slate-500 tabular-nums">из {tally.total}</span>
                  </button>
                </div>
                <span className="text-xs text-slate-500 tabular-nums shrink-0 pt-1">{share}%</span>
              </div>

              <div
                className="h-1.5 rounded-full bg-white/5 overflow-hidden"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full bg-emerald-500/50"
                  style={{ width: `${share}%` }}
                />
              </div>

              <div className="space-y-0.5">
                {stageStatesFor(tally.kind).map((state) => (
                  <StateRow
                    key={state}
                    label={STAGE_STATE_LABELS[state]}
                    value={tally.counts[state]}
                    tone={STATE_STYLES[state]}
                    active={sameSelection(selection, { mode: 'stage', kind: tally.kind, state })}
                    onClick={() => pick(tally.kind, state)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
