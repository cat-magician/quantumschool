/**
 * Собирает supabase/schema.sql из migrations/*.sql (без демо-данных).
 *
 * Usage: node scripts/build-schema.mjs
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const migrationsDir = resolve(root, 'supabase/migrations');
const outSchema = resolve(root, 'supabase/schema.sql');

const header = `/*
  СХЕМА САЙТА «Квантовый кружок» — без демо-данных.

  Запускайте ВСЕГДА при деплое / обновлении БД (Supabase SQL Editor, Bolt и т.д.).
  Идемпотентно: повторный запуск безопасен.

  Демо-данные (опционально): supabase/demo/apply.sql
  Удалить демо:              supabase/demo/remove.sql
  Сбросить демо:             supabase/demo/reset.sql

  Сгенерировано: node scripts/build-schema.mjs
  Источник: supabase/migrations/ (все .sql по порядку)
*/

`;

/** Перед каждым CREATE POLICY — DROP IF EXISTS (повторный прогон schema.sql). */
function makePoliciesIdempotent(sql) {
  return sql.replace(
    /CREATE POLICY "([^"]+)"\s+ON\s+(\S+)/g,
    'DROP POLICY IF EXISTS "$1" ON $2;\nCREATE POLICY "$1" ON $2',
  );
}

async function main() {
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const parts = [header];
  for (const file of files) {
    const body = await readFile(resolve(migrationsDir, file), 'utf8');
    parts.push(`\n-- ══════════════════════════════════════════════════════════════\n-- ${file}\n-- ══════════════════════════════════════════════════════════════\n\n`);
    parts.push(body.trim());
    parts.push('\n');
  }

  const schema = makePoliciesIdempotent(parts.join('').trimEnd() + '\n');
  await writeFile(outSchema, schema, 'utf8');

  console.log(`Wrote ${outSchema} (${files.length} migrations)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
