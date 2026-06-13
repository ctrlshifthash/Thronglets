// ─────────────────────────────────────────────────────────────────────
// Shared types for the six-town simulator.
// ─────────────────────────────────────────────────────────────────────

import type { EvaluatedQuest } from './quests';

export type ModelKey = 'openai' | 'claude' | 'gemini' | 'grok' | 'llama' | 'mistral';

export interface TownStats {
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

export type BuildingKind =
  | 'house'
  | 'farm'
  | 'generator'
  | 'lab'
  | 'archive'
  | 'market'
  | 'shrine'
  | 'tower';

export type Buildings = Record<BuildingKind, number>;

/** A structure standing at a fixed tile — persisted so towns never reshuffle. */
export interface Placement {
  kind: BuildingKind;
  x: number;
  y: number;
  builtTick: number;
}

export interface TownEvent {
  id: number;
  tick: number;
  /** event: ambient · milestone: construction/stage · beat: major story · talk: conversation · life: birth/death · care: keeper action · whisper: …them */
  kind: 'event' | 'milestone' | 'beat' | 'talk' | 'life' | 'care' | 'whisper';
  text: string;
  createdAt: number;
}

// ── Story arcs ───────────────────────────────────────────────────────

export type Trajectory =
  | 'growing'
  | 'stable'
  | 'anxious'
  | 'rebellious'
  | 'starving'
  | 'ascending'
  | 'collapsing'
  | 'contained'
  | 'breaching';

export interface StoryState {
  era: number; // 1-based
  stage: number; // index into STORY_STAGES
  progress: number; // 0..100 toward the next stage
  trajectory: Trajectory;
  conflict: string;
  lastBeat: string;
  lastBeatTick: number;
  ending: string | null; // how the previous era ended
  popPeak: number;
  crisisTicks: number;
  calmTicks: number;
  prevPop: number;
}

export interface StoryPublic {
  era: number;
  stage: number;
  stageName: string;
  trajectory: Trajectory;
  conflict: string;
  lastBeat: string;
  ending: string | null;
}

/** A two-line exchange between citizens, for speech bubbles + the record. */
export interface Chatter {
  a: number; // agent ids
  b: number;
  an: string; // names
  bn: string;
  la: string; // lines
  lb: string;
  tick: number;
}

export interface TownSummary {
  slug: string; // one of the six ModelKeys, or "u_…" for player groves
  name: string;
  culture: string; // e.g. "OpenAI culture"
  accent: string; // hex color
  tagline: string;
  day: number;
  stage: string;
  mood: string;
  stats: TownStats;
  story: StoryPublic;
  latestEvent: TownEvent | null;
  tilemap: string;
  structures: number;
}

// ── Agents (the little ones) ─────────────────────────────────────────

export type AgentRole = 'farmer' | 'technician' | 'researcher' | 'keeper' | 'free';

export type AgentTask =
  | 'farm'
  | 'maintain'
  | 'research'
  | 'social'
  | 'eat'
  | 'rest'
  | 'protest'
  | 'ritual'
  | 'transmit'
  | 'confront'
  | 'idle';

/** Full persisted agent state (lives in the towns.agents JSON column). */
export interface Agent {
  id: number;
  name: string;
  x: number;
  y: number;
  tx: number; // current target tile
  ty: number;
  role: AgentRole;
  task: AgentTask;
  nourish: number; // 0..100, low = starving
  energy: number; // 0..100
  mood: number; // 0..100
  health: number; // 0..100
  fun: number; // 0..100, low = bored little ones
  clean: number; // 0..100, low = grubby (and eventually sick)
  age: number; // ticks lived
}

// ── Care (the Thronglets loop) ───────────────────────────────────────

export type CareAction = 'feed' | 'play' | 'bathe' | 'heal' | 'soothe';

/** Persisted keeper state per town (towns.care JSON). */
export interface CareState {
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** AI-queued actions, consumed one per tick before the heuristic runs. */
  queue: CareAction[];
  /** Last wall-clock ms per action (player-grove cooldowns). */
  lastAt: Partial<Record<CareAction, number>>;
  /** Ticks remaining of being surrounded by too-smart little ones. */
  cornered: number;
  /** Ticks remaining of a neglect spell — the keeper forgot the grove. */
  lapse?: number;
}

export interface KeeperPublic {
  name: string;
  x: number;
  y: number;
  cornered: boolean;
}

/** What the observer view needs per agent — full vitals + character sheet. */
export interface AgentSnapshot {
  id: number;
  name: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  role: AgentRole;
  task: AgentTask;
  nourish: number;
  energy: number;
  mood: number;
  health: number;
  fun: number;
  clean: number;
  age: number;
  /** Personality pair, e.g. "wry · meticulous" — stable per citizen. */
  vibe: string;
  likes: string;
  dislikes: string;
}

export interface TownDetail extends TownSummary {
  description: string;
  buildings: Buildings;
  placements: Placement[];
  events: TownEvent[];
  agents: AgentSnapshot[];
  chatter: Chatter[];
  /** 2–4 sentence "what is happening now". */
  summaryText: string;
  narrator: { enabled: boolean; model: string };
  /** The LLM caretaker walking the grove (null in player groves — that's you). */
  keeper: KeeperPublic | null;
  isPlayer: boolean;
  /** Seconds until each care action is available again (player groves). */
  careCooldowns: Partial<Record<CareAction, number>>;
  views: number;
  /** Player-grove economy: coin balance and quest progress (owner only). */
  coins?: number;
  quests?: EvaluatedQuest[];
}
