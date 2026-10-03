import { supabase } from './supabase';
import type { HomeworkPage } from './types';
import { HOMEWORK_SUBMISSION_STATUS_COLUMNS, type HomeworkSubmissionStatus } from './progressUtils';

/** Опубликованное ДЗ — поля, которые нужны счётчику, главной и уведомлениям. */
export type PublishedHomeworkPage = Pick<HomeworkPage, 'id' | 'title' | 'due_at' | 'max_score' | 'updated_at'>;

export type OwnHomeworkSubmission = HomeworkSubmissionStatus & { id: string };

export type StudentHomeworkData = {
  pages: PublishedHomeworkPage[];
  submissions: OwnHomeworkSubmission[];
};

/**
 * Опубликованные ДЗ и сдачи ученика. При открытии кабинета их разом просят
 * счётчик в меню, главная и уведомления, и пока запрос в пути, все получают
 * один ответ вместо трёх пар запросов. Готовый ответ не хранится: следующий
 * вызов (после сдачи ДЗ, при возврате на главную) идёт за свежими данными.
 *
 * Без withPages — только сдачи: незачисленному ДЗ всё равно не видны.
 */
const inFlight = new Map<string, Promise<StudentHomeworkData>>();

export function loadStudentHomework(
  userId: string,
  { withPages = true }: { withPages?: boolean } = {},
): Promise<StudentHomeworkData> {
  const key = `${userId}|${withPages}`;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = Promise.all([
    withPages
      ? supabase
          .from('homework_pages')
          .select('id, title, due_at, max_score, updated_at')
          .eq('is_published', true)
      : Promise.resolve({ data: [] }),
    supabase
      .from('homework_page_submissions')
      .select(`id, ${HOMEWORK_SUBMISSION_STATUS_COLUMNS}`)
      .eq('user_id', userId),
  ])
    .then(([pagesRes, subsRes]) => ({
      pages: (pagesRes.data ?? []) as PublishedHomeworkPage[],
      submissions: (subsRes.data ?? []) as OwnHomeworkSubmission[],
    }))
    .finally(() => inFlight.delete(key));

  inFlight.set(key, request);
  return request;
}
