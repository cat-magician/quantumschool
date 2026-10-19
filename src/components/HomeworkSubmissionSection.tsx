import { useState } from 'react';
import { CheckCircle, Loader2, Save, Send } from 'lucide-react';
import type { HomeworkPageSubmission } from '../lib/types';
import type { HomeworkSubmissionMode } from '../lib/homeworkPageUtils';
import {
  formatHomeworkScoreShort,
  formatHomeworkScoreValue,
  SUBMISSION_STATUS_COLORS,
  SUBMISSION_STATUS_LABELS,
} from '../lib/homeworkUtils';
import { SubmitAcceptedBanner } from './ExternalSubmitConfirm';
import { CheckboxBox } from './CheckboxBox';

function formatSubmissionWhen(iso: string | null | undefined) {
  if (!iso) return null;
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

type SubmissionSectionProps = {
  submission?: HomeworkPageSubmission | null;
  maxScore?: number;
  /** confirm — ответ в форме или контесте; chat — в чате группы; mark — блока сдачи нет. */
  mode?: HomeworkSubmissionMode;
  preview?: boolean;
  saving?: boolean;
  submitError?: string;
  onSaveDraft?: () => void;
  onSubmit?: () => void;
};

export default function HomeworkSubmissionSection(props: SubmissionSectionProps) {
  return props.mode === 'chat' || props.mode === 'mark'
    ? <MarkSubmission {...props} />
    : <ConfirmSubmission {...props} />;
}

/** Статус, комментарий и оценка — после отправки или проверки. */
function SubmissionResult({
  submission,
  maxScore,
}: {
  submission: HomeworkPageSubmission;
  maxScore: number;
}) {
  const submittedWhen = formatSubmissionWhen(submission.submitted_at);
  const gradedWhen = formatSubmissionWhen(submission.graded_at);
  return (
    <>
      {submission.feedback && (
        <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-300">
          <strong>Комментарий преподавателя:</strong> {submission.feedback}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className={`inline-flex px-2 py-0.5 rounded-md border ${SUBMISSION_STATUS_COLORS[submission.status]}`}>
          {SUBMISSION_STATUS_LABELS[submission.status]}
        </span>
        {submittedWhen && <span className="text-slate-400">Отправлено {submittedWhen}</span>}
        {submission.status === 'graded' && gradedWhen && (
          <span className="text-slate-500">Оценено {gradedWhen}</span>
        )}
      </div>

      {submission.status === 'graded' && submission.score !== null && (
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-white tabular-nums">
            {formatHomeworkScoreValue(submission.score)}
          </span>
          <span className="text-slate-500 text-sm pb-1">из {formatHomeworkScoreValue(maxScore)}</span>
        </div>
      )}
    </>
  );
}

/**
 * Решение сдают не через сайт — в чат группы или как договорились с
 * наставником. Отметка здесь только помогает наставнику увидеть, кто сдал:
 * оценку он может поставить и без неё.
 */
function MarkSubmission({
  submission,
  maxScore = 10,
  mode,
  preview = false,
  saving = false,
  submitError = '',
  onSubmit,
}: SubmissionSectionProps) {
  const current = preview ? null : submission ?? null;
  const marked = current?.status === 'submitted';
  const graded = current?.status === 'graded';
  const chat = mode === 'chat';

  return (
    <section className="space-y-4 pt-4 border-t border-white/5 pb-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-300">{graded ? 'Оценка' : 'Отметка о сдаче'}</h3>
        {!graded && (
          <p className="text-sm text-slate-500 mt-1 leading-relaxed max-w-none">
            {marked
              ? 'Наставник видит, что решение ждёт проверки. Оценка и комментарий появятся здесь.'
              : `${chat ? 'Отправили решение в чат' : 'Сдали решение'} — отметьте это здесь, и наставник увидит, что работа ждёт проверки. Отмечать не обязательно: оценку поставят и без отметки.`}
          </p>
        )}
      </div>

      {submitError && <p className="text-sm text-rose-400">{submitError}</p>}

      {current && current.status !== 'draft' && <SubmissionResult submission={current} maxScore={maxScore} />}

      {!marked && !graded && (
        <button
          type="button"
          onClick={preview ? undefined : onSubmit}
          disabled={preview || saving}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-5 py-3 sm:py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-violet-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {chat ? 'Решение отправлено в чат' : 'Решение сдано'}
        </button>
      )}

      {preview && (
        <p className="text-[11px] text-slate-600">
          Кнопка неактивна в предпросмотре — ученик сможет нажать её на опубликованной странице.
        </p>
      )}
    </section>
  );
}

function ConfirmSubmission({
  submission,
  maxScore = 10,
  preview = false,
  saving = false,
  submitError = '',
  onSaveDraft,
  onSubmit,
}: SubmissionSectionProps) {
  const [confirmChecked, setConfirmChecked] = useState(false);
  const locked = !preview && (submission?.status === 'submitted' || submission?.status === 'graded');
  const needsSubmit = !preview && !locked;
  const canSubmit = confirmChecked && !saving;

  const submitButton = (compact = false) => (
    <button
      type="button"
      onClick={preview || locked || !canSubmit ? undefined : onSubmit}
      disabled={preview || saving || locked || !canSubmit}
      className={`inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors ${
        compact ? 'px-4 py-2' : 'px-5 py-3 sm:py-2.5'
      } ${
        locked
          ? 'bg-emerald-600/15 text-emerald-300 border border-emerald-500/25 cursor-default'
          : 'bg-gradient-to-r from-blue-600 to-violet-700 text-white disabled:opacity-40 disabled:cursor-not-allowed'
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
  );

  return (
    <>
      <section className="space-y-4 pt-4 border-t border-white/5 pb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-300">Подтверждение сдачи</h3>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed max-w-none">
            Отметьте галочку, если уже отправили ответ в форме или контесте выше.
          </p>
        </div>

        {needsSubmit && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
            Без подтверждения ниже сдача не засчитается.
          </div>
        )}

        {locked && submission?.status === 'submitted' && (
          <SubmitAcceptedBanner
            title="Сдача принята"
            detail="Преподаватель увидит работу в очереди проверки. Ответы остаются в форме или контесте — здесь появится оценка и комментарий."
          />
        )}

        {submitError && <p className="text-sm text-rose-400">{submitError}</p>}

        {locked && submission && <SubmissionResult submission={submission} maxScore={maxScore} />}

        {needsSubmit && (
          <label className="flex items-start gap-2.5 cursor-pointer group">
            <CheckboxBox
              checked={confirmChecked}
              onChange={(e) => setConfirmChecked(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm text-slate-300 group-hover:text-slate-200 leading-relaxed">
              Я отправил ответ в форме или контесте выше
            </span>
          </label>
        )}

        {/* На телефоне кнопки — сразу под галочкой, во всю ширину, «Отправить»
            сверху. Закреплённая внизу панель там мешала: висела с первой
            секунды, хотя без галочки в конце страницы не нажималась, и
            перекрывала меню кабинета. */}
        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={preview || locked ? undefined : onSaveDraft}
            disabled={preview || saving || locked}
            className={`inline-flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 rounded-xl text-sm font-medium transition-colors ${
              locked
                ? 'bg-white/5 text-slate-500 border border-white/5 cursor-default'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-50'
            }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {locked ? 'Черновик не нужен' : 'Сохранить черновик'}
          </button>
          {submitButton()}
        </div>

        {preview && (
          <p className="text-[11px] text-slate-600">
            Кнопки неактивны в предпросмотре — ученик сможет нажать их на опубликованной странице.
          </p>
        )}
      </section>

      {needsSubmit && (
        <div className="hidden lg:block fixed bottom-0 right-0 z-30 left-64 px-4 py-3 bg-slate-950/95 border-t border-white/10 backdrop-blur-md">
          <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Черновик
            </button>
            {submitButton(true)}
          </div>
        </div>
      )}
    </>
  );
}

export function HomeworkSubmissionStatusBadge({
  submission,
  maxScore = 10,
}: {
  submission: HomeworkPageSubmission;
  maxScore?: number;
}) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-md border ${SUBMISSION_STATUS_COLORS[submission.status]}`}>
      {SUBMISSION_STATUS_LABELS[submission.status]}
      {submission.score !== null && ` · ${formatHomeworkScoreShort(submission.score, maxScore)}`}
    </span>
  );
}
