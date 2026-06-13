// ─────────────────────────────────────────────────────────────────────
// Quests & coins for player-raised groves. Pure + shared (no server
// imports) so the API can validate claims and the client can render
// progress from the same definitions. Coins are an in-game currency for
// now; the balance is server-authoritative and owner-gated, so a real
// payout (e.g. Solana) can be layered on later without trusting the
// client. Rewards are paid in coins only.
// ─────────────────────────────────────────────────────────────────────

/**
 * Hard ceiling on the coins a single grove can ever hold. Quests are
 * one-time, so total earnings are already bounded — this caps it firmly
 * and future-proofs new coin sources. It's the per-grove payout unit;
 * per-wallet limits come later, once groves are tied to accounts.
 */
export const COIN_CAP = 2000;

export type CareKey = 'feed' | 'play' | 'bathe' | 'heal' | 'soothe';

/** Persisted per player grove (towns.quests JSON). */
export interface QuestState {
  coins: number;
  claimed: string[];
  cares: Record<CareKey, number>;
}

export const EMPTY_QUEST_STATE: QuestState = {
  coins: 0,
  claimed: [],
  cares: { feed: 0, play: 0, bathe: 0, heal: 0, soothe: 0 },
};

export function parseQuestState(json: string | null | undefined): QuestState {
  try {
    const q = JSON.parse(json || '{}') as Partial<QuestState>;
    const c = (q.cares ?? {}) as Partial<Record<CareKey, number>>;
    return {
      coins: Math.max(0, Math.floor(Number(q.coins) || 0)),
      claimed: Array.isArray(q.claimed) ? q.claimed.filter((x) => typeof x === 'string') : [],
      cares: {
        feed: Math.max(0, Math.floor(c.feed ?? 0)),
        play: Math.max(0, Math.floor(c.play ?? 0)),
        bathe: Math.max(0, Math.floor(c.bathe ?? 0)),
        heal: Math.max(0, Math.floor(c.heal ?? 0)),
        soothe: Math.max(0, Math.floor(c.soothe ?? 0)),
      },
    };
  } catch {
    return { coins: 0, claimed: [], cares: { feed: 0, play: 0, bathe: 0, heal: 0, soothe: 0 } };
  }
}

/** Everything a quest can test, derived from the grove's live state. */
export interface QuestContext {
  population: number;
  day: number;
  avgNourish: number;
  oldestAge: number;
  happiness: number;
  stability: number;
  buildingTypes: number; // distinct building kinds present (max 8)
  cares: Record<CareKey, number>;
  claimed: string[];
  coins: number;
}

interface QuestDef {
  id: string;
  title: string;
  desc: string;
  reward: number; // coins
  target: number;
  progress: (c: QuestContext) => number;
}

export const QUESTS: QuestDef[] = [
  { id: 'family', title: 'Two Become More', desc: 'Grow your grove to 5 little ones.', reward: 50, target: 5, progress: (c) => c.population },
  { id: 'settle', title: 'Settle In', desc: 'Keep the grove alive to Day 10.', reward: 50, target: 10, progress: (c) => c.day },
  { id: 'baths', title: 'Bath Time', desc: 'Run 8 baths for your little ones.', reward: 100, target: 8, progress: (c) => c.cares.bathe },
  { id: 'plays', title: 'Playful Grove', desc: 'Lead 8 play sessions.', reward: 100, target: 8, progress: (c) => c.cares.play },
  { id: 'heals', title: 'Field Medic', desc: 'Heal the grove 10 times.', reward: 150, target: 10, progress: (c) => c.cares.heal },
  { id: 'wellfed', title: 'Well Fed', desc: 'Get average nourishment above 75.', reward: 120, target: 75, progress: (c) => Math.round(c.avgNourish) },
  { id: 'village', title: 'A Village', desc: 'Grow your grove to 15 little ones.', reward: 250, target: 15, progress: (c) => c.population },
  { id: 'elder', title: 'Elder', desc: 'Raise a little one to 300 days old.', reward: 200, target: 300, progress: (c) => c.oldestAge },
  { id: 'fullhouse', title: 'Full House', desc: 'Have every kind of building at once.', reward: 300, target: 8, progress: (c) => c.buildingTypes },
  { id: 'thriving', title: 'Thriving', desc: 'Reach 80+ happiness and 70+ stability.', reward: 400, target: 1, progress: (c) => (c.happiness >= 80 && c.stability >= 70 ? 1 : 0) },
];

export interface EvaluatedQuest {
  id: string;
  title: string;
  desc: string;
  reward: number;
  current: number;
  target: number;
  done: boolean;
  claimed: boolean;
}

export function evaluateQuests(c: QuestContext): EvaluatedQuest[] {
  return QUESTS.map((q) => {
    const raw = q.progress(c);
    return {
      id: q.id,
      title: q.title,
      desc: q.desc,
      reward: q.reward,
      current: Math.max(0, Math.min(q.target, Math.round(raw))),
      target: q.target,
      done: raw >= q.target,
      claimed: c.claimed.includes(q.id),
    };
  });
}

export function questById(id: string): QuestDef | undefined {
  return QUESTS.find((q) => q.id === id);
}
