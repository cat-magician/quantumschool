/**
 * Isolated PostgreSQL regressions for automatic «Без хвостов».
 * Install the optional runtime as documented in test-enrollment-achievement.mjs.
 * pg_cron is unavailable in PGlite: cron.job/schedule below only record metadata.
 * The recorded SQL command is executed manually; real timed ticks are not tested.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const runtime = path.join(root, 'artifacts/achievements/sql-test-runtime/node_modules/@electric-sql/pglite/dist/index.js');
const { PGlite } = await import(pathToFileURL(runtime).href);
const schema = await fs.readFile(path.join(root, 'supabase/schema.sql'), 'utf8');
const migration = await fs.readFile(path.join(root, 'supabase/award-no-tails.sql'), 'utf8');
const quantumMigration = await fs.readFile(path.join(root, 'supabase/award-quantum-leap.sql'), 'utf8');
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalized = (text) => text.replace(/\r\n/g, '\n').trim();
function last(text, expression) {
  const matches = [...text.matchAll(expression)];
  assert.ok(matches.length, `Missing SQL: ${expression}`);
  return matches.at(-1)[0];
}
function fn(name) {
  return last(schema, new RegExp(`^CREATE OR REPLACE FUNCTION ${escape(name)}\\([\\s\\S]*?^\\$\\$;`, 'gm'));
}
function policy(name) {
  return last(schema, new RegExp(`^CREATE POLICY "${escape(name)}"[\\s\\S]*?;`, 'gm'));
}
function trigger(name) {
  return last(schema, new RegExp(`^CREATE TRIGGER ${escape(name)}\\b[\\s\\S]*?;`, 'gm'));
}
function marked(text, name) {
  const begin = text.indexOf(`-- ${name}:start`);
  const end = text.indexOf(`-- ${name}:end`, begin);
  assert.ok(begin >= 0 && end > begin, `Missing SQL markers: ${name}`);
  return text.slice(begin, end);
}
const core = marked(schema, 'no_tails-automation');
assert.equal(normalized(core), normalized(marked(migration, 'no_tails-automation')), 'Full schema and focused migration must install the same automation');
const scheduler = marked(schema, 'no_tails-scheduler');
const extensionCommand = /^CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;\r?\n/gm;
assert.equal([...migration.matchAll(extensionCommand)].length, 1);
const stubbedMigration = migration.replace(extensionCommand, '-- Test only: pg_cron extension replaced by metadata stubs below.\n');
const db = new PGlite();
let nextId = 1;
let superadmin;
let admin;
let scenarios = 0;
const uid = () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`;
async function person(role = 'student', enrolled = true) {
  const id = uid();
  await db.query('INSERT INTO auth.users(id) VALUES ($1)', [id]);
  await db.query('INSERT INTO public.user_profiles(id,role,is_enrolled) VALUES ($1,$2,$3)', [id, role, enrolled]);
  return id;
}
async function asUser(id, action) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('SET ROLE authenticated');
  try { return await action(); }
  finally {
    await db.exec('RESET ROLE').catch(() => {});
    await db.query("SELECT set_config('request.jwt.claim.sub','',false)").catch(() => {});
  }
}
async function rejects(sql, params = [], code = '42501') {
  await db.exec('SAVEPOINT rejected_request');
  try { await assert.rejects(db.query(sql, params), (error) => error.code === code); }
  finally { await db.exec('ROLLBACK TO SAVEPOINT rejected_request; RELEASE SAVEPOINT rejected_request'); }
}
async function scenario(label, action) {
  await db.exec('BEGIN');
  try { await action(); scenarios++; }
  catch (error) { error.message = `${label}: ${error.message}`; throw error; }
  finally { await db.exec('ROLLBACK'); }
}
async function group() {
  const id = uid();
  await db.query("INSERT INTO public.groups(id,name,group_type) VALUES ($1,'Test group','teacher')", [id]);
  return id;
}
async function member(userId, groupId) {
  await db.query('INSERT INTO public.group_members(user_id,group_id) VALUES ($1,$2)', [userId, groupId]);
}
async function homework({ max = 10, published = true, groups = [] } = {}) {
  const id = uid();
  await db.query("INSERT INTO public.homework_pages(id,title,max_score,is_published,group_ids) VALUES ($1,'Homework',$2,$3,$4)", [id, max, published, groups]);
  return id;
}
async function grade(userId, pageId, score, status = 'graded') {
  await db.query(`INSERT INTO public.homework_page_submissions(user_id,page_id,status,score)
    VALUES ($1,$2,$3,$4) ON CONFLICT(page_id,user_id) DO UPDATE SET status=EXCLUDED.status,score=EXCLUDED.score`, [userId, pageId, status, score]);
}
async function seminar({ published = true, type = 'seminar', date = '2026-01-01', offset = null, groups = [] } = {}) {
  const id = uid();
  await db.query("INSERT INTO public.lesson_pages(id,title,lesson_type,lesson_date,is_published,group_ids) VALUES ($1,'Final seminar',$2,$3,$4,$5)", [id, type, date, published, groups]);
  let eventId = null;
  if (offset !== null) {
    eventId = uid();
    await db.query("INSERT INTO public.schedule_events(id,title,event_type,scheduled_at,lesson_page_id) VALUES ($1,'Final seminar','seminar',now()+$2::interval,$3)", [eventId, offset, id]);
  }
  return { id, eventId };
}
async function selectFinal(id) {
  return asUser(superadmin, async () => (await db.query('SELECT public.superadmin_set_no_tails_final_seminar($1) AS settings', [id])).rows[0].settings);
}
async function settings() {
  return asUser(superadmin, async () => (await db.query('SELECT public.superadmin_get_no_tails_automation() AS settings')).rows[0].settings);
}
async function runJob() {
  const command = (await db.query("SELECT command FROM cron.job WHERE jobname='award-no-tails'")).rows[0].command;
  assert.equal(command, 'SELECT public.award_due_no_tails();');
  return Number((await db.query(command)).rows[0].award_due_no_tails);
}
async function earned(userId) {
  return (await db.query("SELECT id,user_id,earned_at::text,seen_at::text FROM public.achievements WHERE code='no_tails' AND user_id=$1", [userId])).rows;
}

try {
  await db.exec(`
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth; CREATE SCHEMA private;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid;
    $$;
    CREATE TABLE public.user_profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),role text,is_enrolled boolean);
  `);
  for (const name of ['groups', 'group_members', 'group_teachers', 'lesson_pages', 'schedule_events', 'homework_pages', 'homework_page_submissions', 'achievement_definitions']) {
    await db.exec(last(schema, new RegExp(`^CREATE TABLE IF NOT EXISTS public\\.${name} \\([\\s\\S]*?^\\);`, 'gm')));
  }
  await db.exec(last(schema, /^CREATE TABLE IF NOT EXISTS achievements \([\s\S]*?^\);/gm));
  await db.exec(`
    ALTER TABLE public.achievements ADD COLUMN code text, ADD COLUMN seen_at timestamptz;
    ALTER TABLE public.schedule_events ADD COLUMN group_ids uuid[] NOT NULL DEFAULT '{}', ADD COLUMN lesson_page_id uuid REFERENCES public.lesson_pages(id) ON DELETE CASCADE;
    ALTER TABLE public.lesson_pages ADD COLUMN group_ids uuid[] NOT NULL DEFAULT '{}';
    ALTER TABLE public.homework_pages ADD COLUMN group_ids uuid[] NOT NULL DEFAULT '{}';
  `);
  await db.exec(last(schema, /^CREATE UNIQUE INDEX IF NOT EXISTS achievements_user_code_key[\s\S]*?;/gm));
  await db.exec(last(schema, /^CREATE UNIQUE INDEX IF NOT EXISTS schedule_events_lesson_page_idx[\s\S]*?;/gm));
  for (const name of ['private.is_staff', 'private.is_superadmin', 'private.is_group_teacher', 'private.staff_can_access_student', 'private.my_group_ids', 'public.award_achievement', 'public.evaluate_achievements', 'public.trg_user_profile_enrollment_achievement', 'public.sync_lesson_page_from_event', 'public.superadmin_grant_personal_achievement']) await db.exec(fn(name));
  for (const name of ['public.award_achievement', 'public.evaluate_achievements', 'public.trg_user_profile_enrollment_achievement', 'public.sync_lesson_page_from_event', 'public.superadmin_grant_personal_achievement']) {
    await db.exec(last(schema, new RegExp(`^REVOKE ALL ON FUNCTION ${escape(name)}\\([^;]+;`, 'gm')));
  }
  await db.exec(last(schema, /^GRANT EXECUTE ON FUNCTION public\.superadmin_grant_personal_achievement\([^;]+;/gm));
  for (const name of ['user_profile_enrollment_achievement', 'sync_lesson_page_from_event']) await db.exec(trigger(name));
  for (const table of ['user_profiles', 'achievements', 'homework_page_submissions']) await db.exec(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
  for (const name of ['Users can read own profile', 'Staff can read all profiles', 'Users can read own achievements', 'Students read own homework page submissions', 'Students insert own homework page submissions', 'Students update own homework page submissions', 'Staff read homework page submissions', 'Staff update homework page submissions', 'Staff grade unmarked homework page submissions']) await db.exec(policy(name));
  await db.exec(`
    GRANT USAGE ON SCHEMA auth,private TO authenticated;
    GRANT SELECT,INSERT,UPDATE ON public.user_profiles,public.achievements,public.homework_page_submissions TO authenticated;
    GRANT SELECT ON public.achievement_definitions,public.lesson_pages,public.homework_pages TO authenticated;
  `);
  await db.exec(last(schema, /^WITH catalog \(code,[\s\S]*?^WHERE is_active AND is_system AND code NOT IN \(SELECT code FROM synced\);/gm));
  await db.exec(core);
  await db.exec(scheduler);
  assert.equal((await db.query('SELECT public.no_tails_automation_status() AS state')).rows[0].state.scheduler_ready, false, 'Missing pg_cron is reported truthfully');
  await assert.rejects(db.exec(migration), /pg_cron|extension/i, 'Focused installer requires the real extension rather than silently claiming readiness');
  await db.exec('ROLLBACK');
  // Explicit metadata-only test double; it never runs jobs on a clock.
  await db.exec(`
    CREATE SCHEMA cron;
    CREATE TABLE cron.job(jobid bigserial PRIMARY KEY,jobname text UNIQUE,schedule text,command text,database text DEFAULT current_database(),active boolean DEFAULT true);
    CREATE FUNCTION cron.schedule(p_name text,p_schedule text,p_command text) RETURNS bigint LANGUAGE plpgsql AS $$
    DECLARE result bigint; BEGIN
      INSERT INTO cron.job(jobname,schedule,command) VALUES(p_name,p_schedule,p_command)
      ON CONFLICT(jobname) DO UPDATE SET schedule=EXCLUDED.schedule,command=EXCLUDED.command,active=true
      RETURNING jobid INTO result; RETURN result;
    END; $$;
  `);
  await db.exec("UPDATE public.achievement_definitions SET is_system=false,is_active=false,image_url='/old-manual-template.png' WHERE code='no_tails'");
  await db.exec(stubbedMigration);
  assert.deepEqual((await db.query("SELECT is_system,is_active,image_url FROM public.achievement_definitions WHERE code='no_tails'")).rows[0], { is_system: true, is_active: true, image_url: '/achievements/no-tails.png' }, 'The focused installer promotes an existing manual template into the active automatic award');
  assert.deepEqual((await db.query('SELECT jobname,schedule,command FROM cron.job')).rows, [{ jobname: 'award-no-tails', schedule: '*/5 * * * *', command: 'SELECT public.award_due_no_tails();' }]);
  superadmin = await person('superadmin');
  admin = await person('admin');
  assert.equal((await settings()).final_seminar_id, null, 'Installation never infers the final seminar');
  assert.equal((await settings()).scheduler_ready, true, 'Readiness reflects the test metadata stub, not an assumed extension');

  await scenario('No choice, drafts and disabled automation', async () => {
    const user = await person(); const page = await homework(); await grade(user, page, 10);
    assert.equal(await runJob(), 0);
    const final = await seminar({ published: false, offset: '-15 days' });
    assert.equal((await selectFinal(final.id)).is_published, false);
    assert.equal(await runJob(), 0, 'Unpublished final seminar blocks issuance');
    await db.query('UPDATE public.lesson_pages SET is_published=true WHERE id=$1', [final.id]);
    await selectFinal(null);
    assert.equal(await runJob(), 0, 'Explicitly clearing the final seminar disables new awards');
    assert.equal((await earned(user)).length, 0);
    const lecture = await seminar({ type: 'lecture' });
    await asUser(superadmin, () => rejects('SELECT public.superadmin_set_no_tails_final_seminar($1)', [lecture.id], '22023'));
  });

  await scenario('Exact two-week boundary', async () => {
    const user = await person(); const page = await homework({ max: 20 }); await grade(user, page, 10);
    const final = await seminar({ offset: '-14 days 0.000001 seconds' });
    await selectFinal(final.id);
    assert.equal(await runJob(), 0, 'One microsecond before the deadline is too early');
    await db.query("UPDATE public.schedule_events SET scheduled_at=now()-interval '14 days' WHERE id=$1", [final.eventId]);
    assert.equal(await runJob(), 1, 'At exactly fourteen days a normalized 5/10 qualifies');
    assert.equal((await earned(user)).length, 1);
  });

  await scenario('Every relevant assignment and normalized grades', async () => {
    const first = await homework({ max: 100 });
    const second = await homework({ max: 20 });
    const users = {};
    for (const name of ['edge', 'excellent', 'low', 'missing', 'draft', 'submitted', 'null', 'over']) users[name] = await person();
    for (const [name, user] of Object.entries(users)) {
      if (name !== 'missing') await grade(user, first, name === 'low' ? 49.99 : name === 'null' ? null : name === 'over' ? 101 : 50, name === 'draft' ? 'draft' : name === 'submitted' ? 'submitted' : 'graded');
      await grade(user, second, name === 'excellent' ? 20 : 10);
    }
    await selectFinal((await seminar({ offset: '-15 days' })).id);
    assert.equal((await earned(users.edge)).length, 1);
    assert.equal((await earned(users.excellent)).length, 1);
    for (const name of ['low', 'missing', 'draft', 'submitted', 'null', 'over']) assert.equal((await earned(users[name])).length, 0, `${name} work must block the award`);
    assert.equal(await runJob(), 0, 'Job retries cannot duplicate the two qualifying awards');
  });

  await scenario('Group visibility, unpublished work and global final seminar', async () => {
    const a = await group(); const b = await group();
    const studentA = await person(); await member(studentA, a);
    const studentB = await person(); await member(studentB, b);
    const noGroup = await person();
    const common = await homework(); const ownA = await homework({ groups: [a] });
    await homework({ groups: [b] }); await homework({ published: false });
    for (const user of [studentA, studentB, noGroup]) await grade(user, common, 10);
    await grade(studentA, ownA, 5);
    await selectFinal((await seminar({ offset: '-15 days', groups: [b] })).id);
    assert.equal((await earned(studentA)).length, 1, 'Other-group homework is not required; the selected final seminar is global');
    assert.equal((await earned(noGroup)).length, 1, 'An ungrouped student only needs globally assigned homework');
    assert.equal((await earned(studentB)).length, 0, 'Missing homework assigned to the student group still blocks the award');
  });

  await scenario('Nonempty relevant work and enrolled students only', async () => {
    const a = await group(); const page = await homework({ groups: [a] });
    const noRelevantWork = await person();
    const pending = await person('student', false); await member(pending, a); await grade(pending, page, 10);
    await member(admin, a); await grade(admin, page, 10);
    await member(superadmin, a); await grade(superadmin, page, 10);
    await selectFinal((await seminar({ offset: '-15 days' })).id);
    for (const user of [noRelevantWork, pending, admin, superadmin]) assert.equal((await earned(user)).length, 0);
    assert.equal(await runJob(), 0, 'An empty set, pending student, admin or superadmin never qualifies');
  });

  await scenario('Grades after the deadline and client security', async () => {
    const user = await person(); const page = await homework(); await grade(user, page, null, 'submitted');
    const final = await seminar({ offset: '-15 days' }); await selectFinal(final.id);
    await asUser(user, async () => {
      await rejects('SELECT public.award_due_no_tails()');
      await rejects('SELECT public.no_tails_automation_status()');
      await rejects('SELECT public.superadmin_get_no_tails_automation()');
      await rejects('SELECT public.superadmin_set_no_tails_final_seminar($1)', [final.id]);
      await rejects('UPDATE public.no_tails_achievement_settings SET final_seminar_id=NULL');
      await rejects("UPDATE public.homework_page_submissions SET status='graded',score=10 WHERE page_id=$1 AND user_id=$2", [page, user]);
      await rejects("SELECT public.award_achievement($1,'no_tails')", [user]);
      await rejects("INSERT INTO public.achievements(user_id,code,title) VALUES ($1,'no_tails','Spoof')", [user]);
    });
    await asUser(admin, () => rejects('SELECT public.superadmin_set_no_tails_final_seminar($1)', [final.id]));
    assert.equal((await earned(user)).length, 0);
    await asUser(superadmin, () => db.query("UPDATE public.homework_page_submissions SET status='graded',score=5 WHERE user_id=$1 AND page_id=$2", [user, page]));
    assert.equal((await earned(user)).length, 0, 'The grade write itself does not pretend to be a scheduled tick');
    assert.equal(await runJob(), 1, 'The recorded scheduler command catches a qualifying grade saved after the deadline');
    await asUser(superadmin, async () => {
      const attempt = await db.query("SELECT public.superadmin_grant_personal_achievement('no_tails','Overwrite','','','',20,true,ARRAY[$1::uuid]) AS result", [admin]);
      assert.deepEqual(attempt.rows[0].result, { ok: false, error: 'code_is_system' });
    });
    await db.query("UPDATE public.achievements SET seen_at='2026-01-01T00:00:00Z' WHERE user_id=$1 AND code='no_tails'", [user]);
    const before = await earned(user); assert.equal(await runJob(), 0); assert.deepEqual(await earned(user), before);
  });

  await scenario('Moscow fallback, event precedence, reschedule and deletion', async () => {
    const final = await seminar({ date: '2026-11-20' });
    let state = await selectFinal(final.id);
    assert.equal(new Date(state.award_starts_at).toISOString(), '2026-12-03T21:00:00.000Z');
    await db.exec("SET LOCAL TIME ZONE 'America/New_York'");
    state = await settings();
    assert.equal(new Date(state.award_starts_at).toISOString(), '2026-12-03T21:00:00.000Z', 'The lesson-date fallback is Moscow midnight, independent of session timezone');
    const eventId = uid();
    await db.query("INSERT INTO public.schedule_events(id,title,event_type,scheduled_at,lesson_page_id) VALUES ($1,'Final','seminar','2026-11-21T17:30:00Z',$2)", [eventId, final.id]);
    assert.equal(new Date((await settings()).award_starts_at).toISOString(), '2026-12-05T17:30:00.000Z');
    await db.query("UPDATE public.schedule_events SET scheduled_at='2026-11-22T18:00:00Z' WHERE id=$1", [eventId]);
    assert.equal(new Date((await settings()).award_starts_at).toISOString(), '2026-12-06T18:00:00.000Z');
    await db.query('DELETE FROM public.schedule_events WHERE id=$1', [eventId]);
    assert.equal(new Date((await settings()).award_starts_at).toISOString(), '2026-12-05T21:00:00.000Z', 'Deleting the event falls back to the material page date copied by the real sync trigger');
    await db.query('DELETE FROM public.lesson_pages WHERE id=$1', [final.id]);
    assert.equal((await settings()).final_seminar_id, null);
    assert.equal((await settings()).award_starts_at, null);
  });

  await scenario('Elapsed two weeks across daylight-saving changes', async () => {
    await db.exec("SET LOCAL TIME ZONE 'America/New_York'");
    const final = await seminar({ date: '2027-03-01' });
    const eventId = uid();
    await db.query("INSERT INTO public.schedule_events(id,title,event_type,scheduled_at,lesson_page_id) VALUES ($1,'Final','seminar','2027-03-01T17:00:00+03:00',$2)", [eventId, final.id]);
    assert.equal(new Date((await selectFinal(final.id)).award_starts_at).toISOString(), '2027-03-15T14:00:00.000Z', 'March 1 17:00 Moscow becomes March 15 17:00 Moscow even when the database session crosses US DST');
    await db.query('DELETE FROM public.schedule_events WHERE id=$1', [eventId]);
    assert.equal(new Date((await settings()).award_starts_at).toISOString(), '2027-03-14T21:00:00.000Z', 'Moscow-midnight fallback also uses exactly 336 elapsed hours');
  });

  await scenario('Readiness checks active database and exact command', async () => {
    await db.exec("UPDATE cron.job SET active=false"); assert.equal((await settings()).scheduler_ready, false);
    await db.exec("UPDATE cron.job SET active=true,database='other_database'"); assert.equal((await settings()).scheduler_ready, false);
    await db.exec("UPDATE cron.job SET database=current_database(),command='SELECT 1;'"); assert.equal((await settings()).scheduler_ready, false);
    await db.exec("UPDATE cron.job SET command='SELECT public.award_due_no_tails();',schedule='0 0 * * *'"); assert.equal((await settings()).scheduler_ready, false, 'A daily job cannot masquerade as the required five-minute schedule');
  });

  // Reapply complete focused installers outside a transaction used to freeze now().
  const persistentStudent = await person(); const persistentPage = await homework(); await grade(persistentStudent, persistentPage, 10);
  const persistentFinal = await seminar({ offset: '-15 days' }); await selectFinal(persistentFinal.id);
  assert.equal((await earned(persistentStudent)).length, 1);
  await db.query("UPDATE public.achievements SET seen_at='2026-01-01T00:00:00Z' WHERE user_id=$1 AND code='no_tails'", [persistentStudent]);
  const preservedAward = await earned(persistentStudent);
  const preservedSettings = (await db.query('SELECT row_to_json(s) AS value FROM public.no_tails_achievement_settings s')).rows;
  await db.exec(stubbedMigration); await db.exec(core);
  assert.deepEqual((await db.query('SELECT row_to_json(s) AS value FROM public.no_tails_achievement_settings s')).rows, preservedSettings, 'Focused/full installation preserves the chosen seminar and audit timestamp');
  assert.deepEqual(await earned(persistentStudent), preservedAward, 'Reapplication preserves original award id/date/seen_at');
  const functionBeforeQuantumPatch = (await db.query("SELECT pg_get_functiondef('public.award_due_no_tails()'::regprocedure) AS body")).rows;
  await db.exec(quantumMigration);
  assert.deepEqual((await db.query("SELECT pg_get_functiondef('public.award_due_no_tails()'::regprocedure) AS body")).rows, functionBeforeQuantumPatch, 'The older quantum patch cannot overwrite isolated no_tails automation');
  assert.deepEqual(await earned(persistentStudent), preservedAward);
  assert.equal(await runJob(), 0);
  assert.equal((await db.query("SELECT count(*) AS total FROM cron.job WHERE jobname='award-no-tails'")).rows[0].total, 1, 'Repeated scheduling keeps one named job');
  const definition = (await db.query("SELECT code,image_url,is_system,staff_ok,is_active FROM public.achievement_definitions WHERE code='no_tails'")).rows[0];
  assert.deepEqual(definition, { code: 'no_tails', image_url: '/achievements/no-tails.png', is_system: true, staff_ok: false, is_active: true });
  console.log(`ок: no_tails PostgreSQL — ${scenarios} групп проверок, срок +14 дней, оценки/группы/роли, безопасность, повторный прогон и сохранение seen_at`);
  console.log('cron: проверены регистрация и ручное выполнение настоящей SQL-команды; metadata stub, реальные тики времени не запускались');
} finally {
  await db.close();
}
