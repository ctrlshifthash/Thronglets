import { MAP_H, MAP_W } from './rules';
import { TILES } from './tiles';
import type { Buildings } from './types';

// ─────────────────────────────────────────────────────────────────────
// Shared town geometry: where buildings stand and where agents can
// walk. Used by BOTH the server simulation (task targets, movement)
// and the Phaser observer (rendering) so they always agree.
// ─────────────────────────────────────────────────────────────────────

export const BUILDING_ORDER: Array<keyof Buildings> = [
  'house',
  'farm',
  'generator',
  'lab',
  'archive',
  'market',
  'shrine',
  'tower',
];

export const BUILDING_TILE: Record<keyof Buildings, string> = {
  house: 'h',
  farm: 'P',
  generator: 'C',
  lab: 'A',
  archive: 'Q',
  market: 'S',
  shrine: 'B',
  tower: 'A',
};

export interface BuildingInstance {
  kind: keyof Buildings;
  x: number;
  y: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function plazaOf(tilemap: string): { x: number; y: number } {
  const i = tilemap.indexOf('B');
  if (i < 0) return { x: Math.floor(MAP_W / 2), y: Math.floor(MAP_H / 2) };
  return { x: i % MAP_W, y: Math.floor(i / MAP_W) };
}

const GROUNDS = ['g', 'm', 'n', 'y', 's', 'd', 'p'];

/** Deterministic free spots where a town erects its buildings (seeded by slug). */
export function computeBuildingSlots(tilemap: string, slug: string): Array<[number, number]> {
  const { x: sx, y: sy } = plazaOf(tilemap);
  const candidates: Array<[number, number]> = [];
  for (let y = 2; y < MAP_H - 2; y++) {
    for (let x = 2; x < MAP_W - 2; x++) {
      const ch = tilemap[y * MAP_W + x];
      if (!GROUNDS.includes(ch)) continue;
      if (Math.hypot(x - sx, y - sy) < 2.5) continue;
      candidates.push([x, y]);
    }
  }
  const rng = mulberry32(hashStr(slug));
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  candidates.sort(
    (a, b) => Math.hypot(a[0] - sx, a[1] - sy) - Math.hypot(b[0] - sx, b[1] - sy) + (rng() - 0.5) * 3
  );
  const picked: Array<[number, number]> = [];
  for (const c of candidates) {
    if (picked.every((p) => Math.hypot(p[0] - c[0], p[1] - c[1]) >= 2)) picked.push(c);
    if (picked.length >= 40) break;
  }
  return picked;
}

/** Stable building→tile assignment: instance k of the order always uses slot k. */
export function buildingInstances(buildings: Buildings, slots: Array<[number, number]>): BuildingInstance[] {
  const out: BuildingInstance[] = [];
  let slot = 0;
  for (const kind of BUILDING_ORDER) {
    for (let n = 0; n < buildings[kind]; n++) {
      const pos = slots[slot++];
      if (!pos) continue;
      out.push({ kind, x: pos[0], y: pos[1] });
    }
  }
  return out;
}

/** Walkability grid: terrain minus occupied building tiles. */
export function walkGrid(tilemap: string, instances: BuildingInstance[]): boolean[] {
  const grid = new Array(MAP_W * MAP_H).fill(false);
  for (let i = 0; i < tilemap.length; i++) {
    grid[i] = TILES[tilemap[i]]?.walkable ?? false;
  }
  for (const b of instances) grid[b.y * MAP_W + b.x] = false;
  return grid;
}

export function isWalkable(grid: boolean[], x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false;
  return grid[y * MAP_W + x];
}

/** A walkable tile orthogonally adjacent to (x,y) — where an agent stands to "use" a building. */
export function adjacentStand(grid: boolean[], x: number, y: number, rng: () => number): { x: number; y: number } {
  const opts = [
    [x, y + 1],
    [x + 1, y],
    [x - 1, y],
    [x, y - 1],
  ].filter(([nx, ny]) => isWalkable(grid, nx, ny));
  if (opts.length === 0) return { x, y: y + 1 };
  const [ox, oy] = opts[Math.floor(rng() * opts.length)];
  return { x: ox, y: oy };
}

/**
 * One greedy step toward a target, preferring walkable tiles. Good
 * enough for a terrarium: no A*, but agents won't stand in the lake.
 */
export function stepToward(
  grid: boolean[],
  x: number,
  y: number,
  tx: number,
  ty: number,
  rng: () => number
): { x: number; y: number } {
  if (x === tx && y === ty) return { x, y };
  const dx = Math.sign(tx - x);
  const dy = Math.sign(ty - y);
  const tries: Array<[number, number]> = [];
  if (Math.abs(tx - x) >= Math.abs(ty - y)) {
    tries.push([x + dx, y], [x, y + dy], [x + dx, y + dy]);
  } else {
    tries.push([x, y + dy], [x + dx, y], [x + dx, y + dy]);
  }
  // Last resort: wiggle around obstacles.
  tries.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  for (const [nx, ny] of tries) {
    if ((nx !== x || ny !== y) && isWalkable(grid, nx, ny)) return { x: nx, y: ny };
  }
  return rng() < 0.5 ? { x, y } : { x, y };
}
