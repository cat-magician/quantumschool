const PROMOTED_KEY = 'qc:teacher-promoted:';
const HAD_PENDING_KEY = 'qc:had-pending-teacher-app:';

function promotedKey(userId: string) {
  return `${PROMOTED_KEY}${userId}`;
}

function hadPendingKey(userId: string) {
  return `${HAD_PENDING_KEY}${userId}`;
}

/** Ученик подал заявку преподавателя — для плашки после одобрения. */
export function markHadPendingTeacherApplication(userId: string) {
  localStorage.setItem(hadPendingKey(userId), '1');
}

export function markTeacherPromoted(userId: string) {
  sessionStorage.setItem(promotedKey(userId), '1');
}

export function shouldShowTeacherPromotedBanner(userId: string): boolean {
  return (
    sessionStorage.getItem(promotedKey(userId)) === '1'
    || localStorage.getItem(hadPendingKey(userId)) === '1'
  );
}

export function dismissTeacherPromotedBanner(userId: string) {
  sessionStorage.removeItem(promotedKey(userId));
  localStorage.removeItem(hadPendingKey(userId));
}
