/**
 * Архив всех посылок Контеста → выгрузка для «Разбора файла».
 *
 * Монитор показывает не всех: у кого ноль баллов, тот в него может и не
 * попасть, а посылки он всё-таки слал. В архиве же лежит папка на каждого
 * участника — `<подпись>-<ID участника>`, внутри файлы вида
 * `<задача>-<посылка>-<компилятор>-<вердикт>`. Отсюда и собираем список: кто
 * реально отправлял, сколько раз и что у него зачлось.
 *
 * Время отправки Контест в архив не кладёт (все файлы проштампованы моментом
 * выгрузки), поэтому колонки времени в выгрузке нет — сопоставление идёт по
 * логину и ФИО.
 *
 *   node scripts/contest-archive-to-csv.mjs [путь-к-архиву.zip]
 *
 * Без аргумента берёт самый свежий contest*.zip из data.local. Результат
 * кладёт рядом, в data.local — сам архив никуда не уходит.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const dataDir = path.join(root, 'data.local');

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
/** Флаг «имена в UTF-8»; без него Контест пишет их в cp866. */
const UTF8_FLAG = 0x800;

function findEocd(view) {
  const maxScan = Math.min(view.byteLength, 0xffff + 22);
  for (let i = 22; i <= maxScan; i++) {
    const at = view.byteLength - i;
    if (at < 0) break;
    if (view.getUint32(at, true) === EOCD_SIGNATURE) return at;
  }
  return -1;
}

/** Только имена из центрального каталога: распаковывать ничего не нужно. */
function listNames(buffer) {
  const view = new DataView(buffer);
  const eocd = findEocd(view);
  if (eocd < 0) throw new Error('Не похоже на zip: не найден конец архива');

  const count = view.getUint16(eocd + 10, true);
  let pointer = view.getUint32(eocd + 16, true);
  const utf8 = new TextDecoder('utf-8');
  const dos = new TextDecoder('cp866');
  const names = [];

  for (let i = 0; i < count; i++) {
    if (view.getUint32(pointer, true) !== CENTRAL_SIGNATURE) break;
    const flags = view.getUint16(pointer + 8, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const raw = new Uint8Array(buffer, pointer + 46, nameLength);

    names.push((flags & UTF8_FLAG ? utf8 : dos).decode(raw));
    pointer += 46 + nameLength + extraLength + commentLength;
  }

  return names;
}

const FOLDER_RE = /^(.+)-(\d{6,})$/;

export function readArchive(names) {
  const people = new Map();

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

const SEPARATOR = ';';
const BOM = String.fromCharCode(0xfeff);

function escapeCell(value) {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Мини-разбор монитора: нужны только две колонки, но кавычки в нём есть. */
function parseCsv(text) {
  const clean = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  const separator = (clean.split(/\r?\n/, 1)[0] ?? '').includes(';') ? ';' : ',';
  const rows = [];
  let row = [];
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
  if (cell || row.length) { row.push(cell); rows.push(row); }

  const [headers = [], ...body] = rows;
  return { headers, rows: body.filter((r) => r.some((v) => v.trim())) };
}

/**
 * Монитор знает то, чего нет в архиве: яндекс-логин и итоговый балл. А архив
 * знает тех, кого монитор не показывает. Склейка идёт по подписи участника —
 * это одно и то же поле, `user_name` монитора и имя папки в архиве.
 */
function readMonitor(file) {
  const { headers, rows } = parseCsv(fs.readFileSync(file, 'utf8'));
  const index = (name) => headers.findIndex((h) => h.trim().toLowerCase() === name);
  const nameAt = index('user_name');
  const loginAt = index('login');
  const scoreAt = index('score');
  if (nameAt < 0) return new Map();

  return new Map(rows.map((row) => [
    (row[nameAt] ?? '').trim().toLowerCase(),
    {
      login: loginAt < 0 ? '' : (row[loginAt] ?? '').trim(),
      score: scoreAt < 0 ? '' : (row[scoreAt] ?? '').trim(),
    },
  ]));
}

/** Подпись сгодится за логин, только если она на него и похожа. */
function loginLike(who) {
  return /^[a-z0-9._@-]+$/i.test(who) ? who : '';
}

export function buildCsv(people, monitor = new Map()) {
  const header = [
    'user_name', 'Логин', 'ID в Контесте', 'Посылок', 'Задач сдано', 'Балл по монитору',
  ];

  const rows = people.map((p) => {
    const fromMonitor = monitor.get(p.who.trim().toLowerCase());
    return [
      p.who,
      fromMonitor?.login || loginLike(p.who),
      p.participantId,
      String(p.submissions),
      String(p.solved.size),
      fromMonitor?.score ?? '',
    ];
  });

  return [header, ...rows]
    .map((cells) => cells.map(escapeCell).join(SEPARATOR))
    .join('\r\n') + '\r\n';
}

// Проверки импортируют отсюда разбор имён и сборку CSV, и лезть в data.local
// при этом незачем: работаем, только когда скрипт запущен напрямую.
const runDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (runDirectly) run();

function run() {
const explicit = process.argv[2];
const archive = explicit ?? fs.readdirSync(dataDir)
  .filter((name) => /^contest.*\.zip$/i.test(name))
  .map((name) => ({ name, at: fs.statSync(path.join(dataDir, name)).mtimeMs }))
  .sort((a, b) => b.at - a.at)
  .map(({ name }) => path.join(dataDir, name))[0];

if (!archive) {
  console.error('Не нашёл архив: положите contest-….zip в data.local');
  process.exit(1);
}

const buffer = fs.readFileSync(archive);
const people = readArchive(listNames(buffer.buffer.slice(
  buffer.byteOffset, buffer.byteOffset + buffer.byteLength,
)));

// Монитор рядом — берём из него логины и баллы; нет так нет.
const monitorFile = fs.readdirSync(dataDir)
  .filter((name) => /^monitor.*\.csv$/i.test(name))
  .map((name) => path.join(dataDir, name))[0];
const monitor = monitorFile ? readMonitor(monitorFile) : new Map();

const out = path.join(dataDir, `${path.basename(archive, '.zip')}-uchastniki.csv`);
fs.writeFileSync(out, BOM + buildCsv(people, monitor), 'utf8');

const matched = people.filter((p) => monitor.has(p.who.trim().toLowerCase())).length;
console.log(`архив: ${path.basename(archive)}`);
console.log(`участников: ${people.length}, посылок: ${people.reduce((n, p) => n + p.submissions, 0)}`);
console.log(`хоть одну задачу сдали: ${people.filter((p) => p.solved.size > 0).length}`);
console.log(monitorFile
  ? `монитор (${path.basename(monitorFile)}): подтянул логин и балл для ${matched}, вне монитора ${people.length - matched}`
  : 'монитора рядом нет — логин взят из подписи, где она на него похожа');
const withLogin = people.filter((p) => (
  monitor.get(p.who.trim().toLowerCase())?.login || loginLike(p.who)
)).length;
console.log(`с логином для сопоставления: ${withLogin}, только с подписью: ${people.length - withLogin}`);
console.log(`готово: ${path.relative(root, out)}`);
}
