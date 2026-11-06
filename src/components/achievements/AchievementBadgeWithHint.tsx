import type { AchievementDefinition } from '../../lib/types';
import { achievementImageSrc } from '../../lib/achievementUtils';
import AchievementImage from './AchievementImage';

function formatEarnedDate(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

export default function AchievementBadgeWithHint({
  definition,
  earned,
  earnedAt = null,
  sizeClass,
}: {
  definition: AchievementDefinition;
  earned: boolean;
  earnedAt?: string | null;
  sizeClass: string;
}) {
  // Получено — за что; не получено — как получить.
  const detail = earned
    ? definition.description || definition.hint
    : definition.hint || definition.description;

  return (
    <div className="relative group/badge flex-shrink-0">
      <button
        type="button"
        className="block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
        aria-label={`${definition.title}. ${detail}`}
      >
        <AchievementImage
          code={definition.code}
          imageSrc={achievementImageSrc(definition.image_url)}
          earned={earned}
          className={`block ${sizeClass}`}
        />
      </button>

      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-0 sm:left-1/2 z-30 w-48 sm:w-56 sm:-translate-x-1/2 opacity-0 invisible translate-y-1 group-hover/badge:opacity-100 group-hover/badge:visible group-hover/badge:translate-y-0 group-focus-within/badge:opacity-100 group-focus-within/badge:visible group-focus-within/badge:translate-y-0 transition-all duration-200"
      >
        <div className="rounded-xl border border-white/10 bg-slate-900/95 px-3 py-2.5 shadow-xl shadow-black/40 backdrop-blur-sm text-left">
          <div className="text-xs font-semibold text-white">{definition.title}</div>
          {detail && <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{detail}</p>}
          {earned && earnedAt ? (
            <p className="mt-1.5 text-[10px] text-emerald-400/90">Получено {formatEarnedDate(earnedAt)}</p>
          ) : (
            <p className="mt-1.5 text-[10px] text-slate-500">Ещё не получено</p>
          )}
        </div>
        <div className="ml-5 sm:mx-auto h-2 w-2 rotate-45 border-b border-r border-white/10 bg-slate-900/95 -mt-1" />
      </div>
    </div>
  );
}
