/**
 * Чтение выгрузок Яндекс.Форм и Контеста прямо в браузере: xlsx и csv.
 *
 * Библиотеку не тянем — xlsx это zip с XML, а распаковать deflate умеет сам
 * браузер через DecompressionStream. Файл никуда не отправляется.
 */

export type TableData = {
  headers: string[];
  rows: string[][];
};

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_SIGNATURE = 0x04034b50;

type ZipEntry = {
  name: string;
  method: number;
  offset: number;
  compressedSize: number;
};

function findEndOfCentralDirectory(view: DataView): number {
  // Комментарий архива может быть до 64 КБ — ищем сигнатуру с конца.
  const maxScan = Math.min(view.byteLength, 0xffff + 22);
  for (let i = 22; i <= maxScan; i++) {
    const at = view.byteLength - i;
    if (at < 0) break;
    if (view.getUint32(at, true) === ZIP_EOCD_SIGNATURE) return at;
  }
  return -1;
}

function readCentralDirectory(buffer: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buffer);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd < 0) throw new Error('Файл не похож на xlsx: не найден конец zip-архива');

  const count = view.getUint16(eocd + 10, true);
  let pointer = view.getUint32(eocd + 16, true);
  if (pointer === 0xffffffff) {
    throw new Error('Архив в формате ZIP64 — пересохраните файл или выгрузите в CSV');
  }

  const decoder = new TextDecoder('utf-8');
  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i++) {
    if (view.getUint32(pointer, true) !== ZIP_CENTRAL_SIGNATURE) break;
    const method = view.getUint16(pointer + 10, true);
    const compressedSize = view.getUint32(pointer + 20, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const offset = view.getUint32(pointer + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, pointer + 46, nameLength));

    entries.push({ name, method, offset, compressedSize });
    pointer += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

async function readZipEntry(buffer: ArrayBuffer, entry: ZipEntry): Promise<string> {
  const view = new DataView(buffer);
  if (view.getUint32(entry.offset, true) !== ZIP_LOCAL_SIGNATURE) {
    throw new Error(`Повреждённая запись архива: ${entry.name}`);
  }
  const nameLength = view.getUint16(entry.offset + 26, true);
  const extraLength = view.getUint16(entry.offset + 28, true);
  const start = entry.offset + 30 + nameLength + extraLength;
  const raw = new Uint8Array(buffer, start, entry.compressedSize);

  const bytes = entry.method === 0 ? raw : await inflateRaw(raw);
  return new TextDecoder('utf-8').decode(bytes);
}

// Яндекс пишет теги с namespace-префиксом (<s:row>), поэтому он необязателен.
const NS = '(?:\\w+:)?';
const RE_SHARED_ITEM = new RegExp(`<${NS}si>([\\s\\S]*?)</${NS}si>`, 'g');
const RE_TEXT = new RegExp(`<${NS}t[^>]*>([\\s\\S]*?)</${NS}t>`, 'g');
const RE_ROW = new RegExp(`<${NS}row[^>]*>([\\s\\S]*?)</${NS}row>`, 'g');
const RE_CELL = new RegExp(
  `<${NS}c r="([A-Z]+\\d+)"([^>]*?)>([\\s\\S]*?)</${NS}c>|<${NS}c r="([A-Z]+\\d+)"([^>]*?)/>`,
  'g',
);
const RE_VALUE = new RegExp(`<${NS}v>([\\s\\S]*?)</${NS}v>`);

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Excel хранит даты числом дней от 1899-12-30. */
function excelSerialToIso(serial: number): string {
  return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString();
}

function looksLikeExcelDate(value: string): boolean {
  const n = Number(value);
  // Диапазон примерно 2000..2100 годы: раньше это точно не дата ответа.
  return Number.isFinite(n) && n > 36000 && n < 80000 && /^\d{5}(\.\d+)?$/.test(value);
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  RE_SHARED_ITEM.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = RE_SHARED_ITEM.exec(xml))) {
    out.push(decodeXml([...match[1].matchAll(RE_TEXT)].map((m) => m[1]).join('')));
  }
  return out;
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  RE_ROW.lastIndex = 0;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = RE_ROW.exec(xml))) {
    const cells: string[] = [];
    RE_CELL.lastIndex = 0;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = RE_CELL.exec(rowMatch[1]))) {
      const ref = cellMatch[1] ?? cellMatch[4];
      const attrs = cellMatch[2] ?? cellMatch[5] ?? '';
      const body = cellMatch[3] ?? '';
      const type = /t="([^"]+)"/.exec(attrs)?.[1];

      let value: string;
      if (type === 's') {
        value = shared[Number(RE_VALUE.exec(body)?.[1])] ?? '';
      } else if (type === 'inlineStr') {
        value = decodeXml([...body.matchAll(RE_TEXT)].map((m) => m[1]).join(''));
      } else {
        const raw = RE_VALUE.exec(body)?.[1];
        value = raw === undefined ? '' : decodeXml(raw);
        if (value && looksLikeExcelDate(value)) value = excelSerialToIso(Number(value));
      }

      const index = columnIndex(ref);
      while (cells.length < index) cells.push('');
      cells[index] = value;
    }

    rows.push(cells);
  }

  return rows;
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<TableData> {
  const entries = readCentralDirectory(buffer);
  const sheet = entries.find((e) => /^xl\/worksheets\/sheet1\.xml$/i.test(e.name))
    ?? entries.find((e) => /^xl\/worksheets\/.*\.xml$/i.test(e.name));
  if (!sheet) throw new Error('В файле нет листа с данными');

  const sharedEntry = entries.find((e) => /^xl\/sharedStrings\.xml$/i.test(e.name));
  const shared = sharedEntry ? parseSharedStrings(await readZipEntry(buffer, sharedEntry)) : [];
  const rows = parseSheet(await readZipEntry(buffer, sheet), shared);

  return toTable(rows);
}

/** Разделитель определяем по первой строке: Яндекс отдаёт и `,` и `;`. */
function detectSeparator(line: string): string {
  const counts = [',', ';', '\t'].map((sep) => ({
    sep,
    count: (line.match(new RegExp(`\\${sep}`, 'g')) ?? []).length,
  }));
  return counts.sort((a, b) => b.count - a.count)[0]!.count > 0
    ? counts.sort((a, b) => b.count - a.count)[0]!.sep
    : ',';
}

export function parseCsv(text: string): TableData {
  // BOM пишет и Excel, и сам Яндекс — иначе он уезжает в первый заголовок.
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const separator = detectSeparator(firstLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === separator) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }

  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return toTable(rows);
}

function toTable(rows: string[][]): TableData {
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = (nonEmpty[0] ?? []).map((h) => h.trim());
  const width = Math.max(headers.length, ...nonEmpty.map((r) => r.length));
  while (headers.length < width) headers.push('');

  const body = nonEmpty.slice(1).map((r) => {
    const padded = [...r];
    while (padded.length < width) padded.push('');
    return padded.map((c) => c.trim());
  });

  return { headers, rows: body };
}

export async function readTableFile(file: File): Promise<TableData> {
  if (/\.csv$/i.test(file.name)) return parseCsv(await file.text());
  if (/\.xlsx$/i.test(file.name)) return parseXlsx(await file.arrayBuffer());
  throw new Error('Поддерживаются только .xlsx и .csv');
}
