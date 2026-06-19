import { useState } from 'react';
import {
  AlertCircle, BookOpen, ChevronRight, Clock, ExternalLink, FileText, Loader2, Save, Send, X,
} from 'lucide-react';
import type { HomeworkAssignment, HomeworkSubmission } from '../lib/types';
import {
  formatDueDate,
  isOverdue,
  SUBMISSION_STATUS_COLORS,
  SUBMISSION_STATUS_LABELS,
} from '../lib/homeworkUtils';

interface HomeworkCardsProps {
  assignments: HomeworkAssignment[];
  submissions?: Record<string, HomeworkSubmission>;
  loading?: boolean;
  loadError?: string | null;
  emptyMessage?: string;
  readOnly?: boolean;
  saving?: boolean;
  submitError?: string;
  onSaveDraft?: (assignmentId: string, answer: string) => void;
  onSubmit?: (assignmentId: string, answer: string) => void;
}

export default function HomeworkCards({
  assignments,
  submissions = {},
  loading = false,
  loadError = null,
  emptyMessage = 'Заданий пока нет',
  readOnly = false,
  saving = false,
  submitError = '',
  onSaveDraft,
  onSubmit,
}: HomeworkCardsProps) {
  const [selected, setSelected] = useState<HomeworkAssignment | null>(null);
  const [answer, setAnswer] = useState('');

  const openAssignment = (a: HomeworkAssignment) => {
    setSelected(a);
    setAnswer(submissions[a.id]?.answer_text ?? '');
  };

  const closeDetail = () => {
    setSelected(null);
    setAnswer('');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-6 flex gap-4">
        <AlertCircle className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-rose-300 leading-relaxed">{loadError}</p>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-10 text-center">
        <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid sm:grid-cols-2 gap-4">
        {assignments.map((a) => {
          const sub = submissions[a.id];
          const overdue = !readOnly && isOverdue(a.due_at) && sub?.status !== 'graded' && sub?.status !== 'submitted';
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => openAssignment(a)}
              className="text-left bg-slate-900/60 border border-white/5 hover:border-blue-500/30 rounded-2xl p-5 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center mb-4">
                <BookOpen className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="font-semibold text-white mb-2 group-hover:text-blue-300 transition-colors">{a.title}</h3>
              {a.schedule_event?.title && (
                <p className="text-xs text-slate-500 mb-2">{a.schedule_event.title}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1 ${overdue ? 'text-rose-400' : 'text-slate-500'}`}>
                  <Clock className="w-3 h-3" />
                  {formatDueDate(a.due_at)}
                </span>
                {!a.is_published && (
                  <span className="px-2 py-0.5 rounded-md border text-amber-300 bg-amber-500/10 border-amber-500/20">
                    Черновик
                  </span>
                )}
                {sub && (
                  <span className={`px-2 py-0.5 rounded-md border ${SUBMISSION_STATUS_COLORS[sub.status]}`}>
                    {SUBMISSION_STATUS_LABELS[sub.status]}
                    {sub.score !== null && ` · ${sub.score}/10`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-4 text-sm text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                Открыть <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">{selected.title}</h2>
                {selected.schedule_event?.title && (
                  <p className="text-sm text-slate-500 mt-1">Занятие: {selected.schedule_event.title}</p>
                )}
              </div>
              <button type="button" onClick={closeDetail} className="p-2 rounded-lg hover:bg-white/5 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {selected.lesson_summary && <DetailSection title="О занятии" content={selected.lesson_summary} />}
              {selected.materials && <DetailSection title="Материалы" content={selected.materials} />}
              {selected.tasks && <DetailSection title="Задания" content={selected.tasks} icon={FileText} />}
              {selected.external_url && (
                <a
                  href={selected.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-600/30 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Открыть задание в Яндекс.Контесте
                </a>
              )}

              {!readOnly && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Ваш ответ</label>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    rows={6}
                    disabled={submissions[selected.id]?.status === 'graded' || submissions[selected.id]?.status === 'submitted'}
                    placeholder="Запишите решение или комментарий к отправленной работе..."
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none disabled:opacity-60"
                  />
                  {submissions[selected.id]?.feedback && (
                    <div className="mt-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-300">
                      <strong>Комментарий преподавателя:</strong> {submissions[selected.id].feedback}
                    </div>
                  )}
                </div>
              )}

              {!readOnly && submitError && <p className="text-sm text-rose-400">{submitError}</p>}

              {!readOnly && submissions[selected.id]?.status === 'submitted' && (
                <p className="text-sm text-amber-300/90">
                  Ответ отправлен на проверку — дождитесь оценки преподавателя.
                </p>
              )}

              {!readOnly && submissions[selected.id]?.status === 'graded' && submissions[selected.id]?.score !== null && (
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-white tabular-nums">{submissions[selected.id].score}</span>
                  <span className="text-slate-500 text-sm pb-1">из 10</span>
                </div>
              )}

              {!readOnly && submissions[selected.id]?.status !== 'graded' && submissions[selected.id]?.status !== 'submitted' && (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => selected && onSaveDraft?.(selected.id, answer)}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Сохранить черновик
                  </button>
                  <button
                    type="button"
                    onClick={() => selected && onSubmit?.(selected.id, answer)}
                    disabled={saving || !answer.trim() || submissions[selected.id]?.status === 'submitted'}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-700 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Отправить на проверку
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DetailSection({ title, content, icon: Icon = FileText }: { title: string; content: string; icon?: typeof FileText }) {
  return (
    <div className="bg-white/5 border border-white/5 rounded-xl p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
        <Icon className="w-4 h-4 text-blue-400" />
        {title}
      </div>
      <p className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  );
}
