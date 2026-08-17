import { chromium } from 'playwright-core';

const OUT = process.argv[2] ?? 'public/og-cover.png';
// Wider viewport at the same 1.91:1 ratio: the hero is centred in a max-w-4xl
// column, so widening the frame buys vertical room and stops the CTA row from
// being sliced in half.
const W = 1600, H = 838;

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});

const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1.5,
});

await page.goto('https://quantumschool.ru/', { waitUntil: 'networkidle', timeout: 60000 });

// entry animations (fade-in / slide-up) need to finish before the shot
await page.waitForTimeout(3500);
await page.evaluate(() => document.fonts.ready);

// freeze ambient motion so the orbit decor is not caught mid-blur
await page.addStyleTag({
  content: `*, *::before, *::after {
    animation-play-state: paused !important;
    transition: none !important;
  }`,
});
await page.waitForTimeout(300);

await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: W, height: H } });

console.log('saved', OUT);
await browser.close();
