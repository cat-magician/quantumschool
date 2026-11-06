/**
 * PostgreSQL integration regressions in an isolated, in-memory PGlite database.
 * No Supabase credentials or network/database connections are used by this script.
 * Install the optional runtime outside project dependencies, then run:
 * npm install --prefix artifacts/achievements/sql-test-runtime --no-save --package-lock=false @electric-sql/pglite
 * node scripts/test-enrollment-achievement.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const runtime = path.join(root, 'artifacts/achievements/sql-test-runtime/node_modules/@electric-sql/pglite/dist/index.js');
let PGlite;
try {
  ({ PGlite } = await import(pathToFileURL(runtime).href));
} catch (error) {
  throw new Error('Install the optional isolated PGlite runtime using the command at the top of this script.', { cause: error });
}
const schema = await fs.readFile(path.join(root, 'supabase/schema.sql'), 'utf8');
const migration = await fs.readFile(path.join(root, 'supabase/award-quantum-leap.sql'), 'utf8');
const escaped = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalize = (value) => value.replace(/\r\n/g, '\n').trim();

function lastStatement(text, expression) {
  const matches = [...text.matchAll(expression)];
  assert.ok(matches.length > 0, `SQL statement not found: ${expression}`);
  return matches.at(-1)[0];
}
function functionSql(name, text = schema) {
  return lastStatement(text, new RegExp(`^CREATE OR REPLACE FUNCTION ${escaped(name)}\\([\\s\\S]*?^\\$\\$;`, 'gm'));
}
function revokeSql(name, text = schema) {
  return lastStatement(text, new RegExp(`^REVOKE ALL ON FUNCTION ${escaped(name)}\\([^;]+;`, 'gm'));
}
function policySql(name) {
  return lastStatement(schema, new RegExp(`^CREATE POLICY "${escaped(name)}"[\\s\\S]*?;`, 'gm'));
}
function triggerSql(name, text = schema) {
  return lastStatement(text, new RegExp(`^CREATE TRIGGER ${escaped(name)}\\b[\\s\\S]*?;`, 'gm'));
}
const catalogSync = lastStatement(schema, /^WITH catalog \(code,[\s\S]*?^WHERE is_active AND is_system AND code NOT IN \(SELECT code FROM synced\);/gm);

for (const name of ['public.evaluate_achievements', 'public.trg_user_profile_enrollment_achievement']) {
  assert.equal(normalize(functionSql(name)), normalize(functionSql(name, migration)), `${name}: full schema and focused migration must agree`);
  assert.equal(normalize(revokeSql(name)), normalize(revokeSql(name, migration)), `${name}: both paths must restrict direct execution`);
}
assert.equal(normalize(triggerSql('user_profile_enrollment_achievement')), normalize(triggerSql('user_profile_enrollment_achievement', migration)));

const db = new PGlite();
let nextId = 1;
const uid = () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`;
async function authUser() {
  const id = uid();
  await db.query('INSERT INTO auth.users(id, email) VALUES ($1, $2)', [id, `${id}@example.test`]);
  return id;
}
async function person(role, isEnrolled) {
  const id = await authUser();
  await db.query('INSERT INTO public.user_profiles(id, role, is_enrolled) VALUES ($1, $2, $3)', [id, role, isEnrolled]);
  return id;
}
async function awards(id) {
  return (await db.query("SELECT id, code, earned_at::text, seen_at::text FROM public.achievements WHERE user_id=$1 AND code='quantum_leap'", [id])).rows;
}
async function asAuthenticated(id, action) {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec('SET ROLE authenticated');
  try {
    return await action();
  } finally {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub', '', false)");
  }
}
async function permissionDenied(sql, parameters = []) {
  await assert.rejects(db.query(sql, parameters), (error) => error.code === '42501', sql);
}

try {
  // Only Supabase's identity tables/function and unrelated profile columns are fixtures.
  // Award logic, profile guards, policies and privileges come from the actual SQL files.
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth;
    CREATE SCHEMA private;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
    CREATE TABLE auth.identities(user_id uuid, identity_data jsonb, provider text, last_sign_in_at timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    CREATE TABLE public.superadmin_allowlist(email text PRIMARY KEY);
    CREATE TABLE public.user_profiles(
      id uuid PRIMARY KEY REFERENCES auth.users(id),
      role text NOT NULL DEFAULT 'student', is_enrolled boolean NOT NULL DEFAULT false,
      display_name text DEFAULT '', email text, yandex_login text, contact_email text,
      enrolled_course_id uuid, stage1_score numeric, stage2_score numeric,
      stage1_status text DEFAULT 'pending', stage2_status text DEFAULT 'pending',
      selection_rejected boolean DEFAULT false, selection_waitlisted boolean DEFAULT false,
      stage1_viewed_at timestamptz, stage2_viewed_at timestamptz,
      teacher_application boolean DEFAULT false, teacher_application_rejected boolean DEFAULT false
    );
    ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
  `);
  await db.exec(lastStatement(schema, /^CREATE TABLE IF NOT EXISTS achievements \([\s\S]*?^\);/gm));
  await db.exec(`
    ALTER TABLE public.achievements ADD COLUMN code text;
    ALTER TABLE public.achievements ADD COLUMN seen_at timestamptz;
    ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
  `);
  await db.exec(lastStatement(schema, /^CREATE UNIQUE INDEX IF NOT EXISTS achievements_user_code_key[\s\S]*?;/gm));
  await db.exec(lastStatement(schema, /^CREATE TABLE IF NOT EXISTS public\.achievement_definitions \([\s\S]*?^\);/gm));
  for (const name of [
    'private.is_staff', 'private.is_superadmin', 'private.is_allowlisted_superadmin_email',
    'public.user_yandex_login', 'public.guard_user_profile_insert', 'public.guard_user_profile_update',
    'public.award_achievement', 'public.superadmin_grant_personal_achievement',
  ]) await db.exec(functionSql(name));
  for (const name of [
    'public.guard_user_profile_insert', 'public.guard_user_profile_update',
    'public.award_achievement', 'public.superadmin_grant_personal_achievement',
  ]) await db.exec(revokeSql(name));
  await db.exec(lastStatement(schema, /^GRANT EXECUTE ON FUNCTION public\.superadmin_grant_personal_achievement\([^;]+;/gm));
  for (const name of ['guard_user_profile_insert', 'guard_user_profile_update']) await db.exec(triggerSql(name));
  for (const name of [
    'Users can read own profile', 'Users can insert own profile', 'Users can update own profile',
    'Staff can read all profiles', 'Staff can update student profiles', 'Users can read own achievements',
  ]) await db.exec(policySql(name));
  await db.exec(`
    GRANT USAGE ON SCHEMA auth, private TO authenticated;
    GRANT SELECT, INSERT, UPDATE ON public.user_profiles, public.achievements TO authenticated;
    GRANT SELECT ON public.achievement_definitions TO authenticated;
  `);

  const enrolled = await person('student', true);
  const pending = await person('student', false);
  const admin = await person('admin', true);
  const superadmin = await person('superadmin', true);
  await db.exec(`
    INSERT INTO public.achievement_definitions(code,title,image_url,is_active,is_system,staff_ok)
    VALUES ('manual_existing','Existing custom award','/manual.png',false,false,true);
  `);
  const customBefore = (await db.query("SELECT row_to_json(d) AS data FROM public.achievement_definitions d WHERE code='manual_existing'")).rows[0].data;

  const initialMigration = await db.exec(migration);
  const initialSummary = initialMigration.at(-1).rows[0];
  assert.equal(Number(initialSummary.enrolled_students), 1);
  assert.equal(Number(initialSummary.awarded_students), 1);
  assert.equal(Number(initialSummary.remaining_students), 0, 'Migration reports no enrolled students missing an award');
  assert.equal((await awards(enrolled)).length, 1, 'Already enrolled students are backfilled immediately');
  assert.equal((await awards(enrolled))[0].seen_at, null, 'Backfilled award remains unseen for its first announcement');
  for (const id of [pending, admin, superadmin]) assert.equal((await awards(id)).length, 0, 'Pending students and staff do not receive an enrollment award');

  await asAuthenticated(admin, () => db.query('UPDATE public.user_profiles SET is_enrolled=true WHERE id=$1', [pending]));
  assert.equal((await awards(pending)).length, 1, 'Teacher enrollment of another student triggers issuance');
  const insertedEnrolled = await person('student', true);
  const insertedPending = await person('student', false);
  const insertedAdmin = await person('admin', true);
  assert.equal((await awards(insertedEnrolled)).length, 1, 'Enrolled INSERT triggers issuance');
  assert.equal((await awards(insertedPending)).length, 0);
  assert.equal((await awards(insertedAdmin)).length, 0);
  await db.query("UPDATE public.user_profiles SET role='student' WHERE id=$1", [insertedAdmin]);
  assert.equal((await awards(insertedAdmin)).length, 1, 'Role transition into an enrolled student triggers issuance');

  await db.query("UPDATE public.achievements SET seen_at='2026-01-01T00:00:00Z' WHERE user_id=$1 AND code='quantum_leap'", [enrolled]);
  const earnedBefore = await awards(enrolled);
  await db.query('UPDATE public.user_profiles SET is_enrolled=true WHERE id=$1', [enrolled]);
  await db.query('UPDATE public.user_profiles SET is_enrolled=false WHERE id=$1', [enrolled]);
  assert.deepEqual(await awards(enrolled), earnedBefore, 'Unenrollment retains an already earned award');
  await db.query('UPDATE public.user_profiles SET is_enrolled=true WHERE id=$1', [enrolled]);
  assert.deepEqual(await awards(enrolled), earnedBefore, 'Repeated enrollment preserves the original row and seen_at');

  await asAuthenticated(insertedPending, async () => {
    await assert.rejects(db.query('UPDATE public.user_profiles SET is_enrolled=true WHERE id=$1', [insertedPending]));
    await permissionDenied("SELECT public.award_achievement($1, 'quantum_leap')", [insertedPending]);
    await permissionDenied('SELECT public.evaluate_achievements($1)', [insertedPending]);
    await permissionDenied('SELECT public.trg_user_profile_enrollment_achievement()');
    await permissionDenied("INSERT INTO public.achievements(user_id,code,title) VALUES ($1,'quantum_leap','Spoofed')", [insertedPending]);
    const updated = await db.query('UPDATE public.user_profiles SET is_enrolled=true WHERE id=$1 RETURNING id', [insertedEnrolled]);
    assert.deepEqual(updated.rows, [], 'Student cannot modify another profile through RLS');
  });
  assert.equal((await awards(insertedPending)).length, 0, 'Failed self-enrollment creates no award');
  assert.equal((await db.query('SELECT is_enrolled FROM public.user_profiles WHERE id=$1', [insertedPending])).rows[0].is_enrolled, false);

  const ownInsert = await authUser();
  await asAuthenticated(ownInsert, () => db.query("INSERT INTO public.user_profiles(id,role,is_enrolled) VALUES ($1,'superadmin',true)", [ownInsert]));
  assert.deepEqual((await db.query('SELECT role,is_enrolled FROM public.user_profiles WHERE id=$1', [ownInsert])).rows, [{ role: 'student', is_enrolled: false }], 'Own INSERT is sanitized before the achievement AFTER trigger');
  assert.equal((await awards(ownInsert)).length, 0);

  await asAuthenticated(superadmin, async () => {
    const result = await db.query(`SELECT public.superadmin_grant_personal_achievement(
      'quantum_leap','Overwrite','','','',100,true,ARRAY[$1::uuid]) AS result`, [superadmin]);
    assert.deepEqual(result.rows[0].result, { ok: false, error: 'code_is_system' }, 'Personal award form cannot overwrite the system award');
  });
  const definitionBefore = (await db.query("SELECT title,description,hint,image_url,sort_order,is_active,is_system,staff_ok FROM public.achievement_definitions WHERE code='quantum_leap'")).rows[0];
  const repeatedMigration = await db.exec(migration);
  const repeatedSummary = repeatedMigration.at(-1).rows[0];
  assert.equal(Number(repeatedSummary.enrolled_students), 4);
  assert.equal(Number(repeatedSummary.awarded_students), 4);
  assert.equal(Number(repeatedSummary.remaining_students), 0);
  assert.deepEqual(await awards(enrolled), earnedBefore, 'Reapplying focused migration preserves the original issuance and seen_at');
  assert.equal((await awards(pending)).length, 1);
  assert.equal((await db.query("SELECT row_to_json(d) AS data FROM public.achievement_definitions d WHERE code='manual_existing'")).rows[0].data.updated_at, customBefore.updated_at);
  assert.deepEqual((await db.query("SELECT row_to_json(d) AS data FROM public.achievement_definitions d WHERE code='manual_existing'")).rows[0].data, customBefore, 'Focused migration leaves custom awards intact');

  await db.exec(catalogSync);
  assert.deepEqual((await db.query("SELECT title,description,hint,image_url,sort_order,is_active,is_system,staff_ok FROM public.achievement_definitions WHERE code='quantum_leap'")).rows[0], definitionBefore, 'Full schema catalog and focused migration define exactly the same award');
  assert.deepEqual(await awards(enrolled), earnedBefore);

  console.log('ок: PostgreSQL — зачисление INSERT/UPDATE, backfill, роли, повторный прогон/seen_at, RLS, запрет самозачисления и прямой выдачи, сохранность ручных наград');
} finally {
  await db.close();
}
