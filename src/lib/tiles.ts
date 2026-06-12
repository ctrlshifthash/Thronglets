import type { ResourceKind } from './rules';

// ─────────────────────────────────────────────────────────────────────
// Tile catalogue. Every tile is one char in the world tilemap string.
// `art` is a 16×16 pixel pattern drawn with the PALETTE below; '.' is
// transparent and shows the `base` tile underneath (composed at
// texture-generation time). The same definitions drive the Phaser
// atlas, the builder palette and the universe-map thumbnails.
// ─────────────────────────────────────────────────────────────────────

export const PALETTE: Record<string, string> = {
  '0': '#1a1c2c', // outline
  '1': '#5d275d', // plum
  '2': '#b13e53', // red
  '3': '#ef7d57', // orange
  '4': '#ffcd75', // sand / skin
  '5': '#9ccb60', // light olive-green
  '6': '#55963f', // meadow green
  '7': '#2e6e34', // deep forest green
  '8': '#29366f', // deep navy
  '9': '#3b5dc9', // blue
  a: '#41a6f6', // light blue
  b: '#73eff7', // cyan
  c: '#f4f4f4', // white
  d: '#94b0c2', // light gray
  e: '#566c86', // gray
  f: '#333c57', // dark slate
  h: '#5e3b28', // dark brown
  i: '#8a5a37', // brown
  j: '#c28e4d', // light brown / plank
  k: '#ffe87a', // gold
};

export interface TileDef {
  ch: string;
  name: string;
  walkable: boolean;
  /** Tile this overlay is composed onto ('.' pixels show through). */
  base?: 'g' | 'w' | 's';
  resource?: ResourceKind;
  station?: 'quest' | 'shop' | 'craft';
  spawn?: boolean;
  /** Single representative color for universe-map thumbnails. */
  mapColor: string;
  group: 'terrain' | 'nature' | 'resource' | 'station';
  art: string[];
}

const GRASS_ART = [
  '6666666666666666',
  '6666666666666666',
  '6656666666666666',
  '6666666666665666',
  '6666666666666666',
  '6666656666666666',
  '6666666666666666',
  '6666666666666666',
  '6666666666656666',
  '6566666666666666',
  '6666666666666666',
  '6666666656666666',
  '6666666666666666',
  '6666666666666666',
  '6656666666666566',
  '6666666666666666',
];

const WATER_ART = [
  '9999999999999999',
  '99999bb999999999',
  '9999999999999999',
  '99999999999bb999',
  '99a9999999999999',
  '9999999988899999',
  '9999999999999999',
  '999bb99999999999',
  '99999999999999a9',
  '9999999999999999',
  '9888899999999999',
  '99999999bb999999',
  '9999999999999999',
  '9999a99999999999',
  '99bb999999999999',
  '9999999999999999',
];

/** Second animation frames (waves drift, ripples breathe). */
export const ALT_ART: Record<string, string[]> = {
  w: [
    '9999999999999999',
    '9999999bb9999999',
    '9999999999999999',
    '999999999999bb99',
    '999a999999999999',
    '9999999998889999',
    '9999999999999999',
    '9999bb9999999999',
    '9999999999999a99',
    '9999999999999999',
    '9988889999999999',
    '999999999bb99999',
    '9999999999999999',
    '99999a9999999999',
    '999bb99999999999',
    '9999999999999999',
  ],
  F: [
    '................',
    '...bbbbbb.......',
    '..b......b......',
    '.b........b.....',
    '.b..33....b.....',
    '.b.33330..b.....',
    '.b.23333..b.....',
    '.b........b.....',
    '..b......b......',
    '...bbbbbb.......',
    '................',
    '..........c.....',
    '................',
    '....c...........',
    '................',
    '................',
  ],
  A: [
    '.......1........',
    '......010.......',
    '.......0........',
    '......0e0.......',
    '.....0eee0......',
    '.......e........',
    '....0..e..0.....',
    '.....0.e.0......',
    '......0e0.......',
    '.......e........',
    '......0e0.......',
    '.....0.e.0......',
    '....0..e..0.....',
    '...0...e...0....',
    '....00eee00.....',
    '................',
  ],
};

const STONE_ART = [
  'dddddddeddddddde',
  'ddcddddeddddddde',
  'dddddddeddddddde',
  'dddddddeddddfdde',
  'dddddddeddddddde',
  'dddddddedcddddde',
  'dddddddeddddddde',
  'eeeeeeeeeeeeeeee',
  'dddedddddddedddd',
  'dddeddfddddedddd',
  'dddedddddddedddd',
  'dddedddddddeddcd',
  'dddedddddddedddd',
  'dcdedddddddedddd',
  'dddedddddddedddd',
  'eeeeeeeeeeeeeeee',
];

const MOSS_ART = [
  '7777777777777777',
  '7767777777777677',
  '7777777677777777',
  '7777777777777777',
  '7677777777767777',
  '7777777777777777',
  '7777767777777776',
  '7777777777877777',
  '7677777777777777',
  '7777777767777777',
  '7777777777777767',
  '7787777777777777',
  '7777777677777777',
  '7677777777767777',
  '7777777777777777',
  '7777776777777778',
];

const SAND_ART = [
  '4444444444444444',
  '444j444444444444',
  '4444444444j44444',
  '44444c4444444444',
  '4444444444444444',
  '44j4444444444j44',
  '4444444444444444',
  '4444444j44444444',
  '4444444444444444',
  '444444444444j444',
  '44j4444444444444',
  '4444444444444444',
  '44444j444444c444',
  '4444444444444444',
  '4444444444j44444',
  '4444444444444444',
];

const SNOW_ART = [
  'cccccccccccccccc',
  'ccdcccccccccdccc',
  'cccccccccccccccc',
  'ccccccbccccccccc',
  'cccccccccccccccc',
  'cdcccccccccdcccc',
  'cccccccccccccccc',
  'ccccccccdccccccc',
  'cccccccccccccccb',
  'cccccccccccccccc',
  'ccdccccccccccdcc',
  'cccccccccccccccc',
  'ccccccdccccccccc',
  'cccccccccccccccc',
  'cdcccccccccccccc',
  'cccccccccccccccc',
];

export const TILES: Record<string, TileDef> = {
  g: {
    ch: 'g',
    name: 'Grass',
    walkable: true,
    mapColor: '#3f9d4c',
    group: 'terrain',
    art: GRASS_ART,
  },
  m: {
    ch: 'm',
    name: 'Mossy grass',
    walkable: true,
    mapColor: '#2c7a45',
    group: 'terrain',
    art: MOSS_ART,
  },
  n: {
    ch: 'n',
    name: 'Sand',
    walkable: true,
    mapColor: '#e6cf95',
    group: 'terrain',
    art: SAND_ART,
  },
  y: {
    ch: 'y',
    name: 'Snow',
    walkable: true,
    mapColor: '#e8f0fa',
    group: 'terrain',
    art: SNOW_ART,
  },
  w: {
    ch: 'w',
    name: 'Water',
    walkable: false,
    mapColor: '#3f7fd9',
    group: 'terrain',
    art: WATER_ART,
  },
  s: {
    ch: 's',
    name: 'Stone floor',
    walkable: true,
    mapColor: '#9aa7b8',
    group: 'terrain',
    art: STONE_ART,
  },
  r: {
    ch: 'r',
    name: 'Rock',
    walkable: false,
    base: 'g',
    mapColor: '#6b7686',
    group: 'terrain',
    art: [
      '................',
      '.....00000......',
      '...00dddddd00...',
      '..0ddddeeeeee0..',
      '.0ddddeeeeeeee0.',
      '.0ddeeeeeeeeee0.',
      '.0deeeeeeeeeee0.',
      '.0eeeeeeeeeeee0.',
      '.0eeeeeeeeeeff0.',
      '.0feeeeeeeefff0.',
      '..0ffeeeefff0...',
      '..00ffffffff00..',
      '...0000000000...',
      '................',
      '................',
      '................',
    ],
  },
  p: {
    ch: 'p',
    name: 'Path',
    walkable: true,
    mapColor: '#d9b36a',
    group: 'terrain',
    art: [
      '4444444444444444',
      '44444j4444444444',
      '4444444444444j44',
      '44j4444444444444',
      '444444444j444444',
      '4444444444444444',
      '4444j44444444444',
      '444444444444j444',
      '4444444444444444',
      '44444444j4444444',
      '44j4444444444444',
      '4444444444444444',
      '444444j444444444',
      '4444444444444444',
      '4444444444j44444',
      '4444444444444444',
    ],
  },
  d: {
    ch: 'd',
    name: 'Tilled soil',
    walkable: true,
    mapColor: '#8a5a37',
    group: 'terrain',
    art: [
      'iiiiiiiiiiiiiiii',
      'iihiiiiiijiiiiii',
      'iiiiiiiiiiiiiiii',
      'iiiiijiiiiiihiii',
      'iiiiiiiiiiiiiiii',
      'ihiiiiiiihiiiiii',
      'iiiiiiiiiiiiiiii',
      'iiiiiiijiiiiiiii',
      'iiijiiiiiiiiihii',
      'iiiiiiiiiiiiiiii',
      'ihiiiiiiiiijiiii',
      'iiiiiiiiiiiiiiii',
      'iiiiiihiiiiiiiii',
      'iiiiiiiiiiiiijii',
      'iijiiiiiiiiiiiii',
      'iiiiiiiiiiiiiiii',
    ],
  },
  b: {
    ch: 'b',
    name: 'Bridge',
    walkable: true,
    mapColor: '#c28e4d',
    group: 'terrain',
    art: [
      '9999999999999999',
      '99999b9999999999',
      'hhhhhhhhhhhhhhhh',
      'jjjjjjjjjjjjjjjj',
      'jjjjjjjijjjjjjjj',
      'iiiiiiiiiiiiiiii',
      'jjjjjjjjjjjjjjjj',
      'jjjijjjjjjjjjijj',
      'iiiiiiiiiiiiiiii',
      'jjjjjjjjjjjjjjjj',
      'jjjjjjjjjjijjjjj',
      'iiiiiiiiiiiiiiii',
      'jjjjjjjjjjjjjjjj',
      'hhhhhhhhhhhhhhhh',
      '999999999b999999',
      '9999999999999999',
    ],
  },
  t: {
    ch: 't',
    name: 'Tree',
    walkable: false,
    base: 'g',
    mapColor: '#1f6e3d',
    group: 'nature',
    art: [
      '......0000......',
      '....00777700....',
      '...0777777770...',
      '..077777577770..',
      '.07775777777570.',
      '.07777777777770.',
      '.07777777577770.',
      '..077777777770..',
      '..077577777770..',
      '...0777777770...',
      '....00777700....',
      '......0hh0......',
      '......0hi0......',
      '......0hi0......',
      '......0hh0......',
      '................',
    ],
  },
  l: {
    ch: 'l',
    name: 'Apple tree',
    walkable: false,
    base: 'g',
    mapColor: '#3e8a2f',
    group: 'nature',
    art: [
      '......0000......',
      '....00777700....',
      '...0772777770...',
      '..077777577270..',
      '.07775727777570.',
      '.07777777777770.',
      '.07727777577770.',
      '..077777727770..',
      '..077577777770..',
      '...0777277770...',
      '....00777700....',
      '......0hh0......',
      '......0hi0......',
      '......0hi0......',
      '......0hh0......',
      '................',
    ],
  },
  o: {
    ch: 'o',
    name: 'Play ball',
    walkable: true,
    base: 'g',
    mapColor: '#d94f4f',
    group: 'nature',
    art: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '......0000......',
      '.....02cca0.....',
      '....02ccaa30....',
      '....0c2caa30....',
      '....0cc23330....',
      '.....0c2330.....',
      '......0000......',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  u: {
    ch: 'u',
    name: 'Pine tree',
    walkable: false,
    base: 'g',
    mapColor: '#1d5c3c',
    group: 'nature',
    art: [
      '.......00.......',
      '......0770......',
      '.....077770.....',
      '.....076770.....',
      '....07777770....',
      '....07767770....',
      '...0777777770...',
      '...0776777770...',
      '..077777777770..',
      '..077767777770..',
      '.07777777777770.',
      '.000000hh000000.',
      '......0hi0......',
      '......0hi0......',
      '.......00.......',
      '................',
    ],
  },
  v: {
    ch: 'v',
    name: 'Tall grass',
    walkable: true,
    base: 'g',
    mapColor: '#54b16a',
    group: 'nature',
    art: [
      '................',
      '....5...........',
      '...55......5....',
      '...5.......55...',
      '................',
      '.5..........5...',
      '.55.........5...',
      '................',
      '......5.........',
      '.....55....5....',
      '.....5.....55...',
      '................',
      '..5.........5...',
      '..55........55..',
      '................',
      '................',
    ],
  },
  f: {
    ch: 'f',
    name: 'Flowers',
    walkable: true,
    base: 'g',
    mapColor: '#7ed957',
    group: 'nature',
    art: [
      '................',
      '..2.........c...',
      '.252........c.c.',
      '..2.........c...',
      '................',
      '.........4......',
      '........444.....',
      '.....c...4......',
      '....c4c.........',
      '.....c..........',
      '................',
      '..........22....',
      '.........2442...',
      '..........22....',
      '....5...........',
      '................',
    ],
  },
  x: {
    ch: 'x',
    name: 'Fence',
    walkable: false,
    base: 'g',
    mapColor: '#8a5a37',
    group: 'nature',
    art: [
      '................',
      '..hh........hh..',
      '..ii........ii..',
      '..ii........ii..',
      'jjjjjjjjjjjjjjjj',
      'hhhhhhhhhhhhhhhh',
      '..ii........ii..',
      '..ii........ii..',
      'jjjjjjjjjjjjjjjj',
      'hhhhhhhhhhhhhhhh',
      '..ii........ii..',
      '..ii........ii..',
      '..hh........hh..',
      '................',
      '................',
      '................',
    ],
  },
  h: {
    ch: 'h',
    name: 'House',
    walkable: false,
    base: 'g',
    mapColor: '#b13e53',
    group: 'nature',
    art: [
      '......0000......',
      '....00222200....',
      '...0222222220...',
      '..022222222220..',
      '.02222222222220.',
      '0122222222222210',
      '0000000000000000',
      '.0jjjjjjjjjjjj0.',
      '.0jjbjjjjjjbjj0.',
      '.0jjjj0hh0jjjj0.',
      '.0jjjj0hh0jjjj0.',
      '.0jjjj0hh0jjjj0.',
      '.000000hh000000.',
      '................',
      '................',
      '................',
    ],
  },
  F: {
    ch: 'F',
    name: 'Fishing spot',
    walkable: false,
    base: 'w',
    resource: 'fish',
    mapColor: '#58c7f0',
    group: 'resource',
    art: [
      '................',
      '....bbbb........',
      '..bb....bb......',
      '.b........b.....',
      '.b..33....b.....',
      '.b.33330..b.....',
      '.b.23333..b.....',
      '..bb..c.bb......',
      '....bbbb........',
      '................',
      '..........c.....',
      '................',
      '....c...........',
      '................',
      '................',
      '................',
    ],
  },
  O: {
    ch: 'O',
    name: 'Ore vein',
    walkable: false,
    base: 'g',
    resource: 'ore',
    mapColor: '#e8c14a',
    group: 'resource',
    art: [
      '................',
      '....000000......',
      '...0ffffff0.....',
      '..0ffkffkff0....',
      '.0ffffkfffff0...',
      '.0fkffffkfff0...',
      '.0ffffkffff40...',
      '.0f4ffffkfff0...',
      '..0ffkfffff0....',
      '...00ffff00.....',
      '.....0000.......',
      '................',
      '......k.........',
      '................',
      '................',
      '................',
    ],
  },
  P: {
    ch: 'P',
    name: 'Berry bush',
    walkable: false,
    base: 'g',
    resource: 'plants',
    mapColor: '#2fae62',
    group: 'resource',
    art: [
      '................',
      '.....00000......',
      '...007777700....',
      '..0777677770....',
      '..07726777270...',
      '.0777277677770..',
      '.0767777277770..',
      '.0777727777670..',
      '..0777767770....',
      '...007777700....',
      '.....00000......',
      '....5..5........',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  M: {
    ch: 'M',
    name: 'Hunting den',
    walkable: false,
    base: 'g',
    resource: 'meat',
    mapColor: '#9c6b4f',
    group: 'resource',
    art: [
      '................',
      '......0000......',
      '....00iiii00....',
      '...0iiiiiiii0...',
      '..0iiii00iiii0..',
      '.0iii000000iii0.',
      '.0iii000000iii0.',
      '.0iihh0000hhii0.',
      '.0hhhh0000hhhh0.',
      '..0hhhhhhhhhh0..',
      '...00hhhhhh00...',
      '.....000000.....',
      '...c............',
      '..ccc...........',
      '................',
      '................',
    ],
  },
  Q: {
    ch: 'Q',
    name: 'Quest board',
    walkable: false,
    base: 'g',
    station: 'quest',
    mapColor: '#e2c178',
    group: 'station',
    art: [
      '................',
      '.00000000000000.',
      '.0jjjjjjjjjjjj0.',
      '.0jccccccccccj0.',
      '.0jcffcfcfcfcj0.',
      '.0jcfcfcfcfccj0.',
      '.0jccccc22cccj0.',
      '.0jcfcfcc2cccj0.',
      '.0jjjjjjjjjjjj0.',
      '.00000000000000.',
      '......ii........',
      '......ii........',
      '......ii........',
      '.....5ii5.......',
      '................',
      '................',
    ],
  },
  S: {
    ch: 'S',
    name: 'Trading post',
    walkable: false,
    base: 'g',
    station: 'shop',
    mapColor: '#e06666',
    group: 'station',
    art: [
      '.00000000000000.',
      '.0c2c2c2c2c2c20.',
      '.02c2c2c2c2c2c0.',
      '.00000000000000.',
      '..i..........i..',
      '..i..........i..',
      '..i...k......i..',
      '.00000000000000.',
      '.0jjjjjjjjjjjj0.',
      '.0jjjj4jjj4jjj0.',
      '.0jjjjjjjjjjjj0.',
      '.00000000000000.',
      '..hh........hh..',
      '................',
      '................',
      '................',
    ],
  },
  C: {
    ch: 'C',
    name: 'Craft bench',
    walkable: false,
    base: 'g',
    station: 'craft',
    mapColor: '#b0b7c3',
    group: 'station',
    art: [
      '................',
      '......00........',
      '.....0e0........',
      '......i.........',
      '....000000......',
      '....0ffff0......',
      '.....0ff0.......',
      '....000000......',
      '.00000000000000.',
      '.0jjjjjjjjjjjj0.',
      '.0jjjjjjjjjjjj0.',
      '.00000000000000.',
      '..ii........ii..',
      '..ii........ii..',
      '................',
      '................',
    ],
  },
  A: {
    ch: 'A',
    name: 'Antenna mast',
    walkable: false,
    base: 'g',
    mapColor: '#b0626a',
    group: 'station',
    art: [
      '.......2........',
      '......020.......',
      '.......0........',
      '......0e0.......',
      '.....0eee0......',
      '.......e........',
      '....0..e..0.....',
      '.....0.e.0......',
      '......0e0.......',
      '.......e........',
      '......0e0.......',
      '.....0.e.0......',
      '....0..e..0.....',
      '...0...e...0....',
      '....00eee00.....',
      '................',
    ],
  },
  B: {
    ch: 'B',
    name: 'Spawn beacon',
    walkable: true,
    base: 's',
    spawn: true,
    mapColor: '#73eff7',
    group: 'station',
    art: [
      '................',
      '................',
      '....bbbbbbbb....',
      '...b........b...',
      '..b....cc....b..',
      '..b...c..c...b..',
      '..b..c....c..b..',
      '..b..c.cc.c..b..',
      '..b..c....c..b..',
      '..b...c..c...b..',
      '..b....cc....b..',
      '...b........b...',
      '....bbbbbbbb....',
      '................',
      '................',
      '................',
    ],
  },
};

// Mythril-era scenery: these reuse existing pattern art as their legacy
// fallback (the observer draws them from the real tileset), but carry
// their own names, walkability and thumbnail colors.
TILES.a = { ...TILES.t, ch: 'a', name: 'Autumn tree', mapColor: '#c96a2e' };
TILES.k = { ...TILES.P, ch: 'k', name: 'Bush', resource: undefined, mapColor: '#3f9d4c' };
TILES.e = { ...TILES.x, ch: 'e', name: 'Stool', mapColor: '#5db05d' };
TILES.j = { ...TILES.r, ch: 'j', name: 'Table', mapColor: '#9c6b4f' };
// Small walkable decorations — little ones can wander right up to them.
TILES.q = { ...TILES.f, ch: 'q', name: 'Mushrooms', mapColor: '#c96a2e' };
TILES.z = { ...TILES.f, ch: 'z', name: 'Lantern', mapColor: '#ffe87a' };

export const TILE_CHARS = Object.keys(TILES);

export const RESOURCE_TILE: Record<ResourceKind, string> = {
  fish: 'F',
  ore: 'O',
  plants: 'P',
  meat: 'M',
};

export function isWalkable(ch: string): boolean {
  const t = TILES[ch];
  return t ? t.walkable : false;
}

/** Ground tiles that grass-based overlays (trees, rocks, stations…) can be re-composed onto. */
export const GROUND_TILES = ['g', 'm', 'n', 'y', 's', 'd', 'p'] as const;
export type GroundTile = (typeof GROUND_TILES)[number];

/**
 * Which ground a feature at (x,y) visually sits on, derived from its
 * orthogonal neighbors (majority vote). Lets a pine on a snowfield get
 * a snowy base and an ore vein in a quarry sit on stone — without
 * storing a second map layer.
 */
export function groundUnder(map: string | string[], x: number, y: number, w: number, h: number): GroundTile {
  const counts = new Map<string, number>();
  const look = (nx: number, ny: number) => {
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
    const ch = typeof map === 'string' ? map[ny * w + nx] : map[ny * w + nx];
    if ((GROUND_TILES as readonly string[]).includes(ch)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  };
  look(x - 1, y);
  look(x + 1, y);
  look(x, y - 1);
  look(x, y + 1);
  let best: GroundTile = 'g';
  let bestN = 0;
  for (const ch of GROUND_TILES) {
    const n = counts.get(ch) ?? 0;
    if (n > bestN) {
      bestN = n;
      best = ch;
    }
  }
  return best;
}

export function isInteractable(ch: string): boolean {
  const t = TILES[ch];
  return !!t && (!!t.resource || !!t.station);
}

/** Throws with a precise message if any art pattern is malformed. */
export function validateTileArt(): void {
  const sheets: Array<[string, string[]]> = [
    ...Object.entries(TILES).map(([ch, def]) => [ch, def.art] as [string, string[]]),
    ...Object.entries(ALT_ART).map(([ch, art]) => [`${ch}(alt)`, art] as [string, string[]]),
  ];
  for (const [ch, art] of sheets) {
    if (art.length !== 16) {
      throw new Error(`Tile '${ch}' has ${art.length} art rows, expected 16`);
    }
    art.forEach((row, i) => {
      if (row.length !== 16) {
        throw new Error(`Tile '${ch}' art row ${i} has length ${row.length}, expected 16: "${row}"`);
      }
      for (const px of row) {
        if (px !== '.' && !(px in PALETTE)) {
          throw new Error(`Tile '${ch}' art row ${i} uses unknown palette char '${px}'`);
        }
      }
    });
  }
}

// ── Creature sprites (the little ones) ───────────────────────────────
// Round yellow critters with a sprig on top and a role-colored scarf.
// 'T' is substituted with the scarf color at texture time. Frames:
// down/up/side × walk poses; side faces right, left renders flipX.
// Swap these patterns for real spritesheets later without touching code.

export const PLAYER_TINTS = ['#41a6f6', '#ef7d57', '#9ccb60', '#b13e53', '#f4f4f4', '#ffcd75', '#73eff7', '#5d275d'];

const CRIT_TOP = [
  '.....0....0.....',
  '.....0k..k0.....',
  '......0kk0......',
  '....00kkkk00....',
  '...0kkkkkkkk0...',
  '..0kkkkkkkkkk0..',
];
const CRIT_FACE_DOWN = [
  '..0kc0kkkkc0k0..',
  '..0k3kkkkkk3k0..',
  '..0kkkkkkkkkk0..',
];
const CRIT_FACE_UP = [
  '..0kkkkkkkkkk0..',
  '..0kkkkkkkkkk0..',
  '..0kkkkkkkkkk0..',
];
const CRIT_FACE_SIDE = [
  '..0kkkkkkc0kk0..',
  '..0kkkkkkkk3k0..',
  '..0kkkkkkkkkk0..',
];
const CRIT_BODY = [
  '...0kkkkkkkk0...',
  '...0kTTTTTTk0...',
  '...0kkkkkkkk0...',
  '....0kkkkkk0....',
];
const CRIT_FEET_A = [
  '....0k0..0k0....',
  '.....00..00.....',
  '................',
];
const CRIT_FEET_B = [
  '...0k0....0k0...',
  '....00....00....',
  '................',
];

export const CHAR_FRAMES: Record<string, string[]> = {
  down0: [...CRIT_TOP, ...CRIT_FACE_DOWN, ...CRIT_BODY, ...CRIT_FEET_A],
  down1: [...CRIT_TOP, ...CRIT_FACE_DOWN, ...CRIT_BODY, ...CRIT_FEET_B],
  up0: [...CRIT_TOP, ...CRIT_FACE_UP, ...CRIT_BODY, ...CRIT_FEET_A],
  up1: [...CRIT_TOP, ...CRIT_FACE_UP, ...CRIT_BODY, ...CRIT_FEET_B],
  side0: [...CRIT_TOP, ...CRIT_FACE_SIDE, ...CRIT_BODY, ...CRIT_FEET_A],
  side1: [...CRIT_TOP, ...CRIT_FACE_SIDE, ...CRIT_BODY, ...CRIT_FEET_B],
};

// ── Keeper sprite (the LLM caretaker who walks the grove) ────────────
// The old humanoid villager, robed in the town's accent color ('T'),
// wearing the straw hat — visually distinct from the creatures.
export const KEEPER_FRAMES: Record<string, string[]> = {
  down0: [
    '....00000000....',
    '...0hhhhhhhh0...',
    '..0hhhhhhhhhh0..',
    '..0hh444444hh0..',
    '..0h44444444h0..',
    '..0h40444404h0..',
    '..0h44444444h0..',
    '...044444440....',
    '...0TTTTTTTT0...',
    '..0TTTTTTTTTT0..',
    '..04TTTTTTTT40..',
    '..0TTTTTTTTTT0..',
    '...0TTTTTTTT0...',
    '...0ff0..0ff0...',
    '...0ff0..0ff0...',
    '....00....00....',
  ],
  down1: [
    '....00000000....',
    '...0hhhhhhhh0...',
    '..0hhhhhhhhhh0..',
    '..0hh444444hh0..',
    '..0h44444444h0..',
    '..0h40444404h0..',
    '..0h44444444h0..',
    '...044444440....',
    '...0TTTTTTTT0...',
    '..0TTTTTTTTTT0..',
    '..04TTTTTTTT40..',
    '..0TTTTTTTTTT0..',
    '...0TTTTTTTT0...',
    '....0ff00ff0....',
    '...0ff0...00....',
    '....00..........',
  ],
};

export const NPC_HAT = [
  '....44444444....',
  '..444444444444..',
  '................',
  '................',
];

export function validateCharArt(): void {
  const sheets = { ...CHAR_FRAMES, ...Object.fromEntries(Object.entries(KEEPER_FRAMES).map(([k, v]) => [`keeper:${k}`, v])) };
  for (const [k, rows] of Object.entries(sheets)) {
    if (rows.length !== 16) throw new Error(`Char frame '${k}' has ${rows.length} rows`);
    rows.forEach((row, i) => {
      if (row.length !== 16) throw new Error(`Char frame '${k}' row ${i} length ${row.length}: "${row}"`);
      for (const px of row) {
        if (px !== '.' && px !== 'T' && !(px in PALETTE)) {
          throw new Error(`Char frame '${k}' row ${i} unknown char '${px}'`);
        }
      }
    });
  }
}
