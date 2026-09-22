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
  /** Ссылка на присланную работу — единственное доказательство, что этап сделан. */
  work: number | null;
};

export const EMPTY_MAPPING: ColumnMapping = {
  code: null,
  name: null, email: null, submittedAt: null, login: null, city: null, school: null, grade: null,
  work: null,
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
  work: [
    /мотивацион/i, /^письмо/i, /эссе/i, /решени/i,
    /ссылк/i, /файл/i, /работ/i, /документ/i,
  ],
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
  work: [],
};

/**
 * Колонку с работой заголовок выдаёт не всегда: у монитора «9(Загрузка
 * решений)» — это вердикт, а не файл, зато в эссе половина участников вставила
 * ссылку в поле ФИО. Поэтому догадку по заголовку проверяем содержимым, а если
 * заголовок молчит — ищем колонку, где ссылки просто есть.
 */
function detectWorkColumn(
  mapping: ColumnMapping,
  headers: string[],
  rows: string[][],
): number | null {
  const hasLinks = (index: number) => rows.some((row) => isLink(row[index] ?? ''));

  if (mapping.work !== null) return hasLinks(mapping.work) ? mapping.work : null;

  const taken = new Set(
    (Object.keys(mapping) as (keyof ColumnMapping)[])
      .filter((key) => key !== 'work')
      .map((key) => mapping[key])
      .filter((index): index is number => index !== null),
  );

  for (let index = 0; index < headers.length; index++) {
    if (taken.has(index)) continue;
    if (hasLinks(index)) return index;
  }

  return null;
}

export function autoDetectColumns(headers: string[], rows: string[][] = []): ColumnMapping {
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

  // Без строк проверить нечем — остаётся догадка по заголовку.
  if (rows.length > 0) mapping.work = detectWorkColumn(mapping, headers, rows);

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
  /**
   * Ссылка на присланную работу. Для эссе это и есть доказательство отправки:
   * отметка на сайте показывает только намерение, а файл — факт.
   */
  workUrl: string;
  /** Как назван присланный файл — иногда это и есть подпись автора. */
  workName: string;
  /** Адрес похож на почту. С опечаткой писать участнику некуда. */
  emailValid: boolean;
  /** Отброшена как повторная отправка того же человека. */
  supersededBy?: number;
};

const URL_RE = /^https?:\/\//i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isLink(raw: string): boolean {
  return URL_RE.test(raw.trim());
}

/** Ссылку в поле ФИО именем не считаем: часть форм так и заполнялась. */
function cleanName(raw: string): string {
  const value = raw.trim();
  return URL_RE.test(value) ? '' : value;
}

/**
 * Ссылка на работу: сначала своя колонка, а если человек вставил файл в поле
 * ФИО — берём оттуда. Так делала половина отвечавших, и раньше эта ссылка
 * просто пропадала вместе с именем.
 */
function pickWork(workCell: string, nameCell: string): string {
  if (isLink(workCell)) return workCell.trim();
  return isLink(nameCell) ? nameCell.trim() : '';
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

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y',
  ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/**
 * Огрублённая латиница: одно и то же имя пишут по-разному — Кузнецов,
 * Kuznetsov, Kuznetcov, Kuznecov. Схлопываем разночтения (ts/tc/ц → c, kh → h,
 * y/j → i, сдвоенные буквы → одна), чтобы такие записи сходились.
 *
 * Огрубление щедрое, поэтому само по себе оно ничего не решает: частичным
 * совпадением считается только два общих слова.
 */
export function translitName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[а-яё]/g, (letter) => TRANSLIT[letter] ?? letter)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/shch|sch/g, 's')
    .replace(/kh/g, 'h')
    .replace(/ts|tc/g, 'c')
    .replace(/ch/g, 'c')
    .replace(/sh/g, 's')
    .replace(/zh/g, 'z')
    .replace(/[yj]/g, 'i')
    .replace(/(.)\1+/g, '$1')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

/**
 * Имя присланного файла спрятано в самой ссылке: Диск кладёт путь к файлу в
 * параметр path. Ничего скачивать не нужно — имя видно из выгрузки.
 */
export function workFileName(url: string): string {
  try {
    const raw = new URL(url).searchParams.get('path');
    if (!raw) return '';
    return decodeURIComponent(raw).split('/').filter(Boolean).pop() ?? '';
  } catch {
    return '';
  }
}

/**
 * Подпись автора в имени файла: Формы приписывают спереди 24-значный
 * служебный код, а дальше идёт то, как человек назвал работу — часто своим же
 * ФИО, обычно транслитом.
 */
export function workAuthorHint(fileName: string): string {
  return fileName
    .replace(/^[0-9a-f]{24}/i, '')
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .replace(/[-_+.]+/g, ' ')
    .trim();
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
    const rawName = cell(row, mapping.name);
    return {
      rowNumber: i + 1,
      code: cell(row, mapping.code).toLowerCase(),
      name: cleanName(rawName),
      email,
      login: cell(row, mapping.login).toLowerCase(),
      submittedAt: parseFormTimestamp(cell(row, mapping.submittedAt), offsetHours),
      city: cell(row, mapping.city),
      school: cell(row, mapping.school),
      grade: cell(row, mapping.grade),
      workUrl: pickWork(cell(row, mapping.work), rawName),
      workName: workAuthorHint(workFileName(pickWork(cell(row, mapping.work), rawName))),
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
  | 'file_name_exact'
  | 'file_name_partial'
  | 'time_exact'
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
  file_name_exact: 'ФИО в имени файла',
  file_name_partial: 'имя файла частично',
  time_exact: 'время ±2 мин',
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
  // Имя файла — слабее подписи в самой форме: люди называют работы как
  // попало, и «esse final» не должно никого ни с кем роднить.
  file_name_exact: 45,
  file_name_partial: 22,
  time_exact: 55,
  time_close: 40,
  time_near: 25,
  time_loose: 10,
  city: 5,
  school: 8,
  grade: 3,
};

const MINUTE = 60_000;

function sharedWordCount(a: string, b: string): number {
  const aWords = new Set(a.split(' ').filter((w) => w.length >= 3));
  const bWords = new Set(b.split(' ').filter((w) => w.length >= 3));
  if (aWords.size === 0 || bWords.size === 0) return 0;

  let shared = 0;
  for (const word of aWords) if (bWords.has(word)) shared++;
  return shared;
}

export type NameMatch = 'exact' | 'partial' | null;

/**
 * Одно ли это имя. Сверяем дважды: как есть и в огрублённой латинице — файлы с
 * работами подписаны транслитом, и «Кузнецов» должен сойтись с «Kuznetsov».
 *
 * Совпадение одного слова — это чаще всего просто частое имя, не человек,
 * поэтому частичным считаем только два общих слова и больше.
 */
export function compareNames(left: string, right: string): NameMatch {
  if (!left || !right) return null;

  const a = normalizeName(left);
  const b = normalizeName(right);
  if (a && b && a === b) return 'exact';

  const ta = translitName(left);
  const tb = translitName(right);
  if (ta && tb && ta === tb) return 'exact';

  if (sharedWordCount(a, b) >= 2 || sharedWordCount(ta, tb) >= 2) return 'partial';
  return null;
}

function nameSignal(entryName: string, profileName: string): MatchSignal | null {
  const match = compareNames(entryName, profileName);
  if (match === 'exact') return 'name_exact';
  return match === 'partial' ? 'name_partial' : null;
}

function fileNameSignal(hint: string, profileName: string): MatchSignal | null {
  const match = compareNames(hint, profileName);
  if (match === 'exact') return 'file_name_exact';
  return match === 'partial' ? 'file_name_partial' : null;
}

function timeSignal(entryAt: number | null, profileAt: string | null | undefined): MatchSignal | null {
  if (entryAt === null || !profileAt) return null;
  const stamp = new Date(profileAt).getTime();
  if (Number.isNaN(stamp)) return null;

  const diff = Math.abs(stamp - entryAt);
  if (diff <= 2 * MINUTE) return 'time_exact';
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

/**
 * Что мы узнали о человеке из уже разобранных форм. Анкета подписана ФИО и
 * почтой, которых может не быть в профиле, — для следующей формы это такие же
 * законные признаки, как имя и адрес аккаунта. Формы связаны между собой
 * человеком, и разбирать их поодиночке значит каждый раз начинать с нуля.
 */
export type KnownIdentity = { names: string[]; emails: string[] };
export type ProfileAliases = Map<string, KnownIdentity>;

const NOTHING_KNOWN: KnownIdentity = { names: [], emails: [] };

export function rememberIdentity(
  aliases: ProfileAliases,
  profileId: string,
  found: { name?: string | null; email?: string | null },
): boolean {
  const known = aliases.get(profileId) ?? { names: [], emails: [] };
  const name = found.name?.trim();
  const email = normalizeEmail(found.email ?? '');
  let added = false;

  if (name && !known.names.includes(name)) { known.names.push(name); added = true; }
  if (email && isLikelyEmail(email) && !known.emails.includes(email)) {
    known.emails.push(email);
    added = true;
  }

  if (added) aliases.set(profileId, known);
  return added;
}

export function aliasesFromLinks(
  links: { user_id: string; form_name?: string | null; contact_email?: string | null }[],
): ProfileAliases {
  const aliases: ProfileAliases = new Map();
  for (const link of links) {
    rememberIdentity(aliases, link.user_id, { name: link.form_name, email: link.contact_email });
  }
  return aliases;
}

export function scoreCandidate(
  entry: FormEntry,
  profile: UserProfile,
  kind: FormKind,
  known: KnownIdentity = NOTHING_KNOWN,
): Candidate {
  const signals: MatchSignal[] = [];

  // Код участника подставляет сам сайт — если он есть, угадывать нечего.
  if (entry.code && entry.code === profile.id.toLowerCase()) signals.push('code');

  const profileMail = normalizeEmail(profileEmail(profile) ?? '');
  const recovery = normalizeEmail(profile.recovery_email ?? '');
  // Почта из анкеты у входов по логину — единственный настоящий адрес, и
  // следующие формы человек подписывает ею же.
  const fromForm = normalizeEmail(profile.contact_email ?? '');
  const addresses = [profileMail, recovery, fromForm, ...known.emails].filter(Boolean);
  if (entry.email && addresses.includes(entry.email)) signals.push('email');

  // Монитор Контеста подписывает участника логином Яндекс ID, а аккаунты с
  // чужим доменом — полным адресом почты. Совпадение с локальной частью
  // адреса («ivanov» ← ivanov@mail.ru) — только догадка: разные люди легко
  // получают одинаковый префикс, поэтому решать по нему нельзя.
  if (entry.login) {
    const exact = [profile.yandex_login, profileLogin(profile), profileMail, ...known.emails]
      .filter((v): v is string => Boolean(v))
      .map((v) => v.toLowerCase());

    if (exact.includes(entry.login)) signals.push('login');
    else if (profileMail && entry.login === profileMail.split('@')[0]) signals.push('login_local');
  }

  // Имя аккаунта бывает ником, а в анкете человек подписался полным ФИО:
  // сверяемся со всеми именами, под которыми мы его уже видели.
  const byName = [profile.display_name, ...known.names]
    .map((known) => nameSignal(entry.name, known))
    .reduce<MatchSignal | null>((best, signal) => {
      if (!signal) return best;
      if (signal === 'name_exact' || best === null) return signal;
      return best;
    }, null);
  if (byName) signals.push(byName);

  // Подпись в имени файла — запасной вход для эссе: там половина работ
  // пришла вообще без ФИО, зато файл назван фамилией.
  if (entry.workName && !byName) {
    const byFile = [profile.display_name, ...known.names]
      .map((known) => fileNameSignal(entry.workName, known))
      .reduce<MatchSignal | null>((best, signal) => {
        if (!signal) return best;
        if (signal === 'file_name_exact' || best === null) return signal;
        return best;
      }, null);
    if (byFile) signals.push(byFile);
  }

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

// 25 — ровно вес «время ±30 мин» и «ФИО частично». Ниже этого подсказка
// бессмысленна, а на этом уровне она уже полезна: у половины эссе нет ни
// имени, ни почты, и показать ближайший по времени аккаунт лучше, чем
// не показать ничего. Решение всё равно за человеком — авто-подтверждение
// живёт на отдельном, куда более строгом правиле.
const LIKELY_THRESHOLD = 25;
const CONFIDENT_THRESHOLD = 75;

const TIME_SIGNALS: MatchSignal[] = ['time_exact', 'time_close', 'time_near', 'time_loose'];

function hasTimeSignal(candidate: Candidate | null): boolean {
  return !!candidate && TIME_SIGNALS.some((s) => candidate.signals.includes(s));
}

function classify(best: Candidate | null, runnerUp: Candidate | null): MatchConfidence {
  if (!best || best.score < LIKELY_THRESHOLD) return 'unmatched';

  // Код, точная почта или логин — решают сами по себе.
  if (
    best.signals.includes('code')
    || best.signals.includes('email')
    || best.signals.includes('login')
  ) return 'confident';

  const gap = best.score - (runnerUp?.score ?? 0);

  // Ради этого метки времени и собирались: у эссе часто нет ни имени, ни почты,
  // и единственная зацепка — отметка «я отправил» на сайте. Если в двух минутах
  // от ответа стоит ровно один аккаунт, а рядом с ним больше никого по времени
  // нет, это ответ, а не повод для ручного разбора. Как только по времени
  // подходит второй — решать снова человеку.
  if (best.signals.includes('time_exact') && !hasTimeSignal(runnerUp) && gap >= 25) {
    return 'confident';
  }

  // Иначе нужен и высокий балл, и заметный отрыв от второго кандидата.
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
  aliases?: ProfileAliases,
): MatchRow[] {
  const active = entries.filter((e) => !e.supersededBy);

  const scored = active.map((entry) => {
    const candidates = profiles
      .map((profile) => scoreCandidate(entry, profile, kind, aliases?.get(profile.id)))
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
/** Одна загруженная выгрузка: какая это форма и что из неё прочиталось. */
export type FormSource = {
  kind: FormKind;
  entries: FormEntry[];
};

/**
 * Сколько раз прогонять разбор. Второй проход подхватывает то, что узнал
 * первый (ФИО и почту из анкеты), третий — то, что узнал второй. Дальше
 * узнавать уже нечего, но на всякий случай есть предел.
 */
const CROSS_FORM_PASSES = 4;

/**
 * Разбор нескольких выгрузок разом.
 *
 * Формы связаны человеком: анкета знает ФИО и почту, эссе — время и файл,
 * контест — яндекс-логин. Поодиночке каждая слепа, поэтому найденное в одной
 * форме сразу становится признаком для остальных, и проходы повторяются, пока
 * что-то новое находится.
 */
export function matchFormSources(
  sources: FormSource[],
  profiles: UserProfile[],
  aliases: ProfileAliases = new Map(),
): MatchRow[][] {
  const known: ProfileAliases = new Map(
    [...aliases].map(([id, identity]) => [id, {
      names: [...identity.names],
      emails: [...identity.emails],
    }]),
  );

  let result: MatchRow[][] = [];

  for (let pass = 0; pass < CROSS_FORM_PASSES; pass++) {
    result = sources.map((source) => matchFormEntries(source.entries, profiles, source.kind, known));

    let learned = 0;
    for (const rows of result) {
      for (const row of rows) {
        // Учимся только на бесспорном: догадка, принятая за факт, потащит за
        // собой следующие формы и размножит одну ошибку на три.
        if (row.confidence !== 'confident' || !row.best) continue;
        if (rememberIdentity(known, row.best.profileId, row.entry)) learned++;
      }
    }

    if (learned === 0) break;
  }

  return result;
}

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
