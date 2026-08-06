import { BookOpen, ChevronRight, Eye, EyeOff, Loader2, Trash2 } from 'lucide-react';
import type { HomeworkPage, HomeworkPageSubmission } from '../lib/types';
import { homeworkListDueText } from '../lib/homeworkPageUtils';
import { DEFAULT_HOMEWORK_MAX_SCORE, formatHomeworkScoreShort, SUBMISSION_STATUS_COLORS, SUBMISSION_STATUS_LABELS } from '../lib/homeworkUtils';
import HomeworkDueBadge from './HomeworkDueBadge';

export default function HomeworkPageCard({
  page,
  onClick,
  showPublishStatus = true,
  submission,
  onTogglePublish,
  onDelete,
  actionBusy = false,
}: {
  page: Pick<HomeworkPage, 'id' | 'title' | 'due_at' | 'is_published' | 'max_score'>;
  onClick: () => void;
  showPublishStatus?: boolean;
  submission?: Pick<HomeworkPageSubmission, 'status' | 'score'> | null;
  onTogglePublish?: () => void;
  onDelete?: () => void;
  actionBusy?: boolean;
}) {
  const maxScore = page.max_score ?? DEFAULT_HOMEWORK_MAX_SCORE;
  const hasActions = Boolean(onTogglePublish || onDelete);

  return (
    <div className="w-full flex items-stretch gap-0 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-violet-500/25 transition-colors group overflow-hidden">
      <button
        type="button"
        onClick={onClick}
        className="flex-1 flex items-center gap-4 px-5 py-4 text-left min-w-0"
      >
        <div className="w-12 h-12 rounded-xl bg-violet-600/20 flex items-center justify-center shrink-0">
          <BookOpen className="w-6 h-6 text-violet-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white truncate group-hover:text-violet-300 transition-colors">
            {page.title}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="text-xs text-slate-500">{homeworkListDueText(page.due_at)}</span>
            <HomeworkDueBadge dueAt={page.due_at} submission={submission} />
            {submission && (
              <span className={`text-[10px] px-2 py-0.5 rounded-md border ${SUBMISSION_STATUS_COLORS[submission.status]}`}>
                {SUBMISSION_STATUS_LABELS[submission.status]}
                {submission.score !== null && ` · ${formatHomeworkScoreShort(submission.score, maxScore)}`}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {showPublishStatus && (
            <span className={`text-[10px] px-2 py-0.5 rounded-md border ${
              page.is_published
                ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                : 'text-slate-400 bg-white/5 border-white/10'
            }`}
            >
              {page.is_published ? 'Опубликовано' : 'Черновик'}
            </span>
          )}
          {!hasActions && (
            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
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
