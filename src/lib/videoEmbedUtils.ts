export type VideoEmbedResult =
  | { kind: 'embed'; embedUrl: string }
  | { kind: 'link'; url: string };

/** «90», «90s», «1m30s», «1h2m3s» → секунды; что не разобрали — null. */
function parseStartSeconds(raw: string | null): number | null {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw) || null;
  const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match || !match[0]) return null;
  const [, h = '0', m = '0', s = '0'] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s) || null;
}

const YOUTUBE_ID = /^[\w-]{6,}$/;

function youtubeEmbed(url: URL, host: string): VideoEmbedResult | null {
  let id = url.searchParams.get('v');
  if (!id && host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  if (!id) {
    // Трансляции (/live/) — так выглядят ссылки на записи эфиров, — shorts,
    // уже встроенные ссылки.
    const match = url.pathname.match(/^\/(?:live|shorts|embed|v)\/([\w-]+)/);
    id = match?.[1] ?? null;
  }
  if (!id || !YOUTUBE_ID.test(id)) return null;

  const start = parseStartSeconds(url.searchParams.get('t') ?? url.searchParams.get('start'));
  return { kind: 'embed', embedUrl: `https://www.youtube.com/embed/${id}${start ? `?start=${start}` : ''}` };
}

function rutubeEmbed(url: URL): VideoEmbedResult | null {
  // /video/<id>/, /video/private/<id>/?p=…, /play/embed/<id>, /shorts/<id>/
  const match = url.pathname.match(/^\/(?:video\/(?:private\/)?|play\/embed\/|shorts\/)([a-z0-9]{8,})/i);
  if (!match) return null;
  // Ключ закрытого ролика: без него плеер отвечает «нет доступа».
  const key = url.searchParams.get('p');
  return {
    kind: 'embed',
    embedUrl: `https://rutube.ru/play/embed/${match[1]}/${key ? `?p=${encodeURIComponent(key)}` : ''}`,
  };
}

function vkEmbed(url: URL, host: string): VideoEmbedResult | null {
  // Код встраивания: …/video_ext.php?oid=-123&id=456&hash=…. hash — пропуск
  // для зрителей, не вошедших в VK: без него плеер отвечает им «Видео
  // недоступно», с чужим — «Видеофайл не найден». Взять его можно только из
  // «Поделиться → Экспортировать» (или API VK с токеном), из ссылки — никак.
  if (url.pathname === '/video_ext.php') {
    const oid = url.searchParams.get('oid');
    const id = url.searchParams.get('id');
    if (!oid || !id || !/^-?\d+$/.test(oid) || !/^\d+$/.test(id)) return null;
    // Плеер — на том же сервисе, откуда код (vk.com или vkvideo.ru), без «m.».
    const playerHost = host.replace(/^m\./, '') === 'vkvideo.ru' ? 'vkvideo.ru' : 'vk.com';
    const embed = new URL(`https://${playerHost}/video_ext.php`);
    embed.searchParams.set('oid', oid);
    embed.searchParams.set('id', id);
    const hash = url.searchParams.get('hash');
    if (hash) embed.searchParams.set('hash', hash);
    embed.searchParams.set('hd', url.searchParams.get('hd') ?? '2');
    return { kind: 'embed', embedUrl: embed.toString() };
  }

  // Обычная ссылка: /video-123_456, /clip-123_456 или ?z=video-123_456/…
  const source = `${url.pathname} ${url.searchParams.get('z') ?? ''}`;
  const match = source.match(/(?:video|clip)(-?\d+)_(\d+)/);
  if (!match) return null;
  return { kind: 'embed', embedUrl: `https://vk.com/video_ext.php?oid=${match[1]}&id=${match[2]}&hd=2` };
}

const YOUTUBE_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com']);
const RUTUBE_HOSTS = new Set(['rutube.ru', 'm.rutube.ru']);
const VK_HOSTS = new Set(['vk.com', 'm.vk.com', 'vk.ru', 'm.vk.ru', 'vkvideo.ru', 'm.vkvideo.ru']);

/**
 * Ссылка на запись или код встраивания целиком (<iframe src="…">): сотрудники
 * копируют из «Поделиться» то одно, то другое.
 */
export function resolveVideoEmbed(rawUrl: string): VideoEmbedResult | null {
  let trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const iframeSrc = trimmed.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  if (iframeSrc) trimmed = iframeSrc[1].replace(/&amp;/g, '&');
  if (trimmed.startsWith('//')) trimmed = `https:${trimmed}`;

  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, '');

    if (YOUTUBE_HOSTS.has(host)) return youtubeEmbed(url, host);
    if (RUTUBE_HOSTS.has(host)) return rutubeEmbed(url);
    if (VK_HOSTS.has(host)) return vkEmbed(url, host);

    return { kind: 'link', url: url.toString() };
  } catch {
    return null;
  }
}
