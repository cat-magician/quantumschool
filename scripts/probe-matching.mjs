/**
 * Прогон разбора выгрузок Яндекс.Форм на реальных файлах из data.local.
 *
 * Не тест, а замер: показывает, что вытащили парсеры, как размечены колонки
 * и сколько ответов эссе ложится на анкету по ФИО. Запуск:
 *   node scripts/probe-matching.mjs
 */

import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const dataDir = path.join(root, 'data.local');

if (!fs.existsSync(dataDir)) {
  console.error('Нет папки data.local — положите туда выгрузки форм (она под .gitignore).');
  process.exit(1);
}

const bundlePath = path.join(os.tmpdir(), `matching-probe-${Date.now()}.mjs`);

await build({
  stdin: {
    contents: `
      export * from '../src/lib/identityMatching';
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

async function readTable(fileName) {
  const buffer = fs.readFileSync(path.join(dataDir, fileName));
  if (/\.csv$/i.test(fileName)) return lib.parseCsv(buffer.toString('utf8'));
  const view = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return lib.parseXlsx(view);
}

function describeMapping(table, mapping) {
  return Object.entries(mapping)
    .map(([key, index]) => `${key}: ${index === null ? '—' : `«${table.headers[index]}»`}`)
    .join('\n    ');
}

async function report(fileName, kind) {
  console.log(`\n=== ${fileName} (${kind}) ===`);
  const table = await readTable(fileName);
  console.log(`строк: ${table.rows.length}, колонок: ${table.headers.length}`);
  console.log(`заголовки: ${table.headers.map((h) => h || '∅').join(' | ')}`);

  const mapping = lib.autoDetectColumns(table.headers);
  console.log(`  разметка:\n    ${describeMapping(table, mapping)}`);

  const entries = lib.buildFormEntries(table, mapping, 0);
  const active = entries.filter((e) => !e.supersededBy);
  console.log(`  распознано: ${entries.length}, после дедупликации: ${active.length}`);
  console.log(`  с именем: ${active.filter((e) => e.name).length}`);
  console.log(`  с почтой: ${active.filter((e) => e.email).length}`
    + `, из них с опечаткой: ${active.filter((e) => e.email && !e.emailValid).length}`);
  console.log(`  со временем: ${active.filter((e) => e.submittedAt !== null).length}`);
  const withTime = active.filter((e) => e.submittedAt !== null);
  if (withTime.length) {
    const stamps = withTime.map((e) => e.submittedAt);
    console.log(`  окно времени: ${new Date(Math.min(...stamps)).toISOString()}`
      + ` … ${new Date(Math.max(...stamps)).toISOString()}`);
  }

  return { table, mapping, entries, active };
}

const files = fs.readdirSync(dataDir).filter((f) => /\.(xlsx|csv)$/i.test(f));
console.log('файлы в data.local:', files);

const questionnaireFile = files.find((f) => /участник/i.test(f));
const essayFile = files.find((f) => /письмо/i.test(f));
const monitorFile = files.find((f) => /monitor/i.test(f));

const questionnaire = questionnaireFile ? await report(questionnaireFile, 'анкета') : null;
const essay = essayFile ? await report(essayFile, 'эссе') : null;
if (monitorFile) await report(monitorFile, 'контест');

// Анкета вместо базы: проверяем, что скоринг вообще сводит эссе с людьми.
if (questionnaire && essay) {
  console.log('\n=== эссе × анкета (анкета играет роль аккаунтов) ===');
  const profiles = questionnaire.active.map((entry) => ({
    id: `q${entry.rowNumber}`,
    display_name: entry.name,
    email: entry.email,
    login: null,
    yandex_login: null,
    recovery_email: null,
    contact_email: null,
    city: entry.city,
    school: entry.school,
    grade: entry.grade,
    stage1_submitted_at: null,
    stage2_submitted_at: null,
    questionnaire_submitted_at: null,
  }));

  const rows = lib.matchFormEntries(essay.active, profiles, 'essay');
  const summary = lib.summarizeMatches(essay.entries, rows, profiles, {});
  console.log(summary);

  const bySignal = new Map();
  for (const row of rows) {
    const key = row.best ? row.best.signals.join('+') : 'нет кандидата';
    bySignal.set(key, (bySignal.get(key) ?? 0) + 1);
  }
  console.log('сигналы у лучшего кандидата:');
  for (const [key, count] of [...bySignal].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count} × ${key}`);
  }

  const noName = rows.filter((r) => !r.entry.name).length;
  console.log(`строк эссе без имени вообще: ${noName}`);
}

fs.rmSync(bundlePath, { force: true });
