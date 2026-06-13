import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_MINT } from './rewards';

// Server-side $THRONG holdings reader. The RPC URL (with any API key) is
// read from env and never reaches the client.

let cached: Connection | null = null;
function connection(): Connection {
  if (!cached) {
    const rpc = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    cached = new Connection(rpc, 'confirmed');
  }
  return cached;
}

export interface Holding {
  balance: number; // tokens held
  supply: number; // total supply
  pct: number; // balance as % of supply
}

export function isValidAddress(address: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/** Read a wallet's $THRONG balance and its share of total supply. */
export async function readHolding(address: string): Promise<Holding> {
  const conn = connection();
  const owner = new PublicKey(address);
  const mint = new PublicKey(TOKEN_MINT);
  const [supplyRes, accounts] = await Promise.all([
    conn.getTokenSupply(mint),
    conn.getParsedTokenAccountsByOwner(owner, { mint }),
  ]);
  const supply = supplyRes.value.uiAmount ?? 0;
  let balance = 0;
  for (const a of accounts.value) {
    balance += (a.account.data as { parsed: { info: { tokenAmount: { uiAmount: number | null } } } }).parsed.info.tokenAmount.uiAmount || 0;
  }
  return { balance, supply, pct: supply > 0 ? (balance / supply) * 100 : 0 };
}
