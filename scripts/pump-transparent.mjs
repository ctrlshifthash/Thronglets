// Flood-fill the white background of pump.png to transparent, starting
// from the edges so the pill's own white half (enclosed by its dark
// outline) is preserved. Writes public/pump-icon.png.
import puppeteer from 'puppeteer-core';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));

const b64 = readFileSync('c:/Users/Vigan/OneDrive/Desktop/github-projects/World/public/pump.png').toString('base64');
const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const page = await browser.newPage();

const out = await page.evaluate(async (src) => {
  const img = new Image();
  await new Promise((res) => {
    img.onload = res;
    img.src = src;
  });
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const W = c.width;
  const H = c.height;
  const d = ctx.getImageData(0, 0, W, H);
  const px = d.data;
  const seen = new Uint8Array(W * H);
  const stack = [];
  const near = (i) => px[i] > 224 && px[i + 1] > 224 && px[i + 2] > 224; // near-white
  for (let x = 0; x < W; x++) {
    stack.push([x, 0], [x, H - 1]);
  }
  for (let y = 0; y < H; y++) {
    stack.push([0, y], [W - 1, y]);
  }
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const p = y * W + x;
    if (seen[p]) continue;
    const i = p * 4;
    if (!near(i)) continue;
    seen[p] = 1;
    px[i + 3] = 0; // transparent
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  // Soften any 1px white halo left on the boundary.
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    if (px[i + 3] === 0) continue;
    if (near(i) && (seen[p - 1] || seen[p + 1] || seen[p - W] || seen[p + W])) px[i + 3] = 90;
  }
  ctx.putImageData(d, 0, 0);
  return c.toDataURL('image/png');
}, `data:image/png;base64,${b64}`);

await browser.close();
const data = out.split(',')[1];
writeFileSync('c:/Users/Vigan/OneDrive/Desktop/github-projects/World/public/pump-icon.png', Buffer.from(data, 'base64'));
console.log('wrote public/pump-icon.png');
