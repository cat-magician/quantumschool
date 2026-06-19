import { supabase } from './supabase';
import type { SelectionStageConfig } from './types';

export const DEFAULT_SELECTION_CONFIG: SelectionStageConfig = {
  id: 1,
  essay_form_id: '',
  essay_published: false,
  contest_url: '',
  contest_published: false,
  updated_at: null,
  updated_by: null,
};

export function parseYandexFormId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const fromUrl = trimmed.match(/forms\.yandex\.ru\/u\/([a-zA-Z0-9]+)/);
  if (fromUrl) return fromUrl[1];
  if (/^[a-zA-Z0-9]{10,}$/.test(trimmed)) return trimmed;
  return null;
}

export function normalizeContestUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function fetchSelectionConfig(): Promise<SelectionStageConfig> {
  const { data, error } = await supabase
    .from('selection_stage_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) return DEFAULT_SELECTION_CONFIG;
  return data as SelectionStageConfig;
}

export function isEssayPublished(config: SelectionStageConfig): boolean {
  return config.essay_published && !!config.essay_form_id.trim();
}

export function isContestPublished(config: SelectionStageConfig): boolean {
  return config.contest_published && !!config.contest_url.trim();
}

export async function saveSelectionConfig(
  patch: Partial<Pick<SelectionStageConfig, 'essay_form_id' | 'essay_published' | 'contest_url' | 'contest_published'>>,
  userId: string,
) {
  return supabase
    .from('selection_stage_config')
    .upsert({
      id: 1,
      ...patch,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    });
}
