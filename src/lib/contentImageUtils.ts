import { supabase } from './supabase';

export const CONTENT_IMAGE_BUCKET = 'site-images';
export const CONTENT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
export const CONTENT_IMAGE_INPUT_MAX_BYTES = 5 * 1024 * 1024;
export const CONTENT_IMAGE_OUTPUT_MAX_BYTES = 1.5 * 1024 * 1024;
export const CONTENT_IMAGE_MAX_DIMENSION = 1920;
export const CONTENT_IMAGE_HINT = 'JPG, PNG, WebP или GIF · до 5 МБ · можно также вставить ссылку';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function translateContentImageStorageError(message: string): string {
  if (message.includes('Bucket not found')) {
    return 'Хранилище изображений не создано. Выполните supabase/schema.sql в Supabase SQL Editor.';
  }
  if (message.includes('row-level security')) {
    return 'Нет прав на загрузку. Доступно только преподавателям и администраторам.';
  }
  return message;
}

function contentImageObjectPath(userId: string, ext: string) {
  const id = crypto.randomUUID();
  return `${userId}/${id}.${ext}`;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать изображение'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function prepareContentImageFile(file: File): Promise<{ file?: File; error?: string }> {
  if (file.type === 'image/gif') {
    if (file.size > CONTENT_IMAGE_OUTPUT_MAX_BYTES) {
      return { error: 'GIF слишком большой (до 1,5 МБ). Сожмите файл или используйте JPG/PNG.' };
    }
    return { file };
  }

  let image: HTMLImageElement;
  try {
    image = await loadImageFromFile(file);
  } catch {
    return { error: 'Не удалось прочитать изображение' };
  }

  const scale = Math.min(
    1,
    CONTENT_IMAGE_MAX_DIMENSION / image.width,
    CONTENT_IMAGE_MAX_DIMENSION / image.height,
  );
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { error: 'Не удалось обработать изображение' };

  ctx.drawImage(image, 0, 0, width, height);

  for (const quality of [0.88, 0.75, 0.62, 0.5]) {
    const webp = await canvasToBlob(canvas, 'image/webp', quality);
    if (webp && webp.size <= CONTENT_IMAGE_OUTPUT_MAX_BYTES) {
      return { file: new File([webp], 'image.webp', { type: 'image/webp' }) };
    }
  }

  for (const quality of [0.88, 0.75, 0.62, 0.5]) {
    const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (jpeg && jpeg.size <= CONTENT_IMAGE_OUTPUT_MAX_BYTES) {
      return { file: new File([jpeg], 'image.jpg', { type: 'image/jpeg' }) };
    }
  }

  return { error: 'Не удалось сжать изображение до 1,5 МБ' };
}

export function validateContentImageInput(file: File): string | null {
  if (!ALLOWED_MIME.has(file.type)) {
    return 'Поддерживаются JPG, PNG, WebP и GIF';
  }
  if (file.size > CONTENT_IMAGE_INPUT_MAX_BYTES) {
    return 'Файл слишком большой (до 5 МБ)';
  }
  return null;
}

export async function uploadContentImage(
  userId: string,
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  const validationError = validateContentImageInput(file);
  if (validationError) return { url: null, error: validationError };

  const prepared = await prepareContentImageFile(file);
  if (prepared.error || !prepared.file) {
    return { url: null, error: prepared.error ?? 'Не удалось подготовить файл' };
  }

  const ext = prepared.file.type === 'image/jpeg'
    ? 'jpg'
    : prepared.file.type === 'image/png'
      ? 'png'
      : prepared.file.type === 'image/gif'
        ? 'gif'
        : 'webp';
  const path = contentImageObjectPath(userId, ext);

  const { error: uploadError } = await supabase.storage.from(CONTENT_IMAGE_BUCKET).upload(path, prepared.file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: prepared.file.type,
  });

  if (uploadError) {
    return { url: null, error: translateContentImageStorageError(uploadError.message) };
  }

  const { data: { publicUrl } } = supabase.storage.from(CONTENT_IMAGE_BUCKET).getPublicUrl(path);
  return { url: publicUrl, error: null };
}
