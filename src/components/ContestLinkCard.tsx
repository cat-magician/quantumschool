import { ExternalLink } from 'lucide-react';
import StageEmbedFrame from './StageEmbedFrame';
import { normalizeContestUrl } from '../lib/selectionConfig';

/**
 * Карточка перехода в Яндекс.Контест.
 *
 * Контест закрытый и запрещает показывать себя во фрейме, поэтому встроить
 * его нельзя — на месте iframe у участника оставалась пустая белая рамка.
 * Вместо неё показываем, куда идти, и уводим в новую вкладку.
 */

function ContestArtwork() {
  return (
    <svg
      viewBox="0 0 220 132"
      className="w-full max-w-[220px] h-auto"
      role="img"
      aria-label="Список задач контеста"
    >
      <defs>
        <linearGradient id="contest-card" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eff6ff" />
          <stop offset="100%" stopColor="#ede9fe" />
        </linearGradient>
      </defs>

      {/* Орбита — тот же мотив, что и на главной */}
      <ellipse
        cx="110" cy="66" rx="94" ry="52"
        fill="none" stroke="#c7d2fe" strokeWidth="1.5" strokeDasharray="4 6"
      />
      <circle cx="16" cy="66" r="4" fill="#8b5cf6" />
      <circle cx="204" cy="66" r="3" fill="#3b82f6" />

      {/* Лист с задачами */}
      <rect x="52" y="22" width="116" height="88" rx="10" fill="url(#contest-card)" stroke="#c7d2fe" strokeWidth="1.5" />

      {[42, 60, 78].map((y, i) => (
        <g key={y}>
          <circle cx="70" cy={y} r="6" fill="none" stroke="#93c5fd" strokeWidth="1.5" />
          {i < 2 && (
            <path
              d={`M 67 ${y} l 2.2 2.4 l 4.2 -4.8`}
              fill="none" stroke="#2563eb" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round"
            />
          )}
          <rect x="84" y={y - 4} width={i === 2 ? 40 : 62} height="8" rx="4" fill="#bfdbfe" />
        </g>
      ))}

      <rect x="64" y="92" width="92" height="8" rx="4" fill="#ddd6fe" />
    </svg>
  );
}

export default function ContestLinkCard({
  url,
  title = 'Контест открыт',
  description = 'Задачи решаются на площадке Яндекс.Контеста — она откроется в новой вкладке.',
  buttonLabel = 'Перейти в Контест',
  minHeight = 420,
}: {
  url: string;
  title?: string;
  description?: string;
  buttonLabel?: string;
  minHeight?: number;
}) {
  const normalized = normalizeContestUrl(url);
  if (!normalized) return null;

  let host = '';
  try {
    host = new URL(normalized).hostname.replace(/^www\./, '');
  } catch {
    host = '';
  }

  return (
    <StageEmbedFrame minHeight={minHeight} centerContent>
      <div className="flex flex-col items-center justify-center text-center py-10 px-6 w-full">
        <ContestArtwork />

        <h4 className="text-lg font-semibold text-slate-800 mt-6 mb-2">{title}</h4>
        <p className="text-slate-500 text-sm max-w-md leading-relaxed">{description}</p>

        <a
          href={normalized}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {buttonLabel}
          <ExternalLink className="w-4 h-4" aria-hidden />
          <span className="sr-only">(откроется в новой вкладке)</span>
        </a>

        {host && (
          <p className="mt-3 text-xs text-slate-400 break-all">{host}</p>
        )}
      </div>
    </StageEmbedFrame>
  );
}
