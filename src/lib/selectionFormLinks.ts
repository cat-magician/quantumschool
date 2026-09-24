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
  /** Номер ответа: связь хранится на ответ, у человека их может быть несколько. */
  answer_key: string;
  contact_email: string | null;
  form_name: string;
  form_submitted_at: string | null;
  work_url: string | null;
  /** Итог проверки честности — только у контеста. */
  review_note?: string | null;
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
  // Функции для одной связи появились позже остальных — база может знать
  // сопоставление, но ещё не уметь переносить и снимать связь поштучно.
  if (lower.includes('superadmin_move_form_link') || lower.includes('superadmin_delete_form_link')) {
    return 'Перенос и снятие одной связи заработают после того, как применить supabase/schema.sql.';
  }
  if (lower.includes('link_not_found')) {
    return 'Этой связи уже нет в базе — обновите карту.';
  }
  if (
    lower.includes('superadmin_apply_form_links')
    || lower.includes('superadmin_clear_form_links')
    || lower.includes('superadmin_clear_form_link')
    || lower.includes('selection_form_links')
    || lower.includes('schema cache')
  ) {
    return 'Сопоставление ещё не включено в базе: примените supabase/schema.sql. '
      + 'Разбор файлов работает и сейчас, но результат не сохранится.';
  }
  return message;
}
/**
 * Об ошибке сообщаем отдельно от пустого ответа: карта обновляется сама, и
 * сорвавшийся запрос не должен выглядеть как «связей больше нет».
 */
export async function fetchSelectionFormLinks(): Promise<{
  links: SelectionFormLink[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('selection_form_links')
    .select('*');

  if (error) {
    console.error('Form links fetch error:', error.message);
    return { links: [], error: describeLinkError(error.message) };
  }

  return { links: (data ?? []) as SelectionFormLink[], error: null };
}

export async function applySelectionFormLinks(
  drafts: FormLinkDraft[],
): Promise<{ saved: number; error: string | null }> {
  if (drafts.length === 0) return { saved: 0, error: null };

  const { data, error } = await supabase.rpc('superadmin_apply_form_links', {
    p_links: drafts,
  });

  if (error) {
    // База без миграции версий держит одну связь на человека и форму и
    // отвергает пачку с несколькими версиями. Не теряем разбор: сохраняем
    // последнюю версию каждого, а про остальные честно говорим.
    if (error.message.includes('duplicate_links')) {
      const latest = latestPerPerson(drafts);
      if (latest.length < drafts.length) {
        const retry = await supabase.rpc('superadmin_apply_form_links', { p_links: latest });
        if (!retry.error) {
          return {
            saved: typeof retry.data === 'number' ? retry.data : latest.length,
            error: `Сохранена только последняя версия у ${drafts.length - latest.length} ответов: `
              + 'примените supabase/schema.sql, чтобы хранились все версии.',
          };
        }
      }
    }
    console.error('Form links save error:', error.message);
    return { saved: 0, error: describeLinkError(error.message) };
  }

  return { saved: typeof data === 'number' ? data : drafts.length, error: null };
}

function latestPerPerson(drafts: FormLinkDraft[]): FormLinkDraft[] {
  const latest = new Map<string, FormLinkDraft>();
  for (const draft of drafts) {
    const key = `${draft.user_id}:${draft.form_kind}`;
    const current = latest.get(key);
    const at = (d: FormLinkDraft) => (d.form_submitted_at ? Date.parse(d.form_submitted_at) : 0);
    if (!current || at(draft) >= at(current)) latest.set(key, draft);
  }
  return [...latest.values()];
}

/**
 * Начать заново: убрать все связи одной формы или всех сразу. Почта для связи
 * в профилях пересчитывается на стороне базы.
 */
export async function clearAllSelectionFormLinks(
  kind: SelectionFormKind | null,
): Promise<{ cleared: number; error: string | null }> {
  const { data, error } = await supabase.rpc('superadmin_clear_form_links', {
    target_form_kind: kind,
  });

  if (error) {
    console.error('Form links clear-all error:', error.message);
    return { cleared: 0, error: describeLinkError(error.message) };
  }

  return { cleared: typeof data === 'number' ? data : 0, error: null };
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

/**
 * Ответ привязан не к тому человеку: переносим одну связь к другому. Доводы
 * сопоставления при этом стираются — связь становится ручной.
 */
export async function moveSelectionFormLink(
  linkId: string,
  targetUserId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('superadmin_move_form_link', {
    p_link_id: linkId,
    p_target_user_id: targetUserId,
  });

  if (error) {
    console.error('Form link move error:', error.message);
    return { error: describeLinkError(error.message) };
  }
  return { error: null };
}

/** Снять одну связь: остальные ответы этой формы у человека остаются. */
export async function deleteSelectionFormLink(linkId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('superadmin_delete_form_link', { p_link_id: linkId });

  if (error) {
    console.error('Form link delete error:', error.message);
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
