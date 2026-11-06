/** Isolated client regressions: Moscow dates, all seminar options and failed RPCs. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(os.tmpdir(), `no-tails-admin-${process.pid}-${Date.now()}.mjs`);
await build({
  entryPoints: [path.join(root, 'src/lib/noTailsAutomation.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: output,
  plugins: [{
    name: 'isolated-no-tails-requests',
    setup(builder) {
      builder.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: 'supabase', namespace: 'isolated' }));
      builder.onLoad({ filter: /.*/, namespace: 'isolated' }, () => ({
        contents: `export const supabase = {
          rpc(name, args) { return globalThis.noTailsAdminRpc(name, args); },
          from(table) {
            const query = {table, orders: []};
            const chain = {
              select(columns) { query.columns = columns; return chain; },
              eq(field, value) { query.filter = [field, value]; return chain; },
              order(field, options) { query.orders.push([field, options]); return chain; },
              range(start, end) { query.range = [start, end]; return chain; },
              then(resolve, reject) { return globalThis.noTailsAdminQuery(query).then(resolve, reject); },
            };
            return chain;
          },
        };`,
      }));
    },
  }],
  logLevel: 'warning',
});

try {
  const api = await import(pathToFileURL(output).href);
  const seminarRows = Array.from({ length: 1001 }, (_, index) => ({
    id: `seminar-${index}`, title: `Семинар ${index}`, lesson_date: '2026-12-19',
    is_published: index !== 0,
    schedule_events: index === 0 ? [] : index === 1
      ? { id: 'event-1', scheduled_at: '2026-12-12T15:00:00Z' }
      : [{ id: `event-${index}`, scheduled_at: '2026-12-20T10:00:00Z' }],
  }));
  const queries = [];
  globalThis.noTailsAdminQuery = async (query) => {
    queries.push(query);
    assert.equal(query.table, 'lesson_pages');
    assert.deepEqual(query.filter, ['lesson_type', 'seminar']);
    return { data: seminarRows.slice(query.range[0], query.range[1] + 1), error: null };
  };
  const seminars = await api.loadNoTailsSeminars();
  assert.equal(seminars.length, 1001, 'Every seminar remains selectable above the server row limit');
  assert.deepEqual(queries.map((query) => query.range), [[0, 499], [500, 999], [1000, 1499]]);
  assert.deepEqual(queries[0].orders, [['lesson_date', { ascending: false }], ['id', { ascending: true }]]);
  assert.equal(seminars[0].startsAt, '2026-12-18T21:00:00.000Z', 'Date-only seminar starts at Moscow midnight');
  assert.equal(seminars[0].isPublished, false, 'Drafts can be chosen in advance');
  assert.equal(seminars[0].usesDateOnly, true);
  assert.equal(api.noTailsAwardStartsAt(seminars[0]), '2027-01-01T21:00:00.000Z', 'Fourteen days preserves Moscow midnight across year boundary');
  assert.equal(api.noTailsAwardStartsAt(seminars[1]), '2026-12-26T15:00:00.000Z', 'Scheduled time takes precedence over lesson date');
  assert.equal(seminars[1].usesDateOnly, false);
  assert.equal(seminars[2].startsAt, '2026-12-20T10:00:00Z', 'Nested events accept the PostgREST array relationship');

  const config = {
    final_seminar_id: null, award_starts_at: null, is_published: false,
    scheduler_ready: false, updated_at: '2026-11-06T12:00:00Z',
  };
  const rpcCalls = [];
  globalThis.noTailsAdminRpc = async (name, args) => {
    rpcCalls.push({ name, args });
    return { data: config, error: null };
  };
  assert.equal((await api.loadNoTailsAutomationSettings()).finalSeminarId, null, 'Loading does not choose a final seminar');
  assert.equal((await api.saveNoTailsAutomationSettings(null)).schedulerReady, false, 'Disabled scheduler is never reported ready');
  assert.deepEqual(rpcCalls.at(-1), { name: 'superadmin_set_no_tails_final_seminar', args: { p_seminar_id: null } });
  config.final_seminar_id = 'selected-seminar';
  config.award_starts_at = '2027-01-01T21:00:00Z';
  const saved = await api.saveNoTailsAutomationSettings('selected-seminar');
  assert.equal(saved.finalSeminarId, 'selected-seminar');
  assert.equal(saved.awardStartsAt, config.award_starts_at, 'Backend deadline is authoritative');

  for (const code of ['PGRST202', '42883']) {
    globalThis.noTailsAdminRpc = async () => ({ data: null, error: { code } });
    await assert.rejects(api.loadNoTailsAutomationSettings(), api.NoTailsAutomationUpdateRequired);
  }
  const forbidden = { code: '42501', message: 'forbidden' };
  globalThis.noTailsAdminRpc = async () => ({ data: null, error: forbidden });
  await assert.rejects(api.saveNoTailsAutomationSettings('selected-seminar'), (error) => error === forbidden);
  globalThis.noTailsAdminRpc = async () => ({ data: null, error: null });
  await assert.rejects(api.saveNoTailsAutomationSettings('selected-seminar'), /Не удалось прочитать настройки/, 'Empty RPC response must not look like a saved configuration');

  globalThis.noTailsAdminQuery = async () => ({ data: null, error: { code: 'PGRST200' } });
  await assert.rejects(api.loadNoTailsSeminars(), api.NoTailsAutomationUpdateRequired);
  console.log('ок: настройки «Без хвостов» — >1000 семинаров, московские даты, +14 дней, явный выбор, ошибки и выключенный планировщик');
} finally {
  delete globalThis.noTailsAdminRpc;
  delete globalThis.noTailsAdminQuery;
  await fs.rm(output, { force: true });
}
