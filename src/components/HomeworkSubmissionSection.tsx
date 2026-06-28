import { CheckCircle, Loader2, Save, Send } from 'lucide-react';
import type { HomeworkPageSubmission } from '../lib/types';
import {
  SUBMISSION_STATUS_COLORS,
  SUBMISSION_STATUS_LABELS,
} from '../lib/homeworkUtils';

function formatSubmissionWhen(iso: string | null | undefined) {
  if (!iso) return null;
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export default function HomeworkSubmissionSection({
  submission,
  preview = false,
  saving = false,
  submitError = '',
  onSaveDraft,
  onSubmit,
}: {
  submission?: HomeworkPageSubmission | null;
  preview?: boolean;
  saving?: boolean;
  submitError?: string;
  onSaveDraft?: () => void;
  onSubmit?: () => void;
}) {
  const locked = !preview && (submission?.status === 'submitted' || submission?.status === 'graded');
  const submittedWhen = formatSubmissionWhen(submission?.submitted_at);
  const gradedWhen = formatSubmissionWhen(submission?.graded_at);

  return (
    <section className="space-y-4 pt-4 border-t border-white/5">
      <div>
        <h3 className="text-sm font-semibold text-slate-300">Подтверждение сдачи</h3>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed max-w-none">
          Ответ отправляется через форму или контест на странице. Сайт не видит факт отправки автоматически — после сдачи нажмите «Отправить на проверку», чтобы преподаватель получил работу.
        </p>
      </div>

      {submission?.feedback && (
        <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-300">
          <strong>Комментарий преподавателя:</strong> {submission.feedback}
        </div>
      )}

      {submitError && <p className="text-sm text-rose-400">{submitError}</p>}

      {locked && submittedWhen && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`inline-flex px-2 py-0.5 rounded-md border ${SUBMISSION_STATUS_COLORS[submission!.status]}`}>
            {SUBMISSION_STATUS_LABELS[submission!.status]}
          </span>
          <span className="text-slate-400">Отправлено {submittedWhen}</span>
          {submission?.status === 'graded' && gradedWhen && (
            <span className="text-slate-500">· Оценено {gradedWhen}</span>
          )}
        </div>
      )}

      {submission?.status === 'graded' && submission.score !== null && (
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-white tabular-nums">{submission.score}</span>
          <span className="text-slate-500 text-sm pb-1">из 10</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={preview || locked ? undefined : onSaveDraft}
          disabled={preview || saving || locked}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            locked
              ? 'bg-white/5 text-slate-500 border border-white/5 cursor-default'
              : 'bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-50'
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {locked ? 'Черновик не нужен' : 'Сохранить черновик'}
        </button>
        <button
          type="button"
          onClick={preview || locked ? undefined : onSubmit}
          disabled={preview || saving || locked}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            locked
              ? 'bg-emerald-600/15 text-emerald-300 border border-emerald-500/25 cursor-default'
              : 'bg-gradient-to-r from-blue-600 to-violet-700 text-white disabled:opacity-50'
          }`}
        >
          {locked ? (
            <CheckCircle className="w-4 h-4" />
          ) : saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {locked
            ? (submission?.status === 'graded' ? 'Работа проверена' : 'Отправлено на проверку')
            : 'Отправить на проверку'}
        </button>
      </div>

      {preview && (
        <p className="text-[11px] text-slate-600">
          Кнопки неактивны в предпросмотре — ученик сможет нажать их на опубликованной странице.
        </p>
      )}
    </section>
  );
}

export function HomeworkSubmissionStatusBadge({ submission }: { submission: HomeworkPageSubmission }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-md border ${SUBMISSION_STATUS_COLORS[submission.status]}`}>
      {SUBMISSION_STATUS_LABELS[submission.status]}
      {submission.score !== null && ` · ${submission.score}/10`}
    </span>
  );
}
