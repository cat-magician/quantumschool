import type { ScheduleEventType } from './types';

export const EVENT_TYPE_LABELS: Record<ScheduleEventType, string> = {
  lecture: 'Лекция',
  seminar: 'Семинар',
  webinar: 'Вебинар',
  homework: 'Домашнее задание',
  exam: 'Экзамен',
  consultation: 'Консультация',
};

export const EVENT_TYPE_OPTIONS: ScheduleEventType[] = [
  'lecture',
  'seminar',
  'webinar',
  'homework',
  'exam',
  'consultation',
];

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
