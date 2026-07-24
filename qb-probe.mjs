import { chromium } from 'playwright-core';

const ctx = await chromium.launchPersistentContext(`${process.env.TEMP}\\edge-probe`, {
  channel: 'msedge',
  headless: true,
  viewport: { width: 1440, height: 900 },
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
// wait for full char reveal, then grab immediately (scaffold still up until ~3.15s)
await page.waitForFunction(
  () => {
    const cs = document.querySelectorAll('.qb-l2 .quantum-brand-char');
    return cs.length && [...cs].every((c) => parseFloat(getComputedStyle(c).opacity) > 0.95);
  },
  { timeout: 15000 },
);
const box = await page.locator('.quantum-brand').boundingBox();
await page.screenshot({
  path: 'qb-now.png',
  clip: { x: Math.max(0, box.x - 140), y: box.y - 30, width: box.width + 280, height: box.height + 60 },
});

const u = await page.evaluate(() => {
  const svg = document.querySelector('.quantum-brand svg');
  const hrect = svg.querySelector('.qb-side-l .qb-gate rect');
  return { boxW: +hrect.width.baseVal.value.toFixed(1), u: +(hrect.width.baseVal.value / 1.96).toFixed(2) };
});
console.log(JSON.stringify(u));
await ctx.close();
process.exit(0);
