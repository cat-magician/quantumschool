import { BookOpen, ChevronRight } from 'lucide-react';
import type { HomeworkPage, HomeworkPageSubmission } from '../lib/types';
import { homeworkListDueText } from '../lib/homeworkPageUtils';
import { DEFAULT_HOMEWORK_MAX_SCORE, formatHomeworkScoreShort, SUBMISSION_STATUS_COLORS, SUBMISSION_STATUS_LABELS } from '../lib/homeworkUtils';
import HomeworkDueBadge from './HomeworkDueBadge';

export default function HomeworkPageCard({
  page,
  onClick,
  showPublishStatus = true,
  submission,
}: {
  page: Pick<HomeworkPage, 'id' | 'title' | 'due_at' | 'is_published' | 'max_score'>;
  onClick: () => void;
  showPublishStatus?: boolean;
  submission?: Pick<HomeworkPageSubmission, 'status' | 'score'> | null;
}) {
  const maxScore = page.max_score ?? DEFAULT_HOMEWORK_MAX_SCORE;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-violet-500/25 text-left transition-colors group"
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
        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
      </div>
    </button>
  );
}
