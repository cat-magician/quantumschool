/**
 * Repair homework text blocks in Supabase (literal \n, LaTeX, paragraph merge).
 * Usage: node scripts/repair-homework-blocks.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || (!serviceKey && !anonKey)) {
  console.error('Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const { normalizeHomeworkMarkdown } = await import('../src/lib/homeworkPageUtils.ts');

const supabase = createClient(url, serviceKey || anonKey);

if (!serviceKey) {
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: 'admin@test.qc.ru',
    password: 'admin123',
  });
  if (signInErr) {
    console.error('admin login error:', signInErr.message);
    process.exit(1);
  }
  console.log('Logged in as admin@test.qc.ru');
}

const { data: blocks, error } = await supabase
  .from('homework_page_blocks')
  .select('id, page_id, block_type, content, homework_pages(title)')
  .eq('block_type', 'text');

if (error) {
  console.error(error.message);
  process.exit(1);
}

let updated = 0;

for (const block of blocks ?? []) {
  const raw = block.content?.body;
  if (typeof raw !== 'string' || !raw.trim()) continue;

  const fixed = normalizeHomeworkMarkdown(raw);
  if (fixed === raw) {
    console.log('OK:', block.homework_pages?.title ?? block.page_id);
    continue;
  }

  const { error: upErr } = await supabase
    .from('homework_page_blocks')
    .update({ content: { ...block.content, body: fixed } })
    .eq('id', block.id);

  if (upErr) {
    console.error('FAIL:', block.homework_pages?.title, upErr.message);
  } else {
    updated += 1;
    console.log('FIXED:', block.homework_pages?.title);
    console.log('  was:', JSON.stringify(raw.slice(0, 80)));
    console.log('  now:', JSON.stringify(fixed.slice(0, 80)));
  }
}

console.log('\nUpdated blocks:', updated);
