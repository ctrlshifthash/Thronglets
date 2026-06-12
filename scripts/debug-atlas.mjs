// Stub-draws every tile/ground/character combination the atlas bakes,
// catching bad pattern data without Phaser or a browser. Mirrors the
// composition loops in src/game/textures.ts (kept in sync by hand —
// the production drawPattern is additionally tolerant of short rows).
const { CHAR_FRAMES, GROUND_TILES, NPC_DEFS, NPC_HAT, PALETTE, PLAYER_TINTS, TILES } = await import(
  '../src/lib/tiles.ts'
);

const T = 16;
const ctx = { fillStyle: '', fillRect() {} };

function drawPattern(rows, map) {
  const h = Math.min(T, rows.length);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < T && x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const color = map ? map(ch) : (PALETTE[ch] ?? null);
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

let frames = 0;
let failed = 0;
function check(key, fn) {
  frames++;
  try {
    fn();
  } catch (e) {
    failed++;
    console.log(`FAIL ${key}: ${e.message}`);
  }
}

const variantGrounds = GROUND_TILES.filter((g) => g !== 'g');
for (const [ch, def] of Object.entries(TILES)) {
  const base = def.base ? TILES[def.base].art : null;
  check(`tile_${ch}`, () => {
    if (base) drawPattern(base);
    drawPattern(def.art);
  });
  if (def.base === 'g') {
    for (const ground of variantGrounds) {
      check(`tile_${ch}@${ground}`, () => {
        drawPattern(TILES[ground].art);
        drawPattern(def.art);
      });
    }
  }
}
PLAYER_TINTS.forEach((tint, v) => {
  for (const [name, rows] of Object.entries(CHAR_FRAMES)) {
    check(`char_${v}_${name}`, () => drawPattern(rows, (c) => (c === 'T' ? tint : (PALETTE[c] ?? null))));
  }
});
for (const npc of NPC_DEFS) {
  for (const alt of [0, 1]) {
    check(`npc_${npc.id}_${alt}`, () => {
      drawPattern(CHAR_FRAMES[`down${alt}`], (c) => (c === 'T' ? npc.tint : (PALETTE[c] ?? null)));
      drawPattern(NPC_HAT);
    });
  }
}

console.log(`${frames} frame combinations, ${failed} failed`);
if (failed) process.exit(1);
