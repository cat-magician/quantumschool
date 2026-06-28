import type { Achievement } from '../../lib/types';
import {
  ALL_ACHIEVEMENT_KEYS,
  achievementEarnedAt,
  formatAchievementsProgress,
  type AchievementIconKey,
} from '../../lib/achievementUtils';
import AchievementBadgeWithHint from './AchievementBadgeWithHint';
import AchievementBadgeArt from './AchievementBadgeArt';

type Props = {
  earnedKeys: AchievementIconKey[];
  achievements?: Achievement[];
  userId?: string;
  size?: 'sm' | 'md' | 'lg';
  showCounter?: boolean;
  showLocked?: boolean;
  showHints?: boolean;
  wrap?: boolean;
  className?: string;
};

export default function AchievementBadgeStrip({
  earnedKeys,
  achievements = [],
  userId,
  size = 'sm',
  showCounter = false,
  showLocked = true,
  showHints = false,
  wrap = false,
  className = '',
}: Props) {
  const earnedSet = new Set(earnedKeys);
  const keys = showLocked ? ALL_ACHIEVEMENT_KEYS : earnedKeys;

  if (keys.length === 0 && !showCounter) return null;

  return (
    <div className={`${wrap ? 'flex flex-wrap' : 'inline-flex'} items-center gap-2 ${className}`}>
      {keys.map((key) => {
        const earned = earnedSet.has(key);
        if (showHints) {
          const earnedAt = userId ? achievementEarnedAt(achievements, userId, key) : null;
          return (
            <AchievementBadgeWithHint
              key={key}
              badgeKey={key}
              earned={earned}
              earnedAt={earnedAt}
              size={size}
            />
          );
        }
        return (
          <AchievementBadgeArt
            key={key}
            type={key}
            earned={earned}
            size={size}
          />
        );
      })}
      {showCounter && (
        <span className="text-[11px] text-slate-500 tabular-nums ml-0.5">
          {formatAchievementsProgress(earnedKeys.length)}
        </span>
      )}
    </div>
  );
}
