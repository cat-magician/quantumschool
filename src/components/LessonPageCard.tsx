import { useEffect, useState } from 'react';
import { ChevronRight, Eye, EyeOff, Loader2, Presentation, Trash2 } from 'lucide-react';
import type { LessonPage, LessonPageType } from '../lib/types';
import { formatLessonDate } from '../lib/lessonPageUtils';
import LessonCoverImage from './LessonCoverImage';

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
  onClick,
  showStatus = false,
  onTogglePublish,
  onDelete,
  actionBusy = false,
}: {
  page: Pick<LessonPage, 'id' | 'title' | 'lesson_date' | 'lesson_type' | 'cover_url' | 'is_published'>;
  onClick: () => void;
  showStatus?: boolean;
  onTogglePublish?: () => void;
  onDelete?: () => void;
  actionBusy?: boolean;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const coverUrl = page.cover_url?.trim() ?? '';
  const showCover = !!coverUrl && !coverFailed;
  const hasActions = Boolean(onTogglePublish || onDelete);

  useEffect(() => {
    setCoverFailed(false);
  }, [coverUrl]);

  return (
    <div className="w-full flex items-stretch gap-0 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-blue-500/30 transition-all overflow-hidden group min-h-[5.5rem]">
      <button
        type="button"
        onClick={onClick}
        className="flex-1 flex items-stretch gap-0 text-left min-w-0"
      >
        <div className="w-28 sm:w-32 shrink-0 relative min-h-[5.5rem]">
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
            <div className="font-semibold text-white truncate group-hover:text-blue-300 transition-colors">
              {page.title}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{formatLessonDate(page.lesson_date)}</div>
          </div>

          {showStatus && (
            <span className={`text-[10px] px-2 py-0.5 rounded-md border shrink-0 ${
              page.is_published
                ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                : 'text-slate-400 bg-white/5 border-white/10'
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
