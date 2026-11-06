import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';
import { achievementImageSrc } from '../lib/achievementUtils';
import { ACHIEVEMENT_CHECK_EVENT, loadAchievementCatalog } from '../lib/achievementApi';
import { publicAsset } from '../lib/appPaths';

type CacheEntry = {
  at: number;
  urls: string[];
  version: number;
  loadingVersion: number | null;
};

type PendingUser = { userId: string; version: number };

const EMPTY_URLS: string[] = [];
const cache = new Map<string, CacheEntry>();
const listeners = new Map<string, Set<() => void>>();
const pendingRefreshes = new Map<string, boolean>();
const TTL_MS = 60_000;
const PASSIVE_REFRESH_THROTTLE_MS = 15_000;
const USERS_PER_BATCH = 100;
const PAGE_SIZE = 500;
let pollTimer: number | undefined;
let flushTimer: number | undefined;
let flushing = false;
let lastPassiveRefreshAt = 0;

function entryFor(userId: string): CacheEntry {
  let entry = cache.get(userId);
  if (!entry) {
    entry = { at: 0, urls: EMPTY_URLS, version: 0, loadingVersion: null };
    cache.set(userId, entry);
  }
  return entry;
}

function scheduleFlush() {
  if (flushing || flushTimer !== undefined || pendingRefreshes.size === 0) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = undefined;
    void flushPendingRefreshes();
  }, 0);
}

function refresh(userId: string, force = false) {
  const entry = entryFor(userId);
  if (entry.loadingVersion === entry.version) return;
  if (!force && Date.now() - entry.at < TTL_MS) return;
  pendingRefreshes.set(userId, force || pendingRefreshes.get(userId) === true);
  scheduleFlush();
}

function publish(user: PendingUser, next: string[]) {
  const entry = entryFor(user.userId);
  if (entry.version !== user.version) return;
  entry.at = Date.now();
  if (entry.urls.length !== next.length || entry.urls.some((url, i) => url !== next[i])) {
    entry.urls = next.length > 0 ? next : EMPTY_URLS;
    listeners.get(user.userId)?.forEach((listener) => listener());
  }
}

async function loadBatch(users: PendingUser[], imageByCode: Map<string, string>) {
  const urlsByUser = new Map(users.map(({ userId }) => [userId, [] as string[]]));
  if (imageByCode.size > 0) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('achievements')
        .select('user_id, code, earned_at, id')
        .in('user_id', users.map(({ userId }) => userId))
        .in('code', [...imageByCode.keys()])
        .order('earned_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      const rows = data ?? [];
      for (const row of rows) {
        const urls = urlsByUser.get(row.user_id);
        const src = row.code ? imageByCode.get(row.code) : undefined;
        if (urls && urls.length < 3 && src) urls.push(src);
      }
      if (rows.length < PAGE_SIZE || [...urlsByUser.values()].every((urls) => urls.length === 3)) break;
    }
  }
  for (const user of users) publish(user, urlsByUser.get(user.userId) ?? EMPTY_URLS);
}

async function flushPendingRefreshes() {
  if (flushing || pendingRefreshes.size === 0) return;
  flushing = true;
  const requests = [...pendingRefreshes];
  pendingRefreshes.clear();
  const users = requests.map(([userId]) => ({ userId, version: entryFor(userId).version }));
  for (const user of users) entryFor(user.userId).loadingVersion = user.version;

  try {
    const catalog = await loadAchievementCatalog({
      forceRefresh: requests.some(([, force]) => force),
      strict: true,
    });
    const imageByCode = new Map(catalog.map((definition) => [
      definition.code,
      achievementImageSrc(definition.image_url) ?? publicAsset('/logo_qc.svg'),
    ]));
    const groups: PendingUser[][] = [];
    for (let i = 0; i < users.length; i += USERS_PER_BATCH) groups.push(users.slice(i, i + USERS_PER_BATCH));
    let groupIndex = 0;
    await Promise.all(Array.from({ length: Math.min(3, groups.length) }, async () => {
      while (groupIndex < groups.length) {
        const group = groups[groupIndex++];
        try {
          await loadBatch(group, imageByCode);
        } catch {
          // A failed page leaves this group's last successful snapshots intact.
        }
      }
    }));
  } catch {
    // Keep the last successful result during a temporary catalog failure.
  } finally {
    for (const user of users) {
      const entry = entryFor(user.userId);
      if (entry.loadingVersion === user.version) entry.loadingVersion = null;
    }
    flushing = false;
    scheduleFlush();
  }
}

function refreshVisibleAvatars(force = true) {
  if (document.visibilityState === 'hidden') return;
  for (const userId of listeners.keys()) refresh(userId, force);
}

function refreshOnReturn() {
  if (document.visibilityState === 'hidden') return;
  if (Date.now() - lastPassiveRefreshAt < PASSIVE_REFRESH_THROTTLE_MS) return;
  lastPassiveRefreshAt = Date.now();
  refreshVisibleAvatars();
}

function refreshOnAchievementCheck() {
  if (document.visibilityState === 'hidden') return;
  for (const userId of listeners.keys()) invalidateRecentAchievementImagesCache(userId);
}

function startWatching() {
  if (pollTimer !== undefined) return;
  pollTimer = window.setInterval(refreshVisibleAvatars, TTL_MS);
  window.addEventListener('focus', refreshOnReturn);
  document.addEventListener('visibilitychange', refreshOnReturn);
  window.addEventListener(ACHIEVEMENT_CHECK_EVENT, refreshOnAchievementCheck);
}

function stopWatching() {
  if (listeners.size > 0) return;
  window.clearInterval(pollTimer);
  pollTimer = undefined;
  window.removeEventListener('focus', refreshOnReturn);
  document.removeEventListener('visibilitychange', refreshOnReturn);
  window.removeEventListener(ACHIEVEMENT_CHECK_EVENT, refreshOnAchievementCheck);
}

/** Shared live miniatures of up to three latest active awards for any user's avatar. */
export function useRecentAchievementImages(userId: string | undefined, limit = 3): string[] {
  const subscribe = useCallback((listener: () => void) => {
    if (!userId) return () => {};
    const subscribers = listeners.get(userId) ?? new Set<() => void>();
    subscribers.add(listener);
    listeners.set(userId, subscribers);
    startWatching();
    refresh(userId);
    return () => {
      subscribers.delete(listener);
      if (subscribers.size === 0) {
        listeners.delete(userId);
        pendingRefreshes.delete(userId);
      }
      stopWatching();
    };
  }, [userId]);
  const getSnapshot = useCallback(
    () => (userId ? cache.get(userId)?.urls ?? EMPTY_URLS : EMPTY_URLS),
    [userId],
  );
  const urls = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_URLS);
  return useMemo(() => urls.slice(0, Math.max(0, Math.min(3, limit))), [urls, limit]);
}

/** Refreshes already mounted avatars as well as subsequent mounts. */
export function invalidateRecentAchievementImagesCache(userId?: string) {
  const userIds = userId ? [userId] : [...new Set([...cache.keys(), ...listeners.keys()])];
  for (const id of userIds) {
    const entry = entryFor(id);
    entry.at = 0;
    entry.version += 1;
    if (listeners.has(id)) refresh(id, true);
  }
}
