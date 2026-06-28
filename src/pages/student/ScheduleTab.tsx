import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, Loader2, Video } from 'lucide-react';
import MonthCalendar from '../../components/MonthCalendar';
import { supabase } from '../../lib/supabase';
import type { ScheduleEvent } from '../../lib/types';
import {
  EVENT_TYPE_LABELS,
  eventMatchesScheduleFilter,
  formatDuration,
  formatEventDate,
  formatEventTime,
  getScheduleEmptyMessage,
  getScheduleRefHint,
  groupEventsByDate,
  isEventActive,
  sortScheduleEventsAscending,
  sortScheduleEventsForList,
} from '../../lib/scheduleUtils';

type Filter = 'upcoming' | 'all';

export default function StudentScheduleTab() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    supabase
      .from('schedule_events')
      .select('*, group:groups(id, name)')
      .order('scheduled_at', { ascending: true })
      .then(({ data }) => {
        if (data) setEvents(data as ScheduleEvent[]);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const list = events.filter((e) =>
      eventMatchesScheduleFilter(e, filter === 'all' ? 'all' : 'upcoming', selectedDate),
    );
    return filter === 'all'
      ? sortScheduleEventsForList(list)
      : sortScheduleEventsAscending(list);
  }, [events, filter, selectedDate]);

  const refHint = useMemo(() => getScheduleRefHint(filter, selectedDate), [filter, selectedDate]);

  const grouped = useMemo(() => groupEventsByDate(filtered), [filtered]);

  const nextEvent = useMemo(
    () => sortScheduleEventsAscending(
      events.filter((e) => isEventActive(e.scheduled_at, e.duration_minutes)),
    )[0],
    [events],
  );

  const emptyMessage = useMemo(() => {
    if (events.length === 0 && !selectedDate) {
      return 'Расписание пока пустое — преподаватель добавит занятия';
    }
    return getScheduleEmptyMessage(filter === 'all' ? 'all' : 'upcoming', selectedDate, 'занятий');
  }, [filter, selectedDate, events.length]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      {nextEvent && (
        <div className="bg-gradient-to-br from-blue-600/20 to-violet-600/20 border border-blue-500/25 rounded-2xl p-6">
          <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider mb-2">Ближайшее занятие</p>
          <h2 className="text-xl font-bold text-white mb-2">{nextEvent.title}</h2>
          <div className="flex flex-wrap gap-4 text-sm text-slate-300">
            <span className="inline-flex items-center gap-1.5 capitalize">
              <Calendar className="w-4 h-4 text-blue-400 flex-shrink-0" />
              {formatEventDate(nextEvent.scheduled_at)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
              {formatEventTime(nextEvent.scheduled_at)}
            </span>
            <span className="text-slate-400">{formatDuration(nextEvent.duration_minutes)}</span>
            <span className="text-violet-300">{EVENT_TYPE_LABELS[nextEvent.event_type]}</span>
          </div>
          {nextEvent.meeting_url && (
            <a
              href={nextEvent.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              <Video className="w-4 h-4" />
              Подключиться
            </a>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-6 min-w-0">
      <div className="flex gap-2">
        {([
          ['all', 'Все'],
          ['upcoming', 'Предстоящие'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === id
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-400 bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-10 text-center">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ dateLabel, items }) => (
            <div key={dateLabel}>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 capitalize">
                {dateLabel}
              </h3>
              <div className="space-y-3">
                {items.map((event) => (
                  <div
                    key={event.id}
                    className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 flex gap-4"
                  >
                    <div className="w-14 flex-shrink-0 text-center">
                      <div className="text-lg font-bold text-white leading-none">
                        {formatEventTime(event.scheduled_at)}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {formatDuration(event.duration_minutes)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 border-l border-white/5 pl-4">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-300">
                          {EVENT_TYPE_LABELS[event.event_type]}
                        </span>
                        {event.group?.name && (
                          <span className="text-xs text-slate-500">{event.group.name}</span>
                        )}
                      </div>
                      <h4 className="font-semibold text-white mb-1">{event.title}</h4>
                      {event.description && (
                        <p className="text-sm text-slate-400 leading-relaxed">{event.description}</p>
                      )}
                      {event.meeting_url && isEventActive(event.scheduled_at, event.duration_minutes) && (
                        <a
                          href={event.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 mt-2 text-sm text-blue-400 hover:text-blue-300"
                        >
                          <Video className="w-3.5 h-3.5" />
                          Ссылка на занятие
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <MonthCalendar
            events={events}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            selectedDate={selectedDate}
            onSelectDate={(d) => {
              setSelectedDate((prev) =>
                prev && prev.getTime() === d.getTime() ? null : d,
              );
            }}
          />
          {refHint && (
            <p className="text-xs text-slate-500 text-center leading-snug">{refHint}</p>
          )}
          {selectedDate && (
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              {filter === 'all' ? 'Показать все даты' : 'Вернуться к сегодня'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
