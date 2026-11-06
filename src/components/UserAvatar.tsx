import { profileInitials } from '../lib/profileUtils';
import { useRecentAchievementImages } from '../hooks/useRecentAchievementImages';

const SIZE_CLASS = {
  xs: 'w-9 h-9 text-sm rounded-full',
  chip: 'w-8 h-8 text-[10px] rounded-full',
  sm: 'w-8 h-8 text-xs rounded-full',
  md: 'w-10 h-10 text-sm rounded-full',
  lg: 'w-16 h-16 text-xl rounded-2xl',
} as const;

const BADGE_SIZE = {
  xs: 'w-3.5 h-3.5',
  chip: 'w-3 h-3',
  sm: 'w-3 h-3',
  md: 'w-3.5 h-3.5',
  lg: 'w-[1.125rem] h-[1.125rem]',
} as const;

type UserAvatarProps = {
  displayName: string;
  avatarUrl?: string | null;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  /** Если передан — до 3 миниатюр последних достижений; иначе подгружаем по userId. */
  achievementImageUrls?: string[];
  userId?: string;
  /** По умолчанию: миниатюры только у своего аватара в кабинете и профиле. */
  showAchievementBadges?: boolean;
};

export default function UserAvatar({
  displayName,
  avatarUrl,
  size = 'md',
  className = '',
  achievementImageUrls,
  userId,
  showAchievementBadges = false,
}: UserAvatarProps) {
  const fromHook = useRecentAchievementImages(
    showAchievementBadges && achievementImageUrls == null && userId ? userId : undefined,
    3,
  );
  const badgeUrls = (achievementImageUrls ?? fromHook).slice(0, 3);
  const sizeClass = SIZE_CLASS[size];
  const badgeClass = BADGE_SIZE[size];
  const url = avatarUrl?.trim();

  const avatarInner = url ? (
    <img
      src={url}
      alt=""
      className={`object-cover shrink-0 bg-slate-800 ${sizeClass} ${className}`}
    />
  ) : (
    <div
      className={`bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center font-bold shrink-0 ${sizeClass} ${className}`}
      aria-hidden
    >
      {profileInitials(displayName)}
    </div>
  );

  if (!showAchievementBadges && achievementImageUrls == null) {
    return avatarInner;
  }

  if (badgeUrls.length === 0) {
    return avatarInner;
  }

  return (
    <div className="flex items-center shrink-0 gap-0.5">
      {avatarInner}
      <div className="flex items-center -space-x-1.5 pl-0.5" aria-hidden>
        {badgeUrls.map((src, i) => (
          <span
            key={`${src}-${i}`}
            className={`relative z-[3] rounded-full border border-slate-950 bg-slate-800 ring-1 ring-white/10 overflow-hidden ${badgeClass}`}
            style={{ zIndex: 3 - i }}
          >
            <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
          </span>
        ))}
      </div>
    </div>
  );
}
