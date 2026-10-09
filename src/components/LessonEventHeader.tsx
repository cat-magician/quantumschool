import { Calendar, Clock, Timer } from 'lucide-react';
import type { LessonPageType, ScheduleEvent } from '../lib/types';
import { LESSON_TYPE_LABELS, formatLessonDate } from '../lib/lessonPageUtils';
import { linkifyText } from '../lib/linkifyText';
import {
  formatDuration,
  formatEventDate,
  formatTimeRange,
  isEventEnded,
  isEventOngoing,
} from '../lib/scheduleUtils';
import LessonCoverImage from './LessonCoverImage';
import MeetingLinkButton from './MeetingLinkButton';
import { LiveChip, ScheduleChip } from './ScheduleCard';
import { EVENT_TONES } from '../lib/scheduleTones';

export type LessonEventInfo = Pick<ScheduleEvent, 'scheduled_at' | 'duration_minutes' | 'meeting_url' | 'description'>;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Шапка страницы лекции или семинара — всё о занятии: обложка, когда, сколько
 * идёт, ссылка на трансляцию и анонс. Карточка в расписании показывает то же
 * самое, только короче. Без события в расписании — просто дата.
 */
export default function LessonEventHeader({
  title,
  lessonType,
  coverUrl,
  lessonDate,
  event,
}: {
  title: string;
  lessonType: LessonPageType;
  coverUrl?: string | null;
  lessonDate: string;
  event: LessonEventInfo | null;
}) {
  const cover = coverUrl?.trim();
  const live = event ? isEventOngoing(event.scheduled_at, event.duration_minutes) : false;
  const ended = event ? isEventEnded(event.scheduled_at, event.duration_minutes) : false;

  return (
    <header className="space-y-4">
      {cover && (
        <div className="rounded-2xl overflow-hidden border border-white/5 aspect-[21/9] max-h-56 bg-slate-900">
          <LessonCoverImage url={cover} className="w-full h-full object-cover" />
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <ScheduleChip className={EVENT_TONES[lessonType].chip}>{LESSON_TYPE_LABELS[lessonType]}</ScheduleChip>
          {live && <LiveChip />}
          {ended && <ScheduleChip className="bg-white/5 text-slate-400 border-white/10">Прошло</ScheduleChip>}
        </div>
        <h2 className="text-2xl font-bold text-white break-words">{title || 'Без названия'}</h2>
      </div>

      {event ? (
        <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 sm:p-5 space-y-4">
          <dl className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr] text-sm">
            <div className="flex items-start gap-2.5">
              <Calendar className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" aria-hidden />
              <div className="min-w-0">
                <dt className="text-xs text-slate-500">Дата</dt>
                <dd className="text-white">{capitalize(formatEventDate(event.scheduled_at))}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" aria-hidden />
              <div>
                <dt className="text-xs text-slate-500">Время</dt>
                <dd className="text-white tabular-nums">
                  {formatTimeRange(event.scheduled_at, event.duration_minutes)}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Timer className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" aria-hidden />
              <div>
                <dt className="text-xs text-slate-500">Длительность</dt>
                <dd className="text-white">{formatDuration(event.duration_minutes)}</dd>
              </div>
            </div>
          </dl>

          {event.meeting_url && !ended && (
            <MeetingLinkButton
              url={event.meeting_url}
              scheduledAt={event.scheduled_at}
              durationMinutes={event.duration_minutes}
              variant="hero"
            />
          )}

          {event.description?.trim() && (
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
              {linkifyText(event.description.trim())}
            </p>
          )}
        </div>
      ) : (
        lessonDate && <p className="text-sm text-slate-500">{formatLessonDate(lessonDate)}</p>
      )}
    </header>
  );
}
