/** Isolated query regressions for superadmin award counts and recipient pages. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(os.tmpdir(), `achievement-admin-tests-${process.pid}-${Date.now()}.mjs`);
await build({
  stdin: {
    contents: `export { loadAchievementAwardCounts, loadAchievementRecipients } from './src/lib/achievementApi';`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: output,
  define: { 'import.meta.env.BASE_URL': '"/"' },
  plugins: [{
    name: 'isolated-award-read-model',
    setup(builder) {
      builder.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: 'supabase', namespace: 'isolated' }));
      builder.onLoad({ filter: /.*/, namespace: 'isolated' }, () => ({
        contents: `export const supabase = {
          from(table) {
            const query = { table, filters: [], orders: [] };
            const chain = {
              select(columns, options) { query.columns = columns; query.options = options; return chain; },
              eq(field, value) { query.filters.push({ operator: 'eq', field, value }); return chain; },
              in(field, value) { query.filters.push({ operator: 'in', field, value }); return chain; },
              order(field, options = {}) { query.orders.push({ field, ...options }); return chain; },
              range(start, end) { query.range = [start, end]; return chain; },
              limit(limit) { query.limit = limit; return chain; },
              then(resolve, reject) { return globalThis.achievementAdminTestDatabase(query).then(resolve, reject); },
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

let rows = [];
let profiles = [];
let calls = [];
let failure = null;
let omitCount = false;
function reset(awardRows = [], profileRows = []) {
  rows = awardRows;
  profiles = profileRows;
  calls = [];
  failure = null;
  omitCount = false;
}
globalThis.achievementAdminTestDatabase = async (query) => {
  calls.push(query);
  if (failure?.(query)) return { data: null, count: null, error: new Error('read failed') };
  let result = query.table === 'achievements' ? [...rows] : query.table === 'user_profiles' ? [...profiles] : null;
  assert.ok(result, `Unexpected table ${query.table}`);
  for (const { operator, field, value } of query.filters) {
    result = result.filter((row) => operator === 'eq' ? row[field] === value : value.includes(row[field]));
  }
  result.sort((a, b) => {
    for (const { field, ascending = true, nullsFirst = false } of query.orders) {
      if (a[field] == null || b[field] == null) {
        if (a[field] == null && b[field] == null) continue;
        return (a[field] == null ? -1 : 1) * (nullsFirst ? 1 : -1);
      }
      const comparison = String(a[field]).localeCompare(String(b[field]));
      if (comparison) return ascending ? comparison : -comparison;
    }
    return 0;
  });
  const count = query.options?.count === 'exact' && !omitCount ? result.length : null;
  if (query.range) result = result.slice(query.range[0], query.range[1] + 1);
  if (query.limit != null) result = result.slice(0, query.limit);
  // Reproduce the default PostgREST ceiling even if the fixture holds more rows.
  return { data: result.slice(0, 1000), count, error: null };
};
const award = (code, index, userId = `person-${index}`) => ({
  id: `${code}-${String(index).padStart(6, '0')}`,
  user_id: userId,
  code,
  // Equal timestamps deliberately require the id tie-breaker for stable pages.
  earned_at: '2026-11-06T09:00:00.000Z',
});

try {
  const api = await import(pathToFileURL(output).href);
  reset();
  assert.equal((await api.loadAchievementAwardCounts([])).size, 0);
  assert.deepEqual(await api.loadAchievementRecipients(''), { items: [], total: 0 });
  assert.equal(calls.length, 0, 'Empty catalog or selection never starts an unfiltered read');

  reset([
    ...Array.from({ length: 1051 }, (_, i) => award('quantum_leap', i)),
    ...Array.from({ length: 1037 }, (_, i) => award('personal_science', i)),
    award('quantum_leap', 2000, 'person-0'),
    ...Array.from({ length: 40 }, (_, i) => award('retired', i)),
  ]);
  const counts = await api.loadAchievementAwardCounts(['quantum_leap', 'personal_science', 'no_recipients']);
  assert.equal(counts.get('quantum_leap'), 1051, 'Automatic awards count unique recipients across pages');
  assert.equal(counts.get('personal_science'), 1037, 'Manual awards are counted independently');
  assert.equal(counts.get('no_recipients') ?? 0, 0);
  assert.equal(counts.has('retired'), false, 'Unrequested old awards stay outside the count model');
  assert.deepEqual(calls.map((query) => query.range), [[0, 999], [1000, 1999], [2000, 2999]], 'Counts go beyond the default thousand-row ceiling');
  for (const query of calls) {
    assert.equal(query.table, 'achievements');
    assert.deepEqual(query.orders.map(({ field, ascending }) => [field, ascending]), [['earned_at', true], ['id', true]]);
    assert.ok(query.filters.some(({ field, operator, value }) => field === 'code' && operator === 'in' && value.includes('quantum_leap')));
  }
  calls = [];
  failure = (query) => query.range?.[0] === 1000;
  await assert.rejects(api.loadAchievementAwardCounts(['quantum_leap', 'personal_science']), /read failed/, 'A later-page error must not return misleading partial totals');
  assert.equal(calls.length, 2);

  const recipientRows = Array.from({ length: 53 }, (_, i) => award('quantum_leap', i));
  const recipientProfiles = recipientRows.filter((_, i) => i !== 49).map((row, i) => ({
    id: row.user_id, display_name: `Recipient ${row.user_id}`, avatar_url: '', email: null, login: `login-${i}`,
    role: row.user_id === 'person-52' ? 'superadmin' : row.user_id === 'person-51' ? 'admin' : 'student',
  })).reverse();
  reset([...recipientRows, award('personal_science', 100)], recipientProfiles);
  const first = await api.loadAchievementRecipients('quantum_leap');
  assert.equal(first.total, 53, 'Exact count describes every recipient, not just the visible page');
  assert.equal(first.items.length, 50);
  assert.deepEqual(first.items.slice(0, 4).map((item) => item.userId), ['person-52', 'person-51', 'person-50', 'person-49']);
  assert.deepEqual(first.items.slice(0, 3).map((item) => item.profile.role), ['superadmin', 'admin', 'student'], 'All recipient roles survive the read model');
  assert.equal(first.items[3].profile, null, 'Missing or invisible profiles preserve an award row with a fallback identity');
  assert.equal(first.items[3].id, 'quantum_leap-000049');
  assert.equal(first.items[0].earnedAt, '2026-11-06T09:00:00.000Z');
  assert.deepEqual(calls[0].range, [0, 49]);
  assert.equal(calls[0].options.count, 'exact');
  assert.deepEqual(calls[0].orders.map(({ field, ascending }) => [field, ascending]), [['earned_at', false], ['id', false]]);
  assert.equal(calls[1].table, 'user_profiles');
  assert.equal(calls[1].filters[0].operator, 'in', 'Recipient profiles use one batched lookup');

  const second = await api.loadAchievementRecipients('quantum_leap', { offset: 50, pageSize: 50 });
  assert.equal(second.total, 53);
  assert.deepEqual(second.items.map((item) => item.userId), ['person-2', 'person-1', 'person-0']);
  assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 53, 'Stable sorting avoids page overlaps and gaps when timestamps tie');
  calls = [];
  const smallPage = await api.loadAchievementRecipients('quantum_leap', { offset: 10, pageSize: 5 });
  assert.equal(smallPage.items.length, 5);
  assert.deepEqual(calls[0].range, [10, 14]);

  reset();
  assert.deepEqual(await api.loadAchievementRecipients('quantum_leap'), { items: [], total: 0 });
  assert.equal(calls.length, 1, 'A real zero has an exact zero count and needs no profile request');
  reset([award('quantum_leap', 0)]);
  failure = (query) => query.table === 'achievements';
  await assert.rejects(api.loadAchievementRecipients('quantum_leap'), /read failed/);
  reset([award('quantum_leap', 0)]);
  failure = (query) => query.table === 'user_profiles';
  await assert.rejects(api.loadAchievementRecipients('quantum_leap'), /read failed/, 'Profile lookup failure cannot masquerade as deleted users');
  reset([award('quantum_leap', 0)]);
  omitCount = true;
  await assert.rejects(api.loadAchievementRecipients('quantum_leap'), 'Missing exact counts must fail instead of displaying zero');

  console.log('ок: выдачи наград — >1000 строк, уникальные счётчики, точное число/страницы, все роли, отсутствующие профили, ошибки вместо ложного нуля');
} finally {
  delete globalThis.achievementAdminTestDatabase;
  await fs.unlink(output);
}
