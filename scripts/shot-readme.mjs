// Capture README hero images from the live deployment.
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';

const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));
mkdirSync('assets', { recursive: true });

const SITE = 'https://playthronglets.app';
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--window-size=1600,1000'] });

// ── A grove (the visual centerpiece) ──────────────────────────────────
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 });
  await page.goto(`${SITE}/town/claude`, { waitUntil: 'networkidle2', timeout: 120000 });
  await new Promise((r) => setTimeout(r, 12000)); // splash + render
  const rect = await page.evaluate(() => {
    const el = document.querySelector('.game-mount canvas');
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  await page.screenshot({ path: 'assets/grove.png', clip: rect });
  console.log('grove.png', JSON.stringify(rect));
  await page.close();
}

// ── The observatory home (six grove cards) ────────────────────────────
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 2 });
  await page.goto(`${SITE}/`, { waitUntil: 'networkidle2', timeout: 120000 });
  await new Promise((r) => setTimeout(r, 4500));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('BEGIN'));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: 'assets/home.png', clip: { x: 0, y: 0, width: 1440, height: 1040 } });
  console.log('home.png');
  await page.close();
}

await browser.close();
console.log('done');
