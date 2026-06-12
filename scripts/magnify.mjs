// Magnify a region of a Mythril sheet with a 16px grid.
// Usage: node scripts/magnify.mjs <sheet> <sx> <sy> <w> <h>
import puppeteer from 'puppeteer-core';
import { existsSync, readFileSync } from 'node:fs';

const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));

const [sheet, sx, sy, w, h] = [
  process.argv[2] || 'C_OutSide_Nature',
  +(process.argv[3] ?? 0),
  +(process.argv[4] ?? 112),
  +(process.argv[5] ?? 128),
  +(process.argv[6] ?? 224),
];
const Z = 8;
const b64 = readFileSync(
  `c:/Users/Vigan/OneDrive/Desktop/github-projects/World/public/tiles/mythril/${sheet}.png`
).toString('base64');

const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const page = await browser.newPage();
const html = `<canvas id="c"></canvas><script>
const img = new Image();
img.onload = () => {
  const c = document.getElementById('c');
  c.width = ${w} * ${Z} + 44; c.height = ${h} * ${Z} + 44;
  const x = c.getContext('2d');
  x.fillStyle = '#111'; x.fillRect(0,0,c.width,c.height);
  x.imageSmoothingEnabled = false;
  x.drawImage(img, ${sx}, ${sy}, ${w}, ${h}, 44, 44, ${w}*${Z}, ${h}*${Z});
  x.strokeStyle = 'rgba(0,255,255,.5)'; x.fillStyle = '#fff'; x.font = '13px monospace';
  for (let g=0; g<=${w}/16; g++){ const px=${sx}+g*16; x.beginPath(); x.moveTo(44+g*16*${Z},44); x.lineTo(44+g*16*${Z},c.height); x.stroke(); x.fillText(px,46+g*16*${Z},32); }
  for (let g=0; g<=${h}/16; g++){ const py=${sy}+g*16; x.beginPath(); x.moveTo(44,44+g*16*${Z}); x.lineTo(c.width,44+g*16*${Z}); x.stroke(); x.fillText(py,2,58+g*16*${Z}); }
  document.title = 'done';
};
img.src = 'data:image/png;base64,${b64}';
</script>`;
await page.setContent(html);
await page.waitForFunction(() => document.title === 'done', { timeout: 10000 });
const dims = await page.evaluate(() => {
  const c = document.getElementById('c');
  return { width: c.width, height: c.height };
});
await page.setViewport({ width: Math.min(1500, dims.width), height: Math.min(950, dims.height) });
await page.screenshot({ path: `scripts/magnify-out.png`, clip: { x: 0, y: 0, ...dims } });
await browser.close();
console.log('done', JSON.stringify(dims));
