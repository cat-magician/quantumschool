import { supabase } from './supabase';
import type { SelectionStageConfig } from './types';

export const DEFAULT_SELECTION_CONFIG: SelectionStageConfig = {
  id: 1,
  essay_form_id: '',
  essay_published: false,
  questionnaire_form_id: '',
  questionnaire_published: false,
  contest_url: '',
  contest_published: false,
  updated_at: null,
  updated_by: null,
};

export type YandexFormVariant = 'u' | 'cloud';

export type YandexFormRef = {
  id: string;
  variant: YandexFormVariant;
};

const YANDEX_FORM_ID = /[a-zA-Z0-9]{10,}/;

/** Разбор URL или ID из поля ввода админки. */
export function parseYandexFormInput(input: string): YandexFormRef | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const cloudUrl = trimmed.match(/forms\.yandex\.(?:ru|com)\/cloud\/(?:u\/)?([a-zA-Z0-9]+)/i);
  if (cloudUrl) return { id: cloudUrl[1], variant: 'cloud' };

  const uUrl = trimmed.match(/forms\.yandex\.(?:ru|com)\/u\/([a-zA-Z0-9]+)/i);
  if (uUrl) return { id: uUrl[1], variant: 'u' };

  if (/^cloud\/([a-zA-Z0-9]+)$/i.test(trimmed)) {
    return { id: trimmed.slice(6), variant: 'cloud' };
  }

  if (YANDEX_FORM_ID.test(trimmed) && !trimmed.includes('/') && !trimmed.includes('.')) {
    return { id: trimmed, variant: 'u' };
  }

  return null;
}

/** Значение из БД (plain id или cloud/id). */
export function parseStoredYandexFormRef(stored: string): YandexFormRef | null {
  const trimmed = stored.trim();
  if (!trimmed) return null;

  const cloudStored = trimmed.match(/^cloud\/([a-zA-Z0-9]+)$/i);
  if (cloudStored) return { id: cloudStored[1], variant: 'cloud' };

  if (YANDEX_FORM_ID.test(trimmed) && !trimmed.includes('/')) {
    return { id: trimmed, variant: 'u' };
  }

  return parseYandexFormInput(trimmed);
}

export function serializeYandexFormRef(ref: YandexFormRef): string {
  return ref.variant === 'cloud' ? `cloud/${ref.id}` : ref.id;
}

/** Нормализует ввод или сохранённое значение в строку для БД. */
export function parseYandexFormId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const fromInput = parseYandexFormInput(trimmed);
  if (fromInput) return serializeYandexFormRef(fromInput);

  const stored = parseStoredYandexFormRef(trimmed);
  if (stored) return serializeYandexFormRef(stored);

  return null;
}

export function yandexFormPublicUrl(stored: string): string {
  const ref = parseStoredYandexFormRef(stored);
  if (!ref) return '';
  return ref.variant === 'cloud'
    ? `https://forms.yandex.ru/cloud/${ref.id}/`
    : `https://forms.yandex.ru/u/${ref.id}/`;
}

export function yandexFormInputDisplayUrl(stored: string): string {
  const url = yandexFormPublicUrl(stored);
  return url ? url.replace(/\/$/, '') : '';
}

export function yandexFormIframeSrc(stored: string): string {
  const ref = parseStoredYandexFormRef(stored);
  if (!ref) return '';
  const base = ref.variant === 'cloud'
    ? `https://forms.yandex.ru/cloud/${ref.id}/`
    : `https://forms.yandex.ru/u/${ref.id}`;
  return `${base}?iframe=1`;
}

export function yandexFormIframeName(stored: string): string {
  const ref = parseStoredYandexFormRef(stored);
  return ref ? `ya-form-${ref.variant}-${ref.id}` : 'ya-form';
}

export const YANDEX_FORM_INPUT_PLACEHOLDER =
  'https://forms.yandex.ru/cloud/…, /u/… или ID формы';

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

export function isQuestionnairePublished(config: SelectionStageConfig): boolean {
  return config.questionnaire_published && !!config.questionnaire_form_id.trim();
}

export function isContestPublished(config: SelectionStageConfig): boolean {
  return config.contest_published && !!config.contest_url.trim();
}

export async function saveSelectionConfig(
  patch: Partial<Pick<
    SelectionStageConfig,
    'essay_form_id' | 'essay_published' | 'questionnaire_form_id' | 'questionnaire_published' | 'contest_url' | 'contest_published'
  >>,
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
