/** Регрессии: новая награда в открытой сессии, общий кеш и снятые старые награды. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(os.tmpdir(), `achievement-tests-${process.pid}-${Date.now()}.mjs`);

await build({
  stdin: {
    contents: `export * from './src/lib/achievementApi'; export { isLegacyAchievementCode } from './src/lib/achievementUtils';`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: output,
  define: { 'import.meta.env.BASE_URL': '"/"' },
  plugins: [{
    name: 'isolated-achievement-db',
    setup(builder) {
      builder.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: 'supabase', namespace: 'isolated' }));
      builder.onLoad({ filter: /.*/, namespace: 'isolated' }, () => ({
        contents: `export const supabase = {
          from(table) {
            const query = { table, filters: [] };
            const chain = {
              select(value) { query.select = value; return chain; },
              eq(...args) { query.filters.push(args); return chain; },
              in(...args) { query.filters.push(args); return chain; },
              is(...args) { query.filters.push(args); return chain; },
              order() { return chain; },
              limit(value) { query.limit = value; return chain; },
              then(resolve, reject) { return globalThis.achievementTestDatabase(query).then(resolve, reject); },
            };
            return chain;
          },
        };`,
        loader: 'js',
      }));
    },
  }],
  logLevel: 'warning',
});

const actualNow = Date.now;
let now = 100_000;
Date.now = () => now;
let calls = 0;
let result = { data: [], error: null };
globalThis.achievementTestDatabase = async (query) => {
  assert.equal(query.table, 'achievement_definitions');
  assert.deepEqual(query.filters, [['is_active', true]]);
  calls += 1;
  return result;
};
const definition = (code) => ({ code, title: code, description: '', hint: '', image_url: '', sort_order: 100 });

try {
  const api = await import(pathToFileURL(output).href);
  result = { data: [definition('club_hero'), definition('homework_first_submit'), definition('homework_first_graded'), definition('homework_excellent')], error: null };
  const together = await Promise.all([api.loadAchievementCatalog(), api.loadAchievementCatalog(), api.loadAchievementCatalog({ forceRefresh: true })]);
  assert.equal(calls, 1, 'Several avatars/panels share one request');
  assert.deepEqual(together.map((rows) => rows.map((row) => row.code)), [['club_hero'], ['club_hero'], ['club_hero']], 'Retired badges stay hidden before schema update');

  await api.loadAchievementCatalog();
  assert.equal(calls, 1, 'Fresh cache avoids duplicate reads');
  result = { data: [definition('club_hero'), definition('new_personal_award')], error: null };
  assert.equal((await api.loadAchievementCatalog({ forceRefresh: true })).length, 2, 'Polling sees an award created while recipient stays logged in');
  assert.equal(calls, 2);

  now += 30_001;
  await api.loadAchievementCatalog();
  assert.equal(calls, 3, 'Catalogue cache expires during an open session');

  api.resetAchievementCatalogCache();
  result = { data: null, error: new Error('offline') };
  await assert.rejects(api.loadAchievementCatalog({ strict: true }), /offline/);
  assert.deepEqual(await api.loadAchievementCatalog(), [], 'Legacy callers get a safe empty result on failure');
  result = { data: [definition('recovered')], error: null };
  assert.equal((await api.loadAchievementCatalog())[0].code, 'recovered', 'A failed fetch does not poison the session cache');

  api.resetAchievementCatalogCache();
  const waiting = [];
  globalThis.achievementTestDatabase = () => new Promise((resolve) => waiting.push(resolve));
  const oldRequest = api.loadAchievementCatalog();
  await new Promise((resolve) => setImmediate(resolve));
  api.resetAchievementCatalogCache();
  const newRequest = api.loadAchievementCatalog();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(waiting.length, 2);
  waiting[1]({ data: [definition('latest')], error: null });
  await newRequest;
  waiting[0]({ data: [definition('outdated')], error: null });
  await oldRequest;
  assert.equal((await api.loadAchievementCatalog())[0].code, 'latest', 'A stale request cannot overwrite a reset catalogue');

  assert.equal(api.isLegacyAchievementCode('homework_excellent'), true);
  assert.equal(api.isLegacyAchievementCode('toString'), false);

  let unseenReads = 0;
  globalThis.achievementTestDatabase = async (query) => {
    unseenReads += 1;
    assert.equal(query.table, 'achievements');
    assert.ok(query.filters.some(([field, value]) => field === 'code' && value.includes('latest')),
      'Disabled awards cannot occupy the unseen queue limit');
    return { data: [{ id: 'new-row', code: 'latest' }], error: null };
  };
  assert.deepEqual(await api.fetchUnseenAchievements('person', []), []);
  assert.equal(unseenReads, 0, 'No active catalogue means no pointless award query');
  assert.equal((await api.fetchUnseenAchievements('person', ['latest']))[0].id, 'new-row');
  assert.equal(unseenReads, 1);
  console.log('ок: кеш, обновление в открытой сессии, параллельные запросы, восстановление после ошибок, снятые награды');
} finally {
  Date.now = actualNow;
  delete globalThis.achievementTestDatabase;
  await fs.unlink(output);
}
