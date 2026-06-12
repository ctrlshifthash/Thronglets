// Headless screenshot/console check for the observatory.
// Usage: node scripts/debug-page.mjs [home|town] [slug]
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const candidates = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
const exe = candidates.find((p) => existsSync(p));
if (!exe) throw new Error('No Edge/Chrome found');

const BASE = process.env.DEBUG_BASE || 'http://localhost:3000';
const target = process.argv[2] || 'home';
const slug = process.argv[3] || 'grok';
const mobile = process.argv.includes('mobile');

const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--window-size=1440,900'] });
const page = await browser.newPage();
await page.setViewport(mobile ? { width: 390, height: 760 } : { width: 1440, height: 900 });

page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 400));
});
page.on('pageerror', (e) => console.log('[pageerror]', String(e?.stack || e).slice(0, 1000)));

let gotoSlug = slug;
if (target === 'grove') {
  // Create a fresh player grove and act as its keeper.
  const res = await fetch(`${BASE}/api/towns/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Debug Grove' }),
  });
  const { slug: gslug, token } = await res.json();
  gotoSlug = gslug;
  console.log('[grove]', gslug);
  await page.evaluateOnNewDocument(
    (s, t) => localStorage.setItem(`grove-token-${s}`, t),
    gslug,
    token
  );
}

const url = target === 'home' ? `${BASE}/` : `${BASE}/town/${gotoSlug}`;
console.log('[goto]', url);
await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise((r) => setTimeout(r, 8000));

if (target === 'grove') {
  const fed = await page.evaluate(() => {
    const btn = document.querySelector('.care-btn');
    if (btn) btn.click();
    return !!btn;
  }).catch(() => false);
  console.log('[grove] care bar present:', fed);
  await new Promise((r) => setTimeout(r, 2500));
}

// On town pages, try to click an agent to open the inspector (probe a small grid around stage center).
if (target === 'town') {
  const stage = await page.evaluate(() => {
    const el = document.querySelector('.observer-stage');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (stage) {
    outer: for (let dy = -72; dy <= 72; dy += 12) {
      for (let dx = -96; dx <= 96; dx += 12) {
        await page.mouse.click(stage.x + dx, stage.y + dy);
        await new Promise((r) => setTimeout(r, 250));
        const open = await page.evaluate(() => !!document.querySelector('.char-sheet'));
        if (open) {
          console.log('[inspector] opened via click at offset', dx, dy);
          break outer;
        }
      }
    }
  }
  await new Promise((r) => setTimeout(r, 2500));
}

const info = await page.evaluate(() => ({
  cards: document.querySelectorAll('.town-card').length,
  canvas: !!document.querySelector('.game-mount canvas'),
  timeline: document.querySelectorAll('.tl-entry').length,
  filters: document.querySelectorAll('.tl-filter').length,
  inspector: !!document.querySelector('.char-sheet'),
  inspectorName: document.querySelector('.cs-name')?.textContent ?? null,
  summary: document.querySelector('.story-summary')?.textContent?.slice(0, 90) ?? null,
  beats: document.querySelectorAll('.tl-beat').length,
  talk: document.querySelectorAll('.tl-talk').length,
  title: document.title,
}));
console.log('[dom]', JSON.stringify(info, null, 1));

const file = `scripts/debug-${target}${target === 'town' ? `-${slug}` : ''}${mobile ? '-mobile' : ''}.png`;
await page.screenshot({ path: file });
console.log('[screenshot]', file);
await browser.close();


