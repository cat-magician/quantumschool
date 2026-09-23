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
  /**
   * Номер ответа в выгрузке: колонка ID у Форм, ID участника у Контеста. По
   * нему тот же ответ узнаётся при повторной загрузке файла.
   */
  answerId: number | null;
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
  answerId: null,
  code: null,
  name: null, email: null, submittedAt: null, login: null, city: null, school: null, grade: null,
  work: null,
};

const HEADER_HINTS: Record<keyof ColumnMapping, RegExp[]> = {
  answerId: [/^id$/i, /^id\s*в\s*контесте/i, /номер\s*ответа/i, /^id\s*ответа/i],
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
  answerId: [],
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
  /**
   * Чем эта отправка отличается от любой другой: номер из выгрузки, а если
   * его нет — файл работы, момент отправки, логин. По ключу связь и хранится.
   */
  answerKey: string;
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

/**
 * Ссылку в поле ФИО именем не считаем: часть форм так и заполнялась. Как и
 * мусор вроде «<h» — в имени должно быть хотя бы одно слово из двух букв.
 */
function cleanName(raw: string): string {
  const value = raw.trim();
  if (URL_RE.test(value)) return '';
  return /\p{L}{2,}/u.test(value) ? value : '';
}

/**
 * Похоже ли на настоящее имя: два слова и больше, из букв. «ivan2010» и
 * «А _» — не имена, а подписи; противоречить ФИО они не могут.
 */
export function isRealName(raw: string | null | undefined): boolean {
  const words = (raw ?? '').trim().split(/\s+/).filter((w) => /^\p{L}[\p{L}-]*$/u.test(w) && w.length >= 2);
  return words.length >= 2;
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
      answerKey: '',
      emailValid: email !== '' && isLikelyEmail(email),
    };
  });

  table.rows.forEach((row, i) => {
    entries[i].answerKey = answerKeyOf(entries[i], cell(row, mapping.answerId));
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

  collapseResentFiles(entries);
  return entries;
}

function answerKeyOf(entry: FormEntry, rawId: string): string {
  if (rawId) return `id:${rawId}`;
  if (entry.workUrl) return `file:${workFileName(entry.workUrl) || entry.workUrl}`;
  if (entry.submittedAt !== null) {
    return `at:${entry.submittedAt}|${entry.email || normalizeName(entry.name)}`;
  }
  if (entry.login) return `login:${entry.login}`;
  if (entry.name) return `name:${normalizeName(entry.name)}`;
  return `row:${entry.rowNumber}`;
}

/** Сколько времени между отправками одного и того же файла считаем повтором. */
const RESEND_WINDOW_MS = 15 * 60_000;

/**
 * Один и тот же файл, отправленный дважды за несколько минут, — это повторная
 * отправка одного человека, а не два участника. Так было со строками 52 и 53:
 * одинаковое имя файла, одинаковый текст, минута разницы — и вторая из них
 * висела «без аккаунта». Остаётся более поздняя; имя и почта, если они были
 * только в ранней, переезжают в неё.
 *
 * Сравниваем по имени файла без служебного кода Форм: одинаково называют
 * работы многие («motivatsionnoe_pismo.docx»), поэтому и окно короткое.
 */
function collapseResentFiles(entries: FormEntry[]): void {
  const byFile = new Map<string, FormEntry>();
  const ordered = [...entries]
    .filter((e) => !e.supersededBy && e.workUrl && e.submittedAt !== null)
    .sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0));

  for (const entry of ordered) {
    const key = workAuthorHint(workFileName(entry.workUrl)).toLowerCase()
      || entry.workUrl.toLowerCase();
    const previous = byFile.get(key);
    byFile.set(key, entry);
    if (!previous) continue;
    if ((entry.submittedAt ?? 0) - (previous.submittedAt ?? 0) > RESEND_WINDOW_MS) continue;

    // Две подписи разными людьми — это уже не повтор, а совпадение имён файлов.
    if (previous.name && entry.name && !compareNames(previous.name, entry.name)) continue;

    previous.supersededBy = entry.rowNumber;
    if (!entry.name) entry.name = previous.name;
    if (!entry.email) {
      entry.email = previous.email;
      entry.emailValid = previous.emailValid;
    }
  }
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
  | 'name_conflict'
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
  file_name_partial: 'фамилия в имени файла',
  name_conflict: 'подписано другим именем',
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
  file_name_partial: 30,
  // Подпись чужим ФИО — это довод против, а не просто отсутствие довода.
  // Вес такой, чтобы одно время или школа не вытягивали чужого человека
  // даже в подсказки, а почта — вытягивала, но только на ручной разбор.
  name_conflict: -60,
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

/** Одно слово в огрублённой латинице: «Кузнецов» → «kuznecov». */
function coarseWord(raw: string): string {
  return translitName(raw).replace(/\s+/g, '');
}

/**
 * Частые имена: одно имя в названии файла («pismo_aleksandr») ничего не
 * говорит — Александров в отборе десяток. Фамилия говорит, имя нет.
 */
const COMMON_FIRST_NAMES = new Set([
  'Александр', 'Алексей', 'Андрей', 'Антон', 'Артём', 'Артем', 'Арсений', 'Борис',
  'Вадим', 'Василий', 'Виктор', 'Владимир', 'Владислав', 'Глеб', 'Георгий', 'Григорий',
  'Даниил', 'Денис', 'Дмитрий', 'Егор', 'Иван', 'Игорь', 'Илья', 'Кирилл', 'Константин',
  'Лев', 'Леонид', 'Максим', 'Марк', 'Матвей', 'Михаил', 'Никита', 'Николай', 'Олег',
  'Павел', 'Пётр', 'Петр', 'Роман', 'Руслан', 'Семён', 'Сергей', 'Степан', 'Тимофей',
  'Тимур', 'Фёдор', 'Федор', 'Ярослав', 'Юрий', 'Анастасия', 'Анна', 'Алина', 'Алиса',
  'Арина', 'Валерия', 'Варвара', 'Вероника', 'Виктория', 'Дарья', 'Екатерина',
  'Елизавета', 'Ирина', 'Кристина', 'Ксения', 'Мария', 'Милана', 'Надежда', 'Наталья',
  'Ольга', 'Полина', 'София', 'Софья', 'Таисия', 'Ульяна', 'Юлия', 'Яна', 'Маргарита',
  'Татьяна', 'Вера', 'Ева', 'Лиза', 'Саша', 'Маша', 'Даша',
].map(coarseWord));

/**
 * ФИО в имени файла. Сравнивать словами мало: имена склеивают
 * («esselarionovandrej») или пишут одну фамилию («…_golubtsov»). Поэтому ищем
 * слова ФИО подстрокой в имени файла, огрубив обе стороны до латиницы.
 *
 * Два слова ФИО в файле — это подпись. Одно засчитывается, только если оно
 * длинное и не из частых имён: «golubcov» — да, «aleksandr» и «ivan» — нет.
 */
function fileNameSignal(hint: string, names: string[]): MatchSignal | null {
  const file = coarseWord(hint);
  if (!file) return null;

  let best: MatchSignal | null = null;
  for (const name of names) {
    const words = name.split(/\s+/).map(coarseWord).filter((w) => w.length >= 4);
    const hits = words.filter((w) => file.includes(w));
    if (hits.length >= 2) return 'file_name_exact';
    const surname = hits.find((w) => w.length >= 5 && !COMMON_FIRST_NAMES.has(w));
    if (surname) best = 'file_name_partial';
  }
  return best;
}

/**
 * Подписано ли явно другим человеком: у ответа настоящее ФИО, у аккаунта
 * тоже, и ни одного общего слова. «Лиза Шишкина» и «Шишкина Елизавета» —
 * не противоречие, общее слово есть; «Петров Пётр» и «Иванов Иван» — оно.
 */
function namesContradict(entryName: string, knownNames: string[]): boolean {
  if (!isRealName(entryName)) return false;
  const real = knownNames.filter(isRealName);
  if (real.length === 0) return false;

  const entryWords = new Set(
    entryName.split(/\s+/).map(coarseWord).filter((w) => w.length >= 3),
  );
  return !real.some((name) => name.split(/\s+/).map(coarseWord).some((w) => entryWords.has(w)));
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

  const knownNames = [profile.display_name, ...known.names];

  // Подпись в имени файла — запасной вход для эссе: там половина работ
  // пришла вообще без ФИО, зато файл назван фамилией.
  if (entry.workName && !byName) {
    const byFile = fileNameSignal(entry.workName, knownNames);
    if (byFile) signals.push(byFile);
  }

  // Ответ подписан другим человеком — время и школа такое не перевесят.
  if (!byName && namesContradict(entry.name, knownNames)) signals.push('name_conflict');

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
  /** Последняя отправка человека — по ней строка и подписана. */
  entry: FormEntry;
  /**
   * Все отправки этого человека в файле, последняя первой. Сохраняются все:
   * повтор не значит, что старая версия не нужна.
   */
  versions: FormEntry[];
  best: Candidate | null;
  alternatives: Candidate[];
  confidence: MatchConfidence;
  /** Ответ уже сохранён за этим аккаунтом — решать заново нечего. */
  savedFor: string | null;
  /** У аккаунта уже есть ответы этой формы — строка станет ещё одной версией. */
  addsVersion: boolean;
  /**
   * Похожие аккаунты, у которых ответы этой формы уже есть, но доводы слабые
   * (время, часть имени). Их не предлагаем, но показываем.
   */
  busy: Candidate[];
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

  // Подписано другим человеком — даже совпавшая почта решает только вместе с
  // человеком: братья и сёстры часто сидят на родительском адресе.
  if (best.signals.includes('name_conflict') && !best.signals.includes('code')) return 'likely';

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

  // ФИО совпало целиком — с профилем или с тем, как человек подписал другую
  // форму, — и больше никто по имени не подходит. Это не догадка: однофамилец
  // с тем же именем дал бы второго кандидата, и решал бы уже человек.
  if (best.signals.includes('name_exact') && !hasNameSignal(runnerUp) && gap >= 25) {
    return 'confident';
  }

  // Иначе нужен и высокий балл, и заметный отрыв от второго кандидата.
  if (best.score >= CONFIDENT_THRESHOLD && gap >= 25) return 'confident';
  return 'likely';
}

const NAME_SIGNALS: MatchSignal[] = ['name_exact', 'name_partial', 'file_name_exact', 'file_name_partial'];

function hasNameSignal(candidate: Candidate | null): boolean {
  return !!candidate && NAME_SIGNALS.some((s) => candidate.signals.includes(s));
}

/** Ответ, уже сохранённый за аккаунтом по этой форме. */
export type SavedAnswer = {
  profileId: string;
  /** Номер ответа из выгрузки; у связей, сохранённых до ключей, — пусто. */
  answerKey: string | null;
  workUrl: string | null;
  submittedAt: number | null;
  name: string;
  email: string | null;
  sourceFile: string;
  sourceRow: number | null;
};

/**
 * Что уже сохранено по форме: у человека может быть несколько ответов —
 * переслал эссе, дважды заполнил анкету. Все они его.
 */
export type TakenSlots = Map<string, SavedAnswer[]>;

export function takenSlotsFromLinks(
  links: {
    user_id: string;
    form_kind: string;
    answer_key?: string | null;
    work_url?: string | null;
    form_submitted_at: string | null;
    form_name?: string | null;
    contact_email?: string | null;
    source_file?: string | null;
    source_row?: number | null;
  }[],
  kind: FormKind,
): TakenSlots {
  const slots: TakenSlots = new Map();
  for (const link of links) {
    if (link.form_kind !== kind) continue;
    const at = link.form_submitted_at ? Date.parse(link.form_submitted_at) : NaN;
    const answer: SavedAnswer = {
      profileId: link.user_id,
      answerKey: link.answer_key && !link.answer_key.startsWith('legacy:') ? link.answer_key : null,
      workUrl: link.work_url ?? null,
      submittedAt: Number.isNaN(at) ? null : at,
      name: link.form_name ?? '',
      email: link.contact_email ?? null,
      sourceFile: link.source_file ?? '',
      sourceRow: link.source_row ?? null,
    };
    const list = slots.get(link.user_id);
    if (list) list.push(answer);
    else slots.set(link.user_id, [answer]);
  }
  return slots;
}

/**
 * Та же ли это отправка, что уже сохранена. Надёжнее всего номер ответа из
 * выгрузки; у связей, сохранённых до него, — файл работы, момент отправки с
 * почтой или именем, а у контеста, где времени нет вовсе, — подпись.
 */
export function sameAnswer(entry: FormEntry, saved: SavedAnswer): boolean {
  if (saved.answerKey) return saved.answerKey === entry.answerKey;

  if (entry.workUrl && saved.workUrl) {
    return (workFileName(entry.workUrl) || entry.workUrl) === (workFileName(saved.workUrl) || saved.workUrl);
  }
  // Работа есть только с одной стороны — это разные отправки.
  if (entry.workUrl || saved.workUrl) return false;

  if (entry.submittedAt === null && saved.submittedAt === null) {
    // Контест: времени нет, отправка одна на человека — узнаём по подписи.
    return !!entry.name && !!saved.name && normalizeName(entry.name) === normalizeName(saved.name);
  }
  if (entry.submittedAt === null || saved.submittedAt === null) return false;
  const apart = Math.abs(entry.submittedAt - saved.submittedAt);

  if (entry.email && saved.email) {
    return apart <= 60_000 && normalizeEmail(entry.email) === normalizeEmail(saved.email);
  }
  if (entry.name && saved.name) {
    return apart <= 60_000 && compareNames(entry.name, saved.name) !== null;
  }
  // Подтвердить нечем — годится только та же секунда: повторная выгрузка
  // отдаёт время отправки один в один, а соседняя отправка уже другая.
  return apart <= 1000 && !entry.name && !saved.name;
}

/**
 * Доводы, которых хватает, чтобы признать строку ещё одной отправкой
 * человека, у которого ответы этой формы уже есть. Время и частичное имя —
 * не такие: из-за них строки и уезжали к чужим людям.
 */
const STRONG_SIGNALS: MatchSignal[] = ['code', 'email', 'login', 'name_exact'];

function isStrong(candidate: Candidate): boolean {
  return STRONG_SIGNALS.some((s) => candidate.signals.includes(s));
}

/** Все отправки одного человека в файле: последняя первой. */
function groupVersions(entries: FormEntry[]): Map<number, FormEntry[]> {
  const byRow = new Map(entries.map((e) => [e.rowNumber, e]));
  const leadOf = (entry: FormEntry): FormEntry => {
    let current = entry;
    const seen = new Set<number>();
    while (current.supersededBy && !seen.has(current.rowNumber)) {
      seen.add(current.rowNumber);
      const next = byRow.get(current.supersededBy);
      if (!next) break;
      current = next;
    }
    return current;
  };

  const groups = new Map<number, FormEntry[]>();
  for (const entry of entries) {
    const lead = leadOf(entry);
    const list = groups.get(lead.rowNumber);
    if (list) list.push(entry);
    else groups.set(lead.rowNumber, [entry]);
  }

  for (const [leadRow, list] of groups) {
    list.sort((a, b) => (
      a.rowNumber === leadRow ? -1 : b.rowNumber === leadRow ? 1 : (b.submittedAt ?? 0) - (a.submittedAt ?? 0)
    ));
  }
  return groups;
}

/**
 * Сопоставление одной выгрузки.
 *
 * Строки одного человека (повторные отправки) собираются в группу и
 * сопоставляются вместе: доводы берутся из любой версии, а сохраняются все.
 * Уже сохранённые ответы узнаются сразу. Остальные группы раздаются по
 * убыванию балла: один аккаунт — одна группа в файле. Аккаунт, у которого
 * ответы этой формы уже есть, получает новую группу только при твёрдых
 * доводах — тогда это ещё одна его версия; по времени или части имени чужой
 * ответ к нему не приедет.
 */
export function matchFormEntries(
  entries: FormEntry[],
  profiles: UserProfile[],
  kind: FormKind,
  aliases?: ProfileAliases,
  taken: TakenSlots = new Map(),
): MatchRow[] {
  const groups = groupVersions(entries);
  const leads = entries.filter((e) => !e.supersededBy);
  const profilesById = new Map(profiles.map((p) => [p.id, p]));

  // Уже сохранённые: группа принадлежит тому, за кем сохранена любая её версия.
  const savedBy = new Map<number, string>();
  const recognised = new Set<SavedAnswer>();
  for (const lead of leads) {
    const versions = groups.get(lead.rowNumber) ?? [lead];
    search: for (const version of versions) {
      for (const [profileId, answers] of taken) {
        for (const answer of answers) {
          if (recognised.has(answer) || !sameAnswer(version, answer)) continue;
          savedBy.set(lead.rowNumber, profileId);
          recognised.add(answer);
          break search;
        }
      }
    }
  }

  // Балл группы — по лучшей из её версий: имя могло быть только в одной.
  const scored = leads.map((lead) => {
    const versions = groups.get(lead.rowNumber) ?? [lead];
    const candidates = profiles
      .map((profile) => versions
        .map((version) => scoreCandidate(version, profile, kind, aliases?.get(profile.id)))
        .reduce((best, c) => (c.score > best.score ? c : best)))
      .filter((c) => c.score >= LIKELY_THRESHOLD)
      .sort((a, b) => b.score - a.score);
    return { entry: lead, versions, candidates };
  });

  const assigned = new Map<number, Candidate>();
  const claimed = new Set<string>();
  for (const { entry } of scored) {
    const owner = savedBy.get(entry.rowNumber);
    if (!owner) continue;
    const profile = profilesById.get(owner);
    assigned.set(entry.rowNumber, profile
      ? scoreCandidate(entry, profile, kind, aliases?.get(owner))
      : { profileId: owner, score: 0, signals: [] });
    claimed.add(owner);
  }

  const pairs = scored
    .filter(({ entry }) => !savedBy.has(entry.rowNumber))
    .flatMap(({ entry, candidates }) => candidates.map((candidate) => ({ entry, candidate })));
  pairs.sort((a, b) => b.candidate.score - a.candidate.score);

  for (const { entry, candidate } of pairs) {
    if (assigned.has(entry.rowNumber)) continue;
    if (claimed.has(candidate.profileId)) continue;
    if (taken.has(candidate.profileId) && !isStrong(candidate)) continue;
    assigned.set(entry.rowNumber, candidate);
    claimed.add(candidate.profileId);
  }

  const rows: MatchRow[] = scored.map(({ entry, versions, candidates }) => {
    const savedFor = savedBy.get(entry.rowNumber) ?? null;
    const best = assigned.get(entry.rowNumber) ?? null;
    const others = candidates.filter((c) => c.profileId !== best?.profileId);
    const free = others.filter((c) => !taken.has(c.profileId) || isStrong(c));
    const busy = savedFor
      ? []
      : others.filter((c) => taken.has(c.profileId) && !isStrong(c)
        && c.score >= (best?.score ?? LIKELY_THRESHOLD));

    // Соперник для оценки уверенности — любой, в том числе занятый: если
    // занятый аккаунт похож не меньше, строка может быть его повтором.
    const confidence: MatchConfidence = savedFor ? 'confident' : classify(best, others[0] ?? null);
    return {
      entry,
      versions,
      best,
      alternatives: free.slice(0, 4),
      confidence,
      savedFor,
      addsVersion: !savedFor && !!best && taken.has(best.profileId),
      busy: busy.slice(0, 2),
    };
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
  takenByKind: Map<FormKind, TakenSlots> = new Map(),
): MatchRow[][] {
  const known: ProfileAliases = new Map(
    [...aliases].map(([id, identity]) => [id, {
      names: [...identity.names],
      emails: [...identity.emails],
    }]),
  );

  let result: MatchRow[][] = [];

  for (let pass = 0; pass < CROSS_FORM_PASSES; pass++) {
    result = sources.map((source) => matchFormEntries(
      source.entries, profiles, source.kind, known, takenByKind.get(source.kind),
    ));

    let learned = 0;
    for (const rows of result) {
      for (const row of rows) {
        // Учимся только на бесспорном: догадка, принятая за факт, потащит за
        // собой следующие формы и размножит одну ошибку на три.
        if (row.confidence !== 'confident' || !row.best) continue;
        for (const version of row.versions) {
          if (rememberIdentity(known, row.best.profileId, version)) learned++;
        }
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
