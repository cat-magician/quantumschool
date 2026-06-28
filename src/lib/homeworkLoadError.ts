export function homeworkLoadError(message?: string | null): string | null {
  if (!message) return null;
  if (message.includes('homework_assignments') || message.includes('schema cache')) {
    return 'Таблица домашних заданий не настроена. Запустите supabase/schema.sql в Supabase SQL Editor.';
  }
  return message;
}
