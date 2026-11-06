import { publicAsset } from '../../lib/appPaths';
import { LEGACY_ACHIEVEMENT_ART } from '../../lib/achievementUtils';
import AchievementBadgeArt from './AchievementBadgeArt';

type Props = {
  code: string | null;
  imageSrc: string | null;
  earned?: boolean;
  className?: string;
};

/** Картинка достижения; пока её нет — прежний рисунок или знак кружка. */
export default function AchievementImage({ code, imageSrc, earned = true, className = '' }: Props) {
  const locked = earned ? '' : 'opacity-30 grayscale';

  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt=""
        draggable={false}
        decoding="async"
        className={`object-contain select-none ${locked} ${className}`}
      />
    );
  }

  const legacyArt = code ? LEGACY_ACHIEVEMENT_ART[code] : undefined;
  if (legacyArt) {
    return <AchievementBadgeArt type={legacyArt} earned={earned} size="fill" className={className} />;
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-blue-600/40 to-violet-600/40 ${locked} ${className}`}
      aria-hidden
    >
      <img src={publicAsset('/logo_qc.svg')} alt="" className="h-1/2 w-1/2 brightness-0 invert opacity-90" />
    </div>
  );
}
