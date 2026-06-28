/**
 * Print homework text block bodies from Supabase (for debugging markdown/LaTeX).
 * Usage: node scripts/check-homework-body.mjs
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
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, anonKey);

const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
  email: 'student08@test.qc.ru',
  password: 'demo123',
});

if (signInErr) {
  console.error('login error:', signInErr.message);
  process.exit(1);
}
console.log('Logged in as student08@test.qc.ru');

const { data: pages, error: pagesErr } = await supabase
  .from('homework_pages')
  .select('id, title, is_published')
  .order('title');

if (pagesErr) {
  console.error('pages error:', pagesErr.message);
  process.exit(1);
}

console.log('Pages count:', pages?.length ?? 0);
console.log('Pages:', pages?.map((p) => `${p.title} (${p.is_published ? 'pub' : 'draft'})`).join(', '));

for (const page of pages ?? []) {
  const { data: blocks, error } = await supabase
    .from('homework_page_blocks')
    .select('id, block_type, sort_order, content')
    .eq('page_id', page.id)
    .eq('block_type', 'text')
    .order('sort_order');

  if (error) {
    console.error(page.title, error.message);
    continue;
  }

  for (const b of blocks ?? []) {
    const body = b.content?.body ?? '';
    console.log('\n===', page.title, '===');
    console.log('length:', body.length);
    console.log('has real newlines:', /[\r\n]/.test(body));
    console.log('has literal backslash-n:', body.includes('\\n'));
    console.log('JSON:', JSON.stringify(body.slice(0, 200)));
    console.log('VISIBLE:');
    console.log(body);
  }
}
