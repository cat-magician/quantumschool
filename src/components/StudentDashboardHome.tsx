import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Calendar, CheckCircle2, Circle, Clock, FlaskConical, Loader2, Send,
} from 'lucide-react';
import type { UserProfile, ScheduleEvent } from '../lib/types';
import { supabase } from '../lib/supabase';
import {
  buildEnrolledHomeworkProgress,
  buildSelectionChecklist,
  homeworkDueLabel,
  nextEnrolledAction,
  nextScheduleEvent,
  nextSelectionAction,
  type StudentNextAction,
} from '../lib/studentHomeActions';
import { selectionVerdict } from '../lib/selectionDisplayUtils';
import { HOME_GUIDE } from '../lib/dashboardHelpCopy';
import { formatEventDate, formatEventTime } from '../lib/scheduleUtils';
import type { LearningSubTab } from '../pages/student/LearningTab';

export type { StudentNextAction };

type StudentDashboardHomeProps = {
  profile: UserProfile;
  userId: string;
  displayName: string;
  isEnrolled: boolean;
  onAction: (action: StudentNextAction) => void;
  onOpenHomework?: (pageId: string) => void;
};

function ChecklistIcon({ status }: { status: 'done' | 'current' | 'todo' | 'waiting' }) {
  if (status === 'done') return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
  if (status === 'current') return <Send className="w-5 h-5 text-blue-400 shrink-0" />;
  if (status === 'waiting') return <Clock className="w-5 h-5 text-amber-400 shrink-0" />;
  return <Circle className="w-5 h-5 text-slate-600 shrink-0" />;
}

export default function StudentDashboardHome({
  profile,
  userId,
  displayName,
  isEnrolled,
  onAction,
  onOpenHomework,
}: StudentDashboardHomeProps) {
  const [loading, setLoading] = useState(isEnrolled);
  const [nextEvent, setNextEvent] = useState<ScheduleEvent | null>(null);
  const [hwProgress, setHwProgress] = useState<ReturnType<typeof buildEnrolledHomeworkProgress>>([]);

  useEffect(() => {
    if (!isEnrolled || !userId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      supabase.from('schedule_events').select('*').order('scheduled_at'),
      supabase.from('homework_pages').select('id, title, due_at, max_score').eq('is_published', true),
      supabase.from('homework_page_submissions').select('*').eq('user_id', userId),
    ]).then(([eventsRes, pagesRes, subsRes]) => {
      if (cancelled) return;
      setNextEvent(nextScheduleEvent((eventsRes.data ?? []) as ScheduleEvent[]));
      setHwProgress(buildEnrolledHomeworkProgress(userId, pagesRes.data ?? [], subsRes.data ?? []));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isEnrolled, userId]);

  const greeting = displayName.trim() || 'добро пожаловать';
  const verdict = selectionVerdict(profile.is_enrolled, profile.selection_rejected ?? false);
  const selectionChecklist = useMemo(() => buildSelectionChecklist(profile), [profile]);
  const selectionAction = useMemo(() => nextSelectionAction(profile), [profile]);
  const enrolledAction = useMemo(
    () => (isEnrolled ? nextEnrolledAction(hwProgress, nextEvent) : null),
    [isEnrolled, hwProgress, nextEvent],
  );
  const action = isEnrolled ? enrolledAction : selectionAction;
  const pendingHomework = hwProgress.filter((p) => p.status === 'none' || p.status === 'draft').length;

  return (
    <div className="max-w-2xl mx-auto space-y-5 py-4 sm:py-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Здравствуйте, {greeting}</h2>
        <p className="text-slate-400 text-sm">
          {isEnrolled
            ? 'Ваш курс — материалы, занятия и домашние задания'
            : verdict === 'rejected'
              ? 'Отбор завершён — итоги во вкладке «Результаты»'
              : 'Отборочный этап — пройдите шаги ниже в удобном порядке'}
        </p>
      </div>

      {action && (
        <button
          type="button"
          onClick={() => onAction(action)}
          className="w-full text-left rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-600/25 to-violet-600/20 p-5 sm:p-6 hover:from-blue-600/35 hover:to-violet-600/25 transition-colors group"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-300 mb-2">
            Следующий шаг
          </p>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-white mb-1">{action.label}</p>
              <p className="text-sm text-slate-400 leading-relaxed">{action.description}</p>
            </div>
            <ArrowRight className="w-5 h-5 text-blue-300 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </button>
      )}

      {!isEnrolled && verdict !== 'rejected' && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">Ваш путь на отборе</h3>
          <ul className="space-y-2">
            {selectionChecklist.map((item) => (
              <li
                key={item.id}
                className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ${
                  item.status === 'current' ? 'bg-blue-500/10 border border-blue-500/20' : ''
                }`}
              >
                <ChecklistIcon status={item.status} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${item.status === 'done' ? 'text-slate-400' : 'text-white'}`}>
                    {item.label}
                  </p>
                  {item.detail && (
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.detail}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isEnrolled && (
        <section className="grid sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onAction({ label: '', description: '', tab: 'learning', learningSub: 'homework', emphasis: 'secondary' })}
            className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-left hover:bg-slate-900/80 transition-colors"
          >
            <p className="text-xs text-slate-500 mb-1">Домашние задания</p>
            {loading ? (
              <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
            ) : (
              <p className="text-lg font-semibold text-white tabular-nums">
                {pendingHomework > 0 ? `${pendingHomework} к сдаче` : 'Всё сдано'}
              </p>
            )}
          </button>
          <button
            type="button"
            onClick={() => onAction({ label: '', description: '', tab: 'schedule', emphasis: 'secondary' })}
            className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-left hover:bg-slate-900/80 transition-colors"
          >
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Ближайшее занятие
            </p>
            {loading ? (
              <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
            ) : nextEvent ? (
              <>
                <p className="text-sm font-semibold text-white truncate">{nextEvent.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatEventDate(nextEvent.scheduled_at)}, {formatEventTime(nextEvent.scheduled_at)}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400">Пока нет событий</p>
            )}
          </button>
        </section>
      )}

      {isEnrolled && hwProgress.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Домашние задания</h3>
          <ul className="space-y-1">
            {hwProgress.slice(0, 4).map((page) => {
              const due = homeworkDueLabel(page.dueAt);
              const statusLabel =
                page.status === 'graded'
                  ? `Оценка ${page.score}`
                  : page.status === 'submitted'
                    ? 'На проверке'
                    : page.status === 'draft'
                      ? 'Черновик'
                      : due ?? 'Не сдано';
              const statusClass =
                page.status === 'draft'
                  ? 'text-amber-400'
                  : page.status === 'none'
                    ? due?.includes('Просрочено') ? 'text-rose-400' : 'text-violet-300'
                    : due?.includes('Просрочено') ? 'text-rose-400' : 'text-slate-500';
              const canOpen = !!onOpenHomework;
              return (
                <li key={page.pageId}>
                  {canOpen ? (
                    <button
                      type="button"
                      onClick={() => onOpenHomework(page.pageId)}
                      className="w-full flex items-center justify-between gap-2 text-sm py-1.5 px-2 -mx-2 rounded-lg hover:bg-white/5 transition-colors text-left group"
                    >
                      <span className="text-slate-300 truncate group-hover:text-white">{page.title}</span>
                      <span className={`shrink-0 text-xs ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-between gap-2 text-sm py-1">
                      <span className="text-slate-300 truncate">{page.title}</span>
                      <span className={`shrink-0 text-xs ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {isEnrolled && (
        <section className="rounded-2xl border border-white/5 bg-slate-900/30 px-4 py-3 space-y-2">
          <p className="text-xs text-slate-400 leading-relaxed">{HOME_GUIDE.student_enrolled.lead}</p>
          <ul className="text-xs text-slate-500 space-y-1">
            {HOME_GUIDE.student_enrolled.items.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-slate-600 shrink-0">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isEnrolled && verdict !== 'rejected' && (
        <p className="text-xs text-slate-600 flex items-start gap-2 px-1">
          <FlaskConical className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Этапы 1 и 2 можно проходить параллельно — главное подтвердить отправку кнопкой на странице этапа.
        </p>
      )}
    </div>
  );
}

export type { LearningSubTab };
