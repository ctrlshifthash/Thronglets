// Verify this round's fixes: modal stacking, brand, music default, roaming spread.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const candidates = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
const exe = candidates.find((p) => existsSync(p));
const BASE = process.env.DEBUG_BASE || 'http://localhost:3000';

const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--window-size=1440,900', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.on('pageerror', (e) => console.log('[pageerror]', String(e?.stack || e).slice(0, 600)));

// ── 1. Homepage: brand, music default, modal stacking ────────────────
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise((r) => setTimeout(r, 4000));

// Dismiss the intro overlay if present.
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('BEGIN'));
  if (b) b.click();
});
await new Promise((r) => setTimeout(r, 800));

const home = await page.evaluate(() => ({
  brand: document.querySelector('.obs-brand')?.textContent ?? null,
  title: document.title,
  music: [...document.querySelectorAll('button')].find((x) => x.textContent.includes('♪'))?.textContent ?? null,
}));
console.log('[home]', JSON.stringify(home));

// Open the help modal, confirm it's portaled to <body> and on top.
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('HOW IT WORKS'));
  if (b) b.click();
});
await new Promise((r) => setTimeout(r, 700));
const modal = await page.evaluate(() => {
  const overlay = document.querySelector('.modal-overlay');
  if (!overlay) return { present: false };
  const card = overlay.querySelector('.help-card');
  const r = card.getBoundingClientRect();
  // Is the modal card actually the thing rendered at its own center point?
  const topEl = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return {
    present: true,
    parentIsBody: overlay.parentElement === document.body,
    onTop: card.contains(topEl),
  };
});
console.log('[modal]', JSON.stringify(modal));
await page.screenshot({ path: 'scripts/debug-modal.png' });

// ── 2. Town: let them roam 30s, then measure how spread out they are ──
await page.goto(`${BASE}/town/grok`, { waitUntil: 'networkidle2', timeout: 90000 });
console.log('[town] watching the grove for 30s…');
await new Promise((r) => setTimeout(r, 30000));
await page.screenshot({ path: 'scripts/debug-spread.png' });

// Sample the canvas: count distinct bright-yellow (creature) blobs per quadrant.
const spread = await page.evaluate(() => {
  const canvas = document.querySelector('.game-mount canvas');
  if (!canvas) return null;
  const probe = document.createElement('canvas');
  probe.width = canvas.width;
  probe.height = canvas.height;
  const ctx = probe.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  const img = ctx.getImageData(0, 0, probe.width, probe.height).data;
  const cells = new Set();
  for (let y = 0; y < probe.height; y += 4) {
    for (let x = 0; x < probe.width; x += 4) {
      const i = (y * probe.width + x) * 4;
      const r = img[i], g = img[i + 1], b = img[i + 2];
      // creature body yellow: bright, low blue
      if (r > 200 && g > 170 && b < 120) cells.add(`${Math.floor(x / 48)},${Math.floor(y / 48)}`);
    }
  }
  return { occupiedCells: cells.size, canvasW: probe.width, canvasH: probe.height };
});
console.log('[spread]', JSON.stringify(spread));

await browser.close();
