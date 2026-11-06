import type { Achievement, AchievementDefinition } from '../../lib/types';
import {
  achievementImageSrc,
  earnedAchievementDates,
  formatAchievementsProgress,
} from '../../lib/achievementUtils';
import { useAchievementCatalog } from '../../hooks/useAchievementCatalog';
import AchievementBadgeWithHint from './AchievementBadgeWithHint';
import AchievementImage from './AchievementImage';

type BadgeSize = 'sm' | 'md' | 'lg';

const BADGE_SIZE_CLASS: Record<BadgeSize, string> = {
  sm: 'w-10 h-10',
  md: 'w-14 h-14',
  lg: 'w-[4.5rem] h-[4.5rem]',
};

type Props = {
  /** Не передан — берётся общий каталог из кеша сессии. */
  catalog?: AchievementDefinition[];
  earnedCodes: string[];
  achievements?: Achievement[];
  userId?: string;
  size?: BadgeSize;
  showCounter?: boolean;
  showLocked?: boolean;
  showHints?: boolean;
  wrap?: boolean;
  className?: string;
};

export default function AchievementBadgeStrip({
  catalog,
  earnedCodes,
  achievements = [],
  userId,
  size = 'sm',
  showCounter = false,
  showLocked = true,
  showHints = false,
  wrap = false,
  className = '',
}: Props) {
  const sharedCatalog = useAchievementCatalog();
  const definitions = catalog ?? sharedCatalog ?? [];
  const earned = new Set(earnedCodes);
  const shown = showLocked ? definitions : definitions.filter((d) => earned.has(d.code));

  if (shown.length === 0 && !showCounter) return null;

  const dates = showHints && userId ? earnedAchievementDates(achievements, userId) : null;

  return (
    <div className={`${wrap ? 'flex flex-wrap' : 'inline-flex'} items-center gap-2 ${className}`}>
      {shown.map((definition) => {
        const isEarned = earned.has(definition.code);
        if (showHints) {
          return (
            <AchievementBadgeWithHint
              key={definition.code}
              definition={definition}
              earned={isEarned}
              earnedAt={dates?.get(definition.code) ?? null}
              sizeClass={BADGE_SIZE_CLASS[size]}
            />
          );
        }
        return (
          <span key={definition.code} title={definition.title} className="shrink-0">
            <AchievementImage
              code={definition.code}
              imageSrc={achievementImageSrc(definition.image_url)}
              earned={isEarned}
              className={`block ${BADGE_SIZE_CLASS[size]}`}
            />
          </span>
        );
      })}
      {showCounter && (
        <span className="text-[11px] text-slate-500 tabular-nums ml-0.5">
          {formatAchievementsProgress(earned.size, definitions.length)}
        </span>
      )}
    </div>
  );
}
