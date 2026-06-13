// End-to-end HTTP test of the reward endpoints against the running dev
// server. No money moves (dev server has REWARDS_ENABLED unset → disabled),
// so this validates owner-token gating, linking, status, and the disabled
// claim path.
const BASE = 'http://localhost:3000';
const WALLET = '3EFeMFoeWRhJCkmjm53xywNAZt1nVTPA54smR82b1zsN';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL:', m); } else console.log('  ok:', m); };

// 1. Create a player grove.
const created = await (await fetch(`${BASE}/api/towns/create`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Reward HTTP Test' }),
})).json();
const { slug, token } = created;
ok(!!slug && !!token, `grove created (${slug})`);

const H = { 'Content-Type': 'application/json', 'x-owner-token': token };

// 2. Status before linking — owner-gated, unlinked.
let s = await (await fetch(`${BASE}/api/rewards/grove?slug=${slug}`, { headers: { 'x-owner-token': token } })).json();
ok(s.linkedWallet === null, 'starts unlinked');
ok(s.enabled === false, 'rewards disabled on dev (enabled=false)');
ok(typeof s.coins === 'number', `coins reported (${s.coins})`);

// 3. Wrong token is rejected.
const bad = await fetch(`${BASE}/api/rewards/grove?slug=${slug}`, { headers: { 'x-owner-token': 'nope' } });
ok(bad.status === 403, 'wrong owner token → 403');

// 4. Link the wallet.
const linked = await (await fetch(`${BASE}/api/rewards/link`, { method: 'POST', headers: H, body: JSON.stringify({ slug, wallet: WALLET }) })).json();
ok(linked.linked === WALLET, 'link returns the wallet');
s = await (await fetch(`${BASE}/api/rewards/grove?slug=${slug}`, { headers: { 'x-owner-token': token } })).json();
ok(s.linkedWallet === WALLET, 'status now shows linked wallet');

// 5. Invalid address is rejected.
const badAddr = await fetch(`${BASE}/api/rewards/link`, { method: 'POST', headers: H, body: JSON.stringify({ slug, wallet: 'not-an-address' }) });
ok(badAddr.status === 400, 'invalid address → 400');

// 6. Claim while disabled is rejected (no funds move).
const claim = await fetch(`${BASE}/api/rewards/claim`, { method: 'POST', headers: H, body: JSON.stringify({ slug, wallet: WALLET }) });
const cj = await claim.json();
ok(claim.status === 400 && /not live/i.test(cj.error || ''), `claim rejected while disabled ("${cj.error}")`);

console.log(fails === 0 ? '\nREWARDS HTTP PASSED' : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
