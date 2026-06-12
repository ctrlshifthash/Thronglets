// Verify: community gallery, modal centered during open animation, #create deep link.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const candidates = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const exe = candidates.find((p) => existsSync(p));
const BASE = process.env.DEBUG_BASE || 'http://localhost:3000';

const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--window-size=1440,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.on('pageerror', (e) => console.log('[pageerror]', String(e?.stack || e).slice(0, 600)));

await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise((r) => setTimeout(r, 3500));
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('BEGIN'));
  if (b) b.click();
});
await new Promise((r) => setTimeout(r, 500));

// 1. Community gallery present?
const community = await page.evaluate(() => ({
  section: !!document.querySelector('.community'),
  cards: document.querySelectorAll('.community .town-card').length,
  title: document.querySelector('.community-title')?.textContent ?? null,
}));
console.log('[community]', JSON.stringify(community));

// 2. Open help modal and check position IMMEDIATELY (mid-animation) and after.
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('HOW IT WORKS'));
  if (b) b.click();
});
await new Promise((r) => setTimeout(r, 60)); // mid-animation
const mid = await page.evaluate(() => {
  const card = document.querySelector('.help-card');
  if (!card) return null;
  const r = card.getBoundingClientRect();
  return { cx: Math.round(r.x + r.width / 2), vw: window.innerWidth, offCenterPx: Math.round(Math.abs(r.x + r.width / 2 - window.innerWidth / 2)) };
});
console.log('[modal mid-anim]', JSON.stringify(mid));
await page.screenshot({ path: 'scripts/debug-modal-mid.png' });
await new Promise((r) => setTimeout(r, 400));
const title = await page.evaluate(() => document.querySelector('.help-card .panel-title')?.textContent ?? null);
console.log('[modal title]', title);

// 3. Click the raise-your-own link inside the modal -> create form opens.
await page.evaluate(() => {
  const a = document.querySelector('.help-own-link');
  if (a) a.click();
});
await new Promise((r) => setTimeout(r, 900));
const create = await page.evaluate(() => ({
  input: !!document.querySelector('.grove-name-input'),
  helpStillOpen: !!document.querySelector('.help-card'),
  hash: window.location.hash,
}));
console.log('[create-link]', JSON.stringify(create));
await page.screenshot({ path: 'scripts/debug-create-open.png' });

await browser.close();
