export function lessonPageLoadError(message?: string | null): string | null {
  if (!message) return null;
  if (
    message.includes('lesson_pages')
    || message.includes('lesson_page_blocks')
    || message.includes('schema cache')
  ) {
    return 'Таблицы страниц занятий не настроены. Запустите supabase/schema.sql (миграция 023).';
  }
  return message;
}

export function lessonPageSaveError(
  error: { message?: string } | null | undefined,
  fallback: string,
): string {
  return lessonPageLoadError(error?.message) ?? fallback;
}
