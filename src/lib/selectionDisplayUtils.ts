import type { StageStatus, UserProfile } from './types';

export function adminStageLabel(
  status: StageStatus,
  score: number | null,
  submittedAt?: string | null,
  viewedAt?: string | null,
): string {
  if (score !== null) return 'Оценено';
  if (status === 'submitted' || submittedAt) return 'Отправлено';
  if (viewedAt) return 'Не отправлено';
  return 'Не приступал';
}

export function adminStageBadgeClass(
  status: StageStatus,
  score: number | null,
  submittedAt?: string | null,
  viewedAt?: string | null,
): string {
  if (score !== null) return 'text-blue-300 bg-blue-500/10 border-blue-500/20';
  if (status === 'submitted' || submittedAt) {
    return 'text-amber-300 bg-amber-500/10 border-amber-500/20';
  }
  if (viewedAt) return 'text-orange-300/90 bg-orange-500/10 border-orange-500/20';
  return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
}

/**
 * Решение по отбору. 'waiting' — решения ещё нет; 'waitlist' — лист ожидания,
 * это уже решение: места пока не дали, но и не отказали.
 */
export type SelectionVerdict = 'waiting' | 'accepted' | 'waitlist' | 'rejected';

export function selectionVerdict(
  profile: Pick<UserProfile, 'is_enrolled' | 'selection_rejected' | 'selection_waitlisted'>,
): SelectionVerdict {
  if (profile.is_enrolled) return 'accepted';
  if (profile.selection_rejected) return 'rejected';
  if (profile.selection_waitlisted) return 'waitlist';
  return 'waiting';
}

export type StudentStagePhase = 'pending' | 'awaiting_grade' | 'graded';

export function studentStagePhase(
  status: StageStatus,
  score: number | null,
  submittedAt?: string | null,
): StudentStagePhase {
  if (score !== null) return 'graded';
  if (status === 'submitted' || submittedAt) return 'awaiting_grade';
  return 'pending';
}

export function canStudentUnsubmit(
  status: StageStatus,
  score: number | null,
  submittedAt?: string | null,
): boolean {
  return studentStagePhase(status, score, submittedAt) === 'awaiting_grade';
}
