export function lessonPageLoadError(message?: string | null): string | null {
  if (!message) return null;
  if (
    message.includes('Load failed')
    || message.includes('Failed to fetch')
    || message.includes('NetworkError')
    || message.includes('Network request failed')
  ) {
    return 'Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз.';
  }
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

export function isSaveSuccessMessage(message: string): boolean {
  return (
    message.includes('Сохран')
    || message.includes('опубликован')
    || message.includes('Снято')
  );
}
