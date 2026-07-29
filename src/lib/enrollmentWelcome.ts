const STORAGE_PREFIX = 'qc_enrollment_welcome_';

export function shouldShowEnrollmentWelcome(userId: string, isEnrolled: boolean): boolean {
  if (!isEnrolled) return false;
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${userId}`) !== '1';
  } catch {
    return false;
  }
}

export function markEnrollmentWelcomeShown(userId: string): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, '1');
  } catch {
    /* ignore */
  }
}
