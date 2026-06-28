export function homeworkPageLoadError(message?: string | null): string | null {
  if (!message) return null;
  if (
    message.includes('homework_pages')
    || message.includes('homework_page_blocks')
    || message.includes('homework_page_submissions')
    || message.includes('schema cache')
  ) {
    return 'Таблицы страниц домашних заданий не настроены. Запустите supabase/schema.sql (миграции 025–027).';
  }
  return message;
}

export function homeworkPageSaveError(
  error: { message?: string } | null | undefined,
  fallback: string,
): string {
  return homeworkPageLoadError(error?.message) ?? fallback;
}
