import type { ScheduleEvent } from './types';
import type { OwnHomeworkSubmission, PublishedHomeworkPage } from './studentHomeworkData';

/**
 * Последнее загруженное расписание ученика: вкладка «Расписание» открывается
 * сразу, а свежие данные подтягиваются уже в фоне. Главная грузит те же
 * события и ДЗ (их сроки — дедлайны в календаре), так что и первое открытие
 * вкладки не ждёт сети.
 *
 * Только в памяти и с привязкой к аккаунту: выйдет один человек и войдёт
 * другой — чужие события (со ссылками на занятия групп) не покажутся.
 */
type StudentSchedule = {
  events: ScheduleEvent[];
  homework: PublishedHomeworkPage[] | null;
  /** Сдачи ученика — карточка дедлайна показывает, сдано ли задание. */
  submissions: OwnHomeworkSubmission[] | null;
};

let cached: { userId: string; schedule: StudentSchedule } | null = null;

/**
 * Один запрос на главную и вкладку: со страницей занятия (обложка, тип).
 * Ученику страница приходит, только если опубликована и видна.
 */
export const STUDENT_SCHEDULE_SELECT =
  '*, lesson_page:lesson_pages(id, lesson_type, is_published, title, cover_url)';

/**
 * Лекция или семинар со страницей — одно занятие, и пока страница черновик,
 * ученик его не видит. Страницу ученику отдаёт только опубликованной, так что
 * событие со ссылкой на страницу, но без неё самой, — черновик. Политика
 * базы прячет такие события сама; здесь — на случай, если schema.sql ещё не
 * применили.
 */
export function visibleStudentEvents(events: ScheduleEvent[]): ScheduleEvent[] {
  return events.filter((e) => !e.lesson_page_id || e.lesson_page);
}

export function cachedStudentSchedule(userId: string): StudentSchedule | null {
  return cached?.userId === userId ? cached.schedule : null;
}

export function rememberStudentSchedule(userId: string, patch: Partial<StudentSchedule>): void {
  const base = cachedStudentSchedule(userId) ?? { events: [], homework: null, submissions: null };
  cached = { userId, schedule: { ...base, ...patch } };
}
