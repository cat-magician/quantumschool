import type { SelectionFormLink, UserProfile } from './types';
import { profileContactEmail, profileEmail, profileLogin } from './profileUtils';
import {
  FORM_KIND_LABELS,
  SIGNAL_LABELS,
  profileStageTimestamp,
  type FormEntry,
  type FormKind,
  type MatchSignal,
} from './identityMatching';

/**
 * Полная карта участника: что известно из аккаунта и что нашлось по каждой
 * форме. Разбор идёт по одной форме за раз, а смотреть на человека нужно
 * целиком — иначе не видно, кого ещё дожимать и кому некуда писать.
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

export type PersonFormCell = {
  state: CellState;
  /** Время ответа в форме; если связи нет — наша отметка на сайте. */
  at: string | null;
  signals: MatchSignal[];
  score: number | null;
  sourceFile: string | null;
  sourceRow: number | null;
};

export type ContactSource = 'questionnaire' | 'account' | 'recovery' | 'none';

export type PersonMapRow = {
  profile: UserProfile;
  contactEmail: string | null;
  contactSource: ContactSource;
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

function emptyCell(profile: UserProfile, kind: FormKind): PersonFormCell {
  const marked = profileStageTimestamp(profile, kind);
  return {
    state: marked ? 'marked_only' : 'missing',
    at: marked ?? null,
    signals: [],
    score: null,
    sourceFile: null,
    sourceRow: null,
  };
}

export function buildPersonMap(
  profiles: UserProfile[],
  links: SelectionFormLink[],
  pending?: PendingState | null,
): PersonMapRow[] {
  const linksByUser = new Map<string, SelectionFormLink[]>();
  for (const link of links) {
    const list = linksByUser.get(link.user_id);
    if (list) list.push(link);
    else linksByUser.set(link.user_id, [link]);
  }

  const pendingByProfile = new Map<string, PendingMatch>();
  for (const match of pending?.matches ?? []) {
    pendingByProfile.set(match.profileId, match);
  }

  return profiles.map((profile) => {
    const cells = {} as Record<FormKind, PersonFormCell>;

    for (const kind of FORM_KINDS) {
      const link = linksByUser.get(profile.id)?.find((l) => l.form_kind === kind);

      if (link) {
        cells[kind] = {
          state: 'linked',
          at: link.form_submitted_at,
          signals: (link.match_signals ?? []) as MatchSignal[],
          score: link.match_score,
          sourceFile: link.source_file || null,
          sourceRow: link.source_row,
        };
        continue;
      }

      const draft = pending?.kind === kind ? pendingByProfile.get(profile.id) : undefined;
      if (draft) {
        cells[kind] = {
          state: 'pending',
          at: draft.entry.submittedAt ? new Date(draft.entry.submittedAt).toISOString() : null,
          signals: draft.signals,
          score: draft.score,
          sourceFile: pending?.sourceFile ?? null,
          sourceRow: draft.entry.rowNumber,
        };
        continue;
      }

      cells[kind] = emptyCell(profile, kind);
    }

    const linkedCount = FORM_KINDS.filter((k) => (
      cells[k].state === 'linked' || cells[k].state === 'pending'
    )).length;

    return {
      profile,
      contactEmail: profileContactEmail(profile),
      contactSource: contactSourceOf(profile),
      cells,
      linkedCount,
    };
  });
}

export function buildOrphanAnswers(pending?: PendingState | null): OrphanAnswer[] {
  if (!pending) return [];
  return pending.orphans.map((entry) => ({
    kind: pending.kind,
    entry,
    sourceFile: pending.sourceFile,
  }));
}

export type PersonMapFilter = 'all' | 'no_contact' | 'incomplete' | 'linked';

export const PERSON_MAP_FILTERS: { value: PersonMapFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'no_contact', label: 'Некуда писать' },
  { value: 'incomplete', label: 'Есть пробелы' },
  { value: 'linked', label: 'Полностью разобраны' },
];

export function matchesPersonMapFilter(row: PersonMapRow, filter: PersonMapFilter): boolean {
  switch (filter) {
    case 'no_contact': return row.contactEmail === null;
    case 'incomplete': return row.linkedCount < FORM_KINDS.length;
    case 'linked': return row.linkedCount === FORM_KINDS.length;
    default: return true;
  }
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

const dateFmt = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export function formatMapStamp(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateFmt.format(date);
}

export function describeSignals(signals: MatchSignal[]): string {
  return signals.map((s) => SIGNAL_LABELS[s]).join(', ');
}

const SEPARATOR = ';';
const ROW_END = '\r\n';

function escapeCell(value: string): string {
  if (!/[;"\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/** Карта в CSV: цвет на экране, а здесь то же самое словами. */
export function buildPersonMapCsv(rows: PersonMapRow[], orphans: OrphanAnswer[]): string {
  const header = [
    'Участник', 'Ник / логин', 'Логин Яндекса', 'Почта аккаунта',
    'Почта для связи', 'Откуда почта',
    ...FORM_KINDS.flatMap((k) => [
      `${FORM_KIND_LABELS[k]}: статус`,
      `${FORM_KIND_LABELS[k]}: время`,
      `${FORM_KIND_LABELS[k]}: на чём сошлось`,
      `${FORM_KIND_LABELS[k]}: источник`,
    ]),
    'Форм связано',
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
        CELL_STATE_LABELS[cell.state],
        formatMapStamp(cell.at),
        describeSignals(cell.signals),
        source,
      ];
    }),
    `${row.linkedCount} из ${FORM_KINDS.length}`,
  ]);

  const lines = [header, ...body].map((cells) => cells.map(escapeCell).join(SEPARATOR));

  if (orphans.length > 0) {
    lines.push('');
    lines.push(escapeCell('Ответы без аккаунта'));
    lines.push(['Форма', 'Строка', 'Имя в форме', 'Почта в форме', 'Время', 'Файл']
      .map(escapeCell).join(SEPARATOR));
    for (const orphan of orphans) {
      lines.push([
        FORM_KIND_LABELS[orphan.kind],
        String(orphan.entry.rowNumber),
        orphan.entry.name,
        orphan.entry.email,
        orphan.entry.submittedAt ? formatMapStamp(new Date(orphan.entry.submittedAt).toISOString()) : '',
        orphan.sourceFile ?? '',
      ].map(escapeCell).join(SEPARATOR));
    }
  }

  return lines.join(ROW_END) + ROW_END;
}

export function downloadPersonMapCsv(rows: PersonMapRow[], orphans: OrphanAnswer[]): void {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([`\uFEFF${buildPersonMapCsv(rows, orphans)}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `karta-uchastnikov-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
