import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));

const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1000 });
await page.goto('http://localhost:3000/docs', { waitUntil: 'networkidle2', timeout: 120000 });
await new Promise((r) => setTimeout(r, 1500));
// splash should NOT be present on docs
const splash = await page.evaluate(() => !!document.querySelector('.loader-screen'));
console.log('splash on docs (should be false):', splash);
await page.screenshot({ path: 'scripts/debug-docs-top.png' });
await browser.close();
