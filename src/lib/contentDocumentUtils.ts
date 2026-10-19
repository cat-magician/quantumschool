import { supabase } from './supabase';

export const LESSON_DOCUMENT_BUCKET = 'lesson-documents';
export const LESSON_DOCUMENT_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/gif';
/** Больше этого бесплатный тариф Supabase в один файл не принимает. */
export const LESSON_DOCUMENT_INPUT_MAX_BYTES = 50 * 1024 * 1024;
export const LESSON_DOCUMENT_HINT =
  'PDF и картинки до 50 МБ, можно несколько сразу — сайт сам сожмёт их перед загрузкой';

/** Фото и сканы, загруженные картинкой: длинная сторона до 2400 px. */
const DOCUMENT_IMAGE_MAX_SIDE = 2400;
const DOCUMENT_IMAGE_QUALITY = 0.8;
/** Небольшую картинку, которая и так в пределах размера, не пережимаем. */
const DOCUMENT_IMAGE_KEEP_BYTES = 1.5 * 1024 * 1024;

export type DocumentUploadProgress =
  | { stage: 'compress'; done: number; total: number }
  | { stage: 'upload' };

export type DocumentUploadResult =
  | { url: string; error: null; size: number; originalSize: number }
  | { url: null; error: string };

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
    return 'Файл слишком большой (до 50 МБ)';
  }
  return null;
}

/**
 * Загрузка с сжатием: место в хранилище и трафик учеников считаются по
 * сжатому файлу. Сжатие не удалось или не уменьшило файл — грузим исходный.
 */
export async function uploadLessonDocument(
  userId: string,
  file: File,
  onProgress?: (progress: DocumentUploadProgress) => void,
): Promise<DocumentUploadResult> {
  const validationError = validateLessonDocumentInput(file);
  if (validationError) return { url: null, error: validationError };

  onProgress?.({ stage: 'compress', done: 0, total: 0 });
  const prepared = await prepareLessonDocument(file, onProgress);

  onProgress?.({ stage: 'upload' });
  const path = documentObjectPath(userId, extFromMime(prepared.type));
  const { error: uploadError } = await supabase.storage.from(LESSON_DOCUMENT_BUCKET).upload(path, prepared, {
    cacheControl: '31536000',
    upsert: false,
    contentType: prepared.type,
  });

  if (uploadError) {
    return { url: null, error: translateDocumentStorageError(uploadError.message) };
  }

  const { data: { publicUrl } } = supabase.storage.from(LESSON_DOCUMENT_BUCKET).getPublicUrl(path);
  return { url: publicUrl, error: null, size: prepared.size, originalSize: file.size };
}

async function prepareLessonDocument(
  file: File,
  onProgress?: (progress: DocumentUploadProgress) => void,
): Promise<Blob> {
  try {
    if (file.type === 'application/pdf') {
      const { compressPdf } = await import('./pdfCompress');
      const compressed = await compressPdf(
        new Uint8Array(await file.arrayBuffer()),
        (done, total) => onProgress?.({ stage: 'compress', done, total }),
      );
      return compressed ? new Blob([compressed], { type: 'application/pdf' }) : file;
    }
    // GIF может быть анимацией — его не трогаем.
    if (file.type !== 'image/gif') return (await compressDocumentImage(file)) ?? file;
  } catch {
    // Не сжалось — исходный файл тоже годится, до 50 МБ его примут.
  }
  return file;
}

/** Фото тетради или скан картинкой: уменьшаем и пережимаем в JPEG. */
async function compressDocumentImage(file: File): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, DOCUMENT_IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= DOCUMENT_IMAGE_KEEP_BYTES) return null;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // Прозрачный PNG в JPEG — на белом, как на бумаге.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const jpeg = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', DOCUMENT_IMAGE_QUALITY);
    });
    return jpeg && jpeg.size < file.size ? jpeg : null;
  } finally {
    bitmap.close();
  }
}

/** «6,1 МБ», «850 КБ». */
export function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

/**
 * «Листок_3. Кубиты.pdf» → «Листок 3. Кубиты». В хранилище файл лежит под
 * случайным именем, поэтому заголовок документа берём из имени, с которым его
 * загрузили.
 */
export function documentTitleFromFileName(name: string): string {
  return name
    .replace(/\.(pdf|jpe?g|png|webp|gif)$/i, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function looksLikeImageDocumentUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) return false;
  return /\.(avif|bmp|gif|jpe?g|png|svg|webp)(\?|#|$)/i.test(trimmed);
}
