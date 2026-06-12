import { NextResponse } from 'next/server';
import { createPlayerTown } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Birth a player-raised grove. Returns the slug and the owner token (shown once). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { name?: string };
    const name = String(body.name ?? '').trim();
    if (name.length < 2) {
      return NextResponse.json({ error: 'Give your grove a name (2+ characters).' }, { status: 400 });
    }
    const { slug, token } = createPlayerTown(name);
    return NextResponse.json({ slug, token });
  } catch (err) {
    console.error('[api/towns/create]', err);
    return NextResponse.json({ error: 'Could not plant the grove.' }, { status: 500 });
  }
}
