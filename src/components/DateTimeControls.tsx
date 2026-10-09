import {
  useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
import { useDismissOnOutside, usePopoverPosition, type DismissReason } from '../hooks/usePopover';
import {
  addDays,
  formatTimeValue,
  joinDatetimeValue,
  parseDateValue,
  parseDurationInput,
  parseTimeInput,
  relativeDayLabel,
  splitDatetimeValue,
  timeOptions,
  toDateValue,
} from '../lib/dateTimeInput';
import { formatDuration } from '../lib/scheduleUtils';
import {
  SCHOOL_TIME_SUFFIX,
  SCHOOL_TIME_ZONE,
  schoolInputToMs,
  schoolTodayValue,
  toSchoolDateValue,
} from '../lib/schoolTime';

/**
 * Поля даты, времени и длительности в стиле сайта. Вместо системных
 * календарей и барабанов: дата — из календаря-сетки (стрелки, PageUp/PageDown),
 * время — набором («17», «1730», «17:30») или из списка с шагом, длительность —
 * готовыми вариантами. Значения — те же строки, что у input type="date" и
 * type="datetime-local", только время в них московское (см. schoolTime.ts):
 * «сегодня», «через 3 дня» и окончание занятия тоже считаются по Москве.
 */

const FIELD =
  'w-full rounded-xl bg-slate-950/80 border border-white/10 text-white transition-colors '
  + 'focus:outline-none focus:border-blue-500/60 focus-visible:ring-2 focus-visible:ring-blue-500/25';

const PANEL =
  'fixed z-[200] rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/50 '
  + 'overflow-y-auto overscroll-contain scrollbar-site';

const CHIP =
  'rounded-lg border font-medium transition-colors px-3 py-2 text-sm sm:py-1.5 sm:text-xs '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40';
const CHIP_ON = 'bg-blue-600/20 text-blue-200 border-blue-500/40';
const CHIP_OFF = 'bg-white/5 text-slate-300 border-white/10 hover:text-white hover:border-white/20';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WEEKDAYS_FULL = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];

const monthFmt = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
const dayAriaFmt = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});
const dayMonthFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const weekdayShortFmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });
const clockFmt = new Intl.DateTimeFormat('ru-RU', {
  timeZone: SCHOOL_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});

/** Сегодняшний день по Москве — как день календаря. */
function schoolToday(): Date {
  return parseDateValue(schoolTodayValue()) ?? new Date();
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, months: number) {
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
}

/** Шесть недель с понедельника: высота календаря не прыгает от месяца к месяцу. */
function monthWeeks(month: Date): Date[][] {
  const first = startOfMonth(month);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
}

/** «пн, 12 октября»; год — только если не текущий. */
function formatFieldDate(d: Date) {
  const year = d.getFullYear() === schoolToday().getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `${weekdayShortFmt.format(d)}, ${dayMonthFmt.format(d)}${year}`;
}

function CalendarGrid({
  selected,
  onSelect,
}: {
  selected: Date | null;
  onSelect: (day: Date) => void;
}) {
  const today = schoolToday();
  const [focusDay, setFocusDay] = useState<Date>(() => selected ?? today);
  const [view, setView] = useState(() => startOfMonth(selected ?? today));
  const [moveFocus, setMoveFocus] = useState(true);
  const gridRef = useRef<HTMLTableElement>(null);
  const weeks = useMemo(() => monthWeeks(view), [view]);

  // Фокус — на выбранный день при открытии и за стрелками при навигации.
  useEffect(() => {
    if (!moveFocus) return;
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-day="${toDateValue(focusDay)}"]`)
      ?.focus({ preventScroll: true });
    setMoveFocus(false);
  }, [moveFocus, focusDay]);

  const goTo = (day: Date) => {
    setFocusDay(day);
    if (day.getMonth() !== view.getMonth() || day.getFullYear() !== view.getFullYear()) {
      setView(startOfMonth(day));
    }
    setMoveFocus(true);
  };

  const shiftMonth = (delta: number) => {
    const next = addMonths(focusDay, delta);
    setView(startOfMonth(next));
    setFocusDay(next);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const weekday = (focusDay.getDay() + 6) % 7;
    let next: Date;
    switch (e.key) {
      case 'ArrowLeft': next = addDays(focusDay, -1); break;
      case 'ArrowRight': next = addDays(focusDay, 1); break;
      case 'ArrowUp': next = addDays(focusDay, -7); break;
      case 'ArrowDown': next = addDays(focusDay, 7); break;
      case 'Home': next = addDays(focusDay, -weekday); break;
      case 'End': next = addDays(focusDay, 6 - weekday); break;
      case 'PageUp': next = addMonths(focusDay, e.shiftKey ? -12 : -1); break;
      case 'PageDown': next = addMonths(focusDay, e.shiftKey ? 12 : 1); break;
      default: return;
    }
    e.preventDefault();
    goTo(next);
  };

  const monthLabel = monthFmt.format(view);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Предыдущий месяц"
          className="p-2.5 sm:p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-white capitalize" aria-live="polite">{monthLabel}</span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Следующий месяц"
          className="p-2.5 sm:p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <table
        ref={gridRef}
        role="grid"
        aria-label={monthLabel}
        onKeyDown={onKeyDown}
        className="w-full table-fixed border-separate border-spacing-0.5"
      >
        <thead>
          <tr>
            {WEEKDAYS.map((d, i) => (
              <th
                key={d}
                scope="col"
                abbr={WEEKDAYS_FULL[i]}
                className={`pb-1 text-[11px] font-medium ${i >= 5 ? 'text-slate-500' : 'text-slate-400'}`}
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={toDateValue(week[0])}>
              {week.map((day) => {
                const key = toDateValue(day);
                const inMonth = day.getMonth() === view.getMonth();
                const isSelected = selected ? isSameDay(day, selected) : false;
                const isToday = isSameDay(day, today);
                const tone = isSelected
                  ? 'bg-blue-600 text-white font-semibold hover:bg-blue-500'
                  : isToday
                    ? 'text-blue-200 ring-1 ring-inset ring-blue-500/60 hover:bg-blue-500/15'
                    : inMonth
                      ? 'text-slate-200 hover:bg-white/5'
                      : 'text-slate-600 hover:bg-white/5 hover:text-slate-400';
                return (
                  <td key={key} aria-selected={isSelected} className="p-0">
                    <button
                      type="button"
                      data-day={key}
                      tabIndex={isSameDay(day, focusDay) ? 0 : -1}
                      aria-label={dayAriaFmt.format(day).replace(/\s?г\.$/, '')}
                      aria-current={isToday ? 'date' : undefined}
                      onClick={() => onSelect(day)}
                      className={`w-full h-10 sm:h-9 rounded-lg text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80 ${tone}`}
                    >
                      {day.getDate()}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DatePanel({
  open,
  anchorRef,
  panelRef,
  selected,
  onSelect,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement>;
  panelRef: React.RefObject<HTMLDivElement>;
  selected: Date | null;
  onSelect: (day: Date) => void;
}) {
  const style = usePopoverPosition(open, anchorRef, panelRef);
  if (!open) return null;
  const today = schoolToday();
  const quick: [string, Date][] = [
    ['Сегодня', today],
    ['Завтра', addDays(today, 1)],
    ['Через неделю', addDays(today, 7)],
  ];
  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Выбор даты"
      style={style}
      className={`${PANEL} w-[min(calc(100vw-1rem),22rem)] p-3 sm:p-4`}
    >
      <CalendarGrid selected={selected} onSelect={onSelect} />
      <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-3 gap-1.5">
        {quick.map(([label, day]) => (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(day)}
            className="py-2 rounded-lg text-xs font-medium text-blue-300 hover:bg-blue-600/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          >
            {label}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

/** Дата: 'YYYY-MM-DD'. */
export function FormDate({
  value,
  onChange,
  placeholder = 'Выберите дату',
  className = '',
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => [triggerRef, panelRef], []);
  const selected = parseDateValue(value);

  const close = useCallback((reason: DismissReason | 'pick') => {
    setOpen(false);
    if (reason !== 'outside') triggerRef.current?.focus({ preventScroll: true });
  }, []);
  useDismissOnOutside(open, close, refs);

  return (
    <div className={`relative min-w-0 ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`${FIELD} flex items-center gap-2.5 px-3.5 py-3 text-base sm:text-sm text-left cursor-pointer aria-expanded:border-blue-500/60`}
      >
        <CalendarDays className="w-4 h-4 text-slate-500 shrink-0" aria-hidden />
        <span className={`flex-1 truncate ${selected ? 'text-white' : 'text-slate-500'}`}>
          {selected ? formatFieldDate(selected) : placeholder}
        </span>
      </button>
      <DatePanel
        open={open}
        anchorRef={triggerRef}
        panelRef={panelRef}
        selected={selected}
        onSelect={(day) => {
          onChange(toDateValue(day));
          close('pick');
        }}
      />
    </div>
  );
}

/** Время: 'HH:mm'. Набирается руками или выбирается из списка с шагом. */
export function FormTime({
  value,
  onChange,
  step = 15,
  suggestions,
  scrollTo = '09:00',
  placeholder = 'чч:мм',
  className = '',
  id,
  'aria-label': ariaLabel,
  onRejectedChange,
}: {
  value: string;
  onChange: (value: string) => void;
  step?: number;
  /** Особые значения в списке помимо шага, например 23:59 для сроков. */
  suggestions?: readonly string[];
  /** К какому времени прокрутить список, если поле пустое. */
  scrollTo?: string;
  placeholder?: string;
  className?: string;
  id?: string;
  'aria-label'?: string;
  /**
   * Набранное не похоже на время: поле вернуло прежнее значение. Если задано,
   * подсказку показывает родитель (во всю ширину), а не само узкое поле.
   */
  onRejectedChange?: (text: string | null) => void;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const refs = useMemo(() => [inputRef, panelRef], []);
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [rejected, setRejectedState] = useState<string | null>(null);
  const centerOnOpen = useRef(false);
  const setRejected = (text: string | null) => {
    setRejectedState(text);
    onRejectedChange?.(text);
  };

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const options = useMemo(() => {
    const all = new Set([...timeOptions(step), ...(suggestions ?? []), ...(value ? [value] : [])]);
    return [...all].sort();
  }, [step, suggestions, value]);

  const nearestIndex = (text: string) => {
    const parts = parseTimeInput(text);
    const target = parts ? formatTimeValue(parts) : value || scrollTo;
    const index = options.findIndex((o) => o >= target);
    return index === -1 ? options.length - 1 : index;
  };

  const openList = (text = draft) => {
    setActive(nearestIndex(text));
    if (!open) {
      centerOnOpen.current = true;
      setOpen(true);
    }
  };

  const commit = (text: string) => {
    setOpen(false);
    if (!text.trim()) {
      setDraft(value);
      return;
    }
    const parts = parseTimeInput(text);
    if (!parts) {
      setRejected(text.trim());
      setDraft(value);
      return;
    }
    const next = formatTimeValue(parts);
    setDraft(next);
    setRejected(null);
    if (next !== value) onChange(next);
  };

  const close = useCallback((reason: DismissReason) => {
    setOpen(false);
    if (reason === 'escape') setDraft(value);
  }, [value]);
  useDismissOnOutside(open, close, refs);

  const style = usePopoverPosition(open, inputRef, panelRef, { matchWidth: true, maxHeight: 264 });

  // Активный пункт — в поле зрения списка; при открытии — посередине.
  // Прокручивается панель: offsetTop пункта считается от неё же.
  useLayoutEffect(() => {
    // Пока высота панели не посчитана, она во весь список — центрировать рано.
    if (!open || active < 0 || style.maxHeight === undefined) return;
    const panel = panelRef.current;
    const item = listRef.current?.children[active] as HTMLElement | undefined;
    if (!panel || !item) return;
    if (centerOnOpen.current) {
      panel.scrollTop = item.offsetTop - panel.clientHeight / 2 + item.offsetHeight / 2;
      centerOnOpen.current = false;
    } else if (item.offsetTop < panel.scrollTop) {
      panel.scrollTop = item.offsetTop;
    } else if (item.offsetTop + item.offsetHeight > panel.scrollTop + panel.clientHeight) {
      panel.scrollTop = item.offsetTop + item.offsetHeight - panel.clientHeight;
    }
  }, [open, active, style.maxHeight]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        openList();
        return;
      }
      const from = active < 0 ? nearestIndex(draft) : active;
      const next = Math.max(0, Math.min(options.length - 1, from + (e.key === 'ArrowDown' ? 1 : -1)));
      setActive(next);
      setDraft(options[next]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit(draft);
    }
  };

  return (
    <div className={`min-w-0 ${className}`}>
      <div className="relative">
        <Clock
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
          aria-hidden
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500" aria-hidden>
          мск
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          maxLength={10}
          role="combobox"
          aria-label={ariaLabel ? `${ariaLabel} (по Москве)` : 'Время по Москве'}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={rejected ? true : undefined}
          value={draft}
          placeholder={placeholder}
          onClick={() => openList()}
          onChange={(e) => {
            setDraft(e.target.value);
            setRejected(null);
            openList(e.target.value);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => commit(draft)}
          className={`${FIELD} pl-9 pr-11 py-3 text-base sm:text-sm tabular-nums placeholder-slate-500 ${
            rejected ? 'border-amber-500/60' : ''
          }`}
        />
      </div>
      {rejected && !onRejectedChange && (
        <p role="alert" className="mt-1 text-xs leading-snug text-amber-300">
          {rejectedTimeMessage(rejected, value)}
        </p>
      )}
      {open && createPortal(
        <div
          ref={panelRef}
          style={style}
          // Клик по пункту не должен уводить фокус из поля — иначе blur
          // применил бы набранный текст раньше выбранного пункта.
          onPointerDown={(e) => e.preventDefault()}
          className={`${PANEL} py-1`}
        >
          <ul ref={listRef} id={listId} role="listbox" aria-label="Время">
            {options.map((option, index) => {
              const selected = option === value;
              return (
                <li
                  key={option}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={selected}
                  onClick={() => commit(option)}
                  onPointerEnter={() => setActive(index)}
                  className={`flex items-center justify-between gap-2 px-3.5 py-2.5 sm:py-2 text-sm tabular-nums cursor-pointer ${
                    index === active ? 'bg-white/10 text-white' : selected ? 'text-blue-300' : 'text-slate-300'
                  }`}
                >
                  {option}
                  {selected && <Check className="w-3.5 h-3.5 text-blue-400" aria-hidden />}
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}

function rejectedTimeMessage(text: string, kept: string) {
  return `«${text}» — не похоже на время${kept ? `, оставили ${kept}` : ''}. Например: 17:30 или 1730`;
}

export type DatetimePreset = {
  label: string;
  /** Через сколько дней от сегодня. */
  days: number;
  /** Время для варианта; без него — уже выбранное или defaultTime. */
  time?: string;
};

/**
 * Дата и время: 'YYYY-MM-DDTHH:mm' или ''. Дата и время — отдельные поля
 * рядом. Выбрали только дату — время ставится defaultTime, так что значение
 * всегда полное, а под полями видно, когда это относительно сегодня.
 */
export function FormDatetime({
  value,
  onChange,
  defaultTime = '18:00',
  timeStep = 15,
  timeSuggestions,
  presets,
  clearLabel,
  warnPast = false,
  className = '',
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  defaultTime?: string;
  timeStep?: number;
  timeSuggestions?: readonly string[];
  presets?: readonly DatetimePreset[];
  /** Подпись кнопки, очищающей поле (например, «Без срока»); без неё — нельзя очистить. */
  clearLabel?: string;
  /** Предупредить, если выбранное время уже прошло. */
  warnPast?: boolean;
  className?: string;
  id?: string;
}) {
  const { date, time } = splitDatetimeValue(value);
  const momentMs = schoolInputToMs(value);
  const [rejectedTime, setRejectedTime] = useState<string | null>(null);

  const setDate = (nextDate: string) => onChange(joinDatetimeValue(nextDate, time || defaultTime));
  const setTime = (nextTime: string) => onChange(joinDatetimeValue(date || schoolTodayValue(), nextTime));

  let hint: string | null = null;
  let past = false;
  const day = parseDateValue(date);
  if (momentMs !== null && day) {
    const minutesAhead = Math.round((momentMs - Date.now()) / 60_000);
    past = minutesAhead < 0;
    const relative = relativeDayLabel(day, schoolToday());
    if (past) {
      hint = warnPast ? `Это время уже прошло — ${relative}` : `Прошло — ${relative}`;
    } else if (minutesAhead < 12 * 60) {
      hint = minutesAhead < 1 ? 'Прямо сейчас' : `Через ${formatDuration(minutesAhead)}`;
    } else {
      hint = relative.charAt(0).toUpperCase() + relative.slice(1);
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(7.25rem,8.25rem)] gap-2">
        <FormDate value={date} onChange={setDate} placeholder="Дата" id={id} />
        <FormTime
          value={time}
          onChange={setTime}
          step={timeStep}
          suggestions={timeSuggestions}
          scrollTo={defaultTime}
          aria-label="Время"
          onRejectedChange={setRejectedTime}
        />
      </div>
      {rejectedTime && (
        <p role="alert" className="text-xs leading-snug text-amber-300">
          {rejectedTimeMessage(rejectedTime, time)}
        </p>
      )}
      {(presets?.length || (clearLabel && value)) ? (
        <div className="flex flex-wrap gap-1.5">
          {presets?.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChange(joinDatetimeValue(
                toDateValue(addDays(schoolToday(), preset.days)),
                preset.time ?? (time || defaultTime),
              ))}
              className={`${CHIP} ${CHIP_OFF}`}
            >
              {preset.label}
            </button>
          ))}
          {clearLabel && value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className={`${CHIP} inline-flex items-center gap-1 bg-transparent border-transparent text-slate-400 hover:text-white`}
            >
              <X className="w-3.5 h-3.5" aria-hidden />
              {clearLabel}
            </button>
          )}
        </div>
      ) : null}
      {hint && (
        <p className={`text-xs ${past && warnPast ? 'text-amber-300' : 'text-slate-500'}`}>{hint}</p>
      )}
    </div>
  );
}

const DURATION_PRESETS = [45, 60, 90, 120] as const;

/** Длительность в минутах: готовые варианты и своя, если нужна другая. */
export function FormDuration({
  value,
  onChange,
  presets = DURATION_PRESETS,
  startsAt,
  min = 5,
  max = 480,
}: {
  value: number;
  onChange: (minutes: number) => void;
  presets?: readonly number[];
  /** Начало ('YYYY-MM-DDTHH:mm'), чтобы подсказать время окончания. */
  startsAt?: string;
  min?: number;
  max?: number;
}) {
  const [custom, setCustom] = useState(() => !presets.includes(value));
  const [draft, setDraft] = useState(() => String(value));
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Пришло значение не из вариантов (открыли другое занятие) — показываем своё.
  // Зависимость — список строкой: массив, переданный прямо в JSX, новый на
  // каждом рендере и сбрасывал бы то, что человек сейчас набирает.
  const presetKey = presets.join(',');
  useEffect(() => {
    if (!presetKey.split(',').map(Number).includes(value)) {
      setCustom(true);
      setDraft(String(value));
    }
  }, [value, presetKey]);

  const commitDraft = () => {
    const minutes = parseDurationInput(draft);
    if (minutes === null || minutes < min || minutes > max) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(String(minutes));
    if (minutes !== value) onChange(minutes);
  };

  const startMs = startsAt ? schoolInputToMs(startsAt) : null;
  const end = startMs !== null ? new Date(startMs + value * 60_000) : null;
  const nextDay = end && startsAt ? toSchoolDateValue(end) !== startsAt.slice(0, 10) : false;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Длительность">
        {presets.map((minutes) => {
          const on = !custom && value === minutes;
          return (
            <button
              key={minutes}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setCustom(false);
                setInvalid(false);
                setDraft(String(minutes));
                onChange(minutes);
              }}
              className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
            >
              {formatDuration(minutes)}
            </button>
          );
        })}
        {custom ? (
          <span className={`inline-flex items-center gap-1.5 rounded-lg border pl-1 pr-2.5 ${
            invalid ? 'border-amber-500/50 bg-amber-500/5' : 'border-blue-500/40 bg-blue-600/10'
          }`}
          >
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              aria-label="Своя длительность в минутах"
              aria-invalid={invalid || undefined}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setInvalid(false);
              }}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitDraft();
                }
              }}
              placeholder="75"
              className="w-14 bg-transparent py-1.5 text-center text-base sm:text-sm text-white tabular-nums focus:outline-none placeholder-slate-600"
            />
            <span className="text-xs text-slate-400">мин</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setCustom(true);
              setDraft(String(value));
              requestAnimationFrame(() => inputRef.current?.select());
            }}
            className={`${CHIP} ${CHIP_OFF}`}
          >
            Другая…
          </button>
        )}
      </div>
      {invalid ? (
        <p role="alert" className="text-xs text-amber-300">
          От {min} минут до {formatDuration(max)} — например, 75 или 1:15
        </p>
      ) : end ? (
        <p className="text-xs text-slate-500">
          {custom && `${formatDuration(value)} · `}
          Закончится в {clockFmt.format(end)} {SCHOOL_TIME_SUFFIX}{nextDay ? ', на следующий день' : ''}
        </p>
      ) : custom ? (
        <p className="text-xs text-slate-500">{formatDuration(value)}</p>
      ) : null}
    </div>
  );
}
