import { NextResponse } from 'next/server';
import { countWorldsByCreator, createPlayerTown, feePaymentExists, recordFeePayment } from '@/lib/db';
import { feeWalletAddress } from '@/lib/payout';
import { WORLD_FREE_LIMIT, worldFeeLamports, worldFeeSol } from '@/lib/rewards';
import { isValidAddress, verifyFeePayment } from '@/lib/solana';

export const dynamic = 'force-dynamic';

/**
 * Birth a player-raised grove. Anti-farm: each wallet gets WORLD_FREE_LIMIT
 * free groves, then must pay a SOL fee (verified on-chain, one payment per
 * grove) for each additional one. Returns the slug and one-time owner token.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      wallet?: string;
      paymentSignature?: string;
    };
    const name = String(body.name ?? '').trim();
    const wallet = String(body.wallet ?? '').trim();
    const signature = String(body.paymentSignature ?? '').trim();

    if (name.length < 2) {
      return NextResponse.json({ error: 'Give your grove a name (2+ characters).' }, { status: 400 });
    }
    if (!isValidAddress(wallet)) {
      return NextResponse.json({ error: 'Connect a Solana wallet to plant a grove.' }, { status: 400 });
    }

    const created = countWorldsByCreator(wallet);
    const feeWallet = feeWalletAddress();
    const fee = worldFeeLamports();

    // Beyond the free allowance, a verified on-chain payment is required.
    if (created >= WORLD_FREE_LIMIT) {
      if (!feeWallet) {
        return NextResponse.json({ error: 'Paid grove creation isn’t available right now.' }, { status: 503 });
      }
      if (!signature) {
        return NextResponse.json(
          {
            error: 'fee_required',
            message: `You’ve used your ${WORLD_FREE_LIMIT} free groves. Creating another costs ${worldFeeSol()} SOL.`,
            feeSol: worldFeeSol(),
            feeWallet,
            created,
            freeLimit: WORLD_FREE_LIMIT,
          },
          { status: 402 }
        );
      }
      if (feePaymentExists(signature)) {
        return NextResponse.json({ error: 'That payment has already been used.' }, { status: 409 });
      }
      const paid = await verifyFeePayment(signature, wallet, feeWallet, fee);
      if (!paid) {
        return NextResponse.json(
          { error: `Couldn’t verify a ${worldFeeSol()} SOL payment from your wallet. Give it a few seconds and retry.` },
          { status: 402 }
        );
      }
    }

    const { slug, token } = createPlayerTown(name, wallet);
    if (created >= WORLD_FREE_LIMIT && signature) {
      recordFeePayment(signature, wallet, slug, fee);
    }

    return NextResponse.json({ slug, token, created: created + 1, freeLimit: WORLD_FREE_LIMIT });
  } catch (err) {
    console.error('[api/towns/create]', err);
    return NextResponse.json({ error: 'Could not plant the grove.' }, { status: 500 });
  }
}
