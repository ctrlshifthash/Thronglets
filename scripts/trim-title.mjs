// Trim transparent padding around the wordmark in public/title.png.
import puppeteer from 'puppeteer-core';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));
const b64 = readFileSync('c:/Users/Vigan/OneDrive/Desktop/github-projects/World/public/title.png').toString('base64');

const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const page = await browser.newPage();
const out = await page.evaluate(async (src) => {
  const img = new Image();
  await new Promise((res) => { img.onload = res; img.src = src; });
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  // content = opaque AND not near-white (handles both transparent and white bg)
  const content = (i) => d[i + 3] > 24 && !(d[i] > 242 && d[i + 1] > 242 && d[i + 2] > 242);
  let minX = c.width, minY = c.height, maxX = 0, maxY = 0, any = false;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (content((y * c.width + x) * 4)) {
        any = true;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (!any) return { transparent: false, dataUrl: c.toDataURL() };
  const m = 10;
  minX = Math.max(0, minX - m); minY = Math.max(0, minY - m);
  maxX = Math.min(c.width - 1, maxX + m); maxY = Math.min(c.height - 1, maxY + m);
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const cornerAlpha = d[3]; // top-left alpha → is the source transparent?
  const oc = document.createElement('canvas');
  oc.width = w; oc.height = h;
  oc.getContext('2d').drawImage(img, minX, minY, w, h, 0, 0, w, h);
  return { transparent: cornerAlpha < 16, w, h, dataUrl: oc.toDataURL('image/png') };
}, `data:image/png;base64,${b64}`);
await browser.close();

writeFileSync('c:/Users/Vigan/OneDrive/Desktop/github-projects/World/public/title.png', Buffer.from(out.dataUrl.split(',')[1], 'base64'));
console.log('trimmed to', out.w + 'x' + out.h, '· source transparent:', out.transparent);
