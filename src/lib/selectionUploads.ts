import { supabase } from './supabase';
import type { ContestParticipant } from './contestArchive';
import type { ContestSubmission } from './contestReview';
import type { ColumnMapping, FormKind, MatchOverrides } from './identityMatching';
import type { TableData } from './tableImport';

/**
 * Загруженные выгрузки разбора — на сайте, а не только во вкладке браузера:
 * разбор переживает перезагрузку страницы, и его видят все суперадмины.
 *
 * Храним то, что браузер из файла прочитал, а не сам файл. У контеста это
 * участники и посылки архива (без загруженных решений) и монитор; таблица для
 * разбора склеивается из них заново.
 */

/** Контест собирается из двух файлов — архива посылок и монитора. */
export type ContestParts = {
  archive: ContestParticipant[] | null;
  archiveName: string | null;
  /** Посылки архива с ответами — по ним считаются проверка честности и время. */
  submissions: ContestSubmission[] | null;
  /** Когда Контест собрал архив: позже этого посылок нет. */
  builtAt: number | null;
  monitor: TableData | null;
  monitorName: string | null;
};

export const NO_CONTEST: ContestParts = {
  archive: null, archiveName: null, submissions: null, builtAt: null, monitor: null, monitorName: null,
};

/** Как контест лежит в базе: множества JSON не знает, поэтому решённые задачи — списком. */
export type StoredContest = Omit<ContestParts, 'archive'> & {
  archive: (Omit<ContestParticipant, 'solved'> & { solved: string[] })[] | null;
};

export function packContest(parts: ContestParts): StoredContest {
  return {
    ...parts,
    archive: parts.archive?.map((person) => ({ ...person, solved: [...person.solved] })) ?? null,
  };
}

export function unpackContest(stored: StoredContest): ContestParts {
  return {
    ...NO_CONTEST,
    ...stored,
    archive: stored.archive?.map((person) => ({ ...person, solved: new Set(person.solved) })) ?? null,
  };
}

export type SelectionUpload = {
  id: string;
  form_kind: FormKind;
  file_name: string;
  table_data: TableData;
  /** Пусто — разметку определить заново по заголовкам. */
  mapping: ColumnMapping | null;
  offset_hours: number;
  contest: StoredContest | null;
  /** Ручные решения по номеру строки: id аккаунта или null — «не сопоставлять». */
  overrides: MatchOverrides;
  uploaded_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type SelectionUploadPatch = Partial<Pick<
  SelectionUpload,
  'form_kind' | 'file_name' | 'table_data' | 'mapping' | 'offset_hours' | 'contest' | 'overrides'
>>;

/**
 * Пока таблицы нет в базе, PostgREST говорит про schema cache — переводим в
 * понятное действие. Разбор при этом работает как раньше, только в памяти.
 */
function describeUploadError(message: string): string {
  if (/selection_uploads|schema cache|does not exist/i.test(message)) {
    return 'Выгрузки пока не сохраняются на сайте: примените supabase/schema.sql. '
      + 'Разбор работает, но после перезагрузки страницы файлы придётся загрузить заново.';
  }
  return `Выгрузка не сохранилась на сайте: ${message}`;
}

export async function fetchSelectionUploads(): Promise<{ uploads: SelectionUpload[]; error: string | null }> {
  const { data, error } = await supabase
    .from('selection_uploads')
    .select('*')
    .order('created_at');

  if (error) {
    console.error('Selection uploads fetch error:', error.message);
    return { uploads: [], error: describeUploadError(error.message) };
  }
  return { uploads: (data ?? []) as SelectionUpload[], error: null };
}

export async function insertSelectionUpload(upload: SelectionUpload): Promise<{ error: string | null }> {
  const { error } = await supabase.from('selection_uploads').insert(upload);
  if (error) {
    console.error('Selection upload insert error:', error.message);
    return { error: describeUploadError(error.message) };
  }
  return { error: null };
}

export async function updateSelectionUpload(
  id: string,
  patch: SelectionUploadPatch,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('selection_uploads')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('Selection upload update error:', error.message);
    return { error: describeUploadError(error.message) };
  }
  return { error: null };
}

export async function deleteSelectionUpload(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('selection_uploads').delete().eq('id', id);
  if (error) {
    console.error('Selection upload delete error:', error.message);
    return { error: describeUploadError(error.message) };
  }
  return { error: null };
}
