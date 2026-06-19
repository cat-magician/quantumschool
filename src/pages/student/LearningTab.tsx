import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import HomeworkCards from '../../components/HomeworkCards';
import type { HomeworkAssignment, HomeworkSubmission } from '../../lib/types';
import { maybeGrantAchievement } from '../../lib/homeworkUtils';
import { homeworkLoadError } from '../../lib/homeworkLoadError';

export default function StudentLearningTab() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, HomeworkSubmission>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    const [aRes, sRes] = await Promise.all([
      supabase
        .from('homework_assignments')
        .select('*, schedule_event:schedule_events(id, title, scheduled_at)')
        .eq('is_published', true)
        .order('created_at', { ascending: false }),
      supabase.from('homework_submissions').select('*').eq('user_id', user.id),
    ]);
    if (aRes.error) setLoadError(homeworkLoadError(aRes.error.message));
    else setAssignments((aRes.data ?? []) as HomeworkAssignment[]);
    if (sRes.data) {
      setSubmissions(Object.fromEntries(sRes.data.map((s) => [s.assignment_id, s])));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const upsertSubmission = async (assignmentId: string, status: 'draft' | 'submitted', answer: string) => {
    if (!user) return;
    setSaving(true);
    setSubmitError('');
    const existing = submissions[assignmentId];
    const now = new Date().toISOString();
    const payload = {
      assignment_id: assignmentId,
      user_id: user.id,
      answer_text: answer,
      status,
      submitted_at: status === 'submitted' ? now : existing?.submitted_at ?? null,
      updated_at: now,
    };

    const result = existing
      ? await supabase.from('homework_submissions').update(payload).eq('id', existing.id)
      : await supabase.from('homework_submissions').insert(payload);

    setSaving(false);
    if (result.error) {
      setSubmitError('Не удалось сохранить ответ');
      return;
    }
    if (status === 'submitted') {
      await maybeGrantAchievement(supabase, user.id, 'Первое ДЗ', 'Вы отправили работу на проверку', 'send');
    }
    load();
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Домашние задания</h2>
        <p className="text-slate-400 text-sm leading-relaxed">
          Карточки заданий к занятиям. Откройте задание, изучите материалы и отправьте ответ на проверку.
        </p>
      </div>

      <HomeworkCards
        assignments={assignments}
        submissions={submissions}
        loading={loading}
        loadError={loadError}
        emptyMessage="Преподаватель ещё не опубликовал задания"
        saving={saving}
        submitError={submitError}
        onSaveDraft={(id, answer) => upsertSubmission(id, 'draft', answer)}
        onSubmit={(id, answer) => upsertSubmission(id, 'submitted', answer)}
      />
    </div>
  );
}
