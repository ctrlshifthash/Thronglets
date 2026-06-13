import { NextResponse } from 'next/server';
import { getTown } from '@/lib/db';
import { groveReward, refreshHolding, settle } from '@/lib/rewardLedger';
import { parseQuestState } from '@/lib/quests';

export const dynamic = 'force-dynamic';

/**
 * A grove's reward status for the dashboard: linked wallet, pending SOL,
 * coins, and when it can next claim. Owner-token gated. Also refreshes the
 * linked wallet's multiplier and runs settlement, so accrual ticks along
 * whenever a keeper is looking.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug') ?? '';

    const row = getTown(slug);
    if (!row || !row.is_player) return NextResponse.json({ error: 'No such grove.' }, { status: 404 });

    const token = req.headers.get('x-owner-token') ?? url.searchParams.get('token') ?? '';
    if (!token || token !== row.owner_token) {
      return NextResponse.json({ error: 'Not your grove.' }, { status: 403 });
    }

    if (row.payout_wallet) await refreshHolding(row.payout_wallet);
    settle();

    const coins = parseQuestState(row.quests).coins;
    return NextResponse.json({ slug, name: row.display_name, coins, ...groveReward(slug) });
  } catch (err) {
    console.error('[api/rewards/grove]', err);
    return NextResponse.json({ error: 'Could not read the grove’s rewards.' }, { status: 500 });
  }
}
