import { supabase } from './supabase';

export const LESSON_DOCUMENT_BUCKET = 'lesson-documents';
export const LESSON_DOCUMENT_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/gif';
export const LESSON_DOCUMENT_INPUT_MAX_BYTES = 20 * 1024 * 1024;
export const LESSON_DOCUMENT_HINT =
  'PDF или картинка · до 20 МБ · можно также вставить ссылку на Яндекс.Диск';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function translateDocumentStorageError(message: string): string {
  if (message.includes('Bucket not found')) {
    return 'Хранилище документов не создано. Выполните supabase/schema.sql в Supabase SQL Editor.';
  }
  if (message.includes('row-level security')) {
    return 'Нет прав на загрузку. Доступно только преподавателям и администраторам.';
  }
  return message;
}

function documentObjectPath(userId: string, ext: string) {
  return `${userId}/${crypto.randomUUID()}.${ext}`;
}

function extFromMime(mime: string): string {
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/gif') return 'gif';
  return 'webp';
}

export function isSupabaseLessonDocumentUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed.includes('/storage/v1/object/public/lesson-documents/')) return false;
  return /^https?:\/\//i.test(trimmed);
}

export function validateLessonDocumentInput(file: File): string | null {
  if (!ALLOWED_MIME.has(file.type)) {
    return 'Поддерживаются PDF, JPG, PNG, WebP и GIF';
  }
  if (file.size > LESSON_DOCUMENT_INPUT_MAX_BYTES) {
    return 'Файл слишком большой (до 20 МБ)';
  }
  return null;
}

export async function uploadLessonDocument(
  userId: string,
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  const validationError = validateLessonDocumentInput(file);
  if (validationError) return { url: null, error: validationError };

  const ext = extFromMime(file.type);
  const path = documentObjectPath(userId, ext);

  const { error: uploadError } = await supabase.storage.from(LESSON_DOCUMENT_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type,
  });

  if (uploadError) {
    return { url: null, error: translateDocumentStorageError(uploadError.message) };
  }

  const { data: { publicUrl } } = supabase.storage.from(LESSON_DOCUMENT_BUCKET).getPublicUrl(path);
  return { url: publicUrl, error: null };
}

export function looksLikeImageDocumentUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) return false;
  return /\.(avif|bmp|gif|jpe?g|png|svg|webp)(\?|#|$)/i.test(trimmed);
}
