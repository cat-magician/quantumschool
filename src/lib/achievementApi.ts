import { supabase } from './supabase';
import type { Achievement, AchievementDefinition, UserProfile } from './types';
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

/** Количество получателей каждой награды, включая выдачи за пределами первой страницы API. */
export async function loadAchievementAwardCounts(codes: string[]): Promise<Map<string, number>> {
  const uniqueCodes = [...new Set(codes)];
  const recipientsByCode = new Map(uniqueCodes.map((code) => [code, new Set<string>()]));
  if (uniqueCodes.length === 0) return new Map();

  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('achievements')
      .select('id, code, user_id')
      .in('code', uniqueCodes)
      .order('earned_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) recipientsByCode.get(row.code)?.add(row.user_id);
    if (rows.length < pageSize) break;
  }

  return new Map([...recipientsByCode].map(([code, recipients]) => [code, recipients.size]));
}

export type AchievementRecipient = {
  id: string;
  userId: string;
  earnedAt: string;
  profile: Pick<UserProfile, 'id' | 'display_name' | 'avatar_url' | 'role' | 'email' | 'login'> | null;
};

/** Только чтение: список выданных наград с точным общим количеством и профилями получателей. */
export async function loadAchievementRecipients(
  code: string,
  { offset = 0, pageSize = 50 }: { offset?: number; pageSize?: number } = {},
): Promise<{ items: AchievementRecipient[]; total: number }> {
  if (!code) return { items: [], total: 0 };
  const start = Math.max(0, Math.trunc(offset));
  const size = Math.max(1, Math.min(100, Math.trunc(pageSize)));
  const { data, error, count } = await supabase
    .from('achievements')
    .select('id, user_id, earned_at', { count: 'exact' })
    .eq('code', code)
    .order('earned_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .range(start, start + size - 1);
  if (error) throw error;
  if (count == null) throw new Error('Не удалось получить количество выдач');
  const rows = data ?? [];
  if (rows.length === 0) return { items: [], total: count };

  const ids = [...new Set(rows.map((row) => row.user_id as string))];
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('id, display_name, avatar_url, role, email, login')
    .in('id', ids);
  if (profilesError) throw profilesError;
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile as NonNullable<AchievementRecipient['profile']>]));

  return {
    total: count,
    items: rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      earnedAt: row.earned_at,
      profile: profileById.get(row.user_id) ?? null,
    })),
  };
}
