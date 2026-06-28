import { supabase } from './supabase';
import type { LandingConfig } from './types';

export const DEFAULT_LANDING_CONFIG: LandingConfig = {
  id: 1,
  hero_badge_text: 'ОТКРЫТ НАБОР НА КУРС 2026-2027 ГОДА',
  updated_at: null,
  updated_by: null,
};

/** Текст плашки на главной: обрезка пробелов и отображение ЗАГЛАВНЫМИ. */
export function formatHeroBadgeText(text: string): string {
  return text.trim().toLocaleUpperCase('ru-RU');
}

export async function fetchLandingConfig(): Promise<LandingConfig> {
  const { data, error } = await supabase
    .from('landing_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) return DEFAULT_LANDING_CONFIG;
  return data as LandingConfig;
}

export async function saveLandingConfig(heroBadgeText: string, userId: string) {
  return supabase.from('landing_config').upsert({
    id: 1,
    hero_badge_text: formatHeroBadgeText(heroBadgeText),
    updated_at: new Date().toISOString(),
    updated_by: userId,
  });
}
