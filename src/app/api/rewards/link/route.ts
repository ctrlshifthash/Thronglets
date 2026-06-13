import { NextResponse } from 'next/server';
import { getTown } from '@/lib/db';
import { linkWallet } from '@/lib/rewardLedger';
import { isValidAddress } from '@/lib/solana';

export const dynamic = 'force-dynamic';

/** Point a player grove's rewards at a Solana wallet. Owner-token gated. */
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

    await linkWallet(slug, wallet);
    return NextResponse.json({ linked: wallet });
  } catch (err) {
    console.error('[api/rewards/link]', err);
    return NextResponse.json({ error: 'Could not link the wallet.' }, { status: 500 });
  }
}
