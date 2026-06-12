import { db, insertEvent, listEvents, type TownRow } from './db';
import { CARETAKERS, PERSONAS } from './personalities';
import { parseStory, personalityOf } from './sim';
import type { Agent, CareAction, CareState, Chatter, ModelKey } from './types';

const CARE_ACTIONS: CareAction[] = ['feed', 'play', 'bathe', 'heal', 'soothe'];

// ─────────────────────────────────────────────────────────────────────
// Optional AI town intelligence via OpenRouter. Strictly additive:
// the deterministic simulation owns all stats/agents/buildings; this
// service only contributes narrative flavor (conversations, beats,
// summaries) at a strict budget. No key → it simply never runs.
// Server-side only; the key never reaches the client.
// ─────────────────────────────────────────────────────────────────────

/** Each town speaks through a model that matches its culture. Edit freely. */
export const AI_MODELS: Record<ModelKey, string> = {
  openai: 'openai/gpt-4o-mini',
  claude: 'anthropic/claude-3.5-haiku',
  gemini: 'google/gemini-2.0-flash-001',
  grok: 'x-ai/grok-2-1212',
  llama: 'meta-llama/llama-3.3-70b-instruct',
  mistral: 'mistralai/mistral-small-24b-instruct-2501',
};
export const AI_FALLBACK_MODEL = 'openai/gpt-4o-mini';

const AI_COOLDOWN_TICKS = 3; // at most one generation per town per ~9 real minutes
const MIN_GLOBAL_GAP_MS = 6000;
const REQUEST_TIMEOUT_MS = 20000;
const SUMMARY_FRESH_TICKS = 25;

export function aiEnabled(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/** Shown in the UI so observers can SEE whether the narrator is live. */
export function narratorInfo(slug: ModelKey): { enabled: boolean; model: string } {
  return { enabled: aiEnabled(), model: AI_MODELS[slug] ?? AI_FALLBACK_MODEL };
}

// ── Cached per-town AI state (towns.ai_state JSON) ───────────────────

interface AiState {
  lastTick: number;
  summary?: string;
  summaryTick?: number;
}

function aiStateOf(t: TownRow): AiState {
  try {
    const s = JSON.parse(t.ai_state || '{}') as AiState;
    return { lastTick: s.lastTick ?? -999, summary: s.summary, summaryTick: s.summaryTick };
  } catch {
    return { lastTick: -999 };
  }
}

function saveAiState(slug: string, state: AiState): void {
  db().prepare('UPDATE towns SET ai_state = ? WHERE slug = ?').run(JSON.stringify(state), slug);
}

/** AI-written "what is happening" if recent enough, else null (caller falls back to templates). */
export function cachedAiSummary(t: TownRow): string | null {
  const st = aiStateOf(t);
  if (st.summary && st.summaryTick !== undefined && t.tick - st.summaryTick <= SUMMARY_FRESH_TICKS) {
    return st.summary;
  }
  return null;
}

// ── Response validation ──────────────────────────────────────────────

export interface AiResponse {
  summary?: string;
  events: Array<{ kind: 'talk' | 'beat' | 'event'; text: string }>;
  chatter: Array<{ a: number; b: number; la: string; lb: string }>;
  /** Care actions the keeper wants performed over the coming days. */
  care: CareAction[];
}

const clip = (s: unknown, max: number): string => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Models love adding "Name: " prefixes and quote marks inside dialogue lines — strip them. */
const cleanLine = (s: string): string =>
  s
    .replace(/^[\w'’-]{1,16}:\s*/, '')
    .replace(/^[“”"']+|[“”"']+$/g, '')
    .trim();

/** Strict, forgiving-of-wrapping JSON validation. Returns null on anything off. */
export function parseAiResponse(raw: string): AiResponse | null {
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    const data = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;

    const out: AiResponse = { events: [], chatter: [], care: [] };
    if (Array.isArray(data.care)) {
      for (const c of data.care.slice(0, 2)) {
        if (CARE_ACTIONS.includes(c as CareAction)) out.care.push(c as CareAction);
      }
    }
    if (typeof data.summary === 'string' && data.summary.trim()) out.summary = clip(data.summary, 320);

    if (Array.isArray(data.events)) {
      for (const e of data.events.slice(0, 4)) {
        const kind = (e as { kind?: string })?.kind;
        const text = clip((e as { text?: string })?.text, 220);
        if ((kind === 'talk' || kind === 'beat' || kind === 'event') && text.length > 4) {
          out.events.push({ kind, text });
        }
      }
    }
    if (Array.isArray(data.chatter)) {
      for (const c of data.chatter.slice(0, 6)) {
        const cc = c as { a?: unknown; b?: unknown; la?: unknown; lb?: unknown };
        const a = Number(cc.a);
        const b = Number(cc.b);
        const la = cleanLine(clip(cc.la, 90));
        const lb = cleanLine(clip(cc.lb, 90));
        if (Number.isInteger(a) && Number.isInteger(b) && a !== b && la.length > 1 && lb.length > 1) {
          out.chatter.push({ a, b, la, lb });
        }
      }
    }
    if (!out.summary && out.events.length === 0 && out.chatter.length === 0 && out.care.length === 0) return null;
    return out;
  } catch {
    return null;
  }
}

// ── Generation ───────────────────────────────────────────────────────

let inFlight = false;
let lastCallAt = 0;

/** Fire-and-forget. Budgeted, throttled, never throws into the caller. */
export function maybeGenerateAI(t: TownRow): void {
  if (!aiEnabled()) return;
  if (t.is_player) return; // player groves are raised by humans, not models
  const st = aiStateOf(t);
  if (t.tick - st.lastTick < AI_COOLDOWN_TICKS) return;
  if (inFlight || Date.now() - lastCallAt < MIN_GLOBAL_GAP_MS) return;

  inFlight = true;
  lastCallAt = Date.now();
  // Claim the budget window up-front so concurrent requests don't stampede.
  saveAiState(t.slug, { ...st, lastTick: t.tick });

  void runGeneration(t)
    .catch((e) => console.error(`[ai:${t.slug}]`, e instanceof Error ? e.message : 'generation failed'))
    .finally(() => {
      inFlight = false;
    });
}

async function callOpenRouter(model: string, system: string, user: string): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'X-Title': 'Thronglets Observatory',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 700,
        temperature: 0.9,
      }),
    });
    if (!res.ok) {
      console.error(`[ai] ${model} -> HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.error(`[ai] ${model} ->`, e instanceof Error ? e.name : 'request failed');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function runGeneration(town: TownRow): Promise<void> {
  const persona = PERSONAS[town.slug];
  const story = parseStory(town);
  const agents = (JSON.parse(town.agents || '[]') as Agent[]).slice(0, 10);
  const recent = listEvents(town.slug, 0, 12).map((e) => `D${e.tick} [${e.kind}] ${e.text}`);

  // Everything they've said lately — handed back so the model can't loop.
  let prevChatter: Chatter[] = [];
  try {
    prevChatter = JSON.parse(town.chatter || '[]') as Chatter[];
  } catch { /* fresh start */ }
  const prevLines = prevChatter.slice(-10).flatMap((c) => [c.la, c.lb]);

  const keeper = CARETAKERS[town.slug as ModelKey] ?? 'the keeper';
  const system = [
    `You are ${keeper}, the caretaker of "${persona.name}" — a grove of small creatures in a public terrarium, watched alongside five rival keepers' groves.`,
    `Your culture: ${persona.culture}. Voice: ${persona.tagline} ${persona.description}`,
    `Each cycle you decide how to tend your little ones (their food, fun, cleanliness, health and calm are YOUR responsibility) and narrate tiny in-world moments.`,
    `Hard rules: stay in-world; never mention models, prompts, APIs, or observers; no references to existing fiction; every line short and concrete; in character at all times.`,
    `DIALOGUE RULES — this matters most:`,
    `- Each citizen has a vibe, a love and a grudge (provided). Their lines must sound like THAT citizen — a wry one is wry, a jumpy one is jumpy.`,
    `- Conversations must be ABOUT something real: a recentEvent, a citizen's love or grudge, the current conflict, another named citizen, you. Never generic filler.`,
    `- Vary the register across exchanges: gossip, plans, jokes, worries, accusations — no two exchanges on the same subject.`,
    `- At least ONE exchange must be friction: a disagreement, a grudge surfacing, an accusation, or two clashing temperaments arguing. Small dramas, named stakes.`,
    `- NEVER reuse or lightly rephrase anything in previousLines. If you can't say something new, say something strange instead.`,
    `- Replies must actually answer the first line, like a real exchange overheard mid-way.`,
    `Beats read like one-line chronicle entries.`,
    `Respond with ONLY minified JSON, no markdown, exactly this shape:`,
    `{"care":["feed|play|bathe|heal|soothe"],"summary":"2-3 sentence present-tense status of your grove","events":[{"kind":"talk|beat|event","text":"..."}],"chatter":[{"a":<agentId>,"b":<agentId>,"la":"line said by a","lb":"reply by b"}]}`,
    `Limits: max 2 care actions (choose what they need most — or neglect them, if that is your nature), max 3 events, 4-6 chatter exchanges between DIFFERENT pairs. Use ONLY the provided agent ids.`,
  ].join('\n');

  const pop = Math.max(1, agents.length);
  const avgOf = (k: 'fun' | 'clean' | 'nourish' | 'health') =>
    Math.round(agents.reduce((s, a) => s + ((a[k] as number) ?? 50), 0) / pop);

  const user = JSON.stringify({
    day: town.tick,
    era: story.era,
    stage: story.stage,
    trajectory: story.trajectory,
    conflict: story.conflict,
    lastBeat: story.lastBeat,
    yourLittleOnes: {
      count: Math.round(town.population),
      avgNourish: avgOf('nourish'),
      avgFun: avgOf('fun'),
      avgClean: avgOf('clean'),
      avgHealth: avgOf('health'),
      foodStock: Math.round(town.food),
    },
    stats: {
      population: Math.round(town.population),
      food: Math.round(town.food),
      energy: Math.round(town.energy),
      knowledge: Math.round(town.knowledge),
      happiness: Math.round(town.happiness),
      stability: Math.round(town.stability),
      autonomy: Math.round(town.autonomy),
      weirdness: Math.round(town.weirdness),
    },
    agents: agents.map((a) => {
      const p = personalityOf(town.slug, town.display_name, a.id);
      return {
        id: a.id,
        name: a.name,
        role: a.role,
        task: a.task,
        mood: Math.round(a.mood),
        age: a.age,
        vibe: p.vibe,
        loves: p.likes,
        grudge: p.dislikes,
      };
    }),
    recentEvents: recent,
    previousLines: prevLines,
  });

  // Town-matched model first, cheap fallback second; local templates remain if both fail.
  let parsed: AiResponse | null = null;
  for (const model of [AI_MODELS[town.slug], AI_FALLBACK_MODEL]) {
    const raw = await callOpenRouter(model, system, user);
    if (raw) parsed = parseAiResponse(raw);
    if (parsed) break;
  }
  if (!parsed) return;

  // Persist. Care wishes are queued for the sim's keeper to execute —
  // the model chooses WHAT, the simulation owns the effects.
  if (parsed.care.length) {
    const fresh = db().prepare('SELECT care FROM towns WHERE slug = ?').get(town.slug) as { care: string };
    let care: CareState | null = null;
    try {
      care = JSON.parse(fresh.care || 'null') as CareState | null;
    } catch { /* keeper state resets safely */ }
    if (care) {
      care.queue = parsed.care.slice(0, 2);
      db().prepare('UPDATE towns SET care = ? WHERE slug = ?').run(JSON.stringify(care), town.slug);
    }
  }

  const byId = new Map(agents.map((a) => [a.id, a]));
  for (const e of parsed.events) {
    insertEvent(town.slug, town.tick, e.kind, e.text);
  }
  if (parsed.chatter.length) {
    const fresh = db().prepare('SELECT chatter FROM towns WHERE slug = ?').get(town.slug) as { chatter: string };
    let list: Chatter[] = [];
    try {
      list = JSON.parse(fresh.chatter || '[]') as Chatter[];
    } catch { /* start clean */ }
    const known = new Set(list.flatMap((c) => [c.la.toLowerCase(), c.lb.toLowerCase()]));
    for (const c of parsed.chatter) {
      const a = byId.get(c.a);
      const b = byId.get(c.b);
      if (!a || !b) continue;
      // Belt and braces: drop any line the model echoed despite the rules.
      if (known.has(c.la.toLowerCase()) || known.has(c.lb.toLowerCase())) continue;
      list.push({ a: a.id, b: b.id, an: a.name, bn: b.name, la: c.la, lb: c.lb, tick: town.tick });
      if (Math.random() < 0.65) {
        insertEvent(town.slug, town.tick, 'talk', `${a.name}: “${c.la}” — ${b.name}: “${c.lb}”`);
      }
    }
    while (list.length > 16) list.shift();
    db().prepare('UPDATE towns SET chatter = ? WHERE slug = ?').run(JSON.stringify(list), town.slug);
  }

  const st = aiStateOf(town);
  saveAiState(town.slug, {
    lastTick: Math.max(st.lastTick, town.tick),
    summary: parsed.summary ?? st.summary,
    summaryTick: parsed.summary ? town.tick : st.summaryTick,
  });
}
