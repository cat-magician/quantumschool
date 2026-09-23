import type { TableData } from './tableImport';

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
 * чем с одной и той же неверной минутой у всех.
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

/**
 * Имена файлов из оглавления zip. Оглавление лежит в конце архива, поэтому
 * читаем только хвост: архив посылок весит под сотню мегабайт, а нужны из
 * него несколько килобайт.
 */
export async function readZipNames(file: Blob): Promise<string[]> {
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
  const names: string[] = [];
  let pointer = 0;

  for (let i = 0; i < count; i++) {
    if (pointer + 46 > directory.byteLength) break;
    if (directory.getUint32(pointer, true) !== CENTRAL_SIGNATURE) break;
    const flags = directory.getUint16(pointer + 8, true);
    const nameLength = directory.getUint16(pointer + 28, true);
    const extraLength = directory.getUint16(pointer + 30, true);
    const commentLength = directory.getUint16(pointer + 32, true);
    const raw = new Uint8Array(directory.buffer, directory.byteOffset + pointer + 46, nameLength);

    names.push((flags & UTF8_FLAG ? utf8 : dos).decode(raw));
    pointer += 46 + nameLength + extraLength + commentLength;
  }

  return names;
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
];

/**
 * Архив и монитор — в одну таблицу для разбора. Архив даёт полный список
 * участников, монитор дописывает к ним логин и балл. Кого нет в архиве, но
 * есть в мониторе, тоже не теряем.
 */
export function mergeContest(
  archive: ContestParticipant[],
  monitor: TableData | null,
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
    return [
      p.who,
      known?.login || loginLike(p.who),
      p.participantId,
      String(p.submissions),
      String(p.solved.size),
      known?.score ?? '',
    ];
  });

  // В мониторе есть, в архиве нет — редкость, но выкидывать человека незачем.
  for (const rest of fromMonitor.values()) {
    rows.push([rest.who, rest.login || loginLike(rest.who), '', '', '', rest.score]);
  }

  return { headers: [...CONTEST_HEADERS], rows };
}
