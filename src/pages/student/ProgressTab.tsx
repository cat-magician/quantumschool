import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle, Loader2, Target } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import type { CourseProgress, HomeworkSubmission } from '../../lib/types';

export default function StudentProgressTab() {
  const { user } = useAuth();
  const [modules, setModules] = useState<CourseProgress[]>([]);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('course_progress').select('*').eq('user_id', user.id).order('module_index'),
      supabase.from('homework_submissions').select('*').eq('user_id', user.id),
    ]).then(([pRes, sRes]) => {
      if (pRes.data) setModules(pRes.data);
      if (sRes.data) setSubmissions(sRes.data);
      setLoading(false);
    });
  }, [user]);

  const stats = useMemo(() => {
    const graded = submissions.filter((s) => s.status === 'graded');
    const submitted = submissions.filter((s) => s.status === 'submitted');
    const avg = graded.length
      ? Math.round(graded.reduce((sum, s) => sum + (s.score ?? 0), 0) / graded.length * 10) / 10
      : null;
    const completedModules = modules.filter((m) => m.completed).length;
    return { graded: graded.length, submitted: submitted.length, total: submissions.length, avg, completedModules };
  }, [submissions, modules]);

  const progressPercent = modules.length
    ? Math.round((stats.completedModules / modules.length) * 100)
    : stats.graded > 0
      ? Math.min(100, stats.graded * 20)
      : 0;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard label="Проверено ДЗ" value={String(stats.graded)} icon={CheckCircle} />
        <StatCard label="На проверке" value={String(stats.submitted)} icon={Target} />
        <StatCard label="Средняя оценка" value={stats.avg !== null ? `${stats.avg}/10` : '—'} icon={BarChart3} />
      </div>

      <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-white">Общий прогресс</h3>
          <span className="text-2xl font-bold text-blue-400">{progressPercent}%</span>
        </div>
        <div className="h-3 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-violet-600 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {modules.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Модули курса</h3>
          {modules.map((m) => (
            <div key={m.id} className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-white">{m.module_title}</div>
                {m.score !== null && <div className="text-xs text-slate-500 mt-1">Балл: {m.score}%</div>}
              </div>
              {m.completed ? (
                <span className="text-xs px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                  Пройден
                </span>
              ) : (
                <span className="text-xs px-3 py-1 rounded-lg bg-slate-500/15 text-slate-400 border border-slate-500/20">
                  В процессе
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-8 text-center text-slate-400 text-sm">
          Прогресс по модулям появится после проверки домашних заданий
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof BarChart3 }) {
  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-5">
      <Icon className="w-5 h-5 text-blue-400 mb-3" />
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}
