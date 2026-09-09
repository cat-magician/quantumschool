import type { UserProfile } from './types';
import { profileEmail, profileLogin } from './profileUtils';
import type { TableData } from './tableImport';

/**
 * Сопоставление ответов Яндекс.Форм с аккаунтами сайта.
 *
 * Формы не сохраняли, с какого аккаунта их отправили, поэтому личность
 * восстанавливаем по совокупности сигналов: почта, ФИО, близость времени
 * ответа к отметке «я отправил» в профиле, город/школа/класс.
 */

export type FormKind = 'questionnaire' | 'essay' | 'contest';

export const FORM_KIND_LABELS: Record<FormKind, string> = {
  questionnaire: 'Анкета',
  essay: 'Эссе',
  contest: 'Контест',
};

/** Отметка в профиле, с которой сравниваем время ответа в форме. */
export function profileStageTimestamp(profile: UserProfile, kind: FormKind): string | null | undefined {
  if (kind === 'questionnaire') return profile.questionnaire_submitted_at;
  if (kind === 'essay') return profile.stage1_submitted_at;
  return profile.stage2_submitted_at;
}

export type ColumnMapping = {
  /** Код участника, подставленный сайтом в форму: точная привязка без угадывания. */
  code: number | null;
  name: number | null;
  email: number | null;
  submittedAt: number | null;
  login: number | null;
  city: number | null;
  school: number | null;
  grade: number | null;
};

export const EMPTY_MAPPING: ColumnMapping = {
  code: null,
  name: null, email: null, submittedAt: null, login: null, city: null, school: null, grade: null,
};

const HEADER_HINTS: Record<keyof ColumnMapping, RegExp[]> = {
  code: [/код\s*участник/i, /^код$/i, /participant.*code/i],
  name: [/^ваше\s*фио/i, /фио/i, /^имя\s*и\s*фамилия/i, /user_?name/i, /полное\s*имя/i],
  email: [/ваша\s*почта/i, /почта/i, /эмейл/i, /e-?mail/i, /мейл/i],
  submittedAt: [/время\s*создания/i, /время\s*отправки/i, /дата.*отправ/i, /timestamp/i, /^время$/i],
  login: [/^логин$/i, /login/i, /ник/i],
  city: [/откуда\s*вы/i, /город/i, /населённый|населенный/i],
  school: [/школ/i, /учебное\s*заведение/i],
  grade: [/класс/i, /курс/i],
};

/**
 * «Время начала заполнения» — не то же, что «Время создания» (момент отправки).
 * Для сопоставления нужен именно момент отправки, начало заполнения только мешает.
 */
const HEADER_BLOCKLIST: Record<keyof ColumnMapping, RegExp[]> = {
  code: [],
  name: [/^имя$/i, /^фамилия$/i],
  email: [],
  submittedAt: [/время\s*начала/i, /затраченное/i],
  login: [],
  city: [],
  school: [],
  grade: [],
};

export function autoDetectColumns(headers: string[]): ColumnMapping {
  const mapping = { ...EMPTY_MAPPING };

  for (const key of Object.keys(HEADER_HINTS) as (keyof ColumnMapping)[]) {
    const blocked = HEADER_BLOCKLIST[key];
    for (const pattern of HEADER_HINTS[key]) {
      const index = headers.findIndex((h) => (
        h && pattern.test(h) && !blocked.some((b) => b.test(h))
      ));
      if (index >= 0) { mapping[key] = index; break; }
    }
  }

  return mapping;
}

export type FormEntry = {
  /** Номер строки в исходном файле, 1 — первая строка данных. */
  rowNumber: number;
  /** Код участника из формы; у старых выгрузок пусто. */
  code: string;
  name: string;
  email: string;
  login: string;
  submittedAt: number | null;
  city: string;
  school: string;
  grade: string;
  /** Адрес похож на почту. С опечаткой писать участнику некуда. */
  emailValid: boolean;
  /** Отброшена как повторная отправка того же человека. */
  supersededBy?: number;
};

const URL_RE = /^https?:\/\//i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ссылку в поле ФИО именем не считаем: часть форм так и заполнялась. */
function cleanName(raw: string): string {
  const value = raw.trim();
  return URL_RE.test(value) ? '' : value;
}

export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isLikelyEmail(raw: string): boolean {
  return EMAIL_RE.test(raw.trim());
}

/**
 * Формы отдают «2026-08-20 11:30:41» без зоны — считаем временем браузера
 * и даём поправку на случай, когда выгрузка сделана в другом поясе.
 */
export function parseFormTimestamp(raw: string, offsetHours = 0): number | null {
  const value = raw.trim();
  if (!value) return null;

  const local = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (local) {
    const ms = new Date(
      Number(local[1]), Number(local[2]) - 1, Number(local[3]),
      Number(local[4]), Number(local[5]), Number(local[6] ?? '0'),
    ).getTime();
    return ms - offsetHours * 3600_000;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed - offsetHours * 3600_000;
}

function cell(row: string[], index: number | null): string {
  return index === null ? '' : (row[index] ?? '').trim();
}

/** Повторные отправки схлопываем: у человека остаётся последняя по времени. */
export function buildFormEntries(
  table: TableData,
  mapping: ColumnMapping,
  offsetHours = 0,
): FormEntry[] {
  const entries: FormEntry[] = table.rows.map((row, i) => {
    const email = normalizeEmail(cell(row, mapping.email));
    return {
      rowNumber: i + 1,
      code: cell(row, mapping.code).toLowerCase(),
      name: cleanName(cell(row, mapping.name)),
      email,
      login: cell(row, mapping.login).toLowerCase(),
      submittedAt: parseFormTimestamp(cell(row, mapping.submittedAt), offsetHours),
      city: cell(row, mapping.city),
      school: cell(row, mapping.school),
      grade: cell(row, mapping.grade),
      emailValid: email !== '' && isLikelyEmail(email),
    };
  });

  const latestByKey = new Map<string, FormEntry>();
  for (const entry of entries) {
    const key = entry.code
      || entry.email
      || (entry.name ? `name:${normalizeName(entry.name)}` : '');
    if (!key) continue;

    const previous = latestByKey.get(key);
    if (!previous) { latestByKey.set(key, entry); continue; }

    const older = (previous.submittedAt ?? 0) <= (entry.submittedAt ?? 0) ? previous : entry;
    const newer = older === previous ? entry : previous;
    older.supersededBy = newer.rowNumber;
    latestByKey.set(key, newer);
  }

  return entries;
}

export type MatchSignal =
  | 'code'
  | 'email'
  | 'login'
  | 'login_local'
  | 'name_exact'
  | 'name_partial'
  | 'time_close'
  | 'time_near'
  | 'time_loose'
  | 'city'
  | 'school'
  | 'grade';

export const SIGNAL_LABELS: Record<MatchSignal, string> = {
  code: 'код участника',
  email: 'почта совпала',
  login: 'логин совпал',
  login_local: 'логин похож на почту',
  name_exact: 'ФИО совпало',
  name_partial: 'ФИО частично',
  time_close: 'время ±5 мин',
  time_near: 'время ±30 мин',
  time_loose: 'время ±3 ч',
  city: 'город',
  school: 'школа',
  grade: 'класс',
};

const SIGNAL_WEIGHTS: Record<MatchSignal, number> = {
  code: 200,
  email: 100,
  login: 100,
  login_local: 30,
  name_exact: 50,
  name_partial: 25,
  time_close: 40,
  time_near: 25,
  time_loose: 10,
  city: 5,
  school: 8,
  grade: 3,
};

const MINUTE = 60_000;

function nameSignal(entryName: string, profileName: string): MatchSignal | null {
  if (!entryName || !profileName) return null;

  const a = normalizeName(entryName);
  const b = normalizeName(profileName);
  if (!a || !b) return null;
  if (a === b) return 'name_exact';

  const aWords = new Set(a.split(' ').filter((w) => w.length >= 3));
  const bWords = new Set(b.split(' ').filter((w) => w.length >= 3));
  if (aWords.size === 0 || bWords.size === 0) return null;

  let shared = 0;
  for (const word of aWords) if (bWords.has(word)) shared++;

  // Совпадение одного слова — это чаще всего просто частое имя, не человек.
  return shared >= 2 ? 'name_partial' : null;
}

function timeSignal(entryAt: number | null, profileAt: string | null | undefined): MatchSignal | null {
  if (entryAt === null || !profileAt) return null;
  const stamp = new Date(profileAt).getTime();
  if (Number.isNaN(stamp)) return null;

  const diff = Math.abs(stamp - entryAt);
  if (diff <= 5 * MINUTE) return 'time_close';
  if (diff <= 30 * MINUTE) return 'time_near';
  if (diff <= 180 * MINUTE) return 'time_loose';
  return null;
}

function sameText(a: string, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizeName(a) === normalizeName(b);
}

export type Candidate = {
  profileId: string;
  score: number;
  signals: MatchSignal[];
};

export function scoreCandidate(
  entry: FormEntry,
  profile: UserProfile,
  kind: FormKind,
): Candidate {
  const signals: MatchSignal[] = [];

  // Код участника подставляет сам сайт — если он есть, угадывать нечего.
  if (entry.code && entry.code === profile.id.toLowerCase()) signals.push('code');

  const profileMail = normalizeEmail(profileEmail(profile) ?? '');
  const recovery = normalizeEmail(profile.recovery_email ?? '');
  if (entry.email && (entry.email === profileMail || entry.email === recovery)) {
    signals.push('email');
  }

  // Монитор Контеста подписывает участника логином Яндекс ID, а аккаунты с
  // чужим доменом — полным адресом почты. Совпадение с локальной частью
  // адреса («ivanov» ← ivanov@mail.ru) — только догадка: разные люди легко
  // получают одинаковый префикс, поэтому решать по нему нельзя.
  if (entry.login) {
    const exact = [profile.yandex_login, profileLogin(profile), profileMail]
      .filter((v): v is string => Boolean(v))
      .map((v) => v.toLowerCase());

    if (exact.includes(entry.login)) signals.push('login');
    else if (profileMail && entry.login === profileMail.split('@')[0]) signals.push('login_local');
  }

  const byName = nameSignal(entry.name, profile.display_name);
  if (byName) signals.push(byName);

  const byTime = timeSignal(entry.submittedAt, profileStageTimestamp(profile, kind));
  if (byTime) signals.push(byTime);

  if (sameText(entry.city, profile.city)) signals.push('city');
  if (sameText(entry.school, profile.school)) signals.push('school');
  if (entry.grade && profile.grade && entry.grade.trim() === profile.grade.trim()) signals.push('grade');

  const score = signals.reduce((sum, s) => sum + SIGNAL_WEIGHTS[s], 0);
  return { profileId: profile.id, score, signals };
}

export type MatchConfidence = 'confident' | 'likely' | 'unmatched';

export type MatchRow = {
  entry: FormEntry;
  best: Candidate | null;
  alternatives: Candidate[];
  confidence: MatchConfidence;
};

const LIKELY_THRESHOLD = 30;
const CONFIDENT_THRESHOLD = 75;

function classify(best: Candidate | null, runnerUp: Candidate | null): MatchConfidence {
  if (!best || best.score < LIKELY_THRESHOLD) return 'unmatched';

  // Код, точная почта или логин — решают сами по себе.
  if (
    best.signals.includes('code')
    || best.signals.includes('email')
    || best.signals.includes('login')
  ) return 'confident';

  // Иначе нужен и высокий балл, и заметный отрыв от второго кандидата.
  const gap = best.score - (runnerUp?.score ?? 0);
  if (best.score >= CONFIDENT_THRESHOLD && gap >= 25) return 'confident';
  return 'likely';
}

/**
 * Один аккаунт — одна строка формы. Разбираем пары по убыванию балла, поэтому
 * сильные совпадения занимают аккаунт раньше слабых.
 */
export function matchFormEntries(
  entries: FormEntry[],
  profiles: UserProfile[],
  kind: FormKind,
): MatchRow[] {
  const active = entries.filter((e) => !e.supersededBy);

  const scored = active.map((entry) => {
    const candidates = profiles
      .map((profile) => scoreCandidate(entry, profile, kind))
      .filter((c) => c.score >= LIKELY_THRESHOLD)
      .sort((a, b) => b.score - a.score);
    return { entry, candidates };
  });

  const pairs = scored.flatMap(({ entry, candidates }) =>
    candidates.map((candidate) => ({ entry, candidate })));
  pairs.sort((a, b) => b.candidate.score - a.candidate.score);

  const takenProfiles = new Set<string>();
  const assigned = new Map<number, Candidate>();

  for (const { entry, candidate } of pairs) {
    if (assigned.has(entry.rowNumber)) continue;
    if (takenProfiles.has(candidate.profileId)) continue;
    assigned.set(entry.rowNumber, candidate);
    takenProfiles.add(candidate.profileId);
  }

  const rows: MatchRow[] = scored.map(({ entry, candidates }) => {
    const best = assigned.get(entry.rowNumber) ?? null;
    const alternatives = candidates.filter((c) => c.profileId !== best?.profileId).slice(0, 4);
    const runnerUp = alternatives[0] ?? null;
    return { entry, best, alternatives, confidence: classify(best, runnerUp) };
  });

  // Сначала то, что требует внимания.
  const order: Record<MatchConfidence, number> = { likely: 0, unmatched: 1, confident: 2 };
  return rows.sort((a, b) => (
    order[a.confidence] - order[b.confidence]
    || (b.best?.score ?? 0) - (a.best?.score ?? 0)
  ));
}

/** Решение админа по строке: `undefined` — не трогал, `null` — «не сопоставлять». */
export type MatchOverrides = Record<number, string | null>;

export type ResolvedMatch = {
  profileId: string | null;
  /** Решение принял человек, а не скоринг. */
  manual: boolean;
  /** Готово к записи: точное совпадение или подтверждённая догадка. */
  ready: boolean;
};

export function resolveMatch(row: MatchRow, overrides: MatchOverrides): ResolvedMatch {
  const override = overrides[row.entry.rowNumber];
  const manual = override !== undefined;
  const profileId = manual ? override : row.best?.profileId ?? null;

  return {
    profileId,
    manual,
    ready: profileId !== null && (manual || row.confidence === 'confident'),
  };
}

export type MatchSummary = {
  total: number;
  duplicates: number;
  ready: number;
  needsReview: number;
  unmatched: number;
  profilesWithoutEntry: number;
};

export function summarizeMatches(
  entries: FormEntry[],
  rows: MatchRow[],
  profiles: UserProfile[],
  overrides: MatchOverrides = {},
): MatchSummary {
  const linked = new Set<string>();
  let ready = 0;
  let needsReview = 0;
  let unmatched = 0;

  for (const row of rows) {
    const { profileId, ready: isReady } = resolveMatch(row, overrides);
    if (profileId) linked.add(profileId);

    if (isReady) ready++;
    else if (profileId) needsReview++;
    else unmatched++;
  }

  return {
    total: rows.length,
    duplicates: entries.filter((e) => e.supersededBy).length,
    ready,
    needsReview,
    unmatched,
    profilesWithoutEntry: profiles.filter((p) => !linked.has(p.id)).length,
  };
}

/** Один аккаунт нельзя привязать к двум ответам — руками так сделать можно. */
export function conflictingProfileIds(rows: MatchRow[], overrides: MatchOverrides): Set<string> {
  const seen = new Set<string>();
  const conflicts = new Set<string>();

  for (const row of rows) {
    const { profileId } = resolveMatch(row, overrides);
    if (!profileId) continue;
    if (seen.has(profileId)) conflicts.add(profileId);
    seen.add(profileId);
  }

  return conflicts;
}
