import type { ScheduleEvent } from './types';

/**
 * Последнее загруженное расписание ученика: вкладка «Расписание» открывается
 * сразу, а свежие данные подтягиваются уже в фоне. Главная грузит те же
 * события, так что и первое открытие вкладки не ждёт сети.
 *
 * Только в памяти и с привязкой к аккаунту: выйдет один человек и войдёт
 * другой — чужие события (со ссылками на занятия групп) не покажутся.
 */
let cached: { userId: string; events: ScheduleEvent[] } | null = null;

/** Один запрос на главную и вкладку, чтобы в кэше были и названия групп. */
export const STUDENT_SCHEDULE_SELECT = '*, group:groups(id, name)';

export function cachedStudentSchedule(userId: string): ScheduleEvent[] | null {
  return cached?.userId === userId ? cached.events : null;
}

export function rememberStudentSchedule(userId: string, events: ScheduleEvent[]): void {
  cached = { userId, events };
}
