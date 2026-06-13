import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { MODEL_KEYS, PERSONAS, PLAYER_PERSONA, type TownPersona } from './personalities';
import { generateMap } from './worldgen';
import { buildingInstances, computeBuildingSlots, hashStr, plazaOf, walkGrid, isWalkable } from './townLayout';
import { parseQuestState, type QuestState } from './quests';
import { CLAIM_INTERVAL_MS } from './rewards';
import type { Agent, AgentRole, Buildings, ModelKey, TownEvent, TownStats } from './types';

// ─────────────────────────────────────────────────────────────────────
// SQLite via node:sqlite (built into Node >= 23). One row per town;
// the simulation engine (sim.ts) advances state lazily on read.
// ─────────────────────────────────────────────────────────────────────

export interface TownRow {
  slug: ModelKey;
  tick: number;
  last_tick_at: number;
  created_at: number;
  views: number;
  tilemap: string;
  traits: string; // JSON Traits (with per-town jitter)
  buildings: string; // JSON Buildings
  agents: string; // JSON Agent[]
  story: string; // JSON StoryState
  chatter: string; // JSON Chatter[] (recent exchanges, for speech bubbles)
  ai_state: string; // JSON: AI narrative budget/cache (see aiNarrative.ts)
  placements: string; // JSON Placement[] — structures at fixed tiles
  care: string; // JSON CareState — the keeper walking the grove
  is_player: number; // 1 = player-raised grove ("u_…" slug)
  owner_token: string; // secret for player-grove care actions
  creator_wallet: string; // Solana address that created this grove ('' = legacy/none)
  display_name: string; // player grove name
  map_version: number; // bumped when the canonical grove layout changes
  quests: string; // JSON QuestState — coins, claimed quests, care counters (player groves)
  payout_wallet: string; // Solana address this grove's rewards are paid to ('' = unlinked)
  pending_lamports: number; // accrued, unclaimed reward (lamports)
  last_claim_at: number; // ms timestamp of the last successful claim (cooldown anchor)
  lifetime_paid_lamports: number; // total ever paid out from this grove (audit)
  population: number;
  food: number;
  energy: number;
  compute: number;
  knowledge: number;
  happiness: number;
  stability: number;
  autonomy: number;
  weirdness: number;
}

const g = globalThis as unknown as { __emergenceDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!g.__emergenceDb) {
    const file = process.env.DATABASE_PATH || './data/emergence.db';
    mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    const d = new DatabaseSync(file);
    d.exec('PRAGMA journal_mode = WAL;');
    migrate(d);
    seedIfEmpty(d);
    g.__emergenceDb = d;
  }
  return g.__emergenceDb;
}

function migrate(d: DatabaseSync): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS towns (
      slug TEXT PRIMARY KEY,
      tick INTEGER NOT NULL DEFAULT 0,
      last_tick_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      views INTEGER NOT NULL DEFAULT 0,
      tilemap TEXT NOT NULL,
      traits TEXT NOT NULL,
      buildings TEXT NOT NULL,
      agents TEXT NOT NULL DEFAULT '[]',
      story TEXT NOT NULL DEFAULT '',
      chatter TEXT NOT NULL DEFAULT '[]',
      ai_state TEXT NOT NULL DEFAULT '',
      placements TEXT NOT NULL DEFAULT '[]',
      care TEXT NOT NULL DEFAULT '',
      is_player INTEGER NOT NULL DEFAULT 0,
      owner_token TEXT NOT NULL DEFAULT '',
      display_name TEXT NOT NULL DEFAULT '',
      map_version INTEGER NOT NULL DEFAULT 0,
      quests TEXT NOT NULL DEFAULT '{}',
      population REAL NOT NULL,
      food REAL NOT NULL,
      energy REAL NOT NULL,
      compute REAL NOT NULL,
      knowledge REAL NOT NULL,
      happiness REAL NOT NULL,
      stability REAL NOT NULL,
      autonomy REAL NOT NULL,
      weirdness REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS town_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      town_slug TEXT NOT NULL,
      tick INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'event',
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_town ON town_events(town_slug, id DESC);

    -- Reward ledger (Stage 2). Single-row global accrual cursor + a small
    -- holdings cache so settlement never has to hit the RPC in a loop.
    CREATE TABLE IF NOT EXISTS reward_state (
      id INTEGER PRIMARY KEY,
      last_window INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS holding_cache (
      wallet TEXT PRIMARY KEY,
      pct REAL NOT NULL DEFAULT 0,
      multiplier REAL NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    -- World-creation fee payments (anti-farm). One on-chain payment = one
    -- new world; the signature is the primary key so a payment can't be
    -- reused to mint multiple groves.
    CREATE TABLE IF NOT EXISTS fee_payments (
      signature TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      slug TEXT NOT NULL DEFAULT '',
      lamports INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Baseline the accrual cursor to the current window so the first settle
  // after boot never mistakes a fresh DB for a long backlog of windows.
  d.prepare('INSERT OR IGNORE INTO reward_state (id, last_window) VALUES (1, ?)').run(
    Math.floor(Date.now() / CLAIM_INTERVAL_MS)
  );

  // Additive migrations for databases created before agents/story existed.
  const cols = d.prepare('PRAGMA table_info(towns)').all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'agents')) {
    d.exec("ALTER TABLE towns ADD COLUMN agents TEXT NOT NULL DEFAULT '[]'");
  }
  if (!cols.some((c) => c.name === 'story')) {
    d.exec("ALTER TABLE towns ADD COLUMN story TEXT NOT NULL DEFAULT ''");
  }
  if (!cols.some((c) => c.name === 'chatter')) {
    d.exec("ALTER TABLE towns ADD COLUMN chatter TEXT NOT NULL DEFAULT '[]'");
  }
  if (!cols.some((c) => c.name === 'ai_state')) {
    d.exec("ALTER TABLE towns ADD COLUMN ai_state TEXT NOT NULL DEFAULT ''");
  }
  for (const [name, ddl] of [
    ['care', "ALTER TABLE towns ADD COLUMN care TEXT NOT NULL DEFAULT ''"],
    ['is_player', 'ALTER TABLE towns ADD COLUMN is_player INTEGER NOT NULL DEFAULT 0'],
    ['owner_token', "ALTER TABLE towns ADD COLUMN owner_token TEXT NOT NULL DEFAULT ''"],
    ['display_name', "ALTER TABLE towns ADD COLUMN display_name TEXT NOT NULL DEFAULT ''"],
    ['map_version', 'ALTER TABLE towns ADD COLUMN map_version INTEGER NOT NULL DEFAULT 0'],
    ['quests', "ALTER TABLE towns ADD COLUMN quests TEXT NOT NULL DEFAULT '{}'"],
    ['creator_wallet', "ALTER TABLE towns ADD COLUMN creator_wallet TEXT NOT NULL DEFAULT ''"],
    ['payout_wallet', "ALTER TABLE towns ADD COLUMN payout_wallet TEXT NOT NULL DEFAULT ''"],
    ['pending_lamports', 'ALTER TABLE towns ADD COLUMN pending_lamports INTEGER NOT NULL DEFAULT 0'],
    ['last_claim_at', 'ALTER TABLE towns ADD COLUMN last_claim_at INTEGER NOT NULL DEFAULT 0'],
    ['lifetime_paid_lamports', 'ALTER TABLE towns ADD COLUMN lifetime_paid_lamports INTEGER NOT NULL DEFAULT 0'],
  ] as const) {
    if (!cols.some((c) => c.name === name)) d.exec(ddl);
  }
  if (!cols.some((c) => c.name === 'placements')) {
    d.exec("ALTER TABLE towns ADD COLUMN placements TEXT NOT NULL DEFAULT '[]'");
    // Backfill: derive stable positions for already-built structures from the
    // historical deterministic slot order, so nothing teleports.
    const rows = d.prepare('SELECT slug, tilemap, buildings, tick FROM towns').all() as Array<{
      slug: string;
      tilemap: string;
      buildings: string;
      tick: number;
    }>;
    for (const r of rows) {
      try {
        const buildings = JSON.parse(r.buildings) as Buildings;
        const slots = computeBuildingSlots(r.tilemap, r.slug);
        const placements = buildingInstances(buildings, slots).map((b) => ({
          kind: b.kind,
          x: b.x,
          y: b.y,
          builtTick: r.tick,
        }));
        d.prepare('UPDATE towns SET placements = ? WHERE slug = ?').run(JSON.stringify(placements), r.slug);
      } catch { /* fresh towns handle themselves */ }
    }
  }
  // Towns that pre-date agents get a founding population (population stat → real agents).
  const empty = d.prepare("SELECT slug FROM towns WHERE agents = '[]'").all() as Array<{ slug: ModelKey }>;
  for (const row of empty) {
    const town = d.prepare('SELECT * FROM towns WHERE slug = ?').get(row.slug) as unknown as TownRow;
    const founders = spawnFounders(
      PERSONAS[row.slug],
      town.tilemap,
      JSON.parse(town.buildings) as Buildings,
      Math.max(8, Math.min(60, Math.round(town.population)))
    );
    d.prepare('UPDATE towns SET agents = ? WHERE slug = ?').run(JSON.stringify(founders), row.slug);
  }

  // Map v2 — the canonical Mythril grove. Every existing world (AI and
  // player-raised alike) is regenerated onto the new default layout:
  // buildings are re-seated on the fresh map, the little ones are moved
  // off any tile that is no longer walkable, and the keeper re-homes.
  const stale = d
    .prepare('SELECT slug, buildings, placements, agents, tick FROM towns WHERE map_version < ?')
    .all(MAP_VERSION) as Array<{ slug: string; buildings: string; placements: string; agents: string; tick: number }>;
  for (const r of stale) {
    try {
      const tilemap = generateMap('grove', hashStr(r.slug));
      const buildings = JSON.parse(r.buildings || '{}') as Buildings;
      const slots = computeBuildingSlots(tilemap, r.slug);

      // Re-seat buildings, preserving each one's original build day.
      let oldTicks: Partial<Record<string, number[]>> = {};
      try {
        const old = JSON.parse(r.placements || '[]') as Array<{ kind: string; builtTick: number }>;
        oldTicks = old.reduce<Partial<Record<string, number[]>>>((acc, p) => {
          (acc[p.kind] ??= []).push(p.builtTick);
          return acc;
        }, {});
      } catch { /* default below */ }
      const placements = buildingInstances(buildings, slots).map((b) => ({
        kind: b.kind,
        x: b.x,
        y: b.y,
        builtTick: oldTicks[b.kind]?.shift() ?? r.tick,
      }));

      // Nobody wakes up inside a tree or in the pond.
      const grid = walkGrid(tilemap, placements);
      const plaza = plazaOf(tilemap);
      const landing = (salt: number): { x: number; y: number } => {
        for (let rad = 1; rad < 10; rad++) {
          for (let i = 0; i < 14; i++) {
            const x = plaza.x + Math.round(Math.cos((i + salt) * 0.47) * rad);
            const y = plaza.y + Math.round(Math.sin((i + salt) * 0.47) * rad);
            if (isWalkable(grid, x, y)) return { x, y };
          }
        }
        return { x: plaza.x, y: plaza.y + 1 };
      };
      const agents = (JSON.parse(r.agents || '[]') as Agent[]).map((a) => {
        const out = { ...a };
        if (!isWalkable(grid, out.x, out.y)) {
          const s = landing(out.id);
          out.x = s.x;
          out.y = s.y;
        }
        if (!isWalkable(grid, out.tx, out.ty)) {
          out.tx = out.x;
          out.ty = out.y;
          out.task = 'idle';
        }
        return out;
      });

      d.prepare(
        "UPDATE towns SET tilemap = ?, placements = ?, agents = ?, care = '', map_version = ? WHERE slug = ?"
      ).run(tilemap, JSON.stringify(placements), JSON.stringify(agents), MAP_VERSION, r.slug);
    } catch { /* a grove that fails to migrate keeps its old map until next boot */ }
  }

  // One-time (PRAGMA user_version): the six AI groves were renamed from
  // their old culture names to their model's name. Rewrite any historical
  // text — timeline events, story beats, chatter — so nothing still reads
  // "Haven" where the grove is now "Claude". REPLACE is case-sensitive, so
  // only the capitalized grove names are touched, never words like "haven't".
  const uv = (d.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  if (uv < 1) {
    const RENAMES: Array<[string, string]> = [
      ['Lattice', 'GPT'],
      ['Haven', 'Claude'],
      ['Prism', 'Gemini'],
      ['Static', 'Grok'],
      ['Commons', 'Llama'],
      ['Gale', 'Mistral'],
    ];
    for (const [oldName, newName] of RENAMES) {
      d.prepare(
        `UPDATE town_events SET text = REPLACE(text, ?, ?)
         WHERE town_slug IN ('openai','claude','gemini','grok','llama','mistral')`
      ).run(oldName, newName);
      d.prepare('UPDATE towns SET story = REPLACE(story, ?, ?), chatter = REPLACE(chatter, ?, ?) WHERE is_player = 0').run(
        oldName,
        newName,
        oldName,
        newName
      );
    }
    d.exec('PRAGMA user_version = 1');
  }
}

export const now = (): number => Date.now();

/** Bumped whenever the canonical grove layout changes — stale worlds regenerate on boot. */
export const MAP_VERSION = 6; // v6: 2-wide trails (no thin path "poles")

/** How long one simulated day lasts in real time. */
export const TICK_MS = 3 * 60 * 1000;

/** Pre-age the universe so the first visitor finds living towns, not empty pens. */
const SEED_BACKFILL_TICKS = 40;

// ── Agent creation ───────────────────────────────────────────────────

export function pickRole(p: TownPersona, rand: number): AgentRole {
  const entries = Object.entries(p.roleWeights) as Array<[AgentRole, number]>;
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand * total;
  for (const [role, w] of entries) {
    r -= w;
    if (r <= 0) return role;
  }
  return 'free';
}

export function agentName(p: TownPersona, id: number): string {
  const base = p.agentNames[id % p.agentNames.length];
  const gen = Math.floor(id / p.agentNames.length);
  return gen === 0 ? base : `${base}-${gen + 1}`;
}

export function newAgent(p: TownPersona, id: number, x: number, y: number, rand: number): Agent {
  return {
    id,
    name: agentName(p, id),
    x,
    y,
    tx: x,
    ty: y,
    role: pickRole(p, rand),
    task: 'idle',
    nourish: 60 + Math.floor(rand * 30),
    energy: 60 + Math.floor(((rand * 7919) % 1) * 30),
    mood: 60,
    health: 90,
    fun: 70,
    clean: 75,
    age: 0,
  };
}

/** The founding generation, placed on walkable tiles around the plaza. */
export function spawnFounders(p: TownPersona, tilemap: string, buildings: Buildings, count: number): Agent[] {
  const slots = computeBuildingSlots(tilemap, p.slug);
  const grid = walkGrid(tilemap, buildingInstances(buildings, slots));
  const { x: px, y: py } = plazaOf(tilemap);

  const spots: Array<[number, number]> = [];
  for (let r = 1; r < 10 && spots.length < count; r++) {
    for (let dy = -r; dy <= r && spots.length < count; dy++) {
      for (let dx = -r; dx <= r && spots.length < count; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (isWalkable(grid, px + dx, py + dy)) spots.push([px + dx, py + dy]);
      }
    }
  }

  const agents: Agent[] = [];
  const seed = hashStr(p.slug);
  for (let i = 0; i < count; i++) {
    const [x, y] = spots[i % Math.max(1, spots.length)] ?? [px, py];
    const rand = ((seed ^ (i * 2654435761)) >>> 0) / 4294967296;
    agents.push(newAgent(p, i, x, y, rand));
  }
  return agents;
}

function seedIfEmpty(d: DatabaseSync): void {
  const count = (d.prepare('SELECT COUNT(*) AS c FROM towns').get() as { c: number }).c;
  if (count > 0) return;

  const t = now();
  const insert = d.prepare(
    `INSERT INTO towns (slug, tick, last_tick_at, created_at, views, tilemap, traits, buildings, agents, placements,
                        map_version, population, food, energy, compute, knowledge, happiness, stability, autonomy, weirdness)
     VALUES (?, 0, ?, ?, 0, ?, ?, ?, ?, ?, ${MAP_VERSION}, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const key of MODEL_KEYS) {
    const p = PERSONAS[key];
    // Tiny deterministic per-town jitter so traits aren't perfectly round.
    const jitter = (n: number, salt: number) =>
      Math.max(0, Math.min(1, n + (((p.mapSeed * (salt + 3)) % 13) - 6) / 200));
    const traits = Object.fromEntries(
      Object.entries(p.traits).map(([k, v], i) => [k, jitter(v, i)])
    );
    // Like the little ones deserve: each grove begins with a single pair.
    const buildings: Buildings = { house: 1, farm: 1, generator: 1, lab: 0, archive: 0, market: 0, shrine: 0, tower: 0 };
    const tilemap = generateMap('grove', hashStr(key)); // the one canonical grove, seeded per town
    const founders = spawnFounders(p, tilemap, buildings, 2);
    const placements = buildingInstances(buildings, computeBuildingSlots(tilemap, key)).map((b) => ({
      kind: b.kind,
      x: b.x,
      y: b.y,
      builtTick: 0,
    }));

    insert.run(
      key,
      t - SEED_BACKFILL_TICKS * TICK_MS, // catch-up simulates this history on first read
      t,
      tilemap,
      JSON.stringify(traits),
      JSON.stringify(buildings),
      JSON.stringify(founders),
      JSON.stringify(placements),
      founders.length, // population mirrors the real agents
      110, // food
      90, // energy
      4, // compute
      2, // knowledge
      70, // happiness
      key === 'grok' ? 55 : 75, // stability
      3, // autonomy
      key === 'grok' ? 14 : 3 // weirdness
    );
  }
}

// ── Queries ──────────────────────────────────────────────────────────

export function getTown(slug: string): TownRow | null {
  return (db().prepare('SELECT * FROM towns WHERE slug = ?').get(slug) as unknown as TownRow | undefined) ?? null;
}

/** The six AI groves (the observatory). */
export function listTowns(): TownRow[] {
  return db().prepare('SELECT * FROM towns WHERE is_player = 0').all() as unknown as TownRow[];
}

/** Every grove, including player-raised ones (background ticker). */
export function listAllTowns(): TownRow[] {
  return db().prepare('SELECT * FROM towns').all() as unknown as TownRow[];
}

/** Groves raised by people — public, anyone may spectate. Longest-lived first. */
export function listPlayerTowns(limit = 24): TownRow[] {
  return db()
    .prepare('SELECT * FROM towns WHERE is_player = 1 ORDER BY tick DESC LIMIT ?')
    .all(limit) as unknown as TownRow[];
}

/** Birth a player grove: a fresh clearing, two little ones, your hands. */
export function createPlayerTown(displayName: string, creatorWallet = ''): { slug: string; token: string } {
  const slug = `u_${crypto.randomBytes(4).toString('hex')}`;
  const token = crypto.randomBytes(16).toString('hex');
  const name = displayName.trim().slice(0, 20) || 'My Grove';
  const p: TownPersona = { ...PLAYER_PERSONA, slug: slug as ModelKey, name };
  const tilemap = generateMap('grove', hashStr(slug)); // same canonical grove as everyone

  const buildings: Buildings = { house: 1, farm: 1, generator: 1, lab: 0, archive: 0, market: 0, shrine: 0, tower: 0 };
  const founders = spawnFounders(p, tilemap, buildings, 2);
  const placements = buildingInstances(buildings, computeBuildingSlots(tilemap, slug)).map((b) => ({
    kind: b.kind,
    x: b.x,
    y: b.y,
    builtTick: 0,
  }));
  const t = now();
  db()
    .prepare(
      `INSERT INTO towns (slug, tick, last_tick_at, created_at, views, tilemap, traits, buildings, agents, placements,
                          is_player, owner_token, creator_wallet, payout_wallet, display_name, map_version,
                          population, food, energy, compute, knowledge, happiness, stability, autonomy, weirdness)
       VALUES (?, 0, ?, ?, 0, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ${MAP_VERSION}, ?, 90, 80, 4, 2, 70, 75, 3, 3)`
    )
    .run(
      slug, t, t, tilemap,
      JSON.stringify(p.traits), JSON.stringify(buildings), JSON.stringify(founders), JSON.stringify(placements),
      // The creating wallet also becomes the default payout wallet, so a
      // grove starts earning to its maker without a separate link step.
      token, creatorWallet, creatorWallet, name, founders.length
    );
  return { slug, token };
}

export interface LeaderboardEntry {
  slug: string; // links to the grove's public page (/town/<slug>)
  name: string;
  wallet: string; // payout wallet ('' if unlinked) — shortened before display
  earnedLamports: number; // total SOL ever paid out
  pendingLamports: number; // accrued, unclaimed
  coins: number;
}

/** Player groves ranked by real earnings (then pending, then coins). */
export function leaderboardRows(limit = 50): LeaderboardEntry[] {
  // Only groves linked to a wallet can earn, so the board lists those.
  const rows = db()
    .prepare(
      "SELECT slug, display_name, payout_wallet, lifetime_paid_lamports, pending_lamports, quests FROM towns WHERE is_player = 1 AND payout_wallet <> ''"
    )
    .all() as Array<{
    slug: string;
    display_name: string;
    payout_wallet: string;
    lifetime_paid_lamports: number;
    pending_lamports: number;
    quests: string;
  }>;
  return rows
    .map((r) => ({
      slug: r.slug,
      name: r.display_name || 'Unnamed Grove',
      wallet: r.payout_wallet || '',
      earnedLamports: r.lifetime_paid_lamports || 0,
      pendingLamports: r.pending_lamports || 0,
      coins: parseQuestState(r.quests).coins,
    }))
    // Rank by total earned (claimed + still-pending), then by coins.
    .sort(
      (a, b) =>
        b.earnedLamports + b.pendingLamports - (a.earnedLamports + a.pendingLamports) ||
        b.coins - a.coins
    )
    .slice(0, limit);
}

/** How many groves a wallet has created — drives the free-world allowance. */
export function countWorldsByCreator(wallet: string): number {
  if (!wallet) return 0;
  return (
    db().prepare('SELECT COUNT(*) AS c FROM towns WHERE is_player = 1 AND creator_wallet = ?').get(wallet) as {
      c: number;
    }
  ).c;
}

/** True if this payment signature has already been spent on a world. */
export function feePaymentExists(signature: string): boolean {
  return !!db().prepare('SELECT 1 FROM fee_payments WHERE signature = ?').get(signature);
}

/** Record a consumed fee payment so it can never be reused. */
export function recordFeePayment(signature: string, wallet: string, slug: string, lamports: number): void {
  db()
    .prepare('INSERT OR IGNORE INTO fee_payments (signature, wallet, slug, lamports, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(signature, wallet, slug, lamports, now());
}

export function saveTown(t: TownRow): void {
  db()
    .prepare(
      `UPDATE towns SET tick = ?, last_tick_at = ?, tilemap = ?, buildings = ?, agents = ?, story = ?, chatter = ?,
              placements = ?, care = ?, population = ?, food = ?, energy = ?,
              compute = ?, knowledge = ?, happiness = ?, stability = ?, autonomy = ?, weirdness = ?
        WHERE slug = ?`
    )
    .run(
      t.tick, t.last_tick_at, t.tilemap, t.buildings, t.agents, t.story, t.chatter, t.placements, t.care,
      t.population, t.food, t.energy,
      t.compute, t.knowledge, t.happiness, t.stability, t.autonomy, t.weirdness,
      t.slug
    );
}

export function addView(slug: string): void {
  db().prepare('UPDATE towns SET views = views + 1 WHERE slug = ?').run(slug);
}

/** Quest progress / coins live in their own column; saveTown never touches it. */
export function saveQuestState(slug: string, state: QuestState): void {
  db().prepare('UPDATE towns SET quests = ? WHERE slug = ?').run(JSON.stringify(state), slug);
}

export function mostViewedTown(): TownRow | null {
  return (db().prepare('SELECT * FROM towns ORDER BY views DESC, slug ASC LIMIT 1').get() as unknown as
    | TownRow
    | undefined) ?? null;
}

export function insertEvent(slug: string, tick: number, kind: TownEvent['kind'], text: string): void {
  db()
    .prepare('INSERT INTO town_events (town_slug, tick, kind, text, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(slug, tick, kind, text, now());
}

export function latestEvent(slug: string): TownEvent | null {
  const row = db()
    .prepare(
      'SELECT id, tick, kind, text, created_at AS createdAt FROM town_events WHERE town_slug = ? ORDER BY id DESC LIMIT 1'
    )
    .get(slug) as unknown as TownEvent | undefined;
  return row ?? null;
}

export function listEvents(slug: string, afterId = 0, limit = 80): TownEvent[] {
  if (afterId > 0) {
    return db()
      .prepare(
        'SELECT id, tick, kind, text, created_at AS createdAt FROM town_events WHERE town_slug = ? AND id > ? ORDER BY id ASC LIMIT ?'
      )
      .all(slug, afterId, limit) as unknown as TownEvent[];
  }
  const rows = db()
    .prepare(
      'SELECT id, tick, kind, text, created_at AS createdAt FROM town_events WHERE town_slug = ? ORDER BY id DESC LIMIT ?'
    )
    .all(slug, limit) as unknown as TownEvent[];
  return rows.reverse();
}

export function lastWhisperTick(slug: string): number {
  const row = db()
    .prepare("SELECT tick FROM town_events WHERE town_slug = ? AND kind = 'whisper' ORDER BY id DESC LIMIT 1")
    .get(slug) as { tick: number } | undefined;
  return row?.tick ?? -9999;
}

export function statsOf(t: TownRow): TownStats {
  return {
    population: Math.round(t.population),
    food: Math.round(t.food),
    energy: Math.round(t.energy),
    compute: Math.round(t.compute),
    knowledge: Math.round(t.knowledge),
    happiness: Math.round(t.happiness),
    stability: Math.round(t.stability),
    autonomy: Math.round(t.autonomy),
    weirdness: Math.round(t.weirdness),
  };
}
