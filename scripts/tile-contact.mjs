// Renders each Mythril sheet at 2x with a labeled 32px grid so tile
// coordinates can be read precisely. Output: scripts/contact-<name>.png
import puppeteer from 'puppeteer-core';
import { existsSync, readFileSync } from 'node:fs';

const candidates = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const exe = candidates.find((p) => existsSync(p));

const SHEETS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['A2_Ground', 'A5_Tiles', 'A1_AnimatedGround', 'C_OutSide_Nature', 'D_OutDoor', 'B_HouseExteriorTiles'];

const browser = await puppeteer.launch({ executablePath: exe, headless: true });

for (const name of SHEETS) {
  const page = await browser.newPage();
  const file = `c:/Users/Vigan/OneDrive/Desktop/github-projects/World/public/tiles/mythril/${name}.png`;
  const b64 = readFileSync(file).toString('base64');
  await page.setContent(`<html><body style="margin:0"><canvas id="c"></canvas><script>
    const img = new Image();
    img.onload = () => {
      const S = 2, G = 32;
      const c = document.getElementById('c');
      c.width = img.width * S + 40; c.height = img.height * S + 40;
      const x = c.getContext('2d');
      x.fillStyle = '#222'; x.fillRect(0, 0, c.width, c.height);
      x.imageSmoothingEnabled = false;
      x.drawImage(img, 40, 40, img.width * S, img.height * S);
      x.strokeStyle = 'rgba(255,0,255,0.55)'; x.fillStyle = '#fff'; x.font = '11px monospace';
      for (let gx = 0; gx <= img.width / G; gx++) {
        x.beginPath(); x.moveTo(40 + gx * G * S, 40); x.lineTo(40 + gx * G * S, c.height); x.stroke();
        if (gx < img.width / G) x.fillText(String(gx), 44 + gx * G * S, 30);
      }
      for (let gy = 0; gy <= img.height / G; gy++) {
        x.beginPath(); x.moveTo(40, 40 + gy * G * S); x.lineTo(c.width, 40 + gy * G * S); x.stroke();
        if (gy < img.height / G) x.fillText(String(gy), 8, 56 + gy * G * S);
      }
      document.title = 'done';
    };
    img.src = 'data:image/png;base64,${b64}';
  </script></body></html>`);
  await page.waitForFunction(() => document.title === 'done', { timeout: 10000 });
  const dims = await page.evaluate(() => {
    const c = document.getElementById('c');
    return { width: c.width, height: c.height };
  });
  await page.setViewport({ width: dims.width, height: dims.height });
  await page.screenshot({ path: `scripts/contact-${name}.png`, clip: { x: 0, y: 0, ...dims } });
  console.log(`contact-${name}.png (${dims.width}x${dims.height})`);
  await page.close();
}
await browser.close();
