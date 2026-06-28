import { profileInitials } from '../lib/profileUtils';

const SIZE_CLASS = {
  xs: 'w-9 h-9 text-sm rounded-full',
  chip: 'w-8 h-8 text-[10px] rounded-full',
  sm: 'w-8 h-8 text-xs rounded-full',
  md: 'w-10 h-10 text-sm rounded-full',
  lg: 'w-16 h-16 text-xl rounded-2xl',
} as const;

type UserAvatarProps = {
  displayName: string;
  avatarUrl?: string | null;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
};

export default function UserAvatar({
  displayName,
  avatarUrl,
  size = 'md',
  className = '',
}: UserAvatarProps) {
  const sizeClass = SIZE_CLASS[size];
  const url = avatarUrl?.trim();

  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={`object-cover shrink-0 bg-slate-800 ${sizeClass} ${className}`}
      />
    );
  }

  return (
    <div
      className={`bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center font-bold shrink-0 ${sizeClass} ${className}`}
      aria-hidden
    >
      {profileInitials(displayName)}
    </div>
  );
}
