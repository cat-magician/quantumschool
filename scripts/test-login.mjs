/**
 * Diagnose Supabase login for test accounts.
 * Usage: node scripts/test-login.mjs
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

const accounts = [
  ['superadmin@test.qc.ru', 'superadmin123'],
  ['admin@test.qc.ru', 'admin123'],
  ['student@test.qc.ru', 'student123'],
];

console.log('Supabase URL:', url);
console.log('');

for (const [email, password] of accounts) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.log(`FAIL ${email}`);
    console.log('  message:', error.message);
    console.log('  status:', error.status);
    console.log('  code:', error.code);
  } else {
    console.log(`OK   ${email}`);
    console.log('  user id:', data.user?.id);
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, display_name')
      .eq('id', data.user.id)
      .maybeSingle();
    if (profileError) {
      console.log('  profile error:', profileError.message);
    } else if (profile) {
      console.log('  profile:', profile.role, profile.display_name);
    } else {
      console.log('  profile: NOT FOUND');
    }
    await supabase.auth.signOut();
  }
  console.log('');
}
