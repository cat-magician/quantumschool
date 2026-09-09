import type { UserProfile } from './types';
import { profileContactEmail, profileLogin } from './profileUtils';
import { selectionVerdict } from './selectionDisplayUtils';

/**
 * Фильтрация участников отбора. Логика вынесена из ResultsTab, чтобы её можно
 * было переиспользовать в выгрузке и проверить без рендера.
 */

export type StageFilter = 'any' | 'submitted' | 'not_submitted' | 'ungraded' | 'graded';
export type YesNoFilter = 'any' | 'yes' | 'no';
export type VerdictFilter = 'any' | 'accepted' | 'rejected' | 'waiting';
export type AccountFilter = 'any' | 'yandex' | 'login';
export type SelectionPreset =
  | 'none'
  | 'essay_queue'
  | 'contest_queue'
  | 'no_questionnaire'
  | 'incomplete'
  | 'ready';
export type SelectionSort =
  | 'name'
  | 'essay_score'
  | 'contest_score'
  | 'total_score'
  | 'registered'
  | 'questionnaire_at';

export type SelectionFilters = {
  search: string;
  preset: SelectionPreset;
  contact: YesNoFilter;
  questionnaire: YesNoFilter;
  essay: StageFilter;
  contest: StageFilter;
  essayScoreMin: string;
  essayScoreMax: string;
  contestScoreMin: string;
  contestScoreMax: string;
  verdict: VerdictFilter;
  account: AccountFilter;
  grade: string;
  city: string;
  sort: SelectionSort;
};

export const EMPTY_SELECTION_FILTERS: SelectionFilters = {
  search: '',
  preset: 'none',
  contact: 'any',
  questionnaire: 'any',
  essay: 'any',
  contest: 'any',
  essayScoreMin: '',
  essayScoreMax: '',
  contestScoreMin: '',
  contestScoreMax: '',
  verdict: 'any',
  account: 'any',
  grade: '',
  city: '',
  sort: 'name',
};

export const STAGE_FILTER_OPTIONS: { value: StageFilter; label: string }[] = [
  { value: 'any', label: 'Любой статус' },
  { value: 'submitted', label: 'Загружено' },
  { value: 'not_submitted', label: 'Не загружено' },
  { value: 'ungraded', label: 'Загружено, без оценки' },
  { value: 'graded', label: 'Оценено' },
];

export const QUESTIONNAIRE_FILTER_OPTIONS: { value: YesNoFilter; label: string }[] = [
  { value: 'any', label: 'Любая' },
  { value: 'yes', label: 'Заполнена' },
  { value: 'no', label: 'Не заполнена' },
];

export const CONTACT_FILTER_OPTIONS: { value: YesNoFilter; label: string }[] = [
  { value: 'any', label: 'Любая' },
  { value: 'yes', label: 'Известна' },
  { value: 'no', label: 'Неизвестна' },
];

export const VERDICT_FILTER_OPTIONS: { value: VerdictFilter; label: string }[] = [
  { value: 'any', label: 'Любое' },
  { value: 'accepted', label: 'Зачислен' },
  { value: 'rejected', label: 'Отказ' },
  { value: 'waiting', label: 'Без решения' },
];

export const ACCOUNT_FILTER_OPTIONS: { value: AccountFilter; label: string }[] = [
  { value: 'any', label: 'Любой' },
  { value: 'yandex', label: 'Яндекс ID' },
  { value: 'login', label: 'По логину' },
];

export const SELECTION_SORT_OPTIONS: { value: SelectionSort; label: string }[] = [
  { value: 'name', label: 'По имени' },
  { value: 'essay_score', label: 'По баллу за эссе' },
  { value: 'contest_score', label: 'По баллу за задачи' },
  { value: 'total_score', label: 'По сумме баллов' },
  { value: 'registered', label: 'По дате регистрации' },
  { value: 'questionnaire_at', label: 'По дате отправки анкеты' },
];

/** Пресеты — готовые срезы под типовые вопросы «кого смотреть дальше». */
export const SELECTION_PRESETS: { id: Exclude<SelectionPreset, 'none'>; label: string; hint: string }[] = [
  { id: 'essay_queue', label: 'Ждут проверки эссе', hint: 'Эссе загружено, оценки ещё нет' },
  { id: 'contest_queue', label: 'Ждут проверки задач', hint: 'Задачи отмечены, оценки ещё нет' },
  { id: 'no_questionnaire', label: 'Без анкеты', hint: 'Анкета не заполнена' },
  { id: 'incomplete', label: 'Неполные заявки', hint: 'Не отправлен хотя бы один из трёх шагов' },
  { id: 'ready', label: 'Готовы к решению', hint: 'Оба балла стоят, решение не принято' },
];

/** Этап засчитан отправленным: статус или метка времени — что раньше проставится. */
export function stageSubmitted(status: UserProfile['stage1_status'], submittedAt?: string | null): boolean {
  return status === 'submitted' || !!submittedAt;
}

function matchesStage(
  filter: StageFilter,
  status: UserProfile['stage1_status'],
  score: number | null,
  submittedAt?: string | null,
): boolean {
  const submitted = stageSubmitted(status, submittedAt);
  switch (filter) {
    case 'submitted': return submitted;
    case 'not_submitted': return !submitted;
    case 'ungraded': return submitted && score === null;
    case 'graded': return score !== null;
    default: return true;
  }
}

/** Пустая граница — не ограничивает; «без оценки» проходит только при пустых границах. */
function matchesScoreRange(score: number | null, min: string, max: string): boolean {
  const hasMin = min.trim() !== '';
  const hasMax = max.trim() !== '';
  if (!hasMin && !hasMax) return true;
  if (score === null) return false;
  if (hasMin && score < Number(min)) return false;
  if (hasMax && score > Number(max)) return false;
  return true;
}

function matchesPreset(preset: SelectionPreset, p: UserProfile): boolean {
  const essaySubmitted = stageSubmitted(p.stage1_status, p.stage1_submitted_at);
  const contestSubmitted = stageSubmitted(p.stage2_status, p.stage2_submitted_at);
  const questionnaireDone = !!p.questionnaire_submitted_at;

  switch (preset) {
    case 'essay_queue':
      return essaySubmitted && p.stage1_score === null;
    case 'contest_queue':
      return contestSubmitted && p.stage2_score === null;
    case 'no_questionnaire':
      return !questionnaireDone;
    case 'incomplete':
      return !questionnaireDone || !essaySubmitted || !contestSubmitted;
    case 'ready':
      return p.stage1_score !== null
        && p.stage2_score !== null
        && selectionVerdict(p.is_enrolled, !!p.selection_rejected) === 'waiting';
    default:
      return true;
  }
}

/** Поиск идёт по всему, чем участника реально опознают в переписке. */
function matchesSearch(query: string, p: UserProfile): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    p.display_name,
    p.email,
    p.login,
    p.yandex_login,
    p.recovery_email,
    p.contact_email,
    profileLogin(p),
    p.city,
    p.school,
    p.grade,
  ].some((field) => field?.toLowerCase().includes(q));
}

export function matchesSelectionFilters(p: UserProfile, f: SelectionFilters): boolean {
  if (!matchesSearch(f.search, p)) return false;
  if (!matchesPreset(f.preset, p)) return false;

  if (f.questionnaire === 'yes' && !p.questionnaire_submitted_at) return false;
  if (f.questionnaire === 'no' && p.questionnaire_submitted_at) return false;

  if (f.contact !== 'any') {
    const known = !!profileContactEmail(p);
    if (f.contact === 'yes' && !known) return false;
    if (f.contact === 'no' && known) return false;
  }

  if (!matchesStage(f.essay, p.stage1_status, p.stage1_score, p.stage1_submitted_at)) return false;
  if (!matchesStage(f.contest, p.stage2_status, p.stage2_score, p.stage2_submitted_at)) return false;

  if (!matchesScoreRange(p.stage1_score, f.essayScoreMin, f.essayScoreMax)) return false;
  if (!matchesScoreRange(p.stage2_score, f.contestScoreMin, f.contestScoreMax)) return false;

  if (f.verdict !== 'any' && selectionVerdict(p.is_enrolled, !!p.selection_rejected) !== f.verdict) {
    return false;
  }

  if (f.account !== 'any') {
    const isLogin = !!profileLogin(p);
    if (f.account === 'login' && !isLogin) return false;
    if (f.account === 'yandex' && isLogin) return false;
  }

  // Значения для списков берём из distinctFieldValues, а он их тримит.
  if (f.grade && (p.grade ?? '').trim() !== f.grade) return false;
  if (f.city && (p.city ?? '').trim() !== f.city) return false;

  return true;
}

/** Пустые значения всегда в конце — иначе они забивают верх любой сортировки. */
function compareNullableDesc(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function timestamp(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function totalScore(p: UserProfile): number | null {
  if (p.stage1_score === null && p.stage2_score === null) return null;
  return (p.stage1_score ?? 0) + (p.stage2_score ?? 0);
}

export function sortSelectionRows<T extends UserProfile>(rows: T[], sort: SelectionSort): T[] {
  const byName = (a: UserProfile, b: UserProfile) =>
    a.display_name.localeCompare(b.display_name, 'ru');

  return [...rows].sort((a, b) => {
    switch (sort) {
      case 'essay_score':
        return compareNullableDesc(a.stage1_score, b.stage1_score) || byName(a, b);
      case 'contest_score':
        return compareNullableDesc(a.stage2_score, b.stage2_score) || byName(a, b);
      case 'total_score':
        return compareNullableDesc(totalScore(a), totalScore(b)) || byName(a, b);
      case 'registered':
        return compareNullableDesc(timestamp(a.created_at), timestamp(b.created_at)) || byName(a, b);
      case 'questionnaire_at':
        return compareNullableDesc(
          timestamp(a.questionnaire_submitted_at),
          timestamp(b.questionnaire_submitted_at),
        ) || byName(a, b);
      default:
        return byName(a, b);
    }
  });
}

/** Сколько фильтров реально сужают выборку — для счётчика на кнопке «Фильтры». */
export function activeSelectionFilterCount(f: SelectionFilters): number {
  let n = 0;
  if (f.preset !== 'none') n++;
  if (f.contact !== 'any') n++;
  if (f.questionnaire !== 'any') n++;
  if (f.essay !== 'any') n++;
  if (f.contest !== 'any') n++;
  if (f.essayScoreMin.trim() || f.essayScoreMax.trim()) n++;
  if (f.contestScoreMin.trim() || f.contestScoreMax.trim()) n++;
  if (f.verdict !== 'any') n++;
  if (f.account !== 'any') n++;
  if (f.grade) n++;
  if (f.city) n++;
  return n;
}

export function hasActiveSelectionFilters(f: SelectionFilters): boolean {
  return activeSelectionFilterCount(f) > 0 || f.search.trim() !== '' || f.sort !== 'name';
}

/** Значения для выпадающих списков «Класс» и «Город» — только реально встречающиеся. */
export function distinctFieldValues(rows: UserProfile[], field: 'grade' | 'city'): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const value = row[field]?.trim();
    if (value) seen.add(value);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
}
