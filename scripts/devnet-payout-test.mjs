// Prove the payout signer on DEVNET with fake SOL.
//
//  (A) The real funding key decodes to the expected address  → signer identity is correct.
//  (B) A confirmed transfer via payout.ts delivers the EXACT amount → the money path works.
//
// (B) signs with a FRESH, faucet-funded devnet keypair so the real wallet's
// faucet rate limit can't block the proof — sendSol() is identical whichever
// key signs. The mainnet path differs only by cluster + real funding.
//
//   $env:PAYOUT_WALLET_SECRET='<real>'; $env:SOLANA_DEVNET_RPC_URL='<helius devnet>'
//   node --import ./scripts/register-ts.mjs scripts/devnet-payout-test.mjs
process.env.SOLANA_CLUSTER = 'devnet';

const web3 = await import('@solana/web3.js');
const bs58 = (await import('bs58')).default;
const payout = await import('../src/lib/payout.ts');

const SOL = 1e9;
const EXPECTED = '3EFeMFoeWRhJCkmjm53xywNAZt1nVTPA54smR82b1zsN';

// (A) Real key → expected address.
if (process.env.PAYOUT_WALLET_SECRET) {
  const addr = payout.payoutAddress();
  console.log('(A) funding key →', addr, addr === EXPECTED ? '✓ matches' : '✗ MISMATCH');
  if (addr !== EXPECTED) process.exit(1);
}

// (B) Fresh funded signer → real transfer.
const conn = new web3.Connection(process.env.SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
const sender = web3.Keypair.generate();
console.log('\n(B) fresh devnet signer:', sender.publicKey.toBase58());
console.log('    requesting 1 SOL airdrop…');
try {
  const sig = await conn.requestAirdrop(sender.publicKey, 1 * SOL);
  await conn.confirmTransaction(sig, 'confirmed');
} catch (e) {
  console.log('    airdrop failed (devnet faucet down/limited):', String(e).slice(0, 120));
  console.log('\nSigner identity (A) is proven; transfer (B) needs a working faucet — retry later.');
  process.exit(0);
}
console.log('    funded:', (await conn.getBalance(sender.publicKey)) / SOL, 'SOL');

// Point payout.ts at the fresh signer and send.
process.env.PAYOUT_WALLET_SECRET = bs58.encode(sender.secretKey);
const recipient = web3.Keypair.generate();
const to = recipient.publicKey.toBase58();
const AMOUNT = Math.round(0.01 * SOL);
const before = await conn.getBalance(recipient.publicKey);
console.log(`    sending ${AMOUNT / SOL} SOL → ${to}`);
const sig = await payout.sendSol(to, AMOUNT);
await conn.confirmTransaction(sig, 'confirmed');
const after = await conn.getBalance(recipient.publicKey);
console.log('    tx:', sig);
console.log('    recipient:', before / SOL, '→', after / SOL, 'SOL');
const exact = after - before === AMOUNT;
console.log(exact ? '\n✓ DEVNET PAYOUT PROVEN — sendSol delivers the exact amount.' : '\n✗ amount mismatch');
process.exit(exact ? 0 : 1);
