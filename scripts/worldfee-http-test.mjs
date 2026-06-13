// HTTP test of the anti-farm world-creation gate. No on-chain payment is
// exercised (that needs a real tx); this proves wallet-gating, the per-wallet
// free limit, the quota endpoint, and that the 3rd world demands a fee.
const BASE = 'http://localhost:3000';
// A freshly generated (guaranteed-unused) Solana address as the creator wallet.
const web3 = await import('@solana/web3.js');
const WALLET = web3.Keypair.generate().publicKey.toBase58();
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL:', m); } else console.log('  ok:', m); };

const create = (name, wallet, paymentSignature) =>
  fetch(`${BASE}/api/towns/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, wallet, paymentSignature }),
  });

// 0. Creating without a wallet is rejected.
let r = await create('No Wallet Grove');
ok(r.status === 400, `create without wallet → 400 (got ${r.status})`);

// 1. Fresh wallet: quota says 2 free, next is free.
let q = await (await fetch(`${BASE}/api/towns/quota?wallet=${WALLET}`)).json();
ok(q.created === 0 && q.freeLimit === 2 && q.nextIsFree === true, `fresh wallet: 0 made, 2 free (${JSON.stringify({ created: q.created, free: q.remainingFree })})`);
ok(typeof q.feeSol === 'number' && q.feeSol === 0.3, `fee is 0.3 SOL (got ${q.feeSol})`);

// 2. First two worlds are free.
let d1 = await (await create('Farm Test 1', WALLET)).json();
ok(!!d1.slug, `world 1 created free (${d1.slug})`);
let d2 = await (await create('Farm Test 2', WALLET)).json();
ok(!!d2.slug, `world 2 created free (${d2.slug})`);

// 3. Quota now shows 2 made, next is NOT free.
q = await (await fetch(`${BASE}/api/towns/quota?wallet=${WALLET}`)).json();
ok(q.created === 2 && q.nextIsFree === false, `after 2: created=2, nextIsFree=false (got created=${q.created}, free=${q.nextIsFree})`);

// 4. Third world without payment → 402 fee_required.
r = await create('Farm Test 3', WALLET);
const j = await r.json();
ok(r.status === 402 && j.error === 'fee_required', `3rd world demands fee → 402 fee_required (got ${r.status}/${j.error})`);
ok(j.feeSol === 0.3 && typeof j.feeWallet === 'string', `fee response carries amount + wallet (${j.feeSol} SOL → ${String(j.feeWallet).slice(0, 6)}…)`);

// 5. Third world with a bogus signature → rejected (can't verify on-chain).
r = await create('Farm Test 3', WALLET, 'totallyFakeSignature1111111111111111111111111111111111111111');
ok(r.status === 402 || r.status === 400, `3rd world with fake payment is rejected (got ${r.status})`);

console.log(fails === 0 ? '\nWORLD-FEE HTTP PASSED' : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
