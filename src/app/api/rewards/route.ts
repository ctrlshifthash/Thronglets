import { NextResponse } from 'next/server';
import { LAMPORTS_PER_SOL, payoutConfig, tierFor } from '@/lib/rewards';
import { payoutAddress, treasuryLamports } from '@/lib/payout';
import { isValidAddress, readHolding } from '@/lib/solana';

export const dynamic = 'force-dynamic';

/** Read a wallet's $THRONG holdings and resolve its reward tier. Public data. */
export async function GET(req: Request) {
  try {
    const address = new URL(req.url).searchParams.get('address') ?? '';

    // No address → public status of the reward system (live? funded? pool?).
    if (!address) {
      const cfg = payoutConfig();
      let treasuryLam: number | null = null;
      try {
        treasuryLam = await treasuryLamports();
      } catch {
        /* treasury not configured */
      }
      let treasuryWallet = '';
      try {
        treasuryWallet = payoutAddress();
      } catch {
        /* no secret configured */
      }
      return NextResponse.json({
        status: {
          enabled: cfg.enabled,
          cluster: cfg.cluster,
          dailyPoolSol: cfg.dailyPoolLamports / LAMPORTS_PER_SOL,
          treasurySol: treasuryLam === null ? null : treasuryLam / LAMPORTS_PER_SOL,
          funded: treasuryLam !== null && treasuryLam > cfg.feeBufferLamports,
          treasuryWallet,
        },
      });
    }

    if (!isValidAddress(address)) {
      return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 });
    }
    const holding = await readHolding(address);
    const t = tierFor(holding.pct);
    return NextResponse.json({
      address,
      balance: holding.balance,
      supply: holding.supply,
      pct: holding.pct,
      tier: { name: t.name, multiplier: t.multiplier, eligible: t.eligible },
    });
  } catch (err) {
    console.error('[api/rewards]', err);
    return NextResponse.json({ error: 'Could not read holdings right now.' }, { status: 500 });
  }
}
