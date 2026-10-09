import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ScheduleEventType } from '../lib/types';
import { pluralRu } from '../lib/dateTimeInput';
import { EVENT_TONES } from '../lib/scheduleTones';

interface CalendarEvent {
  id: string;
  scheduled_at: string;
  title: string;
  event_type?: ScheduleEventType;
  /** У дедлайна ДЗ — в легенде он «Дедлайн ДЗ», а не тип события. */
  homeworkPageId?: string;
}

interface MonthCalendarProps {
  events: CalendarEvent[];
  month: Date;
  onMonthChange: (d: Date) => void;
  onSelectDate?: (d: Date) => void;
  selectedDate?: Date | null;
  /** Дни не кликабельны (например, при фильтре не «Все»). */
  dateSelectionDisabled?: boolean;
  disabledHint?: string;
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const LEGEND: Record<ScheduleEventType, string> = {
  lecture: 'Лекция',
  seminar: 'Семинар',
  webinar: 'Вебинар',
  exam: 'Экзамен',
  consultation: 'Консультация',
  homework: 'Дедлайн ДЗ',
};

const dayAriaFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function entryType(e: CalendarEvent): ScheduleEventType {
  return e.homeworkPageId ? 'homework' : e.event_type ?? 'lecture';
}

export default function MonthCalendar({
  events,
  month,
  onMonthChange,
  onSelectDate,
  selectedDate,
  dateSelectionDisabled = false,
  disabledHint,
}: MonthCalendarProps) {
  const { cells, label } = useMemo(() => {
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
  }, [month]);

  // По дню — сколько событий и каких типов (по точке на тип, не больше трёх).
  const days = useMemo(() => {
    const map = new Map<string, { count: number; types: ScheduleEventType[] }>();
    for (const e of events) {
      const key = dayKey(new Date(e.scheduled_at));
      const day = map.get(key) ?? { count: 0, types: [] };
      day.count += 1;
      const type = entryType(e);
      if (!day.types.includes(type)) day.types.push(type);
      map.set(key, day);
    }
    return map;
  }, [events]);

  const monthTypes = useMemo(() => {
    const types = new Set<ScheduleEventType>();
    for (const e of events) {
      const d = new Date(e.scheduled_at);
      if (d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth()) types.add(entryType(e));
    }
    return (Object.keys(LEGEND) as ScheduleEventType[]).filter((t) => types.has(t));
  }, [events, month]);

  const prev = () => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const next = () => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1));

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  return (
    <div
      className={`bg-slate-900/60 border border-white/5 rounded-2xl p-4 transition-opacity ${
        dateSelectionDisabled ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prev}
          aria-label="Предыдущий месяц"
          className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-white capitalize">{label}</span>
        <button
          type="button"
          onClick={next}
          aria-label="Следующий месяц"
          className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 mb-2" aria-hidden>
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const key = dayKey(date);
          const day = days.get(key);
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const isToday = isSameDay(date, new Date());
          const ariaLabel = day
            ? `${dayAriaFmt.format(date)}: ${day.count} ${pluralRu(day.count, ['событие', 'события', 'событий'])}`
            : dayAriaFmt.format(date);
          return (
            <button
              key={key}
              type="button"
              disabled={dateSelectionDisabled}
              aria-label={ariaLabel}
              aria-pressed={Boolean(isSelected)}
              aria-current={isToday ? 'date' : undefined}
              onClick={() => !dateSelectionDisabled && onSelectDate?.(date)}
              className={`aspect-square rounded-lg text-sm relative tabular-nums transition-colors ${
                dateSelectionDisabled
                  ? 'text-slate-500 cursor-not-allowed'
                  : isSelected
                    ? 'bg-blue-600 text-white'
                    : isToday
                      ? 'bg-blue-600/20 text-blue-300'
                      : day
                        ? 'text-white hover:bg-white/5'
                        : 'text-slate-400 hover:bg-white/5'
              }`}
            >
              {date.getDate()}
              {day && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5" aria-hidden>
                  {day.types.slice(0, 3).map((type) => (
                    <span
                      key={type}
                      className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : EVENT_TONES[type].dot}`}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {monthTypes.length > 0 && (
        <ul className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-slate-400">
          {monthTypes.map((type) => (
            <li key={type} className="inline-flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${EVENT_TONES[type].dot}`} aria-hidden />
              {LEGEND[type]}
            </li>
          ))}
        </ul>
      )}
      {dateSelectionDisabled && disabledHint && (
        <p className="mt-3 text-xs text-slate-500 text-center leading-snug">{disabledHint}</p>
      )}
    </div>
  );
}
