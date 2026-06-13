import { NextResponse } from 'next/server';
import { getTown, insertEvent, saveQuestState } from '@/lib/db';
import { evaluateQuests, parseQuestState, questById } from '@/lib/quests';
import { catchUp, questContextOf } from '@/lib/sim';

export const dynamic = 'force-dynamic';

/** Claim a completed quest's coin reward. Owner-token gated; re-validated server-side. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const row = getTown(slug);
    if (!row) return NextResponse.json({ error: 'No such grove.' }, { status: 404 });
    if (!row.is_player) return NextResponse.json({ error: 'This grove has its own keeper.' }, { status: 403 });

    const token = req.headers.get('x-owner-token') ?? '';
    if (!token || token !== row.owner_token) {
      return NextResponse.json({ error: 'Only this grove’s keeper can do that.' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { questId?: string };
    const quest = questById(String(body.questId ?? ''));
    if (!quest) return NextResponse.json({ error: 'Unknown quest.' }, { status: 400 });

    const town = catchUp(row);
    const context = questContextOf(town);
    const qs = parseQuestState(town.quests);

    if (qs.claimed.includes(quest.id)) {
      return NextResponse.json({ error: 'Already claimed.' }, { status: 409 });
    }
    if (quest.progress(context) < quest.target) {
      return NextResponse.json({ error: 'Not finished yet.' }, { status: 400 });
    }

    qs.claimed.push(quest.id);
    qs.coins += quest.reward;
    saveQuestState(slug, qs);
    town.quests = JSON.stringify(qs);
    insertEvent(slug, town.tick, 'care', `★ Quest complete: ${quest.title} (+${quest.reward} coins).`);

    return NextResponse.json({
      claimed: quest.id,
      reward: quest.reward,
      coins: qs.coins,
      quests: evaluateQuests(questContextOf(town)),
    });
  } catch (err) {
    console.error('[api/towns/quests/claim]', err);
    return NextResponse.json({ error: 'The grove did not respond.' }, { status: 500 });
  }
}
