/**
 * Структурная проверка supabase/schema.sql перед прогоном в SQL Editor.
 *
 * Полноценно разобрать SQL без Postgres нельзя, но самые дорогие поломки —
 * те, что ломают файл целиком, и их видно статически. Ошибка в этом файле
 * стоит дорого: его запускают руками по боевой базе и узнают о проблеме
 * посреди выполнения, когда часть команд уже применилась.
 *
 * Запуск: node scripts/check-schema-sql.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(import.meta.dirname, '..', 'supabase', 'schema.sql');
const text = fs.readFileSync(file, 'utf8');
const lines = text.split(/\r?\n/);

const problems = [];
const add = (line, message) => problems.push({ line, message });

// ── Долларовое цитирование ────────────────────────────────────
// Тело функции открывается $$ или $tag$ и закрывается тем же. Один $
// вместо двух — типичный след автозамены: в String.replace `$$` означает
// экранированный доллар, и пара молча схлопывается в один символ.
const DOLLAR = /\$([A-Za-z_][A-Za-z0-9_]*)?\$/g;
let openTag = null;
let openLine = 0;

lines.forEach((raw, index) => {
  const lineNo = index + 1;
  const withoutComment = raw.replace(/--.*$/, '');

  // Одинокий доллар там, где ждём разделитель тела.
  const trimmed = raw.trim();
  if (/^AS \$$/.test(trimmed) || /^\$;?$/.test(trimmed)) {
    add(lineNo, `одиночный $ вместо $$ — «${trimmed}»`);
  }

  DOLLAR.lastIndex = 0;
  let match;
  while ((match = DOLLAR.exec(withoutComment))) {
    const tag = match[1] ?? '';
    if (openTag === null) {
      openTag = tag;
      openLine = lineNo;
    } else if (openTag === tag) {
      openTag = null;
    }
  }
});

if (openTag !== null) {
  add(openLine, `не закрыто тело функции, открытое здесь ($${openTag}$)`);
}

// ── Заголовки функций ─────────────────────────────────────────
// CREATE FUNCTION без тела — тоже след неудачной правки.
lines.forEach((raw, index) => {
  if (!/^CREATE (OR REPLACE )?FUNCTION/i.test(raw.trim())) return;
  const tail = lines.slice(index, index + 25).join('\n');
  if (!/\bAS\s+\$/.test(tail)) {
    add(index + 1, 'у функции не найдено тело (AS $$…) в пределах 25 строк');
  }
});

// ── Следы автозамены ──────────────────────────────────────────
// $1, $& и $` в SQL этого файла не используются: если появились —
// это подстановка из String.replace, а не то, что хотел автор.
lines.forEach((raw, index) => {
  const withoutComment = raw.replace(/--.*$/, '');
  const stray = withoutComment.match(/\$[&`']|\$\d/g);
  if (stray) add(index + 1, `похоже на артефакт автозамены: ${stray.join(', ')}`);
});

if (problems.length === 0) {
  const functions = (text.match(/^CREATE (OR REPLACE )?FUNCTION/gim) ?? []).length;
  const tables = (text.match(/^CREATE TABLE/gim) ?? []).length;
  console.log(`ок: ${lines.length} строк, ${functions} функций, ${tables} таблиц`);
  process.exit(0);
}

console.error(`Проблем: ${problems.length}`);
for (const { line, message } of problems.sort((a, b) => a.line - b.line)) {
  console.error(`  schema.sql:${line} — ${message}`);
}
process.exit(1);
