import type { CalendarEntry, HomeworkPage, ScheduleEvent, ScheduleEventType } from './types';
import { daysFromToday } from './dateTimeInput';

export const EVENT_TYPE_LABELS: Record<ScheduleEventType, string> = {
  lecture: 'Лекция',
  seminar: 'Семинар',
  webinar: 'Вебинар',
  homework: 'Домашнее задание',
  exam: 'Экзамен',
  consultation: 'Консультация',
};

/**
 * Типы для новых событий. «Домашнее задание» не предлагаем: дедлайны ДЗ
 * попадают в расписание сами, со страницы задания. Старые события этого
 * типа по-прежнему показываются и редактируются.
 */
export const EVENT_TYPE_OPTIONS: ScheduleEventType[] = [
  'lecture',
  'seminar',
  'webinar',
  'exam',
  'consultation',
];

/** Лекция и семинар — то же занятие, что страница с материалами. */
export function isLessonEventType(type: ScheduleEventType): type is 'lecture' | 'seminar' {
  return type === 'lecture' || type === 'seminar';
}

type DeadlineSource = Pick<HomeworkPage, 'id' | 'title' | 'due_at'>
  & Partial<Pick<HomeworkPage, 'is_published' | 'group_ids' | 'updated_at' | 'max_score'>>;

/** Дедлайн ДЗ в виде записи календаря; без срока — не в календаре. */
export function homeworkDeadlineEntry(page: DeadlineSource): CalendarEntry | null {
  if (!page.due_at) return null;
  return {
    id: `homework-${page.id}`,
    title: page.title,
    description: '',
    event_type: 'homework',
    scheduled_at: page.due_at,
    duration_minutes: 0,
    meeting_url: '',
    group_id: null,
    group_ids: page.group_ids ?? [],
    lesson_page_id: null,
    created_by: null,
    created_at: page.updated_at ?? page.due_at,
    updated_at: page.updated_at ?? page.due_at,
    homeworkPageId: page.id,
    homeworkPublished: page.is_published ?? true,
    homeworkMaxScore: page.max_score,
  };
}

/** Группы события; у строк до появления group_ids — из старой group_id. */
export function eventGroupIds(event: Pick<ScheduleEvent, 'group_ids' | 'group_id'>): string[] {
  return event.group_ids ?? (event.group_id ? [event.group_id] : []);
}

/** Дата события в поле «дата» (YYYY-MM-DD) по часам браузера. */
export function toLocalDateValue(iso: string) {
  return toDatetimeLocalValue(iso).slice(0, 10);
}

/** События расписания вместе с дедлайнами ДЗ. */
export function buildCalendar(events: ScheduleEvent[], homework: DeadlineSource[]): CalendarEntry[] {
  const deadlines = homework
    .map(homeworkDeadlineEntry)
    .filter((entry): entry is CalendarEntry => entry !== null);
  return [...events, ...deadlines];
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const timeFmt = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});

export function formatEventDate(iso: string) {
  return dateFmt.format(new Date(iso));
}

export function formatEventTime(iso: string) {
  return timeFmt.format(new Date(iso));
}

export function formatEventDateTime(iso: string) {
  const d = new Date(iso);
  return `${dateFmt.format(d)}, ${timeFmt.format(d)}`;
}

/** «17:00–18:30»; без длительности — просто время начала. */
export function formatTimeRange(iso: string, durationMinutes = 0) {
  const start = new Date(iso);
  if (!durationMinutes) return timeFmt.format(start);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return `${timeFmt.format(start)}–${timeFmt.format(end)}`;
}

/**
 * Заголовок дня в списке: «понедельник, 12 октября» и, если близко,
 * «Сегодня»/«Завтра»/«Вчера». Год — только у дней не текущего года.
 */
export function formatDayHeading(iso: string, now = new Date()) {
  const d = new Date(iso);
  const diff = daysFromToday(d, now);
  const relative = diff === 0 ? 'Сегодня' : diff === 1 ? 'Завтра' : diff === -1 ? 'Вчера' : null;
  const year = d.getFullYear() === now.getFullYear() ? '' : ` ${d.getFullYear()}`;
  return { relative, label: `${dateFmt.format(d)}${year}` };
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function groupEventsByDate<T extends { scheduled_at: string }>(events: T[]) {
  const map = new Map<string, T[]>();
  for (const event of events) {
    const key = new Date(event.scheduled_at).toDateString();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(event);
  }
  return Array.from(map.entries()).map(([key, items]) => ({
    dateKey: key,
    dateLabel: formatEventDate(items[0].scheduled_at),
    items,
  }));
}

export function getRefDayStartMs(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function getEventEndMs(scheduledAt: string, durationMinutes = 0) {
  return new Date(scheduledAt).getTime() + durationMinutes * 60_000;
}

export function formatRefDayLabel(date: Date) {
  return dateFmt.format(date);
}

export type ScheduleListFilter = 'all' | 'upcoming' | 'past';

/** Фильтр списка: «Все» — по дню; «Предст./Прош.» — относительно сегодня или выбранной даты. */
export function eventMatchesScheduleFilter(
  event: { scheduled_at: string; duration_minutes: number },
  filter: ScheduleListFilter,
  selectedDate: Date | null,
): boolean {
  if (filter === 'all') {
    if (!selectedDate) return true;
    const d = new Date(event.scheduled_at);
    return (
      d.getFullYear() === selectedDate.getFullYear() &&
      d.getMonth() === selectedDate.getMonth() &&
      d.getDate() === selectedDate.getDate()
    );
  }

  if (selectedDate) {
    const refStart = getRefDayStartMs(selectedDate);
    if (filter === 'upcoming') {
      return new Date(event.scheduled_at).getTime() >= refStart;
    }
    return getEventEndMs(event.scheduled_at, event.duration_minutes) < refStart;
  }

  if (filter === 'upcoming') {
    return isEventActive(event.scheduled_at, event.duration_minutes);
  }
  return isEventEnded(event.scheduled_at, event.duration_minutes);
}

export function getScheduleEmptyMessage(
  filter: ScheduleListFilter,
  selectedDate: Date | null,
  entityLabel: 'событий' | 'занятий' = 'событий',
) {
  const refLabel = selectedDate ? formatRefDayLabel(selectedDate) : null;

  if (filter === 'upcoming') {
    if (refLabel) return `Нет предстоящих ${entityLabel} с ${refLabel}`;
    return `Нет предстоящих ${entityLabel}`;
  }
  if (filter === 'past') {
    if (refLabel) return `Нет прошедших ${entityLabel} до ${refLabel}`;
    return `Нет прошедших ${entityLabel}`;
  }
  if (selectedDate) return `Нет ${entityLabel} на эту дату`;
  return 'Событий пока нет';
}

export function getScheduleRefHint(filter: ScheduleListFilter, selectedDate: Date | null) {
  if (filter === 'all') return null;
  if (selectedDate) return `Показано относительно ${formatRefDayLabel(selectedDate)}`;
  return 'Относительно сегодня · выберите дату в календаре';
}

/** Событие полностью завершилось (учитывается длительность). */
export function isEventEnded(scheduledAt: string, durationMinutes = 0) {
  return Date.now() >= getEventEndMs(scheduledAt, durationMinutes);
}

/** Событие идёт прямо сейчас. */
export function isEventOngoing(scheduledAt: string, durationMinutes: number) {
  const start = new Date(scheduledAt).getTime();
  const now = Date.now();
  return now >= start && now < getEventEndMs(scheduledAt, durationMinutes);
}

/** Ещё не закончилось (не началось или идёт сейчас). */
export function isEventActive(scheduledAt: string, durationMinutes = 0) {
  return !isEventEnded(scheduledAt, durationMinutes);
}

/** @deprecated Используйте isEventActive — учитывает длительность при втором аргументе. */
export function isEventUpcoming(scheduledAt: string, durationMinutes = 0) {
  return isEventActive(scheduledAt, durationMinutes);
}

/** Предстоящие — по возрастанию даты, затем прошедшие — от недавних к старым. */
export function sortScheduleEventsForList<T extends { scheduled_at: string; duration_minutes?: number }>(
  events: T[],
): T[] {
  const active = events
    .filter((e) => isEventActive(e.scheduled_at, e.duration_minutes ?? 0))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const past = events
    .filter((e) => isEventEnded(e.scheduled_at, e.duration_minutes ?? 0))
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
  return [...active, ...past];
}

export function sortScheduleEventsAscending<T extends { scheduled_at: string }>(events: T[]): T[] {
  return [...events].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
  );
}

export function sortScheduleEventsDescending<T extends { scheduled_at: string }>(events: T[]): T[] {
  return [...events].sort(
    (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime(),
  );
}
