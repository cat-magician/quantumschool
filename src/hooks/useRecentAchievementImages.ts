import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { achievementImageSrc } from '../lib/achievementUtils';

const cache = new Map<string, { at: number; urls: string[] }>();
const TTL_MS = 60_000;

/**
 * До трёх последних полученных достижений — миниатюры рядом с аватаром.
 */
export function useRecentAchievementImages(userId: string | undefined, limit = 3): string[] {
  const [urls, setUrls] = useState<string[]>([]);

  const key = useMemo(() => (userId ? `${userId}:${limit}` : ''), [userId, limit]);

  useEffect(() => {
    if (!userId || !key) {
      setUrls([]);
      return;
    }

    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) {
      setUrls(hit.urls);
      return;
    }

    let cancelled = false;

    (async () => {
      const { data: rows, error } = await supabase
        .from('achievements')
        .select('code, earned_at')
        .eq('user_id', userId)
        .not('code', 'is', null)
        .order('earned_at', { ascending: false })
        .limit(limit);

      if (cancelled || error || !rows?.length) {
        if (!cancelled) setUrls([]);
        return;
      }

      const codes = [...new Set(rows.map((r) => r.code).filter(Boolean))] as string[];
      const { data: defs } = await supabase
        .from('achievement_definitions')
        .select('code, image_url')
        .in('code', codes)
        .eq('is_active', true);

      if (cancelled) return;

      const urlByCode = new Map((defs ?? []).map((d) => [d.code as string, d.image_url as string | null]));

      const next: string[] = [];
      for (const r of rows) {
        if (!r.code) continue;
        const src = achievementImageSrc(urlByCode.get(r.code) ?? '');
        if (src) next.push(src);
        if (next.length >= limit) break;
      }

      cache.set(key, { at: Date.now(), urls: next });
      setUrls(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, key, limit]);

  return urls;
}

export function invalidateRecentAchievementImagesCache(userId?: string) {
  if (!userId) {
    cache.clear();
    return;
  }
  for (const k of cache.keys()) {
    if (k.startsWith(`${userId}:`)) cache.delete(k);
  }
}
