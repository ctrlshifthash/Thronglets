import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));
const BASE = 'http://localhost:3000';

// Create a player grove + grab its owner token.
const res = await fetch(`${BASE}/api/towns/create`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Quest Grove' }),
});
const { slug, token } = await res.json();
console.log('grove:', slug);

// Bathe a few times via the API so a counter shows progress (cooldown-limited, so just a couple).
await fetch(`${BASE}/api/towns/${slug}/care`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Owner-Token': token },
  body: JSON.stringify({ action: 'bathe' }),
});

const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
await page.setViewport({ width: 1440, height: 950 });
await page.evaluateOnNewDocument((s, t) => localStorage.setItem(`grove-token-${s}`, t), slug, token);
await page.goto(`${BASE}/town/${slug}`, { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise((r) => setTimeout(r, 9000));

const hasToggle = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('QUESTS'));
  if (b) b.click();
  return !!b;
});
console.log('quest toggle present:', hasToggle);
await new Promise((r) => setTimeout(r, 700));
const info = await page.evaluate(() => ({
  modal: !!document.querySelector('.quest-card'),
  rows: document.querySelectorAll('.quest-row').length,
  balance: document.querySelector('.quest-balance')?.innerText ?? null,
}));
console.log('[quests]', JSON.stringify(info));
await page.screenshot({ path: 'scripts/debug-quests.png' });
await browser.close();
