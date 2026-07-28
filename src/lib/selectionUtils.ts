import type { StageStatus } from './types';
import { canStudentUnsubmit } from './selectionDisplayUtils';

/** Колонки выбираются динамически, поэтому типы supabase-js здесь бесполезны. */
type ProfileFields = Record<string, string | number | null>;

export async function markStageViewed(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  userId: string,
  stage: 1 | 2,
) {
  const atField = stage === 1 ? 'stage1_viewed_at' : 'stage2_viewed_at';
  const now = new Date().toISOString();

  const { data } = await supabase
    .from('user_profiles')
    .select(atField)
    .eq('id', userId)
    .maybeSingle();

  if ((data as ProfileFields | null)?.[atField]) {
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
) {
  const field = stage === 1 ? 'stage1_status' : 'stage2_status';
  const atField = stage === 1 ? 'stage1_submitted_at' : 'stage2_submitted_at';
  const viewField = stage === 1 ? 'stage1_viewed_at' : 'stage2_viewed_at';
  const now = new Date().toISOString();

  const { data } = await supabase
    .from('user_profiles')
    .select(field)
    .eq('id', userId)
    .maybeSingle();

  const current = (data as ProfileFields | null)?.[field];
  if (current !== 'pending') return { error: 'Уже отмечено' };

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

  const { data } = await supabase
    .from('user_profiles')
    .select(`${field}, ${scoreField}, ${atField}`)
    .eq('id', userId)
    .maybeSingle();

  const profile = data as ProfileFields | null;
  const score = (profile?.[scoreField] as number | null | undefined) ?? null;
  const current = profile?.[field] as StageStatus | undefined;
  const submittedAt = profile?.[atField] as string | null | undefined;

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

export async function markQuestionnaireSubmitted(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  userId: string,
) {
  const now = new Date().toISOString();
  return supabase.from('user_profiles').update({
    questionnaire_submitted_at: now,
    updated_at: now,
  }).eq('id', userId);
}

export async function markQuestionnaireUnsubmitted(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  userId: string,
) {
  const now = new Date().toISOString();
  return supabase.from('user_profiles').update({
    questionnaire_submitted_at: null,
    updated_at: now,
  }).eq('id', userId);
}
