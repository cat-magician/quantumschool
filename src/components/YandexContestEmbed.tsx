import { normalizeContestUrl } from '../lib/selectionConfig';
import StageEmbedFrame from './StageEmbedFrame';

export function isContestEmbeddable(url: string): boolean {
  const normalized = normalizeContestUrl(url);
  if (!normalized) return false;
  try {
    const u = new URL(normalized);
    if (!u.hostname.includes('contest.yandex')) return false;
    const path = u.pathname.replace(/\/+$/, '');
    return path.length > 0;
  } catch {
    return false;
  }
}

/** Только встроенный iframe. Невалидная или «главная» ссылка — null (снаружи показывают BlockPlaceholder). */
export default function YandexContestEmbed({ url }: { url: string }) {
  const normalized = normalizeContestUrl(url);
  if (!normalized || !isContestEmbeddable(normalized)) return null;

  return (
    <StageEmbedFrame flush minHeight={420}>
      <iframe
        src={normalized}
        title="Яндекс.Контест — домашнее задание"
        frameBorder={0}
        className="block w-full border-0 bg-white"
        allow="clipboard-write"
      />
    </StageEmbedFrame>
  );
}
