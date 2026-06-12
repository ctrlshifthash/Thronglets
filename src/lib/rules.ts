// ─────────────────────────────────────────────────────────────────────
// Shared constants for the renderer and map generator.
// (Simulation constants live in sim.ts; town flavor in personalities.ts.)
// ─────────────────────────────────────────────────────────────────────

export const MAP_W = 40;
export const MAP_H = 40;
export const TILE = 32; // px — matches the Mythril Age tileset; pattern sprites bake at 2×

// Legacy tag retained by the tile catalogue — in the simulator these
// mark decorative "yield" features (crops, veins, shoals, dens).
export const RESOURCES = ['fish', 'ore', 'plants', 'meat'] as const;
export type ResourceKind = (typeof RESOURCES)[number];

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
