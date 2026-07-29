import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

export const formFieldClass =
  'w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/60 transition-colors';

type FieldProps = {
  className?: string;
};

export type SelectOption = {
  value: string;
  label: string;
};

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const datetimeDisplayFmt = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function useDismissOnOutside(open: boolean, onClose: () => void, refs: React.RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (refs.some((ref) => ref.current?.contains(target))) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, onClose, refs]);
}

function useAnchorPosition(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  opts?: { panelWidth?: number },
) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const update = () => {
      if (!anchorRef.current) return;
      const r = anchorRef.current.getBoundingClientRect();
      let left = r.left;
      const panelWidth = opts?.panelWidth ?? 0;
      if (panelWidth > 0) {
        const margin = 16;
        left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin));
      }
      setPos({ top: r.bottom + 6, left, width: r.width });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef, opts?.panelWidth]);

  return pos;
}

function DropdownPanel({
  anchorRef,
  open,
  panelRef,
  children,
  className = '',
  maxHeight = 'max-h-56',
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  panelRef: React.RefObject<HTMLDivElement>;
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}) {
  const pos = useAnchorPosition(open, anchorRef);
  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      className={`fixed z-[200] overflow-y-auto scrollbar-site rounded-xl border border-white/10 bg-slate-900 shadow-2xl py-1 ${maxHeight} ${className}`}
      style={{ top: pos.top, left: pos.left, width: pos.width }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function FormText({
  className = '',
  ...props
}: FieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`${formFieldClass} placeholder-slate-500 ${className}`}
    />
  );
}

export function FormTextarea({
  className = '',
  ...props
}: FieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${formFieldClass} placeholder-slate-500 resize-none ${className}`}
    />
  );
}

export function FormSelect({
  value,
  onChange,
  options,
  placeholder = 'Выберите…',
  className = '',
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useDismissOnOutside(open, () => setOpen(false), [rootRef, panelRef]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`${formFieldClass} flex items-center justify-between gap-2 text-left ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <span className={`truncate ${selected ? 'text-white' : 'text-slate-500'}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <DropdownPanel anchorRef={btnRef} open={open} panelRef={panelRef}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              onChange(opt.value);
              setOpen(false);
            }}
            className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
              opt.value === value
                ? 'bg-blue-600/20 text-blue-300'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </DropdownPanel>
    </div>
  );
}

export function FormNumber({
  className = '',
  ...props
}: FieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      {...props}
      className={`${formFieldClass} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
    />
  );
}

function parseDatetimeLocal(value: string) {
  if (!value) {
    return { date: null as Date | null, hours: 12, minutes: 0 };
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return { date: null as Date | null, hours: 12, minutes: 0 };
  }
  return { date: d, hours: d.getHours(), minutes: d.getMinutes() };
}

function toDatetimeLocalValue(date: Date, hours: number, minutes: number) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hours)}:${pad(minutes)}`;
}

function buildMonthGrid(month: Date) {
  const y = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(y, m, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
  const label = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(month);
  return { cells, label };
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDateInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const dateDisplayFmt = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function FormDate({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const parsed = parseDateInput(value);
  const [month, setMonth] = useState(() => parsed ?? new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(parsed);

  useEffect(() => {
    const p = parseDateInput(value);
    setSelectedDay(p);
    if (p) setMonth(new Date(p.getFullYear(), p.getMonth(), 1));
  }, [value]);

  useDismissOnOutside(open, () => setOpen(false), [rootRef, panelRef]);

  const { cells, label } = buildMonthGrid(month);
  const today = new Date();

  const displayText = selectedDay ? dateDisplayFmt.format(selectedDay) : 'Выберите дату';

  const pickDay = (day: Date) => {
    setSelectedDay(day);
    onChange(toDateInputValue(day));
    setOpen(false);
  };

  const pos = useAnchorPosition(open, btnRef, {
    panelWidth: Math.min(window.innerWidth - 32, 320),
  });

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${formFieldClass} flex items-center justify-between gap-2 text-left cursor-pointer max-w-xs`}
      >
        <span className={selectedDay ? 'text-white' : 'text-slate-500'}>{displayText}</span>
        <Calendar className="w-4 h-4 text-slate-500 flex-shrink-0" />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[200] rounded-2xl border border-white/10 bg-slate-900 shadow-2xl p-4 w-[min(100vw-2rem,320px)]"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                className="p-2 rounded-lg hover:bg-white/5 text-slate-400"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-white capitalize">{label}</span>
              <button
                type="button"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                className="p-2 rounded-lg hover:bg-white/5 text-slate-400"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 mb-2">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((date, i) => {
                if (!date) return <div key={`empty-${i}`} />;
                const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                const isSelected = selectedDay && isSameDay(date, selectedDay);
                const isToday = isSameDay(date, today);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pickDay(date)}
                    className={`aspect-square rounded-lg text-sm transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : isToday
                          ? 'bg-blue-600/20 text-blue-300'
                          : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => pickDay(today)}
              className="w-full mt-4 py-2 rounded-xl text-xs font-medium text-blue-400 hover:bg-blue-600/10 transition-colors"
            >
              Сегодня
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

const numberInputClass = `${formFieldClass} text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function TimeInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1.5">{label}</p>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(clamp(n, min, max));
        }}
        onBlur={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isNaN(n) ? min : clamp(n, min, max));
        }}
        className={numberInputClass}
      />
    </div>
  );
}

export function FormDatetime({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const parsed = parseDatetimeLocal(value);
  const [month, setMonth] = useState(() => parsed.date ?? new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(parsed.date);
  const [hours, setHours] = useState(parsed.hours);
  const [minutes, setMinutes] = useState(parsed.minutes);

  useEffect(() => {
    const p = parseDatetimeLocal(value);
    setSelectedDay(p.date);
    if (p.date) setMonth(new Date(p.date.getFullYear(), p.date.getMonth(), 1));
    setHours(p.hours);
    setMinutes(p.minutes);
  }, [value]);

  useDismissOnOutside(open, () => setOpen(false), [rootRef, panelRef]);

  const { cells, label } = buildMonthGrid(month);
  const today = new Date();

  const displayText = selectedDay
    ? datetimeDisplayFmt.format(
        new Date(
          selectedDay.getFullYear(),
          selectedDay.getMonth(),
          selectedDay.getDate(),
          hours,
          minutes,
        ),
      )
    : 'Выберите дату и время';

  const commit = (day: Date, h: number, m: number) => {
    onChange(toDatetimeLocalValue(day, h, m));
  };

  const pickDay = (day: Date) => {
    setSelectedDay(day);
    commit(day, hours, minutes);
  };

  const pos = useAnchorPosition(open, btnRef, {
    panelWidth: Math.min(window.innerWidth - 32, 320),
  });

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${formFieldClass} flex items-center justify-between gap-2 text-left cursor-pointer`}
      >
        <span className={selectedDay ? 'text-white' : 'text-slate-500'}>{displayText}</span>
        <Calendar className="w-4 h-4 text-slate-500 flex-shrink-0" />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[200] rounded-2xl border border-white/10 bg-slate-900 shadow-2xl p-4 w-[min(100vw-2rem,320px)] max-h-[min(90vh,480px)] overflow-y-auto scrollbar-site"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                className="p-2 rounded-lg hover:bg-white/5 text-slate-400"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-white capitalize">{label}</span>
              <button
                type="button"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                className="p-2 rounded-lg hover:bg-white/5 text-slate-400"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 mb-2">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 mb-4">
              {cells.map((date, i) => {
                if (!date) return <div key={`empty-${i}`} />;
                const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                const isSelected = selectedDay && isSameDay(date, selectedDay);
                const isToday = isSameDay(date, today);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pickDay(date)}
                    className={`aspect-square rounded-lg text-sm transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : isToday
                          ? 'bg-blue-600/20 text-blue-300'
                          : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
              <TimeInput
                label="Часы"
                value={hours}
                min={0}
                max={23}
                onChange={(h) => {
                  setHours(h);
                  if (selectedDay) commit(selectedDay, h, minutes);
                }}
              />
              <TimeInput
                label="Минуты"
                value={minutes}
                min={0}
                max={59}
                onChange={(m) => {
                  setMinutes(m);
                  if (selectedDay) commit(selectedDay, hours, m);
                }}
              />
            </div>

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setSelectedDay(now);
                  setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  setHours(now.getHours());
                  setMinutes(now.getMinutes());
                  commit(now, now.getHours(), now.getMinutes());
                }}
                className="flex-1 py-2 rounded-xl text-xs font-medium text-blue-400 hover:bg-blue-600/10 transition-colors"
              >
                Сейчас
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-blue-600 to-violet-700 text-white hover:opacity-90 transition-opacity"
              >
                Готово
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export function FormLabel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm text-slate-400 mb-1.5 ${className}`}>
      {children}
    </label>
  );
}
