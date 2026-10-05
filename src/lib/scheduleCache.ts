import type { ScheduleEvent } from './types';
import type { PublishedHomeworkPage } from './studentHomeworkData';

/**
 * Последнее загруженное расписание ученика: вкладка «Расписание» открывается
 * сразу, а свежие данные подтягиваются уже в фоне. Главная грузит те же
 * события и ДЗ (их сроки — дедлайны в календаре), так что и первое открытие
 * вкладки не ждёт сети.
 *
 * Только в памяти и с привязкой к аккаунту: выйдет один человек и войдёт
 * другой — чужие события (со ссылками на занятия групп) не покажутся.
 */
type StudentSchedule = { events: ScheduleEvent[]; homework: PublishedHomeworkPage[] | null };

let cached: { userId: string; schedule: StudentSchedule } | null = null;

/**
 * Один запрос на главную и вкладку: с названиями групп и страницей
 * материалов. Ученику страница приходит, только если опубликована и видна.
 */
export const STUDENT_SCHEDULE_SELECT =
  '*, group:groups(id, name), lesson_page:lesson_pages(id, lesson_type, is_published, title)';

export function cachedStudentSchedule(userId: string): StudentSchedule | null {
  return cached?.userId === userId ? cached.schedule : null;
}

export function rememberStudentSchedule(userId: string, patch: Partial<StudentSchedule>): void {
  const base = cachedStudentSchedule(userId) ?? { events: [], homework: null };
  cached = { userId, schedule: { ...base, ...patch } };
}
