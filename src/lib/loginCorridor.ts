import type { UserProfile } from './types';

export type LoginCorridor = 'teacher' | 'student';

const CORRIDOR_KEY = 'qc:login-corridor';
const STUDENT_UNLOCK_KEY = 'qc:student-corridor-unlocked:';

export function markTeacherLoginCorridor() {
  sessionStorage.setItem(CORRIDOR_KEY, 'teacher');
}

export function markStudentLoginCorridor() {
  sessionStorage.setItem(CORRIDOR_KEY, 'student');
}

export function getLoginCorridor(): LoginCorridor | null {
  const value = sessionStorage.getItem(CORRIDOR_KEY);
  return value === 'teacher' || value === 'student' ? value : null;
}

export function clearLoginCorridor() {
  sessionStorage.removeItem(CORRIDOR_KEY);
}

/** Участник открывал ученический кабинет при активной заявке преподавателя. */
export function markStudentCorridorUnlocked(userId: string) {
  localStorage.setItem(`${STUDENT_UNLOCK_KEY}${userId}`, '1');
}

export function isStudentCorridorUnlocked(userId: string): boolean {
  return localStorage.getItem(`${STUDENT_UNLOCK_KEY}${userId}`) === '1';
}

export function shouldShowTeacherApplicationGate(
  profile: Pick<UserProfile, 'role' | 'teacher_application'>,
  userId: string,
): boolean {
  if ((profile.role ?? 'student') !== 'student' || !profile.teacher_application) return false;

  const corridor = getLoginCorridor();
  if (corridor === 'student') return false;
  if (corridor === 'teacher') return true;

  return !isStudentCorridorUnlocked(userId);
}
