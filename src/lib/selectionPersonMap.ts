import type { SelectionFormLink, UserProfile } from './types';
import { profileContactEmail, profileEmail, profileLogin } from './profileUtils';
import { selectionVerdict, type SelectionVerdict } from './selectionDisplayUtils';
import { stageSubmitted } from './selectionFilters';
import {
  FORM_KIND_LABELS,
  SIGNAL_LABELS,
  profileStageTimestamp,
  type FormEntry,
  type FormKind,
  type MatchSignal,
} from './identityMatching';

/**
 * Полная карта участника: что известно из аккаунта, что сайт отследил сам и
 * что нашлось по каждой форме. Разбор идёт по одной форме за раз, а смотреть
 * на человека нужно целиком — иначе не видно, кого ещё дожимать и кому некуда
 * писать.
 *
 * Карта строится только из свежих данных базы: всё, что сайт знает сам
 * (регистрация, отметки этапов, оценки, решение), попадает в неё сразу, без
 * повторного разбора файлов. Разобранные формы ложатся сверху отдельным слоем.
 */

export const FORM_KINDS: FormKind[] = ['questionnaire', 'essay', 'contest'];

export type CellState =
  /** Связь подтверждена и записана в базу. */
  | 'linked'
  /** Разобрано в текущем файле, но ещё не сохранено. */
  | 'pending'
  /** Аккаунт отметил отправку на сайте, но ответ формы не сопоставлен. */
  | 'marked_only'
  /** Ни связи, ни отметки. */
  | 'missing';

/** Что об этапе знает сам сайт, без всяких форм. */
export type SiteStage = {
  /** Ученик нажал «я отправил» — или статус выставлен админом. */
  marked: boolean;
  markedAt: string | null;
  /** Открывал страницу этапа; у анкеты такой метки нет. */
  viewedAt: string | null;
  /** Оценка проверяющего; у анкеты оценок нет. */
  stageScore: number | null;
};

export type PersonFormCell = SiteStage & {
  state: CellState;
  /** Время ответа в форме; если связи нет — наша отметка на сайте. */
  at: string | null;
  /** Ссылка на присланную работу — то самое доказательство отправки. */
  workUrl: string | null;
  /** Сколько отправок этой формы у человека: повторы не выбрасываются. */
  versions: number;
  signals: MatchSignal[];
  /** Балл сопоставления, а не оценка за работу. */
  score: number | null;
  sourceFile: string | null;
  sourceRow: number | null;
};

export type ContactSource = 'questionnaire' | 'account' | 'recovery' | 'none';

export type PersonMapRow = {
  profile: UserProfile;
  contactEmail: string | null;
  contactSource: ContactSource;
  registeredAt: string | null;
  verdict: SelectionVerdict;
  cells: Record<FormKind, PersonFormCell>;
  /** По скольким формам связь установлена (0..3). */
  linkedCount: number;
};

/** Ответ формы, которому не нашлось аккаунта. */
export type OrphanAnswer = {
  kind: FormKind;
  entry: FormEntry;
  sourceFile: string | null;
};

export type PendingMatch = {
  profileId: string;
  entry: FormEntry;
  signals: MatchSignal[];
  score: number | null;
};

export type PendingState = {
  kind: FormKind;
  sourceFile: string | null;
  matches: PendingMatch[];
  orphans: FormEntry[];
};

function contactSourceOf(profile: UserProfile): ContactSource {
  if (profile.contact_email?.trim()) return 'questionnaire';
  if (profileEmail(profile)) return 'account';
  if (profile.recovery_email?.trim()) return 'recovery';
  return 'none';
}

/**
 * Этапы лежат в базе под историческими именами: эссе — stage1, контест —
 * stage2, а у анкеты есть только метка отправки. Здесь единственное место,
 * где про это надо помнить.
 */
export function siteStage(profile: UserProfile, kind: FormKind): SiteStage {
  const markedAt = profileStageTimestamp(profile, kind) ?? null;

  if (kind === 'questionnaire') {
    return { marked: !!markedAt, markedAt, viewedAt: null, stageScore: null };
  }

  const essay = kind === 'essay';
  return {
    marked: stageSubmitted(essay ? profile.stage1_status : profile.stage2_status, markedAt),
    markedAt,
    viewedAt: (essay ? profile.stage1_viewed_at : profile.stage2_viewed_at) ?? null,
    stageScore: essay ? profile.stage1_score : profile.stage2_score,
  };
}

/** Разбор может идти сразу по нескольким выгрузкам — по одной на форму. */
export type PendingInput = PendingState | PendingState[] | null | undefined;

function pendingByKind(pending: PendingInput): Map<FormKind, PendingState> {
  const list = pending ? (Array.isArray(pending) ? pending : [pending]) : [];
  // Две выгрузки одной формы — берём последнюю: она и лежит на экране.
  return new Map(list.map((state) => [state.kind, state]));
}

function stamp(link: SelectionFormLink): number {
  const at = Date.parse(link.form_submitted_at ?? link.updated_at ?? '');
  return Number.isNaN(at) ? 0 : at;
}

export function buildPersonMap(
  profiles: UserProfile[],
  links: SelectionFormLink[],
  pending?: PendingInput,
): PersonMapRow[] {
  const linksByUser = new Map<string, SelectionFormLink[]>();
  for (const link of links) {
    const list = linksByUser.get(link.user_id);
    if (list) list.push(link);
    else linksByUser.set(link.user_id, [link]);
  }

  const byKind = pendingByKind(pending);
  const pendingByProfile = new Map<FormKind, Map<string, PendingMatch>>();
  for (const [kind, state] of byKind) {
    pendingByProfile.set(kind, new Map(state.matches.map((m) => [m.profileId, m])));
  }

  return profiles.map((profile) => {
    const cells = {} as Record<FormKind, PersonFormCell>;

    for (const kind of FORM_KINDS) {
      const site = siteStage(profile, kind);
      // Отправок бывает несколько — в клетке последняя, остальные в счётчике.
      const ofKind = (linksByUser.get(profile.id) ?? [])
        .filter((l) => l.form_kind === kind)
        .sort((a, b) => stamp(b) - stamp(a));
      const link = ofKind[0];

      if (link) {
        cells[kind] = {
          ...site,
          state: 'linked',
          at: link.form_submitted_at,
          workUrl: link.work_url || null,
          versions: ofKind.length,
          signals: (link.match_signals ?? []) as MatchSignal[],
          score: link.match_score,
          sourceFile: link.source_file || null,
          sourceRow: link.source_row,
        };
        continue;
      }

      const draft = pendingByProfile.get(kind)?.get(profile.id);
      if (draft) {
        cells[kind] = {
          ...site,
          state: 'pending',
          at: draft.entry.submittedAt ? new Date(draft.entry.submittedAt).toISOString() : null,
          workUrl: draft.entry.workUrl || null,
          versions: 1,
          signals: draft.signals,
          score: draft.score,
          sourceFile: byKind.get(kind)?.sourceFile ?? null,
          sourceRow: draft.entry.rowNumber,
        };
        continue;
      }

      cells[kind] = {
        ...site,
        state: site.marked ? 'marked_only' : 'missing',
        at: site.markedAt,
        workUrl: null,
        versions: 0,
        signals: [],
        score: null,
        sourceFile: null,
        sourceRow: null,
      };
    }

    const linkedCount = FORM_KINDS.filter((k) => (
      cells[k].state === 'linked' || cells[k].state === 'pending'
    )).length;

    return {
      profile,
      contactEmail: profileContactEmail(profile),
      contactSource: contactSourceOf(profile),
      registeredAt: profile.created_at ?? null,
      verdict: selectionVerdict(profile.is_enrolled, !!profile.selection_rejected),
      cells,
      linkedCount,
    };
  });
}

export function buildOrphanAnswers(pending?: PendingInput): OrphanAnswer[] {
  return [...pendingByKind(pending).values()].flatMap((state) => state.orphans.map((entry) => ({
    kind: state.kind,
    entry,
    sourceFile: state.sourceFile,
  })));
}

/**
 * Что изменилось на сайте с прошлого обновления карты. Нужно, чтобы после
 * авто-обновления было видно: карта не просто перерисовалась, а подобрала
 * новых людей и новые отметки.
 */
export type SiteSnapshot = {
  profiles: UserProfile[];
  links: SelectionFormLink[];
};

export type SiteDataDiff = {
  /** Появились в базе. */
  people: number;
  /** Отметили этап на сайте. */
  marks: number;
  /** Получили оценку за этап. */
  grades: number;
  /** Новые сохранённые связи с ответами форм. */
  links: number;
};

export function diffSiteData(before: SiteSnapshot, after: SiteSnapshot): SiteDataDiff {
  const previous = new Map(before.profiles.map((p) => [p.id, p]));
  let people = 0;
  let marks = 0;
  let grades = 0;

  for (const profile of after.profiles) {
    const old = previous.get(profile.id);

    if (!old) {
      people++;
      // Новичок мог зарегистрироваться и сразу всё отправить — это тоже новость.
      for (const kind of FORM_KINDS) {
        const stage = siteStage(profile, kind);
        if (stage.marked) marks++;
        if (stage.stageScore !== null) grades++;
      }
      continue;
    }

    for (const kind of FORM_KINDS) {
      const now = siteStage(profile, kind);
      const then = siteStage(old, kind);
      if (now.marked && !then.marked) marks++;
      if (now.stageScore !== null && then.stageScore === null) grades++;
    }
  }

  const known = new Set(before.links.map((l) => `${l.user_id}:${l.form_kind}`));
  const links = after.links.filter((l) => !known.has(`${l.user_id}:${l.form_kind}`)).length;

  return { people, marks, grades, links };
}

export function siteDataDiffTotal(diff: SiteDataDiff): number {
  return diff.people + diff.marks + diff.grades + diff.links;
}

/** Без склонений: «участников: 2» читается одинаково при любом числе. */
export function describeSiteDataDiff(diff: SiteDataDiff): string {
  const parts: string[] = [];
  if (diff.people) parts.push(`новых участников: ${diff.people}`);
  if (diff.marks) parts.push(`новых отметок: ${diff.marks}`);
  if (diff.grades) parts.push(`новых оценок: ${diff.grades}`);
  if (diff.links) parts.push(`новых связей: ${diff.links}`);
  return parts.join(' · ');
}

const CELL_STATE_LABELS: Record<CellState, string> = {
  linked: 'связано',
  pending: 'не сохранено',
  marked_only: 'отмечено на сайте, ответ не сопоставлен',
  missing: 'нет',
};

const CONTACT_SOURCE_LABELS: Record<ContactSource, string> = {
  questionnaire: 'из анкеты',
  account: 'почта аккаунта',
  recovery: 'для восстановления',
  none: 'нет',
};

export const VERDICT_LABELS: Record<SelectionVerdict, string> = {
  accepted: 'Зачислен',
  rejected: 'Отказ',
  waiting: 'Без решения',
};

const dateFmt = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export function formatMapStamp(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateFmt.format(date);
}

const dayFmt = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit', month: '2-digit', year: 'numeric',
});

/** Дата без времени — там, где минуты только мешают (например, регистрация). */
export function formatMapDay(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dayFmt.format(date);
}

export function describeSignals(signals: MatchSignal[]): string {
  return signals.map((s) => SIGNAL_LABELS[s]).join(', ');
}

/** Отметки самого сайта словами — одинаково в таблице и в выгрузке. */
export function describeSiteStage(cell: SiteStage): string {
  if (cell.marked) {
    const stamp = formatMapStamp(cell.markedAt);
    return stamp ? `отметил ${stamp}` : 'отметил отправку';
  }
  if (cell.viewedAt) {
    const stamp = formatMapStamp(cell.viewedAt);
    return stamp ? `заходил ${stamp}` : 'заходил';
  }
  return 'не приступал';
}

const SEPARATOR = ';';
const ROW_END = '\r\n';

function escapeCell(value: string): string {
  if (!/[;"\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function csvLine(cells: string[]): string {
  return cells.map(escapeCell).join(SEPARATOR);
}

export function csvFile(lines: string[]): string {
  return lines.join(ROW_END) + ROW_END;
}

/** Метка порядка байтов в начале файла: без неё Excel читает UTF-8 как ANSI. */
const BOM = String.fromCharCode(0xfeff);

/** Отдаёт файл браузеру. */
export function downloadCsv(content: string, fileName: string): void {
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Карта в CSV: цвет на экране, а здесь то же самое словами. */
export function buildPersonMapCsv(rows: PersonMapRow[], orphans: OrphanAnswer[]): string {
  const header = [
    'Участник', 'Ник / логин', 'Логин Яндекса', 'Почта аккаунта',
    'Почта для связи', 'Откуда почта',
    ...FORM_KINDS.flatMap((k) => [
      `${FORM_KIND_LABELS[k]}: статус`,
      `${FORM_KIND_LABELS[k]}: время`,
      `${FORM_KIND_LABELS[k]}: работа`,
      `${FORM_KIND_LABELS[k]}: на сайте`,
      `${FORM_KIND_LABELS[k]}: балл`,
      `${FORM_KIND_LABELS[k]}: на чём сошлось`,
      `${FORM_KIND_LABELS[k]}: источник`,
    ]),
    'Форм связано', 'Решение', 'Регистрация',
  ];

  const body = rows.map((row) => [
    row.profile.display_name?.trim() ?? '',
    profileLogin(row.profile) ?? '',
    row.profile.yandex_login?.trim() ?? '',
    profileEmail(row.profile) ?? '',
    row.contactEmail ?? '',
    CONTACT_SOURCE_LABELS[row.contactSource],
    ...FORM_KINDS.flatMap((kind) => {
      const cell = row.cells[kind];
      const source = cell.sourceFile
        ? `${cell.sourceFile}${cell.sourceRow ? `, строка ${cell.sourceRow}` : ''}`
        : '';
      return [
        cell.versions > 1
          ? `${CELL_STATE_LABELS[cell.state]} (отправок: ${cell.versions})`
          : CELL_STATE_LABELS[cell.state],
        formatMapStamp(cell.at),
        cell.workUrl ?? '',
        describeSiteStage(cell),
        cell.stageScore === null ? '' : String(cell.stageScore),
        describeSignals(cell.signals),
        source,
      ];
    }),
    `${row.linkedCount} из ${FORM_KINDS.length}`,
    VERDICT_LABELS[row.verdict],
    formatMapStamp(row.registeredAt),
  ]);

  const lines = [csvLine(header), ...body.map(csvLine)];

  if (orphans.length > 0) {
    lines.push('');
    lines.push(escapeCell('Ответы без аккаунта'));
    lines.push(csvLine(['Форма', 'Строка', 'Имя в форме', 'Почта в форме', 'Время', 'Файл']));
    for (const orphan of orphans) {
      lines.push(csvLine([
        FORM_KIND_LABELS[orphan.kind],
        String(orphan.entry.rowNumber),
        orphan.entry.name,
        orphan.entry.email,
        orphan.entry.submittedAt ? formatMapStamp(new Date(orphan.entry.submittedAt).toISOString()) : '',
        orphan.sourceFile ?? '',
      ]));
    }
  }

  return csvFile(lines);
}

export function downloadPersonMapCsv(rows: PersonMapRow[], orphans: OrphanAnswer[]): void {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsv(buildPersonMapCsv(rows, orphans), `karta-uchastnikov-${stamp}.csv`);
}
