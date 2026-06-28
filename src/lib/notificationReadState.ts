import type { AppNotification } from './notificationsUtils';

const KEY_PREFIX = 'qc:notifications-read:';

function storageKey(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

export function getReadNotificationIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function markNotificationsRead(userId: string, ids: string[]) {
  if (!ids.length) return;
  const read = getReadNotificationIds(userId);
  for (const id of ids) read.add(id);
  localStorage.setItem(storageKey(userId), JSON.stringify([...read]));
}

export function isNotificationRead(userId: string, id: string): boolean {
  return getReadNotificationIds(userId).has(id);
}

export function countUnreadNotifications(userId: string, items: AppNotification[]): number {
  const read = getReadNotificationIds(userId);
  return items.filter((item) => !read.has(item.id)).length;
}

export function partitionNotifications(userId: string, items: AppNotification[]) {
  const read = getReadNotificationIds(userId);
  const unread = items.filter((item) => !read.has(item.id));
  const readItems = items.filter((item) => read.has(item.id));
  return { unread, readItems };
}
