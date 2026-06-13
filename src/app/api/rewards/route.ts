import { NextResponse } from 'next/server';
import { tierFor } from '@/lib/rewards';
import { isValidAddress, readHolding } from '@/lib/solana';

export const dynamic = 'force-dynamic';

/** Read a wallet's $THRONG holdings and resolve its reward tier. Public data. */
export async function GET(req: Request) {
  try {
    const address = new URL(req.url).searchParams.get('address') ?? '';
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
