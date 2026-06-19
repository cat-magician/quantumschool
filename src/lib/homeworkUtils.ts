import type { SupabaseClient } from '@supabase/supabase-js';
import type { HomeworkSubmissionStatus } from './types';

export const SUBMISSION_STATUS_LABELS: Record<HomeworkSubmissionStatus, string> = {
  draft: 'Черновик',
  submitted: 'На проверке',
  graded: 'Проверено',
};

export const SUBMISSION_STATUS_COLORS: Record<HomeworkSubmissionStatus, string> = {
  draft: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  submitted: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  graded: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
};

export function formatDueDate(iso: string | null) {
  if (!iso) return 'Без срока';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function isOverdue(dueAt: string | null) {
  if (!dueAt) return false;
  return new Date(dueAt) < new Date();
}

export async function syncProgressFromGrade(
  supabase: SupabaseClient,
  userId: string,
  moduleTitle: string,
  moduleIndex: number,
  score: number,
) {
  const { data: courses } = await supabase.from('courses').select('id').eq('is_active', true).limit(1);
  const courseId = courses?.[0]?.id;
  if (!courseId) return;

  await supabase.from('course_progress').upsert(
    {
      user_id: userId,
      course_id: courseId,
      module_title: moduleTitle,
      module_index: moduleIndex,
      completed: score >= 6,
      score: score * 10,
      completed_at: score >= 6 ? new Date().toISOString() : null,
    },
    { onConflict: 'user_id,course_id,module_index' },
  );
}

export async function maybeGrantAchievement(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  description: string,
  icon: string,
) {
  const { data: existing } = await supabase
    .from('achievements')
    .select('id')
    .eq('user_id', userId)
    .eq('title', title)
    .maybeSingle();
  if (existing) return;

  await supabase.from('achievements').insert({
    user_id: userId,
    title,
    description,
    icon,
  });
}
