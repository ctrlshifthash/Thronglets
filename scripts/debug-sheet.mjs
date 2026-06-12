// Focused probe: citizen sheet text + music toggle + sprite spread.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const candidates = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
const exe = candidates.find((p) => existsSync(p));
const BASE = process.env.DEBUG_BASE || 'http://localhost:3000';
const slug = process.argv[2] || 'grok';

const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--window-size=1440,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.on('pageerror', (e) => console.log('[pageerror]', String(e?.stack || e).slice(0, 600)));

await page.goto(`${BASE}/town/${slug}`, { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise((r) => setTimeout(r, 6000));

// Click around the stage until the char sheet opens.
const stage = await page.evaluate(() => {
  const el = document.querySelector('.observer-stage');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
outer: for (let dy = -84; dy <= 84; dy += 12) {
  for (let dx = -108; dx <= 108; dx += 12) {
    await page.mouse.click(stage.x + dx, stage.y + dy);
    await new Promise((r) => setTimeout(r, 200));
    if (await page.evaluate(() => !!document.querySelector('.char-sheet'))) break outer;
  }
}

const sheet = await page.evaluate(() => document.querySelector('.char-sheet')?.innerText ?? null);
console.log('── char-sheet ──');
console.log(sheet);
console.log('undefined present:', sheet?.includes('undefined') ?? 'n/a');

// Music toggle: find it, click it, confirm state flips with no page errors.
const music = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const b = btns.find((x) => x.textContent.includes('♪'));
  if (!b) return null;
  const before = b.textContent;
  b.click();
  return { before, after: null };
});
await new Promise((r) => setTimeout(r, 1500));
const after = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('♪'));
  return b?.textContent ?? null;
});
console.log('── music ──', JSON.stringify({ before: music?.before, after }));

await browser.close();
