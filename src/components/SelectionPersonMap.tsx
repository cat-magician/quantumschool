import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { FORM_KIND_LABELS, type FormKind } from '../lib/identityMatching';
import { profileEmail, profileLogin } from '../lib/profileUtils';
import { textMatches } from '../lib/listFilters';
import {
  FORM_KINDS,
  PERSON_MAP_FILTERS,
  describeSignals,
  downloadPersonMapCsv,
  formatMapStamp,
  matchesPersonMapFilter,
  type CellState,
  type ContactSource,
  type OrphanAnswer,
  type PersonFormCell,
  type PersonMapFilter,
  type PersonMapRow,
} from '../lib/selectionPersonMap';

/**
 * Карта участников: строка на человека, колонка на форму.
 *
 * Цвет — быстрый обзор, но не единственный признак: в каждой ячейке стоит
 * ещё и слово. Иначе таблица нечитаема при дальтонизме и на распечатке.
 */

const CELL_STYLES: Record<CellState, { box: string; text: string; label: string }> = {
  linked: {
    box: 'bg-emerald-500/10 border-emerald-500/25',
    text: 'text-emerald-300',
    label: 'связано',
  },
  pending: {
    box: 'bg-amber-500/10 border-amber-500/25',
    text: 'text-amber-300',
    label: 'не сохранено',
  },
  marked_only: {
    box: 'bg-orange-500/5 border-orange-500/20',
    text: 'text-orange-300/90',
    label: 'ответ не найден',
  },
  missing: {
    box: 'bg-white/[0.02] border-white/5',
    text: 'text-slate-600',
    label: 'нет',
  },
};

const CONTACT_STYLES: Record<ContactSource, { text: string; note: string }> = {
  questionnaire: { text: 'text-emerald-300', note: 'из анкеты' },
  account: { text: 'text-slate-200', note: 'почта аккаунта' },
  recovery: { text: 'text-slate-300', note: 'для восстановления' },
  none: { text: 'text-rose-300', note: 'писать некуда' },
};

function FormCell({ cell }: { cell: PersonFormCell }) {
  const style = CELL_STYLES[cell.state];
  const stamp = formatMapStamp(cell.at);
  const reasons = describeSignals(cell.signals);

  return (
    <div className={`rounded-lg border px-2 py-1.5 ${style.box}`}>
      <div className={`text-[11px] font-medium ${style.text}`}>{style.label}</div>
      {stamp && <div className="text-[11px] text-slate-400 tabular-nums mt-0.5">{stamp}</div>}
      {reasons && (
        <div className="text-[10px] text-slate-500 mt-0.5 leading-tight" title={reasons}>
          {reasons}
        </div>
      )}
      {cell.state === 'marked_only' && !reasons && (
        <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">отметка на сайте</div>
      )}
    </div>
  );
}

export default function SelectionPersonMap({
  rows,
  orphans,
}: {
  rows: PersonMapRow[];
  orphans: OrphanAnswer[];
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PersonMapFilter>('all');

  const visible = useMemo(() => rows.filter((row) => {
    if (!matchesPersonMapFilter(row, filter)) return false;
    return textMatches(query, [
      row.profile.display_name,
      row.contactEmail,
      profileEmail(row.profile),
      profileLogin(row.profile),
      row.profile.yandex_login,
      row.profile.school,
      row.profile.city,
    ]);
  }), [rows, filter, query]);

  const noContact = rows.filter((r) => r.contactEmail === null).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Имя, почта, логин, школа…"
            aria-label="Поиск по карте участников"
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {PERSON_MAP_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
              className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                filter === option.value
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => downloadPersonMapCsv(visible, orphans)}
            disabled={visible.length === 0}
            title="Те же данные словами, без цвета"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Скачать карту
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span aria-live="polite">Показано {visible.length} из {rows.length}</span>
        {noContact > 0 && <span className="text-rose-400/90">Без почты для связи: {noContact}</span>}
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40 border border-emerald-500/40" />
          связано
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/40 border border-amber-500/40" />
          не сохранено
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-500/30 border border-orange-500/30" />
          ответ не найден
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="text-center py-12 text-slate-500 bg-slate-900/40 rounded-2xl border border-white/5">
          Никого не найдено
        </p>
      ) : (
        <div className="overflow-x-auto scrollbar-site rounded-2xl border border-white/5">
          <table className="w-full min-w-[68rem] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="text-left font-semibold px-3 py-2.5">Участник</th>
                <th className="text-left font-semibold px-3 py-2.5">Ник / логин</th>
                <th className="text-left font-semibold px-3 py-2.5">Логин Яндекса</th>
                <th className="text-left font-semibold px-3 py-2.5">Почта аккаунта</th>
                <th className="text-left font-semibold px-3 py-2.5 bg-blue-500/10 text-blue-300">
                  Почта для связи
                </th>
                {FORM_KINDS.map((kind: FormKind) => (
                  <th key={kind} className="text-left font-semibold px-3 py-2.5 bg-white/[0.03]">
                    {FORM_KIND_LABELS[kind]}
                  </th>
                ))}
                <th className="text-left font-semibold px-3 py-2.5">Готовность</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const contact = CONTACT_STYLES[row.contactSource];
                const complete = row.linkedCount === FORM_KINDS.length;
                return (
                  <tr key={row.profile.id} className="border-t border-white/5 align-top">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-white leading-snug">
                        {row.profile.display_name?.trim() || 'Участник'}
                      </div>
                      {(row.profile.city || row.profile.grade) && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {[row.profile.city, row.profile.grade && `${row.profile.grade} кл.`]
                            .filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">{profileLogin(row.profile) || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-400">{row.profile.yandex_login?.trim() || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-400">{profileEmail(row.profile) || '—'}</td>
                    <td className="px-3 py-2.5 bg-blue-500/[0.06]">
                      <div className={`font-medium ${contact.text}`}>
                        {row.contactEmail || 'нет'}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{contact.note}</div>
                    </td>
                    {FORM_KINDS.map((kind) => (
                      <td key={kind} className="px-2 py-2 bg-white/[0.015]">
                        <FormCell cell={row.cells[kind]} />
                      </td>
                    ))}
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-medium tabular-nums ${
                        complete ? 'text-emerald-300' : 'text-slate-400'
                      }`}
                      >
                        {row.linkedCount} / {FORM_KINDS.length}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {orphans.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-white">
            Ответы без аккаунта ({orphans.length})
          </h3>
          <p className="text-xs text-slate-500">
            Из текущего файла. Человека в базе нет либо связь ещё не выбрана.
          </p>
          <div className="overflow-x-auto scrollbar-site rounded-2xl border border-white/5">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="text-left font-semibold px-3 py-2.5">Форма</th>
                  <th className="text-left font-semibold px-3 py-2.5">Строка</th>
                  <th className="text-left font-semibold px-3 py-2.5">Имя в форме</th>
                  <th className="text-left font-semibold px-3 py-2.5">Почта в форме</th>
                  <th className="text-left font-semibold px-3 py-2.5">Время</th>
                </tr>
              </thead>
              <tbody>
                {orphans.map((orphan) => (
                  <tr
                    key={`${orphan.kind}-${orphan.entry.rowNumber}`}
                    className="border-t border-white/5"
                  >
                    <td className="px-3 py-2 text-slate-400">{FORM_KIND_LABELS[orphan.kind]}</td>
                    <td className="px-3 py-2 text-slate-500 tabular-nums">{orphan.entry.rowNumber}</td>
                    <td className="px-3 py-2 text-white">
                      {orphan.entry.name || <span className="text-slate-600">без имени</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{orphan.entry.email || '—'}</td>
                    <td className="px-3 py-2 text-slate-400 tabular-nums">
                      {orphan.entry.submittedAt
                        ? formatMapStamp(new Date(orphan.entry.submittedAt).toISOString())
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
