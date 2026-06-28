import {
  ACHIEVEMENT_DEFINITIONS,
  type AchievementIconKey,
} from '../../lib/achievementUtils';
import AchievementBadgeArt from './AchievementBadgeArt';

type BadgeSize = 'sm' | 'md' | 'lg';

function formatEarnedDate(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

export default function AchievementBadgeWithHint({
  badgeKey,
  earned,
  earnedAt = null,
  size = 'sm',
}: {
  badgeKey: AchievementIconKey;
  earned: boolean;
  earnedAt?: string | null;
  size?: BadgeSize;
}) {
  const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.key === badgeKey);
  if (!def) return null;

  return (
    <div className="relative group/badge flex-shrink-0">
      <button
        type="button"
        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
        aria-label={`${def.title}. ${def.hint}`}
      >
        <AchievementBadgeArt type={badgeKey} earned={earned} size={size} />
      </button>

      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 z-30 w-56 -translate-x-1/2 opacity-0 invisible translate-y-1 group-hover/badge:opacity-100 group-hover/badge:visible group-hover/badge:translate-y-0 group-focus-within/badge:opacity-100 group-focus-within/badge:visible group-focus-within/badge:translate-y-0 transition-all duration-200"
      >
        <div className="rounded-xl border border-white/10 bg-slate-900/95 px-3 py-2.5 shadow-xl shadow-black/40 backdrop-blur-sm text-left">
          <div className="text-xs font-semibold text-white">{def.title}</div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{def.hint}</p>
          {earned && earnedAt ? (
            <p className="mt-1.5 text-[10px] text-emerald-400/90">Получено {formatEarnedDate(earnedAt)}</p>
          ) : (
            <p className="mt-1.5 text-[10px] text-slate-500">Ещё не получено</p>
          )}
        </div>
        <div className="mx-auto h-2 w-2 rotate-45 border-b border-r border-white/10 bg-slate-900/95 -mt-1" />
      </div>
    </div>
  );
}
