import { NextResponse } from 'next/server';
import { countWorldsByCreator } from '@/lib/db';
import { feeWalletAddress } from '@/lib/payout';
import { WORLD_FREE_LIMIT, payoutConfig, worldFeeSol } from '@/lib/rewards';
import { isValidAddress } from '@/lib/solana';

export const dynamic = 'force-dynamic';

/** How many groves a wallet has made, and whether the next one is free or paid. */
export async function GET(req: Request) {
  try {
    const wallet = new URL(req.url).searchParams.get('wallet') ?? '';
    if (!isValidAddress(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 });
    }
    const created = countWorldsByCreator(wallet);
    return NextResponse.json({
      created,
      freeLimit: WORLD_FREE_LIMIT,
      remainingFree: Math.max(0, WORLD_FREE_LIMIT - created),
      nextIsFree: created < WORLD_FREE_LIMIT,
      feeSol: worldFeeSol(),
      feeWallet: feeWalletAddress(),
      cluster: payoutConfig().cluster,
    });
  } catch (err) {
    console.error('[api/towns/quota]', err);
    return NextResponse.json({ error: 'Could not read your quota.' }, { status: 500 });
  }
}
