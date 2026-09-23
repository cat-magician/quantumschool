import type { TableData } from './tableImport';
import type { ContestReview, ContestSubmission } from './contestReview';
import { REVIEW_LEVEL_LABELS } from './contestReview';

/**
 * Архив всех посылок Контеста — источник того, кто на самом деле участвовал.
 *
 * Монитор показывает не всех: у кого ноль баллов, тот в него может и не
 * попасть, хотя посылки слал. В архиве же лежит папка на каждого участника —
 * `<подпись>-<ID участника>`, внутри файлы вида
 * `<задача>-<посылка>-<компилятор>-<вердикт>`. Логинов в архиве нет, зато они
 * есть в мониторе, и склеить их можно по подписи: это одно и то же поле —
 * `user_name` монитора и имя папки.
 *
 * Время отправки Контест в архив не кладёт: все файлы проштампованы моментом
 * сборки архива. Поэтому колонки времени в итоге нет вовсе — лучше без неё,
 * чем с одной и той же неверной минутой у всех. Когда человек решал, можно
 * только оценить — по датам внутри загруженных решений и сквозным номерам
 * посылок (см. contestClock.ts).
 */

export type ContestParticipant = {
  /** Как участник подписан в Контесте: логин, почта или ФИО. */
  who: string;
  participantId: string;
  submissions: number;
  /** Номера задач, по которым есть зачтённая посылка. */
  solved: Set<string>;
};

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
/** Флаг «имена в UTF-8»; без него Контест пишет их в cp866. */
const UTF8_FLAG = 0x800;
/** Конец архива: 22 байта записи плюс комментарий до 64 КБ. */
const TAIL_BYTES = 0xffff + 22;

async function readSlice(file: Blob, start: number, end: number): Promise<DataView> {
  return new DataView(await file.slice(start, end).arrayBuffer());
}

type ZipEntry = {
  name: string;
  method: number;
  offset: number;
  compressedSize: number;
  size: number;
  /** Штамп файла в архиве — у Контеста это момент сборки архива, по Москве. */
  modified: number | null;
};

const MSK_OFFSET_MS = 3 * 3600_000;

/** Дата и время из записи zip: формат MS-DOS, без часового пояса. */
function dosTime(date: number, time: number): number | null {
  const year = 1980 + (date >> 9);
  const month = (date >> 5) & 0xf;
  const day = date & 0x1f;
  if (month < 1 || month > 12 || day < 1) return null;
  const local = Date.UTC(year, month - 1, day, time >> 11, (time >> 5) & 0x3f, (time & 0x1f) * 2);
  return local - MSK_OFFSET_MS;
}

/**
 * Имена файлов из оглавления zip. Оглавление лежит в конце архива, поэтому
 * читаем только хвост: архив посылок весит под сотню мегабайт, а нужны из
 * него несколько килобайт.
 */
export async function readZipNames(file: Blob): Promise<string[]> {
  return (await readZipDirectory(file)).map((entry) => entry.name);
}

async function readZipDirectory(file: Blob): Promise<ZipEntry[]> {
  const tailStart = Math.max(0, file.size - TAIL_BYTES);
  const tail = await readSlice(file, tailStart, file.size);

  let eocd = -1;
  for (let at = tail.byteLength - 22; at >= 0; at--) {
    if (tail.getUint32(at, true) === EOCD_SIGNATURE) { eocd = at; break; }
  }
  if (eocd < 0) throw new Error('Не похоже на zip: не найдено оглавление архива');

  const count = tail.getUint16(eocd + 10, true);
  const size = tail.getUint32(eocd + 12, true);
  const offset = tail.getUint32(eocd + 16, true);
  if (offset === 0xffffffff || count === 0xffff) {
    throw new Error('Архив в формате ZIP64 — такой размер Контест не выдаёт, проверьте файл');
  }

  const directory = await readSlice(file, offset, offset + size);
  const utf8 = new TextDecoder('utf-8');
  const dos = new TextDecoder('ibm866');
  const entries: ZipEntry[] = [];
  let pointer = 0;

  for (let i = 0; i < count; i++) {
    if (pointer + 46 > directory.byteLength) break;
    if (directory.getUint32(pointer, true) !== CENTRAL_SIGNATURE) break;
    const flags = directory.getUint16(pointer + 8, true);
    const nameLength = directory.getUint16(pointer + 28, true);
    const extraLength = directory.getUint16(pointer + 30, true);
    const commentLength = directory.getUint16(pointer + 32, true);
    const raw = new Uint8Array(directory.buffer, directory.byteOffset + pointer + 46, nameLength);

    entries.push({
      name: (flags & UTF8_FLAG ? utf8 : dos).decode(raw),
      method: directory.getUint16(pointer + 10, true),
      compressedSize: directory.getUint32(pointer + 20, true),
      size: directory.getUint32(pointer + 24, true),
      offset: directory.getUint32(pointer + 42, true),
      modified: dosTime(directory.getUint16(pointer + 14, true), directory.getUint16(pointer + 12, true)),
    });
    pointer += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

const LOCAL_SIGNATURE = 0x04034b50;

/** Распакованный поток одного файла архива — без чтения остального архива. */
async function openEntry(file: Blob, entry: ZipEntry): Promise<ReadableStream<Uint8Array> | null> {
  const header = await readSlice(file, entry.offset, entry.offset + 30);
  if (header.getUint32(0, true) !== LOCAL_SIGNATURE) return null;
  const start = entry.offset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
  const stream = file.slice(start, start + entry.compressedSize).stream();
  return entry.method === 8 ? stream.pipeThrough(new DecompressionStream('deflate-raw')) : stream;
}

async function readEntryBytes(file: Blob, entry: ZipEntry): Promise<Uint8Array> {
  const stream = await openEntry(file, entry);
  return stream ? new Uint8Array(await new Response(stream).arrayBuffer()) : new Uint8Array();
}

/** Текст одного небольшого файла архива. */
async function readEntryText(file: Blob, entry: ZipEntry): Promise<string> {
  return new TextDecoder('utf-8').decode(await readEntryBytes(file, entry)).trim();
}

/**
 * Прогоняет файл архива через `visit` кусками текста, не держа весь файл в
 * памяти: решения весят мегабайты, а дата в них — пара десятков байт. Хвост
 * прошлого куска приклеивается к следующему (`overlap` символов), чтобы
 * запись на стыке не потерялась; `overlap: Infinity` копит текст целиком.
 */
async function scanEntry(
  file: Blob,
  entry: ZipEntry,
  visit: (text: string) => void,
  { overlap, maxBytes = Infinity }: { overlap: number; maxBytes?: number },
): Promise<void> {
  const stream = await openEntry(file, entry);
  if (!stream) return;
  // Байты один в один: даты в PDF и EXIF записаны латиницей.
  const decoder = new TextDecoder('latin1');
  const reader = stream.getReader();
  let carry = '';
  let read = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = carry + decoder.decode(value);
    visit(text);
    carry = text.slice(-overlap);
    read += value.length;
    if (read >= maxBytes) {
      await reader.cancel();
      break;
    }
  }
}

/** Смещение «+03'00'», «+03:00», «Z» — в миллисекундах; без пояса — null. */
function zoneOffset(zone: string | undefined): number | null {
  if (!zone) return null;
  if (zone.startsWith('Z')) return 0;
  const match = /^([+-])(\d{2})'?:?(\d{2})?/.exec(zone);
  if (!match) return null;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return (match[1] === '-' ? -1 : 1) * minutes * 60_000;
}

/**
 * Дата из PDF: «D:20260916121217Z» в словаре документа или ISO-дата в XMP.
 * Без часового пояса не берём: неизвестно, чьё это местное время.
 */
export function pdfMadeAt(text: string): number | null {
  const found: number[] = [];

  const PDF_DATE = /\/(?:ModDate|CreationDate)\s*\(\s*D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(Z|[+-]\d{2}'?\d{2}'?)?/g;
  for (const m of text.matchAll(PDF_DATE)) {
    const offset = zoneOffset(m[7]);
    if (offset === null) continue;
    found.push(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)) - offset);
  }

  const XMP_DATE = /xmp:(?:ModifyDate|CreateDate|MetadataDate)\s*(?:=\s*"|>)\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))/g;
  for (const m of text.matchAll(XMP_DATE)) {
    const at = Date.parse(m[1]);
    if (!Number.isNaN(at)) found.push(at);
  }

  return found.length ? Math.max(...found) : null;
}

/**
 * Момент съёмки из EXIF: «2026:09:18 14:54:10» и рядом смещение «+03:00».
 * Без смещения камера пишет своё местное время — такое не берём.
 */
export function photoMadeAt(text: string): number | null {
  const offset = zoneOffset(/([+-]\d{2}:\d{2})\0/.exec(text)?.[1]);
  if (offset === null) return null;

  const found: number[] = [];
  for (const m of text.matchAll(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/g)) {
    found.push(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - offset);
  }
  return found.length ? Math.max(...found) : null;
}

/** EXIF лежит в самом начале фото. */
const PHOTO_HEAD_BYTES = 128 * 1024;
/** Запись с датой в PDF короче — на стыке кусков она не потеряется. */
const PDF_OVERLAP = 256;

/**
 * Когда сделан загруженный файл решения — если он это помнит. Из нескольких
 * дат берём позднюю: посылка не раньше последней правки файла.
 */
async function solutionMadeAt(file: Blob, entry: ZipEntry, extension: string): Promise<number | null> {
  let latest: number | null = null;
  const note = (at: number | null) => {
    if (at !== null && (latest === null || at > latest)) latest = at;
  };

  try {
    if (extension === 'pdf') {
      await scanEntry(file, entry, (text) => note(pdfMadeAt(text)), { overlap: PDF_OVERLAP });
    } else if (extension === 'jpg' || extension === 'jpeg') {
      await scanEntry(file, entry, (text) => note(photoMadeAt(text)), {
        overlap: Infinity, maxBytes: PHOTO_HEAD_BYTES,
      });
    } else if (extension === 'docx') {
      // docx — сам zip: даты создания и правки лежат в docProps/core.xml.
      const inner = new Blob([await readEntryBytes(file, entry) as BlobPart]);
      const core = (await readZipDirectory(inner)).find((e) => e.name === 'docProps/core.xml');
      if (core) {
        const xml = await readEntryText(inner, core);
        for (const m of xml.matchAll(/<dcterms:(?:created|modified)[^>]*>([^<]+)</g)) {
          const at = Date.parse(m[1]);
          note(Number.isNaN(at) ? null : at);
        }
      }
    }
  } catch {
    // Битый файл — просто без даты.
  }
  return latest;
}

/** Короткие ответы читаем целиком, у файлов решений — только дату внутри. */
const ANSWER_MAX_BYTES = 256;

/**
 * Все посылки архива: кто, по какой задаче, с каким вердиктом и под каким
 * сквозным номером. Для задач с ответом числом — и сам ответ, для файлов
 * решений — когда файл сделан, если он это помнит.
 */
export async function readContestSubmissions(file: Blob): Promise<ContestSubmission[]> {
  const submissions: ContestSubmission[] = [];

  for (const entry of await readZipDirectory(file)) {
    const [folder, fileName] = entry.name.split('/');
    const match = FOLDER_RE.exec(folder ?? '');
    if (!match || !fileName) continue;

    const parts = fileName.split('-');
    if (parts.length < 4 || !/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1])) continue;

    const last = parts[parts.length - 1];
    const extension = (/\.([a-z0-9]+)$/i.exec(last)?.[1] ?? '').toLowerCase();
    const answer = !extension && entry.size <= ANSWER_MAX_BYTES
      ? await readEntryText(file, entry)
      : null;

    submissions.push({
      who: match[1],
      participantId: match[2],
      task: Number(parts[0]),
      submissionId: Number(parts[1]),
      verdict: last.replace(/\.[a-z0-9]+$/i, ''),
      extension,
      size: entry.size,
      answer,
      madeAt: extension ? await solutionMadeAt(file, entry, extension) : null,
    });
  }

  return submissions;
}

/**
 * Когда Контест собрал архив: этим моментом проштампованы все его файлы.
 * Позже него посылок в архиве быть не может.
 */
export async function readArchiveBuiltAt(file: Blob): Promise<number | null> {
  const stamps = (await readZipDirectory(file))
    .map((entry) => entry.modified)
    .filter((at): at is number => at !== null);
  return stamps.length ? Math.max(...stamps) : null;
}

const FOLDER_RE = /^(.+)-(\d{6,})$/;

/** Похоже ли оглавление на архив посылок: папки `<подпись>-<ID>` с файлами внутри. */
export function looksLikeContestArchive(names: string[]): boolean {
  const withFiles = names.filter((name) => {
    const [folder, file] = name.split('/');
    return !!file && FOLDER_RE.test(folder ?? '');
  });
  return withFiles.length > 0 && withFiles.length >= names.filter((n) => !n.endsWith('/')).length / 2;
}

export function readContestArchive(names: string[]): ContestParticipant[] {
  const people = new Map<string, ContestParticipant>();

  for (const name of names) {
    const [folder, file] = name.split('/');
    const match = FOLDER_RE.exec(folder ?? '');
    if (!match) continue;

    const [, who, participantId] = match;
    let person = people.get(participantId);
    if (!person) {
      person = { who, participantId, submissions: 0, solved: new Set() };
      people.set(participantId, person);
    }

    if (!file) continue;
    person.submissions++;

    // `<задача>-<посылка>-<компилятор>-<вердикт>`; у загруженных решений к
    // вердикту прилипает расширение файла.
    const parts = file.split('-');
    if (parts.length < 4) continue;
    const verdict = parts[parts.length - 1].replace(/\.[a-z0-9]+$/i, '');
    if (verdict === 'OK') person.solved.add(parts[0]);
  }

  return [...people.values()].sort((a, b) => (
    b.solved.size - a.solved.size || b.submissions - a.submissions
  ));
}

/** Монитор узнаётся по своим колонкам: подпись, логин и место или балл. */
export function looksLikeContestMonitor(table: TableData): boolean {
  const headers = table.headers.map((h) => h.trim().toLowerCase());
  return headers.includes('user_name') && headers.includes('login')
    && (headers.includes('place') || headers.includes('score'));
}

/** Подпись сгодится за логин, только если она на него и похожа. */
function loginLike(who: string): string {
  return /^[a-z0-9._@-]+$/i.test(who) ? who : '';
}

export const CONTEST_HEADERS = [
  'user_name', 'Логин', 'ID в Контесте', 'Посылок', 'Задач сдано', 'Балл по монитору',
  'Проверка', 'Комментарий проверки',
];

/**
 * Архив и монитор — в одну таблицу для разбора. Архив даёт полный список
 * участников, монитор дописывает к ним логин и балл. Кого нет в архиве, но
 * есть в мониторе, тоже не теряем.
 */
export function mergeContest(
  archive: ContestParticipant[],
  monitor: TableData | null,
  reviews: Map<string, ContestReview> = new Map(),
): TableData {
  const headers = monitor?.headers.map((h) => h.trim().toLowerCase()) ?? [];
  const at = (name: string) => headers.indexOf(name);
  const nameAt = at('user_name');
  const loginAt = at('login');
  const scoreAt = at('score');

  const fromMonitor = new Map<string, { who: string; login: string; score: string }>();
  if (monitor && nameAt >= 0) {
    for (const row of monitor.rows) {
      const who = (row[nameAt] ?? '').trim();
      if (!who) continue;
      fromMonitor.set(who.toLowerCase(), {
        who,
        login: loginAt < 0 ? '' : (row[loginAt] ?? '').trim(),
        score: scoreAt < 0 ? '' : (row[scoreAt] ?? '').trim(),
      });
    }
  }

  const rows = archive.map((p) => {
    const known = fromMonitor.get(p.who.trim().toLowerCase());
    fromMonitor.delete(p.who.trim().toLowerCase());
    const review = reviews.get(p.participantId);
    return [
      p.who,
      known?.login || loginLike(p.who),
      p.participantId,
      String(p.submissions),
      String(p.solved.size),
      known?.score ?? '',
      review ? REVIEW_LEVEL_LABELS[review.level] : '',
      review?.comment ?? '',
    ];
  });

  // В мониторе есть, в архиве нет — редкость, но выкидывать человека незачем.
  for (const rest of fromMonitor.values()) {
    rows.push([rest.who, rest.login || loginLike(rest.who), '', '', '', rest.score, '', '']);
  }

  return { headers: [...CONTEST_HEADERS], rows };
}
