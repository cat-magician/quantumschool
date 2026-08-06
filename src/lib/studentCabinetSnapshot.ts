import type { StudentDashboardState } from './dashboardNavigation';

const SNAPSHOT_KEY = 'qc:student-cabinet:';
const JUST_DEMOTED_KEY = 'qc:just-demoted:';

function snapshotKey(userId: string) {
  return `${SNAPSHOT_KEY}${userId}`;
}

function justDemotedKey(userId: string) {
  return `${JUST_DEMOTED_KEY}${userId}`;
}

export function saveStudentCabinetSnapshot(userId: string, state: StudentDashboardState) {
  try {
    localStorage.setItem(snapshotKey(userId), JSON.stringify(state));
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadStudentCabinetSnapshot(userId: string): StudentDashboardState | null {
  try {
    const raw = localStorage.getItem(snapshotKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudentDashboardState;
    if (!parsed || typeof parsed !== 'object' || !parsed.tab) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** После исключения из штата преподавателей — один раз восстановить ученический кабинет. */
export function markJustDemotedFromTeacher(userId: string) {
  sessionStorage.setItem(justDemotedKey(userId), '1');
}

export function consumeJustDemotedFromTeacher(userId: string): boolean {
  const key = justDemotedKey(userId);
  if (sessionStorage.getItem(key) !== '1') return false;
  sessionStorage.removeItem(key);
  return true;
}
