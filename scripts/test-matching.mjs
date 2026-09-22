/**
 * Проверки логики сопоставления форм и связанных с ней утилит.
 * Данные синтетические, файлы не нужны:
 *   node scripts/test-matching.mjs
 */

import { build } from 'esbuild';
import { buildCsv, readArchive } from './contest-archive-to-csv.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const bundlePath = path.join(os.tmpdir(), `matching-test-${Date.now()}.mjs`);

/**
 * Клиент Supabase создаётся при импорте и требует переменных окружения Vite.
 * Проверяемая логика в него не ходит, поэтому подменяем заглушкой: любое
 * обращение упадёт с понятным текстом.
 */
const stubSupabase = {
  name: 'stub-supabase',
  setup(builder) {
    builder.onResolve({ filter: /(^|\/)supabase$/ }, () => ({
      path: 'stub-supabase',
      namespace: 'stub',
    }));
    builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents: `export const supabase = new Proxy({}, {
        get() { throw new Error('В проверках нет доступа к базе'); },
      });`,
      loader: 'js',
    }));
  },
};

await build({
  plugins: [stubSupabase],
  stdin: {
    contents: `
      export * from '../src/lib/identityMatching';
      export * from '../src/lib/tableImport';
      export * from '../src/lib/selectionConfig';
      export * from '../src/lib/selectionExport';
      export * from '../src/lib/selectionFilters';
      export * from '../src/lib/profileUtils';
      export * from '../src/lib/selectionPersonMap';
      export * from '../src/lib/selectionStageStats';
    `,
    resolveDir: path.join(root, 'scripts'),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundlePath,
  logLevel: 'warning',
});

const lib = await import(pathToFileURL(bundlePath).href);

let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  void name;
}

function table(headers, rows) {
  return { headers, rows };
}

function profile(over = {}) {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    display_name: 'Иванов Иван',
    avatar_url: '',
    enrolled_course_id: null,
    bio: '',
    role: 'student',
    is_enrolled: false,
    stage1_status: 'pending',
    stage2_status: 'pending',
    stage1_score: null,
    stage2_score: null,
    email: 'ivanov@yandex.ru',
    login: null,
    yandex_login: null,
    recovery_email: null,
    contact_email: null,
    privacy_consent_at: null,
    privacy_policy_version: null,
    city: null,
    school: null,
    grade: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...over,
  };
}

// ── Нормализация имён ─────────────────────────────────────────
check('ё и порядок слов не мешают', () => {
  assert.equal(lib.normalizeName('Пётр Королёв'), lib.normalizeName('Королев Петр'));
  assert.equal(lib.normalizeName('  Иванов   Иван  '), 'иван иванов');
  assert.equal(lib.normalizeName('Иванов, И.И.'), 'и и иванов');
});

// ── Время ─────────────────────────────────────────────────────
check('время формы читается и сдвигается', () => {
  const at = lib.parseFormTimestamp('2026-08-20 11:30:41');
  assert.equal(new Date(at).getHours(), 11);

  const shifted = lib.parseFormTimestamp('2026-08-20 11:30:41', 2);
  assert.equal(at - shifted, 2 * 3600_000);
  assert.equal(lib.parseFormTimestamp(''), null);
  assert.equal(lib.parseFormTimestamp('не время'), null);
});

// ── Разметка колонок ──────────────────────────────────────────
check('«время начала заполнения» не путается с отправкой', () => {
  const mapping = lib.autoDetectColumns([
    'Время начала заполнения формы', 'Время создания',
    'Время затраченное на заполнение формы', 'Ваше ФИО', 'Ваша почта', 'Логин',
  ]);
  assert.equal(mapping.submittedAt, 1);
  assert.equal(mapping.name, 3);
  assert.equal(mapping.email, 4);
  assert.equal(mapping.login, 5);
  assert.equal(mapping.code, null);
});

check('код участника находится по заголовку', () => {
  const mapping = lib.autoDetectColumns(['Код участника', 'Ваше ФИО']);
  assert.equal(mapping.code, 0);
});

check('«Имя» и «Фамилия» по отдельности за ФИО не принимаются', () => {
  const mapping = lib.autoDetectColumns(['Имя', 'Фамилия', 'Ваше ФИО']);
  assert.equal(mapping.name, 2);
});

// ── Строки формы ──────────────────────────────────────────────
check('ссылка в поле ФИО именем не считается', () => {
  const [entry] = lib.buildFormEntries(
    table(['ФИО'], [['https://disk.yandex.ru/i/abc']]),
    { ...lib.EMPTY_MAPPING, name: 0 },
  );
  assert.equal(entry.name, '');
});

check('опечатка в адресе видна отдельно', () => {
  const entries = lib.buildFormEntries(
    table(['Почта'], [['ok@mail.ru'], ['ошибка#mail.ru'], ['']]),
    { ...lib.EMPTY_MAPPING, email: 0 },
  );
  assert.deepEqual(entries.map((e) => e.emailValid), [true, false, false]);
});

check('повторная отправка схлопывается в последнюю', () => {
  const entries = lib.buildFormEntries(
    table(['Почта', 'Время'], [
      ['dup@mail.ru', '2026-08-20 10:00:00'],
      ['dup@mail.ru', '2026-08-21 10:00:00'],
      ['one@mail.ru', '2026-08-20 10:00:00'],
    ]),
    { ...lib.EMPTY_MAPPING, email: 0, submittedAt: 1 },
  );
  const active = entries.filter((e) => !e.supersededBy);
  assert.equal(active.length, 2);
  assert.equal(entries[0].supersededBy, 2);
  assert.equal(entries[1].supersededBy, undefined);
});

check('дедупликация идёт по коду, когда он есть', () => {
  const entries = lib.buildFormEntries(
    table(['Код участника', 'ФИО'], [['abc', 'Иванов Иван'], ['abc', 'Иванов И.']]),
    { ...lib.EMPTY_MAPPING, code: 0, name: 1 },
  );
  assert.equal(entries.filter((e) => !e.supersededBy).length, 1);
});

// ── Скоринг ───────────────────────────────────────────────────
const mkEntry = (over = {}) => ({
  rowNumber: 1, code: '', name: '', email: '', login: '',
  submittedAt: null, city: '', school: '', grade: '',
  workUrl: '', workName: '', emailValid: false,
  ...over,
});

check('код решает сам по себе', () => {
  const p = profile({ display_name: 'Совсем другой человек' });
  const c = lib.scoreCandidate(mkEntry({ code: p.id }), p, 'questionnaire');
  assert.ok(c.signals.includes('code'));
});

check('почта совпала — точное совпадение', () => {
  const p = profile();
  const c = lib.scoreCandidate(mkEntry({ email: 'ivanov@yandex.ru' }), p, 'questionnaire');
  assert.ok(c.signals.includes('email'));
});

check('логин монитора ловится и по yandex_login, и по полному адресу', () => {
  const byLogin = lib.scoreCandidate(
    mkEntry({ login: 'ivanov.ii' }),
    profile({ yandex_login: 'ivanov.ii' }),
    'contest',
  );
  assert.ok(byLogin.signals.includes('login'));

  const byMail = lib.scoreCandidate(
    mkEntry({ login: 'kunets@phystech.edu' }),
    profile({ email: 'kunets@phystech.edu' }),
    'contest',
  );
  assert.ok(byMail.signals.includes('login'));
});

check('совпадение с началом адреса — только догадка', () => {
  const c = lib.scoreCandidate(mkEntry({ login: 'ivanov' }), profile(), 'contest');
  assert.ok(c.signals.includes('login_local'));
  assert.ok(!c.signals.includes('login'));
});

check('одно общее слово в ФИО совпадением не считается', () => {
  const c = lib.scoreCandidate(
    mkEntry({ name: 'Иван Петров' }),
    profile({ display_name: 'Иван Сидоров' }),
    'questionnaire',
  );
  assert.ok(!c.signals.some((s) => s.startsWith('name')));
});

check('близкое время даёт сигнал по нужному этапу', () => {
  const p = profile({ stage1_submitted_at: '2026-08-20T11:32:00Z' });
  const entry = mkEntry({ submittedAt: new Date('2026-08-20T11:30:00Z').getTime() });
  assert.ok(lib.scoreCandidate(entry, p, 'essay').signals.includes('time_exact'));
  // Для анкеты смотрится другая метка — её нет, значит и сигнала нет.
  assert.ok(!lib.scoreCandidate(entry, p, 'questionnaire').signals.some((s) => s.startsWith('time')));

  // Четыре минуты — уже не «точно», но всё ещё близко.
  const looser = mkEntry({ submittedAt: new Date('2026-08-20T11:28:00Z').getTime() });
  assert.ok(lib.scoreCandidate(looser, p, 'essay').signals.includes('time_close'));
});

// ── Время как самостоятельное решение ─────────────────────────
// Половина эссе пришла без имени и без почты: в колонку ФИО попала ссылка.
// Единственная зацепка — отметка «я отправил» на сайте.

check('безымянное эссе с одиноким точным временем расходится само', () => {
  const owner = profile({
    id: 'cccc3333-3333-3333-3333-333333333333',
    display_name: 'Сидорова Анна',
    email: 'sidorova@yandex.ru',
    stage1_submitted_at: '2026-08-20T11:31:00Z',
  });
  const faraway = profile({
    id: 'dddd4444-4444-4444-4444-444444444444',
    display_name: 'Кузнецов Пётр',
    email: 'kuznetsov@yandex.ru',
    stage1_submitted_at: '2026-08-20T18:00:00Z',
  });

  const entries = [mkEntry({ rowNumber: 1, submittedAt: new Date('2026-08-20T11:30:00Z').getTime() })];
  const rows = lib.matchFormEntries(entries, [owner, faraway], 'essay');

  assert.equal(rows[0].best.profileId, owner.id);
  assert.equal(rows[0].confidence, 'confident', 'одинокое совпадение по времени решает само');
});

check('два аккаунта рядом по времени — решает человек', () => {
  const first = profile({
    id: 'cccc3333-3333-3333-3333-333333333333',
    display_name: 'Сидорова Анна',
    email: 'sidorova@yandex.ru',
    stage1_submitted_at: '2026-08-20T11:31:00Z',
  });
  const second = profile({
    id: 'dddd4444-4444-4444-4444-444444444444',
    display_name: 'Кузнецов Пётр',
    email: 'kuznetsov@yandex.ru',
    stage1_submitted_at: '2026-08-20T11:33:00Z',
  });

  const entries = [mkEntry({ rowNumber: 1, submittedAt: new Date('2026-08-20T11:30:00Z').getTime() })];
  const rows = lib.matchFormEntries(entries, [first, second], 'essay');

  assert.equal(rows[0].confidence, 'likely', 'в дедлайн рядом могут отправить двое — не угадываем');
});

check('время ±10 мин подсказывает, но не решает', () => {
  const owner = profile({
    id: 'cccc3333-3333-3333-3333-333333333333',
    display_name: 'Сидорова Анна',
    email: 'sidorova@yandex.ru',
    stage1_submitted_at: '2026-08-20T11:40:00Z',
  });

  const entries = [mkEntry({ rowNumber: 1, submittedAt: new Date('2026-08-20T11:30:00Z').getTime() })];
  const rows = lib.matchFormEntries(entries, [owner], 'essay');

  assert.equal(rows[0].confidence, 'likely', '±10 минут — подсказка, а не доказательство');
  assert.equal(rows[0].best.profileId, owner.id, 'подсказку всё же показываем');
});

check('совсем далёкое время кандидата не создаёт', () => {
  const owner = profile({
    id: 'cccc3333-3333-3333-3333-333333333333',
    stage1_submitted_at: '2026-08-20T15:30:00Z',
  });
  const entries = [mkEntry({ rowNumber: 1, submittedAt: new Date('2026-08-20T11:30:00Z').getTime() })];
  const rows = lib.matchFormEntries(entries, [owner], 'essay');
  assert.equal(rows[0].confidence, 'unmatched');
  assert.equal(rows[0].best, null);
});

// ── Раскладка по корзинам ─────────────────────────────────────
const alice = profile({ id: 'aaaa1111-1111-1111-1111-111111111111', display_name: 'Иванов Иван', email: 'ivanov@yandex.ru' });
const bob = profile({ id: 'bbbb2222-2222-2222-2222-222222222222', display_name: 'Петров Пётр', email: 'petrov@yandex.ru' });

check('точная почта — готово, только ФИО — на подтверждение', () => {
  const entries = [
    mkEntry({ rowNumber: 1, email: 'ivanov@yandex.ru', emailValid: true }),
    mkEntry({ rowNumber: 2, name: 'Петров Петр' }),
  ];
  const rows = lib.matchFormEntries(entries, [alice, bob], 'questionnaire');
  const byRow = new Map(rows.map((r) => [r.entry.rowNumber, r]));

  assert.equal(byRow.get(1).confidence, 'confident');
  assert.equal(byRow.get(1).best.profileId, alice.id);
  assert.equal(byRow.get(2).confidence, 'likely');
  assert.equal(byRow.get(2).best.profileId, bob.id);

  const summary = lib.summarizeMatches(entries, rows, [alice, bob], {});
  assert.deepEqual(
    { ready: summary.ready, needsReview: summary.needsReview, unmatched: summary.unmatched },
    { ready: 1, needsReview: 1, unmatched: 0 },
  );
});

check('один аккаунт не достаётся двум строкам автоматически', () => {
  const entries = [
    mkEntry({ rowNumber: 1, name: 'Иванов Иван' }),
    mkEntry({ rowNumber: 2, name: 'Иванов Иван' }),
  ];
  const rows = lib.matchFormEntries(entries, [alice], 'questionnaire');
  const assigned = rows.filter((r) => r.best).length;
  assert.equal(assigned, 1);
});

check('подтверждение и отказ переводят строку в нужную корзину', () => {
  const entries = [mkEntry({ rowNumber: 1, name: 'Петров Петр' })];
  const rows = lib.matchFormEntries(entries, [alice, bob], 'questionnaire');

  const confirmed = lib.resolveMatch(rows[0], { 1: bob.id });
  assert.deepEqual(
    { profileId: confirmed.profileId, manual: confirmed.manual, ready: confirmed.ready },
    { profileId: bob.id, manual: true, ready: true },
  );

  const refused = lib.resolveMatch(rows[0], { 1: null });
  assert.equal(refused.profileId, null);
  assert.equal(refused.ready, false);
});

check('ручной выбор одного аккаунта на две строки виден как конфликт', () => {
  const entries = [
    mkEntry({ rowNumber: 1, name: 'Иванов Иван' }),
    mkEntry({ rowNumber: 2, name: 'Петров Петр' }),
  ];
  const rows = lib.matchFormEntries(entries, [alice, bob], 'questionnaire');
  const conflicts = lib.conflictingProfileIds(rows, { 1: alice.id, 2: alice.id });
  assert.deepEqual([...conflicts], [alice.id]);
  assert.equal(lib.conflictingProfileIds(rows, {}).size, 0);
});

// ── CSV ───────────────────────────────────────────────────────
check('csv: точка с запятой, кавычки и BOM', () => {
  const parsed = lib.parseCsv('\uFEFFa;b;c\r\n1;"две;части";"кавычка ""тут"""\r\n');
  assert.deepEqual(parsed.headers, ['a', 'b', 'c']);
  assert.deepEqual(parsed.rows, [['1', 'две;части', 'кавычка "тут"']]);
});

check('csv: перевод строки внутри кавычек', () => {
  const parsed = lib.parseCsv('a,b\n1,"первая\nвторая"\n');
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0][1], 'первая\nвторая');
});

// ── Предзаполнение форм ───────────────────────────────────────
check('параметр предзаполнения читается и из ссылки', () => {
  assert.equal(lib.parseOptionalYandexPrefillParam('answer_short_text_12345'), 'answer_short_text_12345');
  assert.equal(
    lib.parseOptionalYandexPrefillParam('https://forms.yandex.ru/u/abc/?answer_short_text_777=xyz'),
    'answer_short_text_777',
  );
  assert.equal(lib.parseOptionalYandexPrefillParam('  '), '');
  assert.equal(lib.parseOptionalYandexPrefillParam('какая-то ерунда'), false);
});

check('код участника попадает в адрес iframe', () => {
  const plain = lib.yandexFormIframeSrc('abcdefghij');
  assert.equal(plain, 'https://forms.yandex.ru/u/abcdefghij?iframe=1');

  const withCode = lib.yandexFormIframeSrc('abcdefghij', {
    param: 'answer_short_text_1',
    value: 'aaaa-bbbb',
  });
  assert.equal(withCode, 'https://forms.yandex.ru/u/abcdefghij?iframe=1&answer_short_text_1=aaaa-bbbb');

  // Выключенная привязка адрес не меняет.
  assert.equal(lib.yandexFormIframeSrc('abcdefghij', { param: '', value: 'x' }), plain);
});

// ── Почта для связи ───────────────────────────────────────────
check('почта для связи важнее адреса аккаунта', () => {
  assert.equal(
    lib.profileContactEmail(profile({ contact_email: 'real@mail.ru' })),
    'real@mail.ru',
  );
  assert.equal(lib.profileContactEmail(profile()), 'ivanov@yandex.ru');
  assert.equal(
    lib.profileContactEmail(profile({ email: 'vasya@id.quantumschool.ru', recovery_email: 'v@mail.ru' })),
    'v@mail.ru',
  );
  assert.equal(lib.profileContactEmail(profile({ email: 'vasya@id.quantumschool.ru' })), null);
});

check('фильтр по известной почте', () => {
  const known = profile({ contact_email: 'real@mail.ru' });
  const unknown = profile({ email: 'vasya@id.quantumschool.ru' });
  const yes = { ...lib.EMPTY_SELECTION_FILTERS, contact: 'yes' };
  const no = { ...lib.EMPTY_SELECTION_FILTERS, contact: 'no' };

  assert.equal(lib.matchesSelectionFilters(known, yes), true);
  assert.equal(lib.matchesSelectionFilters(unknown, yes), false);
  assert.equal(lib.matchesSelectionFilters(known, no), false);
  assert.equal(lib.matchesSelectionFilters(unknown, no), true);
  assert.equal(lib.activeSelectionFilterCount(yes), 1);
});

check('поиск находит по яндекс-логину и почте из анкеты', () => {
  const p = profile({ yandex_login: 'ivanov.ii', contact_email: 'real@mail.ru' });
  const search = (q) => lib.matchesSelectionFilters(p, { ...lib.EMPTY_SELECTION_FILTERS, search: q });
  assert.equal(search('ivanov.ii'), true);
  assert.equal(search('real@mail'), true);
  assert.equal(search('никого'), false);
});

// ── Выгрузка ──────────────────────────────────────────────────
check('csv-выгрузка: колонки на месте, точка с запятой экранируется', () => {
  const csv = lib.buildSelectionCsv([
    profile({ display_name: 'Иванов; Иван', contact_email: 'real@mail.ru', yandex_login: 'ivanov.ii', stage1_score: 0 }),
  ]);
  const [header, row] = csv.trim().split('\r\n');

  assert.equal(header.split(';')[1], 'Почта для связи');
  assert.ok(header.includes('Логин Яндекса'));
  assert.ok(row.startsWith('"Иванов; Иван";real@mail.ru;'));
  // Нулевой балл — это «0», а не пустая ячейка.
  assert.ok(row.split(';').includes('0'));
});

fs.rmSync(bundlePath, { force: true });

// ── Карта участника ───────────────────────────────────────────
check('карта собирает человека из связей, отметок и текущего разбора', () => {

  const profile = (over = {}) => ({
    id: 'p1', display_name: 'Иванов Иван', avatar_url: '', enrolled_course_id: null, bio: '',
    role: 'student', is_enrolled: false, selection_rejected: false,
    stage1_status: 'pending', stage2_status: 'pending', stage1_score: null, stage2_score: null,
    email: 'ivanov@yandex.ru', login: null, yandex_login: null,
    recovery_email: null, contact_email: null,
    privacy_consent_at: null, privacy_policy_version: null,
    questionnaire_submitted_at: null, stage1_submitted_at: null, stage2_submitted_at: null,
    city: null, school: null, grade: null,
    created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
    ...over,
  });

  const link = (over = {}) => ({
    id: 'l1', user_id: 'p1', form_kind: 'questionnaire',
    contact_email: 'real@mail.ru', form_name: 'Иванов Иван',
    form_submitted_at: '2026-08-20T11:30:00Z',
    source_file: 'anketa.xlsx', source_row: 7,
    match_score: 100, match_signals: ['email'],
    confirmed_by: null, created_at: '', updated_at: '',
    ...over,
  });

  // Сохранённая связь.
  {
    const [row] = lib.buildPersonMap([profile({ contact_email: 'real@mail.ru' })], [link()], null);
    assert.equal(row.cells.questionnaire.state, 'linked');
    assert.equal(row.cells.questionnaire.sourceRow, 7);
    assert.deepEqual(row.cells.questionnaire.signals, ['email']);
    assert.equal(row.contactEmail, 'real@mail.ru');
    assert.equal(row.contactSource, 'questionnaire', 'почта из анкеты важнее почты аккаунта');
    assert.equal(row.linkedCount, 1);
  }

  // Отметил отправку на сайте, но ответ не сопоставлен — это не «нет».
  {
    const [row] = lib.buildPersonMap([profile({ stage1_submitted_at: '2026-08-21T10:00:00Z' })], [], null);
    assert.equal(row.cells.essay.state, 'marked_only');
    assert.equal(row.cells.questionnaire.state, 'missing');
    assert.equal(row.linkedCount, 0, 'отметка без связи в готовность не идёт');
  }

  // Незаписанный разбор текущего файла попадает в карту как «не сохранено».
  {
    const pending = {
      kind: 'essay',
      sourceFile: 'essay.xlsx',
      matches: [{
        profileId: 'p1',
        entry: { rowNumber: 3, name: '', email: '', submittedAt: Date.parse('2026-08-20T11:30:00Z') },
        signals: ['time_exact'],
        score: 55,
      }],
      orphans: [],
    };
    const [row] = lib.buildPersonMap([profile()], [], pending);
    assert.equal(row.cells.essay.state, 'pending');
    assert.equal(row.cells.essay.sourceRow, 3);
    assert.equal(row.linkedCount, 1, 'неподтверждённое всё же считается заполненным');
    assert.equal(row.cells.questionnaire.state, 'missing', 'чужая форма не трогается');
  }

  // Сохранённая связь важнее незаписанной по той же форме.
  {
    const pending = {
      kind: 'questionnaire', sourceFile: 'new.xlsx',
      matches: [{ profileId: 'p1', entry: { rowNumber: 99, submittedAt: null }, signals: [], score: 0 }],
      orphans: [],
    };
    const [row] = lib.buildPersonMap([profile()], [link()], pending);
    assert.equal(row.cells.questionnaire.state, 'linked');
    assert.equal(row.cells.questionnaire.sourceRow, 7);
  }

  // Писать некуда.
  {
    const [row] = lib.buildPersonMap(
      [profile({ email: 'nick@id.quantumschool.ru', login: 'nick' })], [], null,
    );
    assert.equal(row.contactEmail, null, 'технический адрес почтой не считается');
    assert.equal(row.contactSource, 'none');

    const query = (patch) => ({ ...lib.EMPTY_PERSON_MAP_QUERY, ...patch });
    assert.ok(lib.matchesPersonMapQuery(row, query({ contact: 'missing' })));
    assert.ok(!lib.matchesPersonMapQuery(
      row,
      query({ selection: { mode: 'done_all', stages: lib.FORM_KINDS } }),
    ));
  }

  // CSV: заголовок, экранирование, раздел сирот.
  {
    const rows = lib.buildPersonMap([profile({ display_name: 'Петров; Иван' })], [link()], null);
    const orphans = [{
      kind: 'essay',
      entry: { rowNumber: 12, name: '', email: '', submittedAt: Date.parse('2026-08-20T11:30:00Z') },
      sourceFile: 'essay.xlsx',
    }];
    const csv = lib.buildPersonMapCsv(rows, orphans);
    const lines = csv.split('\r\n');

    assert.equal(lines[0].split(';')[0], 'Участник');
    assert.equal(
      lines[0].split(';').length,
      6 + 3 * 7 + 3,
      'колонок: базовые + 3 формы по 7 + готовность, решение, регистрация',
    );
    assert.ok(csv.includes('"Петров; Иван"'), 'точка с запятой экранируется');
    assert.ok(csv.includes('Ответы без аккаунта'));
    assert.ok(csv.includes('anketa.xlsx, строка 7'), 'видно, откуда взялась связь');
    assert.ok(csv.includes('почта совпала'), 'причина словами, а не кодом');
  }


});

// ── Сводка по этапам, срезы и сбор почт ───────────────────────
const linkFor = (userId, kind, over = {}) => ({
  id: `l-${userId}-${kind}`,
  user_id: userId,
  form_kind: kind,
  contact_email: null,
  form_name: '',
  form_submitted_at: '2026-08-20T11:30:00Z',
  source_file: 'f.xlsx',
  source_row: 1,
  match_score: 100,
  match_signals: ['email'],
  confirmed_by: null,
  created_at: '',
  updated_at: '',
  ...over,
});

const mapOf = (profiles, links = []) => lib.buildPersonMap(profiles, links, null);
const idsMatching = (rows, patch) => rows
  .filter((row) => lib.matchesPersonMapQuery(row, { ...lib.EMPTY_PERSON_MAP_QUERY, ...patch }))
  .map((row) => row.profile.id);

check('в клетке видны и ответ формы, и то, что отследил сайт', () => {
  const [marked] = mapOf([profile({
    stage1_viewed_at: '2026-08-20T10:00:00Z',
    stage1_submitted_at: '2026-08-21T10:00:00Z',
    stage1_score: 7,
  })]);
  assert.equal(marked.cells.essay.state, 'marked_only');
  assert.equal(marked.cells.essay.marked, true);
  assert.equal(marked.cells.essay.stageScore, 7, 'оценка проверяющего видна в карте');
  assert.ok(lib.describeSiteStage(marked.cells.essay).startsWith('отметил'));

  // Статус «отправлено» без метки времени — всё равно отметка.
  const [byStatus] = mapOf([profile({ stage2_status: 'submitted' })]);
  assert.equal(byStatus.cells.contest.marked, true);
  assert.equal(byStatus.cells.contest.state, 'marked_only');

  // Заходил, но не отправлял — и это тоже видно.
  const [started] = mapOf([profile({ stage1_viewed_at: '2026-08-20T10:00:00Z' })]);
  assert.equal(started.cells.essay.marked, false);
  assert.ok(lib.describeSiteStage(started.cells.essay).startsWith('заходил'));
  assert.equal(lib.describeSiteStage(mapOf([profile()])[0].cells.essay), 'не приступал');
});

check('выполненным считается либо ответ, либо отметка — по выбору', () => {
  const [row] = mapOf([profile({ questionnaire_submitted_at: '2026-08-20T10:00:00Z' })]);
  assert.equal(lib.stageDone(row.cells.questionnaire, 'answer_or_mark'), true);
  assert.equal(lib.stageDone(row.cells.questionnaire, 'answer'), false, 'отметка — ещё не ответ');

  const [linked] = mapOf([profile({ id: 'p1' })], [linkFor('p1', 'questionnaire')]);
  assert.equal(lib.stageDone(linked.cells.questionnaire, 'answer'), true);
});

check('сводка отвечает, сколько людей прошли каждый этап', () => {
  const rows = mapOf(
    [
      profile({ id: 'p1', display_name: 'С ответом' }),
      profile({ id: 'p2', display_name: 'С отметкой', questionnaire_submitted_at: '2026-08-20T10:00:00Z' }),
      profile({ id: 'p3', display_name: 'Ничего' }),
    ],
    [linkFor('p1', 'questionnaire')],
  );

  const [anketa] = lib.tallyStages(rows, 'answer_or_mark');
  assert.equal(anketa.kind, 'questionnaire');
  assert.equal(anketa.total, 3);
  assert.deepEqual(
    { answer: anketa.counts.answer, mark: anketa.counts.mark_only, done: anketa.counts.done, missing: anketa.counts.missing },
    { answer: 1, mark: 1, done: 2, missing: 1 },
  );

  const strict = lib.tallyStages(rows, 'answer')[0];
  assert.equal(strict.counts.done, 1, 'по строгому счёту отметка не в счёт');
  assert.equal(strict.counts.missing, 2);

  // У анкеты нет ни страницы этапа, ни оценки — незачем и строки в сводке.
  assert.deepEqual(lib.stageStatesFor('questionnaire'), ['answer', 'mark_only', 'missing']);
  assert.ok(lib.stageStatesFor('essay').includes('started'));
});

check('срез «не сделал хотя бы один из отмеченных этапов»', () => {
  const rows = mapOf([
    profile({ id: 'p1', display_name: 'Ничего не сдал' }),
    profile({
      id: 'p2',
      display_name: 'Анкета и эссе',
      questionnaire_submitted_at: '2026-08-20T10:00:00Z',
      stage1_submitted_at: '2026-08-20T11:00:00Z',
    }),
  ]);

  const pick = (selection, basis) => idsMatching(rows, { selection, ...(basis ? { basis } : {}) });

  // По умолчанию отметка на сайте не доказывает ничего: сдал тот, чей ответ найден.
  // У p2 только отметки, поэтому по строгому счёту не сдал и он.
  assert.deepEqual(pick({ mode: 'missing_any', stages: ['questionnaire', 'essay'] }), ['p1', 'p2']);
  assert.deepEqual(pick({ mode: 'done_all', stages: ['questionnaire', 'essay'] }), []);

  // Смягчённый счёт — для рассылок: отметившегося не дёргаем.
  const soft = 'answer_or_mark';
  assert.deepEqual(pick({ mode: 'missing_any', stages: ['questionnaire', 'essay'] }, soft), ['p1']);
  assert.deepEqual(pick({ mode: 'done_all', stages: ['questionnaire', 'essay'] }, soft), ['p2']);
  assert.deepEqual(pick({ mode: 'missing_any', stages: ['contest'] }, soft), ['p1', 'p2']);

  assert.deepEqual(pick({ mode: 'stage', kind: 'essay', state: 'missing' }), ['p1', 'p2']);
  assert.deepEqual(pick({ mode: 'stage', kind: 'essay', state: 'mark_only' }), ['p2']);
  // Ни одного отмеченного этапа — фильтр просто не применяется.
  assert.deepEqual(pick({ mode: 'missing_any', stages: [] }), ['p1', 'p2']);

  assert.equal(
    lib.describeSelection({ mode: 'missing_any', stages: ['questionnaire', 'contest'] }),
    'Не выполнили хотя бы один из: Анкета, Контест',
  );
  assert.equal(lib.describeSelection({ mode: 'missing_any', stages: lib.FORM_KINDS }), 'Не выполнили хотя бы один этап');
});

check('карту можно сузить по почте, решению и поиску', () => {
  const rows = mapOf([
    profile({ id: 'p1', contact_email: 'a@b.ru', is_enrolled: true }),
    profile({ id: 'p2', email: 'nick@id.quantumschool.ru', login: 'nick', selection_rejected: true }),
  ]);

  assert.deepEqual(idsMatching(rows, { contact: 'known' }), ['p1']);
  assert.deepEqual(idsMatching(rows, { contact: 'missing' }), ['p2']);
  assert.deepEqual(idsMatching(rows, { verdict: 'accepted' }), ['p1']);
  assert.deepEqual(idsMatching(rows, { verdict: 'rejected' }), ['p2']);
  assert.deepEqual(idsMatching(rows, { text: 'nick' }), ['p2']);
});

check('список почт: без повторов, и видно, кому писать некуда', () => {
  const rows = mapOf([
    profile({ id: 'p1', contact_email: 'Family@mail.ru' }),
    profile({ id: 'p2', contact_email: 'family@mail.ru' }),
    profile({ id: 'p3', email: 'nick@id.quantumschool.ru', login: 'nick' }),
  ]);

  const list = lib.collectEmails(rows);
  assert.deepEqual(list.emails, ['Family@mail.ru'], 'один адрес на двоих — письмо одно');
  assert.equal(list.people, 3);
  assert.equal(list.unreachable.length, 1);
  assert.equal(list.unreachable[0].profile.id, 'p3');
  assert.equal(lib.emailListText(['a@b.ru', 'c@d.ru']), 'a@b.ru, c@d.ru');
});

check('выгрузка списка почт говорит, чего человеку не хватает', () => {
  const rows = mapOf([profile({
    id: 'p1',
    contact_email: 'a@b.ru',
    questionnaire_submitted_at: '2026-08-20T10:00:00Z',
  })]);

  assert.equal(lib.missingStagesLabel(rows[0], 'answer_or_mark'), 'Эссе, Контест');

  const csv = lib.buildEmailListCsv(rows, 'answer_or_mark', { mode: 'missing_any', stages: ['essay'] });
  assert.ok(csv.includes('Не выполнили хотя бы один из: Эссе'), 'в файле написано, какой это срез');
  assert.ok(csv.includes('a@b.ru'));
  assert.ok(csv.includes('Эссе, Контест'), 'в строке видно, каких этапов нет');
});

check('карта видит, что прибавилось с прошлого обновления', () => {
  const before = { profiles: [profile({ id: 'p1' })], links: [] };
  const after = {
    profiles: [
      profile({ id: 'p1', stage1_submitted_at: '2026-08-21T10:00:00Z', stage1_score: 8 }),
      profile({ id: 'p2' }),
    ],
    links: [linkFor('p1', 'essay')],
  };

  const diff = lib.diffSiteData(before, after);
  assert.deepEqual(diff, { people: 1, marks: 1, grades: 1, links: 1 });
  assert.equal(lib.siteDataDiffTotal(diff), 4);
  assert.ok(lib.describeSiteDataDiff(diff).includes('новых участников: 1'));
  assert.equal(lib.siteDataDiffTotal(lib.diffSiteData(after, after)), 0, 'без изменений — нечего сообщать');
});

// ── Ссылка на работу и новые зацепки ──────────────────────────
check('ссылка на работу берётся и из своей колонки, и из поля ФИО', () => {
  const mapping = lib.autoDetectColumns(['Ваше ФИО', 'Мотивационное письмо', 'Время создания']);
  assert.equal(mapping.work, 1, 'колонка с письмом распознаётся сама');
  assert.equal(mapping.name, 0);

  const entries = lib.buildFormEntries(
    table(['Ваше ФИО', 'Мотивационное письмо'], [
      ['Иванов Иван', 'https://disk.yandex.ru/client/disk/a'],
      ['https://disk.yandex.ru/client/disk/b', ''],
      ['Петров Пётр', 'не ссылка'],
    ]),
    mapping,
  );

  assert.equal(entries[0].workUrl, 'https://disk.yandex.ru/client/disk/a');
  assert.equal(entries[1].workUrl, 'https://disk.yandex.ru/client/disk/b',
    'работа, вставленная в поле ФИО, больше не теряется');
  assert.equal(entries[1].name, '', 'ссылка именем по-прежнему не считается');
  assert.equal(entries[2].workUrl, '', 'мусор в колонке работой не считается');
});

check('колонка работы проверяется содержимым, а не только заголовком', () => {
  // «Загрузка решений» в мониторе — вердикт, а не файл: ссылок нет, значит и
  // колонки с работой нет.
  const monitor = lib.autoDetectColumns(
    ['place', 'user_name', 'login', '9(Загрузка решений)'],
    [['1', 'Иванов', 'ivanov', 'OK'], ['2', 'Петров', 'petrov', 'WrongAnswer']],
  );
  assert.equal(monitor.work, null);

  // Заголовок ни о чём не говорит, но в колонке ссылки — это и есть работа.
  const silent = lib.autoDetectColumns(
    ['Ваше ФИО', 'Ответ'],
    [['Иванов Иван', 'https://disk.yandex.ru/client/disk/a']],
  );
  assert.equal(silent.work, 1);
  assert.equal(silent.name, 0, 'колонку ФИО за работу не принимаем');

  // Без строк остаётся догадка по заголовку — разметку всё равно видно глазами.
  assert.equal(lib.autoDetectColumns(['Ваше ФИО', 'Мотивационное письмо']).work, 1);
});

check('почта из анкеты опознаёт человека в следующей форме', () => {
  const p = profile({ email: 'nick@id.quantumschool.ru', login: 'nick', contact_email: 'real@mail.ru' });
  const c = lib.scoreCandidate(mkEntry({ email: 'real@mail.ru', emailValid: true }), p, 'essay');
  assert.ok(c.signals.includes('email'), 'адрес, узнанный из анкеты, — такой же признак');
});

check('ФИО из анкеты работает как имя аккаунта', () => {
  const p = profile({ display_name: 'ivan2010' });
  const entry = mkEntry({ name: 'Иванов Иван Иванович' });

  assert.ok(!lib.scoreCandidate(entry, p, 'essay').signals.some((x) => x.startsWith('name')));

  const aliases = lib.aliasesFromLinks([
    { user_id: p.id, form_name: 'Иванов Иван Иванович', contact_email: 'real@mail.ru' },
    { user_id: p.id, form_name: '' },
  ]);
  assert.deepEqual(aliases.get(p.id).names, ['Иванов Иван Иванович']);
  assert.deepEqual(aliases.get(p.id).emails, ['real@mail.ru'], 'почта из анкеты тоже запоминается');

  const withAlias = lib.scoreCandidate(entry, p, 'essay', aliases.get(p.id));
  assert.ok(withAlias.signals.includes('name_exact'), 'ник аккаунта больше не мешает');

  const rows = lib.matchFormEntries([entry], [p], 'essay', aliases);
  assert.equal(rows[0].best.profileId, p.id);
});

check('карта показывает ссылку на работу и отдаёт её в выгрузке', () => {
  const link = {
    id: 'l1', user_id: 'p1', form_kind: 'essay', contact_email: null,
    form_name: 'Иванов Иван', form_submitted_at: '2026-08-20T11:30:00Z',
    work_url: 'https://disk.yandex.ru/client/disk/a',
    source_file: 'essay.xlsx', source_row: 3, match_score: 55, match_signals: ['time_exact'],
    confirmed_by: null, created_at: '', updated_at: '',
  };

  const [row] = lib.buildPersonMap([profile({ id: 'p1' })], [link], null);
  assert.equal(row.cells.essay.workUrl, 'https://disk.yandex.ru/client/disk/a');
  assert.ok(lib.buildPersonMapCsv([row], []).includes('https://disk.yandex.ru/client/disk/a'));

  // Работа из текущего разбора видна до сохранения.
  const pending = {
    kind: 'essay', sourceFile: 'new.xlsx',
    matches: [{
      profileId: 'p2',
      entry: { rowNumber: 1, submittedAt: null, workUrl: 'https://disk.yandex.ru/client/disk/b' },
      signals: [], score: 0,
    }],
    orphans: [],
  };
  const [draft] = lib.buildPersonMap([profile({ id: 'p2' })], [], pending);
  assert.equal(draft.cells.essay.workUrl, 'https://disk.yandex.ru/client/disk/b');
});

// ── Транслит и подпись в имени файла ──────────────────────────
check('одно имя в разных написаниях сходится', () => {
  assert.equal(lib.compareNames('Кузнецов Иван', 'Kuznetsov Ivan'), 'exact');
  assert.equal(lib.compareNames('Кузнецов Иван', 'Kuznetcov Ivan'), 'exact');
  assert.equal(lib.compareNames('Дмитрий Чехов', 'Dmitriy Chekhov'), 'exact');
  assert.equal(lib.compareNames('Юлия Щербакова', 'Yulia Scherbakova'), 'exact');

  // Кириллица по-прежнему работает как раньше.
  assert.equal(lib.compareNames('Пётр Королёв', 'Королев Петр'), 'exact');
  assert.equal(lib.compareNames('Иванов Иван Иванович', 'Иванов Иван'), 'partial');

  // Однофамильцев не роднит: общее слово должно быть не одно.
  assert.equal(lib.compareNames('Иван Петров', 'Иван Сидоров'), null);
  assert.equal(lib.compareNames('', 'Иванов Иван'), null);
});

check('имя файла достаётся из ссылки и чистится от служебного кода', () => {
  const url = 'https://disk.yandex.ru/client/disk/Yandex.Forms/6a7a100c068ff0b13995f129/Files'
    + '?path=%2FYandex.Forms%2F6a7a100c068ff0b13995f129%2FFiles%2F'
    + '0123456789abcdef01234567Ivanov_Ivan_esse.docx';

  assert.equal(lib.workFileName(url), '0123456789abcdef01234567Ivanov_Ivan_esse.docx');
  assert.equal(lib.workAuthorHint('0123456789abcdef01234567Ivanov_Ivan_esse.docx'), 'Ivanov Ivan esse');
  assert.equal(lib.workFileName('https://disk.yandex.ru/client/disk/Files'), '', 'ссылка без пути — не беда');
  assert.equal(lib.workFileName('не ссылка'), '');

  const [entry] = lib.buildFormEntries(
    table(['Ваше ФИО', 'Мотивационное письмо'], [['', url]]),
    { ...lib.EMPTY_MAPPING, name: 0, work: 1 },
  );
  assert.equal(entry.workName, 'Ivanov Ivan esse');
});

check('подпись в имени файла опознаёт безымянное эссе', () => {
  const p = profile({ display_name: 'Иванов Иван' });
  const entry = mkEntry({ workName: 'Ivanov Ivan esse final' });

  const c = lib.scoreCandidate(entry, p, 'essay');
  assert.ok(c.signals.includes('file_name_partial') || c.signals.includes('file_name_exact'));

  // Файл, названный без имени, никого ни с кем не роднит.
  const noise = lib.scoreCandidate(mkEntry({ workName: 'motivation letter final' }), p, 'essay');
  assert.ok(!noise.signals.some((x) => x.startsWith('file_name')));

  // Когда ФИО в форме есть, имя файла не дублирует сигнал.
  const named = lib.scoreCandidate(
    mkEntry({ name: 'Иванов Иван', workName: 'Ivanov Ivan esse' }), p, 'essay',
  );
  assert.ok(named.signals.includes('name_exact'));
  assert.ok(!named.signals.some((x) => x.startsWith('file_name')));
});

// ── Архив посылок Контеста ────────────────────────────────────
check('архив посылок превращается в список участников', () => {
  const people = readArchive([
    'ivanov.ii-134068138/',
    'ivanov.ii-134068138/1-165188004-No-compiler-OK',
    'ivanov.ii-134068138/1-165188001-No-compiler-WrongAnswer',
    'ivanov.ii-134068138/9-165252878-No-compiler-PresentationError.pdf',
    'Петров Пётр-134186110/',
    'Петров Пётр-134186110/2-165183026-No-compiler-OK',
    'Петров Пётр-134186110/3-165183027-No-compiler-OK',
    'мусор-без-номера/файл',
  ]);

  assert.equal(people.length, 2);
  // Впереди тот, кто сдал больше задач.
  assert.equal(people[0].who, 'Петров Пётр');
  assert.equal(people[0].solved.size, 2);

  const ivanov = people.find((p) => p.participantId === '134068138');
  assert.equal(ivanov.submissions, 3, 'считаем все посылки, не только зачтённые');
  assert.equal(ivanov.solved.size, 1, 'повторная посылка по той же задаче — не вторая задача');
});

check('монитор добавляет к архиву логин и балл', () => {
  const people = readArchive([
    'Петров Пётр-134186110/', 'Петров Пётр-134186110/1-1-No-compiler-OK',
    'vasya.p-134186111/', 'vasya.p-134186111/1-2-No-compiler-OK',
  ]);
  const monitor = new Map([['петров пётр', { login: 'petrov.pp', score: '42' }]]);

  const lines = buildCsv(people, monitor).trim().split(/\r?\n/);
  const rows = lines.slice(1).map((line) => line.split(';'));
  const byName = new Map(rows.map((cells) => [cells[0], cells]));

  assert.deepEqual(lines[0].split(';').slice(0, 2), ['user_name', 'Логин']);
  assert.equal(byName.get('Петров Пётр')[1], 'petrov.pp', 'логин пришёл из монитора');
  assert.equal(byName.get('Петров Пётр')[5], '42');
  assert.equal(byName.get('vasya.p')[1], 'vasya.p', 'подпись-логин сгодится и без монитора');
  assert.equal(byName.get('vasya.p')[5], '', 'вне монитора балла нет — и выдумывать его нечего');
});

// ── Совместный разбор нескольких выгрузок ─────────────────────
check('анкета опознаёт эссе, когда разбираем формы вместе', () => {
  const p = profile({ id: 'p1', display_name: 'ivan2010', email: 'ivan2010@yandex.ru' });
  const anketa = [mkEntry({ rowNumber: 1, email: 'ivan2010@yandex.ru', emailValid: true, name: 'Иванов Иван' })];
  const essay = [mkEntry({ rowNumber: 1, name: 'Иванов Иван' })];

  // Поодиночке: в профиле ник, и эссе не к кому привязать.
  assert.equal(lib.matchFormEntries(essay, [p], 'essay')[0].best, null);

  // Вместе: анкета сошлась по почте, её ФИО стало признаком для эссе.
  const [anketaRows, essayRows] = lib.matchFormSources(
    [{ kind: 'questionnaire', entries: anketa }, { kind: 'essay', entries: essay }],
    [p],
  );
  assert.equal(anketaRows[0].confidence, 'confident');
  assert.equal(essayRows[0].best.profileId, 'p1');
  assert.ok(essayRows[0].best.signals.includes('name_exact'));
});

check('на догадках не учимся', () => {
  const p = profile({ id: 'p1', display_name: 'Иванов Иван', email: 'ivanov@yandex.ru' });
  // Только частичное совпадение ФИО — не повод разносить эту почту по формам.
  const anketa = [mkEntry({ rowNumber: 1, name: 'Иванов Иван Иванович', email: 'levo@mail.ru', emailValid: true })];
  const essay = [mkEntry({ rowNumber: 1, email: 'levo@mail.ru', emailValid: true })];

  const [anketaRows, essayRows] = lib.matchFormSources(
    [{ kind: 'questionnaire', entries: anketa }, { kind: 'essay', entries: essay }],
    [p],
  );

  assert.notEqual(anketaRows[0].confidence, 'confident', 'частичное ФИО решает не само');
  assert.equal(essayRows[0].best, null, 'непроверенная почта в другую форму не уходит');
});

check('карта показывает разбор сразу нескольких файлов', () => {
  const entry = (over) => ({ rowNumber: 1, submittedAt: null, workUrl: '', ...over });
  const rows = lib.buildPersonMap([profile({ id: 'p1' })], [], [
    {
      kind: 'questionnaire', sourceFile: 'anketa.xlsx',
      matches: [{ profileId: 'p1', entry: entry({}), signals: ['email'], score: 100 }],
      orphans: [],
    },
    {
      kind: 'essay', sourceFile: 'essay.xlsx',
      matches: [{ profileId: 'p1', entry: entry({ workUrl: 'https://disk.yandex.ru/a' }), signals: [], score: 50 }],
      orphans: [entry({ rowNumber: 7 })],
    },
  ]);

  assert.equal(rows[0].cells.questionnaire.state, 'pending');
  assert.equal(rows[0].cells.questionnaire.sourceFile, 'anketa.xlsx');
  assert.equal(rows[0].cells.essay.state, 'pending');
  assert.equal(rows[0].cells.essay.workUrl, 'https://disk.yandex.ru/a');
  assert.equal(rows[0].linkedCount, 2);

  const orphans = lib.buildOrphanAnswers([
    { kind: 'essay', sourceFile: 'essay.xlsx', matches: [], orphans: [entry({ rowNumber: 7 })] },
  ]);
  assert.equal(orphans.length, 1);
  assert.equal(orphans[0].kind, 'essay');
});

console.log(`ок: ${checks} проверок`);
