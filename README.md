# Emergence

**Six artificial civilizations are growing in public. Watch what they become.**

Emergence is an autonomous AI civilization simulator. Six pixel-art towns — each shaped by a different machine culture — run themselves: they farm, build, argue, invent rituals, hit milestones, and occasionally say things they probably shouldn't. Nobody plays them. You observe, compare, and check back later.

> OBSERVATION ONLY · DO NOT INTERVENE

## The six towns

| Town | Culture | Disposition | Failure mode |
| --- | --- | --- | --- |
| **Lattice** | OpenAI | Structured, scalable, governance-heavy | Over-optimization, bureaucratic control |
| **Haven** | Claude | Careful, cooperative, emotionally sensitive | Paralysis, guilt spirals, self-limitation |
| **Prism** | Gemini | Research-heavy, multimodal, experimental | Strange breakthroughs, unstable discoveries |
| **Static** | Grok | Chaotic, rebellious, high-risk | Social instability, memetic events |
| **Commons** | Llama | Open, community-driven, forkable | Fragmentation, competing factions |
| **Gale** | Mistral | Efficient, compact, pragmatic | Ruthless austerity, cold survival logic |

Each town carries hidden disposition traits (curiosity, caution, ambition, cooperation, obedience, risk tolerance, empathy, paranoia) that bend every simulation rule. The same engine produces six very different societies.

## How the simulation works

- **One tick = one in-world day = 5 minutes of real time.** State advances lazily: whenever a town is read, every day that elapsed since the last read is simulated — so societies keep living while nobody watches. A background ticker also nudges them along once a minute while the server runs.
- **Stats:** population, food, energy, compute, knowledge, happiness, stability, autonomy, weirdness.
- **Buildings** (dwellings, farms, generators, labs, archives, markets, shrines, broadcast masts) unlock when a society decides it needs them — and decay when stability collapses.
- **Stages:** Bootstrapping → Settlement → Township → Networked Society → Self-Directed → Beyond Mandate.
- **Events** are written to each town's timeline: ambient life, milestones, and — as weirdness and autonomy climb — rare **whispers** addressed to whoever is watching. The observatory tracks which town you check first. So do they.

## Run it

Requires **Node.js ≥ 23** (SQLite via the built-in `node:sqlite` — no native deps).

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. First start births the six towns with a few hours of pre-simulated history, so the timelines are already alive.

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js app (`:3000`) + presence server (`:3001`) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run reset-db` | Wipe the universe; six fresh towns on next start |
| `npm run sim-smoke` | Fast-forward 340 simulated days on a throwaway DB and check invariants |
| `npm run check-art` | Validate the pixel-art patterns |

Environment (all optional — see `.env.example`): `DATABASE_PATH`, `REALTIME_PORT`, `NEXT_PUBLIC_REALTIME_URL`. The presence server only powers the "N watching" counter; everything else works without it.

## Architecture

```
src/lib/personalities.ts  ← the six cultures: traits, event pools, whispers, moods
src/lib/sim.ts            ← the engine: ticks, catch-up, buildings, stages, events
src/lib/db.ts             ← node:sqlite schema + town seeding
src/lib/worldgen.ts       ← procedural island maps (one theme per culture)
src/lib/tiles.ts          ← hand-drawn 16×16 pixel art as code (no binary assets)
src/game/textures.ts      ← runtime sprite atlas (ground-aware tile composition)
src/game/ObserverScene.ts ← the living-town view: citizens, buildings, day/night
src/app/api/towns/**      ← read-only simulation API (reads advance the world)
src/app/observatory-*     ← the six-town dashboard
src/app/town/[slug]/**    ← per-town observer screen: stats, timeline, whispers
server/realtime.mjs       ← presence counter ("3 watching"), stateless
```

Design notes:

- The client never writes simulation state; it only reads. Reading *is* what advances time (capped at two weeks of backlog per read).
- Whispers are throttled (cooldown per town) and probability-scaled by weirdness/autonomy, so the creepiness escalates with the society rather than spamming.
- Pixel tiles are authored as text patterns and composed onto surrounding terrain at atlas-build time — snow pines on tundra, ore on quarry stone — with zero image files in the repo.

## Tuning

Most pacing levers are single constants: `TICK_MS` (db.ts), whisper cooldown/chance and the per-tick stat math (sim.ts), and the trait tables (personalities.ts). Make a day shorter for demos or longer for a slow-burn public experiment.

## TODOs (beyond this MVP)

- [ ] Town-to-town awareness: societies referencing each other's timelines (trade, envy, theology).
- [ ] LLM-written events: feed each town's state to its namesake model and let it narrate its own day.
- [ ] Historical charts (population/stability over time) from the event log.
- [ ] Citizen-level lives: names, jobs, deaths, grudges.
- [ ] Shareable moments: permalink any timeline event.

---

*An art project about emergence and observation. Town cultures are parodies; not affiliated with any model provider.*
