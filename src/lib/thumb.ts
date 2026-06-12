'use client';

import { MAP_H, MAP_W } from './rules';
import { TILES } from './tiles';

// ─────────────────────────────────────────────────────────────────────
// Universe-map thumbnails: project each world's tilemap to a tiny
// isometric island floating in the void — same vibe as the reference
// screenshot. Pure canvas, no engine needed.
// ─────────────────────────────────────────────────────────────────────

const TW = 8; // iso tile width
const TH = 4; // iso tile height

export const THUMB_W = (MAP_W + MAP_H) * (TW / 2) + 4; // 196
export const THUMB_H = (MAP_W + MAP_H) * (TH / 2) + 22; // 118 (incl. skirt)

function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.floor(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.floor(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.floor((n & 255) * factor));
  return `rgb(${r},${g},${b})`;
}

function diamond(ctx: CanvasRenderingContext2D, sx: number, sy: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(sx, sy + TH / 2);
  ctx.lineTo(sx + TW / 2, sy);
  ctx.lineTo(sx + TW, sy + TH / 2);
  ctx.lineTo(sx + TW / 2, sy + TH);
  ctx.closePath();
  ctx.fill();
}

/** Tall tiles get a raised diamond + darker support column. */
const RAISED = new Set(['t', 'u', 'r', 'h', 'O', 'M', 'Q', 'S', 'C', 'x', 'P']);

export function drawWorldThumb(canvas: HTMLCanvasElement, tilemap: string): void {
  canvas.width = THUMB_W;
  canvas.height = THUMB_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, THUMB_W, THUMB_H);

  const ox = THUMB_W / 2 - TW / 2;

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const ch = tilemap[y * MAP_W + x] ?? 'g';
      const def = TILES[ch];
      const color = def?.mapColor ?? '#3f9d4c';
      const sx = ox + ((x - y) * TW) / 2;
      const sy = ((x + y) * TH) / 2 + 2;

      // Island edge skirt for depth.
      if (x === MAP_W - 1 || y === MAP_H - 1) {
        ctx.fillStyle = shade(def?.mapColor ?? '#3f9d4c', 0.35);
        ctx.fillRect(sx, sy + TH / 2, TW, 9);
        ctx.fillStyle = shade(def?.mapColor ?? '#3f9d4c', 0.22);
        ctx.fillRect(sx, sy + TH / 2 + 9, TW, 4);
      }

      if (RAISED.has(ch)) {
        diamond(ctx, sx, sy, shade(color, 0.55)); // ground shadow
        diamond(ctx, sx, sy - 3, color); // raised cap
      } else {
        diamond(ctx, sx, sy, color);
      }
    }
  }
}

