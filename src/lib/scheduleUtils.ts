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

export function isEventUpcoming(scheduledAt: string) {
  return new Date(scheduledAt) >= new Date();
}
