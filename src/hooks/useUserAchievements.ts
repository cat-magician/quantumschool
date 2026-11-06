import { useCallback, useEffect, useState } from 'react';
import { ACHIEVEMENT_CHECK_EVENT, loadAchievementCatalog } from '../lib/achievementApi';
import { achievementImageSrc } from '../lib/achievementUtils';
import { supabase } from '../lib/supabase';

export type UserAchievement = {
  id: string;
  code: string;
  title: string;
  description: string;
  imageSrc: string | null;
  earnedAt: string;
};

type State = {
  userId: string | undefined;
  items: UserAchievement[];
  loading: boolean;
  error: boolean;
};

const POLL_INTERVAL_MS = 60_000;
const FOCUS_THROTTLE_MS = 15_000;

/** Личная коллекция: только полученные и действующие достижения, для любой роли. */
export function useUserAchievements(userId: string | undefined) {
  const [state, setState] = useState<State>({ userId, items: [], loading: Boolean(userId), error: false });
  const [retry, setRetry] = useState(0);
  const refresh = useCallback(() => setRetry((value) => value + 1), []);

  useEffect(() => {
    if (!userId) {
      setState({ userId, items: [], loading: false, error: false });
      return;
    }

    let active = true;
    let inFlight = false;
    let lastCheckAt = 0;
    setState((current) => ({
      userId,
      items: current.userId === userId ? current.items : [],
      loading: true,
      error: false,
    }));

    const load = async (force = false) => {
      if (!active || inFlight || document.visibilityState === 'hidden') return;
      if (!force && Date.now() - lastCheckAt < FOCUS_THROTTLE_MS) return;
      inFlight = true;
      lastCheckAt = Date.now();

      try {
        const [{ data: rows, error: rowsError }, definitions] = await Promise.all([
          supabase
            .from('achievements')
            .select('id, code, earned_at')
            .eq('user_id', userId)
            .not('code', 'is', null)
            .order('earned_at', { ascending: false, nullsFirst: false })
            .order('id', { ascending: false }),
          loadAchievementCatalog({ forceRefresh: true, strict: true }),
        ]);
        if (rowsError) throw rowsError;
        if (!active) return;

        const items: UserAchievement[] = [];
        const byCode = new Map(definitions.map((definition) => [definition.code, definition]));
        for (const row of rows ?? []) {
          const definition = byCode.get(row.code);
          if (!definition) continue;
          items.push({
            id: row.id,
            code: definition.code,
            title: definition.title,
            description: definition.description,
            imageSrc: achievementImageSrc(definition.image_url),
            earnedAt: row.earned_at,
          });
        }

        if (active) setState({ userId, items, loading: false, error: false });
      } catch {
        if (active) setState((current) => ({ ...current, loading: false, error: true }));
      } finally {
        inFlight = false;
      }
    };

    const onFocus = () => { void load(); };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const onRequest = () => { void load(true); };

    void load(true);
    const interval = window.setInterval(() => { void load(true); }, POLL_INTERVAL_MS);
    window.addEventListener('focus', onFocus);
    window.addEventListener(ACHIEVEMENT_CHECK_EVENT, onRequest);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(ACHIEVEMENT_CHECK_EVENT, onRequest);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId, retry]);

  // При смене аккаунта предыдущая коллекция не должна мигнуть до запуска эффекта.
  const current = state.userId === userId
    ? state
    : { items: [], loading: Boolean(userId), error: false };
  return { ...current, refresh };
}
