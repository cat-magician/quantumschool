import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, Loader2 } from 'lucide-react';
import MeetingLinkButton from '../../components/MeetingLinkButton';
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
  groupEventsByDate,
  isEventActive,
  isEventEnded,
  sortScheduleEventsAscending,
  sortScheduleEventsDescending,
} from '../../lib/scheduleUtils';
type DateGroup = ReturnType<typeof groupEventsByDate<ScheduleEvent>>[number];

function ScheduleEventCard({ event, isPast }: { event: ScheduleEvent; isPast: boolean }) {
  return (
    <div
      className={
        isPast
          ? 'bg-slate-950/40 border border-white/[0.03] rounded-2xl p-5 flex gap-4 opacity-75'
          : 'bg-slate-900/60 border border-white/5 rounded-2xl p-5 flex gap-4'
      }
    >
      <div className="w-14 flex-shrink-0 text-center">
        <div className={`text-lg font-bold leading-none ${isPast ? 'text-slate-500' : 'text-white'}`}>
          {formatEventTime(event.scheduled_at)}
        </div>
        <div className="text-xs text-slate-500 mt-1">{formatDuration(event.duration_minutes)}</div>
      </div>
      <div className="flex-1 min-w-0 border-l border-white/5 pl-4">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span
            className={
              isPast
                ? 'text-xs px-2 py-0.5 rounded-md bg-slate-600/15 text-slate-500'
                : 'text-xs px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-300'
            }
          >
            {EVENT_TYPE_LABELS[event.event_type]}
          </span>
          {event.group?.name && (
            <span className="text-xs text-slate-500">{event.group.name}</span>
          )}
        </div>
        <h4 className={`font-semibold mb-1 ${isPast ? 'text-slate-400' : 'text-white'}`}>{event.title}</h4>
        {event.description && (
          <p className={`text-sm leading-relaxed ${isPast ? 'text-slate-500' : 'text-slate-400'}`}>
            {event.description}
          </p>
        )}
        {event.meeting_url && (
          <MeetingLinkButton
            url={event.meeting_url}
            scheduledAt={event.scheduled_at}
            durationMinutes={event.duration_minutes}
            variant="inline"
          />
        )}
      </div>
    </div>
  );
}

function ScheduleDateGroups({ groups, isPast }: { groups: DateGroup[]; isPast: boolean }) {
  return (
    <>
      {groups.map(({ dateLabel, items }) => (
        <div key={dateLabel}>
          <h3
            className={`text-sm font-semibold uppercase tracking-wider mb-3 capitalize ${
              isPast ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            {dateLabel}
          </h3>
          <div className="space-y-3">
            {items.map((event) => (
              <ScheduleEventCard key={event.id} event={event} isPast={isPast} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export default function StudentScheduleTab() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
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

  const { upcomingGroups, pastGroups } = useMemo(() => {
    const list = events.filter((e) => eventMatchesScheduleFilter(e, 'all', selectedDate));
    const upcoming = list.filter((e) => isEventActive(e.scheduled_at, e.duration_minutes));
    const past = list.filter((e) => isEventEnded(e.scheduled_at, e.duration_minutes));
    return {
      upcomingGroups: groupEventsByDate(sortScheduleEventsAscending(upcoming)),
      pastGroups: groupEventsByDate(sortScheduleEventsDescending(past)),
    };
  }, [events, selectedDate]);

  const hasEvents = upcomingGroups.length > 0 || pastGroups.length > 0;
  const showPastDivider = upcomingGroups.length > 0 && pastGroups.length > 0;

  const nextEvent = useMemo(
    () => sortScheduleEventsAscending(
      events.filter((e) => isEventActive(e.scheduled_at, e.duration_minutes)),
    )[0],
    [events],
  );

  const emptyMessage = useMemo(() => {
    if (events.length === 0 && !selectedDate) {
      return 'Расписание пока пустое — наставник добавит занятия';
    }
    return getScheduleEmptyMessage('all', selectedDate, 'занятий');
  }, [selectedDate, events.length]);

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
            <MeetingLinkButton
              url={nextEvent.meeting_url}
              scheduledAt={nextEvent.scheduled_at}
              durationMinutes={nextEvent.duration_minutes}
              variant="hero"
            />
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-6 min-w-0">
      {!hasEvents ? (
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-10 text-center">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-8">
          <ScheduleDateGroups groups={upcomingGroups} isPast={false} />
          {showPastDivider && (
            <div className="flex items-center gap-4 py-1">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-slate-500 uppercase tracking-wider whitespace-nowrap">
                Прошедшие
              </span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
          )}
          <ScheduleDateGroups groups={pastGroups} isPast />
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
          {selectedDate && (
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors w-full text-center"
            >
              Показать все даты
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
