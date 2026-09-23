/**
 * Архив посылок Контеста + монитор → одна таблица для «Разбора выгрузок».
 *
 * Сайт делает это сам: достаточно закинуть zip-архив посылок и монитор в
 * поле загрузки. Скрипт нужен, только если таблицу хочется получить файлом —
 * посмотреть глазами или отдать кому-то. Логика общая с сайтом:
 * src/lib/contestArchive.ts.
 *
 *   node scripts/contest-archive-to-csv.mjs [архив.zip] [монитор.csv]
 *
 * Без аргументов берёт самый свежий contest*.zip и monitor*.csv из data.local
 * и кладёт результат туда же.
 */

import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const dataDir = path.join(root, 'data.local');
const bundlePath = path.join(os.tmpdir(), `contest-archive-${Date.now()}.mjs`);

await build({
  stdin: {
    contents: `
      export * from '../src/lib/contestArchive';
      export * from '../src/lib/contestReview';
      export * from '../src/lib/tableImport';
    `,
    resolveDir: path.join(root, 'scripts'),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundlePath,
  logLevel: 'warning',
});
const lib = await import(pathToFileURL(bundlePath).href);
fs.rmSync(bundlePath, { force: true });

function latest(pattern) {
  if (!fs.existsSync(dataDir)) return null;
  return fs.readdirSync(dataDir)
    .filter((name) => pattern.test(name))
    .map((name) => path.join(dataDir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] ?? null;
}

const archivePath = process.argv[2] ?? latest(/^contest.*\.zip$/i);
const monitorPath = process.argv[3] ?? latest(/^monitor.*\.csv$/i);

if (!archivePath) {
  console.error('Не нашёл архив: положите contest-….zip в data.local или передайте путь');
  process.exit(1);
}

const asFile = (file) => new File([fs.readFileSync(file)], path.basename(file));

const names = await lib.readZipNames(asFile(archivePath));
if (!lib.looksLikeContestArchive(names)) {
  console.error(`${path.basename(archivePath)} — не архив посылок Контеста`);
  process.exit(1);
}

const people = lib.readContestArchive(names);
const monitor = monitorPath ? await lib.readTableFile(asFile(monitorPath)) : null;
// Та же проверка честности, что на сайте: предположение с доводами.
const reviews = lib.reviewContest(await lib.readContestSubmissions(asFile(archivePath)));
const table = lib.mergeContest(people, monitor, reviews);

const escapeCell = (value) => (/[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const csv = [table.headers, ...table.rows]
  .map((cells) => cells.map(escapeCell).join(';'))
  .join('\r\n') + '\r\n';

const out = path.join(dataDir, `${path.basename(archivePath, '.zip')}-uchastniki.csv`);
fs.writeFileSync(out, String.fromCharCode(0xfeff) + csv, 'utf8');

console.log(`архив: ${path.basename(archivePath)}, участников: ${people.length}`);
console.log(monitor ? `монитор: ${path.basename(monitorPath)}` : 'монитора нет — логины только у тех, кто ими подписан');
console.log(`с логином: ${table.rows.filter((r) => r[1]).length} из ${table.rows.length}`);
const doubtful = [...reviews.values()].filter((r) => r.level !== 'clean');
console.log(`проверка честности: вопросы или подозрения у ${doubtful.length} из ${reviews.size}`);
for (const r of doubtful) console.log(`  [${lib.REVIEW_LEVEL_LABELS[r.level]}] ${r.who}`);
console.log(`готово: ${path.relative(root, out)}`);
