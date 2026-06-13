// Exercise the reward ledger end-to-end against a throwaway DB. Covers the
// pure split math, 12h-window accrual, idempotency, and every claim
// guardrail that must reject BEFORE any transfer — so this test never
// touches the network or moves a single lamport.
import { rmSync } from 'node:fs';
process.env.DATABASE_PATH = './data/rewards-smoke.db';
process.env.REWARDS_ENABLED = 'true';
process.env.SOLANA_CLUSTER = 'devnet';
process.env.DAILY_POOL_SOL = '0.02';
process.env.MIN_CLAIM_SOL = '0.002';
delete process.env.OPENROUTER_API_KEY;
for (const s of ['', '-wal', '-shm']) { try { rmSync(`./data/rewards-smoke.db${s}`); } catch {} }

const { createPlayerTown, getTown, saveQuestState, db } = await import('../src/lib/db.ts');
const { parseQuestState } = await import('../src/lib/quests.ts');
const ledger = await import('../src/lib/rewardLedger.ts');
const { payoutConfig, CLAIM_INTERVAL_MS } = await import('../src/lib/rewards.ts');

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL:', msg); } else console.log('  ok:', msg); };

// 1. Pure distribution: proportional to weight, never exceeds the pool.
const d = ledger.distribute(900, [{ slug: 'a', weight: 1000 }, { slug: 'b', weight: 2000 }]);
ok(d.get('a') === 300 && d.get('b') === 600, `splits by weight 1:2 → 300/600 (got ${d.get('a')}/${d.get('b')})`);
ok([...d.values()].reduce((x, y) => x + y, 0) <= 900, 'distributed sum never exceeds the pool');
ok(ledger.distribute(900, []).size === 0, 'no eligible groves → nothing distributed');
ok(ledger.distribute(0, [{ slug: 'a', weight: 1 }]).size === 0, 'zero pool → nothing distributed');

// 2. Accrual: a lone eligible grove receives the whole window pool.
const WALLET = '3EFeMFoeWRhJCkmjm53xywNAZt1nVTPA54smR82b1zsN';
const OTHER = 'So11111111111111111111111111111111111111112';
const { slug } = createPlayerTown('Reward Test');
const qs = parseQuestState(getTown(slug).quests); qs.coins = 1000; saveQuestState(slug, qs);
// Link directly + seed the holding cache (skip the RPC the real link would do).
db().prepare('UPDATE towns SET payout_wallet = ? WHERE slug = ?').run(WALLET, slug);
db().prepare(
  `INSERT INTO holding_cache (wallet, pct, multiplier, updated_at) VALUES (?, 0.3, 1.0, ?)
   ON CONFLICT(wallet) DO UPDATE SET multiplier = 1.0`
).run(WALLET, Date.now());

const DAY_MS = 86_400_000;
const base = Date.now();
ledger.settle(base); // baseline the clock — emits nothing on the first call
const before = getTown(slug).pending_lamports;
ledger.settle(base + CLAIM_INTERVAL_MS); // 12h later → continuous accrual
const gained = getTown(slug).pending_lamports - before;
const half = Math.floor((payoutConfig().dailyPoolLamports * CLAIM_INTERVAL_MS) / DAY_MS);
ok(gained === half, `12h of continuous accrual = half the daily pool (${gained} == ${half})`);

// 3. Settling at the same instant adds nothing (no time elapsed).
const held = getTown(slug).pending_lamports;
ledger.settle(base + CLAIM_INTERVAL_MS);
ok(getTown(slug).pending_lamports === held, 'settle at the same instant is a no-op');

// 3b. A further 6h accrues a quarter of the daily pool.
ledger.settle(base + CLAIM_INTERVAL_MS + DAY_MS / 4);
const gained2 = getTown(slug).pending_lamports - held;
const quarter = Math.floor((payoutConfig().dailyPoolLamports * (DAY_MS / 4)) / DAY_MS);
ok(gained2 === quarter, `a further 6h accrues a quarter of the daily pool (${gained2} == ${quarter})`);

// 4. Guardrails that must reject before any transfer:
let r = await ledger.claimReward(slug, OTHER, base + CLAIM_INTERVAL_MS + 2000);
ok(!r.ok && /different wallet/.test(r.error || ''), 'claim to a non-linked wallet is rejected');

// cooldown: stamp a recent claim, then a valid-wallet claim must hit the cooldown (still no send)
db().prepare('UPDATE towns SET last_claim_at = ? WHERE slug = ?').run(base + CLAIM_INTERVAL_MS, slug);
r = await ledger.claimReward(slug, WALLET, base + CLAIM_INTERVAL_MS + 3000);
ok(!r.ok && /cooldown/i.test(r.error || ''), 'claim within 12h cooldown is rejected');

// below the dust floor: zero coins (so settle can't re-accrue), clear
// pending + cooldown, and the claim must reject on the minimum.
const qs0 = parseQuestState(getTown(slug).quests); qs0.coins = 0; saveQuestState(slug, qs0);
db().prepare('UPDATE towns SET pending_lamports = 0, last_claim_at = 0 WHERE slug = ?').run(slug);
r = await ledger.claimReward(slug, WALLET, base + 10 * CLAIM_INTERVAL_MS);
ok(!r.ok && /nothing to claim/i.test(r.error || ''), 'claim below the minimum is rejected');

// master switch off: nothing accrues or pays
process.env.REWARDS_ENABLED = 'false';
r = await ledger.claimReward(slug, WALLET, base + 10 * CLAIM_INTERVAL_MS);
ok(!r.ok && /not live/i.test(r.error || ''), 'claim rejected while rewards are disabled');
const p = getTown(slug).pending_lamports;
ledger.settle(base + 20 * CLAIM_INTERVAL_MS);
ok(getTown(slug).pending_lamports === p, 'settlement is a no-op while disabled');
process.env.REWARDS_ENABLED = 'true';

console.log(fails === 0 ? '\nREWARDS SMOKE PASSED' : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
