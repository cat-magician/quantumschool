/**
 * Проверки логики сопоставления форм и связанных с ней утилит.
 * Данные синтетические, файлы не нужны:
 *   node scripts/test-matching.mjs
 */

import { build } from 'esbuild';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

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
      export * from '../src/lib/contestArchive';
      export * from '../src/lib/contestReview';
      export * from '../src/lib/contestClock';
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
const pending = [];
function check(name, fn) {
  // Асинхронные проверки дожидаемся в конце: иначе упавшая проверка
  // вылетела бы уже после итогового «ок».
  const result = fn();
  if (result && typeof result.then === 'function') pending.push(result);
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

check('почта и единственное полное ФИО решают сами, однофамильцы — нет', () => {
  const entries = [
    mkEntry({ rowNumber: 1, email: 'ivanov@yandex.ru', emailValid: true }),
    mkEntry({ rowNumber: 2, name: 'Петров Петр' }),
  ];
  const rows = lib.matchFormEntries(entries, [alice, bob], 'questionnaire');
  const byRow = new Map(rows.map((r) => [r.entry.rowNumber, r]));

  assert.equal(byRow.get(1).confidence, 'confident');
  assert.equal(byRow.get(1).best.profileId, alice.id);
  assert.equal(byRow.get(2).confidence, 'confident', 'ФИО совпало целиком, и больше никто не подходит');
  assert.equal(byRow.get(2).best.profileId, bob.id);

  const summary = lib.summarizeMatches(entries, rows, [alice, bob], {});
  assert.deepEqual(
    { ready: summary.ready, needsReview: summary.needsReview, unmatched: summary.unmatched },
    { ready: 2, needsReview: 0, unmatched: 0 },
  );

  // Двое с одинаковым ФИО — угадывать нельзя, решает человек.
  const twin = profile({ id: 'cccc3333-3333-3333-3333-333333333333', display_name: 'Петров Пётр', email: 'petrov2@yandex.ru' });
  const [row] = lib.matchFormEntries([mkEntry({ rowNumber: 1, name: 'Петров Петр' })], [bob, twin], 'questionnaire');
  assert.equal(row.confidence, 'likely');
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
    assert.equal(row.cells.questionnaire.answerName, 'Иванов Иван', 'в клетке видно, кто подписал ответ');
  }

  // Контест: кто привязан — имя в Контесте, а без него хотя бы номер участника.
  {
    const [row] = lib.buildPersonMap([profile()], [
      link({ id: 'l2', form_kind: 'contest', form_name: 'vbourlak', answer_key: 'id:134162172' }),
    ], null);
    assert.equal(row.cells.contest.answerName, 'vbourlak');
    assert.equal(lib.answerLabel('', 'id:134162172'), '№134162172');
    assert.equal(lib.answerLabel('  ', 'legacy:p1'), null, 'служебный ключ за подпись не выдаём');
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
      6 + 3 * 9 + 3,
      'колонок: базовые + 3 формы по 9 + готовность, решение, регистрация',
    );
    assert.ok(lines[0].includes('Анкета: кто в форме'));
    assert.ok(lines[1].includes('Иванов Иван'), 'видно, чей ответ привязан');
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
  const people = lib.readContestArchive([
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
  const people = lib.readContestArchive([
    'Петров Пётр-134186110/', 'Петров Пётр-134186110/1-1-No-compiler-OK',
    'vasya.p-134186111/', 'vasya.p-134186111/1-2-No-compiler-OK',
  ]);
  const monitor = table(
    ['place', 'user_name', 'login', '1(Встреча)', 'Score'],
    [
      ['1', 'Петров Пётр', 'petrov.pp', 'OK', '42'],
      // В мониторе есть, в архиве нет — не теряем.
      ['2', 'Сидоров', 'sidorov', '', '0'],
    ],
  );
  assert.ok(lib.looksLikeContestMonitor(monitor));

  const merged = lib.mergeContest(people, monitor);
  const byName = new Map(merged.rows.map((cells) => [cells[0], cells]));

  assert.deepEqual(merged.headers.slice(0, 2), ['user_name', 'Логин']);
  assert.equal(byName.get('Петров Пётр')[1], 'petrov.pp', 'логин пришёл из монитора');
  assert.equal(byName.get('Петров Пётр')[5], '42');
  assert.equal(byName.get('vasya.p')[1], 'vasya.p', 'подпись-логин сгодится и без монитора');
  assert.equal(byName.get('vasya.p')[5], '', 'вне монитора балла нет — и выдумывать его нечего');
  assert.equal(byName.get('Сидоров')[1], 'sidorov');

  // Сайт размечает склейку сам: подпись — в ФИО, логин — в логин.
  const mapping = lib.autoDetectColumns(merged.headers, merged.rows);
  assert.equal(merged.headers[mapping.name], 'user_name');
  assert.equal(merged.headers[mapping.login], 'Логин');
});

/** Оглавление zip без самих файлов: для чтения имён больше ничего не нужно. */
function fakeZip(names, { utf8 = false } = {}) {
  // cp866: кириллица без флага UTF-8, как её пишет Контест.
  const cp866 = (text) => Uint8Array.from([...text].map((ch) => {
    const code = ch.charCodeAt(0);
    if (code < 0x80) return code;
    if (ch >= 'А' && ch <= 'П') return 0x80 + code - 0x410;
    if (ch >= 'Р' && ch <= 'Я') return 0x90 + code - 0x420;
    if (ch >= 'а' && ch <= 'п') return 0xa0 + code - 0x430;
    if (ch >= 'р' && ch <= 'я') return 0xe0 + code - 0x440;
    if (ch === 'Ё') return 0xf0;
    if (ch === 'ё') return 0xf1;
    throw new Error(`нет в cp866: ${ch}`);
  }));

  const records = names.map((name) => {
    const raw = utf8 ? new TextEncoder().encode(name) : cp866(name);
    const header = new DataView(new ArrayBuffer(46));
    header.setUint32(0, 0x02014b50, true);
    header.setUint16(8, utf8 ? 0x800 : 0, true);
    header.setUint16(28, raw.length, true);
    return [new Uint8Array(header.buffer), raw];
  }).flat();

  const size = records.reduce((n, part) => n + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(10, names.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, 0, true);

  return new Blob([...records, new Uint8Array(end.buffer)]);
}

check('имена из архива читаются и в cp866, и в UTF-8', async () => {
  const names = ['Петров Пётр-134186110/', 'Петров Пётр-134186110/1-1-No-compiler-OK'];
  assert.deepEqual(await lib.readZipNames(fakeZip(names)), names, 'Контест пишет кириллицу в cp866');
  assert.deepEqual(await lib.readZipNames(fakeZip(names, { utf8: true })), names);
  assert.ok(lib.looksLikeContestArchive(names));
  assert.ok(!lib.looksLikeContestArchive(['xl/workbook.xml', 'xl/worksheets/sheet1.xml']), 'xlsx — не архив посылок');
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

// ── Занятые аккаунты, подпись чужим именем, фамилии в файлах, повторы ─
const ESSAY_URL = (file) => 'https://disk.yandex.ru/client/disk/Yandex.Forms/x/Files?path='
  + encodeURIComponent(`/Yandex.Forms/x/Files/0123456789abcdef01234567${file}`);

check('мусор в поле ФИО именем не считается', () => {
  const entries = lib.buildFormEntries(
    table(['Ваше ФИО'], [['<h'], ['Иванов Иван'], ['Кирилл']]),
    { ...lib.EMPTY_MAPPING, name: 0 },
  );
  assert.deepEqual(entries.map((e) => e.name), ['', 'Иванов Иван', 'Кирилл']);

  assert.equal(lib.isRealName('Иванов Иван'), true);
  assert.equal(lib.isRealName('ivan2010'), false, 'ник — не имя');
  assert.equal(lib.isRealName('А _'), false);
});

check('один файл, отправленный дважды за минуту, — это один человек', () => {
  const same = ESSAY_URL('_motivatsionnoe_pismo_v_kvantovyii_krzhok.pdf');
  const entries = lib.buildFormEntries(
    table(['Ваше ФИО', 'Мотивационное письмо', 'Время создания'], [
      ['<h', same, '2026-09-17 21:49:00'],
      ['Брызгалов Ярослав Кириллович', same, '2026-09-17 21:50:00'],
      // Та же «motivatsionnoe_pismo.docx» у разных людей через часы — не повтор.
      ['Райвид Денис', ESSAY_URL('_motivatsionnoe_pismo.docx'), '2026-08-20 11:45:00'],
      ['', ESSAY_URL('_motivatsionnoe_pismo.docx'), '2026-08-20 19:18:00'],
    ]),
    { ...lib.EMPTY_MAPPING, name: 0, work: 1, submittedAt: 2 },
  );

  assert.equal(entries[0].supersededBy, 2, 'ранняя отправка ушла в повтор');
  assert.equal(entries[1].supersededBy, undefined);
  assert.equal(entries[2].supersededBy, undefined, 'одинаковое имя файла через часы — разные люди');
  assert.equal(entries[3].supersededBy, undefined);
});

check('повтор не склеивает двух разных подписавшихся', () => {
  const same = ESSAY_URL('_esse.docx');
  const entries = lib.buildFormEntries(
    table(['Ваше ФИО', 'Мотивационное письмо', 'Время создания'], [
      ['Иванов Иван', same, '2026-09-07 19:30:00'],
      ['Петров Пётр', same, '2026-09-07 19:37:00'],
    ]),
    { ...lib.EMPTY_MAPPING, name: 0, work: 1, submittedAt: 2 },
  );
  assert.ok(entries.every((e) => !e.supersededBy));
});

check('фамилия находится и в склеенном имени файла', () => {
  const larionov = profile({ id: 'p1', display_name: 'Ларионов Андрей' });
  const glued = lib.scoreCandidate(mkEntry({ workName: 'esselarionovandrej' }), larionov, 'essay');
  assert.ok(glued.signals.includes('file_name_exact'), 'фамилия и имя внутри одного слова');

  const golubtsov = profile({ id: 'p2', display_name: 'Голубцов Владимир' });
  const lone = lib.scoreCandidate(
    mkEntry({ workName: 'esse kvantovyie tehnologii golubtsov' }), golubtsov, 'essay',
  );
  assert.ok(lone.signals.includes('file_name_partial'), 'одной длинной фамилии хватает на подсказку');

  // Частое имя в названии файла никого не выделяет.
  const aleksandr = profile({ id: 'p3', display_name: 'Смирнов Александр' });
  const common = lib.scoreCandidate(mkEntry({ workName: 'pismo aleksandr' }), aleksandr, 'essay');
  assert.ok(!common.signals.some((s) => s.startsWith('file_name')));

  // «novyij dokument» — не «Новик».
  const novik = profile({ id: 'p4', display_name: 'Новик Илья' });
  const doc = lib.scoreCandidate(mkEntry({ workName: 'novyij dokument' }), novik, 'essay');
  assert.ok(!doc.signals.some((s) => s.startsWith('file_name')));
});

check('подписанное чужим именем не предлагается по одному времени', () => {
  const ivanov = profile({
    id: 'p1', display_name: 'Иванов Иван', stage1_submitted_at: '2026-08-20T11:31:00Z',
  });
  const entry = mkEntry({ name: 'Петров Пётр', submittedAt: Date.parse('2026-08-20T11:30:00Z') });

  const c = lib.scoreCandidate(entry, ivanov, 'essay');
  assert.ok(c.signals.includes('name_conflict'));
  assert.ok(c.score < 25, 'точное время не вытягивает чужую подпись даже в подсказки');

  const [row] = lib.matchFormEntries([entry], [ivanov], 'essay');
  assert.equal(row.best, null);
});

check('уменьшительное имя и ник противоречием не считаются', () => {
  const liza = profile({ id: 'p1', display_name: 'Шишкина Елизавета' });
  const c = lib.scoreCandidate(mkEntry({ name: 'Лиза Шишкина' }), liza, 'essay');
  assert.ok(!c.signals.includes('name_conflict'), 'общая фамилия — не противоречие');

  const nick = profile({ id: 'p2', display_name: 'ivan2010' });
  const n = lib.scoreCandidate(mkEntry({ name: 'Иванов Иван' }), nick, 'essay');
  assert.ok(!n.signals.includes('name_conflict'), 'ник не может противоречить ФИО');
});

check('почта при чужой подписи решает только вместе с человеком', () => {
  const sibling = profile({ id: 'p1', display_name: 'Иванова Мария', email: 'parent@mail.ru' });
  const entry = mkEntry({ name: 'Иванов Пётр Сергеевич', email: 'parent@mail.ru', emailValid: true });
  const [row] = lib.matchFormEntries([entry], [sibling], 'questionnaire');

  assert.equal(row.best.profileId, 'p1');
  assert.equal(row.confidence, 'likely', 'братья и сёстры на одном адресе — решать человеку');
});

check('аккаунт с сохранённым ответом не предлагается как свободный', () => {
  const owner = profile({
    id: 'owner', display_name: 'Райвид Денис', stage1_submitted_at: '2026-08-20T11:45:00Z',
  });
  const other = profile({
    id: 'other', display_name: 'Сидорова Анна', stage1_submitted_at: '2026-08-20T19:18:00Z',
  });

  const taken = lib.takenSlotsFromLinks([{
    user_id: 'owner', form_kind: 'essay',
    work_url: ESSAY_URL('_motivatsionnoe_pismo.docx'),
    form_submitted_at: '2026-08-20T11:45:31Z', form_name: '',
    source_file: 'essay.xlsx', source_row: 1,
  }], 'essay');

  const saved = mkEntry({
    rowNumber: 1, submittedAt: Date.parse('2026-08-20T11:45:31Z'),
    workUrl: ESSAY_URL('_motivatsionnoe_pismo.docx'),
  });
  // Другая работа по времени близка к отметке владельца — но он уже занят.
  const fresh = mkEntry({ rowNumber: 2, submittedAt: Date.parse('2026-08-20T11:46:10Z') });

  const rows = lib.matchFormEntries([saved, fresh], [owner, other], 'essay', undefined, taken);
  const byRow = new Map(rows.map((r) => [r.entry.rowNumber, r]));

  assert.equal(byRow.get(1).savedFor, 'owner', 'повторно загруженный ответ узнан как сохранённый');
  assert.equal(byRow.get(2).best, null, 'занятого владельца другой строке не отдаём');
  assert.equal(byRow.get(2).busy[0].profileId, 'owner', 'но показываем, на кого строка похожа');
});

check('та же отправка узнаётся и без файла — по моменту и почте', () => {
  const saved = {
    profileId: 'p1', workUrl: null, submittedAt: Date.parse('2026-08-20T11:30:41Z'),
    name: 'Райвид Денис Максимович', email: 'raivid@mail.ru', sourceFile: 'anketa.xlsx', sourceRow: 1,
  };
  const same = mkEntry({
    submittedAt: Date.parse('2026-08-20T11:30:41Z'), email: 'raivid@mail.ru', emailValid: true,
  });
  const other = mkEntry({
    submittedAt: Date.parse('2026-08-20T11:30:41Z'), email: 'someone@mail.ru', emailValid: true,
  });
  assert.equal(lib.sameAnswer(same, saved), true);
  assert.equal(lib.sameAnswer(other, saved), false, 'в ту же секунду мог отправить и другой');
});

// ── Версии: у человека бывает несколько отправок, и все они его ──────
check('номер ответа из колонки ID — ключ отправки', () => {
  const mapping = lib.autoDetectColumns(['ID', 'Время создания', 'Ваше ФИО'], [['2490001234', '', '']]);
  assert.equal(mapping.answerId, 0);
  const [entry] = lib.buildFormEntries(
    table(['ID', 'Ваше ФИО'], [['2490001234', 'Иванов Иван']]),
    { ...lib.EMPTY_MAPPING, answerId: 0, name: 1 },
  );
  assert.equal(entry.answerKey, 'id:2490001234');

  // Склейка архива с монитором размечается сама: ID участника — тоже ключ.
  const contest = lib.autoDetectColumns(lib.CONTEST_HEADERS, [['vbourlak', 'vbourlak', '134162172', '9', '5', '42']]);
  assert.equal(lib.CONTEST_HEADERS[contest.answerId], 'ID в Контесте');
});

check('повторные отправки собираются в одну строку со всеми версиями', () => {
  const p = profile({ id: 'p1', display_name: 'Иванов Иван', email: 'ivanov@yandex.ru' });
  const entries = lib.buildFormEntries(
    table(['ID', 'Ваша почта', 'Время создания'], [
      ['1', 'ivanov@yandex.ru', '2026-09-01 10:00:00'],
      ['2', 'ivanov@yandex.ru', '2026-09-03 12:00:00'],
    ]),
    { ...lib.EMPTY_MAPPING, answerId: 0, email: 1, submittedAt: 2 },
  );
  const [row] = lib.matchFormEntries(entries, [p], 'questionnaire');

  assert.equal(row.best.profileId, 'p1');
  assert.deepEqual(row.versions.map((v) => v.answerKey), ['id:2', 'id:1'], 'последняя первой, старая не выброшена');
});

check('контест без времени узнаётся по подписи при повторной загрузке', () => {
  const burlak = profile({ id: 'p1', display_name: 'Вячеслав Бурлак', yandex_login: 'vbourlak' });
  // Связь сохранена раньше, ещё без ключа — так было до версий.
  const taken = lib.takenSlotsFromLinks([{
    user_id: 'p1', form_kind: 'contest', form_submitted_at: null, form_name: 'vbourlak',
    source_file: 'monitor.csv', source_row: 3,
  }], 'contest');

  const entry = mkEntry({ name: 'vbourlak', login: 'vbourlak', answerKey: 'id:134162172' });
  const [row] = lib.matchFormEntries([entry], [burlak], 'contest', undefined, taken);

  assert.equal(row.savedFor, 'p1', 'это тот же ответ, а не «не найден»');
  assert.equal(row.busy.length, 0);
});

check('твёрдый довод добавляет версию к уже сохранённому человеку', () => {
  const smolin = profile({ id: 'p1', display_name: 'Nickolay Smolin', yandex_login: 'tattybel' });
  const taken = lib.takenSlotsFromLinks([{
    user_id: 'p1', form_kind: 'contest', answer_key: 'id:111', form_submitted_at: null,
    form_name: 'tattybel', source_file: 'old.csv', source_row: 1,
  }], 'contest');

  // Другая отправка того же человека: ключ другой, но логин совпал.
  const entry = mkEntry({ name: 'Смолин Николай Игоревич', login: 'tattybel', answerKey: 'id:222' });
  const [row] = lib.matchFormEntries([entry], [smolin], 'contest', undefined, taken);

  assert.equal(row.savedFor, null);
  assert.equal(row.best.profileId, 'p1');
  assert.equal(row.addsVersion, true, 'добавится ещё одной версией, сохранённое не трогаем');
  assert.equal(row.confidence, 'confident');
});

check('слабый довод к занятому аккаунту не ведёт, но виден', () => {
  const owner = profile({
    id: 'p1', display_name: 'Райвид Денис', stage1_submitted_at: '2026-08-20T11:45:00Z',
  });
  const taken = lib.takenSlotsFromLinks([{
    user_id: 'p1', form_kind: 'essay', answer_key: 'id:1', form_submitted_at: '2026-08-20T11:45:31Z',
    form_name: '', source_file: 'essay.xlsx', source_row: 1,
  }], 'essay');

  const stranger = mkEntry({ answerKey: 'id:5', submittedAt: Date.parse('2026-08-20T11:46:10Z') });
  const [row] = lib.matchFormEntries([stranger], [owner], 'essay', undefined, taken);

  assert.equal(row.best, null, 'по одному времени чужую работу к занятому не везём');
  assert.equal(row.busy[0].profileId, 'p1', 'но показываем, на кого похоже');
});

check('новая отправка сохранённого человека попадает в его строку', () => {
  const p = profile({ id: 'p1', display_name: 'Брызгалов Ярослав', email: 'b@mail.ru' });
  const taken = lib.takenSlotsFromLinks([{
    user_id: 'p1', form_kind: 'questionnaire', answer_key: 'id:1', form_submitted_at: '2026-09-01T10:00:00Z',
    form_name: 'Брызгалов Ярослав', contact_email: 'b@mail.ru', source_file: 'a.xlsx', source_row: 1,
  }], 'questionnaire');

  const entries = lib.buildFormEntries(
    table(['ID', 'Ваша почта', 'Время создания'], [
      ['1', 'b@mail.ru', '2026-09-01 13:00:00'],
      ['7', 'b@mail.ru', '2026-09-05 13:00:00'],
    ]),
    { ...lib.EMPTY_MAPPING, answerId: 0, email: 1, submittedAt: 2 },
  );
  const [row] = lib.matchFormEntries(entries, [p], 'questionnaire', undefined, taken);

  assert.equal(row.savedFor, 'p1', 'группа узнана по сохранённой версии');
  assert.equal(row.versions.length, 2, 'и новая отправка в ней же — сохранится версией');
});

// ── Проверка честности контеста ─────────────────────────────────────
const sub = (who, pid, task, sid, verdict = 'OK', answer = '1', extension = '') => ({
  who, participantId: pid, task, submissionId: sid, verdict, extension, size: answer ? answer.length : 50000,
  answer: extension ? null : answer,
});

check('подпись-абракадабра и обезличенная узнаются, обычные логины — нет', () => {
  assert.ok(lib.looksLikeGibberish('Lkhxkhxkgxkgx'));
  assert.ok(lib.looksLikeGibberish('Jekebdk-difzyfkodbdjd'));
  for (const normal of ['pischalnikovtp', 'vbourlak', 'kirill.pingvinovitch', 'steblevets.a', 'NapoleonBonpart', 'daniilkandaurov1']) {
    assert.ok(!lib.looksLikeGibberish(normal), `${normal} — обычный логин`);
  }
  assert.ok(lib.looksFaceless('Пользователь Q.'));
  assert.ok(!lib.looksFaceless('Пользователева Анна'));
});

check('проверка находит второй аккаунт, спешку без выкладок и честных', () => {
  const subs = [];
  // Пятеро честных: решают 8 задач в обычном темпе и загружают решения.
  for (let p = 0; p < 5; p++) {
    for (let t = 1; t <= 8; t++) subs.push(sub(`Честный ${p}`, `10${p}`, t, 100000 + p * 50000 + t * 1000));
    subs.push(sub(`Честный ${p}`, `10${p}`, 9, 100000 + p * 50000 + 9000, 'PresentationError', '', 'pdf'));
  }
  // Спешка: восемь верных ответов подряд, решений нет.
  for (let t = 1; t <= 8; t++) subs.push(sub('Быстрый', '200', t, 700000 + t * 10));
  // Тень: по всем задачам сдаёт через пару номеров после первого честного.
  for (let t = 1; t <= 8; t++) subs.push(sub('Пользователь Q.', '300', t, 100000 + t * 1000 + 50));

  const reviews = lib.reviewContest(subs);

  const fast = reviews.get('200');
  assert.equal(fast.level, 'suspicious');
  assert.ok(fast.findings.some((f) => f.includes('быстрее обычного')));
  assert.ok(fast.findings.some((f) => f.includes('решений нет')));

  const shadow = reviews.get('300');
  assert.equal(shadow.level, 'suspicious');
  assert.ok(shadow.findings.some((f) => f.includes('следом за «Честный 0»')));
  assert.deepEqual(shadow.linkedTo, ['100']);
  assert.ok(reviews.get('100').findings.some((f) => f.includes('второй ли это его аккаунт')));

  assert.equal(reviews.get('101').level, 'clean');
  assert.match(reviews.get('101').comment, /похоже на честное/);
});

check('задачи с файлами решений не путаются с ответами', () => {
  const subs = [
    sub('Иванов', '1', 1, 1000), sub('Иванов', '1', 2, 2000),
    sub('Иванов', '1', 9, 3000, 'PresentationError', '', 'pdf'),
    sub('Иванов', '1', 10, 4000, 'PresentationError', '', 'jpg'),
  ];
  const [review] = lib.reviewContest(subs).values();
  assert.ok(!review.findings.some((f) => f.includes('решений нет')), 'файлы решений загружены');
});

check('склейка с монитором несёт итог проверки', () => {
  const people = lib.readContestArchive(['Иванов-100000/', 'Иванов-100000/1-1-No-compiler-OK']);
  const reviews = new Map([['100000', { participantId: '100000', who: 'Иванов', level: 'questions', comment: 'Предположение: есть вопросы.', findings: ['x'], linkedTo: [] }]]);
  const merged = lib.mergeContest(people, null, reviews);
  const at = merged.headers.indexOf('Комментарий проверки');
  assert.ok(at > 0);
  assert.equal(merged.rows[0][at], 'Предположение: есть вопросы.');
  assert.equal(merged.rows[0][merged.headers.indexOf('Проверка')], 'есть вопросы');
});

check('служебные аккаунты не участвуют в проверке и никого не подставляют', () => {
  const subs = [];
  for (let p = 0; p < 5; p++) {
    for (let t = 1; t <= 8; t++) subs.push(sub(`Честный ${p}`, `10${p}`, t, 100000 + p * 50000 + t * 1000));
    subs.push(sub(`Честный ${p}`, `10${p}`, 9, 100000 + p * 50000 + 9000, 'PresentationError', '', 'pdf'));
  }
  // Организатор проверял задачи следом за участником.
  for (let t = 1; t <= 8; t++) subs.push(sub('Пользователь Q.', '300', t, 100000 + t * 1000 + 50));
  subs.push(sub('quantumchallenge@rqc.ru', '400', 1, 999999, 'WrongAnswer', '0'));

  const marked = lib.reviewContest(subs, new Set(['пользователь q.']));
  assert.equal(marked.get('300').level, 'staff');
  assert.equal(marked.get('400').level, 'staff', 'подпись школы узнаётся сама');
  assert.equal(marked.get('100').level, 'clean', 'участник больше не подозревается из-за организатора');

  // Без пометки тот же организатор выглядел бы вторым аккаунтом.
  assert.notEqual(lib.reviewContest(subs).get('100').level, 'clean');
});

// ── Время посылок контеста: даты внутри решений и сквозные номера ────
/**
 * Настоящий zip: локальные заголовки, данные, оглавление. Штамп файлов —
 * по Москве, как у Контеста; `deflate` сжимает запись, как это делает он.
 */
function realZip(files, builtAt = Date.UTC(2026, 8, 22, 19, 31, 20)) {
  const msk = new Date(builtAt + 3 * 3600_000);
  const time = (msk.getUTCHours() << 11) | (msk.getUTCMinutes() << 5) | (msk.getUTCSeconds() >> 1);
  const date = ((msk.getUTCFullYear() - 1980) << 9) | ((msk.getUTCMonth() + 1) << 5) | msk.getUTCDate();
  const parts = [];
  const central = [];
  let offset = 0;

  for (const { name, data, deflate = false } of files) {
    const nameBytes = new TextEncoder().encode(name);
    const raw = typeof data === 'string' ? Buffer.from(data, 'latin1') : data;
    const body = deflate ? zlib.deflateRawSync(raw) : raw;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(6, 0x800, true);
    local.setUint16(8, deflate ? 8 : 0, true);
    local.setUint32(18, body.length, true);
    local.setUint32(22, raw.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, body);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(8, 0x800, true);
    entry.setUint16(10, deflate ? 8 : 0, true);
    entry.setUint16(12, time, true);
    entry.setUint16(14, date, true);
    entry.setUint32(20, body.length, true);
    entry.setUint32(24, raw.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), nameBytes);
    offset += 30 + nameBytes.length + body.length;
  }

  const size = central.reduce((n, part) => n + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)]);
}

check('даты внутри PDF и фото читаются только с часовым поясом', () => {
  assert.equal(lib.pdfMadeAt('<< /ModDate (D:20260916121217Z) >>'), Date.UTC(2026, 8, 16, 12, 12, 17));
  assert.equal(
    lib.pdfMadeAt("/CreationDate (D:20260916151217+03'00')"),
    Date.UTC(2026, 8, 16, 12, 12, 17),
    'московское время приводится к UTC',
  );
  assert.equal(lib.pdfMadeAt('/ModDate (D:20260916121217)'), null, 'без пояса неизвестно, чьё это время');
  assert.equal(
    lib.pdfMadeAt('<xmp:ModifyDate>2026-09-16T15:12:17+03:00</xmp:ModifyDate>'),
    Date.UTC(2026, 8, 16, 12, 12, 17),
  );
  // Из нескольких дат — поздняя: посылка не раньше последней правки.
  assert.equal(
    lib.pdfMadeAt('/CreationDate (D:20260920185552Z) /ModDate (D:20260920190424Z)'),
    Date.UTC(2026, 8, 20, 19, 4, 24),
  );

  assert.equal(
    lib.photoMadeAt('Exif\0\0...2026:09:18 14:54:10\0...+03:00\0'),
    Date.UTC(2026, 8, 18, 11, 54, 10),
  );
  assert.equal(lib.photoMadeAt('Exif\0\0...2026:09:18 14:54:10\0'), null, 'часы камеры без пояса — не опора');
});

check('архив отдаёт даты решений и момент сборки', async () => {
  const folder = 'Иванов Иван-134000001';
  // Дата в самом конце большого PDF: распаковка кусками её не теряет.
  const pdf = `%PDF-1.4\n${'x'.repeat(300_000)}\n1 0 obj << /Producer (iLovePDF) /ModDate (D:20260916121217Z) >>\n%%EOF`;
  const photo = `\xFF\xD8\xFF\xE1Exif\0\0MM${'\0'.repeat(40)}2026:09:18 14:54:10\0+03:00\0${'\x55'.repeat(200_000)}`;
  const inner = new Uint8Array(await realZip([{
    name: 'docProps/core.xml',
    data: '<cp:coreProperties><dcterms:created xsi:type="dcterms:W3CDTF">2026-09-16T19:00:00Z</dcterms:created>'
      + '<dcterms:modified xsi:type="dcterms:W3CDTF">2026-09-16T19:10:00Z</dcterms:modified></cp:coreProperties>',
    deflate: true,
  }]).arrayBuffer());

  const archive = realZip([
    { name: `${folder}/`, data: '' },
    { name: `${folder}/1-165784500-No-compiler-OK`, data: '42', deflate: true },
    { name: `${folder}/9-165784583-No-compiler-PresentationError.pdf`, data: pdf, deflate: true },
    { name: `${folder}/10-165784598-No-compiler-PresentationError.jpg`, data: photo },
    { name: `${folder}/11-165816107-No-compiler-PresentationError.docx`, data: inner, deflate: true },
  ]);

  const subs = await lib.readContestSubmissions(archive);
  const byTask = new Map(subs.map((s) => [s.task, s]));
  assert.equal(byTask.get(1).answer, '42');
  assert.equal(byTask.get(1).madeAt, null, 'у ответа числом даты нет');
  assert.equal(byTask.get(9).madeAt, Date.UTC(2026, 8, 16, 12, 12, 17), 'PDF');
  assert.equal(byTask.get(10).madeAt, Date.UTC(2026, 8, 18, 11, 54, 10), 'фото');
  assert.equal(byTask.get(11).madeAt, Date.UTC(2026, 8, 16, 19, 10, 0), 'docx — по последней правке');

  assert.equal(await lib.readArchiveBuiltAt(archive), Date.UTC(2026, 8, 22, 19, 31, 20), 'штамп архива — по Москве');
});

const MIN = 60_000;
/** 10:00 по Москве: днём весь час весит одинаково, и шкала линейна. */
const T0 = Date.UTC(2026, 8, 16, 7, 0, 0);
const anchor = (submissionId, at, kind = 'file', participantId = String(submissionId)) => ({
  submissionId, at, kind, participantId,
});

check('шкала читает время между опорами и не ведётся на плохие', () => {
  const good = [anchor(1000, T0), anchor(2000, T0 + 60 * MIN), anchor(3000, T0 + 120 * MIN), anchor(4000, T0 + 180 * MIN)];
  const clock = lib.fitContestClock(good);
  assert.ok(Math.abs(clock.read(1500).at - (T0 + 30 * MIN)) < 1000, 'середина между опорами');

  // Фото сняли за три часа до отправки, «я отправил» нажали назавтра.
  const stale = anchor(2990, T0 - 60 * MIN, 'file', 'photo');
  const late = anchor(2500, T0 + 20 * 60 * MIN, 'mark', 'late');
  const noisy = lib.fitContestClock([...good, stale, late]);
  assert.equal(noisy.rejected, 2);
  assert.ok(noisy.anchors.every((a) => a.participantId !== 'photo' && a.participantId !== 'late'));
  assert.ok(Math.abs(noisy.read(2500).at - (T0 + 90 * MIN)) < 1000, 'шкала та же, что без них');

  // За краями — экстраполяция, и ошибка там честно больше.
  assert.ok(noisy.read(6000).error > noisy.read(2500).error);
  assert.ok(noisy.read(6000).at <= T0 + 180 * MIN + 2 * 60 * MIN + 1000);
  assert.equal(lib.fitContestClock([anchor(1000, T0)]), null, 'по одной опоре шкалы нет');
});

check('ночью шкала идёт медленнее, чем по прямой', () => {
  // Опоры: 20:00 и 12:00 назавтра по Москве. Прямая поставила бы четверть
  // посылок на полночь, а три четверти — на 8 утра. Но ночью по всему Контесту
  // посылок мало: четверть набирается ещё вечером, три четверти — к 10 утра.
  const evening = Date.UTC(2026, 8, 16, 17, 0, 0);
  const noon = Date.UTC(2026, 8, 17, 9, 0, 0);
  const clock = lib.fitContestClock([anchor(1000, evening), anchor(2000, noon)]);
  const mskHour = (id) => {
    const at = new Date(clock.read(id).at + 3 * 3600_000);
    return at.getUTCHours() + at.getUTCMinutes() / 60;
  };
  assert.ok(mskHour(1250) > 22 && mskHour(1250) < 23, `четверть — вечером: ${mskHour(1250)}`);
  assert.ok(mskHour(1750) > 9.5 && mskHour(1750) < 10.5, `три четверти — утром: ${mskHour(1750)}`);
});

check('окно участника: своя отметка в оценку не входит', () => {
  const subs = [
    sub('Опора 1', 'a', 9, 1000, 'PresentationError', '', 'pdf'),
    sub('Опора 2', 'b', 9, 3000, 'PresentationError', '', 'pdf'),
    sub('Опора 3', 'c', 9, 5000, 'PresentationError', '', 'pdf'),
    sub('Решал', 'x', 1, 3900), sub('Решал', 'x', 2, 4000),
  ];
  subs[0].madeAt = T0;
  subs[1].madeAt = T0 + 60 * MIN;
  subs[2].madeAt = T0 + 120 * MIN;

  // Узнанный участник нажал «я отправил» через сутки: на его окно это не влияет.
  const { timings, summary } = lib.contestTimings(subs, [
    { participantId: 'x', personId: 'p-x', markedAt: T0 + 26 * 60 * MIN },
  ], T0 + 30 * 60 * MIN);

  const x = timings.get('x');
  assert.ok(x.from < T0 + 87 * MIN && x.to > T0 + 90 * MIN && x.to < T0 + 120 * MIN, 'окно около 11:30');
  assert.equal(summary.files, 3);
  assert.equal(summary.marks, 0, 'поздняя отметка отброшена как противоречащая соседям');

  const miss = lib.describeMarkMiss(T0 + 26 * 60 * MIN, x);
  assert.equal(miss.fits, false);
  assert.match(miss.text, /через \d+ ч после последней посылки/);
  assert.equal(lib.describeMarkMiss(x.to + 10 * MIN, x).fits, true, 'нажал вскоре после — сходится');

  assert.equal(timings.get('a').madeAt, T0, 'дата внутри решения — факт, он в окне остаётся');
});

check('оценённое время подсказывает, но не решает', () => {
  const window = { from: T0, to: T0 + 60 * MIN };
  const fits = profile({
    id: 'p1', display_name: 'Кто-то Другой', email: 'other@mail.ru',
    stage2_submitted_at: new Date(T0 + 70 * MIN).toISOString(),
  });
  const far = profile({
    id: 'p2', display_name: 'Совсем Никто', email: 'nobody@mail.ru',
    stage2_submitted_at: new Date(T0 + 30 * 60 * MIN).toISOString(),
  });

  const entry = mkEntry({ name: 'geparu', answerKey: 'id:1', estimatedWindow: window });
  assert.ok(lib.scoreCandidate(entry, fits, 'contest').signals.includes('time_window'));
  assert.ok(!lib.scoreCandidate(entry, far, 'contest').signals.some((s) => s.endsWith('_window')));

  const [row] = lib.matchFormEntries([entry], [fits, far], 'contest');
  assert.equal(row.best.profileId, 'p1', 'предложен тот, чья отметка в окне');
  assert.equal(row.confidence, 'likely', 'но решает человек');

  // Даже вместе с частью имени и похожим логином оценка не дотягивает до «само».
  const petrov = profile({
    id: 'p3', display_name: 'Петров Пётр Сергеевич', email: 'petrov.ps@mail.ru',
    stage2_submitted_at: new Date(T0 + 30 * MIN).toISOString(),
  });
  const signed = mkEntry({ name: 'Петров Пётр', login: 'petrov.ps', answerKey: 'id:2', estimatedWindow: window });
  const [petrovRow] = lib.matchFormEntries([signed], [petrov], 'contest');
  assert.ok(petrovRow.best.score >= 75, 'балл высокий');
  assert.equal(petrovRow.confidence, 'likely', 'но без оценки времени его не хватило бы');

  // Широкое окно называет только день, шире суток — ничего.
  const day = { from: T0, to: T0 + 10 * 60 * MIN };
  assert.ok(lib.scoreCandidate(mkEntry({ estimatedWindow: day }), fits, 'contest').signals.includes('day_window'));
  const week = { from: T0 - 3 * 24 * 60 * MIN, to: T0 + 60 * MIN };
  assert.ok(!lib.scoreCandidate(mkEntry({ estimatedWindow: week }), fits, 'contest').signals.some((s) => s.endsWith('_window')));
});

check('окно словами: минуты — только когда окно узкое', () => {
  const day = lib.formatTimeWindow({ from: T0, to: T0 + 90 * MIN });
  assert.match(day, /^\d{2}\.\d{2} \d{2}:\d{2}–\d{2}:\d{2}$/);
  const wide = lib.formatTimeWindow({ from: T0, to: T0 + 5 * 24 * 60 * MIN });
  assert.match(wide, /^между \d{2}\.\d{2} и \d{2}\.\d{2}$/);
});

await Promise.all(pending);
console.log(`ок: ${checks} проверок`);
