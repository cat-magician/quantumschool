import { supabase } from './supabase';
import type { KeyDate, LandingConfig } from './types';

export const DEFAULT_LANDING_CONFIG: LandingConfig = {
  id: 1,
  hero_badge_text: 'ОТКРЫТ НАБОР НА КУРС 2026-2027 ГОДА',
  key_dates_published: false,
  key_dates_title: 'Ключевые даты',
  key_dates_note: '',
  key_dates: [],
  updated_at: null,
  updated_by: null,
};

/** Совпадает с CHECK landing_config_key_dates_shape в supabase/schema.sql. */
export const KEY_DATES_LIMITS = {
  items: 12,
  date: 60,
  label: 120,
  title: 80,
  note: 200,
} as const;

/** Дата из jsonb: колонка свободной формы, доверять её содержимому нельзя. */
function parseKeyDate(raw: unknown): KeyDate | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const date = typeof item.date === 'string' ? item.date.trim() : '';
  const label = typeof item.label === 'string' ? item.label.trim() : '';
  if (!date && !label) return null;
  return {
    date: date.slice(0, KEY_DATES_LIMITS.date),
    label: label.slice(0, KEY_DATES_LIMITS.label),
  };
}

export function parseKeyDates(raw: unknown): KeyDate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(parseKeyDate)
    .filter((item): item is KeyDate => item !== null)
    .slice(0, KEY_DATES_LIMITS.items);
}

/** Перед записью: обрезать, выкинуть пустые строки, не превысить лимит. */
export function normalizeKeyDates(items: KeyDate[]): KeyDate[] {
  return items
    .map((item) => ({
      date: item.date.trim().slice(0, KEY_DATES_LIMITS.date),
      label: item.label.trim().slice(0, KEY_DATES_LIMITS.label),
    }))
    .filter((item) => item.date || item.label)
    .slice(0, KEY_DATES_LIMITS.items);
}

/** Блок показывается, только если опубликован и в нём есть хотя бы одна дата. */
export function isKeyDatesVisible(config: LandingConfig): boolean {
  return config.key_dates_published && config.key_dates.length > 0;
}

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

  const row = data as Record<string, unknown>;
  return {
    ...DEFAULT_LANDING_CONFIG,
    ...(row as Partial<LandingConfig>),
    key_dates: parseKeyDates(row.key_dates),
  };
}

export async function saveLandingConfig(heroBadgeText: string, userId: string) {
  return supabase.from('landing_config').upsert({
    id: 1,
    hero_badge_text: formatHeroBadgeText(heroBadgeText),
    updated_at: new Date().toISOString(),
    updated_by: userId,
  });
}

export async function saveKeyDates(
  patch: {
    title: string;
    note: string;
    items: KeyDate[];
    published: boolean;
  },
  userId: string,
) {
  return supabase.from('landing_config').upsert({
    id: 1,
    key_dates_title: patch.title.trim().slice(0, KEY_DATES_LIMITS.title)
      || DEFAULT_LANDING_CONFIG.key_dates_title,
    key_dates_note: patch.note.trim().slice(0, KEY_DATES_LIMITS.note),
    key_dates: normalizeKeyDates(patch.items),
    key_dates_published: patch.published,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  });
}
