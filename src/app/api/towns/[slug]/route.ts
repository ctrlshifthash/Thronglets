import { NextResponse } from 'next/server';
import { cachedAiSummary, maybeGenerateAI, narratorInfo } from '@/lib/aiNarrative';
import { addView, getTown, listEvents } from '@/lib/db';
import { PERSONAS } from '@/lib/personalities';
import {
  agentSnapshots,
  careCooldownsOf,
  catchUp,
  chatterOf,
  ensureBackgroundTicker,
  keeperPublicOf,
  parsePlacements,
  storySummaryText,
  summaryOf,
} from '@/lib/sim';
import type { Buildings, TownDetail } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    ensureBackgroundTicker();
    const { slug } = await ctx.params;
    const row = getTown(slug);
    if (!row) return NextResponse.json({ error: 'No such town.' }, { status: 404 });

    const url = new URL(req.url);
    const afterId = Number(url.searchParams.get('after') ?? 0) || 0;
    if (url.searchParams.get('watch') === '1') {
      addView(slug);
      row.views += 1;
    }

    const town = catchUp(row);
    const persona = PERSONAS[town.slug as keyof typeof PERSONAS];

    // Optional AI flavor: budgeted, async, never blocks or mutates the sim.
    maybeGenerateAI(town);
    const summaryText = cachedAiSummary(town) ?? storySummaryText(town);

    // Incremental poll: stats + buildings + placements + agents + chatter + keeper + new events.
    if (afterId > 0) {
      return NextResponse.json({
        town: summaryOf(town),
        buildings: JSON.parse(town.buildings) as Buildings,
        placements: parsePlacements(town),
        agents: agentSnapshots(town),
        chatter: chatterOf(town),
        keeper: keeperPublicOf(town),
        careCooldowns: careCooldownsOf(town),
        summaryText,
        events: listEvents(slug, afterId),
      });
    }

    const detail: TownDetail = {
      ...summaryOf(town),
      description: persona?.description ?? 'A grove raised by hand. Its little ones answer to whoever feeds them.',
      buildings: JSON.parse(town.buildings) as Buildings,
      placements: parsePlacements(town),
      agents: agentSnapshots(town),
      chatter: chatterOf(town),
      summaryText,
      narrator: narratorInfo(town.slug as never),
      keeper: keeperPublicOf(town),
      isPlayer: Boolean(town.is_player),
      careCooldowns: careCooldownsOf(town),
      events: listEvents(slug, 0, 100),
      views: town.views,
    };
    return NextResponse.json({ town: detail });
  } catch (err) {
    console.error('[api/towns/slug]', err);
    return NextResponse.json({ error: 'Observatory offline.' }, { status: 500 });
  }
}
