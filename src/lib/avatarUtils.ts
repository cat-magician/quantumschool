import { supabase } from './supabase';

export const AVATAR_BUCKET = 'avatars';
export const AVATAR_MAX_BYTES = 512 * 1024;
export const AVATAR_OUTPUT_SIZE = 256;
export const AVATAR_CROP_UI_SIZE = 280;
export const AVATAR_INPUT_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp';
export const AVATAR_HINT = 'JPG, PNG или WebP · до 2 МБ · до 512 КБ после сохранения';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function translateAvatarStorageError(message: string): string {
  if (message.includes('Bucket not found')) {
    return 'Хранилище аватарок не создано. В Supabase SQL Editor выполните supabase/schema.sql (или перезапустите его, если схема уже ставилась раньше).';
  }
  if (message.includes('row-level security')) {
    return 'Нет прав на загрузку аватара. В Supabase выполните обновлённые политики storage для bucket avatars (см. supabase/schema.sql).';
  }
  return message;
}

export type AvatarCropState = {
  offsetX: number;
  offsetY: number;
  coverScale: number;
};

export function avatarObjectPath(userId: string, ext = 'webp') {
  return `${userId}/avatar.${ext}`;
}

export function validateAvatarInput(file: File): string | null {
  if (!ALLOWED_MIME.has(file.type)) {
    return 'Поддерживаются JPG, PNG и WebP';
  }
  if (file.size > AVATAR_INPUT_MAX_BYTES) {
    return 'Файл слишком большой (до 2 МБ)';
  }
  return null;
}

export function baseCoverScale(imageWidth: number, imageHeight: number, cropSize: number) {
  return Math.max(cropSize / imageWidth, cropSize / imageHeight);
}

export function createCropState(
  imageWidth: number,
  imageHeight: number,
  cropSize: number,
  zoom = 1,
): AvatarCropState {
  const coverScale = baseCoverScale(imageWidth, imageHeight, cropSize) * zoom;
  return clampCropOffset(imageWidth, imageHeight, cropSize, coverScale, {
    offsetX: (cropSize - imageWidth * coverScale) / 2,
    offsetY: (cropSize - imageHeight * coverScale) / 2,
    coverScale,
  });
}

export function clampCropOffset(
  imageWidth: number,
  imageHeight: number,
  cropSize: number,
  coverScale: number,
  crop: Pick<AvatarCropState, 'offsetX' | 'offsetY' | 'coverScale'> | AvatarCropState,
): AvatarCropState {
  const displayW = imageWidth * coverScale;
  const displayH = imageHeight * coverScale;
  const minX = Math.min(0, cropSize - displayW);
  const minY = Math.min(0, cropSize - displayH);
  return {
    coverScale,
    offsetX: Math.min(0, Math.max(minX, crop.offsetX)),
    offsetY: Math.min(0, Math.max(minY, crop.offsetY)),
  };
}

export function cropStateForZoom(
  imageWidth: number,
  imageHeight: number,
  cropSize: number,
  zoom: number,
  prev: AvatarCropState,
): AvatarCropState {
  const centerX = cropSize / 2;
  const centerY = cropSize / 2;
  const imageX = (centerX - prev.offsetX) / prev.coverScale;
  const imageY = (centerY - prev.offsetY) / prev.coverScale;
  const coverScale = baseCoverScale(imageWidth, imageHeight, cropSize) * zoom;
  return clampCropOffset(imageWidth, imageHeight, cropSize, coverScale, {
    coverScale,
    offsetX: centerX - imageX * coverScale,
    offsetY: centerY - imageY * coverScale,
  });
}

async function clearUserAvatarFiles(userId: string) {
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).list(userId);
  if (error || !data?.length) return;
  await supabase.storage.from(AVATAR_BUCKET).remove(data.map((f) => `${userId}/${f.name}`));
}

async function blobToFile(blob: Blob, name: string, type: string): Promise<File> {
  return new File([blob], name, { type });
}

async function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/webp', quality);
  });
}

async function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality);
  });
}

async function compressCanvasToAvatarFile(canvas: HTMLCanvasElement): Promise<{ file?: File; error?: string }> {
  for (const quality of [0.85, 0.7, 0.55]) {
    const webp = await canvasToWebp(canvas, quality);
    if (webp && webp.size <= AVATAR_MAX_BYTES) {
      return { file: await blobToFile(webp, 'avatar.webp', 'image/webp') };
    }
  }

  for (const quality of [0.85, 0.7, 0.55]) {
    const jpeg = await canvasToJpeg(canvas, quality);
    if (jpeg && jpeg.size <= AVATAR_MAX_BYTES) {
      return { file: await blobToFile(jpeg, 'avatar.jpg', 'image/jpeg') };
    }
  }

  return { error: 'Не удалось сжать изображение до 512 КБ' };
}

export async function renderCroppedAvatarFile(
  source: CanvasImageSource & { width: number; height: number },
  crop: AvatarCropState,
  cropSize = AVATAR_CROP_UI_SIZE,
  outputSize = AVATAR_OUTPUT_SIZE,
): Promise<{ file?: File; error?: string }> {
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { error: 'Не удалось обработать изображение' };
  }

  const srcSize = cropSize / crop.coverScale;
  const srcX = -crop.offsetX / crop.coverScale;
  const srcY = -crop.offsetY / crop.coverScale;

  ctx.drawImage(source, srcX, srcY, srcSize, srcSize, 0, 0, outputSize, outputSize);
  return compressCanvasToAvatarFile(canvas);
}

export async function uploadProfileAvatar(userId: string, file: File): Promise<{ url: string | null; error: string | null }> {
  if (file.size > AVATAR_MAX_BYTES) {
    return { url: null, error: 'Файл слишком большой после сжатия' };
  }

  const ext = file.name.endsWith('.jpg') ? 'jpg' : 'webp';
  const path = avatarObjectPath(userId, ext);

  await clearUserAvatarFiles(userId);

  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type,
  });

  if (uploadError) {
    return { url: null, error: translateAvatarStorageError(uploadError.message) };
  }

  const { data: { publicUrl } } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const versionedUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: dbError } = await supabase
    .from('user_profiles')
    .update({ avatar_url: versionedUrl })
    .eq('id', userId);

  if (dbError) {
    return { url: null, error: dbError.message };
  }

  return { url: versionedUrl, error: null };
}

export async function removeProfileAvatar(userId: string): Promise<{ error: string | null }> {
  await clearUserAvatarFiles(userId);

  const { error } = await supabase
    .from('user_profiles')
    .update({ avatar_url: '' })
    .eq('id', userId);

  return { error: error?.message ?? null };
}
