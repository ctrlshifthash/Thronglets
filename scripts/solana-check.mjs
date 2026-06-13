// Validate the RPC + $THRONG mint: read total supply and a wallet's balance.
import { Connection, PublicKey } from '@solana/web3.js';

const RPC = process.env.SOLANA_RPC_URL;
const MINT = 'B5PqW6EgYhgUdtjyfp8TzHGNKKaDUtjNCSWL7bPbpump';
const TEST_OWNER = process.argv[2] || '3EFeMFoeWRhJCkmjm53xywNAZt1nVTPA54smR82b1zsN';

if (!RPC) throw new Error('set SOLANA_RPC_URL');
const conn = new Connection(RPC, 'confirmed');

const supply = await conn.getTokenSupply(new PublicKey(MINT));
console.log('supply uiAmount:', supply.value.uiAmount, '· decimals:', supply.value.decimals);

const accounts = await conn.getParsedTokenAccountsByOwner(new PublicKey(TEST_OWNER), { mint: new PublicKey(MINT) });
let bal = 0;
for (const a of accounts.value) bal += a.account.data.parsed.info.tokenAmount.uiAmount || 0;
console.log('owner', TEST_OWNER, 'balance:', bal);
console.log('holding %:', supply.value.uiAmount ? ((bal / supply.value.uiAmount) * 100).toFixed(5) : 'n/a');
