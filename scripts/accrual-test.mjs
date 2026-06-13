// Prove the automatic accrual chain with REAL on-chain data:
//   ticker refreshes a linked wallet's $THRONG holding → settle accrues
//   pending to that grove — no dashboard visit required.
// Run with the RPC in env:
//   $env:SOLANA_RPC_URL='<helius>'; node --import ./scripts/register-ts.mjs scripts/accrual-test.mjs
import { rmSync } from 'node:fs';
process.env.DATABASE_PATH = './data/accrual-test.db';
process.env.REWARDS_ENABLED = 'true';
process.env.DAILY_POOL_SOL = '0.5';
delete process.env.OPENROUTER_API_KEY;
for (const s of ['', '-wal', '-shm']) { try { rmSync(`./data/accrual-test.db${s}`); } catch {} }

const web3 = await import('@solana/web3.js');
const { createPlayerTown, getTown, saveQuestState } = await import('../src/lib/db.ts');
const { parseQuestState } = await import('../src/lib/quests.ts');
const ledger = await import('../src/lib/rewardLedger.ts');
const { TOKEN_MINT, CLAIM_INTERVAL_MS } = await import('../src/lib/rewards.ts');

// 1. Find a real $THRONG holder (owner of a large token account).
const conn = new web3.Connection(process.env.SOLANA_RPC_URL, 'confirmed');
const largest = await conn.getTokenLargestAccounts(new web3.PublicKey(TOKEN_MINT));
let holder = null;
for (const acc of largest.value.slice(0, 5)) {
  const info = await conn.getParsedAccountInfo(acc.address);
  const owner = info.value?.data?.parsed?.info?.owner;
  if (owner) { holder = owner; break; }
}
console.log('real $THRONG holder:', holder);
if (!holder) { console.log('could not find a holder'); process.exit(1); }

// 2. A grove with coins, linked to that holder.
const { slug } = createPlayerTown('Accrual Test', holder);
const qs = parseQuestState(getTown(slug).quests); qs.coins = 1000; saveQuestState(slug, qs);

// 3. The ticker refreshes the holding from chain (caches the multiplier).
await ledger.accrualTick();
const cached = ledger.getCachedHolding(holder);
console.log('cached tier multiplier:', cached?.multiplier, '| holds % of supply:', cached?.pct?.toFixed(4));

// 4. A 12h window passes → settle should accrue automatically.
const before = getTown(slug).pending_lamports;
ledger.settle(Date.now() + CLAIM_INTERVAL_MS);
const after = getTown(slug).pending_lamports;
console.log('pending lamports before → after:', before, '→', after, `(${after / 1e9} SOL)`);
console.log(
  after > before && (cached?.multiplier ?? 0) > 0
    ? '\n✓ AUTOMATIC ACCRUAL WORKS — a real holder earned pending SOL with no dashboard visit.'
    : '\n✗ no accrual (holder multiplier 0?)'
);
process.exit(after > before ? 0 : 1);
