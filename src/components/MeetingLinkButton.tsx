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
  variant?: 'hero' | 'inline' | 'admin';
};

export default function MeetingLinkButton({
  url,
  scheduledAt,
  durationMinutes,
  variant = 'inline',
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
        className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
      >
        <Video className="w-4 h-4" />
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
