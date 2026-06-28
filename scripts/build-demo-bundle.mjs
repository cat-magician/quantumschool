/**
 * Собирает supabase/demo/apply.sql из фрагментов demo/*.sql
 *
 * Usage: node scripts/build-demo-bundle.mjs
 */

import { readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const demoDir = resolve(__dirname, '..', 'supabase/demo');
const out = resolve(demoDir, 'apply.sql');

const chunks = [
  '_helpers.sql',
  '00_staff_users.sql',
  '01_users_and_core.sql',
  '02_lesson_pages.sql',
  '03_homework_pages.sql',
  '_helpers_cleanup.sql',
];

const header = `/*
  ДЕМО-ДАННЫЕ — опционально, после supabase/schema.sql

  Включить:  запустить этот файл целиком
  Выключить: demo/remove.sql
  Сбросить:  demo/reset.sql (remove + apply)

  Домен @test.qc.ru зарезервирован под демо. Реальные пользователи — другие email.

  Сгенерировано: node scripts/build-demo-bundle.mjs
*/

`;

async function main() {
  const parts = [header];
  for (const file of chunks) {
    const body = await readFile(resolve(demoDir, file), 'utf8');
    parts.push(`\n-- ── ${file} ──\n\n`);
    parts.push(body.trim());
    parts.push('\n');
  }
  await writeFile(out, parts.join('').trimEnd() + '\n', 'utf8');
  console.log(`Wrote ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
