import type * as Phaser from 'phaser';
import { CARETAKERS, PERSONAS } from '@/lib/personalities';
import {
  ALT_ART,
  CHAR_FRAMES,
  GROUND_TILES,
  KEEPER_FRAMES,
  NPC_HAT,
  PALETTE,
  PLAYER_TINTS,
  TILES,
  validateCharArt,
  validateTileArt,
  type GroundTile,
} from '@/lib/tiles';
import type { ModelKey } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────
// Builds the entire sprite atlas at runtime from the pixel patterns in
// tiles.ts — no binary assets in the repo. Grass-based overlays (trees,
// rocks, nodes, stations) are additionally baked onto every ground
// type, so a pine on a snowfield gets a snowy base automatically.
// ─────────────────────────────────────────────────────────────────────

export const ATLAS = 'worlds-atlas';
/** Pattern art is authored 16×16; baked at 2× so frames match 32px tiles. */
const PX = 2;
const ART = 16;
const T = ART * PX;

type PixelMap = (ch: string) => string | null;
type Ctx2D = Pick<CanvasRenderingContext2D, 'fillStyle' | 'fillRect'>;

function drawPattern(ctx: Ctx2D, rows: string[], ox: number, oy: number, map?: PixelMap): void {
  // Overlays (e.g. the NPC hat) may be shorter than a full 16-row tile.
  const h = Math.min(ART, rows.length);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < ART && x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const color = map ? map(ch) : (PALETTE[ch] ?? null);
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + x * PX, oy + y * PX, PX, PX);
    }
  }
}

function grayOf(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const l = Math.floor((0.3 * ((n >> 16) & 255) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) * 0.72);
  return `rgb(${l},${l},${l})`;
}

const grayMap: PixelMap = (c) => {
  const hex = PALETTE[c];
  return hex ? grayOf(hex) : null;
};

/** Grounds a grass-based overlay can be re-composed onto ('g' is the default frame). */
const VARIANT_GROUNDS = GROUND_TILES.filter((g) => g !== 'g');

function hasGroundVariants(ch: string): boolean {
  return TILES[ch]?.base === 'g';
}

export function tileFrame(ch: string, depleted = false, ground: GroundTile | string = 'g'): string {
  const suffix = depleted ? '_dead' : '';
  if (ground !== 'g' && hasGroundVariants(ch) && (VARIANT_GROUNDS as string[]).includes(ground)) {
    return `tile_${ch}${suffix}@${ground}`;
  }
  return `tile_${ch}${suffix}`;
}

export function charFrame(tint: number, dir: 'down' | 'up' | 'side', alt: 0 | 1): string {
  return `char_${tint % PLAYER_TINTS.length}_${dir}${alt}`;
}

export function keeperFrame(slug: string, alt: 0 | 1): string {
  return `keeper_${slug}_${alt}`;
}

export interface FrameJob {
  key: string;
  draw: (ctx: Ctx2D, ox: number, oy: number) => void;
}

/** Pure job list — exported so tooling can validate every frame without Phaser. */
export function buildAtlasJobs(): FrameJob[] {
  validateTileArt();
  validateCharArt();
  const jobs: FrameJob[] = [];

  const compose = (key: string, baseArt: string[] | null, art: string[], map?: PixelMap): void => {
    jobs.push({
      key,
      draw: (ctx, ox, oy) => {
        if (baseArt) drawPattern(ctx, baseArt, ox, oy);
        drawPattern(ctx, art, ox, oy, map);
      },
    });
  };

  for (const [ch, def] of Object.entries(TILES)) {
    const defaultBase = def.base ? TILES[def.base].art : null;
    compose(`tile_${ch}`, defaultBase, def.art);
    if (def.resource) compose(`tile_${ch}_dead`, defaultBase, def.art, grayMap);

    if (hasGroundVariants(ch)) {
      for (const ground of VARIANT_GROUNDS) {
        const groundArt = TILES[ground].art;
        compose(`tile_${ch}@${ground}`, groundArt, def.art);
        if (def.resource) compose(`tile_${ch}_dead@${ground}`, groundArt, def.art, grayMap);
      }
    }
  }

  // Animation alternates (water waves, fishing-spot ripples).
  for (const [ch, rows] of Object.entries(ALT_ART)) {
    const base = TILES[ch]?.base ? TILES[TILES[ch].base!].art : null;
    compose(`tile_${ch}_alt`, base, rows);
  }

  PLAYER_TINTS.forEach((tint, v) => {
    for (const [frameName, rows] of Object.entries(CHAR_FRAMES)) {
      compose(`char_${v}_${frameName}`, null, rows, (c) => (c === 'T' ? tint : (PALETTE[c] ?? null)));
    }
  });

  // The six keepers: the old humanoid, robed in their town's accent + hat.
  for (const slug of Object.keys(CARETAKERS) as ModelKey[]) {
    const tint = PERSONAS[slug].accent;
    for (const alt of [0, 1] as const) {
      const rows = KEEPER_FRAMES[`down${alt}`];
      jobs.push({
        key: keeperFrame(slug, alt),
        draw: (ctx, ox, oy) => {
          drawPattern(ctx, rows, ox, oy, (c) => (c === 'T' ? tint : (PALETTE[c] ?? null)));
          drawPattern(ctx, NPC_HAT, ox, oy);
        },
      });
    }
  }

  return jobs;
}

export function buildAtlas(scene: Phaser.Scene): void {
  if (scene.textures.exists(ATLAS)) return;
  const jobs = buildAtlasJobs();

  const cols = 16;
  const rows = Math.ceil(jobs.length / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * T;
  canvas.height = rows * T;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context for atlas');
  ctx.imageSmoothingEnabled = false;

  jobs.forEach((job, i) => {
    job.draw(ctx, (i % cols) * T, Math.floor(i / cols) * T);
  });

  const tex = scene.textures.addCanvas(ATLAS, canvas);
  if (!tex) throw new Error('Failed to register atlas texture');
  jobs.forEach((job, i) => {
    tex.add(job.key, 0, (i % cols) * T, Math.floor(i / cols) * T, T, T);
  });
}
