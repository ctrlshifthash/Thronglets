import { MAP_H, MAP_W } from './rules';

// ─────────────────────────────────────────────────────────────────────
// Grove generation. Every world is a forest clearing — dense trees
// ringing a soft meadow with apple trees, a pond, toys and stones —
// with per-culture garnish. Deterministic per seed.
// ─────────────────────────────────────────────────────────────────────

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CX = Math.floor(MAP_W / 2);
const CY = Math.floor(MAP_H / 2);

export class MapBuilder {
  cells: string[];

  constructor(fill = 'g') {
    this.cells = new Array(MAP_W * MAP_H).fill(fill);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
  }

  get(x: number, y: number): string {
    return this.inBounds(x, y) ? this.cells[y * MAP_W + x] : 't';
  }

  set(x: number, y: number, ch: string): void {
    if (this.inBounds(x, y)) this.cells[y * MAP_W + x] = ch;
  }

  blob(cx: number, cy: number, r: number, ch: string, rng: () => number): void {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r + (rng() - 0.5) * 1.6) this.set(x, y, ch);
      }
    }
  }

  clearCircle(cx: number, cy: number, r: number): void {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (Math.hypot(x - cx, y - cy) <= r) this.set(x, y, 'g');
      }
    }
  }

  scatter(ch: string, count: number, rng: () => number, on: (cur: string, x: number, y: number) => boolean): number {
    let placed = 0;
    for (let tries = 0; tries < 800 && placed < count; tries++) {
      const x = 1 + Math.floor(rng() * (MAP_W - 2));
      const y = 1 + Math.floor(rng() * (MAP_H - 2));
      if (!on(this.get(x, y), x, y)) continue;
      this.set(x, y, ch);
      placed++;
    }
    return placed;
  }

  /** Winding 2-wide trail; turns water into stepping planks. */
  path(x0: number, y0: number, x1: number, y1: number, ch: string, rng: () => number): void {
    let x = x0;
    let y = y0;
    let guard = 300;
    const lay = (px: number, py: number) => {
      const cur = this.get(px, py);
      this.set(px, py, cur === 'w' || cur === 'F' ? 'b' : ch);
    };
    // Lay the trail and a second tile perpendicular to travel (onto grass
    // only) so paths read as proper 2-wide trails, not thin grey poles.
    const layWide = (px: number, py: number, horizontal: boolean) => {
      lay(px, py);
      const wx = horizontal ? px : px + 1;
      const wy = horizontal ? py + 1 : py;
      if (this.get(wx, wy) === 'g') lay(wx, wy);
    };
    let horizontal = true;
    while ((x !== x1 || y !== y1) && guard-- > 0) {
      layWide(x, y, horizontal);
      if (rng() < 0.5 && x !== x1) {
        x += Math.sign(x1 - x);
        horizontal = true;
      } else if (y !== y1) {
        y += Math.sign(y1 - y);
        horizontal = false;
      } else if (x !== x1) {
        x += Math.sign(x1 - x);
        horizontal = true;
      }
    }
    layWide(x1, y1, horizontal);
  }

  toString(): string {
    return this.cells.join('');
  }
}

const inClearing = (x: number, y: number, margin = 5) =>
  x >= margin && y >= margin && x < MAP_W - margin && y < MAP_H - margin;

function awayFromPlaza(px: number, py: number, x: number, y: number, d = 3): boolean {
  return Math.abs(x - px) > d || Math.abs(y - py) > d;
}

/** Dense tree ring around the map edge — the grove's walls. */
function forestRing(m: MapBuilder, rng: () => number, pineShare: number): void {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const edge = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y);
      const depth = 2 + Math.floor(rng() * 2.4);
      if (edge < depth && rng() > 0.08) {
        m.set(x, y, rng() < pineShare ? 'u' : 't');
      }
    }
  }
}

/**
 * THE default grove. Every world — the six AI keepers' and every
 * player-raised one — uses this same canonical layout, drawn with the
 * Mythril Age tileset: a tree-walled clearing, soft meadow, a pond
 * crossed by a plank bridge, apple trees, berries, fences and toys.
 * The seed only nudges where things sit, never what the grove is.
 */
export function generateMap(_theme: string, seed: number): string {
  const rng = mulberry32(seed);
  const m = new MapBuilder('g');

  // The grove walls: grand trees mixed with round ones, with a few
  // inner copses so the big meadow doesn't read as one empty bowl.
  forestRing(m, rng, 0.45);
  for (let i = 0; i < 4; i++) {
    const cx = 7 + Math.floor(rng() * (MAP_W - 14));
    const cy = 7 + Math.floor(rng() * (MAP_H - 14));
    if (Math.abs(cx - CX) < 7 && Math.abs(cy - CY) < 7) continue; // never on the village
    m.blob(cx, cy, 1.6 + rng() * 1.4, rng() < 0.5 ? 't' : 'u', rng);
  }

  // Meadow texture across the clearing.
  m.scatter('v', 70, rng, (c, x, y) => c === 'g' && inClearing(x, y, 3));
  m.scatter('f', 30, rng, (c, x, y) => c === 'g' && inClearing(x, y, 3));
  m.scatter('m', 22, rng, (c, x, y) => c === 'g' && inClearing(x, y, 3)); // mossy patches
  m.scatter('d', 6, rng, (c, x, y) => c === 'g' && inClearing(x, y, 4)); // worn dirt
  m.scatter('r', 9, rng, (c, x, y) => c === 'g' && inClearing(x, y, 4));

  // Home clearing, slightly off-center.
  const px = CX + Math.floor((rng() - 0.5) * 8);
  const py = CY + Math.floor((rng() - 0.5) * 8);
  m.clearCircle(px, py, 3);

  // The lake — and a plank bridge where the trail crosses it.
  const sx = rng() < 0.5 ? -1 : 1;
  const lx = px + sx * 9;
  const ly = py + (rng() < 0.5 ? -7 : 7);
  m.blob(lx, ly, 3.6, 'w', rng);
  m.blob(lx + sx * 3, ly + 2, 2.2, 'w', rng); // a lobed shore, not a circle
  m.path(px, py + 1, lx + sx * 6, ly, 'p', rng); // path() lays 'b' planks over water

  // A second pool deeper in the trees.
  m.blob(px - sx * 10, py + (rng() < 0.5 ? -9 : 9), 2, 'w', rng);

  // Trails wandering off toward the far corners.
  m.path(px, py, px - sx * 12, py + (rng() < 0.5 ? -10 : 10), 'p', rng);
  m.path(px, py - 1, px + Math.floor((rng() - 0.5) * 8), py - 12, 'p', rng);

  // Apple trees, berry blooms, fences — the larder and the furniture.
  m.scatter('l', 12, rng, (c, x, y) => c === 'g' && inClearing(x, y) && awayFromPlaza(px, py, x, y));
  m.scatter('P', 6, rng, (c, x, y) => c === 'g' && inClearing(x, y) && awayFromPlaza(px, py, x, y));
  m.scatter('x', 8, rng, (c, x, y) => c === 'g' && inClearing(x, y) && awayFromPlaza(px, py, x, y));

  // Autumn trees and bushes — warm accents through the green.
  m.scatter('a', 7, rng, (c, x, y) => c === 'g' && inClearing(x, y) && awayFromPlaza(px, py, x, y));
  m.scatter('k', 12, rng, (c, x, y) => c === 'g' && inClearing(x, y) && awayFromPlaza(px, py, x, y, 2));

  // Mushroom clusters and the odd lantern — small life dotted around.
  m.scatter('q', 10, rng, (c, x, y) => c === 'g' && inClearing(x, y, 3));
  m.scatter('z', 4, rng, (c, x, y) => c === 'g' && Math.abs(x - px) <= 8 && Math.abs(y - py) <= 8 && awayFromPlaza(px, py, x, y, 2));

  // Toys and furniture near home — somewhere to play, somewhere to sit.
  m.scatter('o', 3, rng, (c, x, y) => c === 'g' && Math.abs(x - px) <= 6 && Math.abs(y - py) <= 6 && awayFromPlaza(px, py, x, y, 1));
  m.scatter('e', 3, rng, (c, x, y) => c === 'g' && Math.abs(x - px) <= 5 && Math.abs(y - py) <= 5 && awayFromPlaza(px, py, x, y, 1));
  m.scatter('j', 1, rng, (c, x, y) => c === 'g' && Math.abs(x - px) <= 4 && Math.abs(y - py) <= 4 && awayFromPlaza(px, py, x, y, 1));

  m.set(px, py, 'B');
  return m.toString();
}
