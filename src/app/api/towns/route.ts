import { NextResponse } from 'next/server';
import { kickAccrual } from '@/lib/rewardLedger';
import { catchUpAll, catchUpPlayerTowns, ensureBackgroundTicker, summaryOf } from '@/lib/sim';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    ensureBackgroundTicker();
    kickAccrual(); // non-blocking: accrue rewards on normal traffic


    const towns = catchUpAll().map(summaryOf);
    // Groves raised by visitors — public, spectatable by anyone.
    const community = catchUpPlayerTowns().map(summaryOf);
    return NextResponse.json({ towns, community });
  } catch (err) {
    console.error('[api/towns]', err);
    return NextResponse.json({ error: 'Observatory offline.' }, { status: 500 });
  }
}
