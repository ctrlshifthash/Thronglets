import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));

const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 880, deviceScaleFactor: 1.5 });
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise((r) => setTimeout(r, 1000));
await page.screenshot({ path: 'scripts/debug-splash-logo.png' });
const fav = await page.evaluate(() => document.querySelector('link[rel="icon"]')?.getAttribute('href') ?? 'none');
await new Promise((r) => setTimeout(r, 3200));
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('BEGIN'));
  if (b) b.click();
});
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: 'scripts/debug-home-logo.png', clip: { x: 0, y: 0, width: 1280, height: 380 } });
console.log('favicon href:', fav);
await browser.close();
