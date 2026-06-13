// Exercise the quest/coin logic end-to-end against a throwaway DB.
import { rmSync } from 'node:fs';
process.env.DATABASE_PATH = './data/quest-smoke.db';
delete process.env.OPENROUTER_API_KEY;
for (const s of ['', '-wal', '-shm']) { try { rmSync(`./data/quest-smoke.db${s}`); } catch {} }

const { createPlayerTown, getTown, saveQuestState } = await import('../src/lib/db.ts');
const { catchUp, questContextOf } = await import('../src/lib/sim.ts');
const { evaluateQuests, parseQuestState, questById, COIN_CAP } = await import('../src/lib/quests.ts');

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL:', msg); } else console.log('  ok:', msg); };

// 1. A fresh grove starts at 0 coins with a full, unclaimed quest list.
const { slug, token } = createPlayerTown('Quest Test');
ok(typeof token === 'string' && token.length > 0, 'grove has an owner token');
let town = catchUp(getTown(slug));
let quests = evaluateQuests(questContextOf(town));
ok(quests.length === 10, `10 quests defined (got ${quests.length})`);
ok(parseQuestState(town.quests).coins === 0, 'starts at 0 coins');
ok(quests.every((q) => !q.claimed), 'nothing claimed yet');

// 2. Care counters drive progress: simulate 8 baths.
let qs = parseQuestState(town.quests);
qs.cares.bathe = 8;
saveQuestState(slug, qs);
town = catchUp(getTown(slug));
quests = evaluateQuests(questContextOf(town));
const baths = quests.find((q) => q.id === 'baths');
ok(baths.done && !baths.claimed, `"Bath Time" completes at 8 baths (current ${baths.current}/${baths.target})`);

// 3. Claim it — mirrors the endpoint's server-side logic.
const claim = (id) => {
  const t = catchUp(getTown(slug));
  const ctx = questContextOf(t);
  const def = questById(id);
  const state = parseQuestState(t.quests);
  if (!def) return { error: 'unknown' };
  if (state.claimed.includes(id)) return { error: 'already' };
  if (def.progress(ctx) < def.target) return { error: 'unfinished' };
  state.claimed.push(id);
  state.coins = Math.min(COIN_CAP, state.coins + def.reward); // mirrors the claim route's cap
  saveQuestState(slug, state);
  return { coins: state.coins, reward: def.reward };
};

const r1 = claim('baths');
ok(r1.coins === 100 && r1.reward === 100, `claiming "Bath Time" pays 100 coins (balance ${r1.coins})`);

// 4. Double-claim is rejected.
const r2 = claim('baths');
ok(r2.error === 'already', 'cannot claim the same quest twice');

// 5. An unfinished quest is rejected (village needs 15, grove has 2).
const r3 = claim('village');
ok(r3.error === 'unfinished', 'cannot claim an unfinished quest');

// 6. Balance persists and the claimed quest shows as claimed.
town = catchUp(getTown(slug));
ok(parseQuestState(town.quests).coins === 100, 'coin balance persists');
ok(evaluateQuests(questContextOf(town)).find((q) => q.id === 'baths').claimed, 'quest now reads as claimed');

// 7. The per-grove cap clamps a payout that would overflow it.
const near = parseQuestState(getTown(slug).quests);
near.coins = COIN_CAP - 50;
near.cares.heal = 10; // completes "Field Medic" (150 reward)
saveQuestState(slug, near);
const capped = claim('heals');
ok(capped.coins === COIN_CAP, `balance is capped at ${COIN_CAP} (got ${capped.coins})`);

console.log(fails === 0 ? '\nQUEST SMOKE PASSED' : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
