/**
 * Creates test users in Supabase (idempotent).
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env or environment.
 *
 * Usage: node scripts/seed-test-users.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env\n' +
    'Get service role key: Supabase Dashboard → Settings → API → service_role'
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_USERS = [
  {
    email: 'superadmin@test.qc.ru',
    password: 'superadmin123',
    name: 'Тест Админ (демо)',
    role: 'admin',
  },
  {
    email: 'admin@test.qc.ru',
    password: 'admin123',
    name: 'Тест Преподаватель',
    role: 'admin',
  },
  {
    email: 'student@test.qc.ru',
    password: 'student123',
    name: 'Тест Ученик',
    role: 'student',
  },
];

async function ensureUser({ email, password, name, role }) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users?.find((u) => u.email === email);

  let userId = existing?.id;

  if (!existing) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, role },
    });
    if (error) throw new Error(`${email}: ${error.message}`);
    userId = data.user.id;
    console.log(`✓ Created ${email}`);
  } else {
    await admin.auth.admin.updateUserById(userId, {
      password,
      user_metadata: { full_name: name, role },
    });
    console.log(`✓ Updated ${email}`);
  }

  const { error: profileError } = await admin
    .from('user_profiles')
    .upsert({ id: userId, display_name: name, role }, { onConflict: 'id' });

  if (profileError) throw new Error(`profile ${email}: ${profileError.message}`);
}

async function main() {
  console.log('Seeding test users...\n');
  for (const u of TEST_USERS) {
    await ensureUser(u);
  }
  console.log('\nDone. Test accounts:');
  for (const u of TEST_USERS) {
    console.log(`  ${u.role.padEnd(12)} ${u.email} / ${u.password}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
