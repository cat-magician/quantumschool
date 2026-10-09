import { useEffect, useState } from 'react';
import { ChevronRight, Eye, EyeOff, Loader2, Presentation, Trash2 } from 'lucide-react';
import type { LessonPage, LessonPageType } from '../lib/types';
import { formatLessonDate, type LessonEventTime } from '../lib/lessonPageUtils';
import { formatEventDate, formatTimeRange, isEventOngoing } from '../lib/scheduleUtils';
import LessonCoverImage from './LessonCoverImage';
import { LiveChip } from './ScheduleCard';

const COVER_GRADIENT: Record<LessonPageType, string> = {
  lecture: 'from-blue-600/40 via-indigo-700/30 to-slate-900',
  seminar: 'from-violet-600/40 via-purple-700/30 to-slate-900',
};

function CoverPlaceholder({ lessonType }: { lessonType: LessonPageType }) {
  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${COVER_GRADIENT[lessonType]} flex items-center justify-center`}>
      <Presentation className="w-8 h-8 text-white/30" />
    </div>
  );
}

export default function LessonPageCard({
  page,
  event,
  onClick,
  showStatus = false,
  past = false,
  onTogglePublish,
  onDelete,
  actionBusy = false,
}: {
  page: Pick<LessonPage, 'id' | 'title' | 'lesson_date' | 'lesson_type' | 'cover_url' | 'is_published'>;
  /**
   * Занятие в расписании: на карточке — его день и время. null — страница не
   * в расписании (в кабинете преподавателя это отмечено); undefined — неизвестно.
   */
  event?: LessonEventTime | null;
  onClick: () => void;
  showStatus?: boolean;
  past?: boolean;
  onTogglePublish?: () => void;
  onDelete?: () => void;
  actionBusy?: boolean;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const coverUrl = page.cover_url?.trim() ?? '';
  const showCover = !!coverUrl && !coverFailed;
  const hasActions = Boolean(onTogglePublish || onDelete);
  const live = event ? isEventOngoing(event.scheduled_at, event.duration_minutes) : false;

  useEffect(() => {
    setCoverFailed(false);
  }, [coverUrl]);

  return (
    <div className={`w-full flex items-stretch gap-0 rounded-2xl border hover:border-blue-500/30 transition-colors overflow-hidden group min-h-[5.5rem] ${
      past ? 'bg-slate-950/40 border-white/[0.04]' : 'bg-slate-900/60 border-white/5'
    }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex-1 flex items-stretch gap-0 text-left min-w-0"
      >
        <div className={`w-28 sm:w-32 shrink-0 relative min-h-[5.5rem] ${past ? 'opacity-55 saturate-50' : ''}`}>
          {showCover ? (
            <LessonCoverImage
              url={coverUrl}
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setCoverFailed(true)}
            />
          ) : (
            <CoverPlaceholder lessonType={page.lesson_type} />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-slate-900/80 pointer-events-none" />
        </div>

        <div className="flex-1 flex items-center gap-3 min-w-0 py-3 pr-3 pl-4 sm:pl-5 border-l border-white/5">
          <div className="flex-1 min-w-0">
            <div className={`font-semibold truncate group-hover:text-blue-300 transition-colors ${past ? 'text-slate-300' : 'text-white'}`}>
              {page.title}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-slate-500">
              {event ? (
                <span className="tabular-nums">
                  {formatEventDate(event.scheduled_at)} · {formatTimeRange(event.scheduled_at, event.duration_minutes)}
                </span>
              ) : (
                <span>{formatLessonDate(page.lesson_date)}</span>
              )}
              {live && <LiveChip />}
              {event === null && showStatus && (
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-slate-500">
                  не в расписании
                </span>
              )}
            </div>
          </div>

          {showStatus && (
            <span className={`text-[10px] px-2 py-0.5 rounded-md border shrink-0 ${
              page.is_published
                ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                : 'text-amber-200 bg-amber-500/10 border-amber-500/25'
            }`}
            >
              {page.is_published ? 'Опубликовано' : 'Черновик'}
            </span>
          )}

          {!hasActions && (
            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 shrink-0" />
          )}
        </div>
      </button>

      {hasActions && (
        <div className="flex items-center gap-1 px-2 sm:px-3 border-l border-white/5 shrink-0">
          {onTogglePublish && (
            <button
              type="button"
              title={page.is_published ? 'Снять с публикации' : 'Опубликовать'}
              aria-label={page.is_published ? 'Снять с публикации' : 'Опубликовать'}
              disabled={actionBusy}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePublish();
              }}
              className={`p-2 rounded-xl transition-colors disabled:opacity-50 ${
                page.is_published
                  ? 'text-amber-300 hover:bg-amber-500/10'
                  : 'text-emerald-300 hover:bg-emerald-500/10'
              }`}
            >
              {actionBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : page.is_published ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              title="Удалить"
              aria-label="Удалить"
              disabled={actionBusy}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-2 rounded-xl text-rose-300 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
