import type { StageStatus } from './types';
import { canStudentUnsubmit } from './selectionDisplayUtils';

export async function markStageViewed(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  userId: string,
  stage: 1 | 2,
) {
  const atField = stage === 1 ? 'stage1_viewed_at' : 'stage2_viewed_at';
  const now = new Date().toISOString();

  const { data: profile } = await supabase
    .from('user_profiles')
    .select(atField)
    .eq('id', userId)
    .maybeSingle();

  if (profile?.[atField as 'stage1_viewed_at' | 'stage2_viewed_at']) {
    return { error: null };
  }

  return supabase.from('user_profiles').update({
    [atField]: now,
    updated_at: now,
  }).eq('id', userId);
}

export async function markStageSubmitted(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  userId: string,
  stage: 1 | 2,
  options?: { essayPublished?: boolean; contestPublished?: boolean },
) {
  const field = stage === 1 ? 'stage1_status' : 'stage2_status';
  const atField = stage === 1 ? 'stage1_submitted_at' : 'stage2_submitted_at';
  const viewField = stage === 1 ? 'stage1_viewed_at' : 'stage2_viewed_at';
  const now = new Date().toISOString();

  const { data: profile } = await supabase
    .from('user_profiles')
    .select(field)
    .eq('id', userId)
    .maybeSingle();

  const current = profile?.[field as 'stage1_status' | 'stage2_status'];
  if (current !== 'pending') return { error: 'Уже отмечено' };

  if (stage === 1 && !options?.essayPublished) {
    return { error: 'Форма ещё не опубликована' };
  }

  if (stage === 2 && !options?.contestPublished) {
    return { error: 'Контест ещё не опубликован' };
  }

  return supabase.from('user_profiles').update({
    [field]: 'submitted',
    [atField]: now,
    [viewField]: now,
    updated_at: now,
  }).eq('id', userId);
}

export async function markStageUnsubmitted(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  userId: string,
  stage: 1 | 2,
) {
  const field = stage === 1 ? 'stage1_status' : 'stage2_status';
  const atField = stage === 1 ? 'stage1_submitted_at' : 'stage2_submitted_at';
  const scoreField = stage === 1 ? 'stage1_score' : 'stage2_score';
  const now = new Date().toISOString();

  const { data: profile } = await supabase
    .from('user_profiles')
    .select(`${field}, ${scoreField}, ${atField}`)
    .eq('id', userId)
    .maybeSingle();

  const score = profile?.[scoreField as 'stage1_score' | 'stage2_score'] ?? null;
  const current = profile?.[field as 'stage1_status' | 'stage2_status'] as StageStatus | undefined;
  const submittedAt = profile?.[atField as 'stage1_submitted_at' | 'stage2_submitted_at'];

  if (!canStudentUnsubmit(current ?? 'pending', score, submittedAt)) {
    if (score !== null) return { error: 'Нельзя отменить после выставления оценки' };
    return { error: 'Отправка не отмечена' };
  }

  return supabase.from('user_profiles').update({
    [field]: 'pending',
    [atField]: null,
    updated_at: now,
  }).eq('id', userId);
}
