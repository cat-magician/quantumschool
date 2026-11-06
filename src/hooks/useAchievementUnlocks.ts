import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ACHIEVEMENT_CHECK_EVENT,
  fetchUnseenAchievements,
  loadAchievementCatalog,
  markAchievementsSeen,
} from '../lib/achievementApi';
import { toAchievementUnlock, type AchievementUnlock } from '../lib/achievementUtils';
import { invalidateRecentAchievementImagesCache } from './useRecentAchievementImages';

/** Новая персональная награда появляется и в уже открытом кабинете. */
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
 * Очередь достижений, о которых пользователю ещё не сказали. Новые ищет при входе
 * в кабинет, раз в минуту, при возврате во вкладку и по requestAchievementCheck().
 */
export function useAchievementUnlocks(userId: string | undefined) {
  const [queue, setQueue] = useState<AchievementUnlock[]>([]);
  // Уже в очереди или закрытые в этой сессии — даже если отметка о просмотре
  // не дошла до сервера, второй раз за визит то же окно не покажем.
  const knownIds = useRef(new Set<string>());
  const generation = useRef(0);
  const inFlight = useRef<number | null>(null);
  const lastCheckAt = useRef(0);

  const check = useCallback(async (force: boolean) => {
    const requestGeneration = generation.current;
    if (!userId || inFlight.current === requestGeneration || document.visibilityState === 'hidden') return;
    if (!force && Date.now() - lastCheckAt.current < PASSIVE_CHECK_THROTTLE_MS) return;
    inFlight.current = requestGeneration;
    lastCheckAt.current = Date.now();
    try {
      const catalog = await loadAchievementCatalog({ forceRefresh: true, strict: true });
      const rows = await fetchUnseenAchievements(userId, catalog.map((definition) => definition.code));
      if (generation.current !== requestGeneration) return;
      const fresh = rows
        .filter((row) => !knownIds.current.has(row.id))
        .map((row) => toAchievementUnlock(row, catalog))
        .filter((item): item is AchievementUnlock => item !== null);
      if (fresh.length === 0) return;
      invalidateRecentAchievementImagesCache(userId);
      for (const item of fresh) knownIds.current.add(item.id);
      // Окно выезжает с картинкой, а не с пустым местом под ней.
      await Promise.all(fresh.map((item) => preloadImage(item.imageSrc)));
      if (generation.current !== requestGeneration) return;
      setQueue((current) => [...current, ...fresh]);
    } catch {
      // При временном сбое сохраняем текущую очередь и повторяем проверку позже.
    } finally {
      if (inFlight.current === requestGeneration) inFlight.current = null;
    }
  }, [userId]);

  useEffect(() => {
    generation.current += 1;
    inFlight.current = null;
    lastCheckAt.current = 0;
    knownIds.current = new Set();
    setQueue([]);
    if (!userId) return;

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
      generation.current += 1;
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
