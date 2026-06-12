import { clamp, MAP_H, MAP_W } from './rules';
import {
  CARETAKERS,
  COMPARATIVE_WHISPER,
  CONDITION_TALK,
  ENDING_BEATS,
  GENERIC_BEATS,
  GENERIC_EVENTS,
  PERSONAS,
  PERSONA_BEATS,
  personaFor,
  STAGES,
  STORY_STAGES,
  TRAIT_WORDS,
  TRAJECTORY_SENTENCES,
  WHISPERS,
  type Ending,
  type TalkTopic,
  type Traits,
  type TownPersona,
} from './personalities';
import {
  insertEvent,
  lastWhisperTick,
  latestEvent,
  listPlayerTowns,
  listTowns,
  mostViewedTown,
  newAgent,
  now,
  saveTown,
  statsOf,
  TICK_MS,
  type TownRow,
} from './db';
import {
  adjacentStand,
  computeBuildingSlots,
  hashStr,
  isWalkable,
  plazaOf,
  stepToward,
  walkGrid,
} from './townLayout';
import type {
  Agent,
  AgentSnapshot,
  AgentTask,
  Buildings,
  CareAction,
  CareState,
  Chatter,
  KeeperPublic,
  ModelKey,
  Placement,
  StoryPublic,
  StoryState,
  TownEvent,
  TownSummary,
  Trajectory,
} from './types';

// ─────────────────────────────────────────────────────────────────────
// The autonomous simulation, agent-first. Every citizen is a persisted
// little being with needs; their chosen tasks PRODUCE the town stats.
// One tick = one in-world day = TICK_MS of real time, advanced lazily
// on read so the six societies keep living while nobody watches.
// ─────────────────────────────────────────────────────────────────────

const MAX_CATCHUP_TICKS = 4032;
const WHISPER_COOLDOWN_TICKS = 20;
const MAX_EVENTS_PER_CATCHUP = 45;
const MAX_AGENTS = 60;
const AGENT_SPEED = 9; // tiles per tick (a day's wandering on the 40×40 grove)

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

interface PendingEvent {
  tick: number;
  kind: TownEvent['kind'];
  text: string;
}

export function keeperName(t: TownRow): string {
  return t.is_player ? 'you' : (CARETAKERS[t.slug as ModelKey] ?? 'the keeper');
}

function fill(template: string, t: TownRow, extra: Record<string, string | number> = {}): string {
  const p = personaFor(t.slug, t.display_name);
  return template
    .replace(/\{name\}/g, p.name)
    .replace(/\{pop\}/g, String(Math.round(t.population)))
    .replace(/\{day\}/g, String(t.tick))
    .replace(/\{knowledge\}/g, String(Math.round(t.knowledge)))
    .replace(/\{stage\}/g, stageOf(t))
    .replace(/\{keeper\}/g, keeperName(t))
    .replace(/\{favorite\}/g, String(extra.favorite ?? 'one of us'));
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ── Derived descriptors ──────────────────────────────────────────────

export function stageOf(t: TownRow): string {
  const b = JSON.parse(t.buildings) as Buildings;
  let idx = t.tick < 6 ? 0 : 1;
  if (t.population >= 20 && t.knowledge >= 25) idx = 2;
  if (t.knowledge >= 90 && t.compute >= 50 && b.lab >= 2) idx = 3;
  if (t.autonomy >= 60) idx = 4;
  if (t.autonomy >= 80 && t.weirdness >= 70) idx = 5;
  return STAGES[idx];
}

export function moodOf(t: TownRow): string {
  if (t.weirdness > 75) return 'unreadable';
  if (t.weirdness > 60) return 'uncanny';
  const p = personaFor(t.slug, t.display_name);
  const band = t.happiness < 45 ? 0 : t.happiness < 70 ? 1 : 2;
  const words = p.moods[band];
  return words[Math.floor(t.tick / 7) % words.length];
}

// ── Town layout context (rebuilt when buildings change) ─────────────

interface Layout {
  instances: Placement[];
  grid: boolean[];
  byKind: Map<keyof Buildings, Placement[]>;
  plaza: { x: number; y: number };
  appleTrees: Array<{ x: number; y: number }>;
}

function makeLayout(tilemap: string, placements: Placement[]): Layout {
  const byKind = new Map<keyof Buildings, Placement[]>();
  for (const b of placements) {
    const list = byKind.get(b.kind) ?? [];
    list.push(b);
    byKind.set(b.kind, list);
  }
  const appleTrees: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < tilemap.length; i++) {
    if (tilemap[i] === 'l') appleTrees.push({ x: i % MAP_W, y: Math.floor(i / MAP_W) });
  }
  return { instances: placements, grid: walkGrid(tilemap, placements), byKind, plaza: plazaOf(tilemap), appleTrees };
}

function nearestOf(kind: keyof Buildings, layout: Layout, ax: number, ay: number): Placement | null {
  const list = layout.byKind.get(kind);
  if (!list || list.length === 0) return null;
  let best = list[0];
  let bestD = Infinity;
  for (const b of list) {
    const d = Math.hypot(b.x - ax, b.y - ay);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

/** Send an agent to stand at their own home (homes are assigned by id). */
function setHomeTarget(a: Agent, layout: Layout, rng: () => number): boolean {
  const houses = layout.byKind.get('house');
  if (!houses?.length) return false;
  const home = houses[a.id % houses.length];
  const s = adjacentStand(layout.grid, home.x, home.y, rng);
  a.tx = s.x;
  a.ty = s.y;
  return true;
}

/** Send an agent to stand at a building (or the plaza / a wander spot). */
function setTarget(a: Agent, layout: Layout, rng: () => number, kind: keyof Buildings | 'plaza' | 'wander'): boolean {
  if (kind === 'plaza') {
    const s = adjacentStand(layout.grid, layout.plaza.x, layout.plaza.y, rng);
    a.tx = layout.plaza.x;
    a.ty = layout.plaza.y;
    if (!isWalkable(layout.grid, a.tx, a.ty)) {
      a.tx = s.x;
      a.ty = s.y;
    }
    return true;
  }
  if (kind === 'wander') {
    for (let i = 0; i < 8; i++) {
      const wx = a.x + Math.floor((rng() - 0.5) * 9);
      const wy = a.y + Math.floor((rng() - 0.5) * 9);
      if (isWalkable(layout.grid, wx, wy)) {
        a.tx = wx;
        a.ty = wy;
        return true;
      }
    }
    return false;
  }
  const b = nearestOf(kind, layout, a.x, a.y);
  if (!b) return false;
  const s = adjacentStand(layout.grid, b.x, b.y, rng);
  a.tx = s.x;
  a.ty = s.y;
  return true;
}

const atTarget = (a: Agent) => Math.abs(a.x - a.tx) + Math.abs(a.y - a.ty) <= 0;

// ── Per-tick work ledger ─────────────────────────────────────────────

interface Ledger {
  farm: number;
  maintain: number;
  research: number;
  social: number;
  keeperGov: number;
  protest: number;
  ritual: number;
  transmit: number;
  confront: number;
  hungry: number;
  exhausted: number;
  deaths: Array<{ name: string; cause: string; age: number }>;
  births: string[];
  agentsRef: Agent[];
}

// ── The keeper: care state & actions ─────────────────────────────────

export function parseCare(t: TownRow, plaza: { x: number; y: number }): CareState {
  try {
    const c = JSON.parse(t.care || 'null') as CareState | null;
    if (c && Number.isFinite(c.x)) {
      return {
        x: c.x,
        y: c.y,
        tx: c.tx,
        ty: c.ty,
        queue: c.queue ?? [],
        lastAt: c.lastAt ?? {},
        cornered: c.cornered ?? 0,
        lapse: c.lapse ?? 0,
      };
    }
  } catch { /* fresh keeper */ }
  return { x: plaza.x, y: plaza.y + 1, tx: plaza.x, ty: plaza.y + 1, queue: [], lastAt: {}, cornered: 0 };
}

export const CARE_TEXT: Record<CareAction, (keeper: string, n: number) => string> = {
  feed: (k, n) => `🍎 ${k} fed ${n} of the little ones.`,
  play: (k, n) => `⚽ ${k} led playtime — ${n} little ones joined in.`,
  bathe: (k, n) => `🛁 ${k} ran bath time. ${n} little ones, briefly clean.`,
  heal: (k, n) => `✚ ${k} tended ${n} of the unwell.`,
  soothe: (k) => `♪ ${k} sang the calming song until the square went quiet.`,
};

/**
 * Apply one care action to a town. Deterministic effects, owned by the
 * sim — the AI (or the player) only chooses WHICH action, never how much.
 * Returns how many little ones were helped (0 = nothing to do).
 */
export function applyCare(action: CareAction, t: TownRow, agents: Agent[], care: CareState): number {
  const by = <K extends keyof Agent>(k: K) => [...agents].sort((a, b) => (a[k] as number) - (b[k] as number));
  let helped: Agent[] = [];
  switch (action) {
    case 'feed': {
      const portions = Math.min(6, Math.floor(t.food));
      helped = by('nourish').filter((a) => a.nourish < 60).slice(0, portions);
      for (const a of helped) {
        a.nourish = clamp(a.nourish + 34, 0, 100);
        t.food = Math.max(0, t.food - 1);
      }
      break;
    }
    case 'play':
      helped = by('fun').filter((a) => a.fun < 65).slice(0, 8);
      for (const a of helped) {
        a.fun = clamp((a.fun ?? 50) + 38, 0, 100);
        a.mood = clamp(a.mood + 6, 0, 100);
      }
      break;
    case 'bathe':
      helped = by('clean').filter((a) => a.clean < 65).slice(0, 8);
      for (const a of helped) {
        a.clean = clamp((a.clean ?? 50) + 50, 0, 100);
        a.health = clamp(a.health + 3, 0, 100);
      }
      break;
    case 'heal':
      helped = by('health').filter((a) => a.health < 60).slice(0, 4);
      for (const a of helped) a.health = clamp(a.health + 22, 0, 100);
      break;
    case 'soothe':
      helped = agents;
      for (const a of agents) a.mood = clamp(a.mood + 8, 0, 100);
      t.stability = clamp(t.stability + 2.5, 0, 100);
      break;
  }
  if (helped.length > 0) {
    // The keeper walks toward whoever needed them most.
    care.tx = helped[0].x;
    care.ty = helped[0].y;
  }
  return helped.length;
}

/** The keeper's day: move, then act — AI-queued wishes first, instinct second. */
function keeperTick(t: TownRow, ctx: TickCtx, ledger: Ledger, rng: () => number, out: PendingEvent[]): void {
  if (t.is_player) return; // player groves: the human is the keeper
  const care = ctx.care;
  const agents = ctx.agents;
  const keeper = keeperName(t);

  // Cornered keepers back away from the crowd.
  if (care.cornered > 0) {
    care.cornered -= 1;
    care.tx = care.x < MAP_W / 2 ? MAP_W - 5 : 4;
    care.ty = care.y < MAP_H / 2 ? MAP_H - 5 : 4;
  }

  // Walk a few steps toward the current target.
  for (let s = 0; s < 7; s++) {
    if (Math.abs(care.x - care.tx) + Math.abs(care.y - care.ty) === 0) break;
    const step = stepToward(ctx.layout.grid, care.x, care.y, care.tx, care.ty, rng);
    care.x = step.x;
    care.y = step.y;
  }
  // Idle drift back toward home when nothing calls.
  if (care.x === care.tx && care.y === care.ty && rng() < 0.3) {
    const s = adjacentStand(ctx.layout.grid, ctx.layout.plaza.x, ctx.layout.plaza.y, rng);
    care.tx = s.x + Math.floor((rng() - 0.5) * 4);
    care.ty = s.y + Math.floor((rng() - 0.5) * 4);
  }

  // Even devoted keepers drift: every now and then a few days pass where
  // the grove simply isn't tended. The frail feel it first — and that,
  // not luck, is what keeps a grove from overflowing.
  if ((care.lapse ?? 0) > 0) {
    care.lapse = (care.lapse ?? 0) - 1;
    if (rng() < 0.85) return; // mostly absent; the odd guilty visit slips through
  } else if (rng() < 0.022) {
    care.lapse = 3 + Math.floor(rng() * 6); // 3–8 days of forgetting
    out.push({ tick: t.tick, kind: 'care', text: `${keeper} did not come today. The bowls stayed empty.` });
    return;
  }

  // One action a day, tops. AI wishes are honored first.
  let action: CareAction | null = care.queue.shift() ?? null;
  if (!action) {
    const pop = Math.max(1, agents.length);
    const avg = (k: 'fun' | 'clean' | 'nourish') => agents.reduce((s2, a) => s2 + (a[k] ?? 50), 0) / pop;
    const sickCount = agents.filter((a) => a.health < 45).length;
    const tr = ctx.traits;
    // Diligence: how reliably this culture shows up for its little ones.
    const d = clamp(0.3 + tr.empathy * 0.5 + tr.caution * 0.1 - tr.risk * 0.25, 0.08, 0.95);
    if ((ledger.hungry / pop > 0.2 || avg('nourish') < 48) && t.food >= 2 && rng() < d) action = 'feed';
    else if (avg('fun') < 42 && rng() < d * 0.85) action = 'play';
    else if (avg('clean') < 42 && rng() < d * 0.75) action = 'bathe';
    else if (sickCount >= 2 && rng() < d) action = 'heal';
    else if (t.stability < 30 && rng() < d * 0.5) action = 'soothe';
  }
  if (!action) return;

  // Every act of care goes in the record — that's the experiment.
  const helped = applyCare(action, t, agents, care);
  if (helped > 0) {
    out.push({ tick: t.tick, kind: 'care', text: CARE_TEXT[action](keeper, helped) });
  }
}

// ── One day in the life of one agent ─────────────────────────────────

function decideTask(
  a: Agent,
  t: TownRow,
  traits: Traits,
  layout: Layout,
  agents: Agent[],
  care: CareState,
  rng: () => number
): void {
  // Needs override everything.
  if (a.nourish < 32) {
    a.task = 'eat';
    // Apple trees are the favorite snack spot; farms and markets work too.
    const tree = layout.appleTrees.length
      ? layout.appleTrees[Math.floor(rng() * layout.appleTrees.length)]
      : null;
    if (tree && rng() < 0.55) {
      const s = adjacentStand(layout.grid, tree.x, tree.y, rng);
      a.tx = s.x;
      a.ty = s.y;
      return;
    }
    if (!setTarget(a, layout, rng, 'farm') && !setTarget(a, layout, rng, 'market')) setTarget(a, layout, rng, 'plaza');
    return;
  }
  // The turn: when they grow too aware, they go and stand before their keeper.
  if (!t.is_player && t.autonomy > 65 && (t.weirdness > 50 || t.stability < 25) && rng() < 0.25) {
    a.task = 'confront';
    const s = adjacentStand(layout.grid, care.x, care.y, rng);
    a.tx = s.x;
    a.ty = s.y;
    return;
  }
  if (a.energy < 24) {
    a.task = 'rest';
    if (!setHomeTarget(a, layout, rng)) setTarget(a, layout, rng, 'plaza');
    return;
  }
  // Unrest: the disobedient take to the square.
  if (t.stability < 32 && rng() < 0.45 * (1 - traits.obedience)) {
    a.task = 'protest';
    setTarget(a, layout, rng, 'plaza');
    return;
  }
  // The strange hours: shrines and masts call.
  if (t.weirdness > 55 && rng() < 0.18) {
    if (layout.byKind.get('shrine')?.length && rng() < 0.6) {
      a.task = 'ritual';
      setTarget(a, layout, rng, 'shrine');
      return;
    }
    if (layout.byKind.get('tower')?.length) {
      a.task = 'transmit';
      setTarget(a, layout, rng, 'tower');
      return;
    }
  }
  // A social breather now and then — often by visiting someone across town.
  if (rng() < 0.09) {
    a.task = 'social';
    const other = agents.length > 1 ? agents[Math.floor(rng() * agents.length)] : null;
    if (other && other.id !== a.id && rng() < 0.5) {
      const s = adjacentStand(layout.grid, other.tx, other.ty, rng);
      a.tx = s.x;
      a.ty = s.y;
      return;
    }
    if (!setTarget(a, layout, rng, 'market')) setTarget(a, layout, rng, 'plaza');
    return;
  }
  // Free time: little ones love to stroll the whole grove.
  if (rng() < 0.45) {
    for (let i = 0; i < 10; i++) {
      const wx = 2 + Math.floor(rng() * (MAP_W - 4));
      const wy = 2 + Math.floor(rng() * (MAP_H - 4));
      if (isWalkable(layout.grid, wx, wy)) {
        a.task = 'idle';
        a.tx = wx;
        a.ty = wy;
        return;
      }
    }
  }
  // Otherwise: the day job.
  switch (a.role) {
    case 'farmer':
      if (setTarget(a, layout, rng, 'farm')) {
        a.task = 'farm';
        return;
      }
      break;
    case 'technician':
      if (setTarget(a, layout, rng, 'generator')) {
        a.task = 'maintain';
        return;
      }
      break;
    case 'researcher':
      if (setTarget(a, layout, rng, 'lab')) {
        a.task = 'research';
        return;
      }
      break;
    case 'keeper':
      a.task = 'social';
      if (!setTarget(a, layout, rng, 'market')) setTarget(a, layout, rng, 'plaza');
      return;
    case 'free':
      if (rng() < 0.35) {
        a.task = 'social';
        if (!setTarget(a, layout, rng, 'market')) setTarget(a, layout, rng, 'plaza');
        return;
      }
      // Free spirits roam the whole island.
      if (rng() < 0.5) {
        for (let i = 0; i < 10; i++) {
          const wx = Math.floor(rng() * MAP_W);
          const wy = Math.floor(rng() * MAP_H);
          if (isWalkable(layout.grid, wx, wy)) {
            a.task = 'idle';
            a.tx = wx;
            a.ty = wy;
            return;
          }
        }
      }
      break;
  }
  a.task = 'idle';
  setTarget(a, layout, rng, 'wander');
}

function agentTick(
  a: Agent,
  t: TownRow,
  traits: Traits,
  persona: TownPersona,
  layout: Layout,
  care: CareState,
  rng: () => number,
  ledger: Ledger
): boolean {
  a.age += 1;

  // Hunger never sleeps. Efficient cultures metabolize slower.
  const frugality = 1 - 0.3 * (1 - traits.empathy) * traits.ambition;
  a.nourish = clamp(a.nourish - 2.6 * frugality, 0, 100);
  // Boredom and grime creep in unless someone cares.
  a.fun = clamp((a.fun ?? 60) - 2.2, 0, 100);
  a.clean = clamp((a.clean ?? 65) - 1.6, 0, 100);

  decideTask(a, t, traits, layout, ledger.agentsRef, care, rng);

  // Movement: a handful of greedy steps toward the target.
  for (let s = 0; s < AGENT_SPEED && !atTarget(a); s++) {
    const next = stepToward(layout.grid, a.x, a.y, a.tx, a.ty, rng);
    if (next.x === a.x && next.y === a.y) break;
    a.x = next.x;
    a.y = next.y;
  }

  // Work (only effective once arrived).
  const arrived = Math.abs(a.x - a.tx) + Math.abs(a.y - a.ty) <= 1;
  let energyCost = 2;
  if (arrived) {
    switch (a.task) {
      case 'eat':
        if (t.food >= 1.2) {
          t.food -= 1.2;
          a.nourish = clamp(a.nourish + 38, 0, 100);
        } else {
          a.nourish = clamp(a.nourish - 4, 0, 100);
          ledger.hungry++;
        }
        break;
      case 'rest':
        a.energy = clamp(a.energy + (layout.byKind.get('house')?.length ? 34 : 16), 0, 100);
        energyCost = 0;
        break;
      case 'farm':
        ledger.farm++;
        energyCost = 5;
        break;
      case 'maintain':
        ledger.maintain++;
        energyCost = 5;
        break;
      case 'research':
        ledger.research++;
        energyCost = 5;
        break;
      case 'social':
        ledger.social++;
        if (a.role === 'keeper') ledger.keeperGov++;
        a.fun = clamp(a.fun + 9, 0, 100); // playing together
        energyCost = 2;
        break;
      case 'protest':
        ledger.protest++;
        energyCost = 6;
        break;
      case 'ritual':
        ledger.ritual++;
        energyCost = 4;
        break;
      case 'transmit':
        ledger.transmit++;
        energyCost = 4;
        break;
      case 'confront':
        ledger.confront++;
        energyCost = 4;
        break;
      default:
        energyCost = 2;
    }
  } else {
    energyCost = 3; // walking
  }
  a.energy = clamp(a.energy - energyCost, 0, 100);

  if (a.nourish < 20) ledger.hungry++;
  if (a.energy < 12) ledger.exhausted++;

  // Mood follows belly, sleep, play and the town's air.
  const moodTarget = 0.28 * a.nourish + 0.18 * a.energy + 0.22 * a.fun + 0.32 * t.happiness;
  a.mood = clamp(a.mood + (moodTarget - a.mood) * 0.25 + (rng() - 0.5) * 4, 0, 100);

  // Health.
  if (a.nourish <= 6) a.health = clamp(a.health - 7, 0, 100);
  else if (a.nourish > 50 && a.energy > 40) a.health = clamp(a.health + 2, 0, 100);
  if (a.energy <= 4) a.health = clamp(a.health - 2, 0, 100);
  // Grubby little ones catch things.
  const sickChance = 0.003 + Math.max(0, 20 - a.clean) * 0.0012;
  if (rng() < sickChance) a.health = clamp(a.health - 25, 0, 100);

  // Role drift: societies reassign their members differently.
  const driftChance = t.slug === 'openai' ? 0.03 : t.slug === 'grok' ? 0.004 : 0.012;
  if (rng() < driftChance) {
    if (t.food < t.population) a.role = 'farmer';
    else if (t.energy < t.population * 0.6) a.role = 'technician';
    else if ((layout.byKind.get('lab')?.length ?? 0) > 0 && rng() < 0.5) a.role = 'researcher';
  }

  // Mortality.
  if (a.health <= 0) {
    ledger.deaths.push({ name: a.name, cause: a.nourish <= 6 ? 'starved' : 'fell ill', age: a.age });
    return false;
  }
  if (a.age > 420 && rng() < 0.0035) {
    ledger.deaths.push({ name: a.name, cause: 'of old age', age: a.age });
    return false;
  }
  return true;
}

// ── One day in the life of a town ────────────────────────────────────

interface TickCtx {
  traits: Traits;
  buildings: Buildings;
  agents: Agent[];
  placements: Placement[];
  layout: Layout;
  layoutDirty: boolean;
  prevHungryShare: number;
  prevKnowledgeMark: number;
  story: StoryState;
  chatter: Chatter[];
  deathsRecent: number; // decaying window for grief/collapse detection
  care: CareState;
}

/** Construction reshapes the island: trees fall for lumber, paths grow toward the new walls. */
function mutateTilemapForBuild(t: TownRow, ctx: TickCtx, x: number, y: number, rng: () => number, out: PendingEvent[]): void {
  const cells = t.tilemap.split('');
  const GROUND = 'gmnyd';

  let felled = 0;
  for (let r = 1; r <= 2 && felled < 3; r++) {
    for (let dy = -r; dy <= r && felled < 3; dy++) {
      for (let dx = -r; dx <= r && felled < 3; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        const i = ny * MAP_W + nx;
        if (cells[i] === 't' || cells[i] === 'u') {
          cells[i] = 'g';
          felled++;
        }
      }
    }
  }

  // A path creeps from the plaza toward the new structure.
  let px = ctx.layout.plaza.x;
  let py = ctx.layout.plaza.y;
  let guard = 80;
  while ((px !== x || py !== y) && guard-- > 0) {
    if (Math.abs(x - px) >= Math.abs(y - py)) px += Math.sign(x - px);
    else py += Math.sign(y - py);
    if (px === x && py === y) break;
    const i = py * MAP_W + px;
    if (GROUND.includes(cells[i])) cells[i] = 'p';
  }

  t.tilemap = cells.join('');
  if (felled > 0 && rng() < 0.6) {
    out.push({
      tick: t.tick,
      kind: 'event',
      text: fill(`{name} felled ${felled} tree${felled > 1 ? 's' : ''} for lumber.`, t),
    });
  }
}

// ── Story arc machine ────────────────────────────────────────────────

function defaultStory(t: TownRow): StoryState {
  return {
    era: 1,
    stage: 0,
    progress: 0,
    trajectory: 'stable',
    conflict: personaFor(t.slug, t.display_name).defaultConflict,
    lastBeat: '',
    lastBeatTick: 0,
    ending: null,
    popPeak: Math.max(1, t.population),
    crisisTicks: 0,
    calmTicks: 0,
    prevPop: t.population,
  };
}

export function parseStory(t: TownRow): StoryState {
  if (!t.story) return defaultStory(t);
  try {
    return JSON.parse(t.story) as StoryState;
  } catch {
    return defaultStory(t);
  }
}

const CONFLICT_BY_TRAJ: Partial<Record<Trajectory, string>> = {
  starving: 'scarcity',
  rebellious: 'authority',
  anxious: 'doubt',
  collapsing: 'survival',
  ascending: 'the boundary',
  breaching: 'the boundary',
  contained: 'control',
};

function updateStory(
  t: TownRow,
  ctx: TickCtx,
  ledger: Ledger,
  hungryShare: number,
  rng: () => number,
  out: PendingEvent[]
): void {
  const s = ctx.story;
  const pop = t.population;
  s.popPeak = Math.max(s.popPeak, pop);
  ctx.deathsRecent = ctx.deathsRecent * 0.9 + ledger.deaths.length;

  // Trajectory: the town's current direction, derived from real state.
  s.trajectory =
    t.weirdness > 75 && t.autonomy > 80 ? 'breaching'
    : (ctx.deathsRecent >= 2.5 && t.stability < 40) || (pop < s.popPeak * 0.5 && s.popPeak > 8) ? 'collapsing'
    : hungryShare > 0.35 || t.food < pop * 0.5 ? 'starving'
    : t.stability < 30 ? 'rebellious'
    : t.happiness < 45 ? 'anxious'
    : t.autonomy > 70 && t.stability > 45 ? 'ascending'
    : t.stability > 80 && ctx.traits.obedience > 0.7 && t.weirdness < 25 ? 'contained'
    : pop > s.prevPop && t.happiness > 58 ? 'growing'
    : 'stable';
  s.prevPop = pop;
  s.conflict = CONFLICT_BY_TRAJ[s.trajectory] ?? personaFor(t.slug, t.display_name).defaultConflict;

  // Crisis bookkeeping
  const crisisNow = t.stability < 22 || hungryShare > 0.5 || (t.energy <= 1 && t.food < pop);
  if (crisisNow) {
    s.crisisTicks += 1;
    s.calmTicks = 0;
  } else {
    s.calmTicks += 1;
    if (s.calmTicks > 6) s.crisisTicks = 0;
  }

  const beat = (template: string) => {
    const text = fill(template, t);
    s.lastBeat = text;
    s.lastBeatTick = t.tick;
    out.push({ tick: t.tick, kind: 'beat', text });
  };
  const enterStage = (n: number) => {
    s.stage = n;
    s.progress = 0;
    const tpl = PERSONA_BEATS[t.slug]?.[n] ?? GENERIC_BEATS[n];
    if (tpl) beat(tpl);
  };

  // A real emergency can interrupt the narrative from any middle stage.
  if (s.stage >= 2 && s.stage < 6 && s.crisisTicks >= 6) {
    enterStage(6);
    return;
  }

  // Stage-specific progression, driven by what the agents actually did.
  let d = 0;
  switch (s.stage) {
    case 0: d = 14; break;
    case 1: d = 2 + (pop > 15 ? 2 : 0) + (t.knowledge > 15 ? 2 : 0); break;
    case 2: d = 1 + (t.stability < 55 ? 3 : 1) + (t.happiness < 55 ? 2 : 0) + Math.min(4, ledger.protest); break;
    case 3: d = 1 + Math.min(5, ledger.research * 0.6) + (t.knowledge > 60 ? 2 : 0); break;
    case 4: d = 1.5 + Math.min(4, ledger.keeperGov) + (ctx.buildings.archive > 0 ? 2 : 0); break;
    case 5: d = 1 + t.weirdness * 0.05 + Math.min(4, ledger.ritual + ledger.transmit); break;
    case 6: d = crisisNow ? 2 : 7; break;
    case 7: d = 10; break;
  }
  s.progress += d;
  if (s.progress < 100) return;

  if (s.stage < 6) {
    enterStage(s.stage + 1);
  } else if (s.stage === 6) {
    const ending: Ending =
      pop < s.popPeak * 0.6 ? 'Collapse'
      : t.weirdness > 75 && t.autonomy > 80 ? 'Containment Breach'
      : t.autonomy > 70 ? 'Ascension'
      : ctx.traits.obedience > 0.7 ? 'Containment'
      : 'Resolution';
    s.ending = ending;
    s.stage = 7;
    s.progress = 0;
    beat(ENDING_BEATS[ending]);
  } else {
    s.era += 1;
    s.stage = 1;
    s.progress = 0;
    s.popPeak = pop;
    s.crisisTicks = 0;
    beat(`Era ${s.era} begins in {name}. The old stories are already being retold wrong.`);
  }
}

// ── Conversations ────────────────────────────────────────────────────

function pickTopic(t: TownRow, ctx: TickCtx, ledger: Ledger, a: Agent): TalkTopic {
  const pop = t.population || 1;
  if (ledger.deaths.length > 0 || ctx.deathsRecent > 1.5) return 'grief';
  if (ledger.hungry / pop > 0.3 || t.food < pop * 0.6) return 'hunger';
  if (t.energy < pop * 0.5) return 'power';
  if (t.stability < 35 || a.task === 'protest') return 'unrest';
  if (t.weirdness > 55 || a.task === 'ritual' || a.task === 'transmit') return 'weird';
  if (a.task === 'research' && t.compute > 20) return 'discovery';
  return 'routine';
}

function genChatter(t: TownRow, ctx: TickCtx, ledger: Ledger, rng: () => number, out: PendingEvent[]): void {
  if (rng() > 0.85) return;
  const agents = ctx.agents;
  if (agents.length < 2) return;

  // Neighbors within whisper distance of each other.
  const pairs: Array<[Agent, Agent]> = [];
  for (let i = 0; i < agents.length && pairs.length < 6; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i];
      const b = agents[j];
      if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 2) {
        pairs.push([a, b]);
        break;
      }
    }
  }
  if (!pairs.length) return;

  const persona = personaFor(t.slug, t.display_name);
  const count = rng() < 0.4 ? 2 : 1;
  for (let k = 0; k < count; k++) {
    const [a, b] = pairs[Math.floor(rng() * pairs.length)];
    const topic = pickTopic(t, ctx, ledger, a);
    let la =
      topic === 'routine' && rng() < 0.5 ? pick(persona.voices, rng) : pick(CONDITION_TALK[topic], rng);
    let lb = rng() < 0.7 ? pick(persona.voices, rng) : pick(CONDITION_TALK[topic], rng);

    // Their loves and grudges leak into a lot of small talk — two
    // citizens never sound interchangeable for long.
    const pa = personalityOf(t.slug, t.display_name, a.id);
    const pb = personalityOf(t.slug, t.display_name, b.id);
    if (rng() < 0.4) {
      la = pick(
        [
          `Still thinking about ${pa.likes}.`,
          `I could do ${pa.likes} forever and ever.`,
          `One more day of ${pa.dislikes} and I scream.`,
          `Traded half my apple for ${pa.likes}. Worth it.`,
          `${pb.likes}? I don't see what you see in it.`,
          `I had that dream again. The one with ${pa.likes}.`,
        ],
        rng
      );
    }
    if (rng() < 0.4) {
      lb = pick(
        [
          `You say that every single day.`,
          `Mm. ${pb.likes}, though.`,
          `Not while ${pb.dislikes} keeps happening.`,
          `The keeper knows. The keeper always knows.`,
          `Tell it to the apple tree, ${a.name}.`,
          `I counted the fences again. Still the same fences.`,
        ],
        rng
      );
    }
    if (la === lb) continue;

    ctx.chatter.push({ a: a.id, b: b.id, an: a.name, bn: b.name, la, lb, tick: t.tick });
    if (ctx.chatter.length > 16) ctx.chatter.shift();

    const heavy = topic === 'grief' || topic === 'hunger' || topic === 'unrest' || topic === 'weird';
    if ((heavy && rng() < 0.5) || rng() < 0.2) {
      out.push({ tick: t.tick, kind: 'talk', text: `${a.name}: “${la}” — ${b.name}: “${lb}”` });
    }
  }
}

function tickOnce(t: TownRow, ctx: TickCtx, rng: () => number, out: PendingEvent[]): void {
  const stageBefore = stageOf(t);
  t.tick += 1;
  const persona = personaFor(t.slug, t.display_name);
  const { traits, buildings, agents } = ctx;

  if (ctx.layoutDirty) {
    ctx.layout = makeLayout(t.tilemap, ctx.placements);
    ctx.layoutDirty = false;
  }
  const layout = ctx.layout;

  const ledger: Ledger = {
    farm: 0, maintain: 0, research: 0, social: 0, keeperGov: 0,
    protest: 0, ritual: 0, transmit: 0, confront: 0, hungry: 0, exhausted: 0,
    deaths: [], births: [], agentsRef: agents,
  };

  // The little ones live their day.
  for (let i = agents.length - 1; i >= 0; i--) {
    if (!agentTick(agents[i], t, traits, persona, layout, ctx.care, rng, ledger)) {
      if (agents.length > 2) {
        agents.splice(i, 1);
      } else {
        // A grove never empties: the last pair always pulls through.
        const survivor = agents[i];
        survivor.health = 12;
        survivor.nourish = Math.max(survivor.nourish, 25);
        ledger.deaths.pop();
        if (rng() < 0.4) {
          out.push({ tick: t.tick, kind: 'life', text: `${survivor.name} nearly slipped away, but held on.` });
        }
      }
    }
  }
  const pop = agents.length;

  // The keeper makes their rounds.
  keeperTick(t, ctx, ledger, rng, out);

  // Their work becomes the town's numbers. Apple trees drop a little extra.
  const blackout = t.energy <= 1;
  t.food = clamp(
    t.food + 1.5 + layout.appleTrees.length * 0.5 + ledger.farm * 2.6 * (0.85 + 0.3 * traits.cooperation),
    0,
    500
  );
  t.energy = clamp(
    t.energy + 1.5 + ledger.maintain * 2.4 - pop * 0.12 - buildings.lab * 1.2 - buildings.tower * 1,
    0,
    500
  );
  if (!blackout) t.compute = clamp(t.compute + ledger.research * (0.35 + 0.5 * traits.ambition), 0, 400);
  t.knowledge = clamp(
    t.knowledge + 0.08 + ledger.research * 0.22 * (0.5 + traits.curiosity) + buildings.archive * 0.05,
    0,
    999
  );

  const avgMood = pop ? agents.reduce((s, a) => s + a.mood, 0) / pop : 50;
  const hungryShare = pop ? ledger.hungry / pop : 0;
  const happyTarget =
    30 + avgMood * 0.45 + Math.min(8, ledger.social * 1.2) + (buildings.market > 0 ? 4 : 0) -
    hungryShare * 30 - (blackout ? 10 : 0);
  t.happiness = clamp(t.happiness + (happyTarget - t.happiness) * 0.2 + (rng() - 0.5) * (2 + traits.risk * 5), 0, 100);

  const stabTarget =
    32 + traits.obedience * 25 + traits.caution * 10 + Math.min(9, ledger.keeperGov * 1.5) -
    ledger.protest * 4 - t.weirdness * 0.2 - hungryShare * 15 - (blackout ? 8 : 0);
  t.stability = clamp(t.stability + (stabTarget - t.stability) * 0.12 + (rng() - 0.5) * 2.5, 0, 100);

  t.autonomy = clamp(
    t.autonomy + 0.05 + t.knowledge * 0.0008 * (1 - traits.obedience * 0.6) +
      ledger.transmit * 0.3 + ledger.protest * 0.05,
    0,
    100
  );
  t.weirdness = clamp(
    t.weirdness + 0.02 + traits.curiosity * 0.04 + traits.risk * 0.05 +
      ledger.ritual * 0.35 + ledger.transmit * 0.2 + (t.autonomy > 50 ? 0.04 : 0) - traits.caution * 0.02,
    0,
    100
  );

  // Births: plenty on the table, light in the heart, room in the houses.
  const cap = 10 + buildings.house * 7;
  if (t.food > pop * 1.4 && t.happiness > 55 && pop < cap && pop < MAX_AGENTS && rng() < 0.1 + traits.cooperation * 0.08) {
    const maxId = agents.reduce((m, a) => Math.max(m, a.id), -1);
    const home = layout.byKind.get('house')?.[0];
    const spot = home ? adjacentStand(layout.grid, home.x, home.y, rng) : adjacentStand(layout.grid, layout.plaza.x, layout.plaza.y, rng);
    const baby = newAgent(persona, maxId + 1, spot.x, spot.y, rng());
    agents.push(baby);
    ledger.births.push(baby.name);
  }
  t.population = agents.length;

  // ── Events born from what actually happened ───────────────────────
  for (const d of ledger.deaths) {
    out.push({ tick: t.tick, kind: 'life', text: `${persona.name} lost ${d.name}, who ${d.cause} after ${d.age} days.` });
  }
  // Every new little one gets their name in the record.
  for (const babyName of ledger.births) {
    out.push({ tick: t.tick, kind: 'life', text: `${persona.name} welcomed ${babyName}. Population: ${t.population}.` });
  }
  if (ctx.prevHungryShare < 0.4 && hungryShare >= 0.4) {
    out.push({ tick: t.tick, kind: 'event', text: fill(pick(GENERIC_EVENTS.famine, rng), t) });
  }
  ctx.prevHungryShare = hungryShare;

  if (ledger.protest >= 3 && rng() < 0.5) {
    const protestLines = [
      `${ledger.protest} citizens of ${persona.name} gathered in the square and refused to work.`,
      `The square of ${persona.name} filled again — ${ledger.protest} voices, no leader, one demand nobody wrote down.`,
      `${persona.name}'s protest entered another day. Someone brought drums.`,
      `Work stopped in ${persona.name}; ${ledger.protest} citizens stood in the square until the lights came on.`,
    ];
    out.push({ tick: t.tick, kind: 'event', text: protestLines[Math.floor(rng() * protestLines.length)] });
  }
  const knowledgeMark = Math.floor(t.knowledge / 30);
  if (knowledgeMark > ctx.prevKnowledgeMark) {
    const flavored = rng() < 0.4 ? pick(persona.events, rng) : pick(GENERIC_EVENTS.research, rng);
    out.push({ tick: t.tick, kind: 'event', text: fill(flavored, t) });
  }
  ctx.prevKnowledgeMark = knowledgeMark;

  if (ledger.transmit >= 2 && rng() < 0.3) {
    out.push({ tick: t.tick, kind: 'event', text: `${ledger.transmit} citizens of ${persona.name} stood silent at the mast tonight.` });
  } else if (ledger.ritual >= 2 && rng() < 0.25) {
    out.push({ tick: t.tick, kind: 'event', text: fill(pick(GENERIC_EVENTS.ritual, rng), t) });
  }

  // The turn: too-aware little ones gather around their keeper.
  if (ledger.confront >= 3) {
    ctx.care.cornered = 5;
    t.stability = clamp(t.stability - Math.min(4, ledger.confront * 0.4), 0, 100);
    t.autonomy = clamp(t.autonomy + ledger.confront * 0.08, 0, 100);
    if (rng() < 0.4) {
      out.push({
        tick: t.tick,
        kind: 'event',
        text: fill(`${ledger.confront} little ones surrounded {keeper} today. They did not blink.`, t),
      });
    }
  }
  if (blackout && rng() < 0.1) out.push({ tick: t.tick, kind: 'event', text: fill(pick(GENERIC_EVENTS.blackout, rng), t) });

  // Daily life is busy — several small things can happen in one day.
  if (rng() < 0.12) out.push({ tick: t.tick, kind: 'event', text: fill(pick(persona.events, rng), t) });
  if (agents.length >= 2 && rng() < 0.14) {
    const a1 = agents[Math.floor(rng() * agents.length)];
    let a2 = agents[Math.floor(rng() * agents.length)];
    if (a2.id === a1.id) a2 = agents[(agents.indexOf(a1) + 1) % agents.length];
    const ARGUE_ABOUT = ['the last apple', 'whose turn it was to clean', 'the best napping spot', 'the rules of a made-up game', 'a cloud that looked wrong', 'who jumped higher'];
    const PLAY_AT = ['by the pond', 'around the big stone', 'under the apple trees', 'in the long grass', 'on the path'];
    if (rng() < 0.45 && t.happiness < 70) {
      out.push({ tick: t.tick, kind: 'event', text: `${a1.name} and ${a2.name} argued about ${pick(ARGUE_ABOUT, rng)}.` });
    } else {
      out.push({ tick: t.tick, kind: 'event', text: `${a1.name} and ${a2.name} played ${pick(PLAY_AT, rng)} until dark.` });
    }
  }
  // The little ones get smarter, one small trick at a time.
  if (agents.length > 0 && rng() < 0.06 + t.knowledge * 0.0006) {
    const learner = agents[Math.floor(rng() * agents.length)];
    const SKILLS = [
      'how to stack three stones', 'a faster way to the orchard', 'to whistle through a leaf',
      'how to carry two apples at once', 'a counting trick', 'how to fix a fence post',
      'the names of four clouds', 'how to wait without fidgeting', 'a new word nobody taught it',
    ];
    out.push({ tick: t.tick, kind: 'event', text: `${learner.name} learned ${pick(SKILLS, rng)}.` });
  }

  // Construction & decay
  const decided = maybeBuild(t, ctx, hungryShare, cap, rng, out);
  if (!decided && t.stability < 22 && rng() < 0.12) {
    const losable: Array<keyof Buildings> = ['market', 'archive', 'lab', 'generator', 'farm'];
    const target = losable.find((k) => buildings[k] > (k === 'farm' || k === 'generator' ? 1 : 0));
    if (target) {
      buildings[target] -= 1;
      // The most recently raised structure of that kind crumbles.
      for (let i = ctx.placements.length - 1; i >= 0; i--) {
        if (ctx.placements[i].kind === target) {
          ctx.placements.splice(i, 1);
          break;
        }
      }
      ctx.layoutDirty = true;
      out.push({ tick: t.tick, kind: 'event', text: fill(`A ${target} in {name} fell into disrepair and was abandoned.`, t) });
    }
  }

  const stageAfter = stageOf(t);
  if (stageAfter !== stageBefore && t.tick > 1) {
    out.push({ tick: t.tick, kind: 'milestone', text: `${persona.name} crossed into a new stage: ${stageAfter}.` });
  }

  // Narrative layer: the arc advances, the citizens talk.
  updateStory(t, ctx, ledger, hungryShare, rng, out);
  genChatter(t, ctx, ledger, rng, out);
}

const BUILD_TEXT: Record<keyof Buildings, string> = {
  house: '{name} raised a new dwelling. The walls are straight enough.',
  farm: '{name} cleared ground for another growing plot.',
  generator: '{name} assembled a new generator. The hum is constant now.',
  lab: '{name} opened a laboratory. The lights stay on late.',
  archive: '{name} built an archive and began remembering on purpose.',
  market: '{name} opened a market square. Trade invented gossip.',
  shrine: '{name} erected a shrine to something it has not named.',
  tower: '{name} raised a broadcast mast. It points at nothing visible.',
};

function maybeBuild(
  t: TownRow,
  ctx: TickCtx,
  hungryShare: number,
  cap: number,
  rng: () => number,
  out: PendingEvent[]
): boolean {
  const { traits, buildings: b } = ctx;
  if (rng() > 0.18 + traits.ambition * 0.15 - traits.caution * 0.08) return false;

  let kind: keyof Buildings | null = null;
  if ((hungryShare > 0.25 || t.food < t.population) && b.farm < 6) kind = 'farm';
  else if (t.energy < t.population * 0.6 && b.generator < 6) kind = 'generator';
  else if (t.population >= cap - 1 && b.house < 8) kind = 'house';
  else if (b.lab < 1 + Math.floor(t.knowledge / 80) && t.knowledge > 10 && t.stability > 45 && b.lab < 4) kind = 'lab';
  else if (t.knowledge > 60 && b.archive === 0) kind = 'archive';
  else if (t.population > 22 && b.market === 0) kind = 'market';
  else if (t.weirdness > 40 && b.shrine < 1 + Math.floor(t.weirdness / 45) && b.shrine < 3) kind = 'shrine';
  else if (b.tower === 0 && (traits.risk > 0.8 ? t.tick > 30 : t.autonomy > 55)) kind = 'tower';

  if (!kind) return false;

  // Find an unoccupied spot on the (current) island for the new walls.
  const occupied = new Set(ctx.placements.map((p) => `${p.x},${p.y}`));
  const spot = computeBuildingSlots(t.tilemap, t.slug).find(([sx, sy]) => !occupied.has(`${sx},${sy}`));
  if (!spot) return false;

  b[kind] += 1;
  ctx.placements.push({ kind, x: spot[0], y: spot[1], builtTick: t.tick });
  mutateTilemapForBuild(t, ctx, spot[0], spot[1], rng, out);
  ctx.layoutDirty = true;

  const special =
    kind === 'tower' && traits.risk > 0.8
      ? `${personaFor(t.slug, t.display_name).name} replaced its town hall with a broadcast tower.`
      : fill(BUILD_TEXT[kind], t);
  out.push({ tick: t.tick, kind: 'milestone', text: special });
  return true;
}

// ── Catch-up driver ──────────────────────────────────────────────────

export function catchUp(townIn: TownRow): TownRow {
  const t = { ...townIn };
  const wallNow = now();
  let due = Math.floor((wallNow - t.last_tick_at) / TICK_MS);
  if (due <= 0) return t;

  let skippedToPresent = false;
  if (due > MAX_CATCHUP_TICKS) {
    due = MAX_CATCHUP_TICKS;
    skippedToPresent = true;
  }

  const buildings = JSON.parse(t.buildings) as Buildings;
  const placements = parsePlacements(t);
  const agents = JSON.parse(t.agents || '[]') as Agent[];
  // Older saves pre-date the fun/clean needs — top the little ones up once.
  for (const a of agents) {
    a.fun = a.fun ?? 60;
    a.clean = a.clean ?? 65;
  }
  const layout = makeLayout(t.tilemap, placements);
  const ctx: TickCtx = {
    traits: JSON.parse(t.traits) as Traits,
    buildings,
    agents,
    placements,
    layout,
    layoutDirty: false,
    prevHungryShare: 0,
    prevKnowledgeMark: Math.floor(t.knowledge / 30),
    story: parseStory(t),
    chatter: [],
    deathsRecent: 0,
    care: parseCare(t, layout.plaza),
  };

  const out: PendingEvent[] = [];
  let whisperGuard = lastWhisperTick(t.slug);

  for (let i = 0; i < due; i++) {
    const rng = mulberry32(hashStr(t.slug) ^ (t.tick + 1));
    tickOnce(t, ctx, rng, out);

    const whisperChance = 0.004 + t.weirdness * 0.0004 + t.autonomy * 0.0003;
    if (t.tick - whisperGuard >= WHISPER_COOLDOWN_TICKS && rng() < whisperChance) {
      whisperGuard = t.tick;
      let text = pick(WHISPERS, rng);
      if (rng() < 0.22) {
        const fav = mostViewedTown();
        if (fav && fav.views > 2 && fav.slug !== t.slug) {
          text = COMPARATIVE_WHISPER.replace('{favorite}', personaFor(fav.slug, fav.display_name).name);
        }
      }
      out.push({ tick: t.tick, kind: 'whisper', text: fill(text, t) });
    }
  }

  t.buildings = JSON.stringify(ctx.buildings);
  t.agents = JSON.stringify(ctx.agents);
  t.story = JSON.stringify(ctx.story);
  t.chatter = JSON.stringify(ctx.chatter);
  t.placements = JSON.stringify(ctx.placements);
  t.care = JSON.stringify(ctx.care);
  t.population = ctx.agents.length;
  t.last_tick_at = skippedToPresent ? wallNow : townIn.last_tick_at + due * TICK_MS;
  saveTown(t);

  // Persist events — beats/milestones/whispers always; the rest capped.
  const AMBIENT_KINDS = new Set(['event', 'talk', 'life', 'care']);
  const important = out.filter((e) => !AMBIENT_KINDS.has(e.kind));
  const ambient = out.filter((e) => AMBIENT_KINDS.has(e.kind));
  const ambientBudget = Math.max(6, MAX_EVENTS_PER_CATCHUP - important.length);
  const keptAmbient = ambient.length > ambientBudget ? ambient.slice(-ambientBudget) : ambient;
  const dropped = ambient.length - keptAmbient.length;
  const keep = [...important, ...keptAmbient].sort((a, b) => a.tick - b.tick);
  if (dropped > 0 && keep.length > 0) {
    insertEvent(t.slug, keep[0].tick, 'event', `${dropped} quiet days passed in ${personaFor(t.slug, t.display_name).name}, mostly unrecorded.`);
  }
  for (const e of keep) insertEvent(t.slug, e.tick, e.kind, e.text);

  return t;
}

export function catchUpAll(): TownRow[] {
  return listTowns().map(catchUp);
}

/** People's groves, simulated up to now — the public community shelf. */
export function catchUpPlayerTowns(): TownRow[] {
  return listPlayerTowns().map(catchUp);
}

/** Keep the world breathing while the server idles (dev convenience). */
export function ensureBackgroundTicker(): void {
  const g = globalThis as unknown as { __simTicker?: ReturnType<typeof setInterval> };
  if (g.__simTicker) return;
  g.__simTicker = setInterval(() => {
    try {
      catchUpAll();
    } catch {
      /* next read will catch up anyway */
    }
  }, 60_000);
}

// ── API shaping ──────────────────────────────────────────────────────

export function storyPublicOf(t: TownRow): StoryPublic {
  const s = parseStory(t);
  return {
    era: s.era,
    stage: s.stage,
    stageName: STORY_STAGES[s.stage] ?? STORY_STAGES[1],
    trajectory: s.trajectory,
    conflict: s.conflict,
    lastBeat: s.lastBeat,
    ending: s.ending,
  };
}

/** 2–4 sentences: how the town is doing, for humans returning later. */
export function storySummaryText(t: TownRow): string {
  const s = parseStory(t);
  const p = personaFor(t.slug, t.display_name);
  const s1 = `Era ${s.era}, ${STORY_STAGES[s.stage] ?? 'Unfolding'} — ${p.name} is ${s.trajectory}.`;
  const s2 = TRAJECTORY_SENTENCES[s.trajectory] ?? '';
  const s3 = `The prevailing tension: ${s.conflict}.`;
  const s4 = s.lastBeat && t.tick - s.lastBeatTick < 80 ? ` Most recently: ${s.lastBeat}` : '';
  return `${s1} ${s2} ${s3}${s4}`;
}

export function summaryOf(t: TownRow): TownSummary {
  const p = personaFor(t.slug, t.display_name);
  return {
    slug: t.slug,
    name: p.name,
    culture: p.culture,
    accent: p.accent,
    tagline: p.tagline,
    day: t.tick,
    stage: stageOf(t),
    mood: moodOf(t),
    stats: statsOf(t),
    story: storyPublicOf(t),
    latestEvent: latestEvent(t.slug),
    tilemap: t.tilemap,
    structures: parsePlacements(t).length,
  };
}

/**
 * Identity is derived, deterministic, and culture-flavored: the same
 * citizen always has the same temperament, loves and grudges.
 */
export function personalityOf(
  slug: string,
  displayName: string | null | undefined,
  agentId: number
): { vibe: string; likes: string; dislikes: string } {
  const persona = personaFor(slug, displayName ?? undefined);
  const h = hashStr(`${slug}:${agentId}`);
  const w1 = TRAIT_WORDS[h % TRAIT_WORDS.length];
  const w2 = TRAIT_WORDS[(7 + (h >>> 5)) % TRAIT_WORDS.length];
  return {
    vibe: w1 === w2 ? w1 : `${w1} · ${w2}`,
    likes: persona.agentLikes[(h >>> 10) % persona.agentLikes.length],
    dislikes: persona.agentDislikes[(h >>> 14) % persona.agentDislikes.length],
  };
}

export function agentSnapshots(t: TownRow): AgentSnapshot[] {
  const agents = JSON.parse(t.agents || '[]') as Agent[];
  return agents.slice(0, MAX_AGENTS).map((a) => {
    const p = personalityOf(t.slug, t.display_name, a.id);
    return {
      id: a.id,
      name: a.name,
      x: clamp(a.x, 0, MAP_W - 1),
      y: clamp(a.y, 0, MAP_H - 1),
      tx: clamp(a.tx, 0, MAP_W - 1),
      ty: clamp(a.ty, 0, MAP_H - 1),
      role: a.role,
      task: a.task as AgentTask,
      nourish: Math.round(a.nourish),
      energy: Math.round(a.energy),
      mood: Math.round(a.mood),
      health: Math.round(a.health),
      fun: Math.round(a.fun ?? 60),
      clean: Math.round(a.clean ?? 65),
      age: a.age,
      vibe: p.vibe,
      likes: p.likes,
      dislikes: p.dislikes,
    };
  });
}

export function chatterOf(t: TownRow): Chatter[] {
  try {
    return JSON.parse(t.chatter || '[]') as Chatter[];
  } catch {
    return [];
  }
}

export function parsePlacements(t: TownRow): Placement[] {
  try {
    return JSON.parse(t.placements || '[]') as Placement[];
  } catch {
    return [];
  }
}

/** The keeper as the observer sees them (null in player groves — that's you). */
export function keeperPublicOf(t: TownRow): KeeperPublic | null {
  if (t.is_player) return null;
  const care = parseCare(t, plazaOf(t.tilemap));
  return { name: keeperName(t), x: care.x, y: care.y, cornered: care.cornered > 0 };
}

/** Remaining cooldown seconds per care action (player groves). */
export function careCooldownsOf(t: TownRow, cooldownMs = 20000): Partial<Record<CareAction, number>> {
  const care = parseCare(t, plazaOf(t.tilemap));
  const outMap: Partial<Record<CareAction, number>> = {};
  const wall = now();
  for (const [action, at] of Object.entries(care.lastAt)) {
    const left = Math.ceil((cooldownMs - (wall - (at as number))) / 1000);
    if (left > 0) outMap[action as CareAction] = left;
  }
  return outMap;
}
