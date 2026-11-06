import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ACHIEVEMENT_CHECK_EVENT,
  fetchUnseenAchievements,
  loadAchievementCatalog,
  markAchievementsSeen,
} from '../lib/achievementApi';
import { toAchievementUnlock, type AchievementUnlock } from '../lib/achievementUtils';

/** Оценку, поставленную, пока ученик на сайте, он увидит не позже чем через минуту. */
const POLL_INTERVAL_MS = 60_000;
/** Первая проверка — когда кабинет уже нарисован, а не поверх загрузки. */
const FIRST_CHECK_DELAY_MS = 1200;
/** Возврат во вкладку и фокус окна приходят парой — второй запрос лишний. */
const PASSIVE_CHECK_THROTTLE_MS = 15_000;
const IMAGE_WAIT_MS = 4000;

function preloadImage(src: string | null): Promise<void> {
  if (!src) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    const timer = window.setTimeout(resolve, IMAGE_WAIT_MS);
    img.onload = img.onerror = () => {
      window.clearTimeout(timer);
      resolve();
    };
    img.src = src;
  });
}

/**
 * Очередь достижений, о которых ученику ещё не сказали. Новые ищет при входе
 * в кабинет, раз в минуту, при возврате во вкладку и по requestAchievementCheck().
 */
export function useAchievementUnlocks(userId: string | undefined) {
  const [queue, setQueue] = useState<AchievementUnlock[]>([]);
  // Уже в очереди или закрытые в этой сессии — даже если отметка о просмотре
  // не дошла до сервера, второй раз за визит то же окно не покажем.
  const knownIds = useRef(new Set<string>());
  const inFlight = useRef(false);
  const lastCheckAt = useRef(0);

  const check = useCallback(async (force: boolean) => {
    if (!userId || inFlight.current || document.visibilityState === 'hidden') return;
    if (!force && Date.now() - lastCheckAt.current < PASSIVE_CHECK_THROTTLE_MS) return;
    inFlight.current = true;
    lastCheckAt.current = Date.now();
    try {
      const [rows, catalog] = await Promise.all([
        fetchUnseenAchievements(userId),
        loadAchievementCatalog(),
      ]);
      const fresh = rows
        .filter((row) => !knownIds.current.has(row.id))
        .map((row) => toAchievementUnlock(row, catalog))
        .filter((item): item is AchievementUnlock => item !== null);
      if (fresh.length === 0) return;
      for (const item of fresh) knownIds.current.add(item.id);
      // Окно выезжает с картинкой, а не с пустым местом под ней.
      await Promise.all(fresh.map((item) => preloadImage(item.imageSrc)));
      setQueue((current) => [...current, ...fresh]);
    } finally {
      inFlight.current = false;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    knownIds.current = new Set();
    setQueue([]);

    const first = window.setTimeout(() => { void check(true); }, FIRST_CHECK_DELAY_MS);
    const interval = window.setInterval(() => { void check(true); }, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check(false);
    };
    const onFocus = () => { void check(false); };
    const onRequest = () => { void check(true); };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener(ACHIEVEMENT_CHECK_EVENT, onRequest);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(ACHIEVEMENT_CHECK_EVENT, onRequest);
    };
  }, [userId, check]);

  const dismiss = useCallback((id: string) => {
    setQueue((current) => current.filter((item) => item.id !== id));
    void markAchievementsSeen([id]);
  }, []);

  return { queue, dismiss };
}
