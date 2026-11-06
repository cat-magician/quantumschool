import { supabase } from './supabase';
import type { Achievement, AchievementDefinition } from './types';
import { isLegacyAchievementCode } from './achievementUtils';

let catalogRequest: Promise<AchievementDefinition[]> | null = null;
let catalogCache: { rows: AchievementDefinition[]; expiresAt: number } | null = null;
let catalogGeneration = 0;
const CATALOG_TTL_MS = 30_000;

export function resetAchievementCatalogCache() {
  catalogGeneration += 1;
  catalogRequest = null;
  catalogCache = null;
}

/** Короткий кеш: суперадмин может создать награду, пока получатель уже на сайте. */
export function loadAchievementCatalog(
  { forceRefresh = false, strict = false }: { forceRefresh?: boolean; strict?: boolean } = {},
): Promise<AchievementDefinition[]> {
  if (!forceRefresh && catalogCache && catalogCache.expiresAt > Date.now()) {
    return Promise.resolve(catalogCache.rows);
  }
  if (!catalogRequest) {
    const generation = catalogGeneration;
    const request = (async () => {
      const { data, error } = await supabase
        .from('achievement_definitions')
        .select('code, title, description, hint, image_url, sort_order, is_system, staff_ok')
        .eq('is_active', true)
        .order('sort_order')
        .order('code');
      if (error) throw error;
      const rows = ((data ?? []) as AchievementDefinition[]).filter((row) => !isLegacyAchievementCode(row.code));
      if (generation === catalogGeneration) {
        catalogCache = { rows, expiresAt: Date.now() + CATALOG_TTL_MS };
      }
      return rows;
    })();
    catalogRequest = request;
    // Неудачный запрос не остаётся в кеше; сброс во время запроса не затрёт новый.
    const clearRequest = () => {
      if (catalogRequest === request) catalogRequest = null;
    };
    void request.then(clearRequest, clearRequest);
  }
  return strict ? catalogRequest : catalogRequest.catch(() => []);
}

/** Действующие награды, окно о которых пользователь ещё не закрыл. */
export async function fetchUnseenAchievements(userId: string, activeCodes: string[]): Promise<Achievement[]> {
  if (activeCodes.length === 0) return [];
  const { data, error } = await supabase
    .from('achievements')
    .select('id, user_id, code, title, description, icon, earned_at, seen_at')
    .eq('user_id', userId)
    .is('seen_at', null)
    .in('code', activeCodes)
    .order('earned_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(20);
  if (error) return [];
  return (data ?? []) as Achievement[];
}

export async function markAchievementsSeen(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase.rpc('mark_achievements_seen', { p_ids: ids });
}

/** «Проверь новые достижения» — после действий, за которые их выдают. */
export const ACHIEVEMENT_CHECK_EVENT = 'qc:achievement-check';

export function requestAchievementCheck() {
  window.dispatchEvent(new Event(ACHIEVEMENT_CHECK_EVENT));
}
