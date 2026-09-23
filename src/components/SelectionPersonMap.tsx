import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download, ExternalLink, Link2, Loader2, RefreshCw, Save, X,
} from 'lucide-react';
import { SearchableActionList, type PickerRow } from './SearchablePicker';
import {
  FORM_KIND_LABELS,
  workAuthorHint,
  workFileName,
  type FormKind,
} from '../lib/identityMatching';
import { profileEmail, profileLogin } from '../lib/profileUtils';
import PersonMapEmailList from './PersonMapEmailList';
import PersonMapFilterBar from './PersonMapFilterBar';
import SelectionStageTally from './SelectionStageTally';
import {
  FORM_KINDS,
  VERDICT_LABELS,
  describeSignals,
  describeSiteStage,
  describeSiteDataDiff,
  downloadPersonMapCsv,
  formatMapDay,
  formatMapStamp,
  siteDataDiffTotal,
  type CellState,
  type ContactSource,
  type OrphanAnswer,
  type PersonFormCell,
  type PersonMapRow,
  type SiteDataDiff,
} from '../lib/selectionPersonMap';
import {
  ALL_ROWS,
  EMPTY_PERSON_MAP_QUERY,
  cellHasAnswer,
  matchesPersonMapQuery,
  matchesSelection,
  missingStagesLabel,
  type PersonMapQuery,
} from '../lib/selectionStageStats';
import type { SelectionVerdict } from '../lib/selectionDisplayUtils';

/**
 * Карта участников: строка на человека, колонка на форму.
 *
 * Слоёв два, и в каждой клетке они видны по отдельности: что сайт отследил
 * сам (отметка «я отправил», заход на страницу, оценка) и что нашлось в
 * выгрузке формы. Только так понятно, кого дожимать по форме, а кого — по
 * самому этапу.
 *
 * Цвет — быстрый обзор, но не единственный признак: в каждой ячейке стоит
 * ещё и слово. Иначе таблица нечитаема при дальтонизме и на распечатке.
 */

const CELL_STYLES: Record<CellState, { box: string; text: string; label: string }> = {
  linked: {
    box: 'bg-emerald-500/10 border-emerald-500/25',
    text: 'text-emerald-300',
    label: 'ответ сопоставлен',
  },
  pending: {
    box: 'bg-amber-500/10 border-amber-500/25',
    text: 'text-amber-300',
    label: 'разобрано, не сохранено',
  },
  marked_only: {
    box: 'bg-orange-500/5 border-orange-500/20',
    text: 'text-orange-300/90',
    label: 'ответ не найден',
  },
  missing: {
    box: 'bg-white/[0.02] border-white/5',
    text: 'text-slate-600',
    label: 'ответа нет',
  },
};

const CONTACT_STYLES: Record<ContactSource, { text: string; note: string }> = {
  questionnaire: { text: 'text-emerald-300', note: 'из анкеты' },
  account: { text: 'text-slate-200', note: 'почта аккаунта' },
  recovery: { text: 'text-slate-300', note: 'для восстановления' },
  none: { text: 'text-rose-300', note: 'писать некуда' },
};

const VERDICT_STYLES: Record<SelectionVerdict, string> = {
  accepted: 'text-emerald-300',
  rejected: 'text-rose-300/90',
  waiting: 'text-slate-500',
};

const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

/**
 * Ответ из загруженной выгрузки, который можно вручную отдать человеку прямо
 * из карты. Свободные — те, кому разбор не нашёл хозяина.
 */
export type MapAnswerOption = {
  key: string;
  kind: FormKind;
  title: string;
  subtitle: string;
  /** Кому ответ отдан сейчас; пусто — никому. */
  ownerName: string | null;
  /** Ответ уже сохранён за этим человеком в базе — выбор перенесёт его. */
  ownerSaved?: boolean;
  workUrl: string | null;
  /** Чем ответ похож на этого человека — если похож. */
  hint?: string;
};

function FormCell({ cell, onLink }: { cell: PersonFormCell; onLink?: () => void }) {
  const style = CELL_STYLES[cell.state];
  const answered = cellHasAnswer(cell);
  const stamp = answered ? formatMapStamp(cell.at) : '';
  const reasons = describeSignals(cell.signals);

  return (
    <div className={`rounded-lg border px-2 py-1.5 ${style.box}`}>
      <div className={`text-[11px] font-medium ${style.text}`}>
        {style.label}
        {cell.versions > 1 && (
          <span className="ml-1 text-slate-400 font-normal">· отправок: {cell.versions}</span>
        )}
      </div>
      {stamp && <div className="text-[11px] text-slate-400 tabular-nums mt-0.5">{stamp}</div>}
      {cell.workUrl && (
        // Ссылка на саму работу: по ней видно, что человек действительно
        // прислал, а не просто нажал кнопку на сайте.
        <a
          href={cell.workUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={workAuthorHint(workFileName(cell.workUrl)) || 'Открыть присланный файл'}
          className="inline-flex items-center gap-1 mt-0.5 text-[11px] text-blue-300 hover:text-blue-200 underline decoration-blue-400/40"
        >
          <ExternalLink className="w-3 h-3 shrink-0" />
          работа
        </a>
      )}
      {cell.reviewNote && (
        // Итог проверки честности: коротко в клетке, полностью — в подсказке.
        <div
          className={`mt-1 text-[10px] leading-tight line-clamp-2 ${
            /подозрительно/.test(cell.reviewNote)
              ? 'text-rose-300'
              : /есть вопросы/.test(cell.reviewNote) ? 'text-amber-300' : 'text-emerald-300/80'
          }`}
          title={cell.reviewNote}
        >
          {cell.reviewNote.replace(/^Предположение:\s*/, '')}
        </div>
      )}
      {reasons && (
        // Причин бывает много; полный список — в подсказке, иначе одна ячейка
        // растягивает всю строку и таблица становится нечитаемой.
        <div className="text-[10px] text-slate-500 mt-0.5 leading-tight line-clamp-2" title={reasons}>
          {reasons}
        </div>
      )}
      <div className="mt-1 pt-1 border-t border-white/5 text-[10px] leading-tight text-slate-500">
        <span className={cell.marked ? 'text-slate-400' : ''}>{describeSiteStage(cell)}</span>
        {cell.stageScore !== null && (
          <span className="text-blue-300 tabular-nums"> · {cell.stageScore}/10</span>
        )}
      </div>
      {onLink && (
        <button
          type="button"
          onClick={onLink}
          className="mt-1 inline-flex items-center gap-1 text-[11px] text-violet-300 hover:text-violet-200 transition-colors"
        >
          <Link2 className="w-3 h-3" />
          связать…
        </button>
      )}
    </div>
  );
}

/**
 * Ручная привязка из карты: человек известен, осталось указать, какой ответ
 * формы его. Показываем ответы загруженных выгрузок — свободные первыми.
 */
function LinkDialog({
  personName,
  kind,
  options,
  onPick,
  onClose,
  onOpenReview,
}: {
  personName: string;
  kind: FormKind;
  options: MapAnswerOption[];
  onPick: (key: string) => void;
  onClose: () => void;
  onOpenReview?: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows: PickerRow[] = options.map((option) => ({
    id: option.key,
    title: option.title,
    subtitle: [option.hint && `похоже: ${option.hint}`, option.subtitle].filter(Boolean).join(' · ') || null,
    searchText: `${option.title} ${option.subtitle} ${option.ownerName ?? ''}`,
    trailing: option.ownerName ? (
      <span
        className={`text-[11px] shrink-0 max-w-[12rem] truncate ${option.ownerSaved ? 'text-rose-300' : 'text-amber-400'}`}
        title={option.ownerSaved
          ? `Сохранён за «${option.ownerName}». Выбор перенесёт ответ к этому человеку.`
          : `В разборе отдан «${option.ownerName}», ещё не сохранено.`}
      >
        {option.ownerSaved ? 'сохранён за' : 'сейчас →'} {option.ownerName}
      </span>
    ) : (
      <span className="text-[11px] text-emerald-300 shrink-0">свободен</span>
    ),
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Связать ответ формы «${FORM_KIND_LABELS[kind]}» с ${personName}`}
        className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl bg-slate-900 border border-white/10 p-5 space-y-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {FORM_KIND_LABELS[kind]}
            </p>
            <h3 className="text-base font-semibold text-white truncate">{personName}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Какой ответ его? Сверху — свободные и похожие на него, ниже — уже отданные
              другим: если ответ привязан не к тому, выберите его — он перенесётся сюда.
              Сохранить можно кнопкой внизу карты.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {options.length === 0 ? (
          <div className="text-sm text-slate-400 space-y-3">
            <p>
              Ответов этой формы пока не из чего выбирать: загрузите её выгрузку во вкладке
              «Разбор выгрузок» — тогда они появятся здесь.
            </p>
            {onOpenReview && (
              <button
                type="button"
                onClick={onOpenReview}
                className="px-3.5 py-2 rounded-xl text-sm font-medium bg-violet-500/20 text-violet-200 border border-violet-500/40"
              >
                Открыть разбор выгрузок
              </button>
            )}
          </div>
        ) : (
          <SearchableActionList
            items={rows}
            onPick={onPick}
            searchPlaceholder="Имя, почта, логин, файл…"
            emptyText="Ответов нет"
          />
        )}
      </div>
    </div>
  );
}

export default function SelectionPersonMap({
  rows,
  orphans,
  updatedAt,
  refreshing = false,
  onRefresh,
  diff,
  answerOptions,
  onAssign,
  unsavedCount = 0,
  onSave,
  saving = false,
  saveMessage,
  onOpenReview,
}: {
  rows: PersonMapRow[];
  orphans: OrphanAnswer[];
  /** Когда данные последний раз приехали из базы. */
  updatedAt?: number | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Что прибавилось с прошлого обновления. */
  diff?: SiteDataDiff | null;
  /** Ответы загруженных выгрузок для человека и формы — похожие первыми. */
  answerOptions?: (profileId: string, kind: FormKind) => MapAnswerOption[];
  onAssign?: (profileId: string, kind: FormKind, optionKey: string) => void;
  /** Сколько связей разобрано, но не сохранено. */
  unsavedCount?: number;
  onSave?: () => void;
  saving?: boolean;
  saveMessage?: string | null;
  onOpenReview?: () => void;
}) {
  const [query, setQuery] = useState<PersonMapQuery>(EMPTY_PERSON_MAP_QUERY);
  const [linking, setLinking] = useState<{ profileId: string; name: string; kind: FormKind } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * Колесо мыши над таблицей листает её только вбок — вверх-вниз страница
   * прокручивается курсором сбоку от таблицы.
   *
   * На краях событие тоже перехватываем: иначе, докрутив таблицу до конца,
   * человек неожиданно уезжает вниз по странице. Пока горизонтальной прокрутки
   * нет вовсе (таблица влезла), колесо не трогаем — незачем.
   *
   * Только мышь: touch колесо не шлёт, поэтому на телефоне вертикальный свайп
   * листает страницу как обычно, а горизонтальный — таблицу.
   */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    const onWheel = (event: WheelEvent) => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) return;

      // Горизонтальный жест трекпада браузер обрабатывает сам и правильно.
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

      event.preventDefault();
      el.scrollLeft = Math.min(maxScroll, Math.max(0, el.scrollLeft + event.deltaY));
    };

    // passive: false обязателен — иначе preventDefault игнорируется.
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /**
   * Сводку считаем по всем, кого оставили поиск и фильтры, но без отбора по
   * этапам: сам этот отбор и есть то, что показывают числа сводки.
   */
  const pool = useMemo(
    () => rows.filter((row) => matchesPersonMapQuery(row, { ...query, selection: ALL_ROWS })),
    [rows, query],
  );

  const visible = useMemo(
    () => pool.filter((row) => matchesSelection(row, query.selection, query.basis)),
    [pool, query.selection, query.basis],
  );

  const freshText = diff && siteDataDiffTotal(diff) > 0 ? describeSiteDataDiff(diff) : '';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs text-slate-500 min-w-0">
          {updatedAt
            ? `Данные на ${timeFmt.format(updatedAt)} — карта обновляется сама`
            : 'Карта обновляется сама'}
          {freshText && <span className="text-emerald-300"> · {freshText}</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              title="Подтянуть из базы новых участников и свежие отметки"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {refreshing
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <RefreshCw className="w-4 h-4" />}
              {refreshing ? 'Обновляется…' : 'Обновить'}
            </button>
          )}
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

      <SelectionStageTally
        rows={pool}
        totalCount={rows.length}
        narrowed={pool.length !== rows.length}
        basis={query.basis}
        onBasisChange={(basis) => setQuery((prev) => ({ ...prev, basis }))}
        selection={query.selection}
        onSelect={(selection) => setQuery((prev) => ({ ...prev, selection }))}
      />

      <PersonMapFilterBar
        query={query}
        onChange={setQuery}
        shownCount={visible.length}
        totalCount={rows.length}
      />

      <PersonMapEmailList
        rows={visible}
        basis={query.basis}
        selection={query.selection}
        onShowUnreachable={() => setQuery((prev) => ({ ...prev, contact: 'missing' }))}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40 border border-emerald-500/40" />
          ответ сопоставлен
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/40 border border-amber-500/40" />
          не сохранено
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-500/30 border border-orange-500/30" />
          есть отметка, ответа нет
        </span>
        <span className="text-slate-600">Колесо мыши над таблицей листает её вбок</span>
      </div>

      {visible.length === 0 ? (
        <p className="text-center py-12 text-slate-500 bg-slate-900/40 rounded-2xl border border-white/5">
          Никого не найдено
        </p>
      ) : (
        /* Полосы прокрутки нет намеренно: таблица листается колесом мыши.
           Высоту не ограничиваем — вертикаль остаётся обычной прокруткой
           страницы, иначе колесо пришлось бы делить между двумя осями.
           Колонка с именем закреплена, чтобы при прокрутке вбок было видно,
           чья это строка. */
        <div
          ref={scrollRef}
          tabIndex={0}
          role="region"
          aria-label="Карта участников, таблица прокручивается вбок"
          className="overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-2xl border border-white/5 bg-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        >
          <table className="w-full min-w-[76rem] border-collapse text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                <th className="sticky left-0 z-20 bg-slate-950 text-left font-semibold px-3 py-2.5 border-r border-white/10">
                  Участник
                </th>
                <th className="text-left font-semibold px-3 py-2.5">Ник / логин</th>
                <th className="text-left font-semibold px-3 py-2.5">Логин Яндекса</th>
                <th className="text-left font-semibold px-3 py-2.5">Почта аккаунта</th>
                <th className="text-left font-semibold px-3 py-2.5 text-blue-300">
                  Почта для связи
                </th>
                {FORM_KINDS.map((kind: FormKind) => (
                  <th key={kind} className="text-left font-semibold px-3 py-2.5">
                    {FORM_KIND_LABELS[kind]}
                  </th>
                ))}
                <th className="text-left font-semibold px-3 py-2.5">Готовность</th>
                <th className="text-left font-semibold px-3 py-2.5">Решение</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const contact = CONTACT_STYLES[row.contactSource];
                const complete = row.linkedCount === FORM_KINDS.length;
                const missing = missingStagesLabel(row, query.basis);
                return (
                  <tr key={row.profile.id} className="border-t border-white/5 align-top">
                    <td className="sticky left-0 z-10 bg-slate-950 px-3 py-2.5 border-r border-white/10">
                      <div className="font-medium text-white leading-snug">
                        {row.profile.display_name?.trim() || 'Участник'}
                      </div>
                      {(row.profile.city || row.profile.grade) && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {[row.profile.city, row.profile.grade && `${row.profile.grade} кл.`]
                            .filter(Boolean).join(' · ')}
                        </div>
                      )}
                      {row.registeredAt && (
                        <div className="text-[10px] text-slate-600 mt-0.5 tabular-nums">
                          с {formatMapDay(row.registeredAt)}
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
                    {FORM_KINDS.map((kind) => {
                      const cell = row.cells[kind];
                      const empty = cell.state === 'missing' || cell.state === 'marked_only';
                      return (
                        <td key={kind} className="px-2 py-2 bg-white/[0.015]">
                          <FormCell
                            cell={cell}
                            onLink={onAssign && empty ? () => setLinking({
                              profileId: row.profile.id,
                              name: row.profile.display_name?.trim() || 'Участник',
                              kind,
                            }) : undefined}
                          />
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-medium tabular-nums ${
                        complete ? 'text-emerald-300' : 'text-slate-400'
                      }`}
                      >
                        {row.linkedCount} / {FORM_KINDS.length}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                        {missing === '—' ? 'все этапы' : `не хватает: ${missing}`}
                      </div>
                    </td>
                    <td className={`px-3 py-2.5 text-xs ${VERDICT_STYLES[row.verdict]}`}>
                      {VERDICT_LABELS[row.verdict]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {linking && onAssign && (
        <LinkDialog
          personName={linking.name}
          kind={linking.kind}
          options={answerOptions?.(linking.profileId, linking.kind) ?? []}
          onPick={(key) => {
            onAssign(linking.profileId, linking.kind, key);
            setLinking(null);
          }}
          onClose={() => setLinking(null)}
          onOpenReview={onOpenReview ? () => { setLinking(null); onOpenReview(); } : undefined}
        />
      )}

      {onSave && (unsavedCount > 0 || saveMessage) && (
        <div className="sticky bottom-4 z-30 flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-slate-900/95 border border-white/10 backdrop-blur-sm">
          <button
            type="button"
            onClick={onSave}
            disabled={saving || unsavedCount === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить связи ({unsavedCount})
          </button>
          <p className="text-xs text-slate-500 min-w-0 flex-1">
            Сюда входят и привязки из карты, и точные совпадения разбора.
          </p>
          {saveMessage && <p className="text-xs text-slate-300">{saveMessage}</p>}
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
