import type { AchievementIconKey } from '../../lib/achievementUtils';

type BadgeSize = 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<BadgeSize, string> = {
  sm: 'w-10 h-10',
  md: 'w-14 h-14',
  lg: 'w-[4.5rem] h-[4.5rem]',
};

type Props = {
  type: AchievementIconKey;
  earned?: boolean;
  size?: BadgeSize;
  className?: string;
};

export default function AchievementBadgeArt({
  type,
  earned = true,
  size = 'md',
  className = '',
}: Props) {
  const dim = !earned;
  return (
    <div
      className={`relative flex-shrink-0 ${SIZE_MAP[size]} ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 80 80"
        className={`w-full h-full drop-shadow-lg transition-all duration-300 ${
          dim ? 'opacity-25 grayscale saturate-0 scale-95' : ''
        }`}
      >
        {type === 'send' && <SendBadge earned={earned} />}
        {type === 'check' && <CheckBadge earned={earned} />}
        {type === 'star' && <StarBadge earned={earned} />}
      </svg>
      {earned && (
        <div className="absolute inset-0 rounded-full bg-white/5 pointer-events-none mix-blend-overlay" />
      )}
    </div>
  );
}

function SendBadge({ earned }: { earned: boolean }) {
  return (
    <>
      <defs>
        <radialGradient id="send-glow" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#67e8f9" stopOpacity={earned ? 0.55 : 0.2} />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="send-paper" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </linearGradient>
        <linearGradient id="send-fold" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="38" r="34" fill="url(#send-glow)" />
      <ellipse cx="40" cy="62" rx="22" ry="5" fill="#0c4a6e" opacity="0.35" />
      <path
        d="M18 52 L40 28 L62 52 L52 52 L52 58 L28 58 L28 52 Z"
        fill="url(#send-fold)"
        stroke="#bae6fd"
        strokeWidth="1.2"
      />
      <rect x="26" y="34" width="28" height="22" rx="3" fill="url(#send-paper)" stroke="#38bdf8" strokeWidth="1.2" />
      <path d="M32 42 H48 M32 47 H44" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <circle cx="54" cy="24" r="9" fill="#22d3ee" stroke="#a5f3fc" strokeWidth="1.5" />
      <path d="M50 24 L53 27 L58 21" stroke="#0c4a6e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path
        d="M46 18 Q58 8 68 14"
        stroke="#67e8f9"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
    </>
  );
}

function CheckBadge({ earned }: { earned: boolean }) {
  return (
    <>
      <defs>
        <radialGradient id="check-glow" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#6ee7b7" stopOpacity={earned ? 0.5 : 0.15} />
          <stop offset="100%" stopColor="#059669" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="check-doc" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ecfdf5" />
          <stop offset="100%" stopColor="#a7f3d0" />
        </linearGradient>
        <linearGradient id="check-seal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r="34" fill="url(#check-glow)" />
      <ellipse cx="40" cy="64" rx="20" ry="4.5" fill="#064e3b" opacity="0.3" />
      <rect x="22" y="18" width="36" height="44" rx="4" fill="url(#check-doc)" stroke="#6ee7b7" strokeWidth="1.5" />
      <path d="M28 28 H52 M28 35 H48 M28 42 H44" stroke="#10b981" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
      <circle cx="52" cy="52" r="14" fill="url(#check-seal)" stroke="#a7f3d0" strokeWidth="1.5" />
      <path d="M45 52 L50 57 L60 46" stroke="#ecfdf5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  );
}

function StarBadge({ earned }: { earned: boolean }) {
  return (
    <>
      <defs>
        <radialGradient id="star-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#fde68a" stopOpacity={earned ? 0.65 : 0.2} />
          <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="star-medal" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="45%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="star-ribbon" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="38" r="34" fill="url(#star-glow)" />
      <ellipse cx="40" cy="66" rx="18" ry="4" fill="#78350f" opacity="0.28" />
      <path d="M30 58 L40 52 L50 58 L48 68 L32 68 Z" fill="url(#star-ribbon)" stroke="#fecaca" strokeWidth="1" />
      <circle cx="40" cy="36" r="22" fill="url(#star-medal)" stroke="#fde68a" strokeWidth="2" />
      <path
        d="M40 20 L43.8 30.5 L55 30.5 L46.1 37 L49.5 48 L40 41.5 L30.5 48 L33.9 37 L25 30.5 L36.2 30.5 Z"
        fill="#fffbeb"
        stroke="#fcd34d"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="40"
          y1="36"
          x2="40"
          y2="22"
          stroke="#fde68a"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.7"
          transform={`rotate(${deg} 40 36)`}
        />
      ))}
    </>
  );
}
