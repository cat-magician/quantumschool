import { supabase } from './supabase';
import type { Achievement, AchievementDefinition } from './types';

let catalogRequest: Promise<AchievementDefinition[]> | null = null;

export function resetAchievementCatalogCache() {
  catalogRequest = null;
}

/** Каталог меняется только прогоном schema.sql — за сессию читаем его один раз. */
export function loadAchievementCatalog(): Promise<AchievementDefinition[]> {
  catalogRequest ??= (async () => {
    const { data, error } = await supabase
      .from('achievement_definitions')
      .select('code, title, description, hint, image_url, sort_order, is_system, staff_ok')
      .eq('is_active', true)
      .order('sort_order')
      .order('code');
    if (error) {
      catalogRequest = null;
      return [];
    }
    return (data ?? []) as AchievementDefinition[];
  })();
  return catalogRequest;
}

/** Достижения, окно о которых ученик ещё не закрыл, — от старых к новым. */
export async function fetchUnseenAchievements(userId: string): Promise<Achievement[]> {
  const { data, error } = await supabase
    .from('achievements')
    .select('id, user_id, code, title, description, icon, earned_at, seen_at')
    .eq('user_id', userId)
    .is('seen_at', null)
    .not('code', 'is', null)
    .order('earned_at', { ascending: true })
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
