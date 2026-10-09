import { Calendar, Clock, Timer } from 'lucide-react';
import type { LessonPageBlock, LessonPageType, ScheduleEvent } from '../lib/types';
import { LESSON_TYPE_LABELS, formatLessonDate } from '../lib/lessonPageUtils';
import { linkifyText } from '../lib/linkifyText';
import { EVENT_TONES } from '../lib/scheduleTones';
import {
  formatDuration,
  formatEventDate,
  formatTimeRange,
  isEventActive,
  isEventEnded,
  isEventOngoing,
} from '../lib/scheduleUtils';
import LessonCoverImage from './LessonCoverImage';
import LessonPageBlocks from './LessonPageBlocks';
import MeetingLinkButton from './MeetingLinkButton';
import { LiveChip, ScheduleChip } from './ScheduleCard';
import { useTimeView } from '../lib/timeView';

export type LessonEventInfo = Pick<ScheduleEvent, 'scheduled_at' | 'duration_minutes' | 'meeting_url' | 'description'>;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Страница лекции или семинара — всё о занятии: обложка, когда и сколько
 * идёт, ссылка на трансляцию, анонс, запись и материалы. Карточка в
 * расписании показывает то же самое, только короче. Одна и та же у ученика
 * и у сотрудника, который открыл страницу посмотреть.
 *
 * На широком экране (от 1280 px) — две колонки: слева занятие и материалы,
 * справа закреплённая карточка «когда и как подключиться». Уже — одна
 * колонка, карточка сразу под заголовком: рядом с меню кабинета для двух
 * колонок там тесно.
 */
export default function LessonPageView({
  title,
  lessonType,
  coverUrl,
  lessonDate,
  event,
  blocks,
  onOpenHomework,
}: {
  title: string;
  lessonType: LessonPageType;
  coverUrl?: string | null;
  /** Дата страницы — показывается, если занятия нет в расписании. */
  lessonDate: string;
  event: LessonEventInfo | null;
  blocks: LessonPageBlock[];
  onOpenHomework?: (pageId: string) => void;
}) {
  const timeView = useTimeView();
  const cover = coverUrl?.trim();
  const live = event ? isEventOngoing(event.scheduled_at, event.duration_minutes) : false;
  const ended = event ? isEventEnded(event.scheduled_at, event.duration_minutes) : false;
  const beforeEnd = event ? isEventActive(event.scheduled_at, event.duration_minutes) : false;
  const description = event?.description?.trim();

  return (
    <article
      className={`grid gap-6 ${event ? 'xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-x-8' : ''}`}
    >
      <header className="min-w-0 space-y-4 xl:col-start-1">
        {cover && (
          <div className="w-full overflow-hidden rounded-2xl border border-white/5 bg-slate-900 aspect-[21/9]">
            <LessonCoverImage url={cover} className="h-full w-full object-cover" />
          </div>
        )}
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <ScheduleChip className={EVENT_TONES[lessonType].chip}>{LESSON_TYPE_LABELS[lessonType]}</ScheduleChip>
            {live && <LiveChip />}
            {ended && <ScheduleChip className="bg-white/5 text-slate-400 border-white/10">Прошло</ScheduleChip>}
          </div>
          <h2 className="break-words text-2xl font-bold text-white sm:text-3xl">{title || 'Без названия'}</h2>
          {!event && lessonDate && (
            <p className="mt-2 text-sm text-slate-500">{formatLessonDate(lessonDate)}</p>
          )}
        </div>
      </header>

      {event && (
        <aside className="xl:sticky xl:top-20 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:self-start">
          <div className="space-y-4 rounded-2xl border border-white/5 bg-slate-900/60 p-4 sm:p-5">
            <dl className="grid gap-3 text-sm sm:grid-cols-3 xl:grid-cols-1">
              <div className="flex items-start gap-2.5">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" aria-hidden />
                <div className="min-w-0">
                  <dt className="text-xs text-slate-500">Дата</dt>
                  <dd className="text-white">{capitalize(formatEventDate(event.scheduled_at, timeView))}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" aria-hidden />
                <div>
                  <dt className="text-xs text-slate-500">Время</dt>
                  <dd className="tabular-nums text-white">
                    {formatTimeRange(event.scheduled_at, event.duration_minutes, timeView)}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Timer className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" aria-hidden />
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
                className="w-full sm:w-auto xl:w-full"
              />
            )}
          </div>
        </aside>
      )}

      <div className="min-w-0 space-y-6 xl:col-start-1">
        {description && (
          <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-slate-300">
            {linkifyText(description)}
          </p>
        )}
        <LessonPageBlocks
          blocks={blocks}
          onOpenHomework={onOpenHomework}
          emptyState={beforeEnd
            ? {
              title: 'Запись и конспект появятся после занятия',
              text: 'Преподаватель добавит их на эту страницу — загляните сюда, когда занятие закончится.',
            }
            : undefined}
        />
      </div>
    </article>
  );
}
