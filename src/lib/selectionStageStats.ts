import { FORM_KIND_LABELS, type FormKind } from './identityMatching';
import { textMatches } from './listFilters';
import { profileEmail, profileLogin } from './profileUtils';
import type { SelectionVerdict } from './selectionDisplayUtils';
import {
  FORM_KINDS,
  VERDICT_LABELS,
  csvFile,
  csvLine,
  downloadCsv,
  type PersonFormCell,
  type PersonMapRow,
} from './selectionPersonMap';

/**
 * Срезы по карте участников: сколько людей прошли каждый этап, кто именно и
 * куда им писать.
 *
 * Вопрос всегда один и тот же — «кого дожимать». Поэтому счётчики и фильтр
 * живут вместе: любое число в сводке это готовый фильтр, а из отфильтрованного
 * списка одним движением собирается список почт.
 */

/**
 * Что считать выполненным этапом.
 *
 * По умолчанию — только присланная работа: отметку «я отправил» ставит сам
 * участник, и она регулярно врёт. Смягчённый счёт («работа или отметка»)
 * оставлен для рассылок, чтобы не дёргать тех, кто отправил, а мы просто не
 * нашли их ответ.
 */
export type StageBasis = 'answer_or_mark' | 'answer';

export const STAGE_BASIS_OPTIONS: { value: StageBasis; label: string }[] = [
  { value: 'answer', label: 'Только присланная работа' },
  { value: 'answer_or_mark', label: 'Работа или отметка на сайте' },
];

export const STAGE_BASIS_HINTS: Record<StageBasis, string> = {
  answer: 'Выполнено = ответ из выгрузки формы лёг на аккаунт. Отметка на сайте не в счёт: '
    + 'её ставит сам участник, и она ничего не доказывает.',
  answer_or_mark: 'Выполненным считается и отметка на сайте — удобно, чтобы не дёргать тех, '
    + 'кто отправил, но чей ответ мы пока не нашли.',
};

/** Ответ формы найден: сохранён или разобран в текущем файле. */
export function cellHasAnswer(cell: PersonFormCell): boolean {
  return cell.state === 'linked' || cell.state === 'pending';
}

export function stageDone(cell: PersonFormCell, basis: StageBasis): boolean {
  if (cellHasAnswer(cell)) return true;
  return basis === 'answer_or_mark' && cell.marked;
}

/** Состояние одной клетки карты — оно же строка сводки и оно же фильтр. */
export type StageState =
  | 'done'
  | 'missing'
  | 'answer'
  | 'mark_only'
  | 'started'
  | 'graded';

export const STAGE_STATE_LABELS: Record<StageState, string> = {
  done: 'выполнили',
  missing: 'не выполнили',
  answer: 'ответ сопоставлен',
  mark_only: 'только отметка на сайте',
  started: 'заходили, но не отправили',
  graded: 'оценено',
};

export function cellMatchesState(
  cell: PersonFormCell,
  state: StageState,
  basis: StageBasis,
): boolean {
  switch (state) {
    case 'done': return stageDone(cell, basis);
    case 'missing': return !stageDone(cell, basis);
    case 'answer': return cellHasAnswer(cell);
    case 'mark_only': return !cellHasAnswer(cell) && cell.marked;
    case 'started': return !cellHasAnswer(cell) && !cell.marked && !!cell.viewedAt;
    case 'graded': return cell.stageScore !== null;
    default: return true;
  }
}

export type StageTally = {
  kind: FormKind;
  total: number;
  counts: Record<StageState, number>;
};

export function tallyStages(rows: PersonMapRow[], basis: StageBasis): StageTally[] {
  return FORM_KINDS.map((kind) => {
    const counts: Record<StageState, number> = {
      done: 0, missing: 0, answer: 0, mark_only: 0, started: 0, graded: 0,
    };

    for (const row of rows) {
      const cell = row.cells[kind];
      for (const state of Object.keys(counts) as StageState[]) {
        if (cellMatchesState(cell, state, basis)) counts[state]++;
      }
    }

    return { kind, total: rows.length, counts };
  });
}

/**
 * Какие строки сводки показывать. У анкеты нет ни страницы этапа, ни оценки,
 * поэтому «заходили» и «оценено» для неё не существуют.
 */
export function stageStatesFor(kind: FormKind): StageState[] {
  if (kind === 'questionnaire') return ['answer', 'mark_only', 'missing'];
  return ['answer', 'mark_only', 'started', 'missing', 'graded'];
}

/**
 * Срез карты. Ровно один из вариантов: либо точное состояние одного этапа
 * (клик по числу в сводке), либо набор обязательных этапов (сбор почт).
 */
export type PersonMapSelection =
  | { mode: 'all' }
  | { mode: 'stage'; kind: FormKind; state: StageState }
  | { mode: 'missing_any'; stages: FormKind[] }
  | { mode: 'done_all'; stages: FormKind[] };

export const ALL_ROWS: PersonMapSelection = { mode: 'all' };

export type ContactRequirement = 'any' | 'known' | 'missing';
export type VerdictRequirement = 'any' | SelectionVerdict;

export const CONTACT_REQUIREMENT_OPTIONS: { value: ContactRequirement; label: string }[] = [
  { value: 'any', label: 'Любая' },
  { value: 'known', label: 'Есть куда писать' },
  { value: 'missing', label: 'Писать некуда' },
];

export const VERDICT_REQUIREMENT_OPTIONS: { value: VerdictRequirement; label: string }[] = [
  { value: 'any', label: 'Любое' },
  { value: 'waiting', label: 'Без решения' },
  { value: 'accepted', label: 'Зачислен' },
  { value: 'rejected', label: 'Отказ' },
];

export type PersonMapQuery = {
  text: string;
  contact: ContactRequirement;
  verdict: VerdictRequirement;
  basis: StageBasis;
  selection: PersonMapSelection;
};

export const EMPTY_PERSON_MAP_QUERY: PersonMapQuery = {
  text: '',
  contact: 'any',
  verdict: 'any',
  basis: 'answer',
  selection: ALL_ROWS,
};

export function sameSelection(a: PersonMapSelection, b: PersonMapSelection): boolean {
  if (a.mode !== b.mode) return false;
  if (a.mode === 'stage' && b.mode === 'stage') return a.kind === b.kind && a.state === b.state;
  if ((a.mode === 'missing_any' || a.mode === 'done_all') && 'stages' in b) {
    return a.stages.length === b.stages.length && a.stages.every((k) => b.stages.includes(k));
  }
  return true;
}

/** Пустой набор этапов ничего не сужает — иначе список молча опустел бы. */
export function matchesSelection(
  row: PersonMapRow,
  selection: PersonMapSelection,
  basis: StageBasis,
): boolean {
  switch (selection.mode) {
    case 'stage':
      return cellMatchesState(row.cells[selection.kind], selection.state, basis);
    case 'missing_any':
      return selection.stages.length === 0
        || selection.stages.some((kind) => !stageDone(row.cells[kind], basis));
    case 'done_all':
      return selection.stages.length === 0
        || selection.stages.every((kind) => stageDone(row.cells[kind], basis));
    default:
      return true;
  }
}

export function matchesPersonMapQuery(row: PersonMapRow, query: PersonMapQuery): boolean {
  if (!textMatches(query.text, [
    row.profile.display_name,
    row.contactEmail,
    profileEmail(row.profile),
    profileLogin(row.profile),
    row.profile.yandex_login,
    row.profile.school,
    row.profile.city,
  ])) return false;

  if (query.contact === 'known' && !row.contactEmail) return false;
  if (query.contact === 'missing' && row.contactEmail) return false;

  if (query.verdict !== 'any' && row.verdict !== query.verdict) return false;

  return matchesSelection(row, query.selection, query.basis);
}

function stagesLabel(stages: FormKind[]): string {
  return stages.map((kind) => FORM_KIND_LABELS[kind]).join(', ');
}

/** Название текущего среза — заголовок над списком почт и подпись к выгрузке. */
export function describeSelection(selection: PersonMapSelection): string {
  switch (selection.mode) {
    case 'stage':
      return `${FORM_KIND_LABELS[selection.kind]}: ${STAGE_STATE_LABELS[selection.state]}`;
    case 'missing_any':
      return selection.stages.length === FORM_KINDS.length
        ? 'Не выполнили хотя бы один этап'
        : `Не выполнили хотя бы один из: ${stagesLabel(selection.stages)}`;
    case 'done_all':
      return selection.stages.length === FORM_KINDS.length
        ? 'Выполнили все этапы'
        : `Выполнили все из: ${stagesLabel(selection.stages)}`;
    default:
      return 'Все участники';
  }
}

/**
 * Счётчик на кнопке «Фильтры»: только то, что спрятано в её панели. Отбор по
 * этапам туда не идёт — он и так виден фишками рядом.
 */
export function panelFilterCount(query: PersonMapQuery): number {
  let n = 0;
  if (query.contact !== 'any') n++;
  if (query.verdict !== 'any') n++;
  return n;
}

export function hasActiveQuery(query: PersonMapQuery): boolean {
  return panelFilterCount(query) > 0
    || query.selection.mode !== 'all'
    || query.text.trim() !== ''
    || query.basis !== EMPTY_PERSON_MAP_QUERY.basis;
}

/** Чего человеку не хватает — то же слово, что в сводке, но по строке. */
export function missingStages(row: PersonMapRow, basis: StageBasis): FormKind[] {
  return FORM_KINDS.filter((kind) => !stageDone(row.cells[kind], basis));
}

export function missingStagesLabel(row: PersonMapRow, basis: StageBasis): string {
  const missing = missingStages(row, basis);
  return missing.length === 0 ? '—' : stagesLabel(missing);
}

export type EmailList = {
  /** Уникальные адреса в порядке строк карты. */
  emails: string[];
  /** Сколько человек в срезе. */
  people: number;
  /** Кому писать некуда — их в списке нет, но знать о них надо. */
  unreachable: PersonMapRow[];
};

export function collectEmails(rows: PersonMapRow[]): EmailList {
  const emails: string[] = [];
  const seen = new Set<string>();
  const unreachable: PersonMapRow[] = [];

  for (const row of rows) {
    const email = row.contactEmail?.trim();
    if (!email) {
      unreachable.push(row);
      continue;
    }
    // Один адрес на два аккаунта бывает у братьев и сестёр — письмо одно.
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(email);
  }

  return { emails, people: rows.length, unreachable };
}

/** Через запятую: так список вставляется прямо в поле «Кому» почтового клиента. */
export function emailListText(emails: string[]): string {
  return emails.join(', ');
}

export function buildEmailListCsv(
  rows: PersonMapRow[],
  basis: StageBasis,
  selection: PersonMapSelection,
): string {
  const lines = [
    csvLine(['Срез', describeSelection(selection)]),
    '',
    csvLine([
      'Почта для связи', 'Участник', 'Чего не хватает', 'Решение',
      'Класс', 'Город', 'Школа',
    ]),
    ...rows.map((row) => csvLine([
      row.contactEmail ?? '',
      row.profile.display_name?.trim() ?? '',
      missingStagesLabel(row, basis),
      VERDICT_LABELS[row.verdict],
      row.profile.grade?.trim() ?? '',
      row.profile.city?.trim() ?? '',
      row.profile.school?.trim() ?? '',
    ])),
  ];

  return csvFile(lines);
}

export function downloadEmailListCsv(
  rows: PersonMapRow[],
  basis: StageBasis,
  selection: PersonMapSelection,
): void {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsv(buildEmailListCsv(rows, basis, selection), `pochty-${stamp}.csv`);
}
