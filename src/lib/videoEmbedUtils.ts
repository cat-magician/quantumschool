export type VideoEmbedResult =
  | { kind: 'embed'; embedUrl: string }
  | { kind: 'link'; url: string };

function youtubeEmbed(url: URL): VideoEmbedResult | null {
  let id = url.searchParams.get('v');
  if (!id && url.hostname === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0];
  }
  if (!id) return null;
  return { kind: 'embed', embedUrl: `https://www.youtube.com/embed/${id}` };
}

function rutubeEmbed(url: URL): VideoEmbedResult | null {
  const match = url.pathname.match(/\/video\/([a-f0-9-]+)/i);
  if (!match) return null;
  return { kind: 'embed', embedUrl: `https://rutube.ru/play/embed/${match[1]}` };
}

function vkEmbed(url: URL): VideoEmbedResult | null {
  const match = url.pathname.match(/\/video(-?\d+)_(\d+)/);
  if (!match) return null;
  const oid = match[1];
  const id = match[2];
  return {
    kind: 'embed',
    embedUrl: `https://vk.com/video_ext.php?oid=${oid}&id=${id}&hd=2`,
  };
}

export function resolveVideoEmbed(rawUrl: string): VideoEmbedResult | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com') {
      return youtubeEmbed(url);
    }
    if (host === 'rutube.ru') {
      return rutubeEmbed(url);
    }
    if (host === 'vk.com' || host === 'vkvideo.ru') {
      return vkEmbed(url);
    }

    return { kind: 'link', url: url.toString() };
  } catch {
    return null;
  }
}
