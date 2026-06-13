import { NextResponse } from 'next/server';
import { getTown } from '@/lib/db';
import { claimReward } from '@/lib/rewardLedger';
import { isValidAddress } from '@/lib/solana';

export const dynamic = 'force-dynamic';

/**
 * Claim a grove's accrued reward to its linked wallet. Owner-token gated;
 * every guardrail (enable flag, cooldown, eligibility, caps, treasury,
 * per-slug lock) lives in claimReward — the route only authenticates.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { slug?: string; wallet?: string };
    const slug = String(body.slug ?? '');
    const wallet = String(body.wallet ?? '');

    const row = getTown(slug);
    if (!row || !row.is_player) return NextResponse.json({ error: 'No such grove.' }, { status: 404 });

    const token = req.headers.get('x-owner-token') ?? '';
    if (!token || token !== row.owner_token) {
      return NextResponse.json({ error: 'Only this grove’s keeper can do that.' }, { status: 403 });
    }
    if (!isValidAddress(wallet)) {
      return NextResponse.json({ error: 'That is not a valid Solana address.' }, { status: 400 });
    }

    const res = await claimReward(slug, wallet);
    if (!res.ok) {
      return NextResponse.json({ error: res.error, nextClaimAt: res.nextClaimAt }, { status: 400 });
    }
    return NextResponse.json(res);
  } catch (err) {
    console.error('[api/rewards/claim]', err);
    return NextResponse.json({ error: 'The claim did not go through.' }, { status: 500 });
  }
}
