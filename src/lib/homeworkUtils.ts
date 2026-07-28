import type { SupabaseClient } from '@supabase/supabase-js';
import type { HomeworkSubmissionStatus } from './types';

export const DEFAULT_HOMEWORK_MAX_SCORE = 10;
export const HOMEWORK_MAX_SCORE_LIMIT = 1000;

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

export function roundHomeworkScore(value: number) {
  return Math.round(value * 100) / 100;
}

export function parseHomeworkMaxScore(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return null;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(trimmed)) return null;
  const n = roundHomeworkScore(parseFloat(trimmed));
  if (!Number.isFinite(n) || n <= 0 || n > HOMEWORK_MAX_SCORE_LIMIT) return null;
  return n;
}

export function parseHomeworkScore(
  raw: string,
  maxScore: number = DEFAULT_HOMEWORK_MAX_SCORE,
): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed === '') return null;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(trimmed)) return null;
  const n = roundHomeworkScore(parseFloat(trimmed));
  if (!Number.isFinite(n) || n < 0 || n > maxScore) return null;
  return n;
}

export function formatHomeworkScoreValue(score: number) {
  const rounded = roundHomeworkScore(score);
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function formatHomeworkScoreShort(score: number, maxScore: number = DEFAULT_HOMEWORK_MAX_SCORE) {
  return `${formatHomeworkScoreValue(score)}/${formatHomeworkScoreValue(maxScore)}`;
}

export function homeworkScoreRatio(score: number, maxScore: number = DEFAULT_HOMEWORK_MAX_SCORE) {
  if (maxScore <= 0) return 0;
  return score / maxScore;
}

export function computeWeightedHomeworkAvg(
  entries: { score: number; maxScore: number }[],
): number | null {
  if (entries.length === 0) return null;
  const totalScore = entries.reduce((sum, entry) => sum + entry.score, 0);
  const totalMax = entries.reduce((sum, entry) => sum + entry.maxScore, 0);
  if (totalMax <= 0) return null;
  return roundHomeworkScore((totalScore / totalMax) * DEFAULT_HOMEWORK_MAX_SCORE);
}

export function isExcellentHomeworkScore(score: number, maxScore: number = DEFAULT_HOMEWORK_MAX_SCORE) {
  return homeworkScoreRatio(score, maxScore) >= 0.8;
}

export function normalizeHomeworkScoreInput(raw: string) {
  const v = raw.replace(',', '.');
  if (v === '' || /^\d{0,4}(\.\d{0,2})?$/.test(v)) return v;
  return null;
}

export async function syncProgressFromGrade(
  supabase: SupabaseClient,
  userId: string,
  moduleTitle: string,
  moduleIndex: number,
  score: number,
  maxScore: number = DEFAULT_HOMEWORK_MAX_SCORE,
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
      completed: true,
      score: Math.round(homeworkScoreRatio(score, maxScore) * 100),
      completed_at: new Date().toISOString(),
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
  const { error } = await supabase.rpc('grant_achievement', {
    target_user_id: userId,
    p_title: title,
    p_description: description,
    p_icon: icon,
  });
  if (error && !error.message.includes('not_allowed')) {
    console.error('grant_achievement:', error.message);
  }
}
