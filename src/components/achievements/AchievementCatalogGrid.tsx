import {
  ACHIEVEMENT_DEFINITIONS,
  achievementEarnedAt,
  type AchievementIconKey,
} from '../../lib/achievementUtils';
import type { Achievement } from '../../lib/types';
import AchievementBadgeArt from './AchievementBadgeArt';

type Props = {
  achievements: Achievement[];
  userId: string;
  compact?: boolean;
};

export default function AchievementCatalogGrid({ achievements, userId, compact = false }: Props) {
  return (
    <div className={`grid grid-cols-3 ${compact ? 'gap-2' : 'gap-3 sm:gap-4'}`}>
      {ACHIEVEMENT_DEFINITIONS.map(({ key }) => {
        const earnedAt = achievementEarnedAt(achievements, userId, key);
        const earned = earnedAt !== null;
        return (
          <AchievementTile
            key={key}
            badgeKey={key}
            earned={earned}
            earnedAt={earnedAt}
            compact={compact}
          />
        );
      })}
    </div>
  );
}

function AchievementTile({
  badgeKey,
  earned,
  earnedAt,
  compact,
}: {
  badgeKey: AchievementIconKey;
  earned: boolean;
  earnedAt: string | null;
  compact: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-xl border transition-colors ${
        compact ? 'py-2 px-1.5' : 'py-3 px-2'
      } ${
        earned
          ? 'bg-gradient-to-b from-white/[0.06] to-transparent border-white/10'
          : 'bg-slate-950/40 border-white/5'
      }`}
      title={earned && earnedAt
        ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(earnedAt))
        : undefined}
    >
      <AchievementBadgeArt type={badgeKey} earned={earned} size={compact ? 'md' : 'lg'} />
      {earned && earnedAt && (
        <p className={`text-slate-500 tabular-nums mt-1 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
          {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(earnedAt))}
        </p>
      )}
    </div>
  );
}
