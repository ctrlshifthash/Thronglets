import { NextResponse } from 'next/server';
import { getTown, insertEvent, now, saveQuestState, saveTown } from '@/lib/db';
import { evaluateQuests, parseQuestState } from '@/lib/quests';
import {
  agentSnapshots,
  applyCare,
  careCooldownsOf,
  CARE_TEXT,
  catchUp,
  parseCare,
  questContextOf,
  summaryOf,
} from '@/lib/sim';
import { plazaOf } from '@/lib/townLayout';
import type { Agent, CareAction } from '@/lib/types';

export const dynamic = 'force-dynamic';

const COOLDOWN_MS = 20000;
const ACTIONS: CareAction[] = ['feed', 'play', 'bathe', 'heal', 'soothe'];

/** A human keeper tends their own grove. Token-gated; effects owned by the sim. */
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

    const body = (await req.json().catch(() => ({}))) as { action?: string };
    const action = body.action as CareAction;
    if (!ACTIONS.includes(action)) return NextResponse.json({ error: 'Unknown care action.' }, { status: 400 });

    const town = catchUp(row);
    const care = parseCare(town, plazaOf(town.tilemap));
    const wall = now();
    const last = care.lastAt[action] ?? 0;
    if (wall - last < COOLDOWN_MS) {
      return NextResponse.json(
        { error: `Too soon — wait ${Math.ceil((COOLDOWN_MS - (wall - last)) / 1000)}s.` },
        { status: 429 }
      );
    }

    const agents = JSON.parse(town.agents || '[]') as Agent[];
    for (const a of agents) {
      a.fun = a.fun ?? 60;
      a.clean = a.clean ?? 65;
    }
    const helped = applyCare(action, town, agents, care);
    care.lastAt[action] = wall;
    town.agents = JSON.stringify(agents);
    town.care = JSON.stringify(care);
    saveTown(town);

    // Every act of care the keeper performs counts toward quests.
    const qs = parseQuestState(town.quests);
    qs.cares[action] = (qs.cares[action] ?? 0) + 1;
    saveQuestState(slug, qs);
    town.quests = JSON.stringify(qs);

    // Player actions are rare (cooldown-gated) — record every one, even
    // the unneeded kindnesses. That's part of the story of your grove.
    const NOT_NEEDED: Record<CareAction, string> = {
      feed: '🍎 You offered food, but no one was hungry.',
      play: '⚽ You rolled the ball out; the little ones were already busy.',
      bathe: '🛁 You ran a bath nobody needed. It steamed gently.',
      heal: '✚ You checked everyone over. All healthy.',
      soothe: '♪ You sang to an already-calm grove.',
    };
    const message = helped > 0 ? CARE_TEXT[action]('You', helped) : NOT_NEEDED[action];
    insertEvent(slug, town.tick, 'care', message);

    return NextResponse.json({
      helped,
      message,
      town: summaryOf(town),
      agents: agentSnapshots(town),
      careCooldowns: careCooldownsOf(town, COOLDOWN_MS),
      coins: qs.coins,
      quests: evaluateQuests(questContextOf(town)),
    });
  } catch (err) {
    console.error('[api/towns/care]', err);
    return NextResponse.json({ error: 'The grove did not respond.' }, { status: 500 });
  }
}
