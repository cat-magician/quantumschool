/**
 * Проверки поля входа: что человек ввёл — логин или почту.
 *
 * Ошибка здесь отнимает доступ ко всем аккаунтам сразу, а внешне выглядит как
 * «неверный логин или пароль», так что найти её по жалобам почти нельзя.
 * Однажды регулярка уже потеряла обратные слэши при автоправке и превратилась
 * в класс «кроме буквы s»: адреса без «s» входили, с «s» — нет.
 *
 * Запуск: node scripts/test-auth-identifier.mjs
 */

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const bundlePath = path.join(os.tmpdir(), `auth-identifier-${Date.now()}.mjs`);

await build({
  entryPoints: [path.join(root, 'src', 'lib', 'loginAuthConfig.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundlePath,
  logLevel: 'warning',
});

const lib = await import(pathToFileURL(bundlePath).href);
const { identifierToAuthEmail: toEmail, isEmailIdentifier, loginToAuthEmail, LOGIN_EMAIL_DOMAIN } = lib;

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    console.error(`провалено: ${name}`);
    throw error;
  }
}

check('логин превращается в технический адрес — как и раньше', () => {
  for (const login of ['ivan2010', 'a.b-c_d', 'user1', 'sasha', 'stas', 'test']) {
    assert.equal(toEmail(login), loginToAuthEmail(login), login);
  }
});

check('регистр и пробелы не мешают', () => {
  assert.equal(toEmail('IVAN2010'), `ivan2010@${LOGIN_EMAIL_DOMAIN}`);
  assert.equal(toEmail('  ivan2010  '), `ivan2010@${LOGIN_EMAIL_DOMAIN}`);
});

check('точка внутри логина не делает его почтой', () => {
  assert.equal(toEmail('ivan.2010'), `ivan.2010@${LOGIN_EMAIL_DOMAIN}`);
});

check('почта уходит как есть', () => {
  assert.equal(toEmail('ivan@yandex.ru'), 'ivan@yandex.ru');
  assert.equal(toEmail('Ivan@Yandex.RU'), 'ivan@yandex.ru');
  assert.equal(toEmail('first.last+tag@mail.example.com'), 'first.last+tag@mail.example.com');
});

check('буква s в адресе больше не ломает распознавание', () => {
  // Тот самый случай: класс [^s@] вместо [^\s@].
  for (const mail of ['sasha@list.ru', 'stas@mail.ru', 'test@css.com']) {
    assert.equal(toEmail(mail), mail, mail);
  }
});

check('технический адрес, введённый вручную, не удваивается', () => {
  const technical = `nick@${LOGIN_EMAIL_DOMAIN}`;
  assert.equal(toEmail(technical), technical);
});

check('почтой считается только то, что на неё похоже', () => {
  assert.equal(isEmailIdentifier('ivan@yandex.ru'), true);
  assert.equal(isEmailIdentifier('ivan2010'), false);
  assert.equal(isEmailIdentifier('ivan@yandex'), false, 'домен без точки');
  assert.equal(isEmailIdentifier('ivan@'), false);
  assert.equal(isEmailIdentifier('@yandex.ru'), false);
  assert.equal(isEmailIdentifier('ivan 2010@ya.ru'), false, 'пробел внутри');
});

fs.rmSync(bundlePath, { force: true });
console.log(`ок: ${passed} проверок`);
