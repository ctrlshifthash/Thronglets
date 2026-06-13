// ─────────────────────────────────────────────────────────────────────
// The signer. The ONLY module that can move funds. It reads the payout
// wallet's secret key from process.env at call time — never imported,
// never logged, never committed. Used exclusively server-side by the
// claim flow, after every guardrail has passed.
// ─────────────────────────────────────────────────────────────────────

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { payoutConfig } from './rewards';

let cached: { url: string; conn: Connection } | null = null;

function connection(): Connection {
  const { cluster } = payoutConfig();
  const url =
    cluster === 'devnet'
      ? process.env.SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com'
      : process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  if (!cached || cached.url !== url) cached = { url, conn: new Connection(url, 'confirmed') };
  return cached.conn;
}

/** The payout keypair, derived from the base58 secret in env. Throws if unset. */
function payer(): Keypair {
  const secret = (process.env.PAYOUT_WALLET_SECRET || '').trim();
  if (!secret) throw new Error('PAYOUT_WALLET_SECRET is not set');
  return Keypair.fromSecretKey(bs58.decode(secret));
}

/** Public address of the payout wallet — safe to expose. */
export function payoutAddress(): string {
  return payer().publicKey.toBase58();
}

/** Current treasury balance in lamports. */
export async function treasuryLamports(): Promise<number> {
  return connection().getBalance(payer().publicKey);
}

/** Send `lamports` from the treasury to `to`. Returns the confirmed signature. */
export async function sendSol(to: string, lamports: number): Promise<string> {
  const from = payer();
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: new PublicKey(to), lamports })
  );
  return sendAndConfirmTransaction(connection(), tx, [from], { commitment: 'confirmed' });
}
