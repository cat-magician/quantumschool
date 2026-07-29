const YANDEX_DISK_HOSTS = ['disk.yandex.ru', 'disk.yandex.com', 'disk.360.yandex.ru', 'yadi.sk'];

const DIRECT_IMAGE = /\.(avif|bmp|gif|jpe?g|png|svg|webp)(\?|$)/i;

const downloadCache = new Map<string, { href: string; expires: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

export type YandexPublicResourceMeta = {
  name?: string;
  mime_type?: string;
  type?: 'file' | 'dir';
};

export function isYandexDiskUrl(url: string): boolean {
  try {
    const host = new URL(url.trim()).hostname.replace(/^www\./, '');
    return YANDEX_DISK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export function isDirectImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  if (isYandexDiskUrl(trimmed)) return false;
  return DIRECT_IMAGE.test(trimmed);
}

function publicKeyParam(publicUrl: string) {
  return encodeURIComponent(publicUrl.trim());
}

export async function fetchYandexPublicResourceMeta(publicUrl: string): Promise<YandexPublicResourceMeta> {
  const metaRes = await fetch(
    `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${publicKeyParam(publicUrl)}`,
  );
  if (!metaRes.ok) {
    throw new Error('Не удалось открыть файл на Яндекс.Диске. Проверьте, что ссылка публичная.');
  }
  return (await metaRes.json()) as YandexPublicResourceMeta;
}

/** Временная прямая ссылка на скачивание публичного файла. */
export async function fetchYandexPublicDownloadUrl(publicUrl: string): Promise<string> {
  const trimmed = publicUrl.trim();
  const cached = downloadCache.get(trimmed);
  if (cached && cached.expires > Date.now()) {
    return cached.href;
  }

  const dlRes = await fetch(
    `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${publicKeyParam(trimmed)}`,
  );
  if (!dlRes.ok) {
    throw new Error('Не удалось получить файл с Яндекс.Диска. Проверьте, что ссылка публичная.');
  }
  const data = (await dlRes.json()) as { href?: string };
  if (!data.href) throw new Error('Яндекс.Диск не вернул прямую ссылку на файл');

  downloadCache.set(trimmed, { href: data.href, expires: Date.now() + CACHE_TTL_MS });
  return data.href;
}

async function fetchYandexPublicImageUrl(publicUrl: string): Promise<string> {
  const metaRes = await fetch(
    `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${publicKeyParam(publicUrl)}&preview_size=XXXL`,
  );
  if (metaRes.ok) {
    const meta = (await metaRes.json()) as { preview?: string; mime_type?: string };
    if (meta.preview && meta.mime_type?.startsWith('image/')) {
      return meta.preview;
    }
  }

  return fetchYandexPublicDownloadUrl(publicUrl);
}

/** Прямая ссылка на картинку или временный URL для публичного файла на Я.Диске. */
export async function resolveCoverImageUrl(rawUrl: string): Promise<string> {
  const trimmed = rawUrl.trim();
  if (!trimmed) throw new Error('Пустая ссылка');

  if (!isYandexDiskUrl(trimmed)) {
    return trimmed;
  }

  return fetchYandexPublicImageUrl(trimmed);
}
