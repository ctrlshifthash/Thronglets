// Simulation smoke test against a throwaway database:
// seeds six towns, fast-forwards 300 days, checks invariants.
// Run: npm run sim-smoke
import { rmSync } from 'node:fs';

process.env.DATABASE_PATH = './data/smoke.db';
delete process.env.OPENROUTER_API_KEY; // exercise the no-AI path
for (const s of ['', '-wal', '-shm']) {
  try { rmSync(`./data/smoke.db${s}`); } catch {}
}

const { db, listTowns, listEvents, TICK_MS } = await import('../src/lib/db.ts');
const { catchUp, stageOf, moodOf, summaryOf, parseStory, storySummaryText, chatterOf } = await import('../src/lib/sim.ts');
const { MAP_W, MAP_H } = await import('../src/lib/rules.ts');

db(); // seeds with 40 ticks of backfill
let failures = 0;
const fail = (msg) => { failures++; console.log(`  FAIL: ${msg}`); };

// 1. Seed catch-up (≈40 backfilled days)
let towns = listTowns().map(catchUp);
if (towns.length !== 6) fail(`expected 6 towns, got ${towns.length}`);
for (const t of towns) {
  if (t.tick < 35) fail(`${t.slug} only reached day ${t.tick} after backfill`);
}
console.log(`Seeded. Days: ${towns.map((t) => `${t.slug}=${t.tick}`).join(' ')}`);

// 2. Fast-forward 300 more days
for (const t of listTowns()) {
  db().prepare('UPDATE towns SET last_tick_at = ? WHERE slug = ?').run(t.last_tick_at - 300 * TICK_MS, t.slug);
}
towns = listTowns().map(catchUp);

console.log('\nAfter ~340 simulated days:');
const allTasks = new Set();
let lifecycleEvents = 0;
for (const t of towns) {
  const s = summaryOf(t);
  const events = listEvents(t.slug, 0, 500);
  const whispers = events.filter((e) => e.kind === 'whisper').length;
  const milestones = events.filter((e) => e.kind === 'milestone').length;
  const agents = JSON.parse(t.agents);
  const tasks = new Map();
  for (const a of agents) tasks.set(a.task, (tasks.get(a.task) ?? 0) + 1);
  for (const k of tasks.keys()) allTasks.add(k);
  lifecycleEvents += events.filter((e) => / lost | welcomed /.test(e.text)).length;

  console.log(
    `  ${t.slug.padEnd(8)} day=${t.tick} pop=${s.stats.population} agents=${agents.length} stage="${s.stage}" mood="${s.mood}" ` +
      `stab=${s.stats.stability} auto=${s.stats.autonomy} weird=${s.stats.weirdness} ` +
      `events=${events.length} (m=${milestones}, w=${whispers})`
  );
  console.log(`           tasks: ${[...tasks.entries()].map(([k, n]) => `${k}=${n}`).join(' ')}`);

  if (t.population < 2 || t.population > 80) fail(`${t.slug} population out of range: ${t.population}`);
  if (t.population < 6) fail(`${t.slug} did not multiply from its founding pair (pop ${t.population})`);
  if (agents.length !== Math.round(t.population)) fail(`${t.slug} population (${t.population}) != agents (${agents.length})`);
  for (const k of ['food', 'energy', 'happiness', 'stability', 'autonomy', 'weirdness']) {
    if (!Number.isFinite(t[k])) fail(`${t.slug}.${k} is not finite`);
  }
  for (const a of agents) {
    if (a.x < 0 || a.y < 0 || a.x >= MAP_W || a.y >= MAP_H) fail(`${t.slug} agent ${a.name} off-map at ${a.x},${a.y}`);
    if (!Number.isFinite(a.nourish) || !Number.isFinite(a.health)) fail(`${t.slug} agent ${a.name} has bad vitals`);
    if (!Number.isFinite(a.fun) || !Number.isFinite(a.clean)) fail(`${t.slug} agent ${a.name} missing fun/clean`);
    if (!a.name) fail(`${t.slug} agent ${a.id} unnamed`);
  }
  const careEvents = events.filter((e) => e.kind === 'care').length;
  if (careEvents === 0) fail(`${t.slug} keeper never visibly cared (0 care events)`);
  if (events.length < 5) fail(`${t.slug} produced too few events (${events.length})`);
  if (!stageOf(t) || !moodOf(t)) fail(`${t.slug} missing stage/mood`);

  // Worlds must visibly evolve: structures stand at stable spots, paths grow.
  const placements = JSON.parse(t.placements || '[]');
  const buildingCount = Object.values(JSON.parse(t.buildings)).reduce((s, n) => s + n, 0);
  if (placements.length !== buildingCount) {
    fail(`${t.slug} placements (${placements.length}) != building count (${buildingCount})`);
  }
  for (const p of placements) {
    if (p.x === undefined || p.kind === undefined) fail(`${t.slug} malformed placement`);
  }
}
console.log(`\nDistinct tasks across towns: ${[...allTasks].join(', ')}`);
if (allTasks.size < 5) fail(`expected >=5 distinct agent tasks, saw ${allTasks.size}`);
if (lifecycleEvents < 3) fail(`expected birth/death events, saw ${lifecycleEvents}`);

// Story layer
console.log('\nStory arcs:');
const stages = new Set();
let totalBeats = 0;
let totalTalk = 0;
for (const t of listTowns()) {
  const s = parseStory(t);
  const events = listEvents(t.slug, 0, 500);
  const beats = events.filter((e) => e.kind === 'beat').length;
  const talk = events.filter((e) => e.kind === 'talk').length;
  totalBeats += beats;
  totalTalk += talk;
  stages.add(`${t.slug}:${s.stage}`);
  console.log(
    `  ${t.slug.padEnd(8)} era=${s.era} stage=${s.stage} traj=${s.trajectory} beats=${beats} talk=${talk}` +
      `\n           "${storySummaryText(t).slice(0, 110)}…"`
  );
  if (s.stage === 0) fail(`${t.slug} story never left Founding`);
  if (!s.trajectory) fail(`${t.slug} has no trajectory`);
  if (beats < 2) fail(`${t.slug} produced too few story beats (${beats})`);
  const chat = chatterOf(t);
  for (const c of chat) {
    if (!c.la || !c.lb || c.a === undefined) fail(`${t.slug} malformed chatter`);
  }
}
if (totalTalk < 5) fail(`expected conversations in timelines, saw ${totalTalk}`);
console.log(`Total beats=${totalBeats} talk-events=${totalTalk}`);

// AI narrative layer — disabled path + response validation
const { aiEnabled, maybeGenerateAI, parseAiResponse, cachedAiSummary } = await import('../src/lib/aiNarrative.ts');
console.log('\nAI narrative checks:');
if (aiEnabled()) fail('aiEnabled() should be false without OPENROUTER_API_KEY');
const sample = listTowns()[0];
maybeGenerateAI(sample); // must be a silent no-op without a key
const sampleAfter = listTowns()[0];
if (sampleAfter.ai_state !== sample.ai_state) fail('maybeGenerateAI mutated state with AI disabled');
if (cachedAiSummary(sample) !== null) fail('cachedAiSummary should be null with no AI state');

if (parseAiResponse('not json at all') !== null) fail('parseAiResponse accepted garbage');
if (parseAiResponse('{"events":[{"kind":"hack","text":"x"}],"chatter":[]}') !== null) {
  fail('parseAiResponse accepted invalid event kind');
}
const good = parseAiResponse(
  'Sure! ```json\n{"summary":"All is calm.","events":[{"kind":"beat","text":"A quiet milestone."}],"chatter":[{"a":1,"b":2,"la":"hello","lb":"hi"}]}\n```'
);
if (!good || good.summary !== 'All is calm.' || good.events.length !== 1 || good.chatter.length !== 1) {
  fail('parseAiResponse rejected a valid wrapped response');
}
console.log('  disabled path: OK · validation: OK');

// 3. Towns must diverge (the whole point)
const pops = new Set(towns.map((t) => Math.round(t.population)));
const weirds = new Set(towns.map((t) => Math.round(t.weirdness / 10)));
if (pops.size < 3) fail('towns are not diverging in population');
if (weirds.size < 2) fail('towns are not diverging in weirdness');

// 4. Idempotence: another catch-up with no elapsed time changes nothing
const before = JSON.stringify(listTowns().map((t) => [t.slug, t.tick]));
listTowns().map(catchUp);
const after = JSON.stringify(listTowns().map((t) => [t.slug, t.tick]));
if (before !== after) fail('catch-up advanced ticks without elapsed time');

console.log('\nSample timeline (grok):');
for (const e of listEvents('grok', 0, 500).slice(-8)) {
  console.log(`  [D${e.tick}] ${e.kind === 'whisper' ? '▓ ' : ''}${e.text}`);
}

for (const s of ['', '-wal', '-shm']) {
  try { rmSync(`./data/smoke.db${s}`); } catch {}
}
console.log(failures ? `\n${failures} FAILURES` : '\nSIM SMOKE PASSED');
process.exit(failures ? 1 : 0);
