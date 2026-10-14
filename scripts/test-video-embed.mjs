/**
 * Проверки разбора ссылок на записи занятий (src/lib/videoEmbedUtils.ts).
 *
 * Запись, которая «то работает, то нет», чаще всего — ссылка в формате, который
 * разбор не узнал: трансляция YouTube (/live/), закрытый ролик Rutube (?p=),
 * VK без hash из кода встраивания. Здесь собраны все такие формы.
 *
 * Запуск: node scripts/test-video-embed.mjs
 */

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const bundlePath = path.join(os.tmpdir(), `video-embed-${Date.now()}.mjs`);

await build({
  entryPoints: [path.join(root, 'src', 'lib', 'videoEmbedUtils.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundlePath,
  logLevel: 'warning',
});

const { resolveVideoEmbed } = await import(pathToFileURL(bundlePath).href);

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

const embed = (input) => {
  const result = resolveVideoEmbed(input);
  assert.equal(result?.kind, 'embed', `не узнали: ${input}`);
  return result;
};

// YouTube
check('youtube watch', () => {
  assert.equal(embed('https://www.youtube.com/watch?v=dQw4w9WgXcQ').embedUrl, 'https://www.youtube.com/embed/dQw4w9WgXcQ');
});
check('youtu.be со временем', () => {
  const r = embed('https://youtu.be/dQw4w9WgXcQ?t=90');
  assert.equal(r.embedUrl, 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=90');
});
check('youtube трансляция /live/', () => {
  assert.equal(embed('https://www.youtube.com/live/dQw4w9WgXcQ?si=abc').embedUrl, 'https://www.youtube.com/embed/dQw4w9WgXcQ');
});
check('youtube shorts и m.', () => {
  assert.equal(embed('youtube.com/shorts/dQw4w9WgXcQ').embedUrl, 'https://www.youtube.com/embed/dQw4w9WgXcQ');
  assert.equal(embed('https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s').embedUrl, 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=90');
});
check('youtube канал — не видео', () => {
  assert.equal(resolveVideoEmbed('https://www.youtube.com/@quantum'), null);
});

// Rutube
const RT = '0123456789abcdef0123456789abcdef';
check('rutube обычный', () => {
  assert.equal(embed(`https://rutube.ru/video/${RT}/`).embedUrl, `https://rutube.ru/play/embed/${RT}/`);
});
check('rutube закрытый с ключом', () => {
  assert.equal(embed(`https://rutube.ru/video/private/${RT}/?p=Key_123`).embedUrl, `https://rutube.ru/play/embed/${RT}/?p=Key_123`);
});
check('rutube код встраивания', () => {
  assert.equal(embed(`<iframe width="720" src="https://rutube.ru/play/embed/${RT}" frameBorder="0"></iframe>`).embedUrl, `https://rutube.ru/play/embed/${RT}/`);
});

// VK
check('vk обычная ссылка', () => {
  assert.equal(embed('https://vk.com/video-123456_456239017').embedUrl, 'https://vk.com/video_ext.php?oid=-123456&id=456239017&hd=2');
});
check('vkvideo.ru, клип и ?z=', () => {
  const plain = 'https://vk.com/video_ext.php?oid=-123&id=456&hd=2';
  assert.equal(embed('https://vkvideo.ru/video-123_456?list=ln-abc').embedUrl, plain);
  assert.equal(embed('https://vk.com/clip-123_456').embedUrl, plain);
  assert.equal(embed('https://vk.com/video?z=video-123_456%2Fpl_cat_trends').embedUrl, plain);
});
check('vk код встраивания с hash', () => {
  const r = embed('<iframe src="https://vkvideo.ru/video_ext.php?oid=-123&amp;id=456&amp;hash=abc123&amp;hd=2" width="853" allowfullscreen></iframe>');
  assert.equal(r.embedUrl, 'https://vkvideo.ru/video_ext.php?oid=-123&id=456&hash=abc123&hd=2');
});
check('vk ссылка на плеер без протокола', () => {
  const r = embed('//vk.com/video_ext.php?oid=1&id=2&hash=h');
  assert.equal(r.embedUrl, 'https://vk.com/video_ext.php?oid=1&id=2&hash=h&hd=2');
});

// Прочее
check('другой сервис — просто ссылка', () => {
  assert.deepEqual(resolveVideoEmbed('https://disk.yandex.ru/i/abc'), { kind: 'link', url: 'https://disk.yandex.ru/i/abc' });
});
check('пусто', () => {
  assert.equal(resolveVideoEmbed('   '), null);
});

fs.rmSync(bundlePath, { force: true });
console.log(`ок: ${passed} проверок`);
