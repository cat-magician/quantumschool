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
  // Настоящий замер: выгрузка с сайта («Отборочные этапы» → Скачать CSV) даёт
  // реальные отметки stage1_submitted_at. Без неё ниже идёт суррогат на анкете,
  // где этих отметок нет вовсе и время не может сработать в принципе.
  const siteExport = fs.readdirSync(dataDir).find((f) => /^otbor.*\.csv$/i.test(f));

  if (siteExport) {
    console.log(`\n=== эссе × аккаунты сайта (${siteExport}) ===`);
    const table = lib.parseCsv(fs.readFileSync(path.join(dataDir, siteExport), 'utf8'));
    const col = (name) => table.headers.findIndex((h) => h.trim() === name);

    const idx = {
      name: col('Имя'), contact: col('Почта для связи'), email: col('Почта (Яндекс)'),
      login: col('Логин'), yandex: col('Логин Яндекса'), recovery: col('Почта для восстановления'),
      city: col('Город'), school: col('Школа'), grade: col('Класс'),
      questionnaire: col('Анкета отправлена'), essay: col('Эссе отправлено'),
      contest: col('Задачи отправлены'), id: col('ID аккаунта'),
    };

    if (idx.essay < 0 || idx.id < 0) {
      console.log('  Не похоже на нашу выгрузку — пропускаю.');
    } else {
      // Выгрузка пишет «дд.мм.гггг, чч:мм» — секунды в ней потеряны, поэтому
      // восстановленное время гуляет в пределах минуты.
      const parseStamp = (value) => {
        const m = /^(\d{2})\.(\d{2})\.(\d{4}),?\s+(\d{2}):(\d{2})/.exec((value ?? '').trim());
        if (!m) return null;
        return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).toISOString();
      };
      const at = (row, i) => (i >= 0 ? (row[i] ?? '').trim() : '');

      const siteProfiles = table.rows.map((row) => ({
        id: at(row, idx.id) || `row${row.join('').length}`,
        display_name: at(row, idx.name),
        email: at(row, idx.email),
        login: at(row, idx.login) || null,
        yandex_login: at(row, idx.yandex) || null,
        recovery_email: at(row, idx.recovery) || null,
        contact_email: at(row, idx.contact) || null,
        city: at(row, idx.city),
        school: at(row, idx.school),
        grade: at(row, idx.grade),
        questionnaire_submitted_at: parseStamp(at(row, idx.questionnaire)),
        stage1_submitted_at: parseStamp(at(row, idx.essay)),
        stage2_submitted_at: parseStamp(at(row, idx.contest)),
      }));

      const withEssayMark = siteProfiles.filter((x) => x.stage1_submitted_at).length;
      console.log(`  аккаунтов: ${siteProfiles.length}, из них с отметкой об эссе: ${withEssayMark}`);

      const realRows = lib.matchFormEntries(essay.active, siteProfiles, 'essay');
      console.log(lib.summarizeMatches(essay.entries, realRows, siteProfiles, {}));

      const bySig = new Map();
      for (const r of realRows) {
        const key = r.best ? r.best.signals.join('+') : 'нет кандидата';
        bySig.set(key, (bySig.get(key) ?? 0) + 1);
      }
      console.log('  сигналы у лучшего кандидата:');
      for (const [k, c] of [...bySig].sort((a, b) => b[1] - a[1])) console.log(`    ${c} × ${k}`);

      const noName = realRows.filter((r) => !r.entry.name);
      const rescued = noName.filter((r) => r.best).length;
      console.log(`  безымянных строк: ${noName.length}, из них подхвачено по времени: ${rescued}`);
    }
  } else {
    console.log('\n(нет otbor-*.csv в data.local — настоящий замер по времени невозможен)');
  }

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
