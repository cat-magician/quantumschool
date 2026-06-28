import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarEvent {
  id: string;
  scheduled_at: string;
  title: string;
  event_type?: string;
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

  const eventDays = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      const d = new Date(e.scheduled_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [events]);

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
        <button type="button" onClick={prev} className="p-2 rounded-lg hover:bg-white/5 text-slate-400">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-white capitalize">{label}</span>
        <button type="button" onClick={next} className="p-2 rounded-lg hover:bg-white/5 text-slate-400">
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
          const count = eventDays.get(key) ?? 0;
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const isToday = isSameDay(date, new Date());
          return (
            <button
              key={key}
              type="button"
              disabled={dateSelectionDisabled}
              onClick={() => !dateSelectionDisabled && onSelectDate?.(date)}
              className={`aspect-square rounded-lg text-sm relative transition-colors ${
                dateSelectionDisabled
                  ? 'text-slate-500 cursor-not-allowed'
                  : isSelected
                    ? 'bg-blue-600 text-white'
                    : isToday
                      ? 'bg-blue-600/20 text-blue-300'
                      : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              {date.getDate()}
              {count > 0 && (
                <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-violet-400'}`} />
              )}
            </button>
          );
        })}
      </div>
      {dateSelectionDisabled && disabledHint && (
        <p className="mt-3 text-xs text-slate-500 text-center leading-snug">{disabledHint}</p>
      )}
    </div>
  );
}
