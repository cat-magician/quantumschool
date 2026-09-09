import { supabase } from './supabase';
import type { SelectionFormKind, SelectionFormLink } from './types';

/**
 * Связи «ответ формы ↔ аккаунт», подтверждённые в инструменте сопоставления.
 *
 * Пишем через RPC: за одно подтверждение уезжает сотня строк, и та же
 * функция переносит почту из анкеты в профиль. По таблице напрямую ходим
 * только за чтением.
 */

export type FormLinkDraft = {
  user_id: string;
  form_kind: SelectionFormKind;
  contact_email: string | null;
  form_name: string;
  form_submitted_at: string | null;
  source_file: string;
  source_row: number | null;
  match_score: number | null;
  match_signals: string[];
};

/**
 * Пока миграция не применена, PostgREST отвечает «нет такой функции/таблицы».
 * Показывать это админу как есть бессмысленно — переводим в понятное действие.
 */
function describeLinkError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes('superadmin_apply_form_links')
    || lower.includes('superadmin_clear_form_link')
    || lower.includes('selection_form_links')
    || lower.includes('schema cache')
  ) {
    return 'Сопоставление ещё не включено в базе: примените supabase/schema.sql. '
      + 'Разбор файлов работает и сейчас, но результат не сохранится.';
  }
  return message;
}
export async function fetchSelectionFormLinks(): Promise<SelectionFormLink[]> {
  const { data, error } = await supabase
    .from('selection_form_links')
    .select('*');

  if (error) {
    console.error('Form links fetch error:', error.message);
    return [];
  }

  return (data ?? []) as SelectionFormLink[];
}

export async function applySelectionFormLinks(
  drafts: FormLinkDraft[],
): Promise<{ saved: number; error: string | null }> {
  if (drafts.length === 0) return { saved: 0, error: null };

  const { data, error } = await supabase.rpc('superadmin_apply_form_links', {
    p_links: drafts,
  });

  if (error) {
    console.error('Form links save error:', error.message);
    return { saved: 0, error: describeLinkError(error.message) };
  }

  return { saved: typeof data === 'number' ? data : drafts.length, error: null };
}

export async function clearSelectionFormLink(
  userId: string,
  kind: SelectionFormKind,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('superadmin_clear_form_link', {
    target_user_id: userId,
    target_form_kind: kind,
  });

  if (error) {
    console.error('Form link clear error:', error.message);
    return { error: describeLinkError(error.message) };
  }

  return { error: null };
}

/** Быстрый доступ «аккаунт + форма → связь» для подсветки уже разобранного. */
export function indexLinksByUser(links: SelectionFormLink[]): Map<string, SelectionFormLink[]> {
  const index = new Map<string, SelectionFormLink[]>();
  for (const link of links) {
    const list = index.get(link.user_id);
    if (list) list.push(link);
    else index.set(link.user_id, [link]);
  }
  return index;
}
