import { ExternalLink, Video } from 'lucide-react';
import {
  isMeetingJoinWindow,
  meetingJoinButtonLabel,
  normalizeMeetingUrl,
  shouldShowMeetingLink,
} from '../lib/meetingLinkUtils';

type MeetingLinkProps = {
  url: string;
  scheduledAt: string;
  durationMinutes: number;
  /** card — компактная кнопка для карточки расписания, без внешних отступов. */
  variant?: 'hero' | 'inline' | 'admin' | 'card';
  /** Дополнительные классы ссылки — например, во всю ширину карточки. */
  className?: string;
};

export default function MeetingLinkButton({
  url,
  scheduledAt,
  durationMinutes,
  variant = 'inline',
  className: extraClassName = '',
}: MeetingLinkProps) {
  const href = normalizeMeetingUrl(url);
  if (!href || !shouldShowMeetingLink(scheduledAt, durationMinutes)) return null;

  const inJoinWindow = isMeetingJoinWindow(scheduledAt, durationMinutes);
  const label = meetingJoinButtonLabel(href, inJoinWindow);

  if (variant === 'hero') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${inJoinWindow
          ? 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors'
          : 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-blue-200 text-sm font-medium transition-colors'} ${extraClassName}`}
      >
        <Video className="w-4 h-4" />
        {label}
      </a>
    );
  }

  if (variant === 'card') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={inJoinWindow
          ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors'
          : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-blue-300 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/15 hover:text-blue-200 transition-colors'}
      >
        {inJoinWindow ? <Video className="w-4 h-4" /> : <ExternalLink className="w-3.5 h-3.5" />}
        {label}
      </a>
    );
  }

  if (variant === 'admin') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300"
      >
        <Video className="w-4 h-4" />
        {label}
      </a>
    );
  }

  const className = inJoinWindow
    ? 'inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors'
    : 'inline-flex items-center gap-1.5 mt-2 text-sm text-blue-400 hover:text-blue-300';

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {inJoinWindow ? <Video className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
      {label}
    </a>
  );
}
