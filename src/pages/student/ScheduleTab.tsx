import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Calendar, Clock, Loader2 } from 'lucide-react';
import MeetingLinkButton from '../../components/MeetingLinkButton';
import MonthCalendar from '../../components/MonthCalendar';
import { EVENT_TONES } from '../../lib/scheduleTones';
import {
  LiveChip,
  ScheduleCard,
  ScheduleCardMedia,
  ScheduleChip,
  ScheduleDayHeading,
  ScheduleMeta,
  SchedulePastDivider,
} from '../../components/ScheduleCard';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import type { CalendarEntry, ScheduleEvent } from '../../lib/types';
import {
  cachedStudentSchedule,
  rememberStudentSchedule,
  STUDENT_SCHEDULE_SELECT,
  visibleStudentEvents,
} from '../../lib/scheduleCache';
import {
  loadStudentHomework,
  type OwnHomeworkSubmission,
  type PublishedHomeworkPage,
} from '../../lib/studentHomeworkData';
import { formatHomeworkScoreShort } from '../../lib/homeworkUtils';
import {
  EVENT_TYPE_LABELS,
  buildCalendar,
  eventMatchesScheduleFilter,
  formatDuration,
  formatEventDate,
  formatTimeRange,
  getScheduleEmptyMessage,
  groupEventsByDate,
  isEventActive,
  isEventEnded,
  isEventOngoing,
  sortScheduleEventsAscending,
  sortScheduleEventsDescending,
} from '../../lib/scheduleUtils';

/** Куда ведёт карточка: страница лекции, семинара или ДЗ в «Обучении». */
export type StudentContentLink = (sub: 'lectures' | 'seminars' | 'homework', pageId: string) => void;

const lessonSub = (type: 'lecture' | 'seminar') => (type === 'seminar' ? 'seminars' : 'lectures');

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Сдано ли задание — на карточке его срока. */
function deadlineStatus(
  submission: OwnHomeworkSubmission | undefined,
  past: boolean,
  maxScore: number | undefined,
): { label: string; className: string } {
  if (submission?.status === 'graded') {
    return {
      label: submission.score !== null
        ? `Проверено · ${formatHomeworkScoreShort(submission.score, maxScore)}`
        : 'Проверено',
      className: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/25',
    };
  }
  if (submission?.status === 'submitted') {
    return { label: 'Сдано · на проверке', className: 'bg-sky-500/10 text-sky-200 border-sky-500/25' };
  }
  if (past) {
    return {
      label: submission?.status === 'draft' ? 'Черновик · срок прошёл' : 'Не сдано · срок прошёл',
      className: 'bg-rose-500/10 text-rose-200 border-rose-500/30',
    };
  }
  if (submission?.status === 'draft') {
    return { label: 'Черновик', className: 'bg-white/5 text-slate-300 border-white/10' };
  }
  return { label: 'Не сдано', className: 'bg-violet-500/10 text-violet-200 border-violet-500/25' };
}

export default function StudentScheduleTab({ onOpenContent }: { onOpenContent?: StudentContentLink }) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  // Уже загруженное (той же главной) показываем сразу, свежее — следом.
  const [events, setEvents] = useState<ScheduleEvent[]>(() => cachedStudentSchedule(userId)?.events ?? []);
  const [homework, setHomework] = useState<PublishedHomeworkPage[]>(
    () => cachedStudentSchedule(userId)?.homework ?? [],
  );
  const [submissions, setSubmissions] = useState<OwnHomeworkSubmission[]>(
    () => cachedStudentSchedule(userId)?.submissions ?? [],
  );
  const [loading, setLoading] = useState(() => cachedStudentSchedule(userId) === null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Сроки ДЗ главная уже принесла — берём их; сдачи спрашиваем всегда:
    // задание могли сдать на другой вкладке после главной.
    const knownPages = cachedStudentSchedule(userId)?.homework ?? null;
    Promise.all([
      supabase
        .from('schedule_events')
        .select(STUDENT_SCHEDULE_SELECT)
        .order('scheduled_at', { ascending: true }),
      knownPages
        ? loadStudentHomework(userId, { withPages: false }).then((h) => ({ ...h, pages: knownPages }))
        : loadStudentHomework(userId),
    ]).then(([eventsRes, hw]) => {
      if (cancelled) return;
      const fresh = eventsRes.data ? visibleStudentEvents(eventsRes.data as ScheduleEvent[]) : null;
      if (fresh) setEvents(fresh);
      setHomework(hw.pages);
      setSubmissions(hw.submissions);
      rememberStudentSchedule(userId, {
        ...(fresh ? { events: fresh } : {}),
        homework: hw.pages,
        submissions: hw.submissions,
      });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const entries = useMemo(() => buildCalendar(events, homework), [events, homework]);
  const submissionByPage = useMemo(
    () => new Map(submissions.map((s) => [s.page_id, s])),
    [submissions],
  );

  const { upcomingGroups, pastGroups } = useMemo(() => {
    const list = entries.filter((e) => eventMatchesScheduleFilter(e, 'all', selectedDate));
    const upcoming = list.filter((e) => isEventActive(e.scheduled_at, e.duration_minutes));
    const past = list.filter((e) => isEventEnded(e.scheduled_at, e.duration_minutes));
    return {
      upcomingGroups: groupEventsByDate(sortScheduleEventsAscending(upcoming)),
      pastGroups: groupEventsByDate(sortScheduleEventsDescending(past)),
    };
  }, [entries, selectedDate]);

  const hasEvents = upcomingGroups.length > 0 || pastGroups.length > 0;
  const showPastDivider = upcomingGroups.length > 0 && pastGroups.length > 0;

  // «Ближайшее занятие» — именно занятие: дедлайны сюда не идут.
  const nextEvent = useMemo(
    () => sortScheduleEventsAscending(
      events.filter((e) => isEventActive(e.scheduled_at, e.duration_minutes)),
    )[0],
    [events],
  );

  const emptyMessage = useMemo(() => {
    if (entries.length === 0 && !selectedDate) {
      return 'Расписание пока пустое — наставник добавит занятия';
    }
    return getScheduleEmptyMessage('all', selectedDate, 'занятий');
  }, [selectedDate, entries.length]);

  const openEntry = (entry: CalendarEntry) => {
    if (!onOpenContent) return undefined;
    if (entry.homeworkPageId) {
      const pageId = entry.homeworkPageId;
      return () => onOpenContent('homework', pageId);
    }
    const page = entry.lesson_page;
    if (page) return () => onOpenContent(lessonSub(page.lesson_type), page.id);
    return undefined;
  };

  const renderEntry = (entry: CalendarEntry, past: boolean) => {
    const open = openEntry(entry);
    if (entry.homeworkPageId) {
      const status = deadlineStatus(submissionByPage.get(entry.homeworkPageId), past, entry.homeworkMaxScore);
      return (
        <ScheduleCard
          key={entry.id}
          type="homework"
          title={entry.title}
          past={past}
          onOpen={open}
          openLabel="открыть задание"
          chips={(
            <>
              <ScheduleChip className={EVENT_TONES.homework.chip}>Дедлайн ДЗ</ScheduleChip>
              <ScheduleChip className={status.className}>{status.label}</ScheduleChip>
            </>
          )}
          meta={(
            <ScheduleMeta past={past}>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-500" aria-hidden />
                сдать до {formatTimeRange(entry.scheduled_at)}
              </span>
            </ScheduleMeta>
          )}
        />
      );
    }

    return (
      <ScheduleCard
        key={entry.id}
        type={entry.event_type}
        coverUrl={entry.lesson_page?.cover_url}
        title={entry.title}
        description={entry.description}
        past={past}
        onOpen={open}
        openLabel={entry.lesson_page
          ? `открыть страницу ${entry.lesson_page.lesson_type === 'seminar' ? 'семинара' : 'лекции'}`
          : undefined}
        chips={(
          <>
            <ScheduleChip className={EVENT_TONES[entry.event_type].chip}>
              {EVENT_TYPE_LABELS[entry.event_type]}
            </ScheduleChip>
            {isEventOngoing(entry.scheduled_at, entry.duration_minutes) && <LiveChip />}
          </>
        )}
        meta={(
          <ScheduleMeta past={past}>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-500" aria-hidden />
              {formatTimeRange(entry.scheduled_at, entry.duration_minutes)}
            </span>
            <span className="text-slate-500">{formatDuration(entry.duration_minutes)}</span>
          </ScheduleMeta>
        )}
        footer={entry.meeting_url && !past ? (
          <MeetingLinkButton
            url={entry.meeting_url}
            scheduledAt={entry.scheduled_at}
            durationMinutes={entry.duration_minutes}
            variant="card"
          />
        ) : undefined}
      />
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  const nextPage = nextEvent?.lesson_page ?? null;
  const nextCover = nextPage?.cover_url?.trim();

  return (
    <div className="max-w-6xl space-y-6">
      {nextEvent && (
        <section className="group relative overflow-hidden rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-600/20 to-violet-600/20">
          <div className="flex flex-col sm:flex-row">
            {nextCover && (
              <ScheduleCardMedia
                type={nextEvent.event_type}
                coverUrl={nextCover}
                className="aspect-[21/9] w-full sm:order-2 sm:aspect-auto sm:w-72"
              />
            )}
            <div className="flex-1 min-w-0 p-5 sm:p-6">
              <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider mb-2">
                Ближайшее занятие
              </p>
              <h2 className="text-xl font-bold text-white mb-2 break-words">
                {nextPage && onOpenContent ? (
                  <button
                    type="button"
                    onClick={() => onOpenContent(lessonSub(nextPage.lesson_type), nextPage.id)}
                    className="text-left hover:text-blue-100 transition-colors after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-blue-400/70 after:rounded-2xl"
                  >
                    {nextEvent.title}
                  </button>
                ) : (
                  nextEvent.title
                )}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-400 flex-shrink-0" aria-hidden />
                  {capitalize(formatEventDate(nextEvent.scheduled_at))}
                </span>
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" aria-hidden />
                  {formatTimeRange(nextEvent.scheduled_at, nextEvent.duration_minutes)}
                </span>
                <span className="text-violet-200">{EVENT_TYPE_LABELS[nextEvent.event_type]}</span>
                {isEventOngoing(nextEvent.scheduled_at, nextEvent.duration_minutes) && <LiveChip />}
              </div>
              {(nextEvent.meeting_url || nextPage) && (
                <div className="relative z-10 mt-4 flex flex-wrap gap-2">
                  {nextEvent.meeting_url && (
                    <MeetingLinkButton
                      url={nextEvent.meeting_url}
                      scheduledAt={nextEvent.scheduled_at}
                      durationMinutes={nextEvent.duration_minutes}
                      variant="hero"
                    />
                  )}
                  {nextPage && onOpenContent && (
                    <button
                      type="button"
                      onClick={() => onOpenContent(lessonSub(nextPage.lesson_type), nextPage.id)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                    >
                      Страница занятия
                      <ArrowRight className="w-4 h-4" aria-hidden />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
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
              {upcomingGroups.map(({ dateKey, items }) => (
                <section key={dateKey}>
                  <ScheduleDayHeading iso={items[0].scheduled_at} />
                  <div className="space-y-3">{items.map((entry) => renderEntry(entry, false))}</div>
                </section>
              ))}
              {showPastDivider && <SchedulePastDivider />}
              {pastGroups.map(({ dateKey, items }) => (
                <section key={dateKey}>
                  <ScheduleDayHeading iso={items[0].scheduled_at} past />
                  <div className="space-y-3">{items.map((entry) => renderEntry(entry, true))}</div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 min-w-0 lg:sticky lg:top-6 lg:self-start">
          <MonthCalendar
            events={entries}
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
