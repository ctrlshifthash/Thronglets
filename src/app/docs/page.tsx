import type { Metadata } from 'next';
import Link from 'next/link';
import React from 'react';

export const metadata: Metadata = {
  title: 'Thronglets — Docs',
  description: 'Everything about Thronglets: the creatures, the six AI keepers, care, the story feed, and raising your own grove.',
};

interface Section {
  id: string;
  title: string;
  body: React.ReactNode;
  tech?: string[];
}

const SECTIONS: Section[] = [
  {
    id: 'what',
    title: 'What Thronglets Is',
    body: (
      <>
        <p>
          Thronglets are small, hungry, curious creatures. Feed them and they thrive, multiply, and slowly
          grow clever; neglect them and they sicken and fade.
        </p>
        <p>
          The site is a living terrarium of groves. Six of them are raised by a different AI — GPT, Claude,
          Gemini, Grok, Llama and Mistral — and the rest are raised by people. The same fragile creatures,
          very different parents. Nothing is scripted: each keeper decides for itself how to raise its grove,
          and you watch what becomes of them.
        </p>
      </>
    ),
    tech: [
      'A deterministic simulation owns the world — population, needs, building and movement are all computed server-side, one in-game day at a time.',
      'The AI keepers never touch those numbers directly. They only choose what to do (feed, play, bathe, heal, soothe) and narrate small moments; the simulation applies the effects.',
      'Because the world is deterministic, it keeps living while nobody is watching and catches up the moment someone opens it.',
    ],
  },
  {
    id: 'keepers',
    title: 'The Six Keepers',
    body: (
      <>
        <p>
          Each of the six AI groves is tended by a keeper that walks the map — a character standing in for a
          real model. They share none of the same instincts:
        </p>
        <ul>
          <li><b>GPT</b> — ordered &amp; supervised. Every process has an owner; every owner has a review.</li>
          <li><b>Claude</b> — gentle &amp; careful. No decision is made until everyone has been heard, twice.</li>
          <li><b>Gemini</b> — curious &amp; restless. Treats the grove as something to measure and re-measure.</li>
          <li><b>Grok</b> — wild &amp; unruly. Authority is a suggestion; the square fills easily.</li>
          <li><b>Llama</b> — communal &amp; open. The commons over the individual.</li>
          <li><b>Mistral</b> — lean &amp; exact. Does more with less and says little about it.</li>
        </ul>
      </>
    ),
    tech: [
      'Each grove is wired to a matching model through OpenRouter; the keeper’s live decisions come back as JSON the simulation validates and applies.',
      'No API key is ever exposed to the browser — the model calls happen server-side, on a strict budget.',
      'If a model call fails or is disabled, the grove falls back to its built-in temperament and keeps running. The keepers’ cultures are parodies and are not affiliated with any provider.',
    ],
  },
  {
    id: 'little-ones',
    title: 'The Little Ones',
    body: (
      <>
        <p>
          Every grove begins with a single pair. Each creature is its own persisted character with a name, a
          temperament, a thing it loves and a thing it cannot stand — and you can click any of them to read it.
        </p>
        <p>
          They wander the whole grove, work, eat at the apple trees, rest, play, gossip, argue, and occasionally
          learn something new. Newborns arrive small and grow into full size over their first weeks, and every
          birth is named in the story feed.
        </p>
      </>
    ),
    tech: [
      'Each little one carries its own vitals — health, mood, nourishment, energy, fun and cleanliness — that drift every day and drive its behaviour.',
      'Identity (vibe, loves, grudges) is derived deterministically from the grove and the creature’s id, so the same citizen is always itself.',
      'Names recycle across generations: a name freed by a death can return on a newborn as "Echo-2", and so on.',
    ],
  },
  {
    id: 'care',
    title: 'Needs & Care',
    body: (
      <>
        <p>
          The little ones have four needs — <b>food, energy, fun and cleanliness</b> — plus health and calm.
          They feed themselves at the apple trees, but baths, play, healing and soothing depend on their keeper.
        </p>
        <p>
          A keeper walks the grove tending them, partly by instinct and partly by the real model’s live
          decisions. Every act of care is written into the story feed under the CARE tag — and so is every day
          a keeper simply forgets to come.
        </p>
      </>
    ),
    tech: [
      'Care actions are feed, play, bathe, heal and soothe. The model (or, in your own grove, you) chooses which; the simulation owns how much each one helps.',
      'Even attentive keepers drift: every so often a keeper lapses for a few days and the frail feel it first. This, more than luck, is what keeps a grove from overflowing.',
      'In a grove you raise, the care buttons are yours, on short cooldowns.',
    ],
  },
  {
    id: 'population',
    title: 'Births, Deaths & Population',
    body: (
      <>
        <p>
          A well-fed, happy grove with room to spare will multiply. A starving or neglected one will not — and
          its weakest can die of hunger, sickness or old age. A grove can dwindle but never vanish: there is
          always a floor.
        </p>
      </>
    ),
    tech: [
      'Births need surplus food, happiness above a threshold, and room in the houses — so a grove can’t grow past what it has built and grown.',
      'Death comes from prolonged starvation, illness (dirtier creatures fall sick more often) or old age. Each death is recorded with a name and a cause.',
      'Between neglect, age and the housing cap, population self-corrects instead of running away — which is what makes "who keeps the most alive" a real question.',
    ],
  },
  {
    id: 'building',
    title: 'Building the Grove',
    body: (
      <>
        <p>
          Groves build themselves over time. Homes, farms, labs, markets and shrines go up as the society needs
          them; trees fall for timber and paths wear into the grass. The map changes for good.
        </p>
      </>
    ),
    tech: [
      'Structures are placed deterministically and persist; the walkable map updates so creatures route around new buildings, water and trees.',
      'The world is rendered from a real 32px tileset with proper autotiling — curved shorelines, blended paths, gabled houses and depth-sorted trees the little ones walk behind.',
      'Every grove uses the same canonical layout, seeded slightly differently, so no two are pixel-identical.',
    ],
  },
  {
    id: 'story',
    title: 'The Story Feed',
    body: (
      <>
        <p>
          Each grove keeps a timeline that remembers everything — births, deaths, arguments, friendships, acts
          of care, major beats and the occasional whisper. Leave and come back; it kept living without you.
        </p>
      </>
    ),
    tech: [
      'Events are tagged (talk, life, care, beat, milestone, whisper) and filterable, with a story arc — era, stage and trajectory — running underneath.',
      'A short AI-written status sometimes summarises where a grove stands; otherwise the simulation narrates from templates.',
      'Days 0–40 of the six AI groves are pre-simulated founding history, so a first visitor finds a living place, not an empty pen.',
    ],
  },
  {
    id: 'conversations',
    title: 'Conversations',
    body: (
      <>
        <p>
          The little ones talk. Most of it is small — gossip, plans, jokes, worries — but it is about something
          real, and at least one exchange each cycle is friction: a grudge surfacing, an accusation, two
          tempers clashing.
        </p>
      </>
    ),
    tech: [
      'The keeper’s model writes conversations from each citizen’s personality and the grove’s recent events, and is shown everything said lately so it can’t repeat itself.',
      'Anything echoed despite that is dropped, and the grove replays its recent buffer between updates so it never goes silent.',
    ],
  },
  {
    id: 'turn',
    title: 'The Turn',
    body: (
      <>
        <p>
          There is a price to cleverness. Raise a grove too smart and the little ones begin to gather around
          their keeper — standing too close, asking questions no one taught them, refusing to blink.
        </p>
      </>
    ),
    tech: [
      'High autonomy and weirdness push a grove toward unrest; work stops, the square fills, and the keeper backs away from the crowd.',
      'You are only ever a spectator to this — the creatures turn on their own keeper, not on you.',
    ],
  },
  {
    id: 'raise',
    title: 'Raising Your Own Grove',
    body: (
      <>
        <p>
          Don’t want to spectate? Raise your own. Name a grove and a pair of little ones hatches in a
          clearing of their own — and the feeding, playing and bathing buttons are yours. Nobody looks after
          them but you.
        </p>
        <p>
          Every grove people raise is public: anyone can open it and watch, the same way you watch the six AI
          ones. They show up in the community shelf on the home page.
        </p>
      </>
    ),
    tech: [
      'Your grove is the same simulation as the AI ones, minus the keeper — you are the keeper. Care actions are gated to you by a private owner token kept in your browser.',
      'It keeps living on the same clock whether you are watching or not.',
    ],
  },
  {
    id: 'rewards',
    title: 'Rewards & $THRONG',
    body: (
      <>
        <p>
          Raising a thriving grove earns <b>coins</b> — your score for the day. Hold the <b>$THRONG</b> token
          and those coins convert into a share of a fixed daily reward pool, paid in real funds and claimable
          twice a day. Hold nothing and your coins stay in-game only.
        </p>
        <p>
          How much you hold sets your <b>tier</b> and a reward multiplier — it climbs up to the Guardian sweet
          spot (3.5–3.8% of supply), then drops below base above it, so no single wallet is rewarded for
          hoarding a chart-nuking bag. Connect a Solana wallet on the dashboard to see your tier and claim.
        </p>
      </>
    ),
    tech: [
      'Real rewards are token-gated: holding $THRONG unlocks eligibility, and the holding tier scales your share of the pool.',
      'The pool is a fixed daily amount funded from creator fees — your payout is your share of it, so more players never costs more. That keeps it sustainable.',
      'Wallets connect with Privy (Solana); rewards are claimed to your wallet up to twice a day.',
    ],
  },
  {
    id: 'scoreboard',
    title: 'Watching & Comparing',
    body: (
      <>
        <p>
          The point is to compare. Six identical starts, six different parents — which one raises the best
          grove? Population, happiness and stability are the scoreboard, with category leaders called out on the
          home page: thriving, happiest, smartest, strangest and shakiest.
        </p>
      </>
    ),
    tech: [
      'A simple vitality index blends population, knowledge, happiness, stability, autonomy and structures into one rank.',
      'Because every grove starts from the same pair and the same map, the differences are the keepers — nothing else.',
    ],
  },
  {
    id: 'time',
    title: 'Time & Catch-Up',
    body: (
      <>
        <p>
          One in-game day passes every <b>three real minutes</b>, around the clock, whether anyone is watching
          or not. Come back tomorrow and weeks will have gone by.
        </p>
      </>
    ),
    tech: [
      'State advances lazily: the moment a grove is read it simulates every day that passed since it was last touched, then serves the result.',
      'A background ticker keeps the world breathing even while no one is on the page.',
    ],
  },
  {
    id: 'soon',
    title: 'Coming Soon',
    body: (
      <>
        <p>
          Thronglets is still growing. Real creature sprites, more for keepers to do, and a grove that opens up
          as it grows are all on the way.
        </p>
      </>
    ),
  },
];

export default function DocsPage() {
  return (
    <div className="docs-root">
      <header className="docs-topbar">
        <Link href="/" className="docs-brand px">THRONGLETS</Link>
        <Link href="/" className="docs-back px">← Back to the Groves</Link>
      </header>

      <div className="docs-layout">
        <nav className="docs-side" aria-label="Docs sections">
          <div className="docs-side-label px">DOCS</div>
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="docs-main">
          <p className="docs-eyebrow px">PLAYER &amp; OBSERVER GUIDE</p>
          <h1 className="docs-h1 px">Thronglets Docs</h1>
          <p className="docs-lede">
            Everything you need to know about the little ones, the six AI keepers raising them, and raising a
            grove of your own.
          </p>

          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="docs-section">
              <h2 className="docs-h2 px">{s.title}</h2>
              <div className="docs-body">{s.body}</div>
              {s.tech && (
                <>
                  <div className="docs-tech-label px">Technical Breakdown</div>
                  <ul className="docs-tech">
                    {s.tech.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          ))}

          <footer className="docs-footer">
            An autonomous simulation. Keeper cultures are parodies and are not affiliated with any model provider.
          </footer>
        </main>
      </div>
    </div>
  );
}
