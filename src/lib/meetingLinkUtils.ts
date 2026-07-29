import { isEventEnded, isEventOngoing } from './scheduleUtils';

/** Приводит ссылку на встречу к рабочему https-URL (как в Google Calendar). */
export function normalizeMeetingUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  if (/^www\./i.test(trimmed) || /^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)) {
    return `https://${trimmed.replace(/^\/\//, '')}`;
  }

  return trimmed;
}

export type MeetingPlatform = 'google_meet' | 'zoom' | 'teams' | 'telemost' | 'other';

export function detectMeetingPlatform(url: string): MeetingPlatform {
  try {
    const host = new URL(normalizeMeetingUrl(url)).hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'meet.google.com') return 'google_meet';
    if (host.includes('zoom.us') || host === 'zoom.com') return 'zoom';
    if (host.includes('teams.microsoft.com') || host === 'teams.live.com') return 'teams';
    if (host.includes('telemost.yandex')) return 'telemost';
  } catch {
    /* ignore */
  }
  return 'other';
}

const PLATFORM_LABELS: Record<MeetingPlatform, string> = {
  google_meet: 'Google Meet',
  zoom: 'Zoom',
  teams: 'Microsoft Teams',
  telemost: 'Яндекс Телемост',
  other: 'Встреча',
};

export function meetingPlatformLabel(url: string): string {
  return PLATFORM_LABELS[detectMeetingPlatform(url)];
}

/** Ссылку показываем для всех событий, которые ещё не завершились. */
export function shouldShowMeetingLink(scheduledAt: string, durationMinutes: number): boolean {
  return !isEventEnded(scheduledAt, durationMinutes);
}

/** Кнопка «Подключиться» — за 15 мин до начала и пока идёт занятие. */
export function isMeetingJoinWindow(
  scheduledAt: string,
  durationMinutes: number,
  minutesBefore = 15,
): boolean {
  if (isEventEnded(scheduledAt, durationMinutes)) return false;
  if (isEventOngoing(scheduledAt, durationMinutes)) return true;
  const start = new Date(scheduledAt).getTime();
  return Date.now() >= start - minutesBefore * 60_000;
}

export function meetingJoinButtonLabel(url: string, inJoinWindow: boolean): string {
  if (!inJoinWindow) return 'Ссылка на встречу';
  const platform = detectMeetingPlatform(url);
  if (platform === 'google_meet') return 'Подключиться через Google Meet';
  if (platform === 'zoom') return 'Подключиться через Zoom';
  if (platform === 'teams') return 'Подключиться через Teams';
  if (platform === 'telemost') return 'Подключиться через Телемост';
  return 'Подключиться';
}
