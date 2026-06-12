import type * as Phaser from 'phaser';
import { MAP_H, MAP_W } from '@/lib/rules';
import { groundUnder, PALETTE, TILES } from '@/lib/tiles';
import type { Buildings } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────
// Mythril Age tileset integration (public/tiles/mythril/*.png, 32px).
//
// Ground uses REAL RPG-Maker autotiling: every terrain (water, dirt,
// cobble, sand, mossy grass) is composed per-quarter from its 2×3
// autotile block, so shorelines curve and paths blend into the meadow
// exactly like the pack's preview shots. The whole ground layer bakes
// to one canvas per water-animation frame.
//
// Scenery (trees, rocks, fences …) are bottom-anchored sprites that
// depth-sort with the creatures; buildings are baked composites — the
// big gabled houses for the major structures, small huts for the rest.
// ─────────────────────────────────────────────────────────────────────

export const MYTHRIL_SHEETS: Record<string, string> = {
  a5: '/tiles/mythril/A5_Tiles.png',
  a1: '/tiles/mythril/A1_AnimatedGround.png',
  a2: '/tiles/mythril/A2_Ground.png',
  b: '/tiles/mythril/B_HouseExteriorTiles.png',
  b1: '/tiles/mythril/B_HouseExteriorTiles_1.png',
  b2: '/tiles/mythril/B_HouseExteriorTiles_2.png',
  c: '/tiles/mythril/C_OutSide_Nature.png',
  d: '/tiles/mythril/D_OutDoor.png',
};

type SheetKey = keyof typeof MYTHRIL_SHEETS;

interface Crop {
  sheet: SheetKey;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function loadMythril(scene: Phaser.Scene): void {
  for (const [key, url] of Object.entries(MYTHRIL_SHEETS)) {
    scene.load.image(`myth_${key}`, url);
  }
}

function srcImage(scene: Phaser.Scene, sheet: SheetKey): HTMLImageElement {
  return scene.textures.get(`myth_${sheet}`).getSourceImage() as HTMLImageElement;
}

// ── Autotiled ground ─────────────────────────────────────────────────

/** Terrain classes that blend via autotiles; everything else sits on grass. */
type Terrain = 'g' | 'm' | 'd' | 'p' | 's' | 'n' | 'w';

/** 2×3 autotile block origins (VX Ace format). Water animates: +64px per frame. */
const BLOCKS: Record<Terrain, { sheet: SheetKey; x: number; y: number }> = {
  g: { sheet: 'a2', x: 0, y: 0 }, // meadow grass (the base everything blends into)
  m: { sheet: 'a2', x: 0, y: 96 }, // leafy mossy grass
  d: { sheet: 'a2', x: 128, y: 0 }, // earth
  p: { sheet: 'a2', x: 256, y: 0 }, // cobble path
  s: { sheet: 'a2', x: 320, y: 0 }, // stone floor
  n: { sheet: 'a2', x: 384, y: 0 }, // sand
  w: { sheet: 'a1', x: 0, y: 0 }, // water (frames 0/1 at x 0/64)
};

/** Which terrain a tilemap char belongs to (objects resolve via groundUnder). */
function terrainOf(ch: string): Terrain | null {
  switch (ch) {
    case 'g':
    case 'y':
    case 'v':
    case 'f':
      return 'g'; // plants overlay separately
    case 'm':
      return 'm';
    case 'd':
      return 'd';
    case 'p':
    case 'B':
      return 'p';
    case 's':
      return 's';
    case 'n':
      return 'n';
    case 'w':
    case 'F':
    case 'b':
      return 'w'; // bridges count as water for shore blending
    default:
      return null; // trees/rocks/buildings — take the majority neighbor
  }
}

/**
 * Quarter sources within a 2×3 block, in 16px grid units, per sub-tile
 * position [TL, TR, BL, BR] — the standard VX Ace expansion.
 */
const Q = 16;
const QUARTER: Record<string, [number, number][]> = {
  CENTER: [[1, 3], [2, 3], [1, 4], [2, 4]],
  INNER: [[2, 0], [3, 0], [2, 1], [3, 1]],
  EDGE_H: [[1, 2], [2, 2], [1, 5], [2, 5]], // top/bottom borders
  EDGE_V: [[0, 3], [3, 3], [0, 4], [3, 4]], // left/right borders
  OUTER: [[0, 2], [3, 2], [0, 5], [3, 5]],
};

/** Plant overlays drawn onto the ground canvas (transparent C-sheet sprites). */
const SPRIGS: Crop[] = [
  { sheet: 'c', x: 0, y: 32, w: 32, h: 32 },
  { sheet: 'c', x: 0, y: 64, w: 32, h: 32 },
];
const FLOWERS: Crop[] = [
  { sheet: 'c', x: 0, y: 96, w: 32, h: 32 },
  { sheet: 'c', x: 64, y: 96, w: 32, h: 32 },
  { sheet: 'c', x: 128, y: 96, w: 32, h: 32 },
];
const BRIDGE_DECK: Crop = { sheet: 'a5', x: 128, y: 0, w: 32, h: 32 };

/**
 * Bake the whole ground layer for one water-animation frame onto the
 * given canvas context. Pure function of the tilemap string.
 */
export function paintGround(scene: Phaser.Scene, ctx: CanvasRenderingContext2D, map: string, frame: 0 | 1): void {
  ctx.imageSmoothingEnabled = false;

  // Resolve every cell to a terrain class first (objects inherit ground).
  const terr: Terrain[] = new Array(MAP_W * MAP_H);
  for (let i = 0; i < MAP_W * MAP_H; i++) {
    const ch = map[i] ?? 'g';
    const t = terrainOf(ch);
    if (t) {
      terr[i] = t;
    } else {
      const g = groundUnder(map, i % MAP_W, Math.floor(i / MAP_W), MAP_W, MAP_H);
      terr[i] = terrainOf(g) ?? 'g';
    }
  }
  const at = (x: number, y: number): Terrain =>
    x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? terr[Math.min(Math.max(y, 0), MAP_H - 1) * MAP_W + Math.min(Math.max(x, 0), MAP_W - 1)] : terr[y * MAP_W + x];

  const grass = BLOCKS.g;
  const grassImg = srcImage(scene, grass.sheet);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const i = y * MAP_W + x;
      const t = terr[i];
      const block = BLOCKS[t];
      const img = srcImage(scene, block.sheet);
      const bx = block.x + (t === 'w' ? frame * 64 : 0);
      const by = block.y;

      // Grass backdrop under every non-grass terrain (edge art is opaque,
      // but corners of curved shores reveal the meadow beneath).
      if (t !== 'g') {
        for (let q = 0; q < 4; q++) {
          const [cqx, cqy] = QUARTER.CENTER[q];
          ctx.drawImage(grassImg, grass.x + cqx * Q, grass.y + cqy * Q, Q, Q, x * 32 + (q % 2) * Q, y * 32 + (q >> 1) * Q, Q, Q);
        }
      }

      // Compose the 4 quarters by neighbor sameness.
      for (let q = 0; q < 4; q++) {
        const qx = q % 2; // 0 = left, 1 = right
        const qy = q >> 1; // 0 = top, 1 = bottom
        const hx = qx === 0 ? -1 : 1;
        const vy = qy === 0 ? -1 : 1;
        const sideH = at(x + hx, y) === t;
        const sideV = at(x, y + vy) === t;
        const diag = at(x + hx, y + vy) === t;
        const kind =
          t === 'g' ? 'CENTER' // grass is the base — others draw the borders
          : sideH && sideV && diag ? 'CENTER'
          : sideH && sideV ? 'INNER'
          : !sideH && sideV ? 'EDGE_V'
          : sideH && !sideV ? 'EDGE_H'
          : 'OUTER';
        const [sqx, sqy] = QUARTER[kind][q];
        ctx.drawImage(img, bx + sqx * Q, by + sqy * Q, Q, Q, x * 32 + qx * Q, y * 32 + qy * Q, Q, Q);
      }

      // Decorations baked flat into the ground.
      const ch = map[i] ?? 'g';
      const seed = (x * 31 + y * 17) >>> 0;
      if (ch === 'v') {
        const c = SPRIGS[seed % SPRIGS.length];
        ctx.drawImage(srcImage(scene, c.sheet), c.x, c.y, c.w, c.h, x * 32, y * 32, 32, 32);
      } else if (ch === 'f') {
        const c = FLOWERS[seed % FLOWERS.length];
        ctx.drawImage(srcImage(scene, c.sheet), c.x, c.y, c.w, c.h, x * 32, y * 32, 32, 32);
      } else if (ch === 'b') {
        const c = BRIDGE_DECK;
        ctx.drawImage(srcImage(scene, c.sheet), c.x, c.y, c.w, c.h, x * 32, y * 32, 32, 32);
      }
    }
  }
}

// ── Scenery objects (bottom-anchored, depth-sorted with creatures) ───

interface ObjectCrop extends Crop {
  scale?: number;
}

const OBJECTS: Record<string, ObjectCrop> = {
  t: { sheet: 'c', x: 32, y: 8, w: 96, h: 88 }, // grand leafy tree
  u: { sheet: 'c', x: 128, y: 16, w: 72, h: 80 }, // round tree
  l: { sheet: 'c', x: 192, y: 72, w: 72, h: 56 }, // small tree (apples baked)
  r: { sheet: 'c', x: 96, y: 160, w: 40, h: 40 }, // round boulder
  x: { sheet: 'c', x: 160, y: 448, w: 32, h: 32 }, // wooden fence rail
  P: { sheet: 'c', x: 32, y: 448, w: 32, h: 32 }, // fat berry bloom
  A: { sheet: 'd', x: 416, y: 224, w: 32, h: 64 }, // dark spire (legacy antenna)
  a: { sheet: 'd', x: 8, y: 220, w: 184, h: 100, scale: 0.6 }, // red autumn tree
  a2: { sheet: 'd', x: 200, y: 220, w: 184, h: 100, scale: 0.6 }, // orange autumn tree
  k: { sheet: 'd', x: 8, y: 416, w: 80, h: 76, scale: 0.55 }, // small leafy bush
  e: { sheet: 'd', x: 320, y: 448, w: 32, h: 32 }, // green garden stool
  j: { sheet: 'd', x: 416, y: 416, w: 64, h: 72, scale: 0.5 }, // round table
  q: { sheet: 'c', x: 94, y: 128, w: 44, h: 34 }, // rounded orange mushroom cap
  z: { sheet: 'c', x: 0, y: 257, w: 32, h: 33 }, // compact candle-lantern (flame + holder)
};

export function objectFrame(ch: string, variantSeed = 0): { texture: string; frame: string; scale: number } | null {
  if (ch === 'l') return { texture: 'myth_apple', frame: '__BASE', scale: 1 };
  if (ch === 'o') return { texture: 'myth_ball', frame: '__BASE', scale: 1 }; // transparent-baked toy
  // Autumn trees alternate red/orange by position.
  const key = ch === 'a' && variantSeed % 2 === 1 ? 'a2' : ch;
  const c = OBJECTS[key];
  return c ? { texture: `myth_${c.sheet}`, frame: `o_${key}`, scale: c.scale ?? 1 } : null;
}

// ── Buildings ────────────────────────────────────────────────────────

/** Complete gabled house fronts on the B sheet (red/green/blue, 152px). */
const GABLE: Record<string, Crop> = {
  red: { sheet: 'b', x: 0, y: 0, w: 160, h: 152 },
  green: { sheet: 'b', x: 0, y: 160, w: 160, h: 152 },
  blue: { sheet: 'b', x: 0, y: 320, w: 160, h: 152 },
};
const ROOF: Record<string, Crop> = {
  red: { sheet: 'b', x: 192, y: 64, w: 32, h: 32 },
  slate: { sheet: 'b', x: 416, y: 192, w: 32, h: 32 },
};
const WALL: Record<string, Crop> = {
  brick: { sheet: 'b', x: 192, y: 448, w: 32, h: 32 },
  stone: { sheet: 'b', x: 320, y: 288, w: 32, h: 32 },
};
const DOOR_BROWN: Crop = { sheet: 'b', x: 480, y: 96, w: 32, h: 64 };
const DOOR_DARK: Crop = { sheet: 'b', x: 480, y: 32, w: 32, h: 64 };
const WINDOW: Crop = { sheet: 'b', x: 480, y: 160, w: 32, h: 32 };

const FARM_FIELD: Crop = { sheet: 'd', x: 224, y: 320, w: 32, h: 32 };
const SHRINE_ARCH: Crop = { sheet: 'c', x: 384, y: 224, w: 32, h: 64 };
const TOWER_SPIRE: Crop = { sheet: 'd', x: 448, y: 224, w: 32, h: 64 };

export function buildingTexture(kind: keyof Buildings, variantSeed = 0): string {
  // Houses come in three palettes (the recolor sheets) so streets vary.
  if (kind === 'house') return `myth_bld_house${variantSeed % 3 || ''}`;
  return `myth_bld_${kind}`;
}

/** Farm plots lie flat; everything else stands tall and depth-sorts. */
export function buildingIsFlat(kind: keyof Buildings): boolean {
  return kind === 'farm';
}

export function mythrilReady(scene: Phaser.Scene): boolean {
  return scene.textures.exists('myth_bld_house');
}

function drawCrop(ctx: CanvasRenderingContext2D, scene: Phaser.Scene, c: Crop, dx: number, dy: number, dw = c.w, dh = c.h): void {
  ctx.drawImage(srcImage(scene, c.sheet), c.x, c.y, c.w, c.h, dx, dy, dw, dh);
}

export function registerMythril(scene: Phaser.Scene): void {
  if (mythrilReady(scene)) return;

  for (const [ch, c] of Object.entries(OBJECTS)) {
    scene.textures.get(`myth_${c.sheet}`).add(`o_${ch}`, 0, c.x, c.y, c.w, c.h);
  }

  // Transparent play ball, baked from the pattern art (no grass square).
  {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const art = TILES.o.art;
    for (let yy = 0; yy < 16; yy++) {
      const row = art[yy] ?? '';
      for (let xx = 0; xx < row.length; xx++) {
        const col = PALETTE[row[xx]];
        if (row[xx] === '.' || !col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(xx * 2, yy * 2, 2, 2);
      }
    }
    scene.textures.addCanvas('myth_ball', canvas);
  }

  // Apple tree: the small tree with a few ripe apples baked in.
  {
    const base = OBJECTS.l;
    const canvas = document.createElement('canvas');
    canvas.width = base.w;
    canvas.height = base.h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    drawCrop(ctx, scene, base, 0, 0);
    ctx.fillStyle = '#d8333f';
    for (const [ax, ay] of [[16, 10], [34, 6], [48, 14], [26, 22], [42, 26]]) {
      ctx.fillRect(ax, ay, 4, 4);
    }
    scene.textures.addCanvas('myth_apple', canvas);
  }

  const bake = (kind: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    draw(ctx);
    scene.textures.addCanvas(`myth_bld_${kind}`, canvas);
  };

  // The grand gabled houses (preview look), half scale + a fitted door.
  const gabled = (color: keyof typeof GABLE, door: Crop | null) => (ctx: CanvasRenderingContext2D) => {
    drawCrop(ctx, scene, GABLE[color], 0, 0, 80, 76);
    if (door) drawCrop(ctx, scene, door, 33, 50, 14, 26);
  };
  bake('house', 80, 76, gabled('red', DOOR_BROWN));
  // Same gable from the recolor sheets — different roofs along the street.
  for (const [n, sheet] of [['1', 'b1'], ['2', 'b2']] as Array<[string, SheetKey]>) {
    bake(`house${n}`, 80, 76, (ctx) => {
      drawCrop(ctx, scene, { sheet, x: 0, y: 0, w: 160, h: 152 }, 0, 0, 80, 76);
      drawCrop(ctx, scene, DOOR_BROWN, 33, 50, 14, 26);
    });
  }
  bake('archive', 80, 76, gabled('green', DOOR_DARK));
  bake('lab', 80, 76, (ctx) => {
    gabled('blue', null)(ctx);
    drawCrop(ctx, scene, WINDOW, 26, 52, 12, 12);
    drawCrop(ctx, scene, WINDOW, 44, 52, 12, 12);
  });

  // Smaller specialist huts.
  bake('market', 32, 64, (ctx) => {
    drawCrop(ctx, scene, WALL.brick, 0, 32);
    drawCrop(ctx, scene, ROOF.red, 0, 0);
    ctx.fillStyle = 'rgba(20,16,10,0.35)';
    ctx.fillRect(0, 32, 32, 2);
    drawCrop(ctx, scene, DOOR_BROWN, 9, 34, 14, 30);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#e8e4da' : '#c8453e';
      ctx.fillRect(4 + i * 6, 30, 6, 4);
    }
  });
  bake('generator', 32, 64, (ctx) => {
    drawCrop(ctx, scene, WALL.stone, 0, 32);
    drawCrop(ctx, scene, ROOF.slate, 0, 0);
    ctx.fillStyle = 'rgba(20,16,10,0.35)';
    ctx.fillRect(0, 32, 32, 2);
    drawCrop(ctx, scene, DOOR_DARK, 9, 34, 14, 30);
    ctx.fillStyle = '#ffe87a';
    ctx.fillRect(24, 6, 3, 7);
    ctx.fillRect(22, 12, 3, 7);
  });
  bake('shrine', 32, 64, (ctx) => drawCrop(ctx, scene, SHRINE_ARCH, 0, 0));
  bake('tower', 32, 64, (ctx) => drawCrop(ctx, scene, TOWER_SPIRE, 0, 0));
  bake('farm', 32, 32, (ctx) => {
    drawCrop(ctx, scene, FARM_FIELD, 0, 0);
    ctx.strokeStyle = '#7a4d2a';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 30, 30);
  });
}
