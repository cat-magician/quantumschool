import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle, Loader2, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import type { Achievement, CourseProgress, HomeworkPage, HomeworkPageSubmission } from '../../lib/types';
import {
  buildHomeworkPageProgress,
  computeProgressPercent,
  formatAchievementsProgress,
  HOMEWORK_STATUS_COLORS,
  HOMEWORK_STATUS_LABELS,
} from '../../lib/progressUtils';
import { collectEarnedKeys } from '../../lib/achievementUtils';
import AchievementBadgeStrip from '../../components/achievements/AchievementBadgeStrip';
import { SUBMISSION_STATUS_LABELS } from '../../lib/homeworkUtils';

export default function StudentProgressTab() {
  const { user } = useAuth();
  const [publishedPages, setPublishedPages] = useState<Pick<HomeworkPage, 'id' | 'title' | 'due_at'>[]>([]);
  const [submissions, setSubmissions] = useState<HomeworkPageSubmission[]>([]);
  const [modules, setModules] = useState<CourseProgress[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [lessonCounts, setLessonCounts] = useState({ lectures: 0, seminars: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('homework_pages').select('id, title, due_at').eq('is_published', true).order('due_at'),
      supabase.from('homework_page_submissions').select('*').eq('user_id', user.id),
      supabase.from('course_progress').select('*').eq('user_id', user.id).order('module_index'),
      supabase.from('achievements').select('*').eq('user_id', user.id).order('earned_at', { ascending: false }),
      supabase.from('lesson_pages').select('id, lesson_type').eq('is_published', true),
    ]).then(([pagesRes, subsRes, progRes, achRes, lessonsRes]) => {
      if (pagesRes.data) setPublishedPages(pagesRes.data as Pick<HomeworkPage, 'id' | 'title' | 'due_at'>[]);
      if (subsRes.data) setSubmissions(subsRes.data as HomeworkPageSubmission[]);
      if (progRes.data) setModules(progRes.data);
      if (achRes.data) setAchievements(achRes.data);
      if (lessonsRes.data) {
        const rows = lessonsRes.data as { lesson_type: string }[];
        setLessonCounts({
          lectures: rows.filter((r) => r.lesson_type === 'lecture').length,
          seminars: rows.filter((r) => r.lesson_type === 'seminar').length,
        });
      }
      setLoading(false);
    });
  }, [user]);

  const homeworkPages = useMemo(
    () => buildHomeworkPageProgress(publishedPages, submissions, user?.id ?? ''),
    [publishedPages, submissions, user?.id],
  );

  const earnedKeys = useMemo(
    () => (user ? collectEarnedKeys(achievements, user.id) : []),
    [achievements, user],
  );

  const stats = useMemo(() => {
    const graded = homeworkPages.filter((p) => p.status === 'graded');
    const submitted = homeworkPages.filter((p) => p.status === 'submitted');
    const gradedScores = graded.map((p) => p.score).filter((s): s is number => s !== null);
    const avg = gradedScores.length
      ? Math.round((gradedScores.reduce((a, b) => a + b, 0) / gradedScores.length) * 10) / 10
      : null;
    return {
      graded: graded.length,
      submitted: submitted.length,
      avg,
      progressPercent: computeProgressPercent(homeworkPages),
    };
  }, [homeworkPages]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
        <StatCard label="Проверено" value={String(stats.graded)} icon={CheckCircle} />
        <StatCard label="На проверке" value={String(stats.submitted)} icon={Send} />
        <StatCard label="Средняя" value={stats.avg !== null ? `${stats.avg}/10` : '—'} icon={BarChart3} />
      </div>

      {user && (
        <div className="bg-slate-900/60 border border-white/5 rounded-xl px-4 py-3 overflow-visible">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Достижения</h3>
            <span className="text-xs font-semibold text-white tabular-nums">{formatAchievementsProgress(earnedKeys.length)}</span>
          </div>
          <AchievementBadgeStrip
            earnedKeys={earnedKeys}
            achievements={achievements}
            userId={user.id}
            size="md"
            showLocked
            showHints
            wrap
          />
          <p className="text-[11px] text-slate-500 mt-3">Наведите на значок, чтобы узнать, как получить достижение</p>
        </div>
      )}

      <div className="bg-slate-900/60 border border-white/5 rounded-xl px-4 py-3">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="text-sm font-semibold text-white">Общий прогресс</h3>
          <span className="text-lg font-bold text-blue-400 tabular-nums">{stats.progressPercent}%</span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-violet-600 rounded-full transition-all duration-500"
            style={{ width: `${stats.progressPercent}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          {lessonCounts.lectures} лекций · {lessonCounts.seminars} семинаров в «Обучении»
        </p>
      </div>

      {homeworkPages.length > 0 ? (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-0.5">Домашние задания</h3>
          <div className="max-h-[min(50vh,18rem)] overflow-y-auto space-y-1.5 pr-0.5">
            {homeworkPages.map((p) => (
              <div
                key={p.pageId}
                className="bg-slate-900/60 border border-white/5 rounded-xl px-3 py-2.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white truncate">{p.title}</div>
                  {p.status === 'submitted' && (
                    <div className="text-xs text-amber-400/80 mt-0.5">{SUBMISSION_STATUS_LABELS.submitted}</div>
                  )}
                </div>
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  {p.score !== null && (
                    <div className="text-right tabular-nums leading-none">
                      <span className="text-xl font-bold text-white">{p.score}</span>
                      <span className="text-sm text-slate-500">/10</span>
                    </div>
                  )}
                  <span className={`text-[11px] px-2 py-0.5 rounded-md border ${HOMEWORK_STATUS_COLORS[p.status]}`}>
                    {HOMEWORK_STATUS_LABELS[p.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-white/5 rounded-xl px-4 py-6 text-center text-slate-400 text-sm">
          Домашние задания появятся, когда преподаватель опубликует их
        </div>
      )}

      {modules.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-0.5">Модули</h3>
          {modules.map((m) => (
            <div key={m.id} className="bg-slate-900/60 border border-white/5 rounded-xl px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-white truncate">{m.module_title}</div>
                {m.score !== null && (
                  <div className="text-[11px] text-slate-500 mt-0.5">Балл: {Math.round(m.score / 10)}/10</div>
                )}
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 flex-shrink-0">
                Оценено
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof BarChart3 }) {
  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-xl px-3 py-2.5 min-h-[4.5rem] flex flex-col justify-between">
      <Icon className="w-4 h-4 text-blue-400" />
      <div>
        <div className="text-lg font-bold text-white leading-none">{value}</div>
        <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wide">{label}</div>
      </div>
    </div>
  );
}
