export function homeworkLoadError(message?: string | null): string | null {
  if (!message) return null;
  if (message.includes('homework_assignments') || message.includes('schema cache')) {
    return 'Таблица домашних заданий не настроена. Запустите в Supabase SQL Editor миграцию 013_homework_learning.sql или apply_all.sql.';
  }
  return message;
}
